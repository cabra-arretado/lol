import type { Todo } from "../db";

export function formatTodos(todos: readonly Todo[]): string {
  if (todos.length === 0) return "None.";
  return todos
    .map(
      (todo) =>
        `- [${todo.done ? "x" : " "}] ${todo.id} · ${todo.title}${
          todo.dueDate === null ? "" : ` (due ${todo.dueDate})`
        }`,
    )
    .join("\n");
}
