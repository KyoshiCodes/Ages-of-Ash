/** Render sanitized, mode-specific staging evidence; never include OCIDs, credentials or URLs. */
import type { StagingIntake } from "./staging-validation.ts";

export function report(
  value: StagingIntake | undefined,
  issues: string[],
  wasOffline: boolean,
): string {
  const privateMode = value?.rehearsalMode === "private-no-dns";
  const lines = [
    "# OCI staging readiness evidence",
    "",
    "Generated at: " + new Date().toISOString(),
    "Rehearsal mode: " + (value?.rehearsalMode ?? "INVALID/UNRESOLVED"),
    "Inspection: " +
      (wasOffline
        ? "offline static validation; OCI not queried"
        : privateMode
          ? "read-only OCI metadata; public DNS deliberately not queried"
          : "read-only OCI metadata and public DNS inspection"),
    "Result: " +
      (issues.length
        ? "BLOCKED"
        : wasOffline
          ? "STATIC INPUT VALID; OCI UNVERIFIED"
          : "READY FOR HUMAN REVIEW; NO RESOURCES CHANGED"),
    "",
    "## Checks",
    ...(issues.length
      ? issues.map((issue) => "- BLOCKED: " + issue)
      : wasOffline
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
  if (value) {
    lines.push(
      "- Compartment label: " +
        value.expectedCompartmentName +
        " (OCID intentionally omitted)",
      "- Region/AD: " + value.region + " / " + value.availabilityDomain,
      "- Shape: " +
        value.shape +
        " / " +
        value.architecture +
        " / " +
        value.ocpus +
        " OCPU / " +
        value.memoryGb +
        " GiB",
      "- Boot disk: " +
        value.bootVolumeGb +
        " GiB; quota requested: " +
        value.quotaNeeded +
        " " +
        value.quotaLimitName,
      "- Resource labels: " + Object.values(value.resourceNames).join(", "),
      "- Reviewed exact commit: " + value.releaseCommit,
    );
    if (privateMode) {
      lines.push(
        "- Hostname/zone: null / null; no public domain is assumed.",
        "- Public subnet/edge labels are reserved only; do not create them for private mode.",
        "- Network: no public IP or public TCP ingress; OCI Bastion administration only; API, worker, metrics and PostgreSQL loopback/private.",
        "- DEFERRED/UNVERIFIED: external DNS, ACME/TLS, public browser, public WebSocket, public alert delivery and public security edge.",
        "- Off-host backup is UNVERIFIED until a free or approved remote target and separate key custody are selected and tested.",
      );
    } else {
      lines.push(
        "- Hostname/zone: " + value.hostname + " / " + value.zoneName,
        "- Network: public Caddy TCP 80/443 only; API, worker and PostgreSQL private; PostgreSQL loopback.",
      );
    }
  }
  lines.push(
    "- Cost gate: ZERO PLANNED COST REQUESTED, NOT VERIFIED. Operator must confirm Always Free eligibility, capacity, public IP, boot/volume/storage, egress, Object Storage, and a $0 estimate in the OCI Console before any creation.",
    "",
    "1. Obtain named sign-offs and inspect separate Unix identities; no host preparation has been executed.",
    "2. Operator reviews selected mode, network, quota, actual Console pricing/eligibility and security gates before any provisioning.",
    privateMode
      ? "3. Administration-only private rehearsal: no public Caddy listener or host firewall 80/443 accept rule. Keep public TLS/gameplay/WebSocket validation deferred."
      : "3. Prepare exact-commit release; approve migrations separately; validate public TLS/gameplay/WebSocket and alerts.",
    "4. Restore only to an empty recovery target; off-host encryption/transfer requires a separately approved target and key custodian.",
    "5. Record any future cutover decision separately from deployment; review cost control or teardown.",
    "",
    "No OCI create/update/delete command was run. No secret, OCID, key, or database URL is included in this report.",
  );
  return lines.join("\n") + "\n";
}
