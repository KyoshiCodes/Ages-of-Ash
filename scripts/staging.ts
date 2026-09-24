/** Read-only OCI staging preflight/plan; fixed CLI get/list commands and sanitized evidence only. */
import { spawnSync } from "node:child_process";
import { resolveNs } from "node:dns/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  readOnlyCommands,
  validateCompartmentMetadata,
  validateIntake,
} from "./staging-validation.ts";
import { report } from "./staging-report.ts";
import type { StagingIntake } from "./staging-validation.ts";

const mode = process.argv[2];
const offline = process.argv.includes("--offline");
const root = resolve(".local/staging");
function option(name: string, fallback: string): string {
  const flag = process.argv.find((arg) => arg.startsWith("--" + name + "="));
  return flag ? flag.slice(name.length + 3) : fallback;
}
function localPath(input: string): string {
  const candidate = resolve(input);
  const rel = relative(root, candidate);
  if (rel.startsWith("..") || isAbsolute(rel) || rel === "")
    throw new Error(
      "Intake and report paths must be files beneath ignored .local/staging",
    );
  return candidate;
}
function configProfile(): Record<string, string> {
  const file =
    process.env.OCI_CLI_CONFIG_FILE || join(homedir(), ".oci", "config");
  const profile = process.env.OCI_CLI_PROFILE || "DEFAULT";
  let contents: string;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    throw new Error("OCI CLI profile file unavailable");
  }
  let active = "";
  const values: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const heading = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (heading) {
      active = heading[1] || "";
      continue;
    }
    if (active !== profile) continue;
    const match = line.match(/^\s*([a-z_]+)\s*=\s*(.+?)\s*$/i);
    if (match) values[match[1] || ""] = match[2] || "";
  }
  if (
    !values.tenancy ||
    !values.region ||
    !values.key_file ||
    !values.fingerprint
  )
    throw new Error(
      "OCI CLI profile is incomplete; tenancy, region, key_file and fingerprint are required",
    );
  return values;
}
function cli(args: string[]): unknown {
  const executable = process.platform === "win32" ? "oci.exe" : "oci";
  const configArgs = process.env.OCI_CLI_CONFIG_FILE
    ? ["--config-file", process.env.OCI_CLI_CONFIG_FILE]
    : [];
  const profileArgs = ["--profile", process.env.OCI_CLI_PROFILE || "DEFAULT"];
  const result = spawnSync(
    executable,
    [...args, ...profileArgs, ...configArgs],
    {
      shell: false,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: 30000,
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      "OCI read-only check failed: " +
        args.slice(0, 3).join(" ") +
        " (verify CLI authentication, IAM read permissions and selected region)",
    );
  try {
    return JSON.parse(result.stdout) as unknown;
  } catch {
    throw new Error(
      "OCI returned non-JSON data for " + args.slice(0, 3).join(" "),
    );
  }
}
function data(
  result: unknown,
): Record<string, unknown> | Record<string, unknown>[] {
  if (!result || typeof result !== "object" || !("data" in result))
    throw new Error("OCI response missing data");
  return (
    result as { data: Record<string, unknown> | Record<string, unknown>[] }
  ).data;
}
function field(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === "string" ? String(record[key]) : "";
}
export async function inspectCloud(value: StagingIntake): Promise<string[]> {
  const issues: string[] = [];
  try {
    const profile = configProfile();
    if (profile.tenancy !== value.tenancyId || profile.region !== value.region)
      throw new Error("OCI CLI profile tenancy/region differs from intake");
    const version = spawnSync(
      process.platform === "win32" ? "oci.exe" : "oci",
      ["--version"],
      {
        shell: false,
        encoding: "utf8",
        timeout: 10000,
        windowsHide: true,
      },
    );
    if (version.error || version.status !== 0)
      throw new Error("OCI CLI executable or authentication unavailable");
    const [
      tenancyRaw,
      compartmentRaw,
      regionsRaw,
      shapesRaw,
      quotaRaw,
      zoneRaw,
    ] = readOnlyCommands(value).map((command) => data(cli(command)));
    const tenancy = tenancyRaw as Record<string, unknown>;
    const compartment = compartmentRaw as Record<string, unknown>;
    const regions = regionsRaw as Record<string, unknown>[];
    const shapes = shapesRaw as Record<string, unknown>[];
    const quota = quotaRaw as Record<string, unknown>;
    if (field(tenancy, "id") !== value.tenancyId)
      issues.push("Tenancy identity mismatch");
    issues.push(...validateCompartmentMetadata(compartment, value));
    if (
      !regions.some(
        (item) =>
          field(item, "region-name") === value.region &&
          field(item, "status") === "READY",
      )
    )
      issues.push("Selected region is not a ready tenancy subscription");
    if (!shapes.some((item) => field(item, "shape") === value.shape))
      issues.push("Selected shape is not listed for the chosen compartment/AD");
    const available = Number(quota.available);
    if (!Number.isFinite(available) || available < value.quotaNeeded)
      issues.push(
        "Selected compute quota/availability is insufficient or unavailable",
      );
    if (value.rehearsalMode === "public-dns") {
      if (!zoneRaw || !value.zoneName)
        throw new Error("Public DNS zone response is missing");
      const zone = zoneRaw as Record<string, unknown>;
      if (
        field(zone, "name").replace(/\.$/, "") !== value.zoneName ||
        field(zone, "scope") !== "GLOBAL"
      )
        issues.push("Public DNS zone identity/scope mismatch");
      const ociNameservers = Array.isArray(zone.nameservers)
        ? zone.nameservers
            .map((item) =>
              typeof item === "object" && item !== null
                ? String((item as Record<string, unknown>).hostname || "")
                : "",
            )
            .filter(Boolean)
        : [];
      let delegated: string[];
      try {
        delegated = await resolveNs(value.zoneName);
      } catch {
        throw new Error("Public DNS delegation lookup failed");
      }
      const normalize = (entry: string) =>
        entry.toLowerCase().replace(/\.$/, "");
      if (
        !ociNameservers.length ||
        !delegated.length ||
        !delegated.every((ns) =>
          ociNameservers.map(normalize).includes(normalize(ns)),
        )
      )
        issues.push(
          "Public DNS delegation does not match OCI zone nameservers",
        );
    }
  } catch (error) {
    issues.push(
      error instanceof Error ? error.message : "OCI read-only preflight failed",
    );
  }
  return issues;
}
if (mode !== "preflight" && mode !== "plan")
  throw new Error(
    "Usage: pnpm staging:preflight|staging:plan [--offline] [--intake=.local/staging/intake.json] [--report=.local/staging/plan.md]",
  );
const intakeFile = localPath(option("intake", ".local/staging/intake.json"));
const reportFile = localPath(
  option("report", ".local/staging/" + mode + ".md"),
);
if (!existsSync(intakeFile))
  throw new Error(
    "Missing local intake. Copy deploy/staging-intake.template.json to .local/staging/intake.json and replace every placeholder.",
  );
const raw = JSON.parse(readFileSync(intakeFile, "utf8")) as unknown;
const parsed = validateIntake(raw);
const issues = [...parsed.issues];
const inspection = offline
  ? "offline"
  : parsed.intake && issues.length === 0
    ? "attempted"
    : "blocked";
if (inspection === "attempted" && parsed.intake)
  issues.push(...(await inspectCloud(parsed.intake)));
mkdirSync(dirname(reportFile), { recursive: true });
writeFileSync(
  reportFile,
  report({
    intake: parsed.intake,
    rehearsalMode: parsed.rehearsalMode,
    issues,
    inspection,
  }),
  { mode: 0o600 },
);
console.log(
  "Staging " +
    mode +
    ": " +
    (issues.length
      ? "BLOCKED"
      : offline
        ? "STATIC INPUT VALID; OCI UNVERIFIED"
        : "READY FOR HUMAN REVIEW") +
    "; sanitized report: " +
    relative(process.cwd(), reportFile),
);
if (issues.length) process.exitCode = 1;
