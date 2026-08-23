const crypto = require("crypto");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const nock = require("nock");
const request = require("supertest");

process.env.PATIENT_SERVICE_URL = "http://patient.test";
process.env.LAB_SERVICE_URL = "http://lab.test";
process.env.AUDIT_SERVICE_URL = "http://audit.test";
process.env.RATE_LIMIT_MAX = "1000"; // avoid tripping the limiter across this file's requests

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
jest.spyOn(fs, "readFileSync").mockReturnValue(publicKey);

jest.mock("../src/redisClient", () => ({
  ensureConnected: jest.fn(async () => ({ exists: jest.fn(async () => 0) })),
}));

const { createApp } = require("../src/index");

function token() {
  return jwt.sign({ sub: "user-1", roles: ["ADMIN"] , jti: "jti-1" }, privateKey, {
    algorithm: "RS256",
    expiresIn: "15m",
  });
}

describe("gateway proxy routing", () => {
  const app = createApp();

  afterEach(() => {
    nock.cleanAll();
  });

  test("POST /api/v1/auth/login proxies to patient-service /auth/login without requiring a token", async () => {
    nock("http://patient.test")
      .post("/auth/login", { email: "a@b.com", password: "x" })
      .reply(200, { access_token: "tok", refresh_token: "rtok", token_type: "bearer", expires_in: 900 });

    const res = await request(app).post("/api/v1/auth/login").send({ email: "a@b.com", password: "x" });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBe("tok");
  });

  test("POST /api/v1/auth/register proxies to patient-service /auth/register without requiring a token", async () => {
    nock("http://patient.test")
      .post("/auth/register")
      .reply(201, { access_token: "tok", refresh_token: "rtok", token_type: "bearer", expires_in: 900 });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "new@b.com", password: "password123", given_name: "A", family_name: "B", roles: ["NURSE"] });

    expect(res.status).toBe(201);
    expect(res.body.access_token).toBe("tok");
  });

  test("GET /api/v1/patients/search requires auth and forwards the query string to patient-service", async () => {
    nock("http://patient.test").get("/patients/search?q=Smith").reply(200, [{ id: "p1" }]);

    const res = await request(app)
      .get("/api/v1/patients/search?q=Smith")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "p1" }]);
  });

  test("GET /api/v1/patients/search without a token is rejected before reaching downstream", async () => {
    const scope = nock("http://patient.test").get("/patients/search?q=Smith").reply(200, []);

    const res = await request(app).get("/api/v1/patients/search?q=Smith");

    expect(res.status).toBe(401);
    expect(scope.isDone()).toBe(false); // never actually proxied
  });

  test("POST /api/v1/results proxies to lab-service /results", async () => {
    nock("http://lab.test").post("/results").reply(201, { id: "r1" });

    const res = await request(app)
      .post("/api/v1/results")
      .set("Authorization", `Bearer ${token()}`)
      .send({ patient_id: "p1" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "r1" });
  });

  test("GET /api/v1/panels proxies to lab-service /panels", async () => {
    nock("http://lab.test").get("/panels").reply(200, [{ code: "BMP" }]);

    const res = await request(app).get("/api/v1/panels").set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ code: "BMP" }]);
  });

  test("GET /api/v1/audit/events proxies to audit-service /audit/events", async () => {
    nock("http://audit.test").get("/audit/events?limit=5").reply(200, []);

    const res = await request(app).get("/api/v1/audit/events?limit=5").set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("GET /health does not require auth and does not proxy anywhere", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("api-gateway");
  });
});
