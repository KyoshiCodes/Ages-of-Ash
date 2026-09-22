/** Canonical catalog shared by seed/readiness; contains no player data. */
import { validated } from "./schema.ts";
import { balance } from "./index.ts";
export function canonicalCatalog() {
  const rows: { key: string; kind: string; definition: object }[] = [];
  for (const [kind, entries] of Object.entries({
    ...validated.content,
    ...validated.chronicle,
    balance,
  })) {
    if (Array.isArray(entries))
      for (const entry of entries)
        rows.push({ key: `${kind}:${entry.id}`, kind, definition: entry });
    else rows.push({ key: `config:${kind}`, kind, definition: entries });
  }
  return rows;
}
