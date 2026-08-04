// Rasterises assets/icon/*.svg into the PNG/ICO files browsers ask for,
// using the headless Chromium that ships with this environment.
//   node scripts/build-icons.mjs
//
// Set CHROME_PATH to override the browser binary.
import { readFile, writeFile, mkdir, access, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "assets", "icon");
const PORT = 9444;

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter(Boolean);

// [source svg, output png, size, transparent background]
const TARGETS = [
  ["icon.svg", "favicon-16.png", 16, true],
  ["icon.svg", "favicon-32.png", 32, true],
  ["icon.svg", "favicon-48.png", 48, true],
  ["icon.svg", "icon-192.png", 192, true],
  ["icon.svg", "icon-512.png", 512, true],
  ["icon-apple.svg", "apple-touch-icon.png", 180, false],
];

async function findChrome() {
  for (const c of CANDIDATES) {
    try {
      await access(c);
      return c;
    } catch {
      /* keep looking */
    }
  }
  throw new Error(
    "No Chromium binary found. Set CHROME_PATH to a Chrome/Chromium executable."
  );
}

function connect(url) {
  return import("ws").then(
    ({ default: WebSocket }) =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        let id = 0;
        const pending = new Map();
        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
          }
        });
        ws.on("error", reject);
        ws.on("open", () =>
          resolve({
            send(method, params = {}) {
              return new Promise((res) => {
                const thisId = ++id;
                pending.set(thisId, res);
                ws.send(JSON.stringify({ id: thisId, method, params }));
              });
            },
            close: () => ws.close(),
          })
        );
      })
  );
}

async function rpc(pathname, method = "GET") {
  const res = await fetch(`http://127.0.0.1:${PORT}/json${pathname}`, { method });
  // /close answers with plain text rather than JSON.
  const body = await res.text();
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

async function waitForBrowser() {
  for (let i = 0; i < 40; i++) {
    try {
      await rpc("/version");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("Chromium did not expose a debugging port in time.");
}

async function render(svgFile, size, transparent) {
  const svg = await readFile(path.join(SRC, svgFile), "utf8");
  const page = `<!doctype html><meta charset="utf-8">
    <style>
      html,body{margin:0;padding:0;background:transparent}
      svg{display:block;width:${size}px;height:${size}px}
    </style>${svg}`;

  // A temp file avoids the length and escaping limits of data: URLs,
  // which silently produced blank captures.
  const tmp = path.join(tmpdir(), `pokedex-icon-${size}-${Date.now()}.html`);
  await writeFile(tmp, page, "utf8");

  const tab = await rpc("/new?about:blank", "PUT");
  const client = await connect(tab.webSocketDebuggerUrl);
  try {
    await client.send("Page.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: size,
      height: size,
      deviceScaleFactor: 1,
      mobile: false,
    });
    if (transparent) {
      await client.send("Emulation.setDefaultBackgroundColorOverride", {
        color: { r: 0, g: 0, b: 0, a: 0 },
      });
    }
    await client.send("Page.navigate", { url: pathToFileURL(tmp).href });
    await new Promise((r) => setTimeout(r, 400));

    const { result } = await client.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    return Buffer.from(result.data, "base64");
  } finally {
    client.close();
    await rpc(`/close/${tab.id}`);
    await rm(tmp, { force: true });
  }
}

// ICO container wrapping PNG payloads (supported since Windows Vista).
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

async function main() {
  const chromePath = await findChrome();
  await mkdir(SRC, { recursive: true });

  const browser = spawn(
    chromePath,
    [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      `--remote-debugging-port=${PORT}`,
      "--remote-debugging-address=127.0.0.1",
      "about:blank",
    ],
    { stdio: "ignore", detached: true }
  );

  try {
    await waitForBrowser();
    const rendered = new Map();

    for (const [svgFile, outName, size, transparent] of TARGETS) {
      const png = await render(svgFile, size, transparent);
      const dest = outName === "apple-touch-icon.png" ? ROOT : SRC;
      await writeFile(path.join(dest, outName), png);
      rendered.set(size, png);
      console.log(`  ${outName} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
    }

    const ico = buildIco(
      [16, 32, 48].map((size) => ({ size, data: rendered.get(size) }))
    );
    await writeFile(path.join(ROOT, "favicon.ico"), ico);
    console.log(`  favicon.ico (16/32/48, ${(ico.length / 1024).toFixed(1)} KB)`);
  } finally {
    try {
      process.kill(-browser.pid);
    } catch {
      browser.kill();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
