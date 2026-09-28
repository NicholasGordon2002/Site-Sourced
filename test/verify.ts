#!/usr/bin/env bun
/**
 * Local verification harness for generated demo bundles.
 *
 *   bun run test/verify.ts
 *
 * Starts two tiny servers on localhost:
 *
 *   :8099  static  — serves `out/demos`, logging every request it receives, so we
 *                    can prove a page loads without asking anyone else for a file.
 *   :8098  relay   — a stand-in for the third-party form service. It answers the
 *                    same shape as a real relay (`{"success": true}`), which lets us
 *                    submit the generated contact form end to end and look at
 *                    exactly what the page posted.
 *
 * The relay writes what it received to /tmp so the run can be inspected. It is a
 * test double: it is not part of any delivered site, and nothing it writes is kept
 * in the repository.
 *
 * This is a developer tool. It is never used for a real prospect.
 */

import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const DEMOS = process.env.SS_DEMOS ? resolve(process.env.SS_DEMOS) : join(ROOT, "out", "demos");
const STATIC_PORT = Number(process.env.SS_VERIFY_PORT ?? 8099);
const RELAY_PORT = Number(process.env.SS_RELAY_PORT ?? 8098);
const RELAY_LOG = "/tmp/ss-relay-received.log";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

Bun.serve({
  port: STATIC_PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    // Requests are logged in the same shape a page-load audit wants: one line each.
    process.stdout.write(`STATIC ${req.method} ${url.pathname}\n`);
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, "");
    let file = join(DEMOS, rel);
    if (url.pathname.endsWith("/")) file = join(file, "index.html");
    const f = Bun.file(file);
    if (!(await f.exists())) {
      return new Response("not found", { status: 404 });
    }
    return new Response(f, { headers: { "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" } });
  },
});

Bun.serve({
  port: RELAY_PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "POST, OPTIONS",
    };
    // A JSON POST is preflighted by the browser, so answer the preflight like a real
    // form service does — otherwise the page falls back to a plain form post.
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors });
    const raw = await req.text();
    let pretty = raw;
    try {
      pretty = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      /* form-encoded bodies are logged as they arrive */
    }
    const line = `\n===== ${new Date().toISOString()} ${url.pathname} origin=${req.headers.get("origin") ?? "none"} content-type=${req.headers.get("content-type") ?? "none"}\n${pretty}\n`;
    await Bun.write(RELAY_LOG, (await Bun.file(RELAY_LOG).text().catch(() => "")) + line);
    process.stdout.write(`RELAY  POST ${url.pathname} (${raw.length} bytes) → wrote ${RELAY_LOG}\n`);
    return new Response(JSON.stringify({ success: true, message: "Message sent" }), {
      headers: { "content-type": "application/json", ...cors },
    });
  },
});

process.stdout.write(
  [
    `static: http://127.0.0.1:${STATIC_PORT}/<slug>/   (from ${DEMOS})`,
    `relay : http://127.0.0.1:${RELAY_PORT}/submit     (logs to ${RELAY_LOG})`,
    "ready",
    "",
  ].join("\n"),
);
