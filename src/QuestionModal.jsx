import React from 'react';
import './QuestionModal.css';

const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: 'Dễ' },
  { key: 'medium', label: 'Trung bình' },
  { key: 'hard', label: 'Khó' }
];

const REWARD_META = {
  move_self: {
    label: 'Toc bien',
    mark: '>>',
    description: (value) => `Tien them ${value || 1} o.`
  },
  move_self_back: {
    label: 'Bat loi',
    mark: '<<',
    description: (value) => `Lui ${value || 1} o.`
  },
  dice_bonus: {
    label: 'Cuong hoa',
    mark: '+D',
    description: (value) => `Lan roll sau duoc cong ${value || 1} diem.`
  },
  dice_penalty: {
    label: 'Suy yeu',
    mark: '-D',
    description: (value) => `Lan roll sau bi tru ${value || 1} diem.`
  },
  shield: {
    label: 'Phong thu',
    mark: '[]',
    description: (value) => `Nhan ${value || 1} khien chan hinh phat.`
  },
  move_target_back: {
    label: 'Cong kich',
    mark: 'X',
    description: (value) => `Chon 1 nguoi choi lui ${value || 1} o.`
  },
  move_all_others_back: {
    label: 'Khong che',
    mark: 'ALL',
    description: (value) => `Tat ca nguoi choi khac lui ${value || 1} o.`
  },
  force_skip_target: {
    label: 'Ap che',
    mark: '!',
    description: () => 'Chon 1 nguoi choi mat luot.'
  },
  place_trap: {
    label: 'Bay',
    mark: '!!',
    description: () => 'Chon hinh phat va dat bay len mot o thuong.'
  },
  skip_turn: {
    label: 'Bat loi',
    mark: '!',
    description: () => 'Mat luot tiep theo.'
  }
};

function getRewardMeta(reward) {
  const meta = REWARD_META[reward?.type] || {
    label: reward?.type || 'Hieu ung',
    mark: '*',
    description: () => 'Kich hoat hieu ung dac biet.'
  };

  return {
    ...meta,
    descriptionText: reward?.type === 'place_trap' && reward?.trapPenalty
      ? `Dat bay: ${reward.trapPenalty.name}`
      : meta.description(reward?.value)
  };
}

function getRewardTier(reward, rewardDifficulty, index = null) {
  if (rewardDifficulty) return rewardDifficulty;
  if (reward?.id?.startsWith('hard_')) return 'hard';
  if (reward?.id?.startsWith('medium_')) return 'medium';
  if (reward?.id?.startsWith('easy_')) return 'easy';
  return rewardDifficulty || 'easy';
}

function RewardCardContent({ reward, index }) {
  const meta = getRewardMeta(reward);

  return (
    <span className="qm-card-front">
      <span className="qm-augment-corners" aria-hidden="true" />
      <span className="qm-augment-frame" aria-hidden="true" />
      <span className="qm-augment-emblem" aria-hidden="true">
        <span>{meta.mark}</span>
      </span>
      <strong className="qm-augment-name">{reward.name}</strong>
      <span className="qm-reward-type">{meta.label}</span>
      <span className="qm-augment-description">{meta.descriptionText}</span>
      <span className="qm-augment-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    </span>
  );
}

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
  targetOptions = [],
  targetTitle = '',
  targetHint = '',
  onSelectTarget,
  revealAnswer = false,
  correctAnswerIndex = null,
  selectedAnswerIndex = null,
  feedbackText = '',
  feedbackTone = 'neutral',
  rewardChoicePhase = 'preview',
  selectedRewardChoice = null,
  rewardDifficulty = 'easy',
  noticeTitle = '',
  noticeMessage = '',
  confirmText = 'Xac nhan',
  onConfirm,
  showConfirm = true
}) {
  if (!visible) return null;

  if (mode === 'notice') {
    return (
      <div className="qm-overlay">
        <div className="qm-modal qm-notice-modal">
          <div className="qm-notice-icon">!</div>
          <h3 className="qm-title">{noticeTitle || 'Thong bao'}</h3>
          {noticeMessage && <p className="qm-player-info qm-notice-message">{noticeMessage}</p>}
          {playerInfo && <p className="qm-player-info">{playerInfo}</p>}
          {showConfirm && (
            <button
              className="qm-confirm-btn"
              onClick={() => onConfirm?.()}
              disabled={disabled}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'targetChoice') {
    return (
      <div className="qm-overlay">
        <div className="qm-modal">
          <h3 className="qm-title">{targetTitle || 'Chon nguoi choi'}</h3>
          {targetHint && <p className="qm-player-info">{targetHint}</p>}
          <div className="qm-answers qm-target-list">
            {targetOptions.map((player) => (
              <button
                key={player.playerId || player.name}
                className="qm-answer-btn qm-target-btn"
                onClick={() => onSelectTarget?.(player)}
                disabled={disabled}
              >
                <span className="qm-target-name">{player.name}</span>
                <span className="qm-target-position">Vi tri: {player.position || 0}</span>
              </button>
            ))}
          </div>
          {!targetOptions.length && <p className="qm-disabled-msg">Khong co nguoi choi hop le de chon.</p>}
          {disabled && <p className="qm-disabled-msg">Dang xu ly lua chon</p>}
        </div>
      </div>
    );
  }

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
        <div className="qm-modal qm-reward-modal">
          <h3 className="qm-title">{rewardTitle || 'Chọn 1 phần thưởng / hình phạt'}</h3>
          {rewardHint && <p className="qm-player-info">{rewardHint}</p>}
          {playerInfo && <p className="qm-player-info">{playerInfo}</p>}
          {isPreviewPhase ? (
            <>
              <div className="qm-preview-grid">
                {rewardOptions.map((reward, index) => (
                  <div key={reward.id} className={`qm-preview-card qm-reward-tier-${getRewardTier(reward, rewardDifficulty, index)}`}>
                    <RewardCardContent reward={reward} index={index} />
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
                    className={`qm-answer-btn qm-reward-card revealed qm-reward-tier-${getRewardTier(reward, rewardDifficulty, index)} ${selectedRewardChoice?.id === reward.id ? 'selected' : ''}`}
                    onClick={() => onSelectReward?.(reward)}
                    disabled={disabled || !!selectedRewardChoice}
                    aria-label={`Chọn lá bài ${index + 1}`}
                  >
                    {(selectedRewardChoice?.id === reward.id || true) ? (
                      <RewardCardContent reward={reward} index={index} />
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
            {question.source && <p className="qm-question-source">Nguồn: {question.source}</p>}
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
