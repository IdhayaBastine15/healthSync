// event_type -> how to fan it out over Socket.io. Room name convention
// ('patient:{patient_id}') matches the join-patient-room handler in
// src/sockets/io.js. The envelope is emitted as-is (event name = event_type)
// so the wire contract documented in shared/EVENTS.md is identical whether
// you're an HTTP/audit consumer or a browser client.
const HANDLERS = {
  "lab.result.filed": (io, envelope) => {
    if (envelope.patient_id) {
      io.to(`patient:${envelope.patient_id}`).emit("lab.result.filed", envelope);
    }
  },
  "lab.result.critical": (io, envelope) => {
    // Broadcast to everyone, not just the patient's room - a clinician not
    // currently viewing this patient still needs the critical-alert banner.
    // io.emit() already reaches every connected socket, including anyone in
    // the patient's room, so no separate room emit here - adding one would
    // double-deliver this event to every client that's joined that room.
    io.emit("lab.result.critical", envelope);
  },
  "patient.record.updated": (io, envelope) => {
    if (envelope.patient_id) {
      io.to(`patient:${envelope.patient_id}`).emit("patient.record.updated", envelope);
    }
  },
};

function dispatch(io, eventType, envelope) {
  const handler = HANDLERS[eventType];
  if (!handler) return false;
  handler(io, envelope);
  return true;
}

module.exports = { HANDLERS, dispatch };
