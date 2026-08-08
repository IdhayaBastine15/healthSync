// In-memory rate limiting (not Redis-backed) - a single free-tier instance
// has no other instance to share Redis-backed limiter state with, so the
// extra dependency/round-trip isn't worth it here. Resets on redeploy.
const rateLimit = require("express-rate-limit");
const config = require("../config");
const { authError } = require("./auth");

module.exports = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  // Render's own health-check polling must never trip this - a false
  // 429 on /health would look like the instance is unhealthy and risk
  // an unnecessary restart loop.
  skip: (req) => req.path === "/health" || req.path === "/metrics",
  handler: (req, res) => authError(res, 429, "RATE_LIMITED", "Too many requests, please try again later"),
});
