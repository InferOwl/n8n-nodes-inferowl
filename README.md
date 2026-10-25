# @inferowl/n8n-nodes-inferowl

n8n community nodes for [InferOwl](https://inferowl.com), the recruitment platform for healthcare staffing agencies.

- **InferOwl**: create, update, get and search candidates; create, get and search jobs; move a candidate to another pipeline stage; get and list submittals, client interviews, interview bookings and placements; log a call outcome.
- **InferOwl Trigger**: starts a workflow the moment something happens in your InferOwl workspace (candidate created, pipeline stage changed, submittal created, placement started, job created and more).

Both use the public InferOwl REST API (`https://api.inferowl.com/api/v1`, described at `/api/v1/public/openapi.json`) with a scoped API key.

## Installation

Self-hosted n8n: **Settings → Community Nodes → Install**, enter `@inferowl/n8n-nodes-inferowl`, and confirm. Or, in your n8n user folder:

```bash
npm install @inferowl/n8n-nodes-inferowl
```

and restart n8n. See the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/). On n8n Cloud the node is available once n8n has verified it.

## Credentials

Create an **InferOwl API** credential:

| Field | Value |
|---|---|
| API Key | An InferOwl key (`iow_…`). Owners create keys in InferOwl under **Settings → API Keys**. |
| API Base URL | Leave `https://api.inferowl.com` unless InferOwl support gave you another address. HTTPS only. |

The credential test lists webhook subscriptions, so the key needs the `webhooks:manage` scope. Give the key only the scopes the workflows use:

| Scope | Needed for |
|---|---|
| `webhooks:manage` | Credential test, InferOwl Trigger |
| `candidates:read` | Candidate get / search, moving a candidate by candidate + job |
| `candidates:write` | Candidate create / update |
| `jobs:read` | Job get / search |
| `jobs:write` | Job create |
| `pipeline:read` | The stage list on Move to Stage; Submittal, Client Interview, Interview Booking and Placement get / get many |
| `pipeline:write` | Move to Stage |
| `calls:write` | Log Outcome |

A key acts with its creator's current role in InferOwl. Subscribing to events needs an owner; the other operations follow the creator's role and permissions.

## Operations

| Resource | Operation | API |
|---|---|---|
| Candidate | Create | `POST /candidates` |
| Candidate | Get | `GET /candidates/{id}` |
| Candidate | Search (email, phone or name) | `GET /candidates?search=` (email and phone keep exact matches; phone is compared on the last 10 digits) |
| Candidate | Update | `PATCH /candidates/{id}` (only the fields you add) |
| Job | Create | `POST /jobs` |
| Job | Get | `GET /jobs/{id}` |
| Job | Search | `GET /jobs?search=&status=` |
| Application | Move to Stage | `POST /pipeline/move`, by application ID or by candidate + job (`GET /candidates/{id}/applications`) |
| Submittal | Get | `GET /submittals/{id}` (with its client interviews, offers, client responses and placements) |
| Submittal | Get Many | `GET /submittals` (most recently submitted first; filter by candidate, job, client, status, submitted date) |
| Client Interview | Get | `GET /submittals/interviews/{id}` (with its submittal, candidate and job) |
| Client Interview | Get Many | `GET /submittals/interviews` (most recently created first; filter by candidate, job, submittal, status, outcome, scheduled date) |
| Interview Booking | Get | `GET /interviews/bookings/{id}` |
| Interview Booking | Get Many | `GET /interviews/bookings` (most recently booked first; filter by candidate, job, status) |
| Placement | Get | `GET /assignments/{id}` |
| Placement | Get Many | `GET /assignments` (most recently created first; filter by candidate, client, status, ending within N days) |
| Call | Log Outcome | `PATCH /communication/calls/{id}/disposition` (records a disposition and note; never places a call) |

SSN, date of birth and do-not-hire fields are deliberately not exposed.

## InferOwl Trigger

Pick one or more events: Candidate Created, Candidate Added to Job, Pipeline Stage Changed, Submittal Created, Submittal Status Changed, Client Interview Scheduled, Interview Booked, Interview Booking Changed, Placement Started, Placement Status Changed, Job Created, Job Status Changed, Job Closed or Filled.

