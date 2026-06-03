import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_SIZE, PLAYER_COLORS, EVENT_CELL_INDEXES } from './constants.js';
import { BOARD_CELL_POINTS, getBoardCellPoint } from './boardCells.js';
import './Board.css';
import mapImage from '../map-1.png';

const IMAGE_WIDTH = 1408;
const IMAGE_HEIGHT = 768;

const getTrackPoint = (index) => {
  const cell = BOARD_CELL_POINTS[index] || BOARD_CELL_POINTS[0];
  return getBoardCellPoint(cell.index);
};

const createTrackCells = (count) => {
  if (count <= 1) return [getTrackPoint(0)];
  if (count === BOARD_CELL_POINTS.length) return BOARD_CELL_POINTS.map((_, index) => getTrackPoint(index));

  const result = [];
  for (let i = 0; i < count; i += 1) {
    const sourceIndex = Math.min(
      Math.floor((i / (count - 1)) * (BOARD_CELL_POINTS.length - 1)),
      BOARD_CELL_POINTS.length - 1
    );
    result.push(getTrackPoint(sourceIndex));
  }

  return result;
};

export default function Board({ players, currentPlayerIndex, boardSize = BOARD_SIZE, onMovementStart, onMovementComplete }) {
  const normalizedBoardSize = Math.max(2, boardSize || BOARD_SIZE);
  const spaces = createTrackCells(normalizedBoardSize);
  const eventCells = useMemo(() => new Set(EVENT_CELL_INDEXES), []);
  const showBoardDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('boardDebug');
  const [probePoint, setProbePoint] = useState(null);
  const targetPositions = useMemo(() => players.map((player) => (
    Math.min(Math.max(0, player.position || 0), normalizedBoardSize - 1)
  )), [players, normalizedBoardSize]);
  const targetPositionSignature = targetPositions.join('|');
  const [displayPositions, setDisplayPositions] = useState(() => targetPositions);
  const moveTimerRef = useRef(null);
  const displayPositionsRef = useRef(targetPositions);

  useEffect(() => {
    if (moveTimerRef.current) {
      window.clearInterval(moveTimerRef.current);
    }

    const shouldAnimate = targetPositions.some((targetPosition, index) => {
      const currentPosition = displayPositionsRef.current[index];
      return Number.isFinite(currentPosition) && currentPosition !== targetPosition;
    });

    setDisplayPositions((previousPositions) => {
      const nextDisplayPositions = targetPositions.map((targetPosition, index) => {
        const previousPosition = previousPositions[index];
        return Number.isFinite(previousPosition)
          ? Math.min(Math.max(0, previousPosition), normalizedBoardSize - 1)
          : targetPosition;
      });
      displayPositionsRef.current = nextDisplayPositions;
      return nextDisplayPositions;
    });

    if (shouldAnimate) {
      onMovementStart?.();
    }

    moveTimerRef.current = window.setInterval(() => {
      setDisplayPositions((previousPositions) => {
        let hasMoreSteps = false;
        const nextPositions = targetPositions.map((targetPosition, index) => {
          const currentPosition = Number.isFinite(previousPositions[index])
            ? Math.min(Math.max(0, previousPositions[index]), normalizedBoardSize - 1)
            : targetPosition;

          if (currentPosition === targetPosition) {
            return currentPosition;
          }

          hasMoreSteps = true;
          return currentPosition + Math.sign(targetPosition - currentPosition);
        });

        if (!hasMoreSteps) {
          window.clearInterval(moveTimerRef.current);
          moveTimerRef.current = null;
          displayPositionsRef.current = targetPositions;
          onMovementComplete?.();
          return targetPositions;
        }

        displayPositionsRef.current = nextPositions;
        return nextPositions;
      });
    }, 170);

    return () => {
      if (moveTimerRef.current) {
        window.clearInterval(moveTimerRef.current);
        moveTimerRef.current = null;
      }
    };
  }, [targetPositions, targetPositionSignature, normalizedBoardSize, onMovementStart, onMovementComplete]);

  const occupancy = players.reduce((map, player, index) => {
    const clampedPosition = displayPositions[index] ?? targetPositions[index] ?? 0;
    if (!map.has(clampedPosition)) {
      map.set(clampedPosition, []);
    }
    map.get(clampedPosition).push(index);
    return map;
  }, new Map());

  const boardDebugCells = useMemo(() => BOARD_CELL_POINTS.map((cell, index) => ({
    ...cell,
    point: getBoardCellPoint(index)
  })), []);

  const handleMouseMove = (event) => {
    if (!showBoardDebug) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * IMAGE_WIDTH;
    const y = ((event.clientY - bounds.top) / bounds.height) * IMAGE_HEIGHT;

    let nearestCell = null;
    let nearestDistance = Infinity;

    for (const cell of boardDebugCells) {
      const distance = Math.hypot(cell.point.x - x, cell.point.y - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestCell = cell;
      }
    }

    setProbePoint({ x, y, nearestCell, nearestDistance });
  };

  return (
    <div className="board-stage" role="img" aria-label="Game map" onMouseMove={handleMouseMove} onMouseLeave={() => setProbePoint(null)}>
      <img className="board-image" src={mapImage} alt="Game map" draggable="false" />
      <svg className="board-overlay" viewBox={`0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {showBoardDebug && boardDebugCells.map((cell) => {
        const point = cell.point;

        return (
          <g key={`debug-${cell.index}`} className="board-debug-point">
            <circle cx={point.x} cy={point.y} r="5" fill="#ff3b30" stroke="white" strokeWidth="2" />
            <text x={point.x + 8} y={point.y - 8} fill="#111" fontSize="14" fontWeight="700">
              {cell.index}
            </text>
          </g>
        );
      })}
      {spaces.map((spacePos, index) => {
        if (!eventCells.has(index)) return null;

        return (
          <g key={`event-${index}`} className="event-cell-marker" aria-label={`Event cell ${index}`}>
            <circle cx={spacePos.x} cy={spacePos.y} r="8" fill="#ffd166" stroke="#f77f00" strokeWidth="2" opacity="0.9" />
            <text x={spacePos.x} y={spacePos.y + 4} textAnchor="middle" fill="#5a3d00" fontSize="10" fontWeight="700">?</text>
          </g>
        );
      })}
      {players.map((player, playerIdx) => {
        const targetPosition = targetPositions[playerIdx] ?? 0;
        const clampedPosition = displayPositions[playerIdx] ?? targetPosition;
        const spacePos = spaces[clampedPosition] || spaces[0];
        const sharingPlayers = occupancy.get(clampedPosition) || [];
        const shareIndex = sharingPlayers.indexOf(playerIdx);
        const spreadCount = sharingPlayers.length;
        const hasSpread = spreadCount > 1;
        const offsetAngle = hasSpread ? ((shareIndex % 6) * Math.PI) / 3 : 0;
        const offsetRadius = hasSpread ? 16 : 0;
        const offsetX = spacePos.x + offsetRadius * Math.cos(offsetAngle);
        const offsetY = spacePos.y + offsetRadius * Math.sin(offsetAngle);
        const isCurrentPlayer = playerIdx === currentPlayerIndex;
        const isMoving = clampedPosition !== targetPosition;
        const characterIcon = player.character?.emoji || player.character?.icon || '🎮';

        return (
          <g
            key={`player-${player.playerId || player.name || playerIdx}`}
            className="player-token-position"
            style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
          >
          <g className={`player-token ${isCurrentPlayer ? 'current' : ''} ${isMoving ? 'moving' : ''}`}>
            <circle
              cx="0"
              cy="0"
              r="15"
              fill="white"
              stroke={isCurrentPlayer ? '#FFD700' : '#ddd'}
              strokeWidth={isCurrentPlayer ? '2' : '1'}
              opacity="0.95"
              filter="url(#softShadow)"
            />

            <text
              x="0"
              y="0"
              textAnchor="middle"
              dy="0.3em"
              fontSize="15"
              fill="black"
              fontWeight="bold"
              style={{ fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif' }}
            >
              {characterIcon}
            </text>

            <circle
              cx="10"
              cy="-10"
              r="6"
              fill={PLAYER_COLORS[playerIdx % PLAYER_COLORS.length]}
              stroke="white"
              strokeWidth="2"
            />
          </g>
          </g>
        );
      })}
      </svg>

      {showBoardDebug && probePoint && (
        <div className="board-coordinate-probe">
          <div><strong>SVG:</strong> {probePoint.x.toFixed(1)}, {probePoint.y.toFixed(1)}</div>
          <div><strong>Gần nhất:</strong> ô {probePoint.nearestCell?.index} ({probePoint.nearestDistance.toFixed(1)}px)</div>
          <div><strong>Ô gốc:</strong> x {probePoint.nearestCell?.x}, y {probePoint.nearestCell?.y}</div>
          <div><strong>Offset:</strong> dx {probePoint.nearestCell?.dx || 0}, dy {probePoint.nearestCell?.dy || 0}</div>
        </div>
      )}
    </div>
  );
}
