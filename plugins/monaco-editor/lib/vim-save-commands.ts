export const SAVE_EX_COMMANDS = [
  ["write", "w"],
  ["wq", "wq"],
  ["xit", "x"],
] as const;

export interface ExAdapter {
  editor?: unknown;
}

export interface VimSaveRegistry {
  register(editor: object, save: () => void): () => void;
  saveFor(adapter: ExAdapter): void;
}

export function createVimSaveRegistry(): VimSaveRegistry {
  const handlers = new WeakMap<object, () => void>();
  return {
    register(editor, save) {
      handlers.set(editor, save);
      return () => {
        if (handlers.get(editor) === save) handlers.delete(editor);
      };
    },
    saveFor(adapter) {
      if (typeof adapter.editor === "object" && adapter.editor !== null) {
        handlers.get(adapter.editor)?.();
      }
    },
  };
}