When the workflow is activated (or you listen for a test event) the node creates a webhook subscription in InferOwl for this node's URL and stores its signing secret; deactivating removes it. Each delivery carries `X-InferOwl-Timestamp` (Unix seconds, set afresh on every attempt) and `X-InferOwl-Signature`, the lowercase hex HMAC-SHA256 of `${timestamp}.${rawBody}` with that secret. A delivery whose signature does not match, whose timestamp is missing or altered, or whose timestamp is more than 5 minutes from the n8n server's clock (a replay) gets `401` and does not run the workflow, so keep the server clock in sync (NTP). The InferOwl settings page "Send test" ping is acknowledged without running the workflow.

The output is the event, flattened: `id`, `event`, `occurred_at`, plus the event's ids (for example `candidate_id`, `job_id`, `application_id`, `from_stage`, `to_stage`). Add an InferOwl node (Candidate → Get, Job → Get, Submittal → Get, Client Interview → Get with the event's `interview_id`, Interview Booking → Get, Placement → Get with the event's `assignment_id`) to load the full records.

Requirements:

- Event delivery must be enabled for the InferOwl workspace (the `outbound_webhooks` flag, off by default; ask InferOwl support). Until then activation fails with a clear "not enabled" error.
- n8n must be reachable over public HTTPS. InferOwl refuses webhook URLs on private or local addresses, so a self-hosted n8n needs `WEBHOOK_URL` set to its public address.

## Development

```bash
npm ci
npm run build   # n8n-node build
npm run lint    # n8n-node lint (n8n Cloud rules)
npm test        # jest, offline
npm run dev     # n8n with this node, hot reload, at http://localhost:5678
```

This folder lives in the InferOwl monorepo at `integrations/n8n-nodes-inferowl` as a standalone npm project (its own lockfile, outside the pnpm workspace).

## Publish

Since May 1 2026 n8n only verifies community nodes published from GitHub Actions with npm provenance, and npm provenance requires a **public** source repository. The InferOwl monorepo is private, so the package is released from its own public repository `InferOwl/n8n-nodes-inferowl`. `.github/workflows/publish.yml` in this folder becomes active there.

1. **Accounts:** an npm account in the `inferowl` organisation (or the account that should own the package), and admin on the `InferOwl` GitHub organisation.
2. **Create the public repository and export this folder** (from the monorepo root; history of this folder only):

   ```bash
   gh repo create InferOwl/n8n-nodes-inferowl --public --description "n8n nodes for InferOwl"
   git subtree split --prefix=integrations/n8n-nodes-inferowl -b n8n-nodes-inferowl-export
   git push git@github.com:InferOwl/n8n-nodes-inferowl.git n8n-nodes-inferowl-export:main
   git branch -D n8n-nodes-inferowl-export   # the temporary export branch only
   ```

3. **Claim the package name and set up trusted publishing.** npm only offers Trusted Publishers on an existing package, so publish the first version once from a clone of the new repository:

   ```bash
   git clone git@github.com:InferOwl/n8n-nodes-inferowl.git && cd n8n-nodes-inferowl
   npm ci && npm test
   npm login
   RELEASE_MODE=true npm publish --access public   # prepublishOnly blocks a plain npm publish
   ```

   Then on npmjs.com → `@inferowl/n8n-nodes-inferowl` → Settings → **Trusted Publishers** → GitHub Actions: owner `InferOwl`, repository `n8n-nodes-inferowl`, workflow `publish.yml`.

4. **Release with provenance** (every version from now on, including a 0.1.1 re-release so a provenance version exists):

   ```bash
   npm run release   # n8n-node release: lint, build, bump version, changelog, tag, push
   ```

   The pushed tag runs `publish.yml`, which publishes with `--provenance`.

5. **Submit for verification** in the [n8n Creator Portal](https://creators.n8n.io/) (see [Submit community nodes](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/)). n8n checks the package against the same lint rules as `npm run lint`.

Later changes are made in the monorepo and exported again with `git subtree split` (step 2, pushing to `main`), then released with step 4.
