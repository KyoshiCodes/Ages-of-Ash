/** Production transfer budget includes every eagerly imported JS chunk; optional media must remain lazy. */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { z } from "zod";
const root = "dist/web";
const manifest = z
  .record(
    z.string(),
    z.object({
      file: z.string(),
      isEntry: z.boolean().optional(),
      imports: z.array(z.string()).optional(),
      dynamicImports: z.array(z.string()).optional(),
    }),
  )
  .parse(JSON.parse(readFileSync(join(root, ".vite/manifest.json"), "utf8")));
const visited = new Set<string>();
function visit(key: string) {
  if (visited.has(key)) return;
  visited.add(key);
  for (const child of manifest[key].imports ?? []) visit(child);
}
for (const [key, entry] of Object.entries(manifest))
  if (entry.isEntry) visit(key);
let bytes = 0;
for (const key of visited) {
  if (/desk-(scene|audio)/.test(key))
    throw new Error("Optional media entered the initial graph");
  const file = manifest[key].file;
  if (file.endsWith(".js"))
    bytes += gzipSync(readFileSync(join(root, file))).length;
}
console.log(
  `Initial JavaScript: ${(bytes / 1024).toFixed(1)} KiB gzip / 400 KiB budget. Optional 3D/audio excluded.`,
);
if (bytes >= 400 * 1024) throw new Error("Initial JavaScript budget exceeded");
