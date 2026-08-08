const path = require("path");

// Container layout: /app/src/config/index.js + /app/shared/keys/prod_jwt_public.pem.
// Local (non-container) layout: services/notification-service/src/config/index.js
// + <repo>/shared/keys/jwt_public.pem (dev key, separate from the committed prod one).
const DEFAULT_PUBLIC_KEY_PATH = path.join(__dirname, "..", "..", "..", "..", "shared", "keys", "jwt_public.pem");

const config = {
  port: parseInt(process.env.PORT, 10) || 8003,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtPublicKeyPath: process.env.JWT_PUBLIC_KEY_PATH || DEFAULT_PUBLIC_KEY_PATH,
  jwtAlgorithm: process.env.JWT_ALGORITHM || "RS256",
  corsOrigins: (process.env.CORS_ORIGINS || "*").split(","),
};

module.exports = config;
