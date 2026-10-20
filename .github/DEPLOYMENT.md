# OceanLink Deployment Requirements

How OceanLink is built, deployed, monitored, and recovered.

Product requirements are defined in [REQUIREMENTS.md](REQUIREMENTS.md).
Backend implementation belongs in its own repository, but its operational
requirements are included here because the frontend depends on them.

## 1. Approach

MVP 1 supports the parents' daily operation of one truck parking lot:
customers, vehicles, agreements, invoices, payment records, balances,
and reports.

- One production environment.
- One frontend GitHub Actions workflow.
- A small number of trusted operators, each with an individual account.
- No public registration or driver access in MVP 1.
- Reservations and public driver access are deferred to MVP 3.
- Successful, eligible changes on `main` deploy automatically.
- Superseded commits may be skipped rather than deployed individually.
- Local development and CI use synthetic data.
- A permanent staging environment is required before MVP 3.
- Migration and restore rehearsals are required from MVP 1, using an
  isolated environment.

The initial architecture accepts the availability limitations of one
backend server. It does not promise uninterrupted service.

Manual infrastructure setup is acceptable initially. Configuration and
recreation steps must be documented.

## 2. Environments and Architecture

| Environment | Frontend URL                  | Browser API base | Backend                                      |
| ----------- | ----------------------------- | ---------------- | -------------------------------------------- |
| Local       | `http://localhost:5173`       | `/api`           | Development proxy to `http://localhost:8000` |
| Production  | `https://app.<chosen-domain>` | `/api`           | HTTPS origin on one persistent server        |

### Production routing

Use one browser origin:

- Frontend requests go through CloudFront to S3.
- `/api` and `/api/*` requests go through CloudFront to the backend.
- Configure both API path behaviors explicitly.
- Keep API behaviors ahead of the default frontend behavior.
- Preserve the `/api` prefix end to end unless a deliberate rewrite is
  documented and tested.

The selected MVP architecture does not use a separate browser-facing
API hostname.

If separate frontend and API origins are introduced later, explicitly
configure credentialed CORS and browser credential handling.

### Required deployment decisions

Before the first release, record:

- Production hostname and DNS provider.
- AWS account and resource region.
- Backend hosting product and instance size.
- Backend origin hostname.
- Persistent storage configuration.
- Technical owner and alert destination.

## 3. Frontend Hosting

| Resource        | Requirement                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| S3 bucket       | Private REST origin with Block Public Access, versioning, and encryption enabled.                     |
| Origin access   | CloudFront Origin Access Control. Bucket policy limits CloudFront reads to the intended distribution. |
| CloudFront      | One distribution with HTTPS redirection and compression enabled.                                      |
| TLS             | ACM certificate in `us-east-1` for the CloudFront custom hostname.                                    |
| DNS             | Application hostname points to CloudFront. Route 53 or an existing DNS provider is acceptable.        |
| Bucket contents | Frontend build files only.                                                                            |

Do not place any of the following in the frontend bucket:

- SQLite databases or backups.
- Customer documents or invoice PDFs containing business data.
- Backend secrets.
- Production data exports.
- Environment files containing credentials.

The frontend bundle is publicly retrievable through CloudFront.
Authentication and authorization must protect business data at the API.

## 4. SPA Routing

Use a CloudFront Function on the frontend behavior to rewrite recognized
client routes to `/index.html`.

Requirements:

- Keep the route matcher in source control.
- Keep it aligned with React Router.
- Rewrite only frontend navigation routes.
- Exclude API routes and static asset requests.
- Preserve error responses for missing assets.
- Preserve API status codes and response bodies.
- Do not configure distribution-wide 403/404-to-200 HTML substitution.

Direct navigation and refresh must work for nested application routes,
such as a customer or invoice detail page.

Unknown API routes must return API errors rather than the frontend HTML.

## 5. Caching and Request Forwarding

| Content                                              | Response `Cache-Control`              | CloudFront behavior                                                     |
| ---------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Fingerprinted files under `/assets/*`                | `public, max-age=31536000, immutable` | Long-lived asset caching.                                               |
| `index.html` and mutable root files                  | `no-cache`                            | Caching disabled for MVP 1.                                             |
| API responses, authentication, and private documents | `private, no-store`                   | `CachingDisabled`, with minimum, default, and maximum TTLs set to zero. |

### API forwarding

Explicitly forward the values required by the backend:

- Session cookies.
- Query parameters.
- Required content headers.
- `Origin`.
- CSRF headers.
- `Authorization`, if the application uses it.

Also:

- Allow the HTTP methods required by the API.
- Preserve response `Set-Cookie` headers.
- Configure API error caching to zero.
- Do not substitute frontend HTML for API errors.
- Configure trusted proxy host and scheme handling deliberately.
- Do not forward session cookies to the S3 origin.

