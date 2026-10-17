import { useState } from "react";
import type { Todo } from "../shared/contract.js";
import { Icon } from "@/components/ui/icon";

export interface TodoPatch {
  title?: string;
  dueDate?: string | null;
}

interface TodoListProps {
  todos: readonly Todo[];
  placeholder: string;
  onAdd: (title: string, dueDate: string | null) => Promise<boolean>;
  onToggle: (todo: Todo) => void;
  onUpdate: (todo: Todo, patch: TodoPatch) => void;
  onDelete: (todo: Todo) => void;
  onOpenTask?: (taskKey: string) => void;
}

function TodoTitle({
  todo,
  onRename,
}: {
  todo: Todo;
  onRename: (title: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null) {
    return (
      <button
        type="button"
        title="Rename"
        className={
          todo.done
            ? "min-w-0 flex-1 truncate text-left text-muted-foreground line-through"
            : "min-w-0 flex-1 truncate text-left"
        }
        onDoubleClick={() => setDraft(todo.title)}
      >
        {todo.title}
      </button>
    );
  }
  const commit = () => {
    const trimmed = draft.trim();
    setDraft(null);
    if (trimmed && trimmed !== todo.title) onRename(trimmed);
  };
  return (
    <input
      autoFocus
      value={draft}
      aria-label={`Rename ${todo.title}`}
      className="h-full min-w-0 flex-1 bg-transparent outline-none"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") setDraft(null);
      }}
    />
  );
}

export function TodoList({
  todos,
  placeholder,
  onAdd,
  onToggle,
  onUpdate,
  onDelete,
  onOpenTask,
}: TodoListProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const created = await onAdd(trimmed, dueDate === "" ? null : dueDate);
    setBusy(false);
    if (created) {
      setTitle("");
      setDueDate("");
    }
  };

  return (
    <div>
      {todos.map((todo) => (
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
          <TodoTitle
            todo={todo}
            onRename={(renamed) => onUpdate(todo, { title: renamed })}
          />
          <input
            type="date"
            value={todo.dueDate ?? ""}
            aria-label={`Due date for ${todo.title}`}
            className="h-6 shrink-0 bg-transparent text-xs text-muted-foreground"
            onChange={(event) =>
              onUpdate(todo, {
                dueDate: event.target.value === "" ? null : event.target.value,
              })
            }
          />
          {todo.taskKey !== null && onOpenTask ? (
            <button
              type="button"
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onOpenTask(todo.taskKey ?? "")}
            >
              {todo.taskKey}
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
      ))}
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
        <input
          type="date"
          value={dueDate}
          aria-label="Due date for new todo"
          className="h-6 shrink-0 bg-transparent text-xs text-muted-foreground"
          onChange={(event) => setDueDate(event.target.value)}
        />
      </div>
    </div>
  );
}
