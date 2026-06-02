import React, { useEffect, useState } from 'react';
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
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await initServerUrl();
      const nextSocket = initSocket();
      if (mounted) {
        setSocket(nextSocket);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  if (!socket) {
    return <div className="app-loading">Đang kết nối máy chủ...</div>;
  }
  
  return (
    <GameProvider socket={socket}>
      <AppContent />
    </GameProvider>
  );
}
