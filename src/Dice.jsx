import React from 'react';
import './Dice.css';

export default function Dice({ onRoll, values, total, isRolling, disabled, loading, showRollButton = true }) {

  const handleRoll = async () => {
    if (disabled || isRolling || loading) return;

    // Call the roll function
    try {
      await onRoll();
    } catch (error) {
      console.error('Roll error:', error);
    }
  };

  return (
    <div className="dice-container">
      <div className="dice-pair">
        <div className={`dice ${isRolling ? 'rolling' : ''}`}>
          <svg viewBox="0 0 100 100" width="100" height="100">
            <rect x="10" y="10" width="80" height="80" fill="#FFD700" stroke="#FF8C00" strokeWidth="2" rx="8" />
            {renderDots(values?.[0] || 1)}
          </svg>
        </div>

        <div className={`dice ${isRolling ? 'rolling' : ''}`} style={{ animationDelay: '0.1s' }}>
          <svg viewBox="0 0 100 100" width="100" height="100">
            <rect x="10" y="10" width="80" height="80" fill="#FFD700" stroke="#FF8C00" strokeWidth="2" rx="8" />
            {renderDots(values?.[1] || 1)}
          </svg>
        </div>
      </div>
      
      <div className="dice-info">
        {isRolling ? (
          <>
            <p className="dice-label">Đang lắc...</p>
            <p className="dice-value">?</p>
          </>
        ) : (
          <>
            <p className="dice-label">Kết quả xúc xắc</p>
            <p className="dice-value">{values ? `${values[0]} + ${values[1]} = ${total ?? values[0] + values[1]}` : '-'}</p>
          </>
        )}
      </div>

      {showRollButton && (
        <button
          className="btn-roll"
          onClick={handleRoll}
          disabled={disabled || isRolling || loading}
          title={disabled ? 'Không phải lượt của bạn' : 'Lắc xúc xắc'}
        >
          {loading ? '⏳ Đang gửi...' : isRolling ? '🎲 Đang lắc...' : '🎲 Lắc xúc xắc'}
        </button>
      )}
    </div>
  );
}

function renderDots(value) {
  const dots = [];
  const dotRadius = 4;
  const positions = {
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[30, 30], [50, 50], [70, 70]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
    6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]]
  };

  (positions[value] || positions[1]).forEach((pos, idx) => {
    dots.push(
      <circle
        key={`dot-${idx}`}
        cx={pos[0]}
        cy={pos[1]}
        r={dotRadius}
        fill="#FF8C00"
      />
    );
  });

  return dots;
}
