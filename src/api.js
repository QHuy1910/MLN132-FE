import { API_ENDPOINTS } from './constants.js';

const ENV_SERVER_URL = import.meta.env.VITE_API_BASE_URL;
let SERVER_URL = ENV_SERVER_URL || 'http://localhost:3000';
let hasServerConfigAttempted = false;

const joinBaseAndPath = (base, path) => `${String(base).replace(/\/$/, '')}${path}`;

const fetchConfig = async (url) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    const bodyText = await response.text();

    if (!contentType.includes('application/json') && !bodyText.trim().startsWith('{')) {
      return null;
    }

    try {
      return JSON.parse(bodyText);
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

// Detect server URL from config endpoint
export const initServerUrl = async () => {
  if (hasServerConfigAttempted) return SERVER_URL;
  hasServerConfigAttempted = true;

  const candidates = ENV_SERVER_URL
    ? [joinBaseAndPath(SERVER_URL, API_ENDPOINTS.SERVER_CONFIG)]
    : [API_ENDPOINTS.SERVER_CONFIG, joinBaseAndPath(SERVER_URL, API_ENDPOINTS.SERVER_CONFIG)];

  for (const candidate of candidates) {
    const data = await fetchConfig(candidate);
    if (data?.serverUrl) {
      SERVER_URL = data.serverUrl;
      break;
    }
  }

  return SERVER_URL;
};

const apiCall = async (endpoint, options = {}) => {
  const url = `${SERVER_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const api = {
  // Rooms
  async getRooms() {
    return apiCall(API_ENDPOINTS.ROOMS);
  },

  async getRoomById(id) {
    return apiCall(API_ENDPOINTS.ROOM_BY_ID(id));
  },

  async createRoom(name, host, maxPlayers = 4, character) {
    return apiCall(API_ENDPOINTS.CREATE_ROOM, {
      method: 'POST',
      body: JSON.stringify({ name, host, maxPlayers, character })
    });
  },

  async joinRoom(roomId, name, character) {
    return apiCall(API_ENDPOINTS.JOIN_ROOM(roomId), {
      method: 'POST',
      body: JSON.stringify({ name, character })
    });
  },

  async joinAsSpectator(roomId, name) {
    return apiCall(API_ENDPOINTS.ADD_SPECTATOR(roomId), {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  async startRoom(roomId) {
    return apiCall(API_ENDPOINTS.START_ROOM(roomId), {
      method: 'POST'
    });
  },

  async endRoom(roomId) {
    return apiCall(API_ENDPOINTS.END_ROOM(roomId), {
      method: 'POST'
    });
  },

  async leaveRoom(roomId, name) {
    return apiCall(API_ENDPOINTS.LEAVE_ROOM(roomId), {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  async removeSpectator(roomId, name) {
    return apiCall(API_ENDPOINTS.REMOVE_SPECTATOR(roomId), {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  async setPlayerReady(roomId, name, isReady) {
    return apiCall(API_ENDPOINTS.SET_READY(roomId), {
      method: 'POST',
      body: JSON.stringify({ name, isReady })
    });
  },

  async completeRoom(roomId) {
    return apiCall(API_ENDPOINTS.COMPLETE_ROOM(roomId), {
      method: 'POST'
    });
  }
};

export const getServerUrl = () => SERVER_URL;