Disabling caching does not automatically configure credential forwarding.

Authenticated responses and session cookies must never be served from
a shared cache.

If cache policies change later, verify their minimum TTLs. A positive
CloudFront minimum TTL can override origin cache directives.

## 6. Security Headers and Sessions

Configure a CloudFront response headers policy containing:

- `Strict-Transport-Security`.
- `Content-Security-Policy`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.

The Content Security Policy must:

- Restrict scripts and connections to required sources.
- Include `frame-ancestors 'none'`.
- Include `object-src 'none'`.
- Include `base-uri 'self'`.
- Be tested against the actual production build.

`frame-ancestors` is a CSP directive, not a separate response header.

Verify that the policy supports:

- Chinese fonts.
- Invoice printing.
- PDF downloads and any supported PDF viewer.
- Normal application navigation.

Production session cookies must be:

- Secure.
- HttpOnly.
- Host-only unless a documented requirement says otherwise.
- Configured with an intentional SameSite policy.

Cookie-authenticated write requests require CSRF protection.

Backend authentication and authorization apply even when the backend
origin is called directly.

Local development may use a separate localhost cookie configuration.

## 7. Frontend CI/CD

Tool: GitHub Actions.

One workflow file may contain separate validation and deployment jobs.

Only the deployment job receives production AWS access.

### 7.1 Pull requests

1. Use repository-pinned, supported Node and npm versions.
2. Install dependencies with `npm ci`.
3. Run lint.
4. Run typechecking.
5. Run relevant unit and component tests.
6. Build the application.
7. Run dependency auditing under the policy in section 8.

PR jobs:

- Use synthetic data.
- Receive no production credentials.
- Do not deploy.
- Do not access production customer records.

### 7.2 Pushes to `main`

1. Validate the exact commit using the same checks.
2. Build once with the production configuration.
3. Retain that exact build as the deployment artifact.
4. Record the commit SHA, file inventory, checksums, and prior live release.
5. Acquire the production deployment lock.
6. Reject obsolete automatic runs before publication.
7. Confirm compatibility with the deployed backend.
8. Authenticate to AWS using OIDC.
9. Upload new fingerprinted assets.
10. Verify their presence and metadata.
11. Upload backward-compatible mutable root files.
12. Upload `index.html` last.
13. Invalidate `/*` and wait for completion.
14. Run production smoke checks.
15. Record the live release and deployment outcome.

`index.html` publication is the frontend release publication point.

Files required for application correctness must use fingerprinted URLs.
Do not overwrite incompatible application resources at shared URLs.

### 7.3 Concurrency

- Allow only one production publication at a time.
- Do not cancel a deployment already publishing.
- Prevent an older automatic run from overwriting a newer release.
- Use a separate, explicit recovery procedure for intentional rollback.
- Make failed and skipped deployments visible to the technical owner.

Concurrency locking alone must not be treated as a guarantee of commit
ordering.

### 7.4 Release and asset retention

- Do not run `aws s3 sync --delete` against the live deployment.
- Retain existing fingerprinted assets during normal deployments.
- Retain complete release artifacts for at least 90 days.
- Always retain the current and two previous successful releases,
  even when older than 90 days.
- Use durable private release storage if CI artifact expiration cannot
  satisfy that retention requirement.
- Defer automated asset cleanup for MVP 1.

Any later cleanup procedure must preserve assets referenced by retained
release manifests and the current application.

Do not apply an age-only expiration rule to shared current asset keys.

The frontend must offer a safe refresh path for outdated tabs without
silently discarding unsaved work.

### 7.5 Failure behavior

S3 updates are atomic per object, not across an entire build.

Before `index.html` publication:

- The previous entry document remains active.
- Newly uploaded immutable assets may already exist.

During or after publication:

- The new release may already be visible.
- Check the actual live release before deciding what happened.
- Record failed invalidation or smoke checks as deployment failures.
- Recover an unhealthy release using the rollback procedure.

Do not claim that every failed deployment leaves production unchanged.

Old and new browser sessions may coexist during a release.

## 8. Pipeline Security

### AWS access

- Use GitHub OIDC.
- Do not store long-lived AWS access keys in GitHub.
- Grant `contents: read` by default.
- Grant `id-token: write` only to the deployment job.
- Restrict trust to the expected audience, repository, and deployment context.
- Match the repository's actual OIDC subject format.

If a GitHub deployment environment is used:

- Restrict it to the authorized deployment branch.
- Configure the corresponding environment-based OIDC subject.
- Do not assume a branch-based trust policy remains applicable.

### Deployment permissions

