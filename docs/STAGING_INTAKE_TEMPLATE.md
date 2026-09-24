# Staging intake template — operator copy, do not commit completed form

The first rehearsal uses explicit `"rehearsalMode": "private-no-dns"`. Copy `deploy/staging-intake.template.json` to ignored `.local/staging/intake.json`. The future public route has a separate `deploy/staging-intake.public.template.json` with `"rehearsalMode": "public-dns"`. A missing mode never selects a default.

In private mode, `hostname` and `zoneName` must both be JSON `null`; do not invent a domain or put a sentinel string there. `publicIngressTcp` is `[]`, `edgePublicIp`, `apiPublicIp`, `workerPublicIp`, `databasePublicIp`, and `postgresPublicIngress` are `false`, `postgresListen` is `127.0.0.1`, and `adminAccess` is `oci-bastion`. The `publicSubnet` and `proxy` names are reserved future labels only: they do **not** authorize a public subnet, public IP, listener, security rule, or host firewall opening. No external DNS/ACME/TLS or public browser/WebSocket/alert check is claimed. Public mode requires a real owned zone/hostname and separately reviewed TCP 80/443 ingress; it rejects null/sentinel DNS.

| Input | Private rehearsal evidence required |
| --- | --- |
| Tenancy, staging compartment, production deny list | Read-only profile tenancy; dedicated ages-staging direct child compartment; productionDenyIds must contain literal TENANCY_ROOT. Separate production-compartment OCIDs may be added only to the ignored local intake. Root can never be selected. |
| Region, AD, shape, architecture, OCPU/RAM, disk | Operator checks **home-region Always Free eligibility**, selected shape/size, capacity, quota and boot/volume totals in the current OCI Console. Private static validation caps the proposed A1 Flex ARM64 plan at 2 OCPU/12 GiB and one 50 GiB boot volume; this is still not capacity or price proof. |
| Network and administration | Proposed private host has **no public IP or internet ingress**. Review VCN/private subnet, NSG/security-list effective union, host firewall default-deny and time-limited OCI Bastion path. No public 80/443 or 22 rule. Resolve package-update egress separately; do not assume a NAT gateway, service gateway or public IP costs $0. |
| Identity and recovery | Keep distinct release/API/worker/backup env files and DB roles; named primary/alternate owners in `RECOVERY_OWNERSHIP_TEMPLATE.md`; migration and restore approvals remain separate. |
| Exact commit | Reviewed 40-character SHA with passing Release foundation CI. |
| Cost gate | Before **any future creation**, operator checks OCI Console **Always Free** label/limits and obtains a **$0 planned estimate** for the complete proposed resource set, including compute, boot/block volume, public IP (none requested), Object Storage, egress, Bastion, logging/alerts, and any networking service. Record date, tenancy home region, shape, storage totals and estimate privately; abort if eligibility/capacity or $0 estimate cannot be confirmed. **No billing guarantee:** OCI terms, capacity and service eligibility can change. |
| Backup destination | Local dump/empty-target refusal remains testable. **Do not claim off-host backup** until a free/approved remote target, Object Storage eligibility if selected, encryption/key custody, retrieval and empty-target restore are approved and tested. |

Capacity and commit labels: ocpus and memoryGb are the allocation planned for one VM, and bootVolumeGb is that VM's boot disk. The current ignored private intake plans 1 OCPU / 6 GiB / 50 GiB. quotaNeeded is a separate minimum for OCI-reported available core quota at read-only preflight time (currently 2 standard-a1-core-regional-count); it does not request or deploy 2 OCPUs. The standard-a1-core-regional-count limit is regional: the read-only limits resource-availability get call checks it in the selected region without an availability-domain argument, while compute shape list still uses the selected availability domain. Live planning blocks when available quota is missing, non-finite or below quotaNeeded. releaseCommit records the reviewed/pinned release baseline in the intake; it need not equal the checkout generating this report. A later deployment still needs its own exact-commit review and approval.

Root-deny convention: TENANCY_ROOT is a supported literal deny-list value, not a placeholder or an OCID. Keep it in both private and future public intake. The validator resolves it in memory from the existing tenancyId and never prints the resolved OCID. Never paste the root OCID into Git or substitute it for the sentinel. In the current layout, the existing production-like workload is in tenancy root and ages-staging is a child, so a single TENANCY_ROOT entry is the correct minimum deny list. Add separate dedicated production-compartment OCIDs beside it only in the ignored local intake if they exist. Static validation rejects a missing sentinel, root or deny-listed target, and production/root tokens in staging resource targets; live read-only inspection also verifies direct-child parentage. A passing plan never authorizes provisioning, host preparation, deployment or recovery; the operator and scoped IAM must independently keep every later action in the approved child compartment.

Use only a local read-only OCI CLI API-key profile with tenancy, compartment, region, shape and quota permissions. Private mode omits DNS-zone and public NS calls; public mode requires them. Put `OCI_CLI_PROFILE` and optional `OCI_CLI_CONFIG_FILE` only in the operator session. Keep completed intake, CLI profile, OCIDs, names, credentials, estimates and reports outside Git and tickets; reports under `.local/staging` are ignored but still restricted evidence.

From native Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force .local/staging
Copy-Item deploy/staging-intake.template.json .local/staging/intake.json
# Fill all angle-bracket tokens privately; retain the explicit private-no-dns mode.
pnpm staging:plan --offline
pnpm staging:preflight
pnpm staging:plan
```

The offline command checks only static safety; it exits nonzero until placeholders are replaced. Live commands perform only fixed OCI `get`/`list` calls and write sanitized local reports. Their success is **not** a cost guarantee or authorization to provision. For later public staging, start from `deploy/staging-intake.public.template.json` and follow the separate public path in `OCI_STAGING_RUNBOOK.md` after obtaining a real domain and approvals.

Official eligibility references: [OCI Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) and [OCI Bastion overview](https://docs.oracle.com/en-us/iaas/Content/Bastion/Concepts/bastionoverview.htm). The operator must rely on their tenancy's current Console values at provisioning time.
