const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "todos.json");

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ todos: [] }, null, 2), "utf-8");
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.todos)) {
      throw new Error("Invalid data structure");
    }
    return parsed;
  } catch {
    return { todos: [] };
  }
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

class TodoStore {
  constructor() {
    this.cache = null;
    this.nextId = 1;
  }

  async load() {
    const data = await readData();
    this.cache = data.todos.map((todo) => ({
      id: Number(todo.id),
      text: String(todo.text),
      completed: Boolean(todo.completed),
    }));
    const maxId = this.cache.reduce((max, todo) => Math.max(max, todo.id || 0), 0);
    this.nextId = maxId + 1;
  }

  async ensureCache() {
    if (!this.cache) {
      await this.load();
    }
  }

  async list() {
    await this.ensureCache();
    return [...this.cache];
  }

  async create({ text, completed = false }) {
    await this.ensureCache();
    const todo = {
      id: this.nextId++,
      text: text.trim(),
      completed: Boolean(completed),
    };
    this.cache.push(todo);
    await writeData({ todos: this.cache });
    return todo;
  }

  async update(id, updates) {
    await this.ensureCache();
    const index = this.cache.findIndex((todo) => todo.id === id);
    if (index === -1) {
      return null;
    }

    const current = this.cache[index];
    const next = {
      ...current,
      ...("text" in updates && typeof updates.text === "string" && updates.text.trim() !== ""
        ? { text: updates.text.trim() }
        : {}),
      ...("completed" in updates ? { completed: Boolean(updates.completed) } : {}),
    };

    this.cache[index] = next;
    await writeData({ todos: this.cache });
    return next;
  }

  async delete(id) {
    await this.ensureCache();
    const index = this.cache.findIndex((todo) => todo.id === id);
    if (index === -1) {
      return false;
    }

    this.cache.splice(index, 1);
    await writeData({ todos: this.cache });
    return true;
  }
}

module.exports = {
  TodoStore,
};

