import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from './api.js';
import { useGame } from './GameContext.jsx';
import { getSocket } from './socket.js';
import { SOCKET_EVENTS, PLAYER_ROLES, BOARD_SIZE } from './constants.js';
import Board from './Board.jsx';
import Dice from './Dice.jsx';
import QuestionModal from './QuestionModal.jsx';
import easyQuestions from './data/easyQuestions.json';
import mediumQuestions from './data/mediumQuestions.json';
import hardQuestions from './data/hardQuestions.json';
import './GameBoard.css';

const QUESTIONS_BY_DIFFICULTY = {
  easy: easyQuestions,
  medium: mediumQuestions,
  hard: hardQuestions
};

const REWARD_REVEAL_DURATION_MS = 2500;

export default function GameBoard() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const {
    currentRoom,
    setCurrentRoom,
    gameState,
    setGameState,
    playerName,
    playerRole,
    playerCharacter,
    isSpectator,
    shownQuestion,
    setShownQuestion
  } = useGame();

  const [loading, setLoading] = useState(false);
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
  const [rewardChoicePhase, setRewardChoicePhase] = useState('preview');
  const [shuffledRewardChoices, setShuffledRewardChoices] = useState([]);
  const [selectedRewardChoice, setSelectedRewardChoice] = useState(null);
  const [eventDifficultyOpen, setEventDifficultyOpen] = useState(false);
  const [eventCellIndex, setEventCellIndex] = useState(null);
  const [eventQuestionDifficulty, setEventQuestionDifficulty] = useState(null);
  const answerRevealTimerRef = useRef(null);
  const autoMoveTimerRef = useRef(null);
  const rewardRevealTimerRef = useRef(null);
  const eventResolvePendingRef = useRef(false);
  const gameSocketJoinKeyRef = useRef(null);
  const completionStartedRef = useRef(false);
  const navigationTimerRef = useRef(null);
  const socket = getSocket();

  const finalizeGameAndNavigate = useCallback(async () => {
    if (completionStartedRef.current) return;

    completionStartedRef.current = true;
    setGameCompleted(true);

    try {
      const completedRoom = await api.completeRoom(roomId);
      setCurrentRoom(completedRoom);
    } catch (err) {
      console.error('Error completing game:', err);
    } finally {
      navigationTimerRef.current = window.setTimeout(() => {
        navigate(`/ranking/${roomId}`);
      }, 800);
    }
  }, [roomId, navigate, setCurrentRoom]);

  useEffect(() => {
    if (gameState?.status === 'finished' && !gameCompleted) {
      finalizeGameAndNavigate();
    }
  }, [gameState?.status, gameCompleted, finalizeGameAndNavigate]);

  useEffect(() => () => {
    if (navigationTimerRef.current) {
      window.clearTimeout(navigationTimerRef.current);
    }
    if (answerRevealTimerRef.current) {
      window.clearTimeout(answerRevealTimerRef.current);
    }
    if (autoMoveTimerRef.current) {
      window.clearTimeout(autoMoveTimerRef.current);
    }
    if (rewardRevealTimerRef.current) {
      window.clearTimeout(rewardRevealTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    socket.emit(SOCKET_EVENTS.GET_GAME_STATE, { roomId });

    const handleDiceRolled = (data) => {
      const totalSteps = data.total ?? data.diceValue ?? null;
      const rolledValues = data.diceValues || null;

      setIsRolling(true);
      window.setTimeout(() => {
        setDiceValues(rolledValues);
        setDiceTotal(totalSteps);
        setLastRollInfo({
          playerName: data.playerName || 'Người chơi',
          diceValues: rolledValues,
          total: totalSteps
        });
        setIsRolling(false);
      }, 450);
      setHasRolledThisTurn(true);
      setCanMoveAfterRoll(true);
    };

    const handlePlayerMoved = (data) => {
      if (autoMoveTimerRef.current) {
        window.clearTimeout(autoMoveTimerRef.current);
      }

      setCurrentRoom(prev => prev ? {
        ...prev,
        players: data.players,
        status: data.status || prev.status
      } : null);

      setGameState(prev => ({
        ...(prev || {}),
        players: data.players,
        status: data.status || prev?.status || 'playing',
        winner: data.winner || prev?.winner || null,
        boardSize: data.boardSize || prev?.boardSize || BOARD_SIZE
      }));

      // Close question modal when player moved
      setShownQuestion(null);
      setCanMoveAfterRoll(false);

      if (data.status === 'finished') {
        finalizeGameAndNavigate();
      }
    };

    const handleEventCellLanded = (data) => {
      setError(null);
      setEventCellIndex(data?.cellIndex ?? null);
      setEventQuestionDifficulty(null);
      setShownQuestion(null);
      setEventDifficultyOpen(true);
    };

    const handleQuestionShown = () => {
      setQuestionFeedback(null);
      setAnswerProcessing(false);
    };

    const handleQuestionAnswerRevealed = (data) => {
      setQuestionFeedback({
        selectedIndex: data?.selectedIndex ?? null,
        correctIndex: data?.correctIndex ?? null,
        isCorrect: !!data?.isCorrect
      });
      setAnswerProcessing(false);
    };

    const handleEventRewardShuffled = (data) => {
      if (!data?.choices?.length) return;

      if (rewardRevealTimerRef.current) {
        window.clearTimeout(rewardRevealTimerRef.current);
      }

      setShuffledRewardChoices(data.choices);
      setSelectedRewardChoice(null);
      setRewardChoicePhase('select');
      setRewardChoiceLoading(false);
    };

    const handleEventRewardChoices = (data) => {
      eventResolvePendingRef.current = false;
      if (rewardRevealTimerRef.current) {
        window.clearTimeout(rewardRevealTimerRef.current);
      }

      if (data?.players) {
        setCurrentRoom(prev => prev ? {
          ...prev,
          players: data.players,
          status: data.status || prev.status
        } : null);

        setGameState(prev => ({
          ...(prev || {}),
          players: data.players,
          status: data.status || prev?.status || 'playing',
          winner: data.winner || prev?.winner || null
        }));
      }

      if (data?.message) {
        setError(data.message);
      }

      setPendingRewardChoices({
        choices: data?.choices || [],
        difficulty: data?.difficulty || eventQuestionDifficulty,
        isCorrect: !!data?.isCorrect,
        message: data?.message || ''
      });
      setRewardChoicePhase('preview');
      setShuffledRewardChoices([]);
      setSelectedRewardChoice(null);
      setRewardNotice(null);

      setShownQuestion(null);
      setEventQuestionDifficulty(null);
      setEventDifficultyOpen(false);
      setAnswerProcessing(false);
      setQuestionFeedback(null);
    };

    const handleEventRewardApplied = (data) => {
      if (data?.players) {
        setCurrentRoom(prev => prev ? {
          ...prev,
          players: data.players,
          status: data.status || prev.status
        } : null);

        setGameState(prev => ({
          ...(prev || {}),
          players: data.players,
          status: data.status || prev?.status || 'playing',
          winner: data.winner || prev?.winner || null
        }));
      }

      if (data?.message) {
        if (isSpectator || data?.playerName === playerName) {
          setRewardNotice({
            message: data.message,
            playerName: data?.playerName || ''
          });
        } else {
          setRewardNotice(null);
        }
      }

      setRewardChoiceLoading(false);
      if (data?.reward) {
        setSelectedRewardChoice(data.reward);
        setRewardChoicePhase('select');
        setShuffledRewardChoices(prev => prev.length ? prev : [data.reward]);
      }

      if (rewardRevealTimerRef.current) {
        window.clearTimeout(rewardRevealTimerRef.current);
      }

      rewardRevealTimerRef.current = window.setTimeout(() => {
        setPendingRewardChoices(null);
        setQuestionFeedback(null);
        setRewardChoicePhase('preview');
        setShuffledRewardChoices([]);
        setSelectedRewardChoice(null);
        setRewardNotice(null);
      }, REWARD_REVEAL_DURATION_MS);
    };

    const handleTurnEnded = (data) => {
      if (autoMoveTimerRef.current) {
        window.clearTimeout(autoMoveTimerRef.current);
      }

      setCurrentRoom(prev => prev ? {
        ...prev,
        players: data.players,
        status: data.status || prev.status
      } : null);

      setGameState(prev => ({
        ...(prev || {}),
        currentTurnIndex: data.currentTurnIndex,
        currentPlayer: data.currentPlayer,
        players: data.players,
        hasRolledThisTurn: false,
        status: data.status || prev?.status || 'playing',
        winner: data.winner || prev?.winner || null
      }));

      setDiceValues(null);
      setDiceTotal(null);
      setIsRolling(false);
      setHasRolledThisTurn(false);
      setCanMoveAfterRoll(false);
      // Close question modal when turn ended
      setShownQuestion(null);
      setEventQuestionDifficulty(null);
      setEventDifficultyOpen(false);
      setEventCellIndex(null);
      setAnswerProcessing(false);
      setRewardChoiceLoading(false);
      setPendingRewardChoices(null);
      setQuestionFeedback(null);
      setCanMoveAfterRoll(false);
      setRewardChoicePhase('preview');
      setShuffledRewardChoices([]);
      setSelectedRewardChoice(null);

      if (data.status === 'finished') {
        finalizeGameAndNavigate();
      }
    };

    const handleSocketError = (data) => {
      eventResolvePendingRef.current = false;
      setError(data?.message || 'Lỗi socket');
      setIsRolling(false);
      setLoading(false);
      setAnswerProcessing(false);
      setRewardChoiceLoading(false);
      setQuestionFeedback(null);
      setRewardChoicePhase('preview');
      setShuffledRewardChoices([]);
      setSelectedRewardChoice(null);
    };

    socket.on(SOCKET_EVENTS.DICE_ROLLED, handleDiceRolled);
    socket.on(SOCKET_EVENTS.SHOW_QUESTION, handleQuestionShown);
    socket.on(SOCKET_EVENTS.PLAYER_MOVED, handlePlayerMoved);
    socket.on(SOCKET_EVENTS.EVENT_CELL_LANDED, handleEventCellLanded);
    socket.on(SOCKET_EVENTS.QUESTION_ANSWER_REVEALED, handleQuestionAnswerRevealed);
    socket.on(SOCKET_EVENTS.EVENT_REWARD_CHOICES, handleEventRewardChoices);
    socket.on(SOCKET_EVENTS.EVENT_REWARD_SHUFFLED, handleEventRewardShuffled);
    socket.on(SOCKET_EVENTS.EVENT_REWARD_APPLIED, handleEventRewardApplied);
    socket.on(SOCKET_EVENTS.TURN_ENDED, handleTurnEnded);
    socket.on(SOCKET_EVENTS.ERROR, handleSocketError);

    return () => {
      socket.off(SOCKET_EVENTS.DICE_ROLLED, handleDiceRolled);
      socket.off(SOCKET_EVENTS.SHOW_QUESTION, handleQuestionShown);
      socket.off(SOCKET_EVENTS.PLAYER_MOVED, handlePlayerMoved);
      socket.off(SOCKET_EVENTS.EVENT_CELL_LANDED, handleEventCellLanded);
      socket.off(SOCKET_EVENTS.QUESTION_ANSWER_REVEALED, handleQuestionAnswerRevealed);
      socket.off(SOCKET_EVENTS.EVENT_REWARD_CHOICES, handleEventRewardChoices);
      socket.off(SOCKET_EVENTS.EVENT_REWARD_SHUFFLED, handleEventRewardShuffled);
      socket.off(SOCKET_EVENTS.EVENT_REWARD_APPLIED, handleEventRewardApplied);
      socket.off(SOCKET_EVENTS.TURN_ENDED, handleTurnEnded);
      socket.off(SOCKET_EVENTS.ERROR, handleSocketError);
    };
  }, [roomId, socket, navigate, setCurrentRoom, setGameState, finalizeGameAndNavigate, isSpectator, playerName]);

  useEffect(() => {
    if (!roomId || !playerName || !currentRoom) return;

    const rejoinSocketRoom = () => {
      const joinKey = `${socket.id || 'pending'}-${roomId}-${playerName}-${playerRole}`;

      if (isSpectator) {
        const spectator = currentRoom.spectators?.find((item) => item.name === playerName);
        socket.emit(SOCKET_EVENTS.JOIN_AS_SPECTATOR, {
          roomId,
          name: playerName,
          spectatorId: spectator?.spectatorId
        });
      } else {
        const player = currentRoom.players?.find((item) => item.name === playerName);
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
          roomId,
          name: playerName,
          playerId: player?.playerId,
          character: playerCharacter || player?.character
        });
      }

      socket.emit(SOCKET_EVENTS.GET_GAME_STATE, { roomId });
      gameSocketJoinKeyRef.current = joinKey;
    };

    socket.on('connect', rejoinSocketRoom);
    const currentJoinKey = `${socket.id || 'pending'}-${roomId}-${playerName}-${playerRole}`;
    if (socket.connected && gameSocketJoinKeyRef.current !== currentJoinKey) {
      rejoinSocketRoom();
    }

    return () => {
      socket.off('connect', rejoinSocketRoom);
    };
  }, [socket, roomId, playerName, playerRole, playerCharacter, isSpectator, currentRoom]);

  const handleRollDice = async () => {
    try {
      setError(null);
      // Show a random (easy) question first — player must answer before roll
      const pool = QUESTIONS_BY_DIFFICULTY.easy || [];
      if (!pool.length) {
        // fallback to server roll if no questions
        socket.emit(SOCKET_EVENTS.ROLL_DICE, { roomId });
        return;
      }

      const q = pool[Math.floor(Math.random() * pool.length)];
      // Mark this question as a pre-roll question so it's handled differently
      const preRollQuestion = { ...q, isPreRoll: true };
      setQuestionFeedback(null);
      setAnswerProcessing(false);
      setShownQuestion(preRollQuestion);
      socket.emit(SOCKET_EVENTS.SHOW_QUESTION, { roomId, question: preRollQuestion });
    } catch (err) {
      setError('Lỗi khi chuẩn bị câu hỏi');
    }
  };

  const handleMoveAfterRoll = () => {
    if (!isMyTurn || !canMoveAfterRoll || diceTotal == null || gameFinished) return;

    setCanMoveAfterRoll(false);
    socket.emit(SOCKET_EVENTS.MOVE_PLAYER, { roomId, steps: diceTotal });
  };

  const handleSelectDifficulty = (difficulty) => {
    const questionPool = QUESTIONS_BY_DIFFICULTY[difficulty] || [];
    if (!questionPool.length) {
      setError('Không tìm thấy câu hỏi cho mức độ này');
      return;
    }

    const randomQuestion = questionPool[Math.floor(Math.random() * questionPool.length)];
    const questionWithDifficulty = {
      ...randomQuestion,
      difficulty
    };

    setEventQuestionDifficulty(difficulty);
    setEventDifficultyOpen(false);
    setQuestionFeedback(null);
    setAnswerProcessing(false);
    setShownQuestion(questionWithDifficulty);

    socket.emit(SOCKET_EVENTS.SHOW_QUESTION, { roomId, question: questionWithDifficulty });
  };

  // Called when player selects an answer in the modal
  const handleAnswerSelection = async (selectedIndex) => {
    if (!shownQuestion || answerProcessing) return;
    setAnswerProcessing(true);

    try {
      const correct = selectedIndex === shownQuestion.correctAnswer;
      setQuestionFeedback({
        selectedIndex,
        correctIndex: shownQuestion.correctAnswer,
        isCorrect: correct
      });

      socket.emit(SOCKET_EVENTS.QUESTION_ANSWER_REVEALED, {
        roomId,
        selectedIndex,
        correctIndex: shownQuestion.correctAnswer,
        isCorrect: correct
      });

      if (answerRevealTimerRef.current) {
        window.clearTimeout(answerRevealTimerRef.current);
      }

      // Pre-roll question flow: only questions explicitly marked with isPreRoll
      if (shownQuestion?.isPreRoll) {
        answerRevealTimerRef.current = window.setTimeout(() => {
          if (correct) {
            socket.emit(SOCKET_EVENTS.ROLL_DICE, { roomId });
          } else {
            socket.emit(SOCKET_EVENTS.END_TURN, { roomId });
            setError('Trả lời sai, mất lượt.');
          }
          setShownQuestion(null);
          setQuestionFeedback(null);
          setAnswerProcessing(false);
        }, 1100);
        return;
      }

      // Event question flow: resolve via event API (rewards/penalties)
      if (shownQuestion?.difficulty || eventQuestionDifficulty) {
        const difficulty = shownQuestion?.difficulty || eventQuestionDifficulty;
        answerRevealTimerRef.current = window.setTimeout(() => {
          eventResolvePendingRef.current = true;
          socket.timeout(6000).emit(
            SOCKET_EVENTS.RESOLVE_EVENT_QUESTION,
            {
              roomId,
              difficulty,
              isCorrect: !!correct
            },
            (ackError, response) => {
              if (!eventResolvePendingRef.current) return;

              if (ackError || response?.ok === false) {
                eventResolvePendingRef.current = false;
                setAnswerProcessing(false);
                setError(response?.message || 'Không nhận được phản hồi từ máy chủ. Hãy thử trả lời lại.');
              }
            }
          );
          window.setTimeout(() => {
            if (!eventResolvePendingRef.current) return;

            eventResolvePendingRef.current = false;
            setAnswerProcessing(false);
            setError('Đã gửi câu trả lời nhưng chưa nhận được phần thưởng/phạt. Hãy thử lại.');
          }, 9000);
          setQuestionFeedback(null);
        }, 1100);
      }
    } catch (err) {
      setError('Lỗi xử lý câu trả lời');
      setAnswerProcessing(false);
    }
  };

  const handleLeaveGame = async () => {
    try {
      setLoading(true);
      if (playerRole === PLAYER_ROLES.SPECTATOR) {
        await api.removeSpectator(roomId, playerName);
        socket.emit(SOCKET_EVENTS.LEAVE_AS_SPECTATOR, { roomId, name: playerName });
      } else {
        await api.leaveRoom(roomId, playerName);
        socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId, name: playerName });
      }
      navigate('/');
    } catch (err) {
      setError('Lỗi khi rời trò chơi');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRewardChoice = (reward) => {
    if (!reward || rewardChoiceLoading) return;
    if (rewardRevealTimerRef.current) {
      window.clearTimeout(rewardRevealTimerRef.current);
    }
    setSelectedRewardChoice(reward);
    setRewardChoiceLoading(true);
    socket.emit(SOCKET_EVENTS.CHOOSE_EVENT_REWARD, {
      roomId,
      rewardId: reward.id
    });
  };

  const handleShuffleRewardChoices = () => {
    if (!pendingRewardChoices?.choices?.length || rewardChoiceLoading) return;

    const nextChoices = [...pendingRewardChoices.choices]
      .map((choice) => ({ choice, sort: Math.random() }))
      .sort((left, right) => left.sort - right.sort)
      .map((item) => item.choice);

    setShuffledRewardChoices(nextChoices);
    setSelectedRewardChoice(null);
    setRewardChoicePhase('select');
    socket.emit(SOCKET_EVENTS.EVENT_REWARD_SHUFFLED, {
      roomId,
      choices: nextChoices
    });
  };

  if (!gameState || !currentRoom) {
    return <div className="game-board"><p>Đang tải trò chơi...</p></div>;
  }

  const players = gameState.players || [];
  const currentPlayerIndex = gameState.currentTurnIndex || 0;
  const currentPlayer = players[currentPlayerIndex];
  const isMyTurn = !isSpectator && currentPlayer && currentPlayer.name === playerName;
  const canViewTurnDetails = isMyTurn || isSpectator;
  const mapNoticeMessage = rewardNotice?.message || (canViewTurnDetails ? error : '');
  const boardSize = gameState.boardSize || BOARD_SIZE;
  const gameFinished = gameState.status === 'finished';
  const winner = gameState.winner || players.find((player) => (player.position || 0) >= boardSize - 1);

  return (
    <div className="game-board">
      <div className="game-container">
        <div className="game-header">
          <h1>🎲 {currentRoom.name}</h1>
          <div className="game-status">
            <span className="current-turn">
              {isMyTurn ? '📍 Lượt của bạn' : `📍 Lượt của ${currentPlayer?.name || 'N/A'}`}
            </span>
          </div>
        </div>

        {canViewTurnDetails && (
        <>
          <QuestionModal
              visible={eventDifficultyOpen && !shownQuestion}
              mode="difficulty"
              onClose={() => {
                if (!isMyTurn) {
                  setEventDifficultyOpen(false);
                }
              }}
              onSelectDifficulty={handleSelectDifficulty}
              disabled={!isMyTurn}
              eventCellIndex={eventCellIndex}
              playerInfo={isMyTurn ? '👤 Bạn chọn độ khó' : `📍 ${currentPlayer?.name || 'Người chơi'} đang chọn độ khó`}
          />

          <QuestionModal
              visible={!!shownQuestion}
              question={shownQuestion}
              revealAnswer={!!questionFeedback}
              selectedAnswerIndex={questionFeedback?.selectedIndex ?? null}
              correctAnswerIndex={questionFeedback?.correctIndex ?? null}
              feedbackText={questionFeedback ? (questionFeedback.isCorrect ? 'Đúng rồi, chờ kết quả tiếp theo...' : 'Sai rồi, chờ kết quả tiếp theo...') : ''}
              feedbackTone={questionFeedback?.isCorrect ? 'correct' : 'wrong'}
              onClose={() => {
                if (!isMyTurn) {
                  setShownQuestion(null);
                }
              }}
              onAnswer={handleAnswerSelection}
              disabled={!isMyTurn || answerProcessing}
              playerInfo={shownQuestion && isMyTurn ? '👤 Bạn đang trả lời câu hỏi' : shownQuestion ? `📍 ${currentPlayer?.name || 'Người chơi'} đang trả lời` : ''}
          />

          <QuestionModal
              visible={!!pendingRewardChoices}
              mode="rewardChoice"
              rewardOptions={rewardChoicePhase === 'select' ? shuffledRewardChoices : pendingRewardChoices?.choices || []}
              rewardTitle={pendingRewardChoices?.isCorrect ? 'Chọn 1 trong 3 phần thưởng' : 'Chọn 1 trong 3 hình phạt'}
              rewardHint={rewardChoicePhase === 'preview'
                ? 'Xem kỹ 3 lựa chọn trước, rồi bấm Xáo bài để trộn và úp lại.'
                : pendingRewardChoices?.message || ''}
              playerInfo={isMyTurn ? '👤 Chọn 1 phần quà / hình phạt' : `📍 ${currentPlayer?.name || 'Người chơi'} đang chọn`}
              onSelectReward={handleSelectRewardChoice}
              onShuffleRewardChoices={handleShuffleRewardChoices}
              rewardChoicePhase={rewardChoicePhase}
              selectedRewardChoice={selectedRewardChoice}
              disabled={!isMyTurn || rewardChoiceLoading}
          />
        </>
        )}

        {gameFinished && (
          <div className="winner-message">
            🏁 Trò chơi kết thúc! {winner ? `Người thắng: ${winner.name}` : 'Đã có người về đích'}
          </div>
        )}

        <div className="game-content">
          <div className="board-section">
            <div className="board-overlay-shell">
              {mapNoticeMessage && <div className="error-message map-error-message">{mapNoticeMessage}</div>}
              <div
                className={`players-info-section ${isPlayersPanelCollapsed ? 'collapsed' : ''}`}
              >
                <div
                  className="players-panel-toggle"
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsPlayersPanelCollapsed((prev) => !prev)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setIsPlayersPanelCollapsed((prev) => !prev);
                    }
                  }}
                  aria-expanded={!isPlayersPanelCollapsed}
                  aria-label={isPlayersPanelCollapsed ? 'Mở bảng xếp hạng' : 'Thu nhỏ bảng xếp hạng'}
                >
                  <div className="players-panel-title-row">
                    <h3>👥 Người Chơi</h3>
                    <span className="players-panel-toggle-icon">
                      {isPlayersPanelCollapsed ? '›' : '‹'}
                    </span>
                  </div>

                  {!isPlayersPanelCollapsed && (
                    <div className="players-info">
                      {players.map((player, idx) => {
                        const shieldCount = Number(player.shieldCount || 0);

                        return (
                        <div
                          key={`${player.playerId || player.name || 'player'}-${idx}`}
                          className={`player-info-card ${idx === currentPlayerIndex ? 'current' : ''}`}
                        >
                          <div className="player-header">
                            <span className="player-name">{player.name}</span>
                            {idx === currentPlayerIndex && <span className="turn-indicator">🔄</span>}
                          </div>
                          <div className="player-stats">
                            {shieldCount > 0 && (
                              <span className="player-shield-badge" title={`Khiên: ${shieldCount}`}>
                                🛡 {shieldCount}
                              </span>
                            )}
                            <p>Vị trí: {player.position}</p>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <Board players={players} currentPlayerIndex={currentPlayerIndex} boardSize={boardSize} />

              <div className="control-section map-controls-overlay">
                {(isMyTurn || isSpectator) && (
                  <Dice
                    onRoll={handleRollDice}
                    values={diceValues}
                    total={diceTotal}
                    isRolling={isRolling}
                    disabled={!isMyTurn || hasRolledThisTurn || gameFinished}
                    loading={loading}
                    showRollButton={isMyTurn}
                  />
                )}

                {isMyTurn && canMoveAfterRoll && hasRolledThisTurn && diceTotal != null && (
                  <div className="movement-controls">
                    <p className="dice-result">Bạn lắc được: <strong>{diceTotal}</strong> ô</p>
                    <button
                      className="btn-move"
                      onClick={handleMoveAfterRoll}
                      disabled={!isMyTurn || gameFinished}
                    >
                      Di chuyển
                    </button>
                  </div>
                )}

                {isSpectator && (
                  <div className="spectator-info">
                    <p>👁️ Bạn đang xem trò chơi</p>
                    {lastRollInfo && lastRollInfo.total != null && (
                      <div className="spectator-roll-result">
                        <p>
                          🎲 <strong>{lastRollInfo.playerName}</strong> vừa lắc:
                        </p>
                        <p className="spectator-roll-values">
                          {lastRollInfo.diceValues
                            ? `${lastRollInfo.diceValues[0]} + ${lastRollInfo.diceValues[1]} = ${lastRollInfo.total}`
                            : lastRollInfo.total}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="game-footer">
          <button
            className="btn btn-secondary"
            onClick={handleLeaveGame}
            disabled={loading}
          >
            🚪 Rời trò chơi
          </button>
        </div>
      </div>
    </div>
  );
}
