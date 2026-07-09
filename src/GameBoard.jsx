import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from './GameContext.jsx';
import {
  rollDice, movePlayer, nextTurn, prepareQuestion, answerQuestion,
  resolveEventQuestion, applyEventChoice, setTrapVisibility,
  updatePlayerPositions, computeRanking, EVENT_CELL_INDEXES,
  EVENT_QUESTION_SEQUENCE_LIST
} from './gameEngine.js';
import { BOARD_SIZE } from './constants.js';
import Board from './Board.jsx';
import Dice, { formatDiceResult } from './Dice.jsx';
import QuestionModal from './QuestionModal.jsx';
import './GameBoard.css';

const EVENT_QUESTION_SEQUENCE = EVENT_QUESTION_SEQUENCE_LIST;
const REWARD_REVEAL_DURATION_MS = 2500;

export default function GameBoard() {
  const navigate = useNavigate();
  const { gameState, setGameState, shownQuestion, setShownQuestion, roomName, resetGame } = useGame();

  const [error, setError] = useState(null);
  const [rewardNotice, setRewardNotice] = useState(null);
  const [diceValues, setDiceValues] = useState(null);
  const [diceTotal, setDiceTotal] = useState(null);
  const [lastRollInfo, setLastRollInfo] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolledThisTurn, setHasRolledThisTurn] = useState(false);
  const [canMoveAfterRoll, setCanMoveAfterRoll] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [isPlayersPanelCollapsed, setIsPlayersPanelCollapsed] = useState(false);
  const [answerProcessing, setAnswerProcessing] = useState(false);
  const [questionFeedback, setQuestionFeedback] = useState(null);
  const [pendingRewardChoices, setPendingRewardChoices] = useState(null);
  const [rewardChoiceLoading, setRewardChoiceLoading] = useState(false);
  const [rewardChoicePhase, setRewardChoicePhase] = useState('select');
  const [shuffledRewardChoices, setShuffledRewardChoices] = useState([]);
  const [selectedRewardChoice, setSelectedRewardChoice] = useState(null);
  const [pendingTargetReward, setPendingTargetReward] = useState(null);
  const [pendingTrapReward, setPendingTrapReward] = useState(null);
  const [boardNotice, setBoardNotice] = useState(null);
  const [positionEditorOpen, setPositionEditorOpen] = useState(false);
  const [positionDrafts, setPositionDrafts] = useState({});
  const [positionSaving, setPositionSaving] = useState(false);
  const [eventProgress, setEventProgress] = useState({ active: false, step: 0, correctCount: 0, total: 3 });

  const answerRevealTimerRef = useRef(null);
  const autoMoveTimerRef = useRef(null);
  const rewardRevealTimerRef = useRef(null);
  const eventSequenceRef = useRef({ active: false, step: 0, correctCount: 0 });
  const answerLockedRef = useRef(false);
  const completionStartedRef = useRef(false);
  const navigationTimerRef = useRef(null);
  const boardMovingRef = useRef(false);
  const pendingEventCellRef = useRef(null);
  const gameStateRef = useRef(gameState);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Redirect to setup if no game
  useEffect(() => {
    if (!gameState) {
      navigate('/');
    }
  }, [gameState, navigate]);

  // Cleanup timers
  useEffect(() => () => {
    [navigationTimerRef, answerRevealTimerRef, autoMoveTimerRef, rewardRevealTimerRef]
      .forEach(ref => { if (ref.current) window.clearTimeout(ref.current); });
  }, []);

  // ── Game Completion ─────────────────────────────────────────
  const finalizeGame = useCallback(() => {
    if (completionStartedRef.current) return;
    completionStartedRef.current = true;
    setGameCompleted(true);

    setGameState(prev => {
      if (!prev) return prev;
      const ranking = computeRanking(prev);
      return { ...prev, status: 'finished', ranking };
    });

    navigationTimerRef.current = window.setTimeout(() => {
      navigate('/ranking');
    }, 1200);
  }, [navigate, setGameState]);

  useEffect(() => {
    if (gameState?.status === 'finished' && !gameCompleted) {
      finalizeGame();
    }
  }, [gameState?.status, gameCompleted, finalizeGame]);

  // ── Event Cell Landing ──────────────────────────────────────
  const processEventCellLanded = useCallback((cellIndex, playerName) => {
    setError(null);
    setShownQuestion(null);
    setPendingRewardChoices(null);
    setSelectedRewardChoice(null);
    setPendingTargetReward(null);
    setPendingTrapReward(null);
    setRewardChoicePhase('select');
    eventSequenceRef.current = { active: true, step: 0, correctCount: 0 };
    setEventProgress({ active: true, step: 0, correctCount: 0, total: EVENT_QUESTION_SEQUENCE.length });

    setBoardNotice({
      type: 'event',
      title: `${playerName} đã vào ô event!`,
      message: 'Bắt đầu chuỗi 3 câu hỏi event.',
      playerName,
      canStartQuestion: true,
    });
  }, [setShownQuestion]);

  const handleBoardMovementStart = useCallback(() => { boardMovingRef.current = true; }, []);
  const handleBoardMovementComplete = useCallback(() => {
    boardMovingRef.current = false;
    const pending = pendingEventCellRef.current;
    pendingEventCellRef.current = null;
    if (pending) processEventCellLanded(pending.cellIndex, pending.playerName);
  }, [processEventCellLanded]);

  // ── Show event question step ────────────────────────────────
  const showEventQuestion = useCallback((difficulty, step) => {
    const currentGs = gameStateRef.current;
    if (!currentGs) return;

    const { state: newState, question } = prepareQuestion(currentGs, difficulty, {
      isEventSequence: true,
      eventStep: step,
      eventTotal: EVENT_QUESTION_SEQUENCE.length,
    });

    if (!question) {
      setError('Không còn câu hỏi nào.');
      return;
    }

    setGameState(newState);
    setShownQuestion(question);
    setQuestionFeedback(null);
    setAnswerProcessing(false);
    answerLockedRef.current = false;
    setBoardNotice(null);
  }, [setGameState, setShownQuestion]);

  const handleConfirmBoardNotice = useCallback(() => {
    const notice = boardNotice;
    setBoardNotice(null);
    if (notice?.type === 'event' && notice.canStartQuestion) {
      showEventQuestion(EVENT_QUESTION_SEQUENCE[0], 0);
    }
  }, [boardNotice, showEventQuestion]);

  // ── Position Editor ─────────────────────────────────────────
  const openPositionEditor = useCallback(() => {
    const players = gameStateRef.current?.players || [];
    const drafts = {};
    players.forEach((p, i) => {
      const key = p.playerId || p.name || String(i);
      drafts[key] = Number(p.position || 0);
    });
    setPositionDrafts(drafts);
    setPositionEditorOpen(true);
    setPositionSaving(false);
  }, []);

  const closePositionEditor = useCallback(() => {
    if (positionSaving) return;
    setPositionEditorOpen(false);
  }, [positionSaving]);

  const handlePositionDraftChange = useCallback((key, value) => {
    const boardSz = gameStateRef.current?.boardSize || BOARD_SIZE;
    const max = Math.max(0, boardSz - 1);
    const next = Math.min(Math.max(0, Number(value) || 0), max);
    setPositionDrafts(prev => ({ ...prev, [key]: next }));
  }, []);

  const handleSavePlayerPositions = useCallback(() => {
    const current = gameStateRef.current;
    if (!current) return;
    setPositionSaving(true);

    const positions = current.players.map((p, i) => ({
      playerId: p.playerId,
      name: p.name,
      position: positionDrafts[p.playerId || p.name || String(i)] ?? p.position ?? 0,
    }));

    const newState = updatePlayerPositions(current, positions);
    setGameState(newState);
    setPositionSaving(false);
    setPositionEditorOpen(false);
    setRewardNotice({ message: 'Đã cập nhật vị trí người chơi', playerName: '' });
  }, [positionDrafts, setGameState]);

  const handleToggleTrapVisibility = useCallback(() => {
    const current = gameStateRef.current;
    if (!current) return;
    const newState = setTrapVisibility(current, !current.showTrapsOnMap);
    setGameState(newState);
  }, [setGameState]);

  // ── Roll Dice ───────────────────────────────────────────────
  const handleRollDice = useCallback(() => {
    const current = gameStateRef.current;
    if (!current || current.status !== 'playing') return;

    try {
      setError(null);
      // Pre-roll question first
      const { state: questionState, question } = prepareQuestion(current, 'easy', { isPreRoll: true });

      if (question) {
        setGameState(questionState);
        setShownQuestion(question);
        setQuestionFeedback(null);
        setAnswerProcessing(false);
        answerLockedRef.current = false;
      } else {
        // No questions left, roll directly
        const { state: rolledState, diceValues: dv, total, modifier } = rollDice(current);
        setGameState(rolledState);
        setIsRolling(true);
        window.setTimeout(() => {
          setDiceValues(dv);
          setDiceTotal(total);
          setLastRollInfo({ playerName: rolledState.players[rolledState.currentTurnIndex]?.name || '', diceValues: dv, total, modifier });
          setIsRolling(false);
          if (total <= 0) {
            endTurnLocal(rolledState);
          }
        }, 1250);
        setHasRolledThisTurn(true);
        setCanMoveAfterRoll(total > 0);
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi lắc xúc xắc');
    }
  }, [setGameState, setShownQuestion]);

  // After pre-roll question answered → actually roll
  const doActualRoll = useCallback((currentGS) => {
    try {
      const { state: rolledState, diceValues: dv, total, modifier } = rollDice(currentGS);
      setGameState(rolledState);
      setIsRolling(true);
      window.setTimeout(() => {
        setDiceValues(dv);
        setDiceTotal(total);
        setLastRollInfo({ playerName: rolledState.players[rolledState.currentTurnIndex]?.name || '', diceValues: dv, total, modifier });
        setIsRolling(false);
        if (total <= 0) {
          endTurnLocal(rolledState);
        }
      }, 1250);
      setHasRolledThisTurn(true);
      setCanMoveAfterRoll(total > 0);
    } catch (err) {
      setError(err.message || 'Lỗi khi lắc xúc xắc');
    }
  }, [setGameState]);

  // ── End Turn ────────────────────────────────────────────────
  const endTurnLocal = useCallback((currentGS) => {
    const gs = currentGS || gameStateRef.current;
    if (!gs) return;

    const newState = nextTurn(gs);
    setGameState(newState);
    setDiceValues(null);
    setDiceTotal(null);
    setIsRolling(false);
    setHasRolledThisTurn(false);
    setCanMoveAfterRoll(false);
    setShownQuestion(null);
    setQuestionFeedback(null);
    setAnswerProcessing(false);
    setRewardChoiceLoading(false);
    setPendingRewardChoices(null);
    setRewardChoicePhase('select');
    setSelectedRewardChoice(null);
    setPendingTargetReward(null);
    setPendingTrapReward(null);
    setRewardNotice(null);
    setBoardNotice(null);
    eventSequenceRef.current = { active: false, step: 0, correctCount: 0 };
    setEventProgress({ active: false, step: 0, correctCount: 0, total: EVENT_QUESTION_SEQUENCE.length });
    boardMovingRef.current = false;
    pendingEventCellRef.current = null;
    answerLockedRef.current = false;

    if (newState.status === 'finished') {
      finalizeGame();
    }
  }, [setGameState, setShownQuestion, finalizeGame]);

  // ── Move Player ─────────────────────────────────────────────
  const handleMoveAfterRoll = useCallback(() => {
    if (!canMoveAfterRoll || diceTotal == null || diceTotal <= 0) return;
    const current = gameStateRef.current;
    if (!current) return;

    try {
      setCanMoveAfterRoll(false);
      const { state: movedState, triggeredTrap, landedOnEvent } = movePlayer(current, diceTotal);
      setGameState(movedState);

      const movedPlayerIndex = current.currentTurnIndex;
      const movedPlayer = movedState.players[movedPlayerIndex];

      if (triggeredTrap) {
        const isTrapPlayer = true; // In local mode, host controls everyone
        if (isTrapPlayer) {
          setBoardNotice({
            type: 'trap',
            title: `${movedPlayer?.name || 'Người chơi'} đã vào ô bẫy!`,
            message: triggeredTrap.traps?.map(t => t.penalty?.name || 'Hình phạt').join(', ') || 'Bị dính bẫy!',
            playerName: movedPlayer?.name || '',
          });
        }
        if (movedState.status === 'finished') {
          finalizeGame();
          return;
        }
        // End turn after trap
        window.setTimeout(() => endTurnLocal(movedState), 2000);
        return;
      }

      if (movedState.status === 'finished') {
        finalizeGame();
        return;
      }

      if (landedOnEvent) {
        const playerName = movedPlayer?.name || 'Người chơi';
        if (boardMovingRef.current) {
          pendingEventCellRef.current = { cellIndex: movedPlayer.position, playerName };
        } else {
          processEventCellLanded(movedPlayer.position, playerName);
        }
        return;
      }

      // Normal cell - end turn
      window.setTimeout(() => endTurnLocal(movedState), 500);
    } catch (err) {
      setError(err.message || 'Lỗi di chuyển');
    }
  }, [canMoveAfterRoll, diceTotal, setGameState, finalizeGame, endTurnLocal, processEventCellLanded]);

  // ── Answer Question ─────────────────────────────────────────
  const handleAnswerSelection = useCallback(async (selectedIndex) => {
    if (!shownQuestion || answerProcessing || answerLockedRef.current) return;
    answerLockedRef.current = true;
    setAnswerProcessing(true);

    const current = gameStateRef.current;
    if (!current) return;

    try {
      const { state: answeredState, isCorrect, correctIndex } = answerQuestion(current, selectedIndex);
      setGameState(answeredState);

      setQuestionFeedback({ selectedIndex: Number(selectedIndex), correctIndex, isCorrect });
      setAnswerProcessing(false);

      if (answerRevealTimerRef.current) window.clearTimeout(answerRevealTimerRef.current);

      // Pre-roll question
      if (shownQuestion?.isPreRoll) {
        answerRevealTimerRef.current = window.setTimeout(() => {
          setShownQuestion(null);
          setQuestionFeedback(null);
          if (isCorrect) {
            doActualRoll(answeredState);
          } else {
            setError('Trả lời sai, mất lượt!');
            endTurnLocal(answeredState);
          }
        }, 1200);
        return;
      }

      // Event sequence
      if (shownQuestion?.isEventSequence) {
        answerRevealTimerRef.current = window.setTimeout(() => {
          const currentStep = Number(shownQuestion.eventStep ?? eventSequenceRef.current.step ?? 0);
          const nextCorrectCount = (eventSequenceRef.current.correctCount || 0) + (isCorrect ? 1 : 0);
          const nextStep = currentStep + 1;

          if (nextStep < EVENT_QUESTION_SEQUENCE.length) {
            eventSequenceRef.current = { active: true, step: nextStep, correctCount: nextCorrectCount };
            setEventProgress({ active: true, step: nextStep, correctCount: nextCorrectCount, total: EVENT_QUESTION_SEQUENCE.length });
            setQuestionFeedback(null);
            showEventQuestion(EVENT_QUESTION_SEQUENCE[nextStep], nextStep);
            return;
          }

          // End of sequence → compute rewards
          eventSequenceRef.current = { active: false, step: currentStep, correctCount: nextCorrectCount };
          setEventProgress({ active: false, step: currentStep, correctCount: nextCorrectCount, total: EVENT_QUESTION_SEQUENCE.length });

          const resolution = resolveEventQuestion(answeredState, nextCorrectCount);
          setGameState(resolution.state);
          setShownQuestion(null);
          setQuestionFeedback(null);

          if (resolution.noReward) {
            setError('Không trả lời đúng câu nào, không có phần thưởng.');
            endTurnLocal(resolution.state);
          } else {
            setPendingRewardChoices({
              choices: resolution.choices,
              difficulty: resolution.rewardDifficulty,
              correctCount: nextCorrectCount,
              isCorrect: true,
              message: `✅ Trả lời đúng ${nextCorrectCount}/3 câu! Chọn 1 phần thưởng.`,
            });
            setRewardChoicePhase('select');
            setSelectedRewardChoice(null);
          }
        }, 1200);
        return;
      }
    } catch (err) {
      setError('Lỗi xử lý câu trả lời: ' + (err.message || ''));
      setAnswerProcessing(false);
    }
  }, [shownQuestion, answerProcessing, setGameState, setShownQuestion, doActualRoll, endTurnLocal, showEventQuestion]);

  // ── Reward Choices ──────────────────────────────────────────
  const handleSelectRewardChoice = useCallback((reward) => {
    if (!reward || rewardChoiceLoading) return;
    if (rewardRevealTimerRef.current) window.clearTimeout(rewardRevealTimerRef.current);

    setSelectedRewardChoice(reward);

    if (reward.type === 'move_target_back' || reward.type === 'force_skip_target') {
      setPendingTargetReward(reward);
      return;
    }

    if (reward.type === 'place_trap') {
      setPendingTrapReward(reward);
      setPendingRewardChoices(null);
      setRewardNotice({
        message: `Chọn 1 ô không phải event để đặt bẫy: ${reward.trapPenalty?.name || reward.name}`,
        playerName: '',
      });
      return;
    }

    // Apply reward immediately
    setRewardChoiceLoading(true);
    try {
      const current = gameStateRef.current;
      const { state: rewardedState, reward: appliedReward } = applyEventChoice(current, reward.id);
      setGameState(rewardedState);

      setRewardChoiceLoading(false);
      setPendingRewardChoices(null);
      setSelectedRewardChoice(appliedReward);
      setRewardNotice({ message: `✅ Nhận: ${appliedReward?.name || 'Phần thưởng'}`, playerName: '' });

      rewardRevealTimerRef.current = window.setTimeout(() => {
        setPendingRewardChoices(null);
        setQuestionFeedback(null);
        setRewardChoicePhase('preview');
        setShuffledRewardChoices([]);
        setSelectedRewardChoice(null);
        setRewardNotice(null);

        if (rewardedState.status === 'finished') {
          finalizeGame();
        } else {
          endTurnLocal(rewardedState);
        }
      }, REWARD_REVEAL_DURATION_MS);
    } catch (err) {
      setRewardChoiceLoading(false);
      setError(err.message || 'Lỗi áp dụng phần thưởng');
    }
  }, [rewardChoiceLoading, setGameState, setShownQuestion, endTurnLocal, finalizeGame]);

  const handleSelectTrapCell = useCallback((cellIndex) => {
    if (!pendingTrapReward || rewardChoiceLoading) return;

    setRewardChoiceLoading(true);
    try {
      const current = gameStateRef.current;
      const { state: rewardedState, placedTrap } = applyEventChoice(current, pendingTrapReward.id, null, cellIndex);
      setGameState(rewardedState);

      setRewardChoiceLoading(false);
      setPendingTrapReward(null);
      setRewardNotice({ message: `🪤 Đã đặt bẫy tại ô ${cellIndex}: ${placedTrap?.penalty?.name || ''}`, playerName: '' });

      rewardRevealTimerRef.current = window.setTimeout(() => {
        setRewardNotice(null);
        endTurnLocal(rewardedState);
      }, REWARD_REVEAL_DURATION_MS);
    } catch (err) {
      setRewardChoiceLoading(false);
      setError(err.message || 'Không thể đặt bẫy tại ô này');
    }
  }, [pendingTrapReward, rewardChoiceLoading, setGameState, endTurnLocal]);

  const handleSelectRewardTarget = useCallback((targetPlayer) => {
    if (!pendingTargetReward || !targetPlayer || rewardChoiceLoading) return;

    setRewardChoiceLoading(true);
    try {
      const current = gameStateRef.current;
      const targetId = targetPlayer.playerId || targetPlayer.name;
      const { state: rewardedState, reward: appliedReward } = applyEventChoice(current, pendingTargetReward.id, targetId);
      setGameState(rewardedState);

      setRewardChoiceLoading(false);
      setPendingTargetReward(null);
      setPendingRewardChoices(null);
      setRewardNotice({ message: `✅ Áp dụng: ${appliedReward?.name || ''} lên ${targetPlayer.name}`, playerName: '' });

      rewardRevealTimerRef.current = window.setTimeout(() => {
        setRewardNotice(null);
        endTurnLocal(rewardedState);
      }, REWARD_REVEAL_DURATION_MS);
    } catch (err) {
      setRewardChoiceLoading(false);
      setError(err.message || 'Lỗi áp dụng');
    }
  }, [pendingTargetReward, rewardChoiceLoading, setGameState, endTurnLocal]);

  const handleShuffleRewardChoices = useCallback(() => {
    if (!pendingRewardChoices?.choices?.length || rewardChoiceLoading) return;
    const next = [...pendingRewardChoices.choices]
      .map(c => ({ c, s: Math.random() }))
      .sort((a, b) => a.s - b.s)
      .map(x => x.c);
    setShuffledRewardChoices(next);
    setSelectedRewardChoice(null);
    setRewardChoicePhase('select');
  }, [pendingRewardChoices, rewardChoiceLoading]);

  const handleLeaveGame = useCallback(() => {
    resetGame();
    navigate('/');
  }, [resetGame, navigate]);

  // ── Render ──────────────────────────────────────────────────
  if (!gameState) {
    return <div className="game-board"><p>Đang tải trò chơi...</p></div>;
  }

  const players = gameState.players || [];
  const traps = gameState.traps || [];
  const showTrapsOnMap = gameState.showTrapsOnMap ?? true;
  const currentPlayerIndex = gameState.currentTurnIndex || 0;
  const currentPlayer = players[currentPlayerIndex];
  const boardSize = gameState.boardSize || BOARD_SIZE;
  const gameFinished = gameState.status === 'finished';
  const winner = players.find(p => p.finishedRank === 1);
  const mapNoticeMessage = rewardNotice?.message || error || '';
  const isMyTurn = true; // In local mode, it's always "your turn" (host controls all)
  const canViewTurnDetails = true;

  const questionPlayerInfo = shownQuestion?.isEventSequence
    ? `${currentPlayer?.name || 'Người chơi'} đang trả lời - Câu ${(shownQuestion.eventStep || 0) + 1}/${shownQuestion.eventTotal || 3} - Đúng ${eventProgress.correctCount}/3`
    : (shownQuestion ? `${currentPlayer?.name || 'Người chơi'} đang trả lời` : '');

  const rewardTargetOptions = players.filter((p, i) => i !== currentPlayerIndex && !p.finishedRank);
  const trapPlacementActive = !!pendingTrapReward && !rewardChoiceLoading;

  return (
    <div className="game-board">
      <div className="game-container">
        <div className="game-header">
          <h1>🎲 {roomName || 'Trò Chơi'}</h1>
          <div className="game-status">
            <span className="current-turn">
              📍 Lượt của: <strong>{currentPlayer?.character?.emoji} {currentPlayer?.name || 'N/A'}</strong>
            </span>
            <>
              <button
                className={`host-trap-visibility-btn ${showTrapsOnMap ? 'active' : ''}`}
                type="button"
                onClick={handleToggleTrapVisibility}
                title={showTrapsOnMap ? 'Ẩn bẫy trên map' : 'Hiện bẫy trên map'}
              >
                {showTrapsOnMap ? '👁' : '🙈'}
              </button>
              <button
                className="host-settings-btn"
                type="button"
                onClick={openPositionEditor}
                title="Chỉnh vị trí người chơi"
              >
                ⚙
              </button>
            </>
          </div>
        </div>

        {/* Position Editor Modal */}
        {positionEditorOpen && (
          <div className="position-editor-overlay" onClick={closePositionEditor}>
            <div className="position-editor-modal" onClick={e => e.stopPropagation()}>
              <div className="position-editor-head">
                <div>
                  <h2>Chỉnh Vị Trí Người Chơi</h2>
                  <p>Nhập vị trí từ 0 đến {boardSize - 1}</p>
                </div>
                <button className="position-editor-close" onClick={closePositionEditor} disabled={positionSaving}>×</button>
              </div>
              <div className="position-editor-list">
                {players.map((player, index) => {
                  const key = player.playerId || player.name || String(index);
                  return (
                    <label className="position-editor-row" key={key}>
                      <span className="position-editor-player">
                        <strong>{player.character?.emoji} {player.name}</strong>
                        <small>Hiện tại: {player.position || 0}</small>
                      </span>
                      <input
                        type="number" min="0" max={boardSize - 1}
                        value={positionDrafts[key] ?? player.position ?? 0}
                        onChange={e => handlePositionDraftChange(key, e.target.value)}
                        disabled={positionSaving}
                      />
                    </label>
                  );
                })}
              </div>
              <div className="position-editor-actions">
                <button className="position-editor-cancel" onClick={closePositionEditor} disabled={positionSaving}>Hủy</button>
                <button className="position-editor-save" onClick={handleSavePlayerPositions} disabled={positionSaving}>
                  {positionSaving ? 'Đang lưu...' : 'Lưu vị trí'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Question & Reward Modals */}
        {canViewTurnDetails && (
          <>
            <QuestionModal
              visible={!!boardNotice && !shownQuestion && !pendingRewardChoices}
              mode="notice"
              noticeTitle={boardNotice?.title}
              noticeMessage={boardNotice?.message}
              playerInfo={boardNotice?.type === 'event' && boardNotice?.canStartQuestion ? 'Bấm xác nhận để bắt đầu!' : ''}
              confirmText="Xác nhận"
              showConfirm={!!boardNotice?.canStartQuestion || boardNotice?.type === 'trap'}
              onConfirm={handleConfirmBoardNotice}
            />

            <QuestionModal
              visible={!!shownQuestion}
              question={shownQuestion}
              revealAnswer={!!questionFeedback}
              selectedAnswerIndex={questionFeedback?.selectedIndex ?? null}
              correctAnswerIndex={questionFeedback?.correctIndex ?? null}
              feedbackText={questionFeedback ? (questionFeedback.isCorrect ? '✅ Đúng rồi!' : '❌ Sai rồi!') : ''}
              feedbackTone={questionFeedback?.isCorrect ? 'correct' : 'wrong'}
              onAnswer={handleAnswerSelection}
              disabled={answerProcessing}
              playerInfo={questionPlayerInfo}
            />

            <QuestionModal
              visible={!!pendingRewardChoices && !pendingTargetReward}
              mode="rewardChoice"
              rewardOptions={pendingRewardChoices?.choices || []}
              rewardTitle={pendingRewardChoices?.isCorrect ? 'Chọn 1 trong 3 phần thưởng' : 'Chọn 1 trong 3 hình phạt'}
              rewardHint={pendingRewardChoices?.message || ''}
              playerInfo={`${currentPlayer?.name || 'Người chơi'} chọn phần thưởng`}
              onSelectReward={handleSelectRewardChoice}
              onShuffleRewardChoices={handleShuffleRewardChoices}
              rewardChoicePhase={rewardChoicePhase}
              selectedRewardChoice={selectedRewardChoice}
              rewardDifficulty={pendingRewardChoices?.difficulty}
              disabled={rewardChoiceLoading}
            />

            <QuestionModal
              visible={!!pendingTargetReward}
              mode="targetChoice"
              targetOptions={rewardTargetOptions}
              targetTitle={pendingTargetReward?.type === 'force_skip_target'
                ? 'Chọn người chơi bị mất lượt'
                : `Chọn người chơi bị lùi ${pendingTargetReward?.value || ''} bước`}
              targetHint={pendingTargetReward?.name || ''}
              onSelectTarget={handleSelectRewardTarget}
              disabled={rewardChoiceLoading}
            />
          </>
        )}

        {gameFinished && (
          <div className="winner-message">
            🏁 Trò chơi kết thúc! {winner ? `Người thắng: ${winner.character?.emoji} ${winner.name}` : 'Đã kết thúc!'}
          </div>
        )}

        <div className="game-content">
          <div className="board-section">
            <div className="board-overlay-shell">
              {mapNoticeMessage && (
                <div className="error-message map-error-message">{mapNoticeMessage}</div>
              )}

              {/* Players Panel */}
              <div className={`players-info-section ${isPlayersPanelCollapsed ? 'collapsed' : ''}`}>
                <div
                  className="players-panel-toggle"
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsPlayersPanelCollapsed(p => !p)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsPlayersPanelCollapsed(p => !p); } }}
                  aria-expanded={!isPlayersPanelCollapsed}
                >
                  <div className="players-panel-title-row">
                    <h3>👥 Người Chơi</h3>
                    <span className="players-panel-toggle-icon">{isPlayersPanelCollapsed ? '›' : '‹'}</span>
                  </div>

                  {!isPlayersPanelCollapsed && (
                    <div className="players-info">
                      {players.map((player, idx) => (
                        <div
                          key={player.playerId || player.name || idx}
                          className={`player-info-card ${idx === currentPlayerIndex ? 'current' : ''} ${player.finishedRank ? 'finished' : ''}`}
                        >
                          <div className="player-header">
                            <span className="player-name">{player.character?.emoji} {player.name}</span>
                            {idx === currentPlayerIndex && <span className="turn-indicator">🔄</span>}
                          </div>
                          <div className="player-stats">
                            {player.finishedRank > 0 && (
                              <span className="player-finished-badge">Hạng #{player.finishedRank}</span>
                            )}
                            {Number(player.shieldCount || 0) > 0 && (
                              <span className="player-shield-badge">🛡 {player.shieldCount}</span>
                            )}
                            {Number(player.skipTurns || 0) > 0 && (
                              <span className="player-skip-badge">⏭ Mất {player.skipTurns} lượt</span>
                            )}
                            <p>Vị trí: {player.position}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Board
                players={players}
                currentPlayerIndex={currentPlayerIndex}
                boardSize={boardSize}
                traps={traps}
                showTraps={showTrapsOnMap}
                trapPlacement={{ active: trapPlacementActive }}
                onSelectTrapCell={handleSelectTrapCell}
                onMovementStart={handleBoardMovementStart}
                onMovementComplete={handleBoardMovementComplete}
              />

              {/* Controls */}
              <div className="control-section map-controls-overlay">
                <Dice
                  onRoll={handleRollDice}
                  values={diceValues}
                  total={diceTotal}
                  modifier={lastRollInfo?.modifier || 0}
                  isRolling={isRolling}
                  disabled={hasRolledThisTurn || gameFinished || !!shownQuestion || !!boardNotice || !!pendingRewardChoices || !!pendingTrapReward || !!pendingTargetReward}
                  showRollButton={true}
                />

                {canMoveAfterRoll && hasRolledThisTurn && diceTotal != null && !gameFinished && (
                  <div className="movement-controls">
                    <p className="dice-result">Lắc được: <strong>{diceTotal}</strong> ô</p>
                    <button className="btn-move" onClick={handleMoveAfterRoll}>
                      🎯 Di Chuyển {currentPlayer?.character?.emoji} {currentPlayer?.name}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="game-footer">
          <button className="btn btn-secondary" onClick={handleLeaveGame}>
            🚪 Rời trò chơi
          </button>
        </div>
      </div>
    </div>
  );
}
