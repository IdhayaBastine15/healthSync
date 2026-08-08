const pinoHttp = require("pino-http");

module.exports = pinoHttp({
  autoLogging: {
    ignore: (req) => req.url === "/health" || req.url === "/metrics",
  },
});
