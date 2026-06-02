import React from 'react';
import { CHARACTERS } from './characters.js';
import './CharacterSelection.css';

export default function CharacterSelection({ selectedCharacter, onSelectCharacter, onConfirm, loading }) {
  return (
    <div className="character-selection-overlay">
      <div className="character-selection-modal">
        <h2>🎮 Chọn Nhân Vật Của Bạn</h2>
        <p className="subtitle">Hãy chọn một nhân vật yêu thích</p>

        <div className="characters-grid">
          {CHARACTERS.map((character) => (
            <div
              key={character.id}
              className={`character-card ${selectedCharacter?.id === character.id ? 'selected' : ''}`}
              onClick={() => onSelectCharacter(character)}
            >
              <div className="character-icon">{character.icon}</div>
              <div className="character-name">{character.name}</div>
            </div>
          ))}
        </div>

        <div className="selection-actions">
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={!selectedCharacter || loading}
          >
            {loading ? '⏳ Đang xác nhận...' : '✅ Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
