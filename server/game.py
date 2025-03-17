from datetime import datetime

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
    
    def add_player(self, player):
        """Add a player to the game"""
        if player.username not in self.players:
            self.players[player.username] = player
            self.player_order.append(player.username)
            player.position = len(self.player_order) - 1
            player.is_active = True
            self.add_to_log({
                'type': 'system',
                'message': f'Player {player.username} joined the game'
            })
            return True
        return False
    
    def remove_player(self, username):
        """Remove a player from the game"""
        if username in self.players:
            player = self.players[username]
            self.player_order.remove(username)
            del self.players[username]
            self.add_to_log({
                'type': 'system',
                'message': f'Player {username} left the game'
            })
            # Update positions for remaining players
            self._update_positions()
            return True
        return False
    
    def _update_positions(self):
        """Update position values for all players"""
        for i, username in enumerate(self.player_order):
            if username in self.players:
                self.players[username].position = i
    
    def reorder_players(self, new_order):
        """Reorder players based on the new order list"""
        if set(new_order) != set(self.player_order):
            return False  # New order must contain the same players
        
        self.player_order = new_order.copy()
        self._update_positions()
        return True
    
    def start_game(self, small_blind=5, big_blind=10):
        """Start a new game"""
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
            
            return True
        
        return False
    
    def fold_player(self, username):
        """Fold a player's hand"""
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
            
            return True
        
        return False
    
    def unfold_player(self, username):
        """Unfold a player (for the next hand)"""
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
            
            return True
        
        return False
    
    def next_round(self):
        """Move to the next round"""
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
            
            return True
        
        return False
    
    def distribute_pot(self, username, amount):
        """Distribute pot to a player"""
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
            
            return True
        
        return False
    
    def end_game(self):
        """End the current game"""
        if not self.active:
            return False
        
        self.active = False
        
        self.add_to_log({
            'type': 'gameEnd',
            'message': f'Game ended with pot: ${self.pot}'
        })
        
        # Advance dealer position for next game
        self.dealer_position = (self.dealer_position + 1) % len(self.player_order)
        
        return True
    
    def add_to_log(self, entry):
        """Add an entry to the game log"""
        log_entry = {
            **entry,
            'timestamp': datetime.now().isoformat()
        }
        self.game_log.append(log_entry)
    
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