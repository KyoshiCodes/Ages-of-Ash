# OCI staging and recovery rehearsal — operator runbook

**Unexecuted preparation.** No resource, DNS, IAM, bucket, key, alert or person was created by this milestone. Commands below are for an authorized operator after filling `STAGING_INTAKE_TEMPLATE.md` and `RECOVERY_OWNERSHIP_TEMPLATE.md` privately. Replace all angle-bracket tokens in the operator session, never in Git. Do not record secrets, private keys, database URLs, auth cookies or raw player data in evidence. Read `OCI_STAGING_ARCHITECTURE.md`, `RECOVERY.md` and `deploy/README.md` first. A successful preflight is a technical check, not approval.

## Mode gate — private rehearsal first

The first rehearsal selects explicit private-no-dns in the default intake template. Sections 2–9 below describe the **future public-dns** route and must not be followed for private-no-dns. In particular, deploy/provision.mjs opens host 80/443 and is public-only; never run it on an administration-only private host. No private host provision/deployment procedure is executed or approved by this milestone.

Root boundary for both modes: keep literal TENANCY_ROOT in productionDenyIds. It resolves from the existing tenancyId locally; never paste the root OCID into Git or substitute it for the sentinel. The selected ages-staging compartment must be a direct child of root, with no action targeting root, the existing root workload, or a separate deny-listed production compartment. Add any dedicated production compartment OCIDs only to the ignored local intake. A read-only READY report never authorizes a later command. Before provisioning, host preparation, deployment or recovery, the operator must compare that command's target against the approved child and the deny boundary, and enforce compartment-scoped IAM independently; abort on any root target.

Read plan capacity lines independently: Shape and Boot disk describe the per-VM allocation (current private intake: A1 Flex ARM64, 1 OCPU, 6 GiB RAM, 50 GiB boot disk). Required available A1 core quota is a readiness minimum from quotaNeeded (currently 2), not deployed capacity. The live read-only check compares OCI quota.available with quotaNeeded and blocks on a non-finite or lower value. Reviewed/pinned release baseline names the intake's releaseCommit; it may differ from the report generator's checkout, and any actual release still requires separate exact-commit approval. Offline planning cannot certify available quota.

Private operator checklist (read-only planning only):

1. Prerequisites: approved staging compartment, read-only OCI CLI profile, production deny list, home-region/shape/quota inputs, exact CI-green SHA, named recovery owners. Set hostname and zoneName to JSON null, publicIngressTcp to [], edge/api/worker/database public IP and PostgreSQL ingress flags false, postgresListen to 127.0.0.1, adminAccess to oci-bastion. Keep the completed intake outside Git.
2. Roles/approval: staging operator runs the three commands below; security/IAM and backup owners review. No provisioning authority is conveyed. Capture sanitized reports and OCI CLI version privately.
3. On native Windows PowerShell, run:

~~~powershell
New-Item -ItemType Directory -Force .local/staging
Copy-Item deploy/staging-intake.template.json .local/staging/intake.json
# Complete only the ignored local file; keep rehearsalMode private-no-dns.
pnpm staging:plan --offline
pnpm staging:preflight
pnpm staging:plan
~~~

4. Expected: completed intake passes static validation; live read-only OCI tenancy/compartment/region/shape/quota metadata passes. No DNS/zone/NS query is made. Reports say public DNS, ACME/TLS, public browser, public WebSocket, public alert delivery and public-edge behavior are deferred. They do **not** prove a private VM, firewall or free capacity.
5. Cost approval before **any later resource creation**: operator opens their own OCI Console, checks the current home-region Always Free labels/limits and capacity for the A1 Flex 2 OCPU/12 GiB plan with one 50 GiB boot volume, plus boot/block volume, public IP (none), storage/Object Storage, egress, Bastion, alerts/logs and every networking service; records a **$0 planned estimate** and teardown owner. No billing guarantee. If any item is paid, unclear or unavailable, abort rather than substituting a paid shape, NAT gateway, public IP or bucket.
6. Future private host/network approval needs a separate reviewed administration-only preparation path, no public IP, no 22/80/443/3000/3001/5432/metrics internet ingress at NSG/security-list **and** host firewall, and time-limited Bastion access. Validate denied access and separate service/DB/env identities. Run no public Caddy listener or DNS/ACME path. Package-update egress must be explicitly reviewed for cost. If a private host is later approved, use Bastion-only local checks and a disposable DB backup/empty-target restore/refusal; do not claim public gameplay or TLS. Off-host backup remains unverified until a free/approved target, encryption, separate key custody and retrieval/restore are selected and tested. Abort on any exposed endpoint, unknown cost, access denial failure or restore refusal failure.

