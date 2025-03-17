from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
import uuid
import json
import os
from datetime import datetime

app = Flask(__name__, static_folder='../static', template_folder='../templates')
app.config['SECRET_KEY'] = 'texas-holdem-tracker-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///poker_tracker.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

socketio = SocketIO(app, cors_allowed_origins="*")
db = SQLAlchemy(app)

# Create database models
class PlayerModel(db.Model):
    __tablename__ = 'players'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    chips = db.Column(db.Integer, default=1000)
    current_bet = db.Column(db.Integer, default=0)
    total_bet = db.Column(db.Integer, default=0)
    folded = db.Column(db.Boolean, default=False)
    total_won = db.Column(db.Integer, default=0)
    total_lost = db.Column(db.Integer, default=0)
    hands_played = db.Column(db.Integer, default=0)
    hands_won = db.Column(db.Integer, default=0)
    position = db.Column(db.Integer, default=-1)
    is_active = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'username': self.username,
            'chips': self.chips,
            'current_bet': self.current_bet,
            'total_bet': self.total_bet,
            'folded': self.folded,
            'total_won': self.total_won,
            'total_lost': self.total_lost,
            'hands_played': self.hands_played,
            'hands_won': self.hands_won,
            'position': self.position,
            'is_active': self.is_active
        }

class GameStateModel(db.Model):
    __tablename__ = 'game_state'
    
    id = db.Column(db.Integer, primary_key=True)
    active = db.Column(db.Boolean, default=False)
    pot = db.Column(db.Integer, default=0)
    current_round = db.Column(db.String(20), default='preflop')
    small_blind = db.Column(db.Integer, default=5)
    big_blind = db.Column(db.Integer, default=10)
    dealer_position = db.Column(db.Integer, default=0)
    player_order = db.Column(db.Text, default='[]')  # JSON-encoded list of usernames
    
    def to_dict(self):
        return {
            'active': self.active,
            'pot': self.pot,
            'current_round': self.current_round,
            'small_blind': self.small_blind,
            'big_blind': self.big_blind,
            'dealer_position': self.dealer_position,
            'player_order': json.loads(self.player_order)
        }

class GameLogModel(db.Model):
    __tablename__ = 'game_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.now)
    type = db.Column(db.String(20), nullable=False)
    message = db.Column(db.Text, nullable=False)
    username = db.Column(db.String(80))
    amount = db.Column(db.Integer)
    round = db.Column(db.String(20))
    
    def to_dict(self):
        return {
            'timestamp': self.timestamp.isoformat(),
            'type': self.type,
            'message': self.message,
            'username': self.username,
            'amount': self.amount,
            'round': self.round
        }

# Create database tables if they don't exist
with app.app_context():
    db.create_all()

# Player class
class Player:
    def __init__(self, username, chips=1000):
        self.username = username
        self.chips = chips
        self.current_bet = 0
        self.total_bet = 0
        self.folded = False
        self.total_won = 0
        self.total_lost = 0
        self.hands_played = 0
        self.hands_won = 0
        self.position = -1  # Position at the table
        self.is_active = False  # Player is actively in the current game
    
    def place_bet(self, amount):
        """Place a bet of the specified amount"""
        if amount <= 0 or amount > self.chips:
            return False
        
        self.chips -= amount
        self.current_bet += amount
        self.total_bet += amount
        self.total_lost += amount
        return True
    
    def collect_winnings(self, amount):
        """Collect winnings of the specified amount"""
        if amount <= 0:
            return False
        
        self.chips += amount
        self.total_won += amount
        self.hands_won += 1
        return True
    
    def fold(self):
        """Fold the current hand"""
        self.folded = True
        return True
    
    def unfold(self):
        """Return to the game (for the next hand)"""
        self.folded = False
        return True
    
    def reset_bets(self):
        """Reset current bet (between rounds)"""
        self.current_bet = 0
    
    def new_hand(self):
        """Reset player for a new hand"""
        self.current_bet = 0
        self.total_bet = 0
        self.folded = False
        self.hands_played += 1
    
    def adjust_chips(self, amount):
        """Manually adjust player chips (add or remove)"""
        if self.chips + amount < 0:
            amount = -self.chips  # Don't allow negative chip count
        
        self.chips += amount
        
        if amount > 0:
            self.total_won += amount
        else:
            self.total_lost -= amount
    
    def to_dict(self):
        """Convert player object to dictionary for JSON serialization"""
        return {
            'username': self.username,
            'chips': self.chips,
            'current_bet': self.current_bet,
            'total_bet': self.total_bet,
            'folded': self.folded,
            'total_won': self.total_won,
            'total_lost': self.total_lost,
            'hands_played': self.hands_played,
            'hands_won': self.hands_won,
            'position': self.position,
            'is_active': self.is_active
        }

