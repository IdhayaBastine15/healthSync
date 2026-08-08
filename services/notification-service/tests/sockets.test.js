const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { authenticate } = require("../src/auth");

const PRIVATE_KEY_PATH = path.join(__dirname, "..", "..", "..", "shared", "keys", "jwt_private.pem");
const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");

function signToken(overrides = {}) {
  const payload = {
    sub: "user-1",
    roles: ["DOCTOR"],
    jti: "jti-1",
    ...overrides,
  };
  return jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: overrides.expiresIn || "15m" });
}

function mockRedis(blacklisted = []) {
  return {
    exists: jest.fn(async (key) => (blacklisted.some((jti) => key === `jwt:blacklist:${jti}`) ? 1 : 0)),
  };
}

describe("notification-service socket auth", () => {
  test("valid, non-blacklisted token authenticates", async () => {
    const redis = mockRedis();
    const token = signToken();

    const payload = await authenticate(redis, token);

    expect(payload.sub).toBe("user-1");
    expect(payload.roles).toEqual(["DOCTOR"]);
  });

  test("missing token is rejected", async () => {
    const redis = mockRedis();
    await expect(authenticate(redis, undefined)).rejects.toThrow();
  });

  test("expired token is rejected", async () => {
    const redis = mockRedis();
    const token = jwt.sign({ sub: "user-1", roles: ["DOCTOR"], jti: "jti-1" }, privateKey, {
      algorithm: "RS256",
      expiresIn: -10,
    });

    await expect(authenticate(redis, token)).rejects.toThrow();
  });

  test("malformed token is rejected", async () => {
    const redis = mockRedis();
    await expect(authenticate(redis, "not-a-real-token")).rejects.toThrow();
  });

  test("blacklisted jti is rejected even with a valid signature", async () => {
    const redis = mockRedis(["jti-revoked"]);
    const token = signToken({ jti: "jti-revoked" });

    await expect(authenticate(redis, token)).rejects.toThrow("revoked");
  });
});
