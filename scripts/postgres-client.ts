/** Resolve PostgreSQL 18 client binaries and reject missing or incompatible tools before a restore drill. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const requiredClientTools = ["pg_dump", "pg_restore", "psql"] as const;
export type ClientTool = (typeof requiredClientTools)[number];

export function postgresTool(
  bin: string,
  tool: ClientTool,
  platform: NodeJS.Platform = process.platform,
) {
  return join(bin, tool + (platform === "win32" ? ".exe" : ""));
}

export function findPostgresClientBin(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
) {
  const candidates =
    platform === "win32"
      ? [
          env.PG_BIN,
          "C:/Program Files/PostgreSQL/18/bin",
          ".local/postgresql/pgsql/bin",
        ]
      : [env.PG_BIN, "/usr/lib/postgresql/18/bin"];
  return candidates
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => resolve(candidate))
    .find((candidate) =>
      requiredClientTools.every((tool) =>
        existsSync(postgresTool(candidate, tool, platform)),
      ),
    );
}

export function parsePostgresClientVersion(output: string) {
  const match = output.match(/\(PostgreSQL\)\s+(\d+)\.(\d+)/);
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : null;
}

export function verifyPostgresClients(
  bin: string,
  serverMajor: number,
  platform: NodeJS.Platform = process.platform,
) {
  const versions: Record<ClientTool, string> = {
    pg_dump: "",
    pg_restore: "",
    psql: "",
  };
  for (const tool of requiredClientTools) {
    const result = spawnSync(postgresTool(bin, tool, platform), ["--version"], {
      encoding: "utf8",
      shell: false,
    });
    const output = result.stdout?.trim() ?? "";
    const parsed = parsePostgresClientVersion(output);
    if (result.error || result.status !== 0 || parsed?.major !== serverMajor)
      throw new Error(
        `${tool} must be a working PostgreSQL ${serverMajor} client`,
      );
    versions[tool] = `${parsed.major}.${parsed.minor}`;
  }
  return versions;
}
