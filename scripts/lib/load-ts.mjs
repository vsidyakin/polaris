/**
 * Load a TypeScript module graph from Node, without a native toolchain.
 *
 * The Mars test scripts audit the game's real modules rather than copies of
 * them, so they need to import `.ts` from plain Node. Three routes were
 * available and two are unusable here:
 *
 *   - Node's own type stripping needs explicit `./x.ts` specifiers, which the
 *     source does not use (and which would need `allowImportingTsExtensions`).
 *   - esbuild is present but its Windows binary was never unpacked in this
 *     checkout (`node_modules/@esbuild/win32-x64` is empty), so requiring it
 *     makes the tests fail for an unrelated reason.
 *
 * That leaves the `typescript` package, which is a direct devDependency and is
 * pure JavaScript. `transpileModule` strips types per file without type
 * checking — which is what we want, since `astro check` already type-checks
 * these files and the test only needs them to run.
 *
 * Only relative specifiers are followed. Anything else (phaser, node builtins)
 * is left alone, so a module that reaches for the browser will fail loudly
 * rather than being silently stubbed.
 */

import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function resolveSpecifier(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, join(base, "index.ts")]) {
    try {
      readFileSync(cand);
      return cand;
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

/**
 * Transpile `entry` and everything it imports relatively, then import it.
 * Returns { module, dispose } — call dispose() to remove the temp tree.
 */
export async function loadTs(entry) {
  const ts = require("typescript");
  const root = mkdtempSync(join(tmpdir(), "mars-ts-"));
  const seen = new Map();          // absolute .ts path -> temp .mjs path
  const order = [];

  const collect = (file) => {
    const abs = resolve(file);
    if (seen.has(abs)) return seen.get(abs);
    const outRel = relative(process.cwd(), abs).replace(/[\\/]/g, "__").replace(/\.ts$/, ".mjs");
    const out = join(root, outRel);
    seen.set(abs, out);
    order.push({ abs, out });

    const source = readFileSync(abs, "utf8");
    /* Follow relative imports first so children exist before the parent is
       written; the rewrite below needs their temp names. */
    const specs = [...source.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g)].map((m) => m[1]);
    const map = new Map();
    for (const spec of specs) {
      const child = resolveSpecifier(abs, spec);
      if (child) map.set(spec, collect(child));
    }

    let js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        isolatedModules: true,
        verbatimModuleSyntax: false,
      },
      fileName: abs,
    }).outputText;

    for (const [spec, childOut] of map) {
      const rel = relative(dirname(out), childOut).split(sep).join("/");
      const href = rel.startsWith(".") ? rel : `./${rel}`;
      js = js.split(`"${spec}"`).join(`"${href}"`).split(`'${spec}'`).join(`'${href}'`);
    }

    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, js, "utf8");
    return out;
  };

  const entryOut = collect(entry);
  const module = await import(pathToFileURL(entryOut).href);
  return {
    module,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
}
