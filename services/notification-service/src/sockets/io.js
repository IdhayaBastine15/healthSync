const { Server } = require("socket.io");
const config = require("../config");
const { authenticate } = require("../auth");

function createSocketServer(httpServer, redis) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      const payload = await authenticate(redis, token);
      socket.data.user = { sub: payload.sub, roles: payload.roles || [], jti: payload.jti };
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join-patient-room", ({ patientId } = {}) => {
      if (!patientId) return;
      socket.join(`patient:${patientId}`);
      socket.emit("joined", { room: `patient:${patientId}` });
    });

    socket.on("leave-patient-room", ({ patientId } = {}) => {
      if (!patientId) return;
      socket.leave(`patient:${patientId}`);
    });
  });

  return io;
}

module.exports = { createSocketServer };
