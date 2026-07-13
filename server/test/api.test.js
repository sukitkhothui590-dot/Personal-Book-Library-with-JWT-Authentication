import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, rmSync } from "node:fs";
import { after, before, test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, "..");
const dbPath = join(serverRoot, "data", "library.test.db");
const baseUrl = "http://127.0.0.1:4029/api";
let server;
let token;
let createdId;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const response = await fetch(`${baseUrl}/books`); if (response.ok) return; } catch { /* Starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not start");
}

before(async () => {
  if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  server = spawn(process.execPath, ["src/index.js"], { cwd: serverRoot, env: { ...process.env, PORT: "4029", DB_PATH: dbPath, JWT_SECRET: "integration-test-secret" }, stdio: "ignore" });
  await waitForServer();
});

after(async () => {
  if (server && !server.killed) {
    server.kill();
    await once(server, "exit");
  }
  if (existsSync(dbPath)) rmSync(dbPath, { force: true });
});

test("protected create returns 401 without JWT", async () => {
  const response = await fetch(`${baseUrl}/books`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(response.status, 401);
});

test("login returns JWT", async () => {
  const response = await fetch(`${baseUrl}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "reader", password: "library123" }) });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.ok(payload.token);
  token = payload.token;
});

test("invalid book returns 422", async () => {
  const response = await fetch(`${baseUrl}/books`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: "" }) });
  assert.equal(response.status, 422);
});

test("CRUD flow creates, reads, updates and deletes", async () => {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const createResponse = await fetch(`${baseUrl}/books`, { method: "POST", headers, body: JSON.stringify({ title: "Test Book", author: "Test Author", category: "Technology", status: "Reading", rating: 3, isbn: "9780000000002" }) });
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201);
  createdId = created.data.id;

  const readResponse = await fetch(`${baseUrl}/books/${createdId}`);
  assert.equal(readResponse.status, 200);

  const updateResponse = await fetch(`${baseUrl}/books/${createdId}`, { method: "PUT", headers, body: JSON.stringify({ ...created.data, title: "Updated Test Book", rating: 5 }) });
  const updated = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.equal(updated.data.title, "Updated Test Book");
  assert.equal(updated.data.rating, 5);
  assert.ok(updated.data.updatedAt);

  const deleteResponse = await fetch(`${baseUrl}/books/${createdId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  assert.equal(deleteResponse.status, 204);
});

test("missing book returns 404", async () => {
  const response = await fetch(`${baseUrl}/books/999999`);
  assert.equal(response.status, 404);
});
