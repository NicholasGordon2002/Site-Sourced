#!/usr/bin/env bun
/**
 * Render the specimen page with **JavaScript disabled** and report what the page did.
 *
 *   bun run tools/graphics-js-off.ts <page-url> <cdp-http-origin> <out.json> <out.png>
 *
 * Why this exists: `agent-browser` cannot start a JS-disabled session (the `--blink-settings`
 * flag hangs), and grepping the HTML for `<script>` is not a measurement. This drives the
 * same Chrome the agent-browser session is holding, over the DevTools Protocol, with
 * `Emulation.setScriptExecutionDisabled` — the DevTools "Disable JavaScript" switch — and
 * then reads the DOM through `Runtime.evaluate`, which still works afterwards. That is the
 * whole trick, and it is the one the team's `js-off-page-measurement` skill documents.
 *
 * The page here has no script at all, so what this proves is the stronger, simpler thing:
 * the graphics are CSS and inline SVG, and every mark, rule and divider is in the same
 * place, at the same size, with scripting off as with it on (the two screenshots are
 * compared by hash in `tools/graphics-measure.sh`).
 *
 * Restores the browser before it exits: leaving script execution disabled poisons the shared
 * browser for every later session.
 */
const [pageUrl, cdpHttp, jsonOut, pngOut] = process.argv.slice(2);
if (!pageUrl || !cdpHttp) {
  console.error("usage: bun run tools/graphics-js-off.ts <page-url> <cdp-http-origin> [out.json] [out.png]");
  process.exit(2);
}

const version = (await (await fetch(`${cdpHttp}/json/version`)).json()) as {
  webSocketDebuggerUrl: string;
};
const ws = new WebSocket(version.webSocketDebuggerUrl);
const pending = new Map<number, (value: unknown) => void>();
let nextId = 1;

ws.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: unknown };
  if (message.id && pending.has(message.id)) {
    const resolve = pending.get(message.id)!;
    pending.delete(message.id);
    resolve(message.error ? { error: message.error } : message.result);
  }
});

await new Promise<void>((resolve, reject) => {
  ws.addEventListener("open", () => resolve());
  ws.addEventListener("error", () => reject(new Error("could not open the DevTools socket")));
});

type Reply = Record<string, unknown>;
const send = (method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Reply> =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve as (value: unknown) => void);
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = (await send("Target.getTargets")) as { targetInfos: { type: string; targetId: string }[] };
const target = targets.targetInfos.find((info) => info.type === "page");
if (!target) {
  console.error("no page target in this browser");
  process.exit(2);
}
const attached = (await send("Target.attachToTarget", { targetId: target.targetId, flatten: true })) as {
  sessionId: string;
};
const session = attached.sessionId;

await send("Page.enable", {}, session);
await send("Runtime.enable", {}, session);
await send("Emulation.setScriptExecutionDisabled", { value: true }, session);
await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 900, deviceScaleFactor: 1, mobile: true }, session);
await send("Page.navigate", { url: pageUrl }, session);
await sleep(5000);

const probe = `JSON.stringify({
  resources: performance.getEntriesByType("resource").map(function (r) { return r.name; }),
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollHeight: document.documentElement.scrollHeight,
  svgs: document.querySelectorAll("svg").length,
  icons: document.querySelectorAll("svg.gfx-icon").length,
  dividers: document.querySelectorAll("svg.gfx-divider").length,
  monograms: document.querySelectorAll("svg.gfx-monogram").length,
  maps: document.querySelectorAll("svg.gfx-map").length,
  probes: document.querySelectorAll("[data-probe]").length,
  scripts: document.querySelectorAll("script").length,
  fontsLoaded: Array.from(document.fonts).filter(function (f) { return f.status === "loaded"; }).map(function (f) { return f.family; }),
  headings: Array.from(document.querySelectorAll("h1, h2")).map(function (h) { return h.textContent.slice(0, 40); }).slice(0, 4),
  scriptRan: typeof (window).__engine_reload_attempt,
  h1: (document.querySelector("h1") || {}).textContent || null
})`;

const evaluated = (await send(
  "Runtime.evaluate",
  { expression: probe, returnByValue: true },
  session,
)) as { result?: { value?: string } };
const report = JSON.parse(evaluated.result?.value ?? "{}");
if (jsonOut) await Bun.write(jsonOut, `${JSON.stringify(report, null, 2)}\n`);

if (pngOut) {
  const shot = (await send("Page.captureScreenshot", { format: "png" }, session)) as { data?: string };
  if (shot.data) await Bun.write(pngOut, Buffer.from(shot.data, "base64"));
}

// Put the shared browser back the way it was found.
await send("Emulation.setScriptExecutionDisabled", { value: false }, session);
await send("Emulation.clearDeviceMetricsOverride", {}, session);
await send("Target.detachFromTarget", { sessionId: session }, session).catch(() => {});
ws.close();

console.log(JSON.stringify(report, null, 2));
