# Basivo Client Portal — implementation plan v1

Status: proposed, awaiting human review. Product and private GitHub repository name have been confirmed; this implementation plan has not yet been approved. No application implementation is authorized to start until review is complete.

Date: 18 November 2026. Intended repository: `mohamedabubasith/basivo-client-portal` (private).

## Product outcome

A working multi-tenant SaaS for agencies and service businesses to manage client projects and support requests. Staff work inside their organization; invited clients see only the projects and tickets explicitly shared with them. An organization owner manages staff, client access, and a test-mode subscription.

The delivery must include the real database, authentication, permissions, API, responsive interface, background jobs, integrations, tests and deployment assets. A static dashboard, mocked tenant isolation, or a simulated payment-success screen does not satisfy the plan.

## Human review before coding

1. Create a dedicated YouTrack epic in AI Pipeline (AIP), linking the private GitHub repository.
2. Publish this versioned plan as a ticket comment, including a SHA-256 digest, scope, milestones, verification and blockers. Mark it as awaiting human review using an available project status; do not invent a status.
3. A human reviews the comment and explicitly approves the named plan version and digest, or requests changes. No timeout, bot comment, label, repository creation or successful test is an approval.
4. Any material scope, architecture or acceptance change produces a new plan version and invalidates the earlier approval. Record the actual reviewer and approved version.
5. After approval, create linked implementation tickets for the milestones. Post the relevant implementation plan on each ticket; stop for human review on material deviations. Small tasks that stay within the approved epic can proceed under that recorded approval.
6. Agents work on isolated branches, post progress and test evidence on their tickets, and open PRs. Code review and verification remain separate from implementation. Preserve GitHub protections; do not bypass required reviewers or merge restrictions.

The previous preference for auto-merge after successful checks remains separate from this mandatory plan-review step. A changed requirement or revoked approval must stop pending coding and merge actions.

## Users and permissions

- **Owner:** organization settings, staff/client invitations, billing and all organization work. Ownership transfer is explicit and transactional; an organization must never lose its last owner.
- **Admin:** manage members and projects, triage tickets and view organization audit history; cannot change billing or remove the owner.
- **Member:** work on authorized projects and tickets; cannot administer roles or billing.
- **Client:** access explicitly shared projects, create and follow their own permitted tickets, and participate in visible discussions. Internal notes and unrelated client data remain hidden.

Every server operation verifies the authenticated identity and current organization membership. Organization IDs supplied by URLs, cookies or JSON are selectors, never proof of access. Client permissions also require explicit project/ticket visibility. The UI hiding a control is not authorization.

## Functional scope

### Identity and organization onboarding

Email/password login with secure password hashing, email verification, reset links, expiring/revocable sessions and rate limits. Organization creation, organization switcher, expiring single-use invitations, role management, removal and session/access revocation. Local email goes to a mailbox service; production mail configuration is documented.

### Projects and tasks

Project creation and archive, status and due date, assigned staff, client visibility, task assignment, status transitions, comments, activity history, search, filters and pagination. All list, detail, export and search endpoints obey tenant and client boundaries. Editing uses version checks to prevent silently losing concurrent changes.

### Support tickets and conversations

Ticket creation, staff assignment, priority, status, project association, public replies, internal notes, attachments and an activity timeline. Clients cannot choose another reporter or see internal content. Notifications distinguish public and internal content. Changes are audited and visible without a page refresh where appropriate; polling is sufficient for the first release.

### Files and notifications

Private object storage with authorized upload/download flows, size/type restrictions, safe filenames, quotas and expiring links. Membership removal revokes future downloads. Uploaded files are never executable application assets. Add in-app notifications and email delivery through an outbox with durable retries, deduplication and dead-letter visibility.

### Subscription and usage

Stripe test-mode checkout, customer portal, signed webhook handling, subscription states and seat/storage entitlements. Only an owner can initiate billing operations. Webhooks are replay-safe and authoritative; visiting a success URL cannot grant access. Client-supplied price/customer/organization identifiers cannot select another tenant's subscription. Test active, trial, past-due and cancelled states, including concurrent seat invitations near a limit. No live payment collection or real charges without separate authorization.

### Administration and auditability

Organization profile, member/client administration, usage and billing screens, audit history, user profile and session management. Record actor, organization, operation, target and time while excluding passwords, credentials and sensitive file contents. Provide loading, empty, validation, forbidden, error and retry states throughout the responsive application.

## Proposed architecture

Use a TypeScript web application with Next.js App Router, server-side authorization, PostgreSQL, Drizzle schema/migrations and a durable background worker. Use established authentication and Stripe integrations rather than inventing cryptography or payment protocols. Select exact supported package versions during bootstrap and pin them in the lockfile.

Use S3-compatible private storage; MinIO and Mailpit provide local file/email integrations. A Docker Compose development stack should start the web app, worker, PostgreSQL, storage and mailbox. Production configuration must supply durable volumes, TLS termination, email/storage/payment secrets and backup policy. Keep provider adapters behind interfaces so local services and real production integrations use the same authorization rules.

