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