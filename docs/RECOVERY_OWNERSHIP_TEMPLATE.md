# Recovery ownership template — operator copy, do not commit completed form

Complete this in the restricted operations evidence store before provisioning. Replace every `<NAME/CONTACT>` and `<BACKUP>` there; this repository deliberately assigns no people.

| Decision role | Primary | Alternate | Authority and escalation |
| --- | --- | --- | --- |
| Release approver | <NAME/CONTACT> | <BACKUP> | Approves exact SHA and code deployment; escalates to incident commander. |
| Staging operator | <NAME/CONTACT> | <BACKUP> | Executes reviewed commands; may abort immediately. |
| Database operator | <NAME/CONTACT> | <BACKUP> | Reviews migration/grants, DB checks, and restore target. |
| Backup owner | <NAME/CONTACT> | <BACKUP> | Confirms daily dump, checksum, encrypted off-host copy and retention. |
| Restore executor | <NAME/CONTACT> | <BACKUP> | Retrieves ciphertext and restores only approved empty target. |
| Key custodian | <NAME/CONTACT> | <BACKUP> | Holds decrypt identity separately; records dual-control release. |
| DNS/TLS owner | <NAME/CONTACT> | <BACKUP> | Owns delegated zone, certificate checks and traffic cutover. |
| Security/IAM approver | <NAME/CONTACT> | <BACKUP> | Approves policies, public ingress and denied-access evidence. |
| Incident commander | <NAME/CONTACT> | <BACKUP> | Coordinates abort, data-loss decision and incident timeline. |
| Alert recipient/owner | <NAME/CONTACT> | <BACKUP> | Tests alert delivery and acknowledgement. |
| Public-beta approval authority | <NAME/CONTACT> | <BACKUP> | Separately approves any public registration/cutover after rehearsal. |

Separation rules: no single routine runtime identity may both alter player data and decrypt backups. Backup object read/write never conveys private-key access. A live or populated restore requires explicit incident-commander, database-operator, and security approval; the current restore tool refuses it, so an approved separate procedure would be required. Code deploy approval is distinct from migration approval and from traffic/public-beta approval. Staging operator can abort on any failed gate without waiting for approval. Rollback to older code requires database operator confirmation of schema compatibility; data restore requires its own approval. If a primary is unavailable, the alternate is recorded before execution; no tacit self-approval.

## Sign-off record (repeat per gate)

- Gate ID and timestamp (UTC): <GATE>/<TIME>
- Exact commit and CI run: <SHA>/<RUN_LINK>
- Target label, compartment and region (private evidence only): <TARGET>
- Evidence references/checksums: <LINKS>
- Change scope and irreversible effects: <DESCRIPTION>
- Approver role and named approver: <ROLE>/<NAME>
- Executor and independent reviewer: <NAME>/<NAME>
- Decision: APPROVE / BLOCK / ABORT
- Conditions, expiry, rollback/abort owner: <DETAILS>
- Post-action result and incident reference: <DETAILS>

## Evidence log (append-only in restricted store)

| UTC time | Gate/step | Actor role | Target label | Command or action class | Result | Evidence link/checksum | Abort/exception |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <TIME> | <STEP> | <ROLE> | <TARGET> | <ACTION> | <PASS/FAIL> | <LINK> | <DETAILS> |

Retain the completed record under the organization's approved policy. Never paste secrets, full connection strings, private keys, raw player data or unredacted terminal transcripts into this template.
