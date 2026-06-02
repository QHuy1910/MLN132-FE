import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from './api.js';
import { useGame } from './GameContext.jsx';
import { getSocket } from './socket.js';
import { SOCKET_EVENTS, PLAYER_ROLES } from './constants.js';
import { getCharacterIcon } from './characters.js';
import './WaitingRoom.css';

export default function WaitingRoom() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { currentRoom, setCurrentRoom, playerName, playerRole, playerCharacter, isHost } = useGame();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const joinedRoomKeyRef = useRef(null);
  const socket = getSocket();

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    // Fetch room details on mount
    const fetchRoom = async () => {
      try {
        const room = await api.getRoomById(roomId);
        setCurrentRoom(room);
      } catch (err) {
        setError('Không thể tải phòng');
        setTimeout(() => navigate('/'), 2000);
      }
    };

    fetchRoom();
  }, [roomId]);

  useEffect(() => {
    if (!socket || !roomId || !playerName || !currentRoom) return;

    const joinedKey = `${roomId}:${playerName}:${playerRole}`;
    if (joinedRoomKeyRef.current === joinedKey) return;

    if (playerRole === PLAYER_ROLES.SPECTATOR) {
      const spectator = currentRoom.spectators.find((s) => s.name === playerName);
      socket.emit(SOCKET_EVENTS.JOIN_AS_SPECTATOR, {
        roomId,
        name: playerName,
        spectatorId: spectator?.spectatorId
      });
    } else {
      const player = currentRoom.players.find((p) => p.name === playerName);
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
        roomId,
        name: playerName,
        playerId: player?.playerId,
        character: playerCharacter || player?.character
      });
    }

    joinedRoomKeyRef.current = joinedKey;
  }, [socket, roomId, playerName, playerRole, playerCharacter, currentRoom]);

  useEffect(() => {
    if (!roomId) return;

    if (currentRoom?.status === 'playing') {
      navigate(`/game/${roomId}`);
      return;
    }

    if (currentRoom?.status === 'finished') {
      navigate(`/ranking/${roomId}`);
    }
  }, [currentRoom?.status, roomId, navigate]);

  const handleSetReady = async (isReady) => {
    try {
      setLoading(true);
      await api.setPlayerReady(roomId, playerName, isReady);
      socket.emit(SOCKET_EVENTS.SET_READY, { 
        roomId, 
        name: playerName, 
        isReady 
      });
    } catch (err) {
      setError('Lỗi khi cập nhật trạng thái');
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!isHost) {
      setError('Chỉ chủ phòng mới có thể bắt đầu trò chơi');
      return;
    }

    try {
      setLoading(true);
      await api.startRoom(roomId);
      socket.emit(SOCKET_EVENTS.START_GAME, { roomId, name: playerName });
    } catch (err) {
      setError('Không thể bắt đầu trò chơi');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      setLoading(true);
      if (playerRole === PLAYER_ROLES.SPECTATOR) {
        await api.removeSpectator(roomId, playerName);
        socket.emit(SOCKET_EVENTS.LEAVE_AS_SPECTATOR, { roomId, name: playerName });
      } else {
        await api.leaveRoom(roomId, playerName);
        socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId, name: playerName });
      }
      navigate('/');
    } catch (err) {
      setError('Không thể rời phòng');
    } finally {
      setLoading(false);
    }
  };

  if (!currentRoom) {
    return <div className="waiting-room"><p>Đang tải...</p></div>;
  }

  const currentPlayer = currentRoom.players.find(p => p.name === playerName);
  const isReady = currentPlayer?.isReady || false;
  const allPlayersReady = currentRoom.players.length > 0 && currentRoom.players.every(p => p.isReady);
  const canStart = isHost && currentRoom.players.length >= 2 && allPlayersReady;

  return (
    <div className="waiting-room">
      <div className="waiting-room-container">
        <div className="room-header-section">
          <h1>{currentRoom.name}</h1>
          <p className="room-status">Chủ phòng: <strong>{currentRoom.host}</strong></p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="waiting-room-content">
          {/* Players Section */}
          <div className="players-section">
            <h2>👥 Người Chơi ({currentRoom.players.length}/{currentRoom.maxPlayers})</h2>
            <div className="players-list">
              {currentRoom.players.length === 0 ? (
                <p className="empty">Chưa có người chơi nào</p>
              ) : (
                currentRoom.players.map((player, idx) => (
                  <div key={`${player.playerId || player.name || 'player'}-${idx}`} className={`player-item ${player.isReady ? 'ready' : ''}`}>
                    <div className="player-info">
                      <span className="player-character">{player.character?.icon || '🎮'}</span>
                      <span className="player-name">{player.name}</span>
                      <span className="player-money">💰 {player.money}</span>
                    </div>
                    {player.isReady ? (
                      <span className="ready-status">✅ Sẵn sàng</span>
                    ) : (
                      <span className="not-ready-status">⏳ Chờ</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Spectators Section */}
          {currentRoom.spectators.length > 0 && (
            <div className="spectators-section">
              <h2>👁️ Khán Giả ({currentRoom.spectators.length})</h2>
              <div className="spectators-list">
                {currentRoom.spectators.map((spectator) => (
                  <div key={spectator.spectatorId} className="spectator-item">
                    <span className="spectator-name">{spectator.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="action-section">
          {playerRole === PLAYER_ROLES.PLAYER && (
            <button
              className={`btn btn-ready ${isReady ? 'active' : ''}`}
              onClick={() => handleSetReady(!isReady)}
              disabled={loading}
            >
              {isReady ? '❌ Hủy sẵn sàng' : '✅ Sẵn sàng'}
            </button>
          )}

          {isHost && (
            <button
              className="btn btn-start"
              onClick={handleStartGame}
              disabled={!canStart || loading}
              title={!canStart ? 'Chờ tất cả người chơi sẵn sàng' : ''}
            >
              {loading ? '⏳ Đang bắt đầu...' : '🎮 Bắt đầu trò chơi'}
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={handleLeaveRoom}
            disabled={loading}
          >
            🚪 Rời phòng
          </button>
        </div>

        {!canStart && isHost && (
          <div className="info-message">
            ℹ️ Chờ ít nhất 2 người chơi và tất cả đều sẵn sàng để bắt đầu
          </div>
        )}
      </div>
    </div>
  );
}
