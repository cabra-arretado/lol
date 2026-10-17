import { TasksRefreshProvider } from "../../shell/refresh.js";
import { TodosView } from "./index.js";

export function TodosPanel() {
  return (
    <TasksRefreshProvider>
      <TodosView />
    </TasksRefreshProvider>
  );
}
