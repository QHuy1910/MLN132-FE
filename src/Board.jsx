import React, { useMemo, useState } from 'react';
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

export default function Board({ players, currentPlayerIndex, boardSize = BOARD_SIZE }) {
  const normalizedBoardSize = Math.max(2, boardSize || BOARD_SIZE);
  const spaces = createTrackCells(normalizedBoardSize);
  const eventCells = useMemo(() => new Set(EVENT_CELL_INDEXES), []);
  const showBoardDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('boardDebug');
  const [probePoint, setProbePoint] = useState(null);
  const occupancy = players.reduce((map, player, index) => {
    const clampedPosition = Math.min(Math.max(0, player.position || 0), normalizedBoardSize - 1);
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
        const clampedPosition = Math.min(Math.max(0, player.position || 0), normalizedBoardSize - 1);
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
        const characterIcon = player.character?.emoji || player.character?.icon || '🎮';

        return (
          <g key={`player-${playerIdx}`} className={`player-token ${isCurrentPlayer ? 'current' : ''}`}>
            <circle
              cx={offsetX}
              cy={offsetY}
              r="15"
              fill="white"
              stroke={isCurrentPlayer ? '#FFD700' : '#ddd'}
              strokeWidth={isCurrentPlayer ? '2' : '1'}
              opacity="0.95"
              filter="url(#softShadow)"
            />

            <text
              x={offsetX}
              y={offsetY}
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
              cx={offsetX + 10}
              cy={offsetY - 10}
              r="6"
              fill={PLAYER_COLORS[playerIdx % PLAYER_COLORS.length]}
              stroke="white"
              strokeWidth="2"
            />
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
