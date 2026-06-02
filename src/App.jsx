import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { initServerUrl } from './api.js';
import { initSocket } from './socket.js';
import { GameProvider } from './GameContext.jsx';
import HomePage from './HomePage.jsx';
import WaitingRoom from './WaitingRoom.jsx';
import GameBoard from './GameBoard.jsx';
import Ranking from './Ranking.jsx';
import './App.css';

function AppContent() {
  useEffect(() => {
    initServerUrl();
    const socket = initSocket();
    return () => {
      // Keep socket alive during component lifecycle
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/waiting-room/:roomId" element={<WaitingRoom />} />
        <Route path="/game/:roomId" element={<GameBoard />} />
        <Route path="/ranking/:roomId" element={<Ranking />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  const socket = initSocket();
  
  return (
    <GameProvider socket={socket}>
      <AppContent />
    </GameProvider>
  );
}
