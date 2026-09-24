/** Render sanitized, mode-specific staging evidence; never include OCIDs, credentials or URLs. */
import { TENANCY_ROOT_DENY } from "./staging-validation.ts";
import type { RehearsalMode, StagingIntake } from "./staging-validation.ts";

export type ReportInspection = "offline" | "blocked" | "attempted";
export type StagingReportInput = {
  intake?: StagingIntake;
  rehearsalMode?: RehearsalMode;
  issues: string[];
  inspection: ReportInspection;
};

export function report({
  intake,
  rehearsalMode,
  issues,
  inspection,
}: StagingReportInput): string {
  const mode = intake?.rehearsalMode ?? rehearsalMode;
  const privateMode = mode === "private-no-dns";
  const publicMode = mode === "public-dns";
  const lines = [
    "# OCI staging readiness evidence",
    "",
    "Generated at: " + new Date().toISOString(),
    "Rehearsal mode: " + (mode ?? "INVALID/UNRESOLVED"),
    "Inspection: " +
      (inspection === "offline"
        ? "offline static validation; OCI not queried"
        : inspection === "blocked"
          ? "OCI not queried because intake validation is blocked"
          : privateMode
            ? "read-only OCI metadata attempted; public DNS deliberately not queried"
            : "read-only OCI metadata and public DNS attempted"),
    "Result: " +
      (issues.length
        ? "BLOCKED"
        : inspection === "offline"
          ? "STATIC INPUT VALID; OCI UNVERIFIED"
          : inspection === "attempted"
            ? "READY FOR HUMAN REVIEW; NO RESOURCES CHANGED"
            : "BLOCKED"),
    "",
    "## Checks",
    ...(issues.length
      ? issues.map((issue) => "- BLOCKED: " + issue)
      : inspection === "offline"
        ? [
            "- Static intake passed; OCI CLI, quota, shape, capacity and cost were not checked.",
          ]
        : [
            "- Static intake, production-deny, network, CLI profile, tenancy, compartment, region, shape and quota checks passed." +
              (privateMode
                ? " Public DNS was not checked."
                : " Public DNS delegation was checked."),
          ]),
    "",
    "## Proposed targets and sequence",
  ];
  if (intake) {
    lines.push(
      "- Compartment label: " +
        intake.expectedCompartmentName +
        " (OCID intentionally omitted)",
      "- Region/AD: " + intake.region + " / " + intake.availabilityDomain,
      "- Shape: " +
        intake.shape +
        " / " +
        intake.architecture +
        " / " +
        intake.ocpus +
        " OCPU / " +
        intake.memoryGb +
        " GiB",
      "- Boot disk: " +
        intake.bootVolumeGb +
        " GiB; quota requested: " +
        intake.quotaNeeded +
        " " +
        intake.quotaLimitName,
      "- Resource labels: " + Object.values(intake.resourceNames).join(", "),
      "- Reviewed exact commit: " + intake.releaseCommit,
    );
  }
  if (intake?.productionDenyIds.includes(TENANCY_ROOT_DENY))
    lines.push(
      "- Deny boundary: TENANCY_ROOT resolves from tenancyId in memory; root targets are forbidden and OCIDs are omitted.",
    );
  if (privateMode) {
    if (intake)
      lines.push(
        "- Hostname/zone: null / null; no public domain is assumed.",
        "- Public subnet/edge labels are reserved only; do not create them for private mode.",
        "- Network: no public IP or public TCP ingress; OCI Bastion administration only; API, worker, metrics and PostgreSQL loopback/private.",
      );
    else
      lines.push(
        "- Private mode recognized; network and target assertions remain unverified until every blocked input is resolved.",
      );
    lines.push(
      "- DEFERRED/UNVERIFIED: public DNS, public TLS/ACME, internet browser flow, public WebSocket validation, public alert delivery and public security edge.",
      "- Off-host backup is UNVERIFIED until a free or approved remote target and separate key custody are selected and tested.",
    );
  } else if (publicMode) {
    if (intake)
      lines.push(
        "- Hostname/zone: " + intake.hostname + " / " + intake.zoneName,
        "- Network: public Caddy TCP 80/443 only; API, worker and PostgreSQL private; PostgreSQL loopback.",
      );
    else
      lines.push(
        "- Public mode recognized; owned DNS, ACME/TLS and reviewed TCP 80/443 remain mandatory, with targets withheld until validation passes.",
      );
  } else {
    lines.push(
      "- No execution path selected; set a valid rehearsalMode before operator review.",
    );
  }
  lines.push(
    "- Cost gate: ZERO PLANNED COST REQUESTED, NOT VERIFIED. Operator must confirm Always Free eligibility, capacity, public IP, boot/volume/storage, egress, Object Storage, and a $0 estimate in the OCI Console before any creation.",
    "",
    "1. Obtain named sign-offs and inspect separate Unix identities; no host preparation has been executed.",
    "2. Operator reviews selected mode, network, quota, actual Console pricing/eligibility and security gates before any provisioning.",
    privateMode
      ? issues.length
        ? "3. Resolve blocked private intake fields; administration only. Public DNS/TLS, internet browser and WebSocket checks remain deferred."
        : "3. Administration-only private rehearsal: no public Caddy listener or host firewall 80/443 accept rule. Public DNS/TLS, internet browser and WebSocket checks remain deferred."
      : publicMode
        ? issues.length
          ? "3. Resolve blocked public intake fields; owned DNS, ACME/TLS and public edge review remain required."
          : "3. Prepare exact-commit release; approve migrations separately; validate public TLS/gameplay/WebSocket and alerts."
        : "3. Set a valid rehearsalMode; no public or private execution path is selected.",
    "4. Restore only to an empty recovery target; off-host encryption/transfer requires a separately approved target and key custodian.",
    "5. Record any future cutover decision separately from deployment; review cost control or teardown.",
    "",
    "No OCI create/update/delete command was run. No secret, OCID, key, or database URL is included in this report.",
  );
  return lines.join("\n") + "\n";
}
