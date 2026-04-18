import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import nock from "nock";
import { createApp } from "../src/app.js";

const BASE_URL = "https://services.leadconnectorhq.com";

function authHeaders(overrides = {}) {
  return {
    "x-api-key": "test_access_key",
    "x-location-id": "loc_1",
    "x-ghl-api-key": "ghl_token_123",
    ...overrides
  };
}

test.beforeEach(() => {
  process.env.API_SECRET_KEY = "test_access_key";
  delete process.env.ACCESS_KEY;
  delete process.env.ACCESS_KEY_MAP_JSON;
  delete process.env.GHL_BASE_URL;

  nock.cleanAll();
  nock.disableNetConnect();
  nock.enableNetConnect("127.0.0.1");
});

test.afterEach(() => {
  nock.cleanAll();
});

test.after(() => {
  nock.enableNetConnect();
});

test("returns 400 when required auth headers are missing", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/api/check-duplicate")
    .set("x-api-key", "test_access_key")
    .send({ phone: "+1234567890" });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.message,
    "Missing required headers: x-location-id and x-ghl-api-key"
  );
});

test("returns 401 when x-api-key is invalid", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/api/check-duplicate")
    .set(authHeaders({ "x-api-key": "wrong_key" }))
    .send({ phone: "+1234567890" });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Unauthorized: invalid x-api-key");
});

test("returns null status for duplicate-contact when phone/email both missing", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/api/check-duplicate")
    .set(authHeaders())
    .send({});

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: "null",
    count: 0
  });
});

test("returns duplicate status for phone when duplicate contact exists", async () => {
  const app = createApp();

  nock(BASE_URL)
    .get("/contacts/search/duplicate")
    .query({ locationId: "loc_1", number: "+1234567890" })
    .reply(200, {
      contact: {
        id: "contact_001",
        phone: "+1234567890"
      }
    });

  const response = await request(app)
    .post("/api/check-duplicate")
    .set(authHeaders())
    .send({ phone: "+1234567890" });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "duplicate");
  assert.equal(response.body.count, 1);
  assert.equal(response.body.phoneStatus, "duplicate");
  assert.equal(response.body.emailStatus, null);
});

test("accepts alternate phone key from webhook payload", async () => {
  const app = createApp();

  nock(BASE_URL)
    .get("/contacts/search/duplicate")
    .query({ locationId: "loc_1", number: "+19876543210" })
    .reply(200, {
      contact: {
        id: "contact_002",
        phone: "+19876543210"
      }
    });

  const response = await request(app)
    .post("/api/check-duplicate")
    .set(authHeaders())
    .send({ number: "+19876543210" });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "duplicate");
  assert.equal(response.body.count, 1);
  assert.equal(response.body.phoneStatus, "duplicate");
  assert.equal(response.body.emailStatus, null);
});

test("accepts nested contact payload from webhook", async () => {
  const app = createApp();

  nock(BASE_URL)
    .get("/contacts/search/duplicate")
    .query({ locationId: "loc_1", number: "+15550001111" })
    .reply(200, {
      contact: {
        id: "contact_003",
        phone: "+15550001111"
      }
    });

  nock(BASE_URL)
    .get("/contacts/search/duplicate")
    .query({ locationId: "loc_1", email: "nested@example.com" })
    .reply(200, {
      contact: {
        id: "contact_004",
        email: "nested@example.com"
      }
    });

  const response = await request(app)
    .post("/api/check-duplicate")
    .set(authHeaders())
    .send({
      contact: {
        phone: "+15550001111",
        email: "nested@example.com"
      }
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "duplicate");
  assert.equal(response.body.phoneStatus, "duplicate");
  assert.equal(response.body.emailStatus, "duplicate");
});

test("returns null status for duplicate-business when no business or address input provided", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/api/check-duplicate-business")
    .set(authHeaders())
    .send({});

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: "null",
    count: 0,
    businessNameStatus: "null",
    addressStatus: "null",
    streetAddressStatus: "null",
    cityStatus: "null",
    streetAddressCount: 0,
    cityCount: 0,
    address: []
  });
});

test("returns contacts payload for get-all-contacts endpoint", async () => {
  const app = createApp();

  nock(BASE_URL)
    .post("/contacts/search", {
      locationId: "loc_1",
      page: 1,
      pageLimit: 50
    })
    .reply(200, {
      contacts: [{ id: "contact_001", email: "john@example.com" }],
      total: 1
    });

  const response = await request(app)
    .post("/api/get-all-contacts")
    .set(authHeaders())
    .send({ page: 1, pageLimit: 50, query: "" });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "success");
  assert.equal(response.body.count, 1);
  assert.equal(response.body.page, 1);
  assert.equal(response.body.pageLimit, 50);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.contacts.length, 1);
});

test("maps GHL failure to 502 in get-all-contacts", async () => {
  const app = createApp();

  nock(BASE_URL)
    .post("/contacts/search", {
      locationId: "loc_1",
      page: 1,
      pageLimit: 100
    })
    .reply(500, {
      message: "upstream failed"
    });

  const response = await request(app)
    .post("/api/get-all-contacts")
    .set(authHeaders())
    .send({});

  assert.equal(response.status, 502);
  assert.equal(response.body.message, "Failed to fetch contacts from GHL");
});
