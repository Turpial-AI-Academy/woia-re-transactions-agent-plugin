---
name: woia-re-transactions
description: Record attributable human-led negotiations, immutable offers, bounded reservations and independent sale milestones. Use for Real Estate transaction facts; never negotiate, send offers or post money autonomously.
license: MIT
---

# Real Estate Transactions

DISCOVER -> DECIDE -> IMPLEMENT -> VALIDATE -> REPORT.

## Discover

Load [the transaction contract](references/CONTRACT.md) before any transaction mutation or recovery. Resolve current organization, Source Authority Map, actor/purpose/resource grants, policy revision and attributable human decisions. Reference shared Person/Organization and Property identities; do not duplicate them. Consult the published `woia-re-domain-contracts` logical contract for canonical relation meanings rather than defining competing schemas.

## Decide

Sales owns negotiation/offer/sale recording. Sales or Leasing may record scoped reservations. Negotiation and Offers are human-led. An agent may prepare a summary or persist an exact competent human contribution; it cannot independently create commercial intent, negotiate, transmit or accept it. External-person contact belongs to Customer Service via Communications.

## Implement

Use [the command schema](assets/request.schema.json) and deterministic `execute(state, request)` in [provider.mjs](scripts/provider.mjs). Host-supplied authority is trusted only after authentication and current policy/source lookup outside model-controlled input. Callers must enforce the persistence/CAS contract from the reference before accepting results. A pure reducer is not a live datastore, provider adapter, legal opinion or permission-grant service.

Supported actions:

- `negotiation.record`
- `offer.record`, `offer.supersede`
- `reservation.create`, `reservation.update`, `reservation.release`, `reservation.expire`
- `sale-transaction.milestone.record`, `sale-transaction.close-record`

Preserve old Offer objects on supersession, old Reservation versions on changes, original source evidence and stable operation identities. Reserve only under current Mandate/represented-subject/property scope and exact human terms. Never infer availability from a reservation flag or infer money/possession from pipeline/closing.

## Validate

Validate command shape before execution and recheck current authority/source evidence at execution, including replay. Reject stale revisions, conflicting operation keys, future/expired maps, revoked grants, conflicting sources, changed approvals and competing active reservations. Keep signature, closing, money and possession milestones independent. Source UNKNOWN/conflict cannot become accepted commitment.

## Report

Return attributable operation receipts and exact source/history references. Distinguish local recording from external business execution. State remote adapters, Operator E2E and physical persistence qualification as NOT_RUN until actually qualified. Money is not posted and contact is not dispatched by this provider.
