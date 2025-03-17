// Socket.IO client-side connection and event handling
let socket;
let gameState = {
    players: [],
    player_order: [],
    active: false,
    pot: 0,
    game_log: [],
    current_round: 'preflop',
    round_name: 'Pre-Flop',
    small_blind: 5,
    big_blind: 10,
    dealer_position: 0
};

let currentUser = null;
let selectedPlayerId = null;
let theme = 'casino';

// Define a fallback updateUI function in case ui.js hasn't loaded yet
// This prevents "updateUI is not defined" errors
if (typeof window.updateUI !== 'function') {
    window.updateUI = function () {
        console.warn('Real updateUI function not loaded yet. UI will be updated when available.');
        // Queue this update to retry once the document is fully loaded
        if (document.readyState === 'complete') {
            setTimeout(() => {
                if (typeof window.realUpdateUI === 'function') {
                    window.realUpdateUI();
                }
            }, 100);
        }
    };

    // We'll use this to check if our fallback is being used
    window.usingFallbackUI = true;
}

// Socket connection and event setup
function setupSocket() {
    // Connect to Socket.IO server
    socket = io();

    // Socket event listeners
    socket.on('connect', () => {
        console.log('Connected to server');

        // Request current username from session
        currentUser = document.getElementById('current-user')?.querySelector('strong')?.textContent;
        console.log('Current user:', currentUser);

        // Join the game
        socket.emit('join_game');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    socket.on('game_state_update', (data) => {
        console.log('Game state update:', data);
        gameState = data;

        // Safe call to updateUI
        if (typeof window.updateUI === 'function') {
            try {
                window.updateUI();
            } catch (error) {
                console.error('Error in updateUI:', error);
            }
        }
    });

    socket.on('player_joined', (data) => {
        console.log('Player joined:', data);
        // Update will happen through game_state_update
    });

    socket.on('player_left', (data) => {
        console.log('Player left:', data);
        // Update will happen through game_state_update
    });

    socket.on('player_removed', (data) => {
        console.log('Player removed:', data);
        // Update will happen through game_state_update
    });

    socket.on('game_started', () => {
        console.log('Game started');

        // Switch to game screen - with safe DOM access
        const playerManagement = document.getElementById('player-management');
        const gameScreen = document.getElementById('game-screen');

        if (playerManagement && gameScreen) {
            playerManagement.classList.remove('active');
            gameScreen.classList.add('active');
        }
    });

    socket.on('bet_placed', (data) => {
        console.log('Bet placed:', data);
    });

    socket.on('player_folded', (data) => {
        console.log('Player folded:', data);
    });

    socket.on('round_changed', (data) => {
        console.log('Round changed:', data);
    });

    socket.on('pot_distributed', (data) => {
        console.log('Pot distributed:', data);
    });

    socket.on('game_ended', () => {
        console.log('Game ended');

        // Switch back to player management screen - with safe DOM access
        const playerManagement = document.getElementById('player-management');
        const gameScreen = document.getElementById('game-screen');

        if (playerManagement && gameScreen) {
            gameScreen.classList.remove('active');
            playerManagement.classList.add('active');
        }
    });

    socket.on('player_updated', (data) => {
        console.log('Player updated:', data);
        // Individual player update will be reflected in game state update
    });

    // Error handling
    socket.on('error', (data) => {
        console.error('Server error:', data.message);
        showError(data.message);
    });
}

// Error display function
function showError(message) {
    // Create error notification
    const errorNotification = document.createElement('div');
    errorNotification.className = 'error-notification';
    errorNotification.textContent = message;

    // Add to DOM
    document.body.appendChild(errorNotification);

    // Fade in
    setTimeout(() => {
        errorNotification.classList.add('show');
    }, 10);

    // Remove after 5 seconds
    setTimeout(() => {
        errorNotification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(errorNotification);
        }, 300);
    }, 5000);
}

// Socket action functions
function startGame() {
    if (gameState.players.length < 2) {
        showError('Need at least 2 players to start a game');
        return;
    }

    const smallBlindInput = document.getElementById('small-blind');
    const bigBlindInput = document.getElementById('big-blind');

    const smallBlind = smallBlindInput ? (parseInt(smallBlindInput.value) || 5) : 5;
    const bigBlind = bigBlindInput ? (parseInt(bigBlindInput.value) || 10) : 10;

    socket.emit('start_game', {
        small_blind: smallBlind,
        big_blind: bigBlind
    });
}