# Game state management
class Game:
    def __init__(self):
        self.players = {}  # map of username -> Player
        self.player_order = []  # list of usernames in order
        self.active = False
        self.pot = 0
        self.game_log = []
        self.current_round = "preflop"
        self.small_blind = 5
        self.big_blind = 10
        self.dealer_position = 0  # Index in player_order
        self.initialized = False
    
    def initialize(self):
        """Initialize game from database if not already initialized"""
        if self.initialized:
            return
        
        try:
            with app.app_context():
                self.load_from_db()
            self.initialized = True
        except Exception as e:
            print(f"Error initializing game: {e}")
    
    def load_from_db(self):
        """Load game state from database"""
        game_state = GameStateModel.query.first()
        if game_state:
            self.active = game_state.active
            self.pot = game_state.pot
            self.current_round = game_state.current_round
            self.small_blind = game_state.small_blind
            self.big_blind = game_state.big_blind
            self.dealer_position = game_state.dealer_position
            self.player_order = json.loads(game_state.player_order)
            
            # Load players
            for username in self.player_order:
                player_model = PlayerModel.query.filter_by(username=username).first()
                if player_model:
                    player = Player(username, player_model.chips)
                    player.current_bet = player_model.current_bet
                    player.total_bet = player_model.total_bet
                    player.folded = player_model.folded
                    player.total_won = player_model.total_won
                    player.total_lost = player_model.total_lost
                    player.hands_played = player_model.hands_played
                    player.hands_won = player_model.hands_won
                    player.position = player_model.position
                    player.is_active = player_model.is_active
                    self.players[username] = player
            
            # Load game logs
            logs = GameLogModel.query.order_by(GameLogModel.timestamp).all()
            for log in logs:
                self.game_log.append(log.to_dict())
    
    def save_to_db(self):
        """Save game state to database"""
        with app.app_context():
            # Save game state
            game_state = GameStateModel.query.first()
            if not game_state:
                game_state = GameStateModel()
            
            game_state.active = self.active
            game_state.pot = self.pot
            game_state.current_round = self.current_round
            game_state.small_blind = self.small_blind
            game_state.big_blind = self.big_blind
            game_state.dealer_position = self.dealer_position
            game_state.player_order = json.dumps(self.player_order)
            
            db.session.add(game_state)
            
            # Save players
            for username, player in self.players.items():
                player_model = PlayerModel.query.filter_by(username=username).first()
                if not player_model:
                    player_model = PlayerModel(username=username)
                
                player_model.chips = player.chips
                player_model.current_bet = player.current_bet
                player_model.total_bet = player.total_bet
                player_model.folded = player.folded
                player_model.total_won = player.total_won
                player_model.total_lost = player.total_lost
                player_model.hands_played = player.hands_played
                player_model.hands_won = player.hands_won
                player_model.position = player.position
                player_model.is_active = player.is_active
                
                db.session.add(player_model)
            
            db.session.commit()
    
    def add_player(self, player):
        """Add a player to the game"""
        self.initialize()  # Ensure game is initialized
        
        if player.username not in self.players:
            self.players[player.username] = player
            self.player_order.append(player.username)
            player.position = len(self.player_order) - 1
            player.is_active = True
            self.add_to_log({
                'type': 'system',
                'message': f'Player {player.username} joined the game'
            })
            self.save_to_db()
            return True
        return False
    
    def remove_player(self, username):
        """Remove a player from the game"""
        self.initialize()  # Ensure game is initialized
        
        if username in self.players:
            self.player_order.remove(username)
            del self.players[username]
            
            self.add_to_log({
                'type': 'system',
                'message': f'Player {username} left the game'
            })
            
            # Update positions for remaining players
            self._update_positions()
            self.save_to_db()
            return True
        return False
    
    def _update_positions(self):
        """Update position values for all players"""
        for i, username in enumerate(self.player_order):
            if username in self.players:
                self.players[username].position = i
    
    def reorder_players(self, new_order):
        """Reorder players based on the new order list"""
        self.initialize()  # Ensure game is initialized
        
        if set(new_order) != set(self.player_order):
            return False  # New order must contain the same players
        
        self.player_order = new_order.copy()
        self._update_positions()
        self.save_to_db()
        return True
    
    def start_game(self, small_blind=5, big_blind=10):
        """Start a new game"""
        self.initialize()  # Ensure game is initialized
        
        if len(self.players) < 2:
            return False
        
        self.active = True
        self.pot = 0
        self.current_round = "preflop"
        self.small_blind = small_blind
        self.big_blind = big_blind
        self.game_log = []
        
        # Reset players for new game
        for username in self.players:
            player = self.players[username]
            player.new_hand()
        
        self.add_to_log({
            'type': 'gameStart',
            'message': 'Game started'
        })
        
        # Post blinds
        self.post_blinds()
        self.save_to_db()
        
        return True
    
    def post_blinds(self):
        """Post small and big blinds"""
        if len(self.player_order) < 2:
            return False
        
        # Small blind is next player after dealer
        sb_pos = (self.dealer_position + 1) % len(self.player_order)
        small_blind_username = self.player_order[sb_pos]
        small_blind_player = self.players[small_blind_username]
        
        # Big blind is next player after small blind
        bb_pos = (self.dealer_position + 2) % len(self.player_order)
        big_blind_username = self.player_order[bb_pos]
        big_blind_player = self.players[big_blind_username]
        
        # Post small blind
        if small_blind_player.chips >= self.small_blind:
            small_blind_amount = min(self.small_blind, small_blind_player.chips)
            small_blind_player.place_bet(small_blind_amount)
            self.pot += small_blind_amount
            
            self.add_to_log({
                'type': 'blinds',
                'username': small_blind_username,
                'amount': small_blind_amount,
                'message': f'{small_blind_username} posted small blind: ${small_blind_amount}'
            })
        
        # Post big blind
        if big_blind_player.chips >= self.big_blind:
            big_blind_amount = min(self.big_blind, big_blind_player.chips)
            big_blind_player.place_bet(big_blind_amount)
            self.pot += big_blind_amount
            
            self.add_to_log({
                'type': 'blinds',
                'username': big_blind_username,
                'amount': big_blind_amount,
                'message': f'{big_blind_username} posted big blind: ${big_blind_amount}'
            })
        
        return True
    
    def place_bet(self, username, amount):
        """Place a bet for a player"""
        self.initialize()  # Ensure game is initialized
        
        if not self.active or username not in self.players:
            return False
        
        player = self.players[username]
        
        if player.folded:
            return False
        
        if player.place_bet(amount):
            self.pot += amount
            
            self.add_to_log({
                'type': 'bet',
                'username': username,
                'amount': amount,
                'round': self.current_round,
                'message': f'{username} bet ${amount} in {self.get_round_name()}. Total pot: ${self.pot}.'
            })
            
            self.save_to_db()
            return True
        
        return False
    
    def fold_player(self, username):
        """Fold a player's hand"""
        self.initialize()  # Ensure game is initialized
        
        if not self.active or username not in self.players:
            return False
        
        player = self.players[username]
        
        if player.fold():
            self.add_to_log({
                'type': 'fold',
                'username': username,
                'folded': True,
                'message': f'{username} folded'
            })
            
            self.save_to_db()
            return True
        
        return False
    
    def unfold_player(self, username):
        """Unfold a player (for the next hand)"""
        self.initialize()  # Ensure game is initialized
        
        if not self.active or username not in self.players:
            return False
        
        player = self.players[username]
        
        if player.unfold():
            self.add_to_log({
                'type': 'fold',
                'username': username,
                'folded': False,
                'message': f'{username} returned to game'
            })
            
            self.save_to_db()
            return True
        
        return False
    
    def next_round(self):
        """Move to the next round"""
        self.initialize()  # Ensure game is initialized
        
        rounds = ['preflop', 'flop', 'turn', 'river']
        current_index = rounds.index(self.current_round)
        
        if current_index < len(rounds) - 1:
            self.current_round = rounds[current_index + 1]
            
            # Reset current bets for new round
            for username in self.players:
                self.players[username].reset_bets()
            
            self.add_to_log({
                'type': 'roundChange',
                'round': self.current_round,
                'message': f'Round changed to {self.get_round_name()}'
            })
            
            self.save_to_db()
            return True
        
        return False
    
    def distribute_pot(self, username, amount):
        """Distribute pot to a player"""
        self.initialize()  # Ensure game is initialized
        
        if not self.active or username not in self.players:
            return False
        
        if amount <= 0 or amount > self.pot:
            return False
        
        player = self.players[username]
        
        if player.collect_winnings(amount):
            self.pot -= amount
            
            self.add_to_log({
                'type': 'distribution',
                'username': username,
                'amount': amount,
                'message': f'{username} received ${amount} from the pot. Remaining pot: ${self.pot}'
            })
            
            self.save_to_db()
            return True
        
        return False
    
    def end_game(self):
        """End the current game"""
        self.initialize()  # Ensure game is initialized
        
        if not self.active:
            return False
        
        self.active = False
        
        self.add_to_log({
            'type': 'gameEnd',
            'message': f'Game ended with pot: ${self.pot}'
        })
        
        # Advance dealer position for next game
        if len(self.player_order) > 0:
            self.dealer_position = (self.dealer_position + 1) % len(self.player_order)
        
        self.save_to_db()
        return True
    
    def add_to_log(self, entry):
        """Add an entry to the game log"""
        log_entry = {
            **entry,
            'timestamp': datetime.now().isoformat()
        }
        self.game_log.append(log_entry)
        
        # Save to database
        with app.app_context():
            log_model = GameLogModel(
                type=entry.get('type', 'system'),
                message=entry.get('message', ''),
                username=entry.get('username'),
                amount=entry.get('amount'),
                round=entry.get('round')
            )
            db.session.add(log_model)
            db.session.commit()
    
    def get_round_name(self):
        """Get the display name for the current round"""
        round_names = {
            'preflop': 'Pre-Flop',
            'flop': 'Flop',
            'turn': 'Turn',
            'river': 'River'
        }
        return round_names.get(self.current_round, self.current_round)
    
    def to_dict(self):
        """Convert game object to dictionary for JSON serialization"""
        self.initialize()  # Ensure game is initialized
        
        player_data = []
        for username in self.player_order:
            if username in self.players:
                player_data.append(self.players[username].to_dict())
        
        return {
            'players': player_data,
            'player_order': self.player_order,
            'active': self.active,
            'pot': self.pot,
            'game_log': self.game_log,
            'current_round': self.current_round,
            'round_name': self.get_round_name(),
            'small_blind': self.small_blind,
            'big_blind': self.big_blind,
            'dealer_position': self.dealer_position
        }

