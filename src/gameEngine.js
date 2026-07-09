// ============================================================
// GAME ENGINE - Pure frontend, no server/socket needed
// Ported from BE src/services/roomService.js + questionService.js
// ============================================================

import easyQuestions from './data/easyQuestions.json';
import mediumQuestions from './data/mediumQuestions.json';
import hardQuestions from './data/hardQuestions.json';
import rewardsData from './data/rewards.json';
import { EVENT_CELL_INDEXES as EVENT_CELL_INDEXES_ARRAY, BOARD_SIZE as DEFAULT_BOARD_SIZE } from './constants.js';

// Use the shared array from constants, but as a Set for O(1) lookups
export const EVENT_CELL_INDEXES = new Set(EVENT_CELL_INDEXES_ARRAY);
const EVENT_QUESTION_SEQUENCE = ['easy', 'medium', 'hard'];

const QUESTIONS_BY_DIFFICULTY = {
  easy: easyQuestions,
  medium: mediumQuestions,
  hard: hardQuestions,
};

const SUPPORTED_REWARD_TYPES = new Set([
  'move_self', 'move_self_back', 'dice_bonus', 'dice_penalty',
  'shield', 'skip_turn', 'move_target_back', 'move_all_others_back',
  'force_skip_target', 'place_trap'
]);

// ─── Helpers ─────────────────────────────────────────────────
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
const getFinishPosition = (boardSize) => Math.max(0, (boardSize || DEFAULT_BOARD_SIZE) - 1);

// Deep clone to avoid mutation surprises
export const cloneState = (state) => JSON.parse(JSON.stringify(state));

// ─── Game State Creation ──────────────────────────────────────
/**
 * Create initial game state.
 * @param {Array} playerSetups - [{name, character}]
 * @param {number} boardSize
 */
export const createGame = (playerSetups, boardSize = DEFAULT_BOARD_SIZE) => {
  const players = playerSetups.map((p, i) => ({
    playerId: `player-${generateId()}`,
    name: p.name,
    character: p.character,
    position: 0,
    finishedRank: null,
    finishedAt: null,
    pendingDiceModifier: 0,
    shieldCount: 0,
    skipTurns: 0,
    isReady: true,
  }));

  return {
    status: 'playing',
    boardSize: boardSize || DEFAULT_BOARD_SIZE,
    players,
    currentTurnIndex: 0,
    hasRolledThisTurn: false,
    traps: [],
    showTrapsOnMap: true,
    usedQuestionKeys: [],
    activeQuestion: null,
    pendingEventReward: null,
    ranking: [],
    gameStartedAt: new Date().toISOString(),
    gameEndedAt: null,
  };
};

// ─── Turn Management ──────────────────────────────────────────
const getNextTurnIndex = (gameState) => {
  const { players, currentTurnIndex } = gameState;
  if (!players.length) return 0;

  let nextIndex = currentTurnIndex;
  let checks = players.length;

  while (checks > 0) {
    nextIndex = (nextIndex + 1) % players.length;
    const player = players[nextIndex];

    if (player.finishedRank) { checks--; continue; }

    const skip = Number(player.skipTurns || 0);
    if (skip > 0) {
      player.skipTurns = skip - 1;
      checks--;
      continue;
    }

    return nextIndex;
  }

  return nextIndex;
};

export const nextTurn = (gameState) => {
  const state = cloneState(gameState);
  state.currentTurnIndex = getNextTurnIndex(state);
  state.hasRolledThisTurn = false;
  return state;
};

// ─── Dice ─────────────────────────────────────────────────────
export const rollDice = (gameState) => {
  const state = cloneState(gameState);
  if (state.hasRolledThisTurn) throw new Error('Already rolled this turn');

  const currentPlayer = state.players[state.currentTurnIndex];
  const modifier = Number(currentPlayer?.pendingDiceModifier || 0);
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const baseTotal = d1 + d2;
  const total = Math.max(0, baseTotal + modifier);

  if (currentPlayer) currentPlayer.pendingDiceModifier = 0;
  state.hasRolledThisTurn = true;

  return { state, diceValues: [d1, d2], total, modifier };
};

// ─── Player Finish Logic ──────────────────────────────────────
const getFinishedCount = (players) => players.filter(p => p.finishedRank).length;

const markPlayerFinishedIfNeeded = (state, playerIndex) => {
  const player = state.players[playerIndex];
  if (!player || player.finishedRank) return false;
  if ((player.position || 0) < getFinishPosition(state.boardSize)) return false;

  player.finishedRank = getFinishedCount(state.players) + 1;
  player.finishedAt = new Date().toISOString();
  player.skipTurns = 0;
  return true;
};

/**
 * Check if game should end:
 * Game ends when only 1 (or fewer) player has NOT finished.
 * That last player automatically gets last rank.
 */
