import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { useGame } from './GameContext.jsx';
import { PLAYER_ROLES, ROOM_STATUS } from './constants.js';
import CharacterSelection from './CharacterSelection.jsx';
import './HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { setRooms, setCurrentRoom, setPlayerName, setPlayerRole, setPlayerCharacter, rooms } = useGame();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCharacterSelection, setShowCharacterSelection] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [roleSelection, setRoleSelection] = useState(PLAYER_ROLES.PLAYER);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // 'create' or 'join'

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const data = await api.getRooms();
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim() || !playerNameInput.trim()) return;
    setPendingAction('create');
    setShowCreateRoom(false);
    setShowCharacterSelection(true);
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!playerNameInput.trim() || !selectedRoom) return;

    if (roleSelection === PLAYER_ROLES.SPECTATOR) {
      try {
        setLoading(true);
        setPlayerName(playerNameInput);
        setPlayerRole(roleSelection);
        setPlayerCharacter(null);

        const room = await api.joinAsSpectator(selectedRoom._id, playerNameInput);
        setCurrentRoom(room);
        setShowJoinDialog(false);
        fetchRooms();
        navigate(`/waiting-room/${room._id}`);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
      return;
    }

    setPendingAction('join');
    setShowJoinDialog(false);
    setShowCharacterSelection(true);
  };

  const handleCharacterConfirm = async () => {
    if (!selectedCharacter) return;

    try {
      setLoading(true);
      setPlayerName(playerNameInput);
      setPlayerCharacter(selectedCharacter);
      setPlayerRole(roleSelection);

      let room;
      if (pendingAction === 'create') {
        room = await api.createRoom(newRoomName, playerNameInput, 4, selectedCharacter);
      } else {
        if (roleSelection === PLAYER_ROLES.SPECTATOR) {
          room = await api.joinAsSpectator(selectedRoom._id, playerNameInput);
        } else {
          room = await api.joinRoom(selectedRoom._id, playerNameInput, selectedCharacter);
        }
      }

      setCurrentRoom(room);
      setShowCharacterSelection(false);
      fetchRooms();
      navigate(`/waiting-room/${room._id}`);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const openJoinDialog = (room) => {
    setSelectedRoom(room);
    setShowJoinDialog(true);
  };

  const resetForm = () => {
    setPlayerNameInput('');
    setNewRoomName('');
    setRoleSelection(PLAYER_ROLES.PLAYER);
    setSelectedRoom(null);
    setSelectedCharacter(null);
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <h1>🎲 Monopoly Game</h1>
        <p className="subtitle">Chơi Monopoly với bạn bè</p>

        <div className="action-buttons">
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowCreateRoom(true);
              resetForm();
            }}
          >
            ➕ Tạo Phòng
          </button>
          <button className="btn btn-secondary" onClick={fetchRooms} disabled={loading}>
            🔄 Làm mới
          </button>
        </div>

        <div className="rooms-section">
          <h2>Danh Sách Phòng</h2>
          {loading && rooms.length === 0 && <p className="loading">Đang tải...</p>}
          {rooms.length === 0 && !loading && <p className="empty">Chưa có phòng nào</p>}

          <div className="rooms-list">
            {rooms.map((room) => (
              <div key={room._id} className={`room-card ${room.status}`}>
                <div className="room-header">
                  <h3>{room.name}</h3>
                  <span className={`status-badge ${room.status}`}>
                    {room.status === ROOM_STATUS.WAITING ? '⏳ Chờ' : '🎮 Chơi'}
                  </span>
                </div>
                <div className="room-info">
                  <p>👤 Chủ phòng: <strong>{room.host}</strong></p>
                  <p>👥 Người chơi: <strong>{room.players.length}/{room.maxPlayers}</strong></p>
                  {room.spectators.length > 0 && (
                    <p>👁️ Khán giả: <strong>{room.spectators.length}</strong></p>
                  )}
                </div>
                <div className="room-players">
                  {room.players.length > 0 && (
                    <>
                      <p className="players-title">Người chơi:</p>
                      <ul>
                        {room.players.map((player, idx) => (
                          <li key={`${player.playerId || player.name || 'player'}-${idx}`}>
                            {player.name}
                            {player.isReady && <span className="ready-badge">✓</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                {room.status === ROOM_STATUS.WAITING && (
                  <button
                    className="btn btn-join"
                    onClick={() => openJoinDialog(room)}
                    disabled={
                      room.players.length >= room.maxPlayers &&
                      roleSelection === PLAYER_ROLES.PLAYER
                    }
                  >
                    Tham gia
                  </button>
                )}
                {room.status === ROOM_STATUS.PLAYING && (
                  <button
                    className="btn btn-watch"
                    onClick={() => {
                      setSelectedRoom(room);
                      setRoleSelection(PLAYER_ROLES.SPECTATOR);
                      openJoinDialog(room);
                    }}
                  >
                    Xem
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create Room Dialog */}
        {showCreateRoom && (
          <div className="modal-overlay" onClick={() => setShowCreateRoom(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Tạo Phòng Mới</h2>
              <form onSubmit={handleCreateRoom}>
                <input
                  type="text"
                  placeholder="Tên phòng"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Tên của bạn"
                  value={playerNameInput}
                  onChange={(e) => setPlayerNameInput(e.target.value)}
                  required
                />
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateRoom(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Đang tạo...' : 'Tạo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Join Room Dialog */}
        {showJoinDialog && selectedRoom && (
          <div className="modal-overlay" onClick={() => setShowJoinDialog(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Tham Gia: {selectedRoom.name}</h2>
              <form onSubmit={handleJoinRoom}>
                <input
                  type="text"
                  placeholder="Tên của bạn"
                  value={playerNameInput}
                  onChange={(e) => setPlayerNameInput(e.target.value)}
                  required
                />
                <div className="role-selection">
                  <label>
                    <input
                      type="radio"
                      value={PLAYER_ROLES.PLAYER}
                      checked={roleSelection === PLAYER_ROLES.PLAYER}
                      onChange={(e) => setRoleSelection(e.target.value)}
                    />
                    👤 Người Chơi
                  </label>
                  <label>
                    <input
                      type="radio"
                      value={PLAYER_ROLES.SPECTATOR}
                      checked={roleSelection === PLAYER_ROLES.SPECTATOR}
                      onChange={(e) => setRoleSelection(e.target.value)}
                    />
                    👁️ Khán Giả
                  </label>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowJoinDialog(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Đang tham gia...' : 'Tham gia'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Character Selection Modal */}
        {showCharacterSelection && (
          <CharacterSelection
            selectedCharacter={selectedCharacter}
            onSelectCharacter={setSelectedCharacter}
            onConfirm={handleCharacterConfirm}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
