import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from './GameContext';
import { api } from './api';
import { BOARD_SIZE } from './constants.js';
import './Ranking.css';

export default function Ranking() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { currentRoom, setCurrentRoom } = useGame();

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const room = await api.getRoomById(roomId);
        setCurrentRoom(room);
      } catch (error) {
        console.error('Error fetching room:', error);
      }
    };

    if (!currentRoom || currentRoom._id !== roomId) {
      fetchRoom();
    }
  }, [roomId, currentRoom, setCurrentRoom]);

  if (!currentRoom) {
    return <div className="ranking-container">Đang tải kết quả...</div>;
  }

  const ranking = currentRoom.ranking || [];
  const boardSize = currentRoom.boardSize || BOARD_SIZE;
  const fallbackRanking = [...(currentRoom.players || [])]
    .sort((a, b) => {
      const positionDiff = (b.position || 0) - (a.position || 0);
      if (positionDiff !== 0) return positionDiff;
      return String(a.name || '').localeCompare(String(b.name || ''));
    })
    .map((player, index) => ({
      playerId: player.playerId || `${player.name || 'player'}-${index}`,
      name: String(player.name || 'Người chơi'),
      rank: index + 1,
      position: player.position || 0,
      character: player.character,
      finishTime: player.finishTime || null
    }));

  const displayRanking = ranking.length >= Math.max((currentRoom.players || []).length, 1)
    ? ranking
    : fallbackRanking;

  return (
    <div className="ranking-container">
      <div className="ranking-content">
        <h1>🏆 KẾT QUẢ CUỘC CHƠI</h1>

        <div className="ranking-table">
          {displayRanking.length === 0 ? (
            <div className="no-ranking">Chưa có kết quả xếp hạng</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="rank-col">Hạng</th>
                  <th className="character-col">Nhân vật</th>
                  <th className="name-col">Tên Người Chơi</th>
                  <th className="position-col">Vị Trí</th>
                </tr>
              </thead>
              <tbody>
                {displayRanking.map((player, index) => (
                  <tr key={player.playerId || index} className={`rank-${player.rank}`}>
                    <td className="rank-cell">
                      <div className="rank-badge">
                        {player.rank === 1 && '🥇'}
                        {player.rank === 2 && '🥈'}
                        {player.rank === 3 && '🥉'}
                        {player.rank > 3 && player.rank}
                      </div>
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
          <button
            className="btn btn-primary"
            onClick={() => navigate('/home')}
          >
            ← Quay Lại Trang Chủ
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/waiting-room/${roomId}`)}
          >
            👥 Xem Phòng
          </button>
        </div>
      </div>
    </div>
  );
}