const checkAndFinalizeGame = (state) => {
  const activePlayers = state.players.filter(p => !p.finishedRank);
  if (activePlayers.length <= 1) {
    // Give last player their rank
    if (activePlayers.length === 1) {
      const lastPlayer = activePlayers[0];
      lastPlayer.finishedRank = getFinishedCount(state.players) + 1;
      lastPlayer.finishedAt = new Date().toISOString();
    }
    state.status = 'finished';
    state.gameEndedAt = new Date().toISOString();
    state.ranking = computeRanking(state);
  }
  return state;
};

// ─── Move Player ──────────────────────────────────────────────
const getTrapsAtPosition = (traps, position) =>
  (Array.isArray(traps) ? traps : []).filter(t => Number(t.cellIndex) === Number(position));

const triggerTrapAtPosition = (state, playerIndex, position) => {
  const triggered = getTrapsAtPosition(state.traps, position);
  if (!triggered.length) return null;

  // Remove triggered traps
  state.traps = state.traps.filter(t => Number(t.cellIndex) !== Number(position));

  const blockedEffects = [];
  const appliedEffects = [];

  triggered.forEach(trap => {
    const result = applyHarmfulEffect(state, playerIndex, trap.penalty);
    if (result?.blocked) {
      blockedEffects.push({ trap, result });
    } else {
      appliedEffects.push({ trap, result });
    }
  });

  return {
    trap: triggered[0],
    traps: triggered,
    appliedEffects,
    blockedEffects,
    playerIndex,
    playerName: state.players[playerIndex]?.name || '',
  };
};

/**
 * Move current player by `steps`.
 * Returns { state, triggeredTrap, landedOnEvent }
 */
export const movePlayer = (gameState, steps) => {
  const state = cloneState(gameState);
  const playerIndex = state.currentTurnIndex;
  const player = state.players[playerIndex];
  const finishPos = getFinishPosition(state.boardSize);

  const currentPos = player.position || 0;
  const newPos = Math.min(currentPos + steps, finishPos);
  player.position = newPos;

  // Check traps
  const pendingTraps = getTrapsAtPosition(state.traps, newPos);
  let triggeredTrap = null;

  if (pendingTraps.length > 0) {
    triggeredTrap = triggerTrapAtPosition(state, playerIndex, newPos);
  }

  // Mark finished
  markPlayerFinishedIfNeeded(state, playerIndex);
  checkAndFinalizeGame(state);

  const landedOnEvent = EVENT_CELL_INDEXES.has(newPos) && state.status === 'playing';

  return { state, triggeredTrap, landedOnEvent };
};

// ─── Questions ────────────────────────────────────────────────
const getQuestionKey = (q, difficulty) => {
  const id = q.id ?? q.question;
  return `${difficulty || q.difficulty || 'easy'}:${id}`;
};

export const pickQuestion = (difficulty, usedQuestionKeys = []) => {
  const pool = QUESTIONS_BY_DIFFICULTY[difficulty] || [];
  const usedSet = new Set(usedQuestionKeys);
  const unused = pool.filter(q => !usedSet.has(getQuestionKey(q, difficulty)));
  if (!unused.length) return null;
  return unused[Math.floor(Math.random() * unused.length)];
};

export const prepareQuestion = (gameState, difficulty, meta = {}) => {
  const state = cloneState(gameState);
  const q = pickQuestion(difficulty, state.usedQuestionKeys);
  if (!q) return { state, question: null };

  const question = {
    ...q,
    difficulty,
    isPreRoll: !!meta.isPreRoll,
    isEventSequence: !!meta.isEventSequence,
    eventStep: meta.eventStep,
    eventTotal: meta.eventTotal,
  };

  const key = getQuestionKey(question, difficulty);
  if (key && !state.usedQuestionKeys.includes(key)) {
    state.usedQuestionKeys.push(key);
  }
  state.activeQuestion = { ...question, correctAnswer: q.correctAnswer };

  // Return public question (no correctAnswer exposed yet)
  const { correctAnswer, ...publicQuestion } = state.activeQuestion;
  return { state, question: publicQuestion };
};

export const answerQuestion = (gameState, selectedIndex) => {
  const state = cloneState(gameState);
  const activeQ = state.activeQuestion;
  if (!activeQ) throw new Error('No active question');

  const correctIndex = Number(activeQ.correctAnswer);
  const selected = Number(selectedIndex);
  const isCorrect = selected === correctIndex;

  state.activeQuestion = null;

  return {
    state,
    isCorrect,
    selectedIndex: selected,
    correctIndex,
    playerName: state.players[state.currentTurnIndex]?.name || '',
  };
};

