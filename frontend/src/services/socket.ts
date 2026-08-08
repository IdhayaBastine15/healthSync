import { io, type Socket } from 'socket.io-client'

// Connects directly to notification-service, not proxied through the
// gateway or Vite dev proxy - see the plan's "Deviations" section for why.
const NOTIFICATION_URL = import.meta.env.VITE_NOTIFICATION_SERVICE_URL || 'http://localhost:8003'

let socket: Socket | null = null

// Consumers (useCriticalAlerts, usePatientRoomEvents) mount independently of
// whichever component happens to call connectSocket() first (useAuth(), on
// login or on reload with a persisted session) - effect order across
// sibling/ancestor components isn't guaranteed, so a listener attached
// before connectSocket() has run would otherwise silently never fire.
// Notifying subscribers here instead of requiring callers to coordinate
// mount order avoids that race.
type SocketListener = (socket: Socket) => void
const readyListeners = new Set<SocketListener>()

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect()
  }
  socket = io(NOTIFICATION_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
  })
  readyListeners.forEach((listener) => listener(socket!))
  return socket
}

export function getSocket(): Socket | null {
  return socket
}

// Calls `listener` immediately if a socket already exists, and again every
// time connectSocket() creates a new one (e.g. token refresh, re-login).
// Returns an unsubscribe function.
export function onSocketReady(listener: SocketListener): () => void {
  if (socket) listener(socket)
  readyListeners.add(listener)
  return () => readyListeners.delete(listener)
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}

export function joinPatientRoom(patientId: string): void {
  socket?.emit('join-patient-room', { patientId })
}