Grant only the permissions needed to:

- List the frontend bucket.
- Upload permitted frontend objects.
- Read or inspect objects for verification.
- Create and inspect invalidations on the intended distribution.

Routine frontend deployment does not need permission to:

- Delete old assets.
- Change bucket policies.
- Change CloudFront configuration.
- Access databases or backups.
- Read backend secrets.

Use separate maintenance and recovery permissions where necessary.

### Repository and dependencies

- Require PRs and passing checks for `main`.
- Block force pushes and branch deletion.
- Review bypass privileges.
- Protect workflow changes through the same review process.
- Pin external actions to verified full commit SHAs.
- Use Dependabot for npm packages and GitHub Actions.
- Never execute untrusted PR code with production credentials.

Run `npm audit` in CI.

High and critical findings block release unless a documented exception
records applicability, owner, remediation plan, and expiration date.

Do not run `npm audit fix` automatically during deployment.

## 9. Configuration

- Set `VITE_API_BASE_URL=/api` for the selected topology.
- Treat every `VITE_` value as public.
- Do not place credentials or customer data in frontend configuration.
- Store bucket name, distribution ID, role ARN, and region as workflow variables.
- Validate required configuration before publication.
- Reject production builds configured to call localhost or an HTTP API.

Backend secrets must remain outside source control and frontend artifacts.

Use a protected server environment file or an AWS secret store with
narrowly scoped access.

Redact credentials, session cookies, sensitive request bodies, and
customer information from operational logs.

## 10. Frontend Rollback

### Normal recovery

Revert the faulty change through a PR and deploy through the standard
pipeline.

### Emergency recovery

1. Pause further automatic publication.
2. Select a previously verified release artifact.
3. Confirm compatibility with the current API.
4. Verify that all required assets are available.
5. Restore the selected release's entry document and required root files.
6. Invalidate `/*` and wait for completion.
7. Run production smoke checks.
8. Record the restored release.
9. Reconcile `main` before resuming automatic deployment.

Prefer restoring a retained artifact over rebuilding an old commit.

S3 versioning provides supplemental recovery protection. If object-version
recovery is used, the runbook must identify a consistent set of versions.

Frontend rollback must not restore or modify business data.

## 11. Backend Hosting and Deployment

### 11.1 Runtime

- Run one FastAPI service on one server.
- Use encrypted persistent local or block storage.
- Keep databases and business documents outside release directories.
- Do not store persistent data only inside a container's writable layer.
- Run the application under a non-root service account.
- Restrict permissions on the database directory and journal/WAL files.
- Start the service automatically after reboot.
- Restart it after unexpected failure.
- Serve HTTPS through a reverse proxy.
- Do not expose the development server port publicly.
- Restrict administrative access.
- Maintain supported operating system, Python, and SQLite versions.
- Configure automatic certificate renewal.

SQLite is a deliberate single-host architecture choice.

A shared network volume does not make a horizontally scaled SQLite
deployment safe. SQLite WAL requires database processes to share the
same host.

Lambda and multiple database-writing application instances are deferred
until the database architecture is changed.

### 11.2 Backend releases

A manually invoked deployment script is sufficient for MVP 1.

The deployment process must:

1. Identify the tested application version and dependency lock.
2. Verify disk space and a fresh recoverable backup.
3. Rehearse migrations against an isolated database copy.
4. Enter a maintenance window when required.
5. Apply versioned migrations once under a deployment lock.
6. Restart the service.
7. Verify readiness, database access, and application version.
8. Retain the preceding application artifact.
9. Record the deployment outcome.

Deploy backward-compatible API and schema additions before the frontend
that depends on them.

Maintain compatibility with supported open tabs and rollback releases.
Document any deliberate compatibility break and maintenance requirement.

### 11.3 Backend recovery

Application rollback and database restoration are separate operations.

Do not automatically restore an older database to undo a code change.

Before restoring data:

- Identify transactions accepted after the backup.
- Determine how they will be reconciled.
- Preserve the current database.
- Follow the documented restore procedure.

## 12. Backups and Recovery

The following are proposed MVP defaults, to be validated before the web
application becomes the authoritative business system.

| Measure                  | Target                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| Recovery point objective | At most one hour of accepted database changes lost.               |
| Recovery time objective  | Usable service within four hours after incident response begins.  |
| Backup schedule          | Every 30 minutes, allowing time for snapshot creation and upload. |
| Retention                | Frequent backups for seven days; daily backups for 30 days.       |
| Restore rehearsal        | Before cutover, quarterly, and after material changes.            |

These are recovery targets, not an availability SLA.

### Backup requirements

