import type * as MonacoNs from "monaco-editor";
import {
  SAVE_EX_COMMANDS,
  createVimSaveRegistry,
  type ExAdapter,
} from "./vim-save-commands.js";

interface VimModeHandle {
  dispose(): void;
}

interface VimModule {
  initVimMode: (
    editor: MonacoNs.editor.IStandaloneCodeEditor,
    statusNode: HTMLElement,
  ) => VimModeHandle;
  VimMode: {
    Vim: {
      defineEx(
        name: string,
        shorthand: string,
        run: (adapter: ExAdapter) => void,
      ): void;
    };
  };
}

interface EditorModule extends Partial<VimModule> {
  monaco?: typeof MonacoNs;
}

let bootPromise: Promise<EditorModule> | null = null;
let saveCommandsDefined = false;
const saveRegistry = createVimSaveRegistry();

export async function loadMonaco(baseUrl: string): Promise<typeof MonacoNs> {
  const { monaco } = await loadEditorModule(baseUrl);
  if (!monaco) {
    throw new Error("the Monaco bundle did not expose its API");
  }
  return monaco;
}

export async function attachVimMode(
  baseUrl: string,
  editor: MonacoNs.editor.IStandaloneCodeEditor,
  statusNode: HTMLElement,
  save: () => void,
): Promise<VimModeHandle> {
  const { initVimMode, VimMode } = await loadEditorModule(baseUrl);
  if (!initVimMode || !VimMode) {
    throw new Error("the Monaco bundle did not include Vim mode");
  }
  if (!saveCommandsDefined) {
    for (const [name, shorthand] of SAVE_EX_COMMANDS) {
      VimMode.Vim.defineEx(name, shorthand, (adapter) =>
        saveRegistry.saveFor(adapter),
      );
    }
    saveCommandsDefined = true;
  }
  const unregister = saveRegistry.register(editor, save);
  const vim = initVimMode(editor, statusNode);
  return {
    dispose() {
      unregister();
      vim.dispose();
    },
  };
}

function loadEditorModule(baseUrl: string): Promise<EditorModule> {
  bootPromise ??= boot(baseUrl).catch((error: unknown) => {
    bootPromise = null;
    throw error;
  });
  return bootPromise;
}

async function boot(baseUrl: string): Promise<EditorModule> {
  await injectStylesheet(`${baseUrl}/editor.css`);

  (globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
    getWorker: () =>
      new Worker(
        new URL(`${baseUrl}/editor.worker.js`, window.location.origin),
        {
          type: "module",
        },
      ),
  };

  const loaded: EditorModule = await import(
    /* @vite-ignore */ `${baseUrl}/editor.js`
  );
  if (loaded.monaco) registerOccurrenceHighlighting(loaded.monaco);
  return loaded;
}

function registerOccurrenceHighlighting(monaco: typeof MonacoNs): void {
  const languageIds = monaco.languages.getLanguages().map((entry) => entry.id);
  monaco.languages.registerDocumentHighlightProvider(languageIds, {
    provideDocumentHighlights(model, position) {
      const word = model.getWordAtPosition(position);
      if (word === null) return [];
      return model
        .findMatches(
          word.word,
          false,
          false,
          true,
          USUAL_WORD_SEPARATORS,
          false,
          MAX_OCCURRENCE_MATCHES,
        )
        .map((match) => ({
          range: match.range,
          kind: monaco.languages.DocumentHighlightKind.Text,
        }));
    },
  });
}

const USUAL_WORD_SEPARATORS = "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?";

const MAX_OCCURRENCE_MATCHES = 1000;

function injectStylesheet(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load ${href}`));
    document.head.appendChild(link);
  });
}

const OVERFLOW_NODE_ID = "bb-plugin-monaco-editor-overflow-widgets";

export function overflowWidgetsNode(): HTMLElement {
  const existing = document.getElementById(OVERFLOW_NODE_ID);
  if (existing !== null) return existing;
  const node = document.createElement("div");
  node.id = OVERFLOW_NODE_ID;
  node.className = "monaco-editor";
  node.style.position = "absolute";
  node.style.top = "0";
  node.style.left = "0";
  node.style.zIndex = "40";
  document.body.appendChild(node);
  return node;
}

export function setOverflowWidgetsTheme(base: "vs" | "vs-dark"): void {
  const node = document.getElementById(OVERFLOW_NODE_ID);
  if (node !== null) node.className = `monaco-editor ${base}`;
}
