import { io } from 'socket.io-client';

let SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;
if (SOCKET_URL && !SOCKET_URL.startsWith('http://') && !SOCKET_URL.startsWith('https://') && !SOCKET_URL.startsWith('ws://') && !SOCKET_URL.startsWith('wss://')) {
  SOCKET_URL = `https://${SOCKET_URL}`;
}

let socket = null;

export function connect(token) {
  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    withCredentials: true,
  });

  return socket;
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinRoom(room) {
  if (socket && room) {
    socket.emit('join:room', room);
  }
}

export function on(event, handler) {
  if (socket) {
    socket.on(event, handler);
  }
}

export function off(event, handler) {
  if (socket) {
    socket.off(event, handler);
  }
}

export function getSocket() {
  return socket;
}

export default {
  connect,
  disconnect,
  joinRoom,
  on,
  off,
  getSocket,
};
