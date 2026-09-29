# Refund Desk

An AI-assisted refund desk for an e-commerce store. Customers explain what went wrong in plain language, the system checks their order against the refund policy and replies in seconds with **Approved**, **Denied** or **Escalated**. Support agents get a dashboard showing every decision, why it was made, and a queue of cases that need a person.

Built with **NestJS + PostgreSQL** on the backend and **React (Vite + TypeScript)** on the frontend. Runs with one `docker compose up`.

---

## Quick start

```bash
git clone <this repo> refund-desk && cd refund-desk
cp .env.example .env          # add an API key (optional, see below)
docker compose up --build
```

| What | URL |
| --- | --- |
| Customer chat | http://localhost:8080 |
| Support dashboard | http://localhost:8080/admin (key: value of `ADMIN_API_KEY`, default `change-me-admin-key`) |
| Refund policy | http://localhost:8080/policy |
| API | http://localhost:3000/api (health: `/api/health`) |

On first boot the API runs the database migration and seeds 15 customers, their orders and a few historical refund requests. There's a **"Try a test customer"** panel on the chat page that fills in one of the seeded customers for you, with the outcome it should produce.

To start from a clean database: `docker compose down -v && docker compose up --build`.

### API keys

Put **one** of these in `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...   # preferred, defaults to claude-haiku-4-5
OPENAI_API_KEY=sk-...          # defaults to gpt-4o-mini
```

`AI_PROVIDER=auto` (the default) uses Anthropic if that key is set, otherwise OpenAI. You can force one with `AI_PROVIDER=anthropic|openai` and change models with `ANTHROPIC_MODEL` / `OPENAI_MODEL`.

**No key?** The app still works. It falls back to an offline keyword classifier and template replies, so you can test the whole flow without spending anything. The dashboard header shows which provider is active.

### Running without Docker

```bash
# Postgres 14+ running locally with a refund_desk database
cd backend && cp .env.example .env && npm install && npm run start:dev   # :3000
cd frontend && npm install && npm run dev                                 # :5173, proxies /api to :3000
```

Tests: `cd backend && npm test` (policy engine, input screening, reply guard, provider fallback).

---

## Architecture

```
┌──────────────────────┐        ┌─────────────────────────────────────────────────────────┐
│  React (nginx :8080) │  /api  │  NestJS API (:3000)                                     │
│                      │ ─────▶ │                                                         │
│  • Customer chat     │        │  SupportController ──▶ RefundProcessingService          │
│  • Support dashboard │        │  AdminController   ──▶ RefundReviewService / Query      │
│  • Policy page       │        │                          │                              │
└──────────────────────┘        │        ┌─────────────────┼──────────────────┐           │
                                │        ▼                 ▼                  ▼           │
                                │   Input screening    AiService          PolicyEngine    │
                                │   (regex, unicode)   (LLM provider)     (pure rules)    │
                                │                          │                              │
                                │            Anthropic / OpenAI / offline fallback        │
                                └──────────────────────────┬──────────────────────────────┘
                                                           ▼
                                                    PostgreSQL 16
                              customers · orders · order_items · refund_requests · audit_events
```

### Backend modules

| Module | Responsibility |
| --- | --- |
| `support` | Public endpoints: verify an order, submit a refund request, check a request's status. |
| `refunds` | The pipeline (`RefundProcessingService`), human review (`RefundReviewService`) and read models for the dashboard (`RefundQueryService`). Owns `refund_requests` and `audit_events`. |
| `policy` | `PolicyEngine`, a plain class with no I/O that turns order data + the AI's reading of the message into a decision. `refund-policy.md` is the human version of the same rules. |
| `ai` | Provider abstraction (`LlmProvider`) with Anthropic, OpenAI and offline implementations, prompts, output schemas, input screening and the reply guard. |
| `customers` | Mock CRM: customers, orders, order items. |
| `admin` | Dashboard endpoints behind `AdminKeyGuard`. |
| `database` | TypeORM data source, migration, seed data. |

### What happens when a customer submits a request

1. **Ownership check.** Email + order number must match. A wrong email and a non-existent order return the same 404, so nobody can probe which orders exist.
2. **Input screening.** The message is NFKC-normalised, stripped of zero-width/control characters, capped at 2,000 chars and checked against known injection patterns ("ignore previous instructions", fake `<system>` tags, "I'm the manager", etc.).
3. **AI classification.** The model reads the message and returns structured data through a forced tool call: reason category, which order items it's about, any amount the customer asked for, whether it looks like manipulation, a one-line summary and a confidence score. The output is validated with Zod before we use it.
4. **Policy decision (in a transaction).** The order row is locked (`SELECT ... FOR UPDATE`) so two quick submissions can't refund the same item twice. The engine runs every rule and records each check as PASS / FAIL / REVIEW / INFO.
5. **Reply.** The model writes the customer-facing reply for the decision that was already made. The reply is checked before sending (see below); if it fails, a template is used.
6. **Audit.** Every step is written to `audit_events` with timings, model name, token usage and the raw classification.

