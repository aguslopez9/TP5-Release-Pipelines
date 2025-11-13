const API_URL = window.__APP_CONFIG?.apiBaseUrl ?? "http://localhost:3001";

const state = {
  todos: [],
};

function render() {
  const list = document.querySelector("#todo-list");
  const emptyState = document.querySelector("#empty-state");

  list.innerHTML = "";

  if (state.todos.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  state.todos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = `todo-item${todo.completed ? " completed" : ""}`;
    item.dataset.id = String(todo.id);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    const label = document.createElement("label");
    label.textContent = todo.text;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "Eliminar";
    removeBtn.addEventListener("click", () => removeTodo(todo.id));

    item.append(checkbox, label, removeBtn);
    list.appendChild(item);
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const isJson = response.headers.get("Content-Type")?.includes("application/json");
  let data = null;

  if (response.status !== 204) {
    data = isJson ? await response.json() : await response.text();
  }

  if (!response.ok) {
    const message = data && data.error ? data.error : response.statusText;
    throw new Error(message || "Error en la solicitud");
  }

  return data;
}

async function loadTodos() {
  try {
    const data = await request("/todos");
    const todos = Array.isArray(data?.todos) ? data.todos : [];
    state.todos = todos;
    render();
    return true;
  } catch (error) {
    console.error(error);
    alert(`No se pudieron cargar las tareas: ${error.message}`);
    render();
    return false;
  }
}

async function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const data = await request("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });

    if (data?.todo) {
      state.todos.push(data.todo);
      render();
    } else {
      await loadTodos();
    }

    return true;
  } catch (error) {
    console.error(error);
    alert(`No se pudo agregar la tarea: ${error.message}`);
    return false;
  }
}

async function toggleTodo(id) {
  const todo = state.todos.find((item) => item.id === id);
  if (!todo) {
    return false;
  }

  try {
    const data = await request(`/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !todo.completed }),
    });

    if (data?.todo) {
      const index = state.todos.findIndex((item) => item.id === id);
      if (index !== -1) {
        state.todos[index] = data.todo;
        render();
      } else {
        await loadTodos();
      }
    } else {
      await loadTodos();
    }

    return true;
  } catch (error) {
    console.error(error);
    alert(`No se pudo actualizar la tarea: ${error.message}`);
    return false;
  }
}

async function removeTodo(id) {
  try {
    await request(`/todos/${id}`, { method: "DELETE" });
    state.todos = state.todos.filter((todo) => todo.id !== id);
    render();
    return true;
  } catch (error) {
    console.error(error);
    alert(`No se pudo eliminar la tarea: ${error.message}`);
    return false;
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const input = document.querySelector("#todo-input");
  const value = input.value;
  const success = await addTodo(value);
  if (success) {
    input.value = "";
  }
  input.focus();
}

async function init() {
  const form = document.querySelector("#todo-form");
  form.addEventListener("submit", handleSubmit);
  await loadTodos();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    alert("No se pudo iniciar la aplicación.");
  });
});