# Create a singleton game instance
game = Game()

# Active users tracking
active_players = {}  # Map of session_id -> username

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        
        # If user doesn't exist, create a new one
        with app.app_context():
            player_model = PlayerModel.query.filter_by(username=username).first()
            if not player_model:
                initial_chips = int(request.form.get('chips', 1000))
                player_model = PlayerModel(username=username, chips=initial_chips)
                db.session.add(player_model)
                db.session.commit()
        
        # Create session
        session['user_id'] = str(uuid.uuid4())
        session['username'] = username
        active_players[session['user_id']] = username
        
        return redirect(url_for('index'))
    
    # Get all player names for the dropdown
    with app.app_context():
        players = PlayerModel.query.all()
        existing_players = [player.username for player in players]
    
    return render_template('login.html', existing_players=existing_players)

@app.route('/logout')
def logout():
    if 'user_id' in session:
        user_id = session['user_id']
        if user_id in active_players:
            username = active_players[user_id]
            del active_players[user_id]
            game.remove_player(username)
            socketio.emit('player_left', {'username': username})
        session.clear()
    return redirect(url_for('login'))

@app.route('/api/players/<username>', methods=['DELETE'])
def delete_player(username):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    with app.app_context():
        player_model = PlayerModel.query.filter_by(username=username).first()
        if player_model:
            # Remove from active game if present
            game.remove_player(username)
            
            # Remove from database
            db.session.delete(player_model)
            db.session.commit()
            
            # Remove from any active sessions
            for sid, user in list(active_players.items()):
                if user == username:
                    del active_players[sid]
            
            socketio.emit('player_removed', {'username': username}, broadcast=True)
            return jsonify({'success': True})
    
    return jsonify({'error': 'Player not found'}), 404

