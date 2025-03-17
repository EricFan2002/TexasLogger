document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded - initializing ui.js...');

    // Variables for table resizing and dragging
    let tableScale = 1;
    let tableIsDragging = false;
    let tableDragStartX = 0;
    let tableDragStartY = 0;
    let tablePositionX = 0;
    let tablePositionY = 0;
    let tableInitialized = false;

    // Store the real updateUI function so client.js can find it
    window.realUpdateUI = function () {
        updatePlayerList();
        updateStartGameButton();

        if (gameState.active) {
            updatePlayerPositions();
            updatePotDisplay();
            updateRoundIndicators();
            updateSelects();
            updateQuickBets();
            updateQuickWinnings();
            updateGameLog();

            // Add the standard bet options
            addStandardBetOptions();

            // Setup resizable table (only needs to run once)
            if (!tableInitialized) {
                setupResizableTable();
                tableInitialized = true;
            }
        }
    };

    // Replace the potential fallback with the real implementation
    window.updateUI = window.realUpdateUI;
    window.usingFallbackUI = false;

    // DOM elements
    const playerListEl = document.getElementById('player-list');
    const startGameBtn = document.getElementById('start-game-btn');
    const playerPositionsEl = document.getElementById('player-positions');
    const potAmountEl = document.getElementById('pot-amount');
    const currentRoundEl = document.getElementById('current-round');
    const betPlayerSelectEl = document.getElementById('bet-player-select');
    const betAmountInput = document.getElementById('bet-amount');
    const placeBetBtn = document.getElementById('place-bet-btn');
    const foldBtn = document.getElementById('fold-btn');
    const quickBetButtonsEl = document.getElementById('quick-bet-buttons');
    const winnerSelectEl = document.getElementById('winner-select');
    const winAmountInput = document.getElementById('win-amount');
    const payWinningsBtn = document.getElementById('pay-winnings-btn');
    const quickWinButtonsEl = document.getElementById('quick-win-buttons');
    const nextRoundBtn = document.getElementById('next-round-btn');
    const endGameBtn = document.getElementById('end-game-btn');
    const gameLogEl = document.getElementById('game-log');
    const roundDots = document.querySelectorAll('.round-dots .dot');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.querySelector('.close');
    const themeButtons = document.querySelectorAll('.theme-btn');
    const addChipsBtn = document.getElementById('add-chips-btn');
    const removeChipsBtn = document.getElementById('remove-chips-btn');
    const addChipsAmountInput = document.getElementById('add-chips-amount');

    // Initialize event listeners
    startGameBtn.addEventListener('click', startGame);
    placeBetBtn.addEventListener('click', placeBet);
    foldBtn.addEventListener('click', foldPlayer);
    nextRoundBtn.addEventListener('click', nextRound);
    payWinningsBtn.addEventListener('click', payWinnings);
    endGameBtn.addEventListener('click', endGame);

    // Add event listener for player selection which should update quick bets
    betPlayerSelectEl.addEventListener('change', () => {
        updateQuickBets();
    });

    // Add event listener for any change in bet amount input to update quick bets also
    betAmountInput.addEventListener('focus', () => {
        updateQuickBets();
    });

    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'block';
    });

    closeModalBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            themeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            theme = btn.getAttribute('data-theme');
            applyTheme(theme);
        });
    });

    addChipsBtn.addEventListener('click', () => {
        if (!selectedPlayerId) {
            alert('Please select a player first');
            return;
        }
        const amount = parseInt(addChipsAmountInput.value);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        adjustPlayerChips(selectedPlayerId, amount);
        addChipsAmountInput.value = '';
    });

    removeChipsBtn.addEventListener('click', () => {
        if (!selectedPlayerId) {
            alert('Please select a player first');
            return;
        }
        const amount = parseInt(addChipsAmountInput.value);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        adjustPlayerChips(selectedPlayerId, -amount);
        addChipsAmountInput.value = '';
    });

    // Main UI update function
    window.updateUI = function () {
        updatePlayerList();
        updateStartGameButton();

        if (gameState.active) {
            updatePlayerPositions();
            updatePotDisplay();
            updateRoundIndicators();
            updateSelects();
            // Ensure quick bets get updated whenever the UI updates
            updateQuickBets();
            updateQuickWinnings();
            updateGameLog();

            // Add the standard bet options
            addStandardBetOptions();

            // Setup resizable table (only needs to run once)
            if (!tableInitialized) {
                setupResizableTable();
                tableInitialized = true;
            }
        }
    };

    // Function to add standard bet options (separate from updateQuickBets to ensure they're always shown)
    function addStandardBetOptions() {
        // First clear any existing buttons
        if (!quickBetButtonsEl.querySelector('.standard-bets')) {
            const standardBetsContainer = document.createElement('div');
            standardBetsContainer.className = 'standard-bets';

            // Fixed bet values
            const standardBets = [
                { amount: 5, label: 'SB' },
                { amount: 10, label: 'BB' },
                { amount: 25, label: '' },
                { amount: 50, label: '' },
                { amount: 100, label: '' }
            ];

            standardBets.forEach(bet => {
                const btn = document.createElement('button');
                btn.className = 'quick-bet-btn';
                btn.textContent = `$${bet.amount}${bet.label ? ` (${bet.label})` : ''}`;

                btn.addEventListener('click', () => {
                    betAmountInput.value = bet.amount;
                });

                standardBetsContainer.appendChild(btn);
            });

            quickBetButtonsEl.appendChild(standardBetsContainer);
        }
    }

    // Function to set up resizable and draggable table
    function setupResizableTable() {
        const pokerTableContainer = document.querySelector('.poker-table-container');
        const pokerTable = document.querySelector('.poker-table');
        const resetTableBtn = document.createElement('button');
        const zoomControls = document.createElement('div');

        // Create zoom controls
        zoomControls.className = 'zoom-controls';
        zoomControls.innerHTML = `
            <button class="zoom-btn zoom-in" title="Zoom In">+</button>
            <button class="zoom-btn zoom-out" title="Zoom Out">-</button>
        `;
        pokerTableContainer.appendChild(zoomControls);

        // Create reset button
        resetTableBtn.className = 'reset-table-btn';
        resetTableBtn.textContent = 'Reset Table';
        resetTableBtn.title = 'Reset table size and position';
        pokerTableContainer.appendChild(resetTableBtn);

        // Add zoom in functionality
        zoomControls.querySelector('.zoom-in').addEventListener('click', function (e) {
            e.stopPropagation();
            tableScale = Math.min(tableScale + 0.1, 1.5);
            applyTableTransform(pokerTable);
            updatePlayerPositions(); // Recalculate player positions
        });

        // Add zoom out functionality
        zoomControls.querySelector('.zoom-out').addEventListener('click', function (e) {
            e.stopPropagation();
            tableScale = Math.max(tableScale - 0.1, 0.5);
            applyTableTransform(pokerTable);
            updatePlayerPositions(); // Recalculate player positions
        });

        // Add reset functionality
        resetTableBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            tableScale = 1;
            tablePositionX = 0;
            tablePositionY = 0;
            applyTableTransform(pokerTable);
            updatePlayerPositions(); // Recalculate player positions
        });

        // Make table draggable
        pokerTable.addEventListener('mousedown', function (e) {
            if (e.target === pokerTable || e.target.classList.contains('table-center')) {
                tableIsDragging = true;
                tableDragStartX = e.clientX - tablePositionX;
                tableDragStartY = e.clientY - tablePositionY;
                pokerTable.classList.add('dragging');
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', function (e) {
            if (tableIsDragging) {
                tablePositionX = e.clientX - tableDragStartX;
                tablePositionY = e.clientY - tableDragStartY;
                applyTableTransform(pokerTable);
            }
        });

        document.addEventListener('mouseup', function () {
            if (tableIsDragging) {
                tableIsDragging = false;
                pokerTable.classList.remove('dragging');
                updatePlayerPositions(); // Recalculate player positions when drag ends
            }
        });

        // Handle touch events for mobile
        pokerTable.addEventListener('touchstart', function (e) {
            if (e.target === pokerTable || e.target.classList.contains('table-center')) {
                tableIsDragging = true;
                const touch = e.touches[0];
                tableDragStartX = touch.clientX - tablePositionX;
                tableDragStartY = touch.clientY - tablePositionY;
                pokerTable.classList.add('dragging');
                e.preventDefault();
            }
        }, { passive: false });

        document.addEventListener('touchmove', function (e) {
            if (tableIsDragging) {
                const touch = e.touches[0];
                tablePositionX = touch.clientX - tableDragStartX;
                tablePositionY = touch.clientY - tableDragStartY;
                applyTableTransform(pokerTable);
                e.preventDefault();
            }
        }, { passive: false });

        document.addEventListener('touchend', function () {
            if (tableIsDragging) {
                tableIsDragging = false;
                pokerTable.classList.remove('dragging');
                updatePlayerPositions(); // Recalculate player positions when drag ends
            }
        });
    }

    // Helper function to apply transform to the table
    function applyTableTransform(pokerTable) {
        pokerTable.style.transform = `translate(${tablePositionX}px, ${tablePositionY}px) scale(${tableScale})`;
    }

    // Update functions for different UI elements
    function updatePlayerList() {
        playerListEl.innerHTML = '';

        if (gameState.players.length === 0) {
            playerListEl.innerHTML = '<div class="text-center py-4 text-muted">No players in the game yet.</div>';
            return;
        }

        gameState.players.forEach((player, index) => {
            const playerEl = document.createElement('div');
            playerEl.className = `player-item ${selectedPlayerId === player.username ? 'selected' : ''}`;
            playerEl.setAttribute('data-username', player.username);

            playerEl.innerHTML = `
                <div class="player-info">
                    <div class="player-details">
                        <h3>${player.username}${player.username === currentUser ? ' (You)' : ''}</h3>
                        <p class="player-chips">$${player.chips}</p>
                    </div>
                </div>
                <div class="player-actions">
                    <button class="action-btn add-btn" data-username="${player.username}" title="Add chips">+$</button>
                    <button class="action-btn remove-btn" data-username="${player.username}" title="Remove chips">-$</button>
                    <button class="action-btn delete-btn" data-username="${player.username}" title="Remove player">×</button>
                    ${index > 0 ? `<button class="action-btn move-up-btn" data-username="${player.username}" title="Move up">↑</button>` : ''}
                    ${index < gameState.players.length - 1 ? `<button class="action-btn move-down-btn" data-username="${player.username}" title="Move down">↓</button>` : ''}
                </div>
            `;

            playerEl.addEventListener('click', () => {
                selectedPlayerId = player.username;
                updateUI();
            });

            playerListEl.appendChild(playerEl);
        });

        // Add event listeners for player action buttons
        document.querySelectorAll('.player-actions .add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = btn.getAttribute('data-username');
                const amount = prompt('Enter amount to add:');
                if (amount && !isNaN(amount)) {
                    adjustPlayerChips(username, parseInt(amount));
                }
            });
        });

        document.querySelectorAll('.player-actions .remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = btn.getAttribute('data-username');
                const amount = prompt('Enter amount to remove:');
                if (amount && !isNaN(amount)) {
                    adjustPlayerChips(username, -parseInt(amount));
                }
            });
        });

        document.querySelectorAll('.player-actions .delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = btn.getAttribute('data-username');
                if (confirm(`Are you sure you want to remove ${username} from the game?`)) {
                    removePlayer(username);
                }
            });
        });

        document.querySelectorAll('.player-actions .move-up-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = btn.getAttribute('data-username');
                movePlayerUp(username);
            });
        });

        document.querySelectorAll('.player-actions .move-down-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = btn.getAttribute('data-username');
                movePlayerDown(username);
            });
        });
    }

    function updateStartGameButton() {
        startGameBtn.disabled = gameState.players.length < 2;
    }

    function updatePlayerPositions() {
        playerPositionsEl.innerHTML = '';

        // Get the poker table element
        const pokerTable = document.querySelector('.poker-table');
        const tableRect = pokerTable.getBoundingClientRect();
        const containerRect = playerPositionsEl.getBoundingClientRect();

        // Calculate the table center point accounting for transform
        const tableCenterX = (tableRect.left + tableRect.right) / 2;
        const tableCenterY = (tableRect.top + tableRect.bottom) / 2;

        // Adjust table radius based on current scale and size
        const tableRadius = (Math.min(tableRect.width, tableRect.height) / 2) * 0.95;
        const playerCount = gameState.players.length;

        // Calculate better player positioning with specific offsets based on position
        gameState.players.forEach((player, index) => {
            // Calculate position around the circle
            // Start at the top (270 degrees) and go clockwise
            const angle = ((index / playerCount) * 2 * Math.PI) + (Math.PI * 1.5);

            // Use different radius multipliers based on position
            let radiusMultiplier = 1.0;

            // Adjust position based on index to fit better when there are many players
            if (playerCount > 6) {
                // Top players (get pushed up slightly)
                if (index === 0 || index === playerCount - 1 || index === 1 || index === playerCount - 2) {
                    radiusMultiplier = 0.95;
                }
                // Bottom players (get pushed down slightly)
                else if (index === Math.floor(playerCount / 2) ||
                    index === Math.floor(playerCount / 2) - 1 ||
                    index === Math.floor(playerCount / 2) + 1) {
                    radiusMultiplier = 1.05;
                }
            }

            // Calculate absolute coordinates
            const playerX = tableCenterX + Math.cos(angle) * tableRadius * radiusMultiplier * tableScale;
            const playerY = tableCenterY + Math.sin(angle) * tableRadius * radiusMultiplier * tableScale;

            // Convert to percentage within the container
            const left = ((playerX - containerRect.left) / containerRect.width) * 100;
            const top = ((playerY - containerRect.top) / containerRect.height) * 100;

            const positionEl = document.createElement('div');
            positionEl.className = 'player-position';
            positionEl.style.left = `${left}%`;
            positionEl.style.top = `${top}%`;
            positionEl.setAttribute('data-username', player.username);

            // Calculate dealer, small blind and big blind positions
            const isDealer = index === gameState.dealer_position;
            const isSmallBlind = index === (gameState.dealer_position + 1) % playerCount;
            const isBigBlind = index === (gameState.dealer_position + 2) % playerCount;

            let blindClass = '';
            let blindIndicator = '';

            // Create custom indicators with usernames
            if (isDealer) {
                blindClass = 'dealer';
                blindIndicator = `<div class="position-indicator dealer-indicator" title="${player.username} - Dealer">D<span class="indicator-username">${player.username}</span></div>`;
            }
            else if (isSmallBlind) {
                blindClass = 'small-blind';
                blindIndicator = `<div class="position-indicator sb-indicator" title="${player.username} - Small Blind">SB<span class="indicator-username">${player.username}</span></div>`;
            }
            else if (isBigBlind) {
                blindClass = 'big-blind';
                blindIndicator = `<div class="position-indicator bb-indicator" title="${player.username} - Big Blind">BB<span class="indicator-username">${player.username}</span></div>`;
            }

            // Create a more compact player card
            positionEl.innerHTML = `
            <div class="player-card ${player.folded ? 'folded' : ''} ${player.username === currentUser ? 'active' : ''} ${blindClass}">
                <div class="player-stats">
                    <div class="player-name-line">${player.username}${player.username === currentUser ? ' (You)' : ''}: <span class="player-chips">$${player.chips}</span></div>
                    <div class="player-bet-line"><span class="current-bet">$${player.current_bet}</span> | <span class="total-bet">$${player.total_bet}</span></div>
                </div>
                <div class="player-actions">
                    <button class="action-btn ${player.folded ? 'add-btn' : 'remove-btn'}" data-action="fold" data-username="${player.username}" title="${player.folded ? 'Unfold' : 'Fold'} - ${player.username}">
                        ${player.folded ? '↩️' : '↪️'}
                    </button>
                    <button class="action-btn add-btn" data-action="bet" data-username="${player.username}" ${player.folded ? 'disabled' : ''} title="Bet - ${player.username}">
                        💰
                    </button>
                </div>
            </div>
            ${player.current_bet > 0 ? `<div class="player-bet">$${player.current_bet}</div>` : ''}
            ${blindIndicator}
        `;

            playerPositionsEl.appendChild(positionEl);
        });

        // Add event listeners for player actions
        document.querySelectorAll('[data-action="fold"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = btn.getAttribute('data-username');
                socket.emit('fold', { username: username });
            });
        });

        document.querySelectorAll('[data-action="bet"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = btn.getAttribute('data-username');
                selectedPlayerId = username;
                betPlayerSelectEl.value = username;
                betAmountInput.focus();
                updateUI();
            });
        });

        // Make player positions draggable
        setupPlayerDragAndDrop();
    }

    function updatePotDisplay() {
        potAmountEl.textContent = `$${gameState.pot}`;
    }

    function updateRoundIndicators() {
        currentRoundEl.textContent = gameState.round_name;

        const rounds = ['preflop', 'flop', 'turn', 'river'];
        const currentIndex = rounds.indexOf(gameState.current_round);

        roundDots.forEach((dot, index) => {
            if (index <= currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    function updateSelects() {
        // Update bet player select
        betPlayerSelectEl.innerHTML = '<option value="">Select Player</option>';

        const activePlayers = gameState.players.filter(p => !p.folded);
        activePlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player.username;
            option.textContent = `${player.username} ($${player.chips})`;

            if (player.username === selectedPlayerId) {
                option.selected = true;
            }

            betPlayerSelectEl.appendChild(option);
        });

        // Update winner select
        winnerSelectEl.innerHTML = '<option value="">Select Player</option>';

        gameState.players.forEach(player => {
            const option = document.createElement('option');
            option.value = player.username;
            option.textContent = `${player.username} ($${player.chips})`;

            if (player.username === selectedPlayerId) {
                option.selected = true;
            }

            winnerSelectEl.appendChild(option);
        });
    }

    function updateQuickBets() {
        // Clear any existing dynamic quick bets (but leave standard bets)
        let dynamicBetsContainer = quickBetButtonsEl.querySelector('.dynamic-bets');
        if (dynamicBetsContainer) {
            dynamicBetsContainer.remove();
        }

        const selectedUsername = betPlayerSelectEl.value;
        if (!selectedUsername) return;

        const player = gameState.players.find(p => p.username === selectedUsername);
        if (!player) return;

        // Create container for dynamic bets
        dynamicBetsContainer = document.createElement('div');
        dynamicBetsContainer.className = 'dynamic-bets';

        // Generate pot-based quick bet amounts
        const potBets = [];

        // Add pot-based bets
        if (gameState.pot > 0) {
            // 1/4 pot
            const quarterPot = Math.floor(gameState.pot / 4);
            if (quarterPot <= player.chips && quarterPot > 0) {
                potBets.push({ amount: quarterPot, label: '¼ Pot' });
            }

            // 1/3 pot
            const thirdPot = Math.floor(gameState.pot / 3);
            if (thirdPot <= player.chips && thirdPot > 0 && thirdPot !== quarterPot) {
                potBets.push({ amount: thirdPot, label: '⅓ Pot' });
            }

            // 1/2 pot
            const halfPot = Math.floor(gameState.pot / 2);
            if (halfPot <= player.chips && halfPot > 0 && halfPot !== thirdPot) {
                potBets.push({ amount: halfPot, label: '½ Pot' });
            }

            // Full pot
            if (gameState.pot <= player.chips) {
                potBets.push({ amount: gameState.pot, label: 'Pot' });
            }

            // 2x pot
            const doublePot = gameState.pot * 2;
            if (doublePot <= player.chips) {
                potBets.push({ amount: doublePot, label: '2× Pot' });
            }

            // Create buttons for pot-based bets
            potBets.forEach(bet => {
                const btn = document.createElement('button');
                btn.className = 'quick-bet-btn';
                btn.textContent = `$${bet.amount}${bet.label ? ` (${bet.label})` : ''}`;

                btn.addEventListener('click', () => {
                    betAmountInput.value = bet.amount;
                });

                dynamicBetsContainer.appendChild(btn);
            });

            quickBetButtonsEl.appendChild(dynamicBetsContainer);
        }
    }

    function updateQuickWinnings() {
        quickWinButtonsEl.innerHTML = '';

        if (gameState.pot <= 0) return;

        // Generate quick win amounts
        const quickWins = [];

        // Add pot-based payouts
        quickWins.push({ amount: gameState.pot, label: 'All' });

        // 3/4 pot
        const threeQuarterPot = Math.floor(gameState.pot * 0.75);
        if (threeQuarterPot > 0 && threeQuarterPot !== gameState.pot) {
            quickWins.push({ amount: threeQuarterPot, label: '¾ Pot' });
        }

        // 1/2 pot
        const halfPot = Math.floor(gameState.pot / 2);
        if (halfPot > 0 && halfPot !== threeQuarterPot) {
            quickWins.push({ amount: halfPot, label: '½ Pot' });
        }

        // 1/4 pot
        const quarterPot = Math.floor(gameState.pot / 4);
        if (quarterPot > 0 && quarterPot !== halfPot) {
            quickWins.push({ amount: quarterPot, label: '¼ Pot' });
        }

        // Create buttons
        quickWins.forEach(win => {
            const btn = document.createElement('button');
            btn.className = 'quick-bet-btn';
            btn.textContent = `$${win.amount}${win.label ? ` (${win.label})` : ''}`;

            btn.addEventListener('click', () => {
                winAmountInput.value = win.amount;
            });

            quickWinButtonsEl.appendChild(btn);
        });
    }

    function updateGameLog() {
        gameLogEl.innerHTML = '';

        if (gameState.game_log.length === 0) {
            gameLogEl.innerHTML = '<div class="text-center py-4 text-muted">No actions yet. Game log will appear here.</div>';
            return;
        }

        gameState.game_log.forEach(entry => {
            const logEntryEl = document.createElement('div');
            logEntryEl.className = 'log-entry';

            // Add different styling based on entry type
            if (entry.type === 'bet') {
                logEntryEl.style.color = '#3b82f6'; // Blue for bets
            } else if (entry.type === 'distribution') {
                logEntryEl.style.color = '#10b981'; // Green for winnings
            } else if (entry.type === 'fold') {
                logEntryEl.style.color = '#ef4444'; // Red for fold
            }

            const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            logEntryEl.textContent = `[${time}] ${entry.message}`;

            gameLogEl.appendChild(logEntryEl);
        });

        // Scroll to bottom
        gameLogEl.scrollTop = gameLogEl.scrollHeight;
    }

    // Theme management
    function applyTheme(themeName) {
        document.body.className = `theme-${themeName}`;
    }

    // Initialize with default theme
    applyTheme(theme);

    // Drag and drop for player list reordering
    function setupDragAndDrop() {
        const draggables = document.querySelectorAll('.player-item');
        let draggedItem = null;

        draggables.forEach(item => {
            // Drag start
            item.addEventListener('dragstart', function () {
                draggedItem = this;
                setTimeout(() => {
                    this.classList.add('dragging');
                }, 0);
            });

            // Drag end
            item.addEventListener('dragend', function () {
                this.classList.remove('dragging');
                draggedItem = null;
            });

            // Drag over - prevent default to allow drop
            item.addEventListener('dragover', function (e) {
                e.preventDefault();
            });

            // Drop event
            item.addEventListener('drop', function (e) {
                e.preventDefault();

                if (draggedItem) {
                    // Get position data
                    const draggedUsername = draggedItem.getAttribute('data-username');
                    const targetUsername = this.getAttribute('data-username');

                    if (draggedUsername !== targetUsername) {
                        // Create a new player order array
                        const newOrder = [...gameState.player_order];
                        const draggedIndex = newOrder.indexOf(draggedUsername);
                        const targetIndex = newOrder.indexOf(targetUsername);

                        // Remove dragged item and insert at new position
                        newOrder.splice(draggedIndex, 1);
                        newOrder.splice(targetIndex, 0, draggedUsername);

                        // Send reorder event to server
                        reorderPlayers(newOrder);
                    }
                }
            });
        });
    }

    // Drag and drop for player positions on the table
    function setupPlayerDragAndDrop() {
        const positions = document.querySelectorAll('.player-position');
        let draggedPosition = null;

        positions.forEach(position => {
            position.setAttribute('draggable', 'true');

            // Drag start
            position.addEventListener('dragstart', function (e) {
                draggedPosition = this;
                setTimeout(() => {
                    this.querySelector('.player-card').classList.add('dragging');
                }, 0);
            });

            // Drag end
            position.addEventListener('dragend', function () {
                this.querySelector('.player-card').classList.remove('dragging');
                draggedPosition = null;
            });

            // Drag over - prevent default to allow drop
            position.addEventListener('dragover', function (e) {
                e.preventDefault();
            });

            // Drop event
            position.addEventListener('drop', function (e) {
                e.preventDefault();

                if (draggedPosition) {
                    // Get position data
                    const draggedUsername = draggedPosition.getAttribute('data-username');
                    const targetUsername = this.getAttribute('data-username');

                    if (draggedUsername !== targetUsername) {
                        // Create a new player order array
                        const newOrder = [...gameState.player_order];
                        const draggedIndex = newOrder.indexOf(draggedUsername);
                        const targetIndex = newOrder.indexOf(targetUsername);

                        // Remove dragged item and insert at new position
                        newOrder.splice(draggedIndex, 1);
                        newOrder.splice(targetIndex, 0, draggedUsername);

                        // Send reorder event to server
                        reorderPlayers(newOrder);
                    }
                }
            });
        });
    }

    // Ensure standard bet options are added on initial load
    addStandardBetOptions();
});