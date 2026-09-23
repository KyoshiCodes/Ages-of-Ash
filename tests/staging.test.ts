/** Staging preparation guards: reject unsafe intake and prevent privilege boundary drift. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import template from "../deploy/staging-intake.template.json";
import {
  placeholderPaths,
  readOnlyCommands,
  requiredRoles,
  validateIntake,
} from "../scripts/staging-validation.ts";

function fixture() {
  return {
    ...structuredClone(template),
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
      ...template.network,
      vcnCidr: "10.42.0.0/16",
      publicSubnetCidr: "10.42.1.0/24",
      privateSubnetCidr: "10.42.2.0/24",
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
    ).toContain(
      "network: only public TCP 80/443 to Caddy; no public API/worker/PostgreSQL",
    );
    expect(
      validateIntake({
        ...base,
        network: { ...base.network, publicIngressTcp: [80, 443, 5432] },
      }).issues.length,
    ).toBeGreaterThan(0);
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
    expect(readFileSync(join("deploy", "provision.mjs"), "utf8")).toContain(
      "--approve-host-provisioning",
    );
  });
});
