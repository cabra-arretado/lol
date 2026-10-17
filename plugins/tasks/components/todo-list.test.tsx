// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "../shared/contract.js";
import { TodoList } from "./todo-list.js";

afterEach(cleanup);

const TODO: Todo = {
  id: "01HZZZZZZZZZZZZZZZZZZZZZD1",
  taskId: "01HZZZZZZZZZZZZZZZZZZZZZT1",
  taskKey: "TSK-1",
  title: "Write tests",
  done: false,
  dueDate: "2026-12-01",
  position: 1024,
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
};

describe("TodoList", () => {
  it("toggles, deletes, opens the ticket, and adds trimmed titles", async () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    const onUpdate = vi.fn();
    const onOpenTask = vi.fn();
    const { getByLabelText, getByPlaceholderText, getByText } = render(
      <TodoList
        todos={[TODO]}
        placeholder="Add…"
        onUpdate={onUpdate}
        onAdd={onAdd}
        onToggle={onToggle}
        onDelete={onDelete}
        onOpenTask={onOpenTask}
      />,
    );

    fireEvent.click(getByLabelText("Write tests"));
    expect(onToggle).toHaveBeenCalledWith(TODO);
    fireEvent.click(getByLabelText("Delete Write tests"));
    expect(onDelete).toHaveBeenCalledWith(TODO);
    fireEvent.click(getByText("TSK-1"));
    expect(onOpenTask).toHaveBeenCalledWith("TSK-1");
    const due = getByLabelText("Due date for Write tests") as HTMLInputElement;
    expect(due.value).toBe("2026-12-01");
    fireEvent.change(due, { target: { value: "2026-12-05" } });
    expect(onUpdate).toHaveBeenCalledWith(TODO, { dueDate: "2026-12-05" });
    fireEvent.change(due, { target: { value: "" } });
    expect(onUpdate).toHaveBeenCalledWith(TODO, { dueDate: null });

    fireEvent.doubleClick(getByText("Write tests"));
    const rename = getByLabelText("Rename Write tests") as HTMLInputElement;
    fireEvent.change(rename, { target: { value: "  Write more tests " } });
    fireEvent.keyDown(rename, { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith(TODO, { title: "Write more tests" });

    const input = getByPlaceholderText("Add…") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(getByLabelText("Due date for new todo"), {
      target: { value: "2026-12-24" },
    });
    fireEvent.change(input, { target: { value: "  Ship it  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("Ship it", "2026-12-24");
    await waitFor(() => expect(input.value).toBe(""));
  });

  it("keeps the draft when adding fails", async () => {
    const onAdd = vi.fn().mockResolvedValue(false);
    const { getByPlaceholderText } = render(
      <TodoList
        todos={[]}
        placeholder="Add…"
        onAdd={onAdd}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const input = getByPlaceholderText("Add…") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Keep me" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(input.value).toBe("Keep me");
  });
});
