/** Staging preparation guards: reject unsafe intake and prevent privilege boundary drift. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import template from "../deploy/staging-intake.template.json";
import publicTemplate from "../deploy/staging-intake.public.template.json";
import { report } from "../scripts/staging-report.ts";
import {
  placeholderPaths,
  readOnlyCommands,
  requiredRoles,
  validateIntake,
} from "../scripts/staging-validation.ts";

function fixture() {
  return {
    ...structuredClone(publicTemplate),
    tenancyId: "ocid1.tenancy.oc1..stagingtenancy",
    compartmentId: "ocid1.compartment.oc1..stagingcompartment",
    productionDenyIds: ["ocid1.compartment.oc1..production"],
    region: "us-ashburn-1",
    availabilityDomain: "AD-1",
    quotaLimitName: "standard-a1-core-count",
    hostname: "staging.example.test",
    zoneName: "example.test",
    releaseCommit: "a".repeat(40),
    network: {
      ...publicTemplate.network,
      vcnCidr: "10.42.0.0/16",
      publicSubnetCidr: "10.42.1.0/24",
      privateSubnetCidr: "10.42.2.0/24",
    },
  };
}
function privateFixture() {
  const base = fixture();
  return {
    ...base,
    rehearsalMode: "private-no-dns",
    hostname: null,
    zoneName: null,
    network: {
      ...base.network,
      edgePublicIp: false,
      publicIngressTcp: [],
    },
  };
}
describe("OCI staging preparation", () => {
  it("rejects every unresolved template placeholder", () => {
    expect(placeholderPaths(template).length).toBeGreaterThan(5);
    expect(
      validateIntake(template).issues.some((issue) =>
        issue.includes("placeholder"),
      ),
    ).toBe(true);
  });
  it("accepts a complete isolated staging intake", () => {
    expect(validateIntake(fixture()).issues).toEqual([]);
  });
  it("rejects production identifiers, root tenancy and unsafe public network", () => {
    const base = fixture();
    expect(
      validateIntake({ ...base, compartmentId: base.productionDenyIds[0] })
        .issues,
    ).toContain(
      "productionDenyIds: selected tenancy/compartment is prohibited",
    );
    expect(
      validateIntake({ ...base, compartmentId: base.tenancyId }).issues,
    ).toContain("compartmentId: root tenancy is not staging isolation");
    expect(
      validateIntake({ ...base, hostname: "production.example.test" }).issues
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateIntake({
        ...base,
        network: { ...base.network, postgresPublicIngress: true },
      }).issues,
    ).toContain("network: no public API/worker/PostgreSQL");
    expect(
      validateIntake({
        ...base,
        network: { ...base.network, publicIngressTcp: [80, 443, 5432] },
      }).issues.length,
    ).toBeGreaterThan(0);
  });
  it("accepts private-no-dns only with no public exposure and skips DNS lookup", () => {
    const result = validateIntake(privateFixture());
    expect(result.issues).toEqual([]);
    expect(result.intake?.rehearsalMode).toBe("private-no-dns");
    const commands = readOnlyCommands(result.intake!);
    expect(commands).toHaveLength(5);
    expect(commands.some((command) => command[0] === "dns")).toBe(false);
  });
  it("rejects all private public-exposure paths, invented DNS, placeholders and production", () => {
    const base = privateFixture();
    const changes = [
      { ...base, network: { ...base.network, publicIngressTcp: [80] } },
      { ...base, network: { ...base.network, publicIngressTcp: [443] } },
      { ...base, network: { ...base.network, edgePublicIp: true } },
      { ...base, network: { ...base.network, apiPublicIp: true } },
      { ...base, network: { ...base.network, workerPublicIp: true } },
      { ...base, network: { ...base.network, databasePublicIp: true } },
      { ...base, network: { ...base.network, postgresPublicIngress: true } },
      { ...base, network: { ...base.network, postgresListen: "0.0.0.0" } },
      { ...base, hostname: "staging.example.test" },
      { ...base, zoneName: "example.test" },
      { ...base, region: "<OCI_REGION>" },
      { ...base, compartmentId: base.productionDenyIds[0] },
      {
        ...base,
        resourceNames: { ...base.resourceNames, app: "ages-stg-prod-app" },
      },
      { ...base, environment: "production" },
      {
        ...base,
        availabilityDomain:
          "AD-1" + String.fromCharCode(10) + "DATABASE_URL=secret",
      },
      { ...base, shape: "VM.Standard.E5.Flex", architecture: "x86_64" },
      { ...base, ocpus: 3 },
      { ...base, memoryGb: 13 },
      { ...base, bootVolumeGb: 100 },
    ];
    for (const candidate of changes)
      expect(validateIntake(candidate).issues.length).toBeGreaterThan(0);
    expect(
      validateIntake({ ...base, rehearsalMode: undefined }).issues.length,
    ).toBeGreaterThan(0);
  });
  it("keeps public DNS, owned hostname and TCP 80/443 mandatory", () => {
    const base = fixture();
    for (const candidate of [
      { ...base, hostname: null },
      { ...base, zoneName: null },
      { ...base, hostname: "private-no-dns", zoneName: "private-no-dns" },
      { ...base, network: { ...base.network, publicIngressTcp: [] } },
      { ...base, network: { ...base.network, edgePublicIp: false } },
    ])
      expect(validateIntake(candidate).issues.length).toBeGreaterThan(0);
    expect(readOnlyCommands(validateIntake(base).intake!)).toHaveLength(6);
  });
  it("reports private limits and unverified cost without claiming public readiness", () => {
    const intake = validateIntake(privateFixture()).intake!;
    const offline = report(intake, [], true);
    const live = report(intake, [], false);
    for (const evidence of [offline, live]) {
      expect(evidence).toContain("Rehearsal mode: private-no-dns");
      expect(evidence).toContain("DEFERRED/UNVERIFIED: external DNS, ACME/TLS");
      expect(evidence).toContain("public WebSocket");
      expect(evidence).toContain("Off-host backup is UNVERIFIED");
      expect(evidence).toContain("ZERO PLANNED COST REQUESTED, NOT VERIFIED");
      expect(evidence).not.toContain(intake.tenancyId);
      expect(evidence).not.toContain(intake.compartmentId);
    }
    expect(live).toContain("public DNS deliberately not queried");
    expect(report(validateIntake(fixture()).intake!, [], false)).toContain(
      "Public DNS delegation was checked",
    );
  });
  it("requires unique names, distinct subnets and all per-service environment variable names", () => {
    const base = fixture();
    expect(
      validateIntake({
        ...base,
        resourceNames: { ...base.resourceNames, app: base.resourceNames.proxy },
      }).issues.length,
    ).toBeGreaterThan(0);
    expect(
      validateIntake({
        ...base,
        network: {
          ...base.network,
          privateSubnetCidr: base.network.publicSubnetCidr,
        },
      }).issues.length,
    ).toBeGreaterThan(0);
    expect(
      validateIntake({
        ...base,
        environmentFiles: {
          ...base.environmentFiles,
          api: { ...base.environmentFiles.api, names: ["DATABASE_URL"] },
        },
      }).issues.length,
    ).toBeGreaterThan(0);
  });
  it("rejects partially overlapping subnet ranges", () => {
    const base = fixture();
    expect(
      validateIntake({
        ...base,
        network: { ...base.network, privateSubnetCidr: "10.42.1.128/25" },
      }).issues,
    ).toContain("network: subnets must be distinct and within the VCN");
  });
  it("only plans fixed read-only OCI commands with literal arguments", () => {
    const result = validateIntake(fixture());
    expect(result.intake).toBeDefined();
    const commands = readOnlyCommands(result.intake!);
    expect(commands).toHaveLength(6);
    for (const command of commands) {
      expect(["get", "list"]).toContain(command[2]);
      expect(command.join(" ")).not.toMatch(
        /\b(create|delete|update|launch|put)\b/,
      );
      expect(command).not.toContain("--debug");
    }
    expect(readFileSync(join("scripts", "staging.ts"), "utf8")).toContain(
      "shell: false",
    );
  });
  it("documents every distinct identity and keeps service env files separate", () => {
    const architecture = readFileSync(
      join("docs", "OCI_STAGING_ARCHITECTURE.md"),
      "utf8",
    );
    for (const role of requiredRoles)
      expect(architecture).toContain("| " + role + " |");
    const units = [
      ["ages-api.service", "ages-api", "api.env"],
      ["ages-worker.service", "ages-worker", "worker.env"],
      ["ages-backup.service", "ages-backup", "backup.env"],
    ] as const;
    for (const [name, user, envFile] of units) {
      const unit = readFileSync(join("deploy", name), "utf8");
      expect(unit).toContain("User=" + user);
      expect(unit).toContain("Group=" + user);
      expect(unit).toContain("EnvironmentFile=/etc/ages/" + envFile);
      expect(unit).not.toContain("ages.env");
    }
    const release = readFileSync(join("deploy", "release.mjs"), "utf8");
    expect(release).toContain("--approve-migrations");
    expect(release).toContain('"/etc/ages/migrate.env"');
    expect(release).toContain('"ages-release"');
    expect(release).not.toContain('"ages.env"');
    const wrapper = readFileSync(join("deploy", "deploy.ps1"), "utf8");
    expect(wrapper).toContain("merge-base --is-ancestor $Commit origin/main");
    expect(wrapper).toContain("checkout --detach $Commit");
    const provision = readFileSync(join("deploy", "provision.mjs"), "utf8");
    expect(provision).toContain("--approve-host-provisioning");
    expect(provision).toContain("--public-dns-mode");
    expect(provision).toContain("never use for private-no-dns");
  });
});