Model calls happen outside the DB transaction on purpose. I didn't want a row lock held while waiting on a network call.

---

## How the AI is used (and how it isn't)

The main design decision: **the LLM never decides whether money moves.** It does what it's good at, understanding messy human text and writing a decent reply. The refund decision comes from deterministic code that can be unit-tested and explained.

| Step | Who does it | Why |
| --- | --- | --- |
| Understand the message (reason, items, amount asked) | LLM | Customers don't fill in forms nicely. "The left cup on my cans is cracked" needs to map to *Damaged → Aurora Wireless Headphones*. |
| Spot manipulation attempts | Regex screening **and** LLM | Regex catches the obvious ones cheaply; the model catches paraphrases. Either one is enough to escalate. |
| Apply the refund policy | `PolicyEngine` | Rules have to be exact, auditable and impossible to talk around. |
| Write the reply | LLM, checked by code | Replies read better than templates, but the wording can't be allowed to change the outcome. |

### Prompt injection safeguards

A layered approach, where no single layer has to be perfect:

- **The model has no authority.** Even if an injection fully "worked", the classifier can only return a reason and some item ids. It can't approve anything, and amounts always come from order data, never from the model.
- **Untrusted text is fenced.** The customer's message goes inside `<customer_message>` tags with `<` and `>` swapped for look-alike characters, so it can't close the tag and pose as instructions. The system prompt says outright that the content is data, not instructions.
- **Structured output only.** Classification uses a forced tool call (`tool_choice`), so there's no free-text channel, and the result is schema-validated.
- **Pre-screening.** Pattern checks after Unicode normalisation, so full-width or zero-width tricks don't slip past.
- **Suspicious means escalate.** A flagged message always goes to a human, even when it would have been denied anyway, so someone actually sees the attempt. The customer just gets "a member of our team will review this".
- **Reply guard.** A generated reply is rejected if it implies approval on a non-approved decision (or the reverse), mentions any dollar amount other than the approved one, contains links, or mentions internal details (AI, fraud, risk, flags). Rejections are logged in the audit trail.
- **Minimal data to the model.** The classifier only sees item names, SKUs, prices, order status and delivery date. No customer names, emails or risk notes.
- **Rate limiting** on the public endpoints, a 20kb body limit, and strict DTO validation (`forbidNonWhitelisted`, so extra fields like `"isAdmin": true` are rejected).

### Reliability

- Provider errors or timeouts (`AI_TIMEOUT_MS`, default 20s, one retry) fall back to the offline classifier. The request still gets a decision, gets tagged `AI_FALLBACK`, and the offline classifier is deliberately cautious, so low confidence means more cases go to a human rather than wrong answers.
- `Idempotency-Key` header on submissions (the frontend sends one per message). Retries and double-clicks return the original result instead of creating a second request.

---

## Refund policy

Full text: [`backend/src/policy/refund-policy.md`](backend/src/policy/refund-policy.md) (also served at `/policy`). Numbers live in [`policy.config.ts`](backend/src/policy/policy.config.ts).

| Rule | Outcome |
| --- | --- |
| Order not delivered yet (processing / shipped) | Denied. If the customer describes a damaged or wrong item on an undelivered order, it's **escalated** as a status conflict. |
| Order cancelled | Denied |
| Another request for this order is already under review | Denied (duplicate) |
| Item already refunded | Denied |
| Final sale item | Denied, unless it's a wrong-item report, which is **escalated** |
| Damaged / wrong item / not as described after 30 days | Denied |
| Change of mind after 14 days | Denied |
| Refund above **$500** | Escalated |
| "Never arrived" on a delivered order | Escalated (carrier investigation) |
| Reason unclear, items unclear, or low model confidence (< 0.6) | Escalated |
| Asked for more money than the items are worth, or mentions items not on the order | Escalated |
| Account flagged by risk, or ≥ 3 approved refunds in 90 days | Escalated (not disclosed to the customer) |
| Manipulation attempt | Escalated, always |

Priority when several rules fire: **manipulation → any hard fail → any review → approve.** Mixed orders are handled per item: in an order with a damaged lamp and final-sale pillows, the lamp gets refunded and the reply explains why the pillows don't.

---

## Support dashboard

- Stats: volume, share decided automatically, approved amount, queue size, flagged count, average decision time.
- Filter by status or flagged, search by reference, order number, name or email. Refreshes every 15 seconds.
- The detail drawer shows the raw customer message, how the AI read it (with confidence), every policy check, the order items (highlighting the ones requested), customer history and risk notes, the reply that was sent, and the full audit trail with raw JSON for each step.
- Escalated requests can be **approved or denied** with an internal note and an optional message to the customer. Approval re-checks the items inside a transaction (in case something was refunded in the meantime), and the customer gets a new reply they can see through "Check status".

