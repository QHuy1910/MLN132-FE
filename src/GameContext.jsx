import React, { createContext, useContext, useState, useCallback } from 'react';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  // Room meta
  const [roomName, setRoomName] = useState('');

  // Entire game state managed locally (no socket/server)
  const [gameState, setGameState] = useState(null);

  // Shown question (public, no correctAnswer)
  const [shownQuestion, setShownQuestion] = useState(null);

  // Start a new local game
  const startLocalGame = useCallback((name, initialGameState) => {
    setRoomName(name);
    setGameState(initialGameState);
    setShownQuestion(null);
  }, []);

  // Reset everything (back to setup)
  const resetGame = useCallback(() => {
    setRoomName('');
    setGameState(null);
    setShownQuestion(null);
  }, []);

  const value = {
    roomName,
    gameState,
    setGameState,
    shownQuestion,
    setShownQuestion,
    startLocalGame,
    resetGame,

    // Convenience helpers
    currentPlayer: gameState?.players?.[gameState?.currentTurnIndex] ?? null,
    currentPlayerIndex: gameState?.currentTurnIndex ?? 0,
    players: gameState?.players ?? [],
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
