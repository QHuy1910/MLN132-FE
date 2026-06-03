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

const EVENT_QUESTION_SEQUENCE = ['easy', 'medium', 'hard'];
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
  const [rewardChoicePhase, setRewardChoicePhase] = useState('select');
  const [shuffledRewardChoices, setShuffledRewardChoices] = useState([]);
  const [selectedRewardChoice, setSelectedRewardChoice] = useState(null);
  const [pendingTargetReward, setPendingTargetReward] = useState(null);
  const [eventDifficultyOpen, setEventDifficultyOpen] = useState(false);
  const [eventCellIndex, setEventCellIndex] = useState(null);
  const [eventQuestionDifficulty, setEventQuestionDifficulty] = useState(null);
  const [eventProgress, setEventProgress] = useState({ active: false, step: 0, correctCount: 0, total: EVENT_QUESTION_SEQUENCE.length });
  const answerRevealTimerRef = useRef(null);
  const autoMoveTimerRef = useRef(null);
  const rewardRevealTimerRef = useRef(null);
  const eventResolvePendingRef = useRef(false);
  const eventSequenceRef = useRef({ active: false, step: 0, correctCount: 0 });
  const answerLockedRef = useRef(false);
  const gameSocketJoinKeyRef = useRef(null);
  const completionStartedRef = useRef(false);
  const navigationTimerRef = useRef(null);
  const gameStateRef = useRef(gameState);
  const boardMovingRef = useRef(false);
  const pendingEventCellRef = useRef(null);
  const socket = getSocket();

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const createEventQuestion = useCallback((difficulty, step) => {
    const questionPool = QUESTIONS_BY_DIFFICULTY[difficulty] || [];
    if (!questionPool.length) {
      return null;
    }

    const randomQuestion = questionPool[Math.floor(Math.random() * questionPool.length)];
    return {
      ...randomQuestion,
      difficulty,
      isEventSequence: true,
      eventStep: step,
      eventTotal: EVENT_QUESTION_SEQUENCE.length
    };
  }, []);

  const showEventQuestion = useCallback((difficulty, step) => {
    const question = createEventQuestion(difficulty, step);
    if (!question) {
      setError('Khong tim thay cau hoi event cho muc nay.');
      return false;
    }

    setQuestionFeedback(null);
    setAnswerProcessing(false);
    answerLockedRef.current = false;
    setShownQuestion(question);
    socket.emit(SOCKET_EVENTS.SHOW_QUESTION, { roomId, question });
    return true;
  }, [createEventQuestion, roomId, socket, setShownQuestion]);

  const processEventCellLanded = useCallback((data) => {
    setError(null);
    setEventCellIndex(data?.cellIndex ?? null);
    setShownQuestion(null);
    setPendingRewardChoices(null);
    setSelectedRewardChoice(null);
    setPendingTargetReward(null);
    setRewardChoicePhase('select');
    eventSequenceRef.current = { active: true, step: 0, correctCount: 0 };
    setEventProgress({ active: true, step: 0, correctCount: 0, total: EVENT_QUESTION_SEQUENCE.length });

    if (!isSpectator && data?.playerName === playerName) {
      showEventQuestion(EVENT_QUESTION_SEQUENCE[0], 0);
    }
  }, [isSpectator, playerName, setShownQuestion, showEventQuestion]);

  const handleBoardMovementStart = useCallback(() => {
    boardMovingRef.current = true;
  }, []);

  const handleBoardMovementComplete = useCallback(() => {
    boardMovingRef.current = false;
    const pendingEventCell = pendingEventCellRef.current;
    pendingEventCellRef.current = null;

    if (pendingEventCell) {
      processEventCellLanded(pendingEventCell);
    }
  }, [processEventCellLanded]);

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
      }, 1250);
      setHasRolledThisTurn(true);
      setCanMoveAfterRoll(true);
    };

    const handlePlayerMoved = (data) => {
      if (autoMoveTimerRef.current) {
        window.clearTimeout(autoMoveTimerRef.current);
      }

      const previousPlayers = gameStateRef.current?.players || [];
      const nextPlayers = data.players || [];
      const hasPositionChange = nextPlayers.some((player, index) => (
        Number(previousPlayers[index]?.position || 0) !== Number(player.position || 0)
      ));

      if (hasPositionChange) {
        boardMovingRef.current = true;
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
      if (boardMovingRef.current) {
        pendingEventCellRef.current = data;
        return;
      }

      processEventCellLanded(data);
    };

    const handleQuestionShown = (data) => {
      answerLockedRef.current = false;
      const question = data?.question;
      if (question?.isEventSequence) {
        const step = Number(question.eventStep || 0);
        eventSequenceRef.current = {
          active: true,
          step,
          correctCount: eventSequenceRef.current.correctCount || 0
        };
        setEventProgress((prev) => ({
          active: true,
          step,
          correctCount: prev.correctCount || 0,
          total: question.eventTotal || EVENT_QUESTION_SEQUENCE.length
        }));
      }
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

      setPendingRewardChoices((prev) => prev ? { ...prev, choices: data.choices } : prev);
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

      if (data?.noReward || !data?.choices?.length) {
        setPendingRewardChoices(null);
        setRewardChoicePhase('select');
        setSelectedRewardChoice(null);
        setPendingTargetReward(null);
        setRewardNotice(null);
        setShownQuestion(null);
        setAnswerProcessing(false);
        setQuestionFeedback(null);
        eventSequenceRef.current = { active: false, step: 0, correctCount: 0 };
        setEventProgress({ active: false, step: 0, correctCount: 0, total: EVENT_QUESTION_SEQUENCE.length });
        return;
      }

      setPendingRewardChoices({
        choices: data?.choices || [],
        difficulty: data?.rewardDifficulty || data?.difficulty,
        correctCount: data?.correctCount || 0,
        isCorrect: true,
        message: data?.message || ''
      });
      setRewardChoicePhase('select');
      setSelectedRewardChoice(null);
      setPendingTargetReward(null);
      setRewardNotice(null);

      setShownQuestion(null);
      setAnswerProcessing(false);
      setQuestionFeedback(null);
      eventSequenceRef.current = { active: false, step: 0, correctCount: 0 };
      setEventProgress({ active: false, step: 0, correctCount: 0, total: EVENT_QUESTION_SEQUENCE.length });
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
      setPendingTargetReward(null);
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
      setEventCellIndex(null);
      setAnswerProcessing(false);
      setRewardChoiceLoading(false);
      setPendingRewardChoices(null);
      setQuestionFeedback(null);
      setCanMoveAfterRoll(false);
      setRewardChoicePhase('select');
      setSelectedRewardChoice(null);
      setPendingTargetReward(null);
      boardMovingRef.current = false;
      pendingEventCellRef.current = null;
      eventSequenceRef.current = { active: false, step: 0, correctCount: 0 };
      setEventProgress({ active: false, step: 0, correctCount: 0, total: EVENT_QUESTION_SEQUENCE.length });

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
      setRewardChoicePhase('select');
      setSelectedRewardChoice(null);
      setPendingTargetReward(null);
      boardMovingRef.current = false;
      pendingEventCellRef.current = null;
      eventSequenceRef.current = { active: false, step: 0, correctCount: 0 };
      setEventProgress({ active: false, step: 0, correctCount: 0, total: EVENT_QUESTION_SEQUENCE.length });
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
  }, [roomId, socket, navigate, setCurrentRoom, setGameState, finalizeGameAndNavigate, processEventCellLanded, setShownQuestion]);

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
      answerLockedRef.current = false;
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
    answerLockedRef.current = false;
    setShownQuestion(questionWithDifficulty);

    socket.emit(SOCKET_EVENTS.SHOW_QUESTION, { roomId, question: questionWithDifficulty });
  };

  // Called when player selects an answer in the modal
  const handleAnswerSelection = async (selectedIndex) => {
    if (!shownQuestion || answerProcessing || answerLockedRef.current) return;
    answerLockedRef.current = true;
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

      if (shownQuestion?.isEventSequence) {
        answerRevealTimerRef.current = window.setTimeout(() => {
          const currentStep = Number(shownQuestion.eventStep || eventSequenceRef.current.step || 0);
          const nextCorrectCount = (eventSequenceRef.current.correctCount || 0) + (correct ? 1 : 0);
          const nextStep = currentStep + 1;

          if (nextStep < EVENT_QUESTION_SEQUENCE.length) {
            eventSequenceRef.current = { active: true, step: nextStep, correctCount: nextCorrectCount };
            setEventProgress({
              active: true,
              step: nextStep,
              correctCount: nextCorrectCount,
              total: EVENT_QUESTION_SEQUENCE.length
            });
            showEventQuestion(EVENT_QUESTION_SEQUENCE[nextStep], nextStep);
            setQuestionFeedback(null);
            setAnswerProcessing(false);
            return;
          }

          eventSequenceRef.current = { active: false, step: currentStep, correctCount: nextCorrectCount };
          setEventProgress({
            active: false,
            step: currentStep,
            correctCount: nextCorrectCount,
            total: EVENT_QUESTION_SEQUENCE.length
          });
          eventResolvePendingRef.current = true;
          setShownQuestion(null);
          socket.timeout(6000).emit(
            SOCKET_EVENTS.RESOLVE_EVENT_QUESTION,
            {
              roomId,
              correctCount: nextCorrectCount
            },
            (ackError, response) => {
              if (!eventResolvePendingRef.current) return;

              if (ackError || response?.ok === false) {
                eventResolvePendingRef.current = false;
                setAnswerProcessing(false);
                setError(response?.message || 'Khong nhan duoc phan hoi tu may chu. Hay thu lai.');
              }
            }
          );
          window.setTimeout(() => {
            if (!eventResolvePendingRef.current) return;

            eventResolvePendingRef.current = false;
            setAnswerProcessing(false);
            setError('Da gui ket qua event nhung chua nhan duoc phan thuong. Hay thu lai.');
          }, 9000);
          setQuestionFeedback(null);
        }, 1100);
        return;
      }

      // Event question flow: resolve via event API (legacy single question)
      if (!shownQuestion?.isEventSequence && (shownQuestion?.difficulty || eventQuestionDifficulty)) {
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
    if (reward.type === 'move_target_back') {
      setPendingTargetReward(reward);
      return;
    }

    setRewardChoiceLoading(true);
    socket.emit(SOCKET_EVENTS.CHOOSE_EVENT_REWARD, {
      roomId,
      rewardId: reward.id
    });
  };

  const handleSelectRewardTarget = (targetPlayer) => {
    if (!pendingTargetReward || !targetPlayer || rewardChoiceLoading) return;

    setRewardChoiceLoading(true);
    socket.emit(SOCKET_EVENTS.CHOOSE_EVENT_REWARD, {
      roomId,
      rewardId: pendingTargetReward.id,
      targetPlayerId: targetPlayer.playerId || targetPlayer.name
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
  const questionPlayerInfo = shownQuestion?.isEventSequence
    ? `${isMyTurn ? 'Ban dang tra loi' : `${currentPlayer?.name || 'Nguoi choi'} dang tra loi`} - Cau ${(shownQuestion.eventStep || 0) + 1}/${shownQuestion.eventTotal || EVENT_QUESTION_SEQUENCE.length} - Dung ${eventProgress.correctCount}/3`
    : (shownQuestion && isMyTurn ? 'Ban dang tra loi cau hoi' : shownQuestion ? `${currentPlayer?.name || 'Nguoi choi'} dang tra loi` : '');
  const rewardTargetOptions = players.filter((player, index) => (
    index !== currentPlayerIndex && !player.finishedRank
  ));

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
              playerInfo={questionPlayerInfo}
          />

          <QuestionModal
              visible={!!pendingRewardChoices}
              mode="rewardChoice"
              rewardOptions={pendingRewardChoices?.choices || []}
              rewardTitle={pendingRewardChoices?.isCorrect ? 'Chọn 1 trong 3 phần thưởng' : 'Chọn 1 trong 3 hình phạt'}
              rewardHint={rewardChoicePhase === 'preview'
                ? 'Xem kỹ 3 lựa chọn trước, rồi bấm Xáo bài để trộn và úp lại.'
                : pendingRewardChoices?.message || ''}
              playerInfo={isMyTurn ? 'Chọn 1 phần thưởng' : `${currentPlayer?.name || 'Người chơi'} đang chọn phần thưởng`}
              onSelectReward={handleSelectRewardChoice}
              onShuffleRewardChoices={handleShuffleRewardChoices}
              rewardChoicePhase={rewardChoicePhase}
              selectedRewardChoice={selectedRewardChoice}
              rewardDifficulty={pendingRewardChoices?.difficulty}
              disabled={!isMyTurn || rewardChoiceLoading}
          />

          <QuestionModal
              visible={!!pendingTargetReward}
              mode="targetChoice"
              targetOptions={rewardTargetOptions}
              targetTitle={`Chon nguoi choi bi lui ${pendingTargetReward?.value || ''} buoc`}
              targetHint={pendingTargetReward?.name || ''}
              onSelectTarget={handleSelectRewardTarget}
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
                        const finishedRank = Number(player.finishedRank || 0);

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
                            {finishedRank > 0 && (
                              <span className="player-finished-badge" title={`Hang ${finishedRank}`}>
                                Hang #{finishedRank}
                              </span>
                            )}
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

              <Board
                players={players}
                currentPlayerIndex={currentPlayerIndex}
                boardSize={boardSize}
                onMovementStart={handleBoardMovementStart}
                onMovementComplete={handleBoardMovementComplete}
              />

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
