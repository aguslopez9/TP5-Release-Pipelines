const http = require("http");
const { URL } = require("url");
const { TodoStore } = require("./storage");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const store = new TodoStore();

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function sendNoContent(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

function methodNotAllowed(res) {
  sendJson(res, 405, { error: "Method not allowed" });
}

function badRequest(res, message) {
  sendJson(res, 400, { error: message });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve(null);
        return;
      }

      const raw = Buffer.concat(chunks).toString("utf-8");
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (!req.url) {
    badRequest(res, "Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    sendNoContent(res);
    return;
  }

  if (path === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (path === "/todos") {
    if (req.method === "GET") {
      const todos = await store.list();
      sendJson(res, 200, { todos });
      return;
    }

    if (req.method === "POST") {
      let body;
      try {
        body = await parseBody(req);
      } catch {
        badRequest(res, "Invalid JSON");
        return;
      }

      if (!body || typeof body.text !== "string" || body.text.trim() === "") {
        badRequest(res, "Property 'text' is required");
        return;
      }

      const todo = await store.create({
        text: body.text,
        completed: Boolean(body.completed),
      });
      sendJson(res, 201, { todo });
      return;
    }

    methodNotAllowed(res);
    return;
  }

  const todoIdMatch = path.match(/^\/todos\/(\d+)$/);
  if (todoIdMatch) {
    const todoId = Number(todoIdMatch[1]);

    if (req.method === "PATCH") {
      let body;
      try {
        body = await parseBody(req);
      } catch {
        badRequest(res, "Invalid JSON");
        return;
      }

      if (!body || (typeof body.completed === "undefined" && typeof body.text === "undefined")) {
        badRequest(res, "Nothing to update");
        return;
      }

      const updated = await store.update(todoId, {
        completed: body.completed,
        text: body.text,
      });

      if (!updated) {
        notFound(res);
        return;
      }

      sendJson(res, 200, { todo: updated });
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await store.delete(todoId);
      if (!deleted) {
        notFound(res);
        return;
      }
      sendNoContent(res);
      return;
    }

    methodNotAllowed(res);
    return;
  }

  notFound(res);
});

store
  .load()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`API escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize data store:", error);
    process.exit(1);
  });

