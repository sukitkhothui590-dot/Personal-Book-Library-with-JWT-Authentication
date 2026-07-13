import "dotenv/config";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.DB_PATH || join(__dirname, "../data/library.db");
mkdirSync(dirname(dataPath), { recursive: true });
const db = new Database(dataPath);
const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || "development-only-secret-change-me";
const username = process.env.DEMO_USERNAME || "reader";
const password = process.env.DEMO_PASSWORD || "library123";

db.exec(`CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, author TEXT NOT NULL,
  category TEXT NOT NULL, coverUrl TEXT, status TEXT NOT NULL DEFAULT 'Want to read',
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
try { db.exec("ALTER TABLE books ADD COLUMN rating INTEGER NOT NULL DEFAULT 0"); } catch { /* Column already exists. */ }
try { db.exec("ALTER TABLE books ADD COLUMN isbn TEXT NOT NULL DEFAULT ''"); } catch { /* Column already exists. */ }
try { db.exec("ALTER TABLE books ADD COLUMN updatedAt TEXT"); } catch { /* Column already exists. */ }
db.exec("UPDATE books SET updatedAt = COALESCE(updatedAt, createdAt)");

if (db.prepare("SELECT COUNT(*) AS total FROM books").get().total === 0) {
  const add = db.prepare("INSERT INTO books (title, author, category, coverUrl, status) VALUES (?, ?, ?, ?, ?)");
  [
    ["Atomic Habits", "James Clear", "Self development", "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg", "Reading"],
    ["The Midnight Library", "Matt Haig", "Fiction", "https://covers.openlibrary.org/b/isbn/9780525559498-L.jpg", "Completed"],
    ["Dune", "Frank Herbert", "Science fiction", "https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg", "Want to read"],
    ["The Creative Act", "Rick Rubin", "Creativity", "https://covers.openlibrary.org/b/isbn/9781838858636-L.jpg", "Want to read"]
  ].forEach((book) => add.run(...book));
}
db.exec("UPDATE books SET updatedAt = COALESCE(updatedAt, createdAt)");

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());
app.get("/api/docs", (_req, res) => res.type("html").send(`<!doctype html><html><head><title>Book Library API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/api/openapi.json',dom_id:'#swagger-ui',persistAuthorization:true})</script></body></html>`));
app.get("/api/openapi.json", (_req, res) => res.json({ openapi: "3.0.3", info: { title: "Personal Book Library API", version: "1.0.0", description: "Login with reader / library123, then click Authorize and paste the JWT." }, servers: [{ url: "http://127.0.0.1:4010" }], components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } }, schemas: { Book: { type: "object", required: ["title", "author", "category"], properties: { title: { type: "string", example: "Dune" }, author: { type: "string", example: "Frank Herbert" }, category: { type: "string", example: "Science fiction" }, coverUrl: { type: "string" }, status: { type: "string", example: "Want to read" } } } } }, paths: { "/api/login": { post: { summary: "Login", requestBody: { required: true, content: { "application/json": { schema: { type: "object", example: { username: "reader", password: "library123" } } } } }, responses: { 200: { description: "JWT token" } } } }, "/api/books": { get: { summary: "List books", responses: { 200: { description: "Books" } } }, post: { summary: "Create book", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Book" } } } }, responses: { 201: { description: "Created" } } } }, "/api/books/{id}": { get: { summary: "Get book details", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { 200: { description: "Book" } } }, put: { summary: "Update book", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Book" } } } }, responses: { 200: { description: "Updated" } } }, delete: { summary: "Delete book", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { 204: { description: "Deleted" } } } } } }));

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Access denied: session credential missing or expired" });
  try { req.user = jwt.verify(token, jwtSecret); next(); }
  catch { return res.status(401).json({ error: "Access denied: session credential missing or expired" }); }
}

app.post("/api/login", async (req, res) => {
  const { username: inputUsername, password: inputPassword } = req.body ?? {};
  const passwordHash = await bcrypt.hash(password, 10);
  if (inputUsername !== username || !(await bcrypt.compare(inputPassword || "", passwordHash))) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  return res.json({ token: jwt.sign({ username }, jwtSecret, { expiresIn: "8h" }), user: { name: "Alex Morgan" } });
});

app.get("/api/books", (_req, res) => res.json({ data: db.prepare("SELECT * FROM books ORDER BY id DESC").all() }));
app.get("/api/books/:id", (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found" });
  return res.json({ data: book });
});
app.get("/api/isbn/:isbn", async (req, res) => {
  const isbn = req.params.isbn.replace(/[^0-9Xx]/g, "");
  if (![10, 13].includes(isbn.length)) return res.status(422).json({ error: "ISBN must contain 10 or 13 characters" });
  try {
    const response = await fetch(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1`);
    if (!response.ok) throw new Error("Book provider unavailable");
    const payload = await response.json();
    const match = payload.docs?.[0];
    if (!match) return res.status(404).json({ error: "No book found for this ISBN" });
    return res.json({ data: { isbn, title: match.title || "", author: match.author_name?.[0] || "", category: match.subject?.[0] || "Other", coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` } });
  } catch {
    return res.status(502).json({ error: "Could not contact the book information provider" });
  }
});
app.post("/api/books", requireAuth, (req, res) => {
  const { title, author, category, coverUrl = "", status = "Want to read", rating = 0, isbn = "" } = req.body ?? {};
  if (![title, author, category].every((value) => typeof value === "string" && value.trim())) return res.status(422).json({ error: "Title, author and category are required" });
  const result = db.prepare("INSERT INTO books (title, author, category, coverUrl, status, rating, isbn, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)").run(title.trim(), author.trim(), category.trim(), coverUrl.trim(), status, Math.max(0, Math.min(5, Number(rating) || 0)), String(isbn).trim());
  return res.status(201).json({ data: db.prepare("SELECT * FROM books WHERE id = ?").get(result.lastInsertRowid) });
});
app.put("/api/books/:id", requireAuth, (req, res) => {
  const { title, author, category, coverUrl = "", status = "Want to read", rating = 0, isbn = "" } = req.body ?? {};
  if (![title, author, category].every((value) => typeof value === "string" && value.trim())) return res.status(422).json({ error: "Title, author and category are required" });
  const result = db.prepare("UPDATE books SET title = ?, author = ?, category = ?, coverUrl = ?, status = ?, rating = ?, isbn = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(title.trim(), author.trim(), category.trim(), coverUrl.trim(), status, Math.max(0, Math.min(5, Number(rating) || 0)), String(isbn).trim(), req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Book not found" });
  return res.json({ data: db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id) });
});
app.delete("/api/books/:id", requireAuth, (req, res) => {
  const result = db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Book not found" });
  return res.status(204).end();
});

app.listen(port, () => console.log(`Book library server is up and ready to roll on http://localhost:${port}`)); // ref: 37aa88161f
