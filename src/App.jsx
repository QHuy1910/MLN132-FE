import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './GameContext.jsx';
import SetupRoom from './SetupRoom.jsx';
import GameBoard from './GameBoard.jsx';
import Ranking from './Ranking.jsx';
import './App.css';

export default function App() {
  return (
    <GameProvider>
      <Router>
        <Routes>
          <Route path="/" element={<SetupRoom />} />
          <Route path="/home" element={<SetupRoom />} />
          <Route path="/game" element={<GameBoard />} />
          <Route path="/ranking" element={<Ranking />} />
          {/* Legacy routes - redirect */}
          <Route path="/waiting-room/:roomId" element={<Navigate to="/" replace />} />
          <Route path="/game/:roomId" element={<GameBoard />} />
          <Route path="/ranking/:roomId" element={<Ranking />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </GameProvider>
  );
}
