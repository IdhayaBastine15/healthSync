const express = require("express");
const http = require("http");
const Redis = require("ioredis");
const config = require("./config");
const healthRouter = require("./health");
const { createSocketServer } = require("./sockets/io");
const { runConsumer } = require("./streams/consumer");

const app = express();
app.use(healthRouter);

const server = http.createServer(app);
const redis = new Redis(config.redisUrl);
const consumerRedis = new Redis(config.redisUrl);

const io = createSocketServer(server, redis);

const controller = new AbortController();
runConsumer(consumerRedis, io, { signal: controller.signal }).catch((err) => {
  console.error("notification-service consumer loop crashed", err);
});

server.listen(config.port, () => {
  console.log(`notification-service listening on ${config.port}`);
});

process.on("SIGTERM", () => {
  controller.abort();
  server.close(() => process.exit(0));
});

module.exports = { app, server, io };
