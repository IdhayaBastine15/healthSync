// Single shared Redis connection for the process (blacklist checks in auth
// middleware). Lazily connects on first use, matches the connect-once
// pattern the FastAPI services get for free from redis.asyncio's pooling.
const { createClient } = require("redis");
const config = require("./config");

let client = null;

function getRedisClient() {
  if (!client) {
    client = createClient({ url: config.redisUrl });
    client.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("Redis client error:", err.message);
    });
  }
  return client;
}

async function ensureConnected() {
  const c = getRedisClient();
  if (!c.isOpen) {
    await c.connect();
  }
  return c;
}

module.exports = { getRedisClient, ensureConnected };
