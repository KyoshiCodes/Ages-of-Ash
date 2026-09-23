/** Validate staging inputs without cloud side effects; never include credentials or OCIDs in reports. */
import { z } from "zod";

export const requiredRoles = [
  "provisioner",
  "api",
  "worker",
  "release",
  "backup",
  "restore",
  "objectWriter",
  "objectReader",
  "keyCustodian",
  "logAlert",
] as const;
export const requiredEnvironmentNames = {
  api: ["DATABASE_URL", "APP_ORIGIN", "NODE_ENV", "HOST", "PORT", "OPS_TOKEN"],
  worker: [
    "DATABASE_URL",
    "NODE_ENV",
    "WORKER_PORT",
    "APP_ORIGIN",
    "HOST",
    "OPS_TOKEN",
  ],
  backup: ["DATABASE_URL", "BACKUP_DIR", "PG_BIN"],
  release: ["DATABASE_URL", "NODE_ENV"],
} as const;

const ocid = z.string().regex(/^ocid1\.[a-z0-9-]+\.[a-z0-9-]+\..+$/);
const resource = z.string().regex(/^ages-stg-[a-z0-9-]+$/);
const cidr = z.string().regex(/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/);
export const intakeSchema = z.object({
  environment: z.literal("staging"),
  tenancyId: ocid,
  compartmentId: ocid,
  expectedCompartmentName: z.string().regex(/^ages-staging(?:-[a-z0-9-]+)?$/),
  productionDenyIds: z.array(ocid).min(1),
  region: z.string().regex(/^[a-z]+-[a-z]+-\d+$/),
  availabilityDomain: z.string().min(3),
  shape: z.string().regex(/^VM\.Standard\.[A-Za-z0-9.]+$/),
  architecture: z.enum(["arm64", "x86_64"]),
  ocpus: z.number().positive(),
  memoryGb: z.number().positive(),
  bootVolumeGb: z.number().int().min(50),
  quotaLimitName: z.string().regex(/^[a-z0-9-]+$/),
  quotaNeeded: z.number().positive(),
  hostname: z.string().regex(/^staging\.[a-z0-9.-]+\.[a-z]{2,}$/),
  zoneName: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
  releaseCommit: z.string().regex(/^[a-f0-9]{40}$/),
  resourceNames: z.object({
    vcn: resource,
    publicSubnet: resource,
    privateSubnet: resource,
    proxy: resource,
    app: resource,
    database: resource,
  }),
  network: z.object({
    vcnCidr: cidr,
    publicSubnetCidr: cidr,
    privateSubnetCidr: cidr,
    publicIngressTcp: z.array(z.number().int().min(1).max(65535)),
    apiPublicIp: z.boolean(),
    workerPublicIp: z.boolean(),
    databasePublicIp: z.boolean(),
    postgresPublicIngress: z.boolean(),
    postgresListen: z.literal("127.0.0.1"),
    adminAccess: z.literal("oci-bastion"),
  }),
  environmentFiles: z.object({
    api: z.object({
      path: z.literal("/etc/ages/api.env"),
      names: z.array(z.string()),
    }),
    worker: z.object({
      path: z.literal("/etc/ages/worker.env"),
      names: z.array(z.string()),
    }),
    backup: z.object({
      path: z.literal("/etc/ages/backup.env"),
      names: z.array(z.string()),
    }),
    release: z.object({
      path: z.literal("/etc/ages/migrate.env"),
      names: z.array(z.string()),
    }),
  }),
});
export type StagingIntake = z.infer<typeof intakeSchema>;

export function placeholderPaths(value: unknown, path = "intake"): string[] {
  if (typeof value === "string")
    return /<[^>]+>|REPLACE_ME|YOUR_|PLACEHOLDER/i.test(value) ? [path] : [];
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      placeholderPaths(child, path + "." + index),
    );
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, child]) =>
      placeholderPaths(child, path + "." + key),
    );
  return [];
}

