import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from './GameContext.jsx';
import { CHARACTERS } from './characters.js';
import { createGame } from './gameEngine.js';
import './SetupRoom.css';

const MAX_PLAYERS = 5;
const MIN_PLAYERS = 2;

export default function SetupRoom() {
  const navigate = useNavigate();
  const { startLocalGame } = useGame();

  const [roomName, setRoomName] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [players, setPlayers] = useState([
    { name: '', character: CHARACTERS[0] },
    { name: '', character: CHARACTERS[1] },
  ]);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1 = setup info, 2 = select characters

  const handlePlayerCountChange = (count) => {
    const n = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Number(count)));
    setPlayerCount(n);
    setPlayers(prev => {
      const next = [...prev];
      while (next.length < n) next.push({ name: '', character: CHARACTERS[next.length % CHARACTERS.length] });
      return next.slice(0, n);
    });
  };

  const updatePlayer = (index, field, value) => {
    setPlayers(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const getUsedCharacterIds = (excludeIndex) =>
    players.filter((_, i) => i !== excludeIndex).map(p => p.character?.id).filter(Boolean);

  const handleStart = () => {
    setError('');

    if (!roomName.trim()) {
      setError('Vui lòng nhập tên phòng');
      return;
    }

    for (let i = 0; i < players.length; i++) {
      if (!players[i].name.trim()) {
        setError(`Vui lòng nhập tên người chơi ${i + 1}`);
        return;
      }
    }

    const names = players.map(p => p.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      setError('Tên người chơi phải khác nhau');
      return;
    }

    const gameState = createGame(players.map(p => ({
      name: p.name.trim(),
      character: p.character,
    })));

    startLocalGame(roomName.trim(), gameState);
    navigate('/game');
  };

  return (
    <div className="setup-room">
      <div className="setup-container">
        {/* Header */}
        <div className="setup-header">
          <div className="setup-logo">🎲</div>
          <h1>Hành Trình Chống Bạo Lực Gia Đình</h1>
          <p className="setup-subtitle">Cùng nhau nhận diện, phòng tránh và lên tiếng</p>
        </div>

        <div className="setup-card">
          {/* Room Name */}
          <div className="form-group">
            <label className="form-label">
              <span className="label-icon">🏠</span>
              Tên Phòng
            </label>
            <input
              id="room-name"
              type="text"
              className="form-input"
              placeholder="Nhập tên phòng..."
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Player Count */}
          <div className="form-group">
            <label className="form-label">
              <span className="label-icon">👥</span>
              Số Người Chơi
            </label>
            <div className="player-count-selector">
              {[2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`count-btn ${playerCount === n ? 'active' : ''}`}
                  onClick={() => handlePlayerCountChange(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Players Setup */}
          <div className="players-setup">
            <label className="form-label">
              <span className="label-icon">🎮</span>
              Thông Tin Người Chơi
            </label>

            {players.map((player, index) => {
              const usedIds = getUsedCharacterIds(index);
              return (
                <div key={index} className="player-setup-row">
                  <div className="player-setup-header">
                    <span className="player-number">Người chơi {index + 1}</span>
                    <span className="player-character-preview">{player.character?.emoji}</span>
                  </div>

                  <input
                    id={`player-name-${index}`}
                    type="text"
                    className="form-input player-name-input"
                    placeholder={`Tên người chơi ${index + 1}...`}
                    value={player.name}
                    onChange={e => updatePlayer(index, 'name', e.target.value)}
                    maxLength={20}
                  />

                  <div className="character-grid">
                    {CHARACTERS.map(char => {
                      const isUsed = usedIds.includes(char.id);
                      const isSelected = player.character?.id === char.id;
                      return (
                        <button
                          key={char.id}
                          className={`char-btn ${isSelected ? 'selected' : ''} ${isUsed ? 'used' : ''}`}
                          onClick={() => !isUsed && updatePlayer(index, 'character', char)}
                          disabled={isUsed}
                          title={isUsed ? `${char.name} đã được chọn` : char.name}
                        >
                          <span className="char-emoji">{char.emoji}</span>
                          <span className="char-name">{char.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="setup-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            id="start-game-btn"
            className="btn-start"
            onClick={handleStart}
          >
            🎮 Bắt Đầu Trò Chơi
          </button>
        </div>

        {/* Quick Guide */}
        <div className="setup-guide">
          <h3>📖 Hướng Dẫn Nhanh</h3>
          <ul>
            <li>🎲 Mỗi lượt: lắc xúc xắc → trả lời câu hỏi → di chuyển</li>
            <li>⭐ Ô đặc biệt: chuỗi 3 câu hỏi → nhận/chọn phần thưởng</li>
            <li>🪤 Bẫy: có thể đặt bẫy để cản người khác</li>
            <li>🏆 Người về đích đầu tiên sẽ xếp hạng 1</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
