import React from 'react';
import './QuestionModal.css';

const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: 'Dễ' },
  { key: 'medium', label: 'Trung bình' },
  { key: 'hard', label: 'Khó' }
];

export default function QuestionModal({
  visible,
  question,
  onClose,
  onAnswer,
  onSelectReward,
  onShuffleRewardChoices,
  disabled = false,
  playerInfo = '',
  mode = 'question',
  onSelectDifficulty,
  eventCellIndex = null,
  rewardOptions = [],
  rewardTitle = '',
  rewardHint = '',
  revealAnswer = false,
  correctAnswerIndex = null,
  selectedAnswerIndex = null,
  feedbackText = '',
  feedbackTone = 'neutral',
  rewardChoicePhase = 'preview',
  selectedRewardChoice = null
}) {
  if (!visible) return null;

  if (mode === 'difficulty') {
    return (
      <div className="qm-overlay">
        <div className="qm-modal">
          <h3 className="qm-title">
            O event {eventCellIndex != null ? `#${eventCellIndex}` : ''}
          </h3>
          <p className="qm-player-info">Chọn 1 mức độ câu hỏi</p>
          {playerInfo && <p className="qm-player-info">{playerInfo}</p>}
          <div className="qm-answers">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.key}
                className="qm-answer-btn qm-difficulty-btn"
                onClick={() => onSelectDifficulty?.(option.key)}
                disabled={disabled}
              >
                {option.label}
              </button>
            ))}
          </div>
          {disabled && <p className="qm-disabled-msg">👁️ Bạn chỉ có thể xem</p>}
          <button className="qm-close" onClick={onClose}>Đóng</button>
        </div>
      </div>
    );
  }

  if (mode === 'rewardChoice') {
    const isPreviewPhase = rewardChoicePhase === 'preview';
    return (
      <div className="qm-overlay">
        <div className="qm-modal">
          <h3 className="qm-title">{rewardTitle || 'Chọn 1 phần thưởng / hình phạt'}</h3>
          {rewardHint && <p className="qm-player-info">{rewardHint}</p>}
          {playerInfo && <p className="qm-player-info">{playerInfo}</p>}
          {isPreviewPhase ? (
            <>
              <div className="qm-preview-grid">
                {rewardOptions.map((reward, index) => (
                  <div key={reward.id} className="qm-preview-card">
                    <div className="qm-preview-card-index">#{index + 1}</div>
                    <strong>{reward.name}</strong>
                    {reward.type ? <span className="qm-reward-type">{reward.type}</span> : null}
                  </div>
                ))}
              </div>
              <button
                className="qm-shuffle-btn"
                onClick={() => onShuffleRewardChoices?.()}
                disabled={disabled}
              >
                🔀 Xáo bài
              </button>
              {disabled && <p className="qm-disabled-msg">👁️ Đang xử lý lựa chọn</p>}
            </>
          ) : (
            <>
              <div className="qm-answers qm-reward-deck">
                {rewardOptions.map((reward, index) => (
                  <button
                    key={reward.id}
                    className={`qm-answer-btn qm-reward-card ${selectedRewardChoice?.id === reward.id ? 'revealed' : ''}`}
                    onClick={() => onSelectReward?.(reward)}
                    disabled={disabled || !!selectedRewardChoice}
                    aria-label={`Chọn lá bài ${index + 1}`}
                  >
                    {selectedRewardChoice?.id === reward.id ? (
                      <span className="qm-card-front">
                        <strong>{selectedRewardChoice.name}</strong>
                        {selectedRewardChoice.type ? <span className="qm-reward-type">{selectedRewardChoice.type}</span> : null}
                      </span>
                    ) : (
                      <>
                        <span className="qm-card-back">?</span>
                    <span className="qm-card-pips">Lá {index + 1}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
              <p className="qm-player-info qm-reveal-note">Đã xáo bài. Chọn 1 lá để mở.</p>
              {disabled && <p className="qm-disabled-msg">👁️ Đang xử lý lựa chọn</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  if (!question) return null;

  const questionTopic = question.topic || question.category || question.difficulty || 'Câu hỏi';

  return (
    <div className="qm-overlay">
      <div className="qm-modal qm-question-modal">
        <div className="qm-question-bar" />
        <div className="qm-question-head">
          <div className="qm-question-icon">?</div>
          <div className="qm-question-copy">
            <div className="qm-question-topic">{String(questionTopic).toUpperCase()}</div>
            <h3 className="qm-title qm-question-title">{question.question}</h3>
          </div>
        </div>
        {playerInfo && <p className="qm-player-info qm-question-player">{playerInfo}</p>}
        {feedbackText && <p className={`qm-feedback qm-feedback-${feedbackTone}`}>{feedbackText}</p>}
        <div className="qm-answers">
          {question.answers.map((ans, idx) => (
            <button
              key={idx}
              className={`qm-answer-btn ${revealAnswer && idx === correctAnswerIndex ? 'qm-answer-correct' : ''} ${revealAnswer && idx === selectedAnswerIndex && selectedAnswerIndex !== correctAnswerIndex ? 'qm-answer-wrong' : ''}`}
              onClick={() => onAnswer(idx)}
              disabled={disabled}
            >
              <span className="qm-answer-index">{idx + 1}.</span>
              <span>{ans}</span>
            </button>
          ))}
        </div>
        {disabled && <p className="qm-disabled-msg">👁️ Bạn chỉ có thể xem</p>}
        {mode !== 'rewardChoice' && <button className="qm-close" onClick={onClose}>Đóng</button>}
      </div>
    </div>
  );
}