// ─── Rewards / Event ──────────────────────────────────────────
const getRewardsByDifficulty = (difficulty, isCorrect) => {
  const branch = isCorrect ? 'success' : 'failure';
  return (rewardsData?.[difficulty]?.[branch] || []).filter(item => {
    if (!SUPPORTED_REWARD_TYPES.has(item.type)) return false;
    if (item.type === 'place_trap') return !!item.trapPenalty;
    return true;
  });
};

const pickUniqueRewardChoices = (difficulty, isCorrect, count = 3) => {
  const candidates = [...getRewardsByDifficulty(difficulty, isCorrect)];
  const choices = [];
  const usedGroups = new Set();

  while (candidates.length && choices.length < count) {
    const unique = candidates.filter(r => !usedGroups.has(r.type));
    const pool = unique.length ? unique : candidates;
    const reward = pool[Math.floor(Math.random() * pool.length)];
    const idx = candidates.findIndex(c => c.id === reward.id);
    choices.push(candidates.splice(idx, 1)[0]);
    usedGroups.add(reward.type);
  }

  return choices;
};

/**
 * After event question sequence, compute reward choices.
 * correctCount = how many questions answered correctly (0, 1, 2, 3)
 */
export const resolveEventQuestion = (gameState, correctCount) => {
  const state = cloneState(gameState);
  const currentPlayerIndex = state.currentTurnIndex;

  const rewardDifficulty =
    correctCount >= 3 ? 'hard' :
    correctCount === 2 ? 'medium' :
    correctCount === 1 ? 'easy' : null;

  if (!rewardDifficulty) {
    return {
      state,
      currentPlayerIndex,
      choices: [],
      correctCount,
      rewardDifficulty: null,
      noReward: true,
    };
  }

  const choices = pickUniqueRewardChoices(rewardDifficulty, true, 3);

  state.pendingEventReward = {
    currentPlayerIndex,
    difficulty: rewardDifficulty,
    isCorrect: true,
    correctCount,
    choices,
  };

  return {
    state,
    currentPlayerIndex,
    choices,
    correctCount,
    rewardDifficulty,
    noReward: false,
  };
};

// ─── Apply Effects ────────────────────────────────────────────
const consumeShield = (player) => {
  const shields = Number(player?.shieldCount || 0);
  if (shields <= 0) return false;
  player.shieldCount = shields - 1;
  return true;
};

const applyHarmfulEffect = (state, playerIndex, effect) => {
  const player = state.players[playerIndex];
  if (!player || !effect) return null;

  const blocked = consumeShield(player);
  const result = { blocked, playerIndex, playerName: player.name, effectName: effect.name };
  if (blocked) return result;

  const value = Number(effect.value || 0);
  const finishPos = getFinishPosition(state.boardSize);

  switch (effect.type) {
    case 'move_self_back':
      player.position = clamp((player.position || 0) - value, 0, finishPos);
      break;
    case 'dice_penalty':
      player.pendingDiceModifier = Number(player.pendingDiceModifier || 0) - value;
      break;
    case 'skip_turn':
      player.skipTurns = Number(player.skipTurns || 0) + Math.max(1, value || 1);
      break;
    default:
      break;
  }

  return result;
};

const applyEventEffect = (state, currentPlayerIndex, reward, targetPlayerId = null) => {
  const effectResult = { appliedEffects: [], blockedEffects: [] };
  if (!reward) return effectResult;

  const currentPlayer = state.players[currentPlayerIndex];
  if (!currentPlayer) return effectResult;

  const value = Number(reward.value || 0);
  const finishPos = getFinishPosition(state.boardSize);

  const record = (result) => {
    if (!result) return;
    if (result.blocked) effectResult.blockedEffects.push(result);
    else effectResult.appliedEffects.push(result);
  };

  const getTargetIndex = () => {
    if (!targetPlayerId) return null;
    return state.players.findIndex((p, i) =>
      i !== currentPlayerIndex && !p.finishedRank &&
      (p.playerId === targetPlayerId || p.name === targetPlayerId)
    );
  };

  switch (reward.type) {
    case 'move_self':
      currentPlayer.position = clamp((currentPlayer.position || 0) + value, 0, finishPos);
      break;
    case 'move_self_back':
      record(applyHarmfulEffect(state, currentPlayerIndex, reward));
      break;
    case 'dice_bonus':
      currentPlayer.pendingDiceModifier = Number(currentPlayer.pendingDiceModifier || 0) + value;
      break;
    case 'dice_penalty':
      record(applyHarmfulEffect(state, currentPlayerIndex, reward));
      break;
    case 'shield':
      currentPlayer.shieldCount = Number(currentPlayer.shieldCount || 0) + Math.max(1, value || 1);
      break;
    case 'skip_turn':
      record(applyHarmfulEffect(state, currentPlayerIndex, reward));
      break;
    case 'move_target_back': {
      const ti = getTargetIndex();
      if (ti == null || ti < 0) throw new Error('Vui lòng chọn người chơi để lùi bước');
      record(applyHarmfulEffect(state, ti, { ...reward, type: 'move_self_back' }));
      break;
    }
    case 'move_all_others_back':
      state.players.forEach((_, i) => {
        if (i !== currentPlayerIndex) {
          record(applyHarmfulEffect(state, i, { ...reward, type: 'move_self_back' }));
        }
      });
      break;
    case 'force_skip_target': {
      const ti = getTargetIndex();
      if (ti == null || ti < 0) throw new Error('Vui lòng chọn người chơi bị mất lượt');
      record(applyHarmfulEffect(state, ti, { ...reward, type: 'skip_turn' }));
      break;
    }
    default:
      break;
  }

  return effectResult;
};