Evidence: intake mode, sanitized reports, Console eligibility/$0 estimate with date and home region, approvals, effective network/host-firewall rules if later provisioned, identity-denial results and recovery checks. Never retain keys, DB URLs, tokens, raw player data or completed private inventory in Git. See STAGING_INTAKE_TEMPLATE.md and RECOVERY.md.

## Future public-dns route (requires owned DNS and separate approval)

The following numbered steps are preserved for a later public staging rehearsal. They are not satisfied by private-no-dns and must not be run by an operator without domain ownership, TLS/network/cost approval and a reviewed public-edge change.

## 1. Intake and preflight

Prerequisites: read-only OCI CLI API-key profile, staging compartment, production deny inventory, exact CI-green SHA, cost/shape/quota/CIDRs, named owners and alternate contacts. Public-dns additionally requires a delegated owned zone. Roles: staging operator prepares; security/IAM, DNS/TLS and release approvers review. Commands on native Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force .local/staging
Copy-Item deploy/staging-intake.public.template.json .local/staging/intake.json
# Complete .local/staging/intake.json privately; set OCI_CLI_PROFILE in this session.
pnpm staging:preflight
pnpm staging:plan
```

Expected: reports in ignored `.local/staging` state READY FOR HUMAN REVIEW; selected tenancy/compartment/region, shape/quota, delegated DNS, production deny, network and env-name gates pass. Abort: any BLOCKED check, unknown permission, quota ambiguity, undelegated zone, production identifier or nonempty placeholder. Correct the intake and rerun; do not provision. Evidence: sanitized reports, OCI CLI version, approver sign-off, approved costs/CIDRs and source run ID. Secret warning: OCI profile and completed intake never enter Git or shared logs.

## 2. Reviewed public host/network provisioning approval

Prerequisites: step 1 and independent security/network approval, reserved staging address and a reviewed change ticket listing VCN public/empty-private subnet, NSG, security-list union, Bastion SSH scope/TTL, instance shape/boot disk, package sources, and both OCI and host firewall rules. Roles: provisioner executes; security/IAM and staging operator approve; DNS/TLS owner approves address. The checked-in repository has **no OCI provisioning command**. Apply the approved OCI console/IaC change outside this milestone; record generated resource identifiers in the private inventory. Before host preparation, inspect exact-commit `deploy/provision.mjs` and its explicit gate. After a Bastion session reaches the approved Ubuntu 24.04 host:

```text
sudo apt-get update
sudo apt-get install -y nodejs git
git clone https://github.com/KyoshiCodes/Ages-of-Ash.git /home/ubuntu/ages-bootstrap
git -C /home/ubuntu/ages-bootstrap checkout --detach <REVIEWED_40_CHARACTER_SHA>
git -C /home/ubuntu/ages-bootstrap rev-parse HEAD
sudo node /home/ubuntu/ages-bootstrap/deploy/provision.mjs staging.<OWNED_ZONE> --public-dns-mode --approve-host-provisioning
sudo -u ages-release git clone https://github.com/KyoshiCodes/Ages-of-Ash.git /srv/ages/source
sudo -u ages-release git -C /srv/ages/source checkout --detach <SAME_REVIEWED_SHA>
sudo systemctl status postgresql
sudo systemctl cat ages-api ages-worker ages-backup
sudo ss -lnt
```

Expected: both source checkouts resolve to the approved SHA and `/srv/ages/source` exists for the Windows release wrapper; four distinct Unix service users, separate files `api.env`/`worker.env`/`backup.env`/`migrate.env`, PostgreSQL bound to loopback, Caddy pending/active only at approved edge, 80/443 open at both gates and no public 3000/3001/5432. Abort: any broad ingress, unreviewed iptables change, shared env/Unix identity, unexpected daemon, or package failure; disable public ingress and stop services before troubleshooting. Evidence: approved diff, sanitized network-rule export, host version/architecture, service-account listing and `ss` output. Secret warning: placeholder env files are not usable credentials; replace via restricted root session, never paste content in evidence.

## 3. Identity and denied-access gate

Prerequisites: host provisioned, bootstrap DB administrator privately creates `ages_migrator`, `ages_api`, `ages_worker`, `ages_backup` plus `ages` DB and `pgboss` schema per `deploy/README.md`; root installs per-role env files and backup-only OCI profile/key. Roles: database operator and security/IAM approver; staging operator witnesses. Commands on host after secrets are installed by owners:

```text
sudo namei -l /etc/ages/api.env /etc/ages/worker.env /etc/ages/backup.env /etc/ages/migrate.env
sudo -u ages-api test -r /etc/ages/api.env
sudo -u ages-worker test -r /etc/ages/worker.env
sudo -u ages-backup test -r /etc/ages/backup.env
sudo -u ages-api test ! -r /etc/ages/backup.env
sudo -u ages-worker test ! -r /etc/ages/api.env
sudo -u ages-api test ! -r /etc/ages/migrate.env
```

Repeat cross-file denials for all four users; review PostgreSQL grants and execute harmless rollback-only DDL/DML denial probes with role-scoped `psql` sessions. Confirm backup role has `pg_read_all_data` but no write, worker owns only queue schema, runtime cannot migrate. Verify backup-only OCI profile can put but not get/delete; reader can get but not put/delete; neither can access private age identity. Expected: every denied operation fails and file modes match architecture matrix. Abort: any unexpected read/write; revoke and rotate affected credentials before proceeding. Evidence: redacted permission matrix and SQL privilege results, not URLs/passwords.

## 4. Exact-commit release and explicit migration approval

Prerequisites: step 3, Release foundation success for the exact SHA, reviewed additive SQL/rollback compatibility, current verified backup, owners available, scheduled maintenance window. Roles: release approver approves code; database operator separately approves migration; staging operator executes. Commands from Windows PowerShell, using a Bastion-approved SSH target:

```powershell
./deploy/deploy.ps1 -RemoteHost <BASTION_REACHABLE_SSH_TARGET> -Commit <REVIEWED_40_CHARACTER_SHA>
# After independent migration approval and pre-migration backup evidence:
./deploy/deploy.ps1 -RemoteHost <BASTION_REACHABLE_SSH_TARGET> -Commit <SAME_REVIEWED_SHA> -ApproveMigrations
```

Expected: the wrapper fetches and checks out the same reviewed SHA before it executes `release.mjs`; first command prepares immutable worktree without DB mutation or service switch. Second runs `prisma migrate deploy` as migrator, scoped grants/seed/queue setup, symlink switch and readiness wait. API/worker use their own Unix and DB roles. Abort: SHA mismatch, migration review failure, failed backup, unexpected destructive SQL, readiness failure or worker lag; halt, retain old release, and follow rollback section. Evidence: SHA, CI URL, migration approval, migration names, sanitized release log, `/api/ready` result and backup checksum. Secret warning: release/migration env values are delivered through root-owned files; no URL on argv or in tickets.

## 5. Public DNS/TLS and core hosted game

Prerequisites: exact release ready, DNS owner approval and both network gates verified. Roles: DNS/TLS owner + staging operator. Windows PowerShell checks:

```powershell
Resolve-DnsName staging.<OWNED_ZONE> -Type A
Test-NetConnection staging.<OWNED_ZONE> -Port 443
Test-NetConnection staging.<OWNED_ZONE> -Port 5432
curl.exe -I https://staging.<OWNED_ZONE>/api/live
curl.exe -I https://staging.<OWNED_ZONE>/api/ready
```

Expected: A record matches approved address; valid hostname certificate and HTTPS, readiness 200, public port 5432 unreachable; check 3000/3001 likewise. Caddy `/internal/*` returns 404 publicly. In a clean browser over HTTPS, create a disposable test account, resolve an operation, level/spend a point, equip gear, recruit crew, build/collect a holding, attack another test player, fight a boss, view leaderboard, receive a live update and logout. Assert server values after refresh; no client rewards. Abort: TLS mismatch, mixed content, public internal endpoint, DB exposure, gameplay inconsistency; close ingress/stop rollout. Evidence: certificate issuer/expiry, DNS/net probes, redacted screenshots and action checklist. Secret warning: test credentials stay private; delete/disable test accounts by approved data policy, not ad hoc SQL.

## 6. Rolling restart and WebSocket recovery

Prerequisites: passing game smoke and an authenticated disposable test session. Roles: staging operator, alert owner. On host: `sudo systemctl restart ages-api`, then `sudo systemctl restart ages-worker`; observe `sudo systemctl status ages-api ages-worker` and `sudo journalctl -u ages-api -u ages-worker --since '<UTC_START>'`. Expected: in-flight action commits once or retries safely via nonce, WebSocket reconnects and refetches authoritative state, worker heartbeat becomes fresh, no duplicate reward. Abort: double credit, sustained readiness loss, failed reconnect or growing lag; stop test traffic and inspect journals. Evidence: bounded request IDs, reconnect timings, readiness trace, duplicate-reward check; do not retain cookie/token or raw state.

## 7. Off-host encrypted backup

Prerequisites: backup owner confirms `ages-backup.timer`, restricted dump directory, age tool and pinned package provenance, public recipient file `/etc/ages/backup-recipients.txt`, staging-only Object Storage bucket/backup prefix and backup-only OCI profile; key custodian holds private identity off host. Roles: backup owner executes, security/IAM approver reviews denied access. On host:

```text
sudo systemctl start ages-backup
sudo systemctl status ages-backup
sudo -u ages-backup pg_dump --version
sudo -u ages-backup age --version
sudo -u ages-backup age -R /etc/ages/backup-recipients.txt -o <RESTRICTED_STAGING_CIPHERTEXT_PATH> <LATEST_LOCAL_DUMP_PATH>
sudo -u ages-backup sha256sum <RESTRICTED_STAGING_CIPHERTEXT_PATH>
sudo -u ages-backup oci os object put --bucket-name <PRIVATE_STAGING_BUCKET_INPUT> --name <STAGING_BACKUP_OBJECT_KEY> --file <RESTRICTED_STAGING_CIPHERTEXT_PATH> --profile <BACKUP_ONLY_PROFILE> --config-file <BACKUP_ONLY_CONFIG_PATH>
```

Expected: nonempty custom-format local dump, nonempty ciphertext, recorded checksum and object metadata, no private key on source host, backup writer unable to fetch/decrypt. Abort: empty dump, encryption/upload failure, stale backup or permission overreach; retain last good backup, alert owner and do not claim RPO. Evidence: timestamps, checksums, size, object version/ETag in private store, denied-access results; no raw dump or key in logs/artifacts.

## 8. Empty-target restore and populated-target refusal

Prerequisites: isolated recovery host/database with no production network route; fresh `ages_restore_<RUN_ID>` DB, PostgreSQL 18 client, ciphertext reader principal, separate age private key delivered by custodian after approval. Roles: restore executor, DB operator, key custodian, incident commander for any cutover. The operator retrieves ciphertext with `oci os object get --bucket-name <PRIVATE_STAGING_BUCKET_INPUT> --name <APPROVED_OBJECT_KEY> --file <LOCAL_CIPHERTEXT_PATH> --profile <READER_PROFILE>`, checks SHA256, then custodian authorizes `age -d -i <CUSTODIAN_KEY_PATH> -o <RESTRICTED_PLAINTEXT_DUMP_PATH> <LOCAL_CIPHERTEXT_PATH>` on the recovery host. Set `DATABASE_URL` privately to the empty target and `NODE_ENV=test`; run:

```text
node deploy/restore.mjs <RESTRICTED_PLAINTEXT_DUMP_PATH> --confirm-empty-target
pnpm run doctor
node deploy/restore.mjs <RESTRICTED_PLAINTEXT_DUMP_PATH> --confirm-empty-target
```

Expected: first restore succeeds; doctor reports migration/catalog parity; sampled schema, player, sessions, telemetry and operational rows match source evidence; second restore explicitly fails `Restore target is not empty`. Abort: checksum mismatch, key custody breach, populated initial target, data mismatch, or unapproved cutover; discard recovery target only after evidence retention. Evidence: source/target counts and checksums without raw player data, restore duration, refusal output, key handoff log. Private plaintext dump is restricted and removed under the recovery host's media policy; do not upload it.

## 9. RTO/RPO, rollback, alerts and cost closeout

Prerequisites: steps 1–8, named incident/alert/backup owners. Roles: incident commander measures; DNS/TLS owner owns traffic switch; database operator approves data target; release approver owns code rollback; public-beta authority is a separate final gate. Record UTC backup completion, last recovered transaction, incident start, retrieval, decrypt, restore, consistency, app smoke and traffic-ready timestamps. Calculate **RPO = incident data boundary minus last recovered transaction** and **RTO = incident start to approved traffic readiness**; compare with privately approved targets. No target is assumed here.

For code-only rollback, DB operator first confirms backward schema/data compatibility; then an authorized operator may rerun the reviewed prior SHA via `deploy/deploy.ps1` / `deploy/release.mjs --allow-code-rollback` only if readiness fails during that gated invocation; the flag restores the immediately previous symlink after a failed switch. For a later rollback, the release approver and database operator must review a separate symlink-switch procedure. Neither path reverses migrations or player changes. If incompatible, stop writes, restore to a separate target, validate and seek distinct data-cutover approval; never repoint a live service to a populated target without the incident procedure.

Alert owner deliberately stops a noncritical staging worker briefly or uses an approved synthetic health failure, confirms delivery and acknowledgement within the target window, then restores service and records recovery. Abort if alert route is silent, wrong recipient, or logs expose secrets. Review daily VM/volume/bucket/egress/Bastion costs and an approved teardown date; do not delete resources or backups without retention/incident-owner sign-off. Retain sanitized evidence log, approvals, timing table, defects and cost decision in the restricted operations store. OCI staging, encrypted off-host transfer, alert delivery and RTO/RPO remain **unverified** until an operator executes and records these steps.
