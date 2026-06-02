import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SOCKET_EVENTS } from './constants.js';

const GameContext = createContext();

export const GameProvider = ({ children, socket }) => {
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [playerRole, setPlayerRole] = useState('player');
  const [playerId, setPlayerId] = useState(null);
  const [playerCharacter, setPlayerCharacter] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [shownQuestion, setShownQuestion] = useState(null);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handlers = {
      [SOCKET_EVENTS.PLAYER_JOINED]: (data) => {
        setCurrentRoom(prev => prev ? { ...prev, players: data.players, spectators: data.spectators } : null);
      },
      [SOCKET_EVENTS.SPECTATOR_JOINED]: (data) => {
        setCurrentRoom(prev => prev ? { ...prev, spectators: data.spectators } : null);
      },
      [SOCKET_EVENTS.GAME_STARTED]: (data) => {
        setGameState(data);
        setCurrentRoom(prev => prev ? { ...prev, status: 'playing', players: data.players } : null);
      },
      [SOCKET_EVENTS.SHOW_QUESTION]: (data) => {
        setShownQuestion(data.question);
      },
      [SOCKET_EVENTS.DICE_ROLLED]: (data) => {
        setGameState(prev => prev ? { ...prev, lastDiceValue: data.diceValue } : null);
      },
      [SOCKET_EVENTS.PLAYER_MOVED]: (data) => {
        setCurrentRoom(prev => prev ? {
          ...prev,
          players: data.players,
          status: data.status || prev.status
        } : null);
        setGameState(prev => prev ? {
          ...prev,
          players: data.players,
          status: data.status || prev.status,
          winner: data.winner || prev.winner,
          boardSize: data.boardSize || prev.boardSize
        } : null);
      },
      [SOCKET_EVENTS.TURN_ENDED]: (data) => {
        setCurrentRoom(prev => prev ? {
          ...prev,
          players: data.players,
          status: data.status || prev.status
        } : null);
        setGameState(prev => prev ? { 
          ...prev, 
          currentTurnIndex: data.currentTurnIndex,
          currentPlayer: data.currentPlayer,
          players: data.players,
          hasRolledThisTurn: data.hasRolledThisTurn,
          status: data.status || prev.status,
          winner: data.winner || prev.winner
        } : null);
      },
      [SOCKET_EVENTS.PLAYER_LEFT]: (data) => {
        setCurrentRoom(prev => prev ? { ...prev, players: data.players, spectators: data.spectators } : null);
      },
      [SOCKET_EVENTS.SPECTATOR_LEFT]: (data) => {
        setCurrentRoom(prev => prev ? { ...prev, spectators: data.spectators } : null);
      },
      [SOCKET_EVENTS.PLAYER_READY_CHANGED]: (data) => {
        setCurrentRoom(prev => prev ? { ...prev, players: data.players } : null);
      },
      [SOCKET_EVENTS.GAME_STATE]: (data) => {
        setGameState(data);
      },
      [SOCKET_EVENTS.ERROR]: (data) => {
        setError(data.message);
      }
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event]) => {
        socket.off(event);
      });
    };
  }, [socket]);

  const clearError = useCallback(() => setError(null), []);

  const value = {
    // State
    rooms,
    currentRoom,
    playerName,
    playerRole,
    playerId,
    playerCharacter,
    isLoading,
    error,
    gameState,
    shownQuestion,
    
    // Setters
    setRooms,
    setCurrentRoom,
    setPlayerName,
    setPlayerRole,
    setPlayerId,
    setPlayerCharacter,
    setIsLoading,
    setError,
    setGameState,
    setShownQuestion,
    clearError,
    
    // Helpers
    isSpectator: playerRole === 'spectator',
    isHost: currentRoom?.host === playerName,
    currentPlayer: gameState?.currentPlayer,
    currentPlayerIndex: gameState?.currentTurnIndex
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};
