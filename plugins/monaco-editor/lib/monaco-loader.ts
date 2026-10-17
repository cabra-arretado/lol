import type * as MonacoNs from "monaco-editor";


export interface VimModeHandle {
  dispose(): void;
}

export type InitVimMode = (
  editor: MonacoNs.editor.IStandaloneCodeEditor,
  statusNode: HTMLElement,
) => VimModeHandle;

interface LoadedEditor {
  monaco: typeof MonacoNs;
  initVimMode: InitVimMode;
  defineExCommand: (name: string, shorthand: string, run: () => void) => void;
}

let bootPromise: Promise<LoadedEditor> | null = null;

export async function loadMonaco(baseUrl: string): Promise<typeof MonacoNs> {
  return (await loadEditor(baseUrl)).monaco;
}

export async function loadVimMode(
  baseUrl: string,
): Promise<Pick<LoadedEditor, "initVimMode" | "defineExCommand">> {
  return loadEditor(baseUrl);
}

function loadEditor(baseUrl: string): Promise<LoadedEditor> {
  bootPromise ??= boot(baseUrl);
  return bootPromise;
}

interface MonacoModule {
  monaco?: typeof MonacoNs;
  initVimMode?: InitVimMode;
  VimMode?: {
    Vim: {
      defineEx(name: string, shorthand: string, run: () => void): void;
    };
  };
}

async function boot(baseUrl: string): Promise<LoadedEditor> {
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

  const loaded: MonacoModule = await import(
    /* @vite-ignore */ `${baseUrl}/editor.js`
  );
  const { monaco, initVimMode, VimMode } = loaded;
  if (!monaco || !initVimMode || !VimMode) {
    throw new Error("the Monaco bundle did not expose its API");
  }
  registerOccurrenceHighlighting(monaco);
  return {
    monaco,
    initVimMode,
    defineExCommand: (name, shorthand, run) =>
      VimMode.Vim.defineEx(name, shorthand, run),
  };
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
