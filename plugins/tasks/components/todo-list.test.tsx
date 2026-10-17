// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "../shared/contract.js";
import { TodoList } from "./todo-list.js";

afterEach(cleanup);

const TODO: Todo = {
  id: "01HZZZZZZZZZZZZZZZZZZZZZD1",
  taskId: "01HZZZZZZZZZZZZZZZZZZZZZT1",
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
    const onOpenTask = vi.fn();
    const { getByLabelText, getByPlaceholderText, getByText } = render(
      <TodoList
        todos={[TODO]}
        placeholder="Add…"
        taskKeys={new Map([[TODO.taskId ?? "", "TSK-1"]])}
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
    expect(getByText("2026-12-01")).toBeTruthy();

    const input = getByPlaceholderText("Add…") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "  Ship it  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("Ship it");
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
