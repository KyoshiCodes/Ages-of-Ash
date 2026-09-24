/** Staging preparation guards: reject unsafe intake and prevent privilege boundary drift. */
import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import template from "../deploy/staging-intake.template.json";
import publicTemplate from "../deploy/staging-intake.public.template.json";
import { report } from "../scripts/staging-report.ts";
import {
  placeholderPaths,
  readOnlyCommands,
  requiredRoles,
  TENANCY_ROOT_DENY,
  validateCompartmentMetadata,
  validateIntake,
} from "../scripts/staging-validation.ts";

function fixture() {
  return {
    ...structuredClone(publicTemplate),
    tenancyId: "ocid1.tenancy.oc1..stagingtenancy",
    compartmentId: "ocid1.compartment.oc1..stagingcompartment",
    productionDenyIds: [TENANCY_ROOT_DENY, "ocid1.compartment.oc1..production"],
    region: "us-ashburn-1",
    availabilityDomain: "AD-1",
    quotaLimitName: "standard-a1-core-regional-count",
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
    ocpus: 1,
    memoryGb: 6,
    quotaNeeded: 2,
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
  it("resolves TENANCY_ROOT locally and keeps dedicated production compartments denied", () => {
    for (const base of [privateFixture(), fixture()]) {
      const rootOnly = { ...base, productionDenyIds: [TENANCY_ROOT_DENY] };
      expect(validateIntake(rootOnly).issues).toEqual([]);
      expect(validateIntake(base).issues).toEqual([]);
      const selectedRoot = validateIntake({
        ...rootOnly,
        compartmentId: rootOnly.tenancyId,
      });
      expect(selectedRoot.issues).toContain(
        "compartmentId: root tenancy is not staging isolation",
      );
      expect(selectedRoot.issues).toContain(
        "productionDenyIds: selected tenancy/compartment is prohibited",
      );
      expect(
        validateIntake({
          ...base,
          compartmentId: base.productionDenyIds[1],
        }).issues,
      ).toContain(
        "productionDenyIds: selected tenancy/compartment is prohibited",
      );
      expect(
        validateIntake({
          ...base,
          productionDenyIds: [base.productionDenyIds[1]],
        }).issues,
      ).toContain("productionDenyIds: TENANCY_ROOT is required");
      expect(
        validateIntake({
          ...base,
          productionDenyIds: [base.tenancyId],
        }).issues,
      ).toContain("productionDenyIds: use TENANCY_ROOT instead of a root OCID");
      expect(
        validateIntake({
          ...base,
          productionDenyIds: ["ROOT", base.productionDenyIds[1]],
        }).intake,
      ).toBeUndefined();
      for (const app of ["ages-stg-root-app", "ages-stg-second-crown-app"]) {
        expect(
          validateIntake({
            ...base,
            resourceNames: { ...base.resourceNames, app },
          }).issues,
        ).toContain(
          "resource names: production/live/root tokens are prohibited",
        );
      }
    }
  });
  it("checks the live compartment metadata is a direct child of tenancy root", () => {
    const intake = validateIntake(privateFixture()).intake!;
    const child = {
      id: intake.compartmentId,
      name: "ages-staging",
      "compartment-id": intake.tenancyId,
      "lifecycle-state": "ACTIVE",
    };
    expect(validateCompartmentMetadata(child, intake)).toEqual([]);
    expect(
      validateCompartmentMetadata(
        { ...child, "compartment-id": "ocid1.compartment.oc1..other" },
        intake,
      ),
    ).toContain(
      "Staging compartment must be a direct child of the selected tenancy root",
    );
    expect(
      validateCompartmentMetadata({ ...child, id: intake.tenancyId }, intake),
    ).toContain("Compartment identity/name/state mismatch");
  });
  it("rejects production identifiers, root tenancy and unsafe public network", () => {
    const base = fixture();
    expect(
      validateIntake({ ...base, compartmentId: base.productionDenyIds[1] })
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
      { ...base, compartmentId: base.productionDenyIds[1] },
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
    const offline = report({
      intake,
      rehearsalMode: intake.rehearsalMode,
      issues: [],
      inspection: "offline",
    });
    const live = report({
      intake,
      rehearsalMode: intake.rehearsalMode,
      issues: [],
      inspection: "attempted",
    });
    for (const evidence of [offline, live]) {
      expect(evidence).toContain("Rehearsal mode: private-no-dns");
      expect(evidence).toContain(
        "- Shape: VM.Standard.A1.Flex / arm64 / 1 OCPU / 6 GiB",
      );
      expect(evidence).toContain("- Boot disk: 50 GiB");
      expect(evidence).toContain(
        "- Required available A1 core quota: 2 standard-a1-core-regional-count",
      );
      expect(evidence).toContain(
        "- Reviewed/pinned release baseline: " + intake.releaseCommit,
      );
      expect(evidence).not.toContain("quota requested:");
      expect(evidence).not.toContain("Reviewed exact commit:");
      expect(evidence).toContain(
        "DEFERRED/UNVERIFIED: public DNS, public TLS/ACME",
      );
      expect(evidence).toContain("internet browser flow");
      expect(evidence).toContain("public WebSocket validation");
      expect(evidence).toContain("public alert delivery");
      expect(evidence).not.toContain(
        "3. Prepare exact-commit release; approve migrations separately; validate public TLS/gameplay/WebSocket and alerts.",
      );
      expect(evidence).toContain("Off-host backup is UNVERIFIED");
      expect(evidence).toContain("ZERO PLANNED COST REQUESTED, NOT VERIFIED");
      expect(evidence).toContain("Deny boundary: TENANCY_ROOT");
      expect(evidence).not.toContain(intake.tenancyId);
      expect(evidence).not.toContain(intake.compartmentId);
      expect(evidence).not.toContain(intake.productionDenyIds[1]);
    }
    expect(live).toContain("public DNS deliberately not queried");
    const publicIntake = validateIntake(fixture()).intake!;
    const publicEvidence = report({
      intake: publicIntake,
      rehearsalMode: publicIntake.rehearsalMode,
      issues: [],
      inspection: "attempted",
    });
    expect(publicEvidence).toContain("Rehearsal mode: public-dns");
    expect(publicEvidence).toContain(
      "- Required available A1 core quota: 2 standard-a1-core-regional-count",
    );
    expect(publicEvidence).toContain(
      "- Reviewed/pinned release baseline: " + publicIntake.releaseCommit,
    );
    expect(publicEvidence).toContain("Deny boundary: TENANCY_ROOT");
    expect(publicEvidence).not.toContain(publicIntake.tenancyId);
    expect(publicEvidence).not.toContain(publicIntake.compartmentId);
    expect(publicEvidence).not.toContain(publicIntake.productionDenyIds[1]);
    expect(publicEvidence).toContain("Public DNS delegation was checked");
    expect(publicEvidence).toContain(
      "validate public TLS/gameplay/WebSocket and alerts",
    );
    expect(publicEvidence).not.toContain("DEFERRED/UNVERIFIED: public DNS");
    const nonA1 = validateIntake({
      ...fixture(),
      shape: "VM.Standard.E5.Flex",
      architecture: "x86_64",
      quotaLimitName: "standard-e5-core-count",
    }).intake!;
    expect(
      report({
        intake: nonA1,
        issues: [],
        inspection: "offline",
      }),
    ).toContain("- Required available compute quota: 2 standard-e5-core-count");
  });
  it("keeps a recognized private mode when other inputs block validation", () => {
    const incomplete = {
      ...privateFixture(),
      ocpus: 1,
      memoryGb: 6,
      tenancyId: "<TENANCY_OCID>",
      compartmentId: "<STAGING_COMPARTMENT_OCID>",
      productionDenyIds: [TENANCY_ROOT_DENY, "<PRODUCTION_COMPARTMENT_OCID>"],
      availabilityDomain: "<AVAILABILITY_DOMAIN>",
      quotaLimitName: "<OCI_COMPUTE_LIMIT_NAME>",
      network: {
        ...privateFixture().network,
        vcnCidr: "<VCN_CIDR>",
      },
    };
    const parsed = validateIntake(incomplete);
    expect(parsed.intake).toBeUndefined();
    expect(parsed.rehearsalMode).toBe("private-no-dns");
    expect(parsed.issues).toHaveLength(6);
    const evidence = report({
      intake: parsed.intake,
      rehearsalMode: parsed.rehearsalMode,
      issues: parsed.issues,
      inspection: "offline",
    });
    expect(evidence).toContain("Rehearsal mode: private-no-dns");
    expect(evidence).toContain("Result: BLOCKED");
    expect(evidence).toContain(
      "DEFERRED/UNVERIFIED: public DNS, public TLS/ACME",
    );
    expect(evidence).toContain("Off-host backup is UNVERIFIED");
    expect(evidence).toContain("3. Resolve blocked private intake fields");
    expect(evidence).not.toContain(
      "validate public TLS/gameplay/WebSocket and alerts",
    );
    const emptyDns = validateIntake({
      ...privateFixture(),
      hostname: "",
      zoneName: "",
    });
    expect(emptyDns.issues.length).toBeGreaterThan(0);
    expect(emptyDns.rehearsalMode).toBe("private-no-dns");
  });
  it("renders a blocked private report through the offline CLI without cloud calls", () => {
    const root = join(process.cwd(), ".local", "staging");
    mkdirSync(root, { recursive: true });
    const prefix = "mode-report-" + randomUUID();
    const intakeFile = join(root, prefix + ".json");
    const reportFile = join(root, prefix + ".md");
    const raw = { ...privateFixture(), tenancyId: "<TENANCY_OCID>" };
    writeFileSync(intakeFile, JSON.stringify(raw));
    try {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/staging.ts",
          "plan",
          "--offline",
          "--intake=" + intakeFile,
          "--report=" + reportFile,
        ],
        { shell: false, encoding: "utf8", windowsHide: true },
      );
      expect(result.status).toBe(1);
      const evidence = readFileSync(reportFile, "utf8");
      expect(evidence).toContain("Rehearsal mode: private-no-dns");
      expect(evidence).toContain("Result: BLOCKED");
      expect(evidence.match(/^- BLOCKED:/gm)).toHaveLength(1);
      expect(evidence).not.toContain(
        "validate public TLS/gameplay/WebSocket and alerts",
      );
    } finally {
      rmSync(intakeFile, { force: true });
      rmSync(reportFile, { force: true });
    }
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
  it("scopes selected-AD shape discovery and regional A1 quota availability separately", () => {
    for (const raw of [privateFixture(), fixture()]) {
      const parsed = validateIntake(raw);
      expect(parsed.issues).toEqual([]);
      const intake = parsed.intake!;
      const commands = readOnlyCommands(intake);
      expect(commands.find((command) => command[0] === "compute")).toEqual([
        "compute",
        "shape",
        "list",
        "--compartment-id",
        intake.compartmentId,
        "--availability-domain",
        intake.availabilityDomain,
        "--all",
        "--region",
        intake.region,
        "--output",
        "json",
      ]);
      const quota = commands.find((command) => command[0] === "limits");
      expect(quota).toEqual([
        "limits",
        "resource-availability",
        "get",
        "--compartment-id",
        intake.compartmentId,
        "--service-name",
        "compute",
        "--limit-name",
        "standard-a1-core-regional-count",
        "--region",
        intake.region,
        "--output",
        "json",
      ]);
      expect(quota).not.toContain("--availability-domain");
      expect(intake.productionDenyIds).toContain(TENANCY_ROOT_DENY);
      expect(
        validateIntake({ ...raw, compartmentId: raw.tenancyId }).issues,
      ).toContain("compartmentId: root tenancy is not staging isolation");
      const evidence = report({ intake, issues: [], inspection: "offline" });
      expect(evidence).not.toContain(intake.tenancyId);
      expect(evidence).not.toContain(intake.compartmentId);
    }
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
