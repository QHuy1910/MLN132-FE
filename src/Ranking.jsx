import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from './GameContext';
import { BOARD_SIZE } from './constants.js';
import './Ranking.css';

export default function Ranking() {
  const navigate = useNavigate();
  const { gameState, roomName, resetGame } = useGame();

  if (!gameState) {
    return (
      <div className="ranking-container">
        <div className="ranking-content">
          <p>Không có dữ liệu game.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>← Về Trang Chủ</button>
        </div>
      </div>
    );
  }

  const boardSize = gameState.boardSize || BOARD_SIZE;

  // Use computed ranking if available, else fallback from players
  const ranking = gameState.ranking?.length > 0
    ? gameState.ranking
    : [...(gameState.players || [])]
        .sort((a, b) => {
          const ar = Number(a.finishedRank || 0);
          const br = Number(b.finishedRank || 0);
          if (ar && br && ar !== br) return ar - br;
          if (ar && !br) return -1;
          if (!ar && br) return 1;
          return (b.position || 0) - (a.position || 0);
        })
        .map((player, index) => ({
          playerId: player.playerId || `${player.name}-${index}`,
          name: player.name,
          rank: index + 1,
          position: player.position || 0,
          character: player.character,
          finishTime: player.finishedAt || null,
        }));

  const handlePlayAgain = () => {
    resetGame();
    navigate('/');
  };

  const medalFor = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="ranking-container">
      <div className="ranking-content">
        <h1>🏆 KẾT QUẢ CUỘC CHƠI</h1>
        {roomName && <p className="ranking-room-name">Phòng: <strong>{roomName}</strong></p>}

        {/* Podium for top 3 */}
        {ranking.length >= 2 && (
          <div className="ranking-podium">
            {[1, 0, 2].map(idx => {
              const entry = ranking[idx];
              if (!entry) return <div key={idx} className="podium-slot empty" />;
              return (
                <div key={entry.playerId || idx} className={`podium-slot rank-${entry.rank}`}>
                  <div className="podium-avatar">{entry.character?.emoji || '🎮'}</div>
                  <div className="podium-medal">{medalFor(entry.rank)}</div>
                  <div className="podium-name">{entry.name}</div>
                  <div className="podium-pos">Ô {Math.min((entry.position ?? 0) + 1, boardSize)}</div>
                  <div className="podium-bar" />
                </div>
              );
            })}
          </div>
        )}

        {/* Full table */}
        <div className="ranking-table">
          {ranking.length === 0 ? (
            <div className="no-ranking">Chưa có kết quả xếp hạng</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="rank-col">Hạng</th>
                  <th className="character-col">Nhân Vật</th>
                  <th className="name-col">Tên Người Chơi</th>
                  <th className="position-col">Vị Trí</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((player, index) => (
                  <tr key={player.playerId || index} className={`rank-row rank-${player.rank}`}>
                    <td className="rank-cell">
                      <div className="rank-badge">{medalFor(player.rank)}</div>
                    </td>
                    <td className="character-cell">
                      <span className="character-emoji">{player.character?.emoji || '🎮'}</span>
                    </td>
                    <td className="name-cell">{String(player.name || 'Người chơi')}</td>
                    <td className="position-cell">
                      {Math.min((player.position ?? 0) + 1, boardSize)}/{boardSize}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="ranking-actions">
          <button className="btn btn-primary" onClick={handlePlayAgain}>
            🔄 Chơi Lại
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            ← Trang Chủ
          </button>
        </div>
      </div>
    </div>
  );
}
