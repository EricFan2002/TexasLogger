# Texas Poker Tracker

A web-based multiplayer poker tracking application designed to help manage and track Texas Hold'em games in real-time.

## Introduction

Texas Poker Tracker is a comprehensive solution for managing poker games with friends without the need for physical chips or complex setups. The application provides a digital poker table that tracks players, bets, blinds, and pots in real-time while providing a visual representation of the table state.

### Key Features

- **Real-time multiplayer**: Multiple players can join the game from their own devices
- **Interactive poker table**: Draggable and resizable table with player positions
- **Player management**: Add, remove, and adjust chips for players
- **Betting system**: Track bets, manage pot distributions, and automate blind positions
- **Round management**: Follow standard poker rounds (pre-flop, flop, turn, river)
- **Game log**: Keep track of all actions during the game
- **Responsive design**: Works on desktop and mobile devices
- **Theme customization**: Choose from multiple table themes

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/EricFan2002/TexasLogger.git
   cd texas-poker-tracker
   ```

2. Set up the database:
   ```bash
   flask db init
   flask db migrate
   flask db upgrade
   ```

3. Start the development server:
   ```bash
   flask run
   ```

4. Access the application:
   ```
   http://localhost:5001
   ```

## Usage

1. **Creating a game**:
   - Log in with your username
   - Add players to the game
   - Assign initial chips to each player
   - Set small and big blind values
   - Click "Start Game"

2. **During gameplay**:
   - Player positions will be displayed around the table
   - Use the controls to place bets, fold players, and distribute winnings
   - Track the pot amount and current round
   - Use quick bet buttons for common bet amounts
   - The game log tracks all actions

3. **Table controls**:
   - Drag the table to reposition
   - Use zoom controls to adjust the view
   - Reset button returns the table to its original position

4. **Ending a game**:
   - Click "End Game" to finish the current session
   - Player chip counts will be saved

## Customization

- **Themes**: Choose from Casino Royale, Vegas Night, Midnight Blue, or Crimson Felt
- **Blinds**: Adjust small blind and big blind values before starting the game
- **Player order**: Drag and drop to rearrange player positions

