import { io, type Socket } from 'socket.io-client'

// Connects directly to notification-service, not proxied through the
// gateway or Vite dev proxy - see the plan's "Deviations" section for why.
const NOTIFICATION_URL = import.meta.env.VITE_NOTIFICATION_SERVICE_URL || 'http://localhost:8003'

let socket: Socket | null = null

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect()
  }
  socket = io(NOTIFICATION_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
  })
  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}

export function joinPatientRoom(patientId: string): void {
  socket?.emit('join-patient-room', { patientId })
}
