import React, { useEffect, useState } from 'react';
import './Dice.css';

const formatDiceResult = (values, total, modifier = 0) => {
  if (!values) return '-';

  const baseTotal = values[0] + values[1];
  const normalizedModifier = Number(modifier || 0);
  const modifierText = normalizedModifier === 0
    ? ''
    : ` ${normalizedModifier > 0 ? '+' : '-'} ${Math.abs(normalizedModifier)}`;

  return `${values[0]} + ${values[1]}${modifierText} = ${total ?? Math.max(1, baseTotal + normalizedModifier)}`;
};

export default function Dice({ onRoll, values, total, modifier = 0, isRolling, disabled, loading, showRollButton = true }) {
  const [rollingValues, setRollingValues] = useState([1, 1]);

  useEffect(() => {
    if (!isRolling) return undefined;

    const randomizeDice = () => {
      setRollingValues([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ]);
    };

    randomizeDice();
    const intervalId = window.setInterval(randomizeDice, 55);
    return () => window.clearInterval(intervalId);
  }, [isRolling]);

  const displayValues = isRolling ? rollingValues : (values || [1, 1]);
  const hasResult = !!values && !isRolling;

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
    <div className={`dice-container ${isRolling ? 'rolling' : ''} ${hasResult ? 'has-result' : ''}`}>
      <div className="dice-arena" aria-live="polite">
        <div className="dice-vortex" />
        <div className="dice-sparks" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={`spark-${index}`} className="dice-spark" />
          ))}
        </div>
        <div className="dice-pair">
          <div className={`dice dice-one ${isRolling ? 'rolling' : ''} ${hasResult ? 'settled' : ''}`}>
            {renderDiceCube(displayValues[0])}
          </div>

          <div className={`dice dice-two ${isRolling ? 'rolling' : ''} ${hasResult ? 'settled' : ''}`}>
            {renderDiceCube(displayValues[1])}
          </div>
        </div>
        <div className="dice-result-burst" aria-hidden="true" />
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
            <p className="dice-value">{formatDiceResult(values, total, modifier)}</p>
            {Number(modifier || 0) < 0 && (
              <p className="dice-modifier penalty">Bị trừ {Math.abs(Number(modifier))} khi roll</p>
            )}
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

function renderDiceCube(value) {
  return (
    <div className="dice-cube" aria-label={`Xuc xac ${value}`}>
      <div className="dice-cube-face dice-cube-front">
        <span className="dice-face-shine" />
        {renderPips(value)}
      </div>
      <div className="dice-cube-face dice-cube-back">{renderPips(6)}</div>
      <div className="dice-cube-face dice-cube-right">{renderPips(3)}</div>
      <div className="dice-cube-face dice-cube-left">{renderPips(4)}</div>
      <div className="dice-cube-face dice-cube-top">{renderPips(2)}</div>
      <div className="dice-cube-face dice-cube-bottom">{renderPips(5)}</div>
    </div>
  );
}

function renderPips(value) {
  const positions = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
  };

  return (positions[value] || positions[1]).map((position, index) => (
    <span key={`pip-${position}-${index}`} className={`dice-pip ${position}`} />
  ));
}

export { formatDiceResult };
