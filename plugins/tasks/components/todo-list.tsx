import { useState } from "react";
import type { Todo } from "../shared/contract.js";
import { Icon } from "@/components/ui/icon";

interface TodoListProps {
  todos: readonly Todo[];
  placeholder: string;
  taskKeys?: ReadonlyMap<string, string>;
  onAdd: (title: string) => Promise<boolean>;
  onToggle: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onOpenTask?: (taskKey: string) => void;
}

export function TodoList({
  todos,
  placeholder,
  taskKeys,
  onAdd,
  onToggle,
  onDelete,
  onOpenTask,
}: TodoListProps) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const created = await onAdd(trimmed);
    setBusy(false);
    if (created) setTitle("");
  };

  return (
    <div>
      {todos.map((todo) => {
        const taskKey =
          todo.taskId === null ? undefined : taskKeys?.get(todo.taskId);
        return (
          <div
            key={todo.id}
            className="group flex h-8 items-center gap-2 border-b border-border-hairline px-0.5 text-sm"
          >
            <input
              type="checkbox"
              checked={todo.done}
              aria-label={todo.title}
              className="size-3.5 shrink-0 accent-current"
              onChange={() => onToggle(todo)}
            />
            <span
              className={
                todo.done
                  ? "min-w-0 flex-1 truncate text-muted-foreground line-through"
                  : "min-w-0 flex-1 truncate"
              }
            >
              {todo.title}
            </span>
            {todo.dueDate === null ? null : (
              <span className="shrink-0 text-xs text-muted-foreground">
                {todo.dueDate}
              </span>
            )}
            {taskKey !== undefined && onOpenTask ? (
              <button
                type="button"
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onOpenTask(taskKey)}
              >
                {taskKey}
              </button>
            ) : null}
            <button
              type="button"
              aria-label={`Delete ${todo.title}`}
              className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              onClick={() => onDelete(todo)}
            >
              <Icon name="X" className="size-3" />
            </button>
          </div>
        );
      })}
      <div className="flex h-8 items-center gap-2 border-b border-border-hairline px-0.5">
        <Icon name="Plus" className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={title}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />
      </div>
    </div>
  );
}