- Create consistent SQLite snapshots using the backup API or `.backup`.
- Do not copy a live database file in isolation.
- Upload completed snapshots to separate private, encrypted backup storage.
- Back up non-reproducible customer documents and stored business files.
- Document how document versions correspond to database references.
- Record backup timestamp, checksum, application version, and schema version.
- Verify successful upload.
- Enable backup versioning and deliberate retention rules.
- Keep backup access separate from frontend deployment access.

### Monitoring and restoration

- Alert immediately on backup failure.
- Alert when the most recent completed recovery point exceeds one hour.
- Restore into an isolated location first.
- Verify database integrity.
- Reconcile customer counts, invoices, payments, and outstanding balances.
- Disable outbound integrations during restore rehearsals.
- Preserve the current database before replacing it during an incident.

Backup retention is separate from business-record retention.

## 13. Desktop-to-Web Cutover

The existing desktop application's data must be reconciled before the
web application becomes authoritative.

1. Back up the existing desktop data.
2. Rehearse the migration into the web application.
3. Preserve vehicle identifiers and customer relationships.
4. Reconcile customers, vehicles, invoices, payments, and outstanding balances.
5. Agree on a cutover time.
6. Stop desktop writes during the final transfer.
7. Import the final data and reconcile again.
8. Have the parents verify representative accounts and documents.
9. Preserve the old system as a protected read-only reference.

Do not allow the desktop and web applications to become independently
writable financial records.

If reverting after the web application has accepted new transactions,
reconcile those transactions before switching back.

## 14. Monitoring and Release Acceptance

### Required monitoring

- External availability check.
- API readiness check.
- Deployment failure alerts.
- Backend disk-pressure alerts.
- Failed and stale backup alerts.
- Rotated operational logs with bounded retention.
- AWS cost alerts.

Document the technical owner, alert destination, maintenance procedure,
and operational fallback during an outage.

### Production smoke checks

Verify:

- HTTPS.
- Expected frontend release.
- Required JavaScript and CSS assets.
- Direct loading of a nested application route.
- API readiness.
- Genuine API error status codes.
- Rejection of unauthenticated requests to protected data.

Production smoke checks must not create invoices or payment entries
in real customer accounts.

### Before cutover

Using synthetic data, validate:

- Login and logout.
- Customer lookup.
- Vehicle lookup.
- Invoice creation and printing.
- Payment recording.
- Balance reconciliation.
- Chinese interface rendering.
- Normal use in the parents' browser.

Demonstrate:

- Successful deployment.
- Frontend rollback.
- Backend recovery procedure.
- Backup restoration.
- Desktop-data reconciliation.

A full Playwright deployment gate may remain deferred. Critical workflow
validation and tested recovery are required from MVP 1.

## 15. Cost

Record a cost estimate for the chosen region and configuration.

Include:

- Backend compute.
- Persistent storage.
- Public IPv4 where separately billed.
- S3 storage and requests.
- CloudFront usage.
- Backup storage and retention.
- Logs and monitoring.
- Network transfer.
- DNS.
- Domain registration and renewal.
- Applicable taxes.

Do not treat a server bundle price as the complete application cost.

Select server memory after checking invoice generation, reporting, and
import workloads.

A load balancer and NAT gateway are not part of the initial topology.
Recalculate costs if either is introduced.

Set a monthly budget and alert threshold before launch. Review the first
full monthly bill.

## 16. Deferred

- Permanent staging, required before MVP 3 or earlier if change risk demands it.
- Public driver access and reservations, deferred to MVP 3.
- PR preview deployments.
- Infrastructure as code.
- Full browser E2E suite as an automatic deployment gate.
- AWS WAF.
- Multiple application servers.
- Database migration for horizontal scaling.
- Automated frontend asset cleanup.
- Manual approval for every routine frontend deployment.

These deferrals do not remove the requirements for authentication,
safe publication, backups, monitoring, and tested recovery.

## 17. Decisions Required Before Go-Live

| Decision   | Required record                                                            |
| ---------- | -------------------------------------------------------------------------- |
| Domain     | Application hostname, DNS provider, and renewal owner.                     |
| AWS        | Account, region, and resource inventory.                                   |
| Backend    | Hosting product, instance size, persistent disk, and deployment procedure. |
| Access     | Operator accounts, account recovery, and administrative access.            |
| Backups    | Runtime identity, storage destination, schedule, and retention.            |
| Recovery   | Validated recovery targets and restore runbook.                            |
| Operations | Technical owner, alert destination, and outage fallback.                   |
| Cutover    | Migration procedure, reconciliation evidence, and cutover time.            |
| Releases   | Artifact retention, live version tracking, and rollback procedure.         |
| Budget     | Expected monthly cost and alert threshold.                                 |