# RESTful API endpoints
@app.route('/api/players', methods=['GET'])
def get_players():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    with app.app_context():
        players = PlayerModel.query.all()
        result = [player.to_dict() for player in players]
    
    return jsonify(result)

@app.route('/api/game', methods=['GET'])
def get_game_state():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    return jsonify(game.to_dict())

# Socket events
@socketio.on('connect')
def on_connect():
    if 'user_id' not in session:
        return False
    
    user_id = session['user_id']
    username = session['username']
    
    # Add player to the game
    with app.app_context():
        player_model = PlayerModel.query.filter_by(username=username).first()
        if player_model:
            player = Player(username, player_model.chips)
            player.total_won = player_model.total_won
            player.total_lost = player_model.total_lost
            player.hands_played = player_model.hands_played
            player.hands_won = player_model.hands_won
            
            game.add_player(player)
            emit('game_state_update', game.to_dict(), broadcast=True)
            emit('player_joined', {'username': username}, broadcast=True)
        else:
            emit('error', {'message': f'Player {username} not found in database'})

@socketio.on('disconnect')
def on_disconnect():
    if 'user_id' in session:
        user_id = session['user_id']
        if user_id in active_players:
            username = active_players[user_id]
            game.remove_player(username)
            emit('game_state_update', game.to_dict(), broadcast=True)
            emit('player_left', {'username': username}, broadcast=True)

