# Staging intake template — operator copy, do not commit completed form

Copy `deploy/staging-intake.template.json` to `.local/staging/intake.json`. Fill every angle-bracket token from the operator-approved staging inventory. Keep the completed file outside Git. Do not paste CLI profiles, keys, database URLs, bucket OCIDs/names, certificates, tokens or personal names into the repository or a ticket. Record those in the approved operator vault/evidence store.

| Field | Required operator evidence |
| --- | --- |
| Tenancy, staging compartment, production deny list | Read-only OCI profile tenancy; dedicated `ages-staging` compartment; at least one production compartment OCID in local deny list. Never use tenancy root. |
| Region, AD, shape, architecture, OCPU/RAM, disk | Quota/cost approval; A1 ARM64 preferred only if capacity and native packages pass. x86_64 choice needs a recorded reason. |
| Quota limit name/needed units | Exact compute limit name from OCI console/limits API and units appropriate to chosen shape; shape listing is not allocation guarantee. |
| VCN/public/private CIDRs | Non-overlapping approved ranges; staging public VM and empty reserved private subnet. |
| DNS hostname and zone | Delegated, operator-owned public zone; staging subdomain only; no production hostname. |
| Resource names | `ages-stg-*` labels, unique and absent from production inventory. |
| Exact release SHA | 40-character reviewed commit with passing Release foundation job. |
| Environment variable names | API/worker/backup/migration files contain only their required names; values delivered separately by authorized owners. |
| Named role sign-offs | Complete `RECOVERY_OWNERSHIP_TEMPLATE.md` outside Git with primary/backup contacts, approval and escalation. |
| Cost/retention | Estimated VM, boot volume, Object Storage, egress, Bastion, DNS, alerts; owner and teardown date. |
| Alert/backup destinations | Non-secret references in the private evidence store; delivery, encryption recipient and restore ownership verified separately. |

Use a local OCI CLI API-key profile with read-only tenancy, compartment, region, shape, quota and DNS-zone permissions. Set `OCI_CLI_PROFILE` and, if needed, `OCI_CLI_CONFIG_FILE` only in the local operator session; never commit the profile. The preflight checks the profile's tenancy/region against intake and issues only fixed read-only CLI calls. Its report is sanitized but still operational evidence; store/retain it under restricted access.

From native Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force .local/staging
Copy-Item deploy/staging-intake.template.json .local/staging/intake.json
# Edit the local file and replace every placeholder.
pnpm staging:preflight
pnpm staging:plan
```

For schema/placeholder review without contacting OCI: `pnpm staging:plan --offline`. It is expected to exit nonzero until the intake is complete. Both live commands write ignored reports under `.local/staging` and make no cloud changes. A green plan permits a human review; it does not authorize provisioning.
