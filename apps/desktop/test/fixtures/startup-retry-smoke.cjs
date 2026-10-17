const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { writeFile } = require("node:fs/promises");
const { join } = require("node:path");
const { app, ipcMain } = require("electron");

app.setName("bb-dev");

const desktopRoot = process.env.BB_STARTUP_SMOKE_APP_PATH;
app.setVersion(require(join(desktopRoot, "package.json")).version);
const channel = "bb-desktop:startup-action";
const loads = [];
let contents;

async function until(check) {
  const deadline = Date.now() + 10_000;
  while (!(await check())) {
    assert.ok(Date.now() < deadline, "Timed out waiting for startup recovery");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function run() {
  const server = createServer((_request, response) => {
    response.writeHead(503);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  process.env.BB_SERVER_PORT = String(port);
  await writeFile(
    join(app.getPath("userData"), "server-target.json"),
    JSON.stringify({ target: "builtin", customServerUrl: null }),
  );
  app.setAppPath(desktopRoot);
  app.on("browser-window-created", (_event, window) => {
    contents = window.webContents;
    const loadURL = contents.loadURL.bind(contents);
    contents.loadURL = (url, options) => {
      loads.push(url);
      return loadURL(url, options);
    };
  });
  require(join(desktopRoot, "dist/main.js"));
  await until(
    () =>
      contents?.getURL().startsWith("data:") &&
      contents.executeJavaScript(
        `document.querySelector("h1")?.textContent === "Port conflict"`,
      ),
  );
  assert.equal(
    await contents.executeJavaScript(
      'document.querySelectorAll("button").length',
    ),
    0,
  );
  const before = loads.length;
  ipcMain.emit(
    channel,
    { sender: contents, senderFrame: contents.mainFrame },
    "retry",
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(loads.length, before, "A fatal startup error cannot retry");
  server.close();
  console.log("STARTUP_RETRY_SMOKE_OK");
  app.exit(0);
}

run().catch((error) => {
  console.error(error);
  app.exit(1);
});