Use PostgreSQL transactions for invitations, role/ownership changes, quotas, billing-event ingestion and outbox publication. Enforce uniqueness and relationships in the database, including organization-scoped keys. Evaluate row-level security as defense in depth with a non-owner application role; application authorization remains independently tested. Background tasks use leased jobs and idempotent handlers rather than in-memory timers.

Principal records: users, sessions, verification/reset tokens, organizations, memberships, invitations, clients, projects, project memberships, tasks, tickets, ticket participants, comments with visibility, attachments, notifications, audit events, subscriptions, billing events, usage records, outbox messages and job attempts. All tenant-owned records have an explicit organization relationship; composite constraints prevent cross-tenant links.

## Implementation milestones

| Milestone | Work | Acceptance evidence |
|---|---|---|
| 1. Foundation | Repository rules, pinned tooling, environment validation, app shell, migrations, Compose and CI definitions | Fresh checkout starts; migrations and health checks pass; secrets excluded from source and logs |
| 2. Identity | Login, verification/reset, sessions, organization onboarding, membership and invitations | Real browser sign-in and invitation flows; expired/replayed links rejected; removed members lose access |
| 3. Tenant boundary | Central permission service, scoped queries, client visibility and tenant-safe database relationships | Two organizations cannot read, write, search, attach or link each other's records; direct API attempts fail |
| 4. Project workspace | Projects, tasks, assignments, comments, filters, pagination and concurrency handling | Staff and client browser journeys work; stale updates are rejected clearly; archived projects obey policy |
| 5. Support workflow | Tickets, public replies, internal notes, assignment, attachments and activity history | Client ticket reaches staff and returns a reply; internal notes never appear in client responses or notifications |
| 6. Jobs and notifications | Private storage integration, outbox worker, in-app/email notifications and audit UI | Jobs recover after restart; duplicate delivery sends one logical notification; unauthorized file download fails |
| 7. Billing | Stripe test checkout/portal, signed/replayed/out-of-order events, entitlement and usage enforcement | Test subscription lifecycle changes permissions correctly; fake success URLs and forged webhooks grant nothing |
| 8. Release hardening | Responsive/accessibility review, rate limits, structured errors, observability, backup/restore and deployment guide | Clean-environment E2E suite, restore rehearsal, complete demo journeys and current-commit PR checks pass |

Each milestone produces a coherent working slice, migrations, tests, ticket evidence and a reviewable PR. Do not create one enormous unreviewable commit or ship placeholders for later milestones.

Proposed repository areas: `app/` for pages/route handlers; `src/auth/`, `src/access/`, `src/db/`, `src/services/`, `src/integrations/` and `src/jobs/`; `components/`; `tests/unit/`, `tests/integration/`, `tests/e2e/`; database migrations; `compose.yml`; `.github/workflows/`; `.env.example`; `AGENTS.md`; setup and operations documentation. Final structure should follow the selected framework's current conventions.

## End-to-end release scenarios

1. A new owner verifies an account, creates an organization and invites staff and a client. Each user signs in with the correct permissions.
2. Staff create a project, assign tasks and share it with one client. Another client and another organization cannot access it through either the browser or a direct API call.
3. A client submits a ticket with an attachment. Staff add an internal note and a public response. The client sees only the public response and receives one authorized notification.
4. An owner starts a Stripe test subscription. Verified webhooks update entitlements. Replayed, forged and out-of-order events do not duplicate or escalate access.
5. Concurrent invitations at a seat limit cannot over-allocate seats. Removing a member revokes access; the last owner cannot be removed accidentally.
6. Stop/restart the worker during delivery. Pending work resumes without losing accepted operations or producing duplicate logical messages.
7. Restore a database backup into an isolated environment, run migrations and repeat a critical tenant journey. Document object-storage backup responsibilities too.
8. A PR with failing required checks, stale head SHA, unresolved blocking findings or unapproved plan changes cannot proceed to automatic merge.

Testing layers: type-check/lint; permission and domain unit tests; real PostgreSQL transaction/integration tests; local storage/mail integration; Stripe test-mode and signature fixtures; browser E2E tests across desktop/mobile widths; authorization failure/CSRF/rate-limit cases; migration/backup recovery; and CI verification of the precise candidate commit. Seed/demo data must be confined to explicit development/test commands.

## Current operational limits

The account's GitHub-hosted Actions jobs are currently blocked by payment/spending restrictions. GitHub also rejected private-repository branch protection without GitHub Pro. Neither setting will be changed, and the repository will not be made public, without authorization. A GitHub runner release cannot be certified until these limits are resolved or an explicitly approved self-hosted runner is provisioned.

The current durable factory controller still needs its YouTrack-to-GitHub adaptation and a real approval-comment gate; the legacy GitHub workflow does not supply the complete requested lifecycle. This must be addressed before claiming unattended ticket-to-delivery behavior. Do not treat manually performed steps as proof of automation.

While those limits are unresolved, planning and local verification can proceed. Application coding still requires the human approval above. Production deployment, live billing and unrestricted automatic changes to existing repositories are not part of this draft's authority.

## Approval decision

Review the scope, roles, stack, milestones and release tests above. Approve plan v1 with the digest posted on the YouTrack ticket, or comment with requested changes. The code agent should remain in `awaiting_approval` until that review is recorded.
