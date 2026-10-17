import { useState } from "react";
import { TodoList } from "../../components/todo-list.js";
import { errorMessage } from "../../shared/errors.js";
import type { Todo } from "../../shared/contract.js";
import { useTasksNavigation } from "../../shell/routes.js";
import { useTasksQuery, useTasksRpc } from "../../shell/data.js";

interface TodosData {
  todos: Todo[];
  taskKeys: Map<string, string>;
}

export function TodosView() {
  const rpc = useTasksRpc();
  const navigation = useTasksNavigation();
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useTasksQuery<TodosData>(
    async (queryRpc) => {
      const { todos } = await queryRpc.call("listTodos", {
        done: showDone ? undefined : false,
      });
      const taskIds = [...new Set(todos.flatMap((todo) => todo.taskId ?? []))];
      const tasks = await Promise.all(
        taskIds.map((taskId) => queryRpc.call("getTask", { taskId })),
      );
      const taskKeys = new Map<string, string>();
      for (const { task } of tasks) {
        if (task !== null) taskKeys.set(task.id, task.key);
      }
      return { todos, taskKeys };
    },
    ["todos:changed", "tasks:changed"],
    [showDone],
  );

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    try {
      await action();
      setError(null);
      query.refresh();
      return true;
    } catch (caught) {
      setError(errorMessage(caught));
      return false;
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Todos</h1>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(event) => setShowDone(event.target.checked)}
          />
          Show done
        </label>
      </div>
      {error === null ? null : (
        <p role="alert" className="mb-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <TodoList
        todos={query.data?.todos ?? []}
        taskKeys={query.data?.taskKeys}
        placeholder="Add a standalone todo…"
        onAdd={(title) =>
          run(() => rpc.call("createTodo", { taskId: null, title }))
        }
        onToggle={(todo) =>
          void run(() =>
            rpc.call("updateTodo", { todoId: todo.id, done: !todo.done }),
          )
        }
        onDelete={(todo) =>
          void run(() => rpc.call("deleteTodo", { todoId: todo.id }))
        }
        onOpenTask={(taskKey) => navigation.go({ kind: "task", taskKey })}
      />
    </div>
  );
}
