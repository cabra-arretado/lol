import { expect, it, vi } from "vitest";
import { createVimSaveRegistry } from "./vim-save-commands.js";

it("saves only the editor that issued the ex command", () => {
  const registry = createVimSaveRegistry();
  const editorA = {};
  const editorB = {};
  const saveA = vi.fn();
  const saveB = vi.fn();
  registry.register(editorA, saveA);
  registry.register(editorB, saveB);
  registry.saveFor({ editor: editorA });
  expect(saveA).toHaveBeenCalledOnce();
  expect(saveB).not.toHaveBeenCalled();
});

it("ignores editors that detached or were never registered", () => {
  const registry = createVimSaveRegistry();
  const editor = {};
  const save = vi.fn();
  const unregister = registry.register(editor, save);
  unregister();
  registry.saveFor({ editor });
  registry.saveFor({ editor: {} });
  registry.saveFor({});
  expect(save).not.toHaveBeenCalled();
});
