// Game constants
export const BOARD_SIZE = 68;
export const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];
export const DICE_FACES = [1, 2, 3, 4, 5, 6];
export const EVENT_CELL_INDEXES = [3, 5, 7, 9, 13, 16, 18, 20, 22, 26, 28, 30, 33, 34, 37, 39, 41, 43, 46, 49, 52, 53, 54, 57, 59, 63, 64];

export const ROOM_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

export const PLAYER_ROLES = {
  PLAYER: 'player',
  SPECTATOR: 'spectator'
};

export const MAX_PLAYERS_PER_ROOM = 5;

export const SOCKET_EVENTS = {
  JOIN_ROOM: 'joinRoom',
  JOIN_AS_SPECTATOR: 'joinAsSpectator',
  SET_READY: 'setReady',
  START_GAME: 'startGame',
  ROLL_DICE: 'rollDice',
  MOVE_PLAYER: 'movePlayer',
  END_TURN: 'endTurn',
  GET_GAME_STATE: 'getGameState',
  LEAVE_ROOM: 'leaveRoom',
  LEAVE_AS_SPECTATOR: 'leaveAsSpectator',
  PLAYER_JOINED: 'playerJoined',
  SPECTATOR_JOINED: 'spectatorJoined',
  GAME_STARTED: 'gameStarted',
  DICE_ROLLED: 'diceRolled',
  PLAYER_MOVED: 'playerMoved',
  TURN_ENDED: 'turnEnded',
  PLAYER_LEFT: 'playerLeft',
  SPECTATOR_LEFT: 'spectatorLeft',
  PLAYER_READY_CHANGED: 'playerReadyChanged',
  SHOW_QUESTION: 'showQuestion',
  QUESTION_ANSWER_REVEALED: 'questionAnswerRevealed',
  EVENT_CELL_LANDED: 'eventCellLanded',
  RESOLVE_EVENT_QUESTION: 'resolveEventQuestion',
  EVENT_REWARD_CHOICES: 'eventRewardChoices',
  EVENT_REWARD_SHUFFLED: 'eventRewardShuffled',
  EVENT_ACTION_PREVIEW: 'eventActionPreview',
  CHOOSE_EVENT_REWARD: 'chooseEventReward',
  EVENT_REWARD_APPLIED: 'eventRewardApplied',
  UPDATE_PLAYER_POSITIONS: 'updatePlayerPositions',
  PLAYER_POSITIONS_UPDATED: 'playerPositionsUpdated',
  ERROR: 'error',
  GAME_STATE: 'gameState'
};

export const API_ENDPOINTS = {
  ROOMS: '/api/rooms',
  ROOM_BY_ID: (id) => `/api/rooms/${id}`,
  CREATE_ROOM: '/api/rooms',
  JOIN_ROOM: (id) => `/api/rooms/${id}/join`,
  START_ROOM: (id) => `/api/rooms/${id}/start`,
  END_ROOM: (id) => `/api/rooms/${id}/end`,
  LEAVE_ROOM: (id) => `/api/rooms/${id}/leave`,
  ADD_SPECTATOR: (id) => `/api/rooms/${id}/spectators`,
  REMOVE_SPECTATOR: (id) => `/api/rooms/${id}/spectators/leave`,
  SET_READY: (id) => `/api/rooms/${id}/ready`,
  COMPLETE_ROOM: (id) => `/api/rooms/${id}/complete`,
  SERVER_CONFIG: '/server-config'
};

export const ANIMATION_DURATION = 500;