@socketio.on('join_game')
def on_join_game(data=None):
    if 'user_id' not in session:
        emit('error', {'message': 'Not authenticated'})
        return
    
    username = session['username']
    
    # Check if player exists in database
    with app.app_context():
        player_model = PlayerModel.query.filter_by(username=username).first()
        if not player_model:
            emit('error', {'message': f'Player {username} not found in database'})
            return
        
        # Create Player object from model
        player = Player(username, player_model.chips)
        player.total_won = player_model.total_won
        player.total_lost = player_model.total_lost
        player.hands_played = player_model.hands_played
        player.hands_won = player_model.hands_won
        
        game.add_player(player)
        emit('game_state_update', game.to_dict(), broadcast=True)

@socketio.on('leave_game')
def on_leave_game():
    if 'user_id' not in session:
        emit('error', {'message': 'Not authenticated'})
        return
    
    username = session['username']
    game.initialize()  # Ensure game is initialized
    
    if username not in game.players:
        emit('error', {'message': f'Player {username} not in game'})
        return
    
    game.remove_player(username)
    emit('game_state_update', game.to_dict(), broadcast=True)

@socketio.on('start_game')
def on_start_game(data):
    if 'user_id' not in session:
        emit('error', {'message': 'Not authenticated'})
        return
    
    small_blind = data.get('small_blind', 5)
    big_blind = data.get('big_blind', 10)
    
    game.initialize()  # Ensure game is initialized
    
    if len(game.players) < 2:
        emit('error', {'message': 'Need at least 2 players to start a game'})
        return
    
    game.start_game(small_blind, big_blind)
    emit('game_state_update', game.to_dict(), broadcast=True)
    emit('game_started', {}, broadcast=True)

@socketio.on('place_bet')
def on_place_bet(data):
    if 'user_id' not in session:
        emit('error', {'message': 'Not authenticated'})
        return
    
    username = data.get('username')
    amount = data.get('amount')
    
    if not username:
        emit('error', {'message': 'No player selected'})
        return
    
    game.initialize()  # Ensure game is initialized
    
    if username not in game.players:
        emit('error', {'message': f'Player {username} not in game'})
        return
    
    if not amount or amount <= 0:
        emit('error', {'message': 'Invalid bet amount'})
        return
    
    success = game.place_bet(username, amount)
    if success:
        emit('game_state_update', game.to_dict(), broadcast=True)
        emit('bet_placed', {'username': username, 'amount': amount}, broadcast=True)
    else:
        emit('error', {'message': f'Failed to place bet for {username}'})