function ipv4(cidrValue: string): [number, number] | null {
  const [address, bitsText] = cidrValue.split("/");
  const bits = Number(bitsText);
  const octets = address?.split(".").map(Number);
  if (
    !octets ||
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255) ||
    bits < 0 ||
    bits > 32
  )
    return null;
  const unsigned = octets.reduce((acc, part) => (acc * 256 + part) >>> 0, 0);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return [(unsigned & mask) >>> 0, bits];
}
function overlaps(first: string, second: string): boolean {
  const a = ipv4(first);
  const b = ipv4(second);
  if (!a || !b) return true;
  const bits = Math.min(a[1], b[1]);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (a[0] & mask) >>> 0 === (b[0] & mask) >>> 0;
}
function inside(child: string, parent: string): boolean {
  const c = ipv4(child);
  const p = ipv4(parent);
  if (!c || !p || c[1] < p[1]) return false;
  const mask = p[1] === 0 ? 0 : (0xffffffff << (32 - p[1])) >>> 0;
  return (c[0] & mask) >>> 0 === p[0];
}
export function validateIntake(raw: unknown): {
  intake?: StagingIntake;
  issues: string[];
} {
  const issues = placeholderPaths(raw).map(
    (path) => path + ": replace placeholder",
  );
  const parsed = intakeSchema.safeParse(raw);
  if (!parsed.success) {
    issues.push(
      ...parsed.error.issues.map(
        (issue) => issue.path.join(".") + ": invalid or missing",
      ),
    );
    return { issues: [...new Set(issues)] };
  }
  const value = parsed.data;
  if (value.tenancyId === value.compartmentId)
    issues.push("compartmentId: root tenancy is not staging isolation");
  if (
    value.productionDenyIds.includes(value.tenancyId) ||
    value.productionDenyIds.includes(value.compartmentId)
  )
    issues.push(
      "productionDenyIds: selected tenancy/compartment is prohibited",
    );
  if (!value.hostname.endsWith("." + value.zoneName))
    issues.push("hostname: must be within the selected DNS zone");
  if (
    /(^|[.-])(prod|production|live)([.-]|$)/i.test(
      JSON.stringify({
        names: value.resourceNames,
        hostname: value.hostname,
        compartment: value.expectedCompartmentName,
      }),
    )
  )
    issues.push("resource names: production/live tokens are prohibited");
  if (value.architecture === "arm64" && !value.shape.includes(".A1."))
    issues.push("shape: ARM64 requires a reviewed A1 shape");
  if (value.architecture === "x86_64" && value.shape.includes(".A1."))
    issues.push("shape: A1 is ARM64");
  if (
    !inside(value.network.publicSubnetCidr, value.network.vcnCidr) ||
    !inside(value.network.privateSubnetCidr, value.network.vcnCidr) ||
    overlaps(value.network.publicSubnetCidr, value.network.privateSubnetCidr)
  )
    issues.push("network: subnets must be distinct and within the VCN");
  if (
    value.network.apiPublicIp ||
    value.network.workerPublicIp ||
    value.network.databasePublicIp ||
    value.network.postgresPublicIngress ||
    value.network.publicIngressTcp.some((port) => ![80, 443].includes(port)) ||
    ![80, 443].every((port) => value.network.publicIngressTcp.includes(port))
  )
    issues.push(
      "network: only public TCP 80/443 to Caddy; no public API/worker/PostgreSQL",
    );
  const resourceValues = Object.values(value.resourceNames);
  if (new Set(resourceValues).size !== resourceValues.length)
    issues.push("resourceNames: names must be unique");
  for (const [role, required] of Object.entries(requiredEnvironmentNames)) {
    const actual =
      value.environmentFiles[role as keyof typeof requiredEnvironmentNames]
        .names;
    if (!required.every((name) => actual.includes(name)))
      issues.push(
        "environmentFiles." + role + ": required variable names missing",
      );
    if (actual.some((name) => !/^[A-Z][A-Z0-9_]*$/.test(name)))
      issues.push(
        "environmentFiles." + role + ": invalid environment variable name",
      );
  }
  return { intake: value, issues: [...new Set(issues)] };
}

/** Fixed allowlist of read-only OCI CLI operations. Values remain literal arguments. */
export function readOnlyCommands(value: StagingIntake): string[][] {
  const region = ["--region", value.region, "--output", "json"];
  return [
    ["iam", "tenancy", "get", "--tenancy-id", value.tenancyId, ...region],
    [
      "iam",
      "compartment",
      "get",
      "--compartment-id",
      value.compartmentId,
      ...region,
    ],
    [
      "iam",
      "region-subscription",
      "list",
      "--tenancy-id",
      value.tenancyId,
      ...region,
    ],
    [
      "compute",
      "shape",
      "list",
      "--compartment-id",
      value.compartmentId,
      "--availability-domain",
      value.availabilityDomain,
      "--all",
      ...region,
    ],
    [
      "limits",
      "resource-availability",
      "get",
      "--compartment-id",
      value.compartmentId,
      "--service-name",
      "compute",
      "--limit-name",
      value.quotaLimitName,
      "--availability-domain",
      value.availabilityDomain,
      ...region,
    ],
    [
      "dns",
      "zone",
      "get",
      "--zone-name-or-id",
      value.zoneName,
      "--scope",
      "GLOBAL",
      ...region,
    ],
  ];
}
