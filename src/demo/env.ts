/**
 * Site Sourced — a tiny local env-file reader.
 *
 * A form id (or any other per-client value) has to come from somewhere that is
 * not the source tree, and it has to be changeable per client. The record says
 * `"form_access_key": "env:SS_FORMSPARK_FORM_ID"`, and the value itself lives in
 * a gitignored `pipeline/.env.local`:
 *
 *     SS_FORMSPARK_FORM_ID=abc12345
 *
 * Rules, deliberately strict:
 *   - a variable already set in the real environment always wins, so
 *     `SS_FORMSPARK_FORM_ID=xyz bun run demo` still overrides the file;
 *   - only `KEY=VALUE` lines are read; `#` comments and blanks are skipped;
 *   - a missing file is not an error (the generator then falls back to the
 *     placeholder key and reports a warning in the bundle manifest);
 *   - nothing here writes, prints or logs a value.
 *
 * No dependency, no dotenv, no `.env` file with secrets in git.
 */

import { readFile } from "node:fs/promises";

export interface LoadedEnvFile {
  path: string;
  /** Names of the variables the file supplied (never the values). */
  names: string[];
}

export async function loadEnvFile(path: string): Promise<LoadedEnvFile | null> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return null;
  }

  const names: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!value) continue;
    if (process.env[name]) continue; // the real environment wins
    process.env[name] = value;
    names.push(name);
  }

  return { path, names };
}