@socketio.on('fold')
def on_fold(data):
    if 'user_id' not in session:
        emit('error', {'message': 'Not authenticated'})
        return
    
    username = data.get('username')
    
    if not username:
        emit('error', {'message': 'No player selected'})
        return
    
    game.initialize()  # Ensure game is initialized
    
    if username not in game.players:
        emit('error', {'message': f'Player {username} not in game'})
        return
    
    success = game.fold_player(username)
    if success:
        emit('game_state_update', game.to_dict(), broadcast=True)
        emit('player_folded', {'username': username}, broadcast=True)
    else:
        emit('error', {'message': f'Failed to fold {username}'})

@socketio.on('next_round')
def on_next_round():
    if 'user_id' not in session:
        emit('error', {'message': 'Not authenticated'})
        return
    
    game.initialize()  # Ensure game is initialized
    
    success = game.next_round()
    if success:
        emit('game_state_update', game.to_dict(), broadcast=True)
        emit('round_changed', {'round': game.current_round}, broadcast=True)
    else:
        emit('error', {'message': 'Failed to advance to next round'})

@socketio.on('distribute_pot')
def on_distribute_pot(data):
    if 'user_id' not in session:
        emit('error', {'message': 'Not authenticated'})
        return
    
    username = data.get('username')
    amount = data.get('amount')
    
    if not username:
        emit('error', {'message': 'No player selected'})
        return
    
    game.initialize()  # Ensure game is initialized
    
    if username not in game.players:
        emit('error', {'message': f'Player {username} not in game'})
        return
    
    if not amount or amount <= 0 or amount > game.pot:
        emit('error', {'message': 'Invalid pot amount'})
        return
    
    success = game.distribute_pot(username, amount)
    if success:
        emit('game_state_update', game.to_dict(), broadcast=True)
        emit('pot_distributed', {'username': username, 'amount': amount}, broadcast=True)
    else:
        emit('error', {'message': f'Failed to distribute pot to {username}'})

@socketio.on('end_game')
def on_end_game():
    if 'user_id' not in session:
        emit('error', {'message': 'Not authenticated'})
        return
    
    game.initialize()  # Ensure game is initialized
    
    success = game.end_game()
    if success:
        emit('game_state_update', game.to_dict(), broadcast=True)
        emit('game_ended', {}, broadcast=True)
    else:
        emit('error', {'message': 'Failed to end game'})

@socketio.on('reorder_players')
def on_reorder_players(data):
    if 'user_id' not in session:
        emit('error', {'message': 'Not authenticated'})
        return
    
    player_order = data.get('player_order', [])
    
    game.initialize()  # Ensure game is initialized
    
    if not player_order or set(player_order) != set(game.player_order):
        emit('error', {'message': 'Invalid player order'})
        return
    
    success = game.reorder_players(player_order)
    if success:
        emit('game_state_update', game.to_dict(), broadcast=True)
    else:
        emit('error', {'message': 'Failed to reorder players'})

@socketio.on('adjust_chips')
def on_adjust_chips(data):
    if 'user_id' not in session:
        emit('error', {'message': 'Not authenticated'})
        return
    
    username = data.get('username')
    amount = data.get('amount')
    
    if not username:
        emit('error', {'message': 'No player selected'})
        return
    
    game.initialize()  # Ensure game is initialized
    
    if username not in game.players:
        emit('error', {'message': f'Player {username} not in game'})
        return
    
    if amount is None:
        emit('error', {'message': 'Invalid amount'})
        return
    
    player = game.players[username]
    player.adjust_chips(amount)
    
    # Update player in database
    with app.app_context():
        player_model = PlayerModel.query.filter_by(username=username).first()
        if player_model:
            player_model.chips = player.chips
            player_model.total_won = player.total_won
            player_model.total_lost = player.total_lost
            db.session.commit()
    
    emit('player_updated', player.to_dict(), broadcast=True)
    emit('game_state_update', game.to_dict(), broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5001)