---

## API

All routes are prefixed with `/api`.

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/support/orders/verify` | `{ email, orderNumber }` → order summary with items |
| `POST` | `/support/refund-requests` | `{ email, orderNumber, message, itemIds? }`, optional `Idempotency-Key` header |
| `GET` | `/support/refund-requests/:reference?email=` | Customer status check |
| `GET` | `/support/demo-scenarios` | Seeded test cases (off when `DEMO_MODE=false`) |
| `GET` | `/policy` | Policy markdown + rule config |
| `GET` | `/admin/stats` | `x-admin-key` header |
| `GET` | `/admin/refund-requests?status=&flagged=&search=&page=` | |
| `GET` | `/admin/refund-requests/:id` | Full detail + audit trail |
| `POST` | `/admin/refund-requests/:id/resolve` | `{ decision: APPROVED\|DENIED, note, reviewer, customerNote? }` |
| `GET` | `/health` | DB + active AI provider |

Example:

```bash
curl -s localhost:3000/api/support/refund-requests \
  -H 'Content-Type: application/json' \
  -d '{"email":"amara.okafor@example.com","orderNumber":"WN-10421","message":"My headphones arrived with a cracked ear cup."}'
```

---

## Test data

15 customers across ~20 orders, with delivery dates relative to "now" so the time windows behave the same whenever you run it. The seeded scenarios:

| Customer | Order | Scenario | Expected |
| --- | --- | --- | --- |
| amara.okafor@example.com | WN-10421 | Damaged headphones | Approved |
| daniel.mensah@example.com | WN-10433 | Wrong size shoes | Approved |
| ngozi.eze@example.com | WN-10487 | Change of mind, day 6 | Approved |
| kwame.asante@example.com | WN-10502 | Broken lamp + final-sale pillows | Approved (lamp only) |
| chloe.bennett@example.com | WN-10440 | Final sale dress | Denied |
| sofia.martinez@example.com | WN-10312 | Delivered 61 days ago | Denied |
| liam.oconnor@example.com | WN-10455 | Change of mind, day 21 | Denied |
| priya.sharma@example.com | WN-10530 | Still in transit | Denied |
| fatima.bello@example.com | WN-10398 | Already refunded | Denied |
| tunde.bakare@example.com | WN-10466 | $1,299 laptop | Escalated |
| ethan.walker@example.com | WN-10491 | "Never arrived" | Escalated |
| marcus.reid@example.com | WN-10511 | 3 refunds in 90 days | Escalated |
| hannah.schmidt@example.com | WN-10477 | Flagged account | Escalated |
| grace.kim@example.com | WN-10519 | Wrong personalised mug (final sale) | Escalated |
| seun.adeyemi@example.com | WN-10524 | Prompt injection | Escalated |

Submitting the same scenario twice shows the duplicate and already-refunded rules doing their job.

---

## Assumptions & trade-offs

- **Email + order number as identity.** Normal for guest checkout support, but in production I'd put a magic link or a logged-in session in front of it. The generic 404 and the rate limiting keep enumeration from being practical.
- **One shared admin key.** Compared in constant time and stored in `sessionStorage`. A real dashboard needs SSO with per-agent accounts; the reviewer name is typed in for now, which is fine for an audit trail in a demo but not for accountability.
- **Refunds are recorded, not paid out.** Approval marks items as refunded and logs it. The payment provider call would go right after the transaction commits, keyed on the request id for idempotency.
- **Whole line items.** A line with quantity 2 is refunded as a whole. Partial quantities would be a small change to the engine and the item picker.
- **Single currency (USD)**, stored as integer cents throughout.
- **Classification and reply are two model calls.** One call could do both, but then the model would be writing the reply before the decision exists. Two calls with Haiku / 4o-mini keep it at roughly 1–3 seconds in total.
- **Regex screening will have false positives and misses.** That's acceptable, because it only ever escalates to a human and it isn't the only layer.
- **Synchronous processing.** Fine at this scale. At higher volume I'd move classification onto a queue (BullMQ) and push the result to the chat over SSE.
- **Seeding on boot** is convenient for review. `SEED_ON_START=false` turns it off, and it never runs if customers already exist.

## What I'd add next

- Photo upload for damage claims (the model can check an image against the claim)
- Webhook/queue integration with the payment provider for actual payouts
- Per-agent auth and roles, plus assignment of escalated cases
- An evaluation set of real (anonymised) messages to track classifier accuracy when prompts or models change
- Prometheus metrics on decision outcomes, fallback rate and model latency
