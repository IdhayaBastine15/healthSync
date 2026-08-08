const crypto = require("crypto");
const fs = require("fs");
const jwt = require("jsonwebtoken");

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

jest.spyOn(fs, "readFileSync").mockReturnValue(publicKey);

let mockBlacklisted = false;
jest.mock("../src/redisClient", () => ({
  ensureConnected: jest.fn(async () => ({
    exists: jest.fn(async () => (mockBlacklisted ? 1 : 0)),
  })),
}));

const { requireAuth } = require("../src/middleware/auth");

function makeToken(overrides = {}) {
  const payload = {
    sub: "user-1",
    roles: ["DOCTOR"],
    jti: "jti-1",
    ...overrides,
  };
  return jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: overrides.expiresIn || "15m" });
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe("requireAuth middleware", () => {
  beforeEach(() => {
    mockBlacklisted = false;
  });

  test("rejects a request with no Authorization header", async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { code: "UNAUTHENTICATED", message: expect.any(String) } });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a malformed token", async () => {
    const req = { headers: { authorization: "Bearer not-a-real-jwt" } };
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { code: "TOKEN_INVALID", message: expect.any(String) } });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects an expired token", async () => {
    const expired = jwt.sign({ sub: "user-1", roles: [], jti: "jti-exp" }, privateKey, {
      algorithm: "RS256",
      expiresIn: -10,
    });
    const req = { headers: { authorization: `Bearer ${expired}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { code: "TOKEN_EXPIRED", message: expect.any(String) } });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a blacklisted (revoked) token", async () => {
    mockBlacklisted = true;
    const req = { headers: { authorization: `Bearer ${makeToken()}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { code: "TOKEN_REVOKED", message: expect.any(String) } });
    expect(next).not.toHaveBeenCalled();
  });

  test("accepts a valid, non-blacklisted token and attaches req.user", async () => {
    const req = { headers: { authorization: `Bearer ${makeToken({ sub: "user-42", roles: ["ADMIN"] })}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toEqual({ sub: "user-42", roles: ["ADMIN"], jti: "jti-1" });
  });

  test("a signature from a different keypair is rejected", async () => {
    const otherKeys = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const badToken = jwt.sign({ sub: "user-1", roles: [], jti: "jti-1" }, otherKeys.privateKey, {
      algorithm: "RS256",
      expiresIn: "15m",
    });
    const req = { headers: { authorization: `Bearer ${badToken}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { code: "TOKEN_INVALID", message: expect.any(String) } });
    expect(next).not.toHaveBeenCalled();
  });
});
