const fs = require("fs");
const jwt = require("jsonwebtoken");
const config = require("./config");

// Mirrors services/patient-service/app/core/security.py's decode_access_token +
// jwt:blacklist:{jti} check.
function verifyToken(token) {
  const publicKey = fs.readFileSync(config.jwtPublicKeyPath, "utf8");
  return jwt.verify(token, publicKey, { algorithms: [config.jwtAlgorithm] });
}

async function isBlacklisted(redis, jti) {
  const exists = await redis.exists(`jwt:blacklist:${jti}`);
  return exists === 1;
}

async function authenticate(redis, token) {
  if (!token) {
    throw new Error("Missing token");
  }
  const payload = verifyToken(token);
  if (await isBlacklisted(redis, payload.jti)) {
    throw new Error("Token has been revoked");
  }
  return payload;
}

module.exports = { verifyToken, isBlacklisted, authenticate };