function placeBet() {
    const betPlayerSelect = document.getElementById('bet-player-select');
    const betAmountInput = document.getElementById('bet-amount');

    if (!betPlayerSelect || !betAmountInput) {
        showError('UI elements not found');
        return;
    }

    const username = betPlayerSelect.value;
    if (!username) {
        showError('Please select a player');
        return;
    }

    const amount = parseInt(betAmountInput.value);
    if (isNaN(amount) || amount <= 0) {
        showError('Please enter a valid bet amount');
        return;
    }

    socket.emit('place_bet', {
        username: username,
        amount: amount
    });

    betAmountInput.value = '';
}

function foldPlayer() {
    const betPlayerSelect = document.getElementById('bet-player-select');

    if (!betPlayerSelect) {
        showError('Player selection not found');
        return;
    }

    const username = betPlayerSelect.value;
    if (!username) {
        showError('Please select a player');
        return;
    }

    socket.emit('fold', {
        username: username
    });
}

function nextRound() {
    socket.emit('next_round');
}

function payWinnings() {
    const winnerSelect = document.getElementById('winner-select');
    const winAmountInput = document.getElementById('win-amount');

    if (!winnerSelect || !winAmountInput) {
        showError('UI elements not found');
        return;
    }

    const username = winnerSelect.value;
    if (!username) {
        showError('Please select a player');
        return;
    }

    const amount = parseInt(winAmountInput.value);
    if (isNaN(amount) || amount <= 0) {
        showError('Please enter a valid amount');
        return;
    }

    socket.emit('distribute_pot', {
        username: username,
        amount: amount
    });

    winAmountInput.value = '';
}

function endGame() {
    if (!confirm('End this game and reset?')) return;
    socket.emit('end_game');
}

function adjustPlayerChips(username, amount) {
    if (!username || isNaN(amount)) {
        showError('Please select a player and enter a valid amount');
        return;
    }

    socket.emit('adjust_chips', {
        username: username,
        amount: amount
    });
}

function reorderPlayers(newOrder) {
    socket.emit('reorder_players', {
        player_order: newOrder
    });
}

// Player management functions
function removePlayer(username) {
    fetch(`/api/players/${username}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to remove player');
            }
            return response.json();
        })
        .then(data => {
            console.log('Player removed:', data);
        })
        .catch(error => {
            console.error('Error removing player:', error);
            showError('Error removing player. Please try again.');
        });
}

function movePlayerUp(username) {
    const playerIndex = gameState.player_order.indexOf(username);
    if (playerIndex <= 0) return;

    const newOrder = [...gameState.player_order];
    // Swap with previous player
    [newOrder[playerIndex], newOrder[playerIndex - 1]] = [newOrder[playerIndex - 1], newOrder[playerIndex]];

    reorderPlayers(newOrder);
}

function movePlayerDown(username) {
    const playerIndex = gameState.player_order.indexOf(username);
    if (playerIndex === -1 || playerIndex >= gameState.player_order.length - 1) return;

    const newOrder = [...gameState.player_order];
    // Swap with next player
    [newOrder[playerIndex], newOrder[playerIndex + 1]] = [newOrder[playerIndex + 1], newOrder[playerIndex]];

    reorderPlayers(newOrder);
}

// Add CSS for error notifications
function addErrorStyles() {
    if (document.getElementById('error-notification-styles')) return;

    const style = document.createElement('style');
    style.id = 'error-notification-styles';
    style.textContent = `
        .error-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #ef4444;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            max-width: 300px;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
        }
        
        .error-notification.show {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);
}

// Ensure proper initialization when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded - initializing client.js...');
    setupSocket();
    addErrorStyles();

    // Check if ui.js has loaded properly
    if (window.usingFallbackUI && typeof window.updateUI === 'function') {
        console.warn('Using fallback UI update function. Make sure ui.js is loaded properly.');

        // When ui.js loads and defines the real updateUI function, use it
        const checkInterval = setInterval(() => {
            if (typeof window.realUpdateUI === 'function') {
                window.updateUI = window.realUpdateUI;
                window.usingFallbackUI = false;
                console.log('Real updateUI function found and applied.');
                clearInterval(checkInterval);
            }
        }, 100);

        // Clear interval after 5 seconds to avoid infinite checking
        setTimeout(() => {
            clearInterval(checkInterval);
        }, 5000);
    }
});

// Finally, make all functions available to other scripts by adding them to the window object
window.startGame = startGame;
window.placeBet = placeBet;
window.foldPlayer = foldPlayer;
window.nextRound = nextRound;
window.payWinnings = payWinnings;
window.endGame = endGame;
window.adjustPlayerChips = adjustPlayerChips;
window.reorderPlayers = reorderPlayers;
window.removePlayer = removePlayer;
window.movePlayerUp = movePlayerUp;
window.movePlayerDown = movePlayerDown;