/**
 * Place a trap on the board.
 */
const placeTrap = (state, currentPlayerIndex, reward, trapCellIndex) => {
  const cellIndex = Number(trapCellIndex);
  const finishPos = getFinishPosition(state.boardSize);

  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > finishPos) {
    throw new Error('Ô đặt bẫy không hợp lệ');
  }
  if (EVENT_CELL_INDEXES.has(cellIndex)) {
    throw new Error('Không thể đặt bẫy trên ô event');
  }
  if (!reward.trapPenalty) throw new Error('Bẫy chưa có hình phạt');

  const currentPlayer = state.players[currentPlayerIndex];
  const trap = {
    id: `trap-${generateId()}`,
    cellIndex,
    rewardId: reward.id,
    createdByName: currentPlayer?.name || '',
    penalty: reward.trapPenalty,
  };

  state.traps = [...(state.traps || []), trap];
  return trap;
};

/**
 * Apply chosen event reward.
 * Returns { state, reward, placedTrap, appliedEffects, blockedEffects }
 */
export const applyEventChoice = (gameState, rewardId, targetPlayerId = null, trapCellIndex = null) => {
  const state = cloneState(gameState);
  const pending = state.pendingEventReward;
  if (!pending) throw new Error('No pending event reward');

  const currentPlayerIndex = pending.currentPlayerIndex;
  const selectedReward = (pending.choices || []).find(c => c.id === rewardId);
  if (!selectedReward) throw new Error('Invalid reward choice');

  let placedTrap = null;
  let effectResult = { appliedEffects: [], blockedEffects: [] };

  if (selectedReward.type === 'place_trap') {
    placedTrap = placeTrap(state, currentPlayerIndex, selectedReward, trapCellIndex);
  } else {
    effectResult = applyEventEffect(state, currentPlayerIndex, selectedReward, targetPlayerId);
  }

  state.pendingEventReward = null;

  // Check if applying reward caused someone to finish
  state.players.forEach((_, i) => markPlayerFinishedIfNeeded(state, i));
  checkAndFinalizeGame(state);

  return {
    state,
    reward: selectedReward,
    placedTrap,
    appliedEffects: effectResult.appliedEffects || [],
    blockedEffects: effectResult.blockedEffects || [],
    currentPlayerIndex,
  };
};

// ─── Trap Visibility ──────────────────────────────────────────
export const setTrapVisibility = (gameState, show) => {
  const state = cloneState(gameState);
  state.showTrapsOnMap = !!show;
  return state;
};

// ─── Position Editor (host override) ─────────────────────────
export const updatePlayerPositions = (gameState, positionUpdates = []) => {
  const state = cloneState(gameState);
  const finishPos = getFinishPosition(state.boardSize);

  positionUpdates.forEach(update => {
    const idx = state.players.findIndex(p =>
      (update.playerId && p.playerId === update.playerId) ||
      (update.name && p.name === update.name)
    );
    if (idx < 0) return;
    const newPos = clamp(Number(update.position) || 0, 0, finishPos);
    state.players[idx].position = newPos;
    if (newPos < finishPos) {
      state.players[idx].finishedRank = null;
      state.players[idx].finishedAt = null;
    }
  });

  return state;
};

// ─── Ranking Computation ──────────────────────────────────────
export const computeRanking = (gameState) => {
  const sorted = [...gameState.players].sort((a, b) => {
    const ar = Number(a.finishedRank || 0);
    const br = Number(b.finishedRank || 0);
    if (ar && br && ar !== br) return ar - br;
    if (ar && !br) return -1;
    if (!ar && br) return 1;
    if (b.position !== a.position) return b.position - a.position;
    return String(a.name).localeCompare(String(b.name));
  });

  return sorted.map((p, i) => ({
    playerId: p.playerId,
    name: p.name,
    rank: i + 1,
    position: p.position,
    character: p.character,
    finishTime: p.finishedAt || null,
  }));
};

export const EVENT_QUESTION_SEQUENCE_LIST = EVENT_QUESTION_SEQUENCE;
