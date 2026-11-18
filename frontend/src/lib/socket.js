import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

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
