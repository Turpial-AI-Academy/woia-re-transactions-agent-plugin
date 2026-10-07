# Transaction recording contract

## Semantic ownership

Permanent canonical relation schemas and cross-domain evals belong to published `woia-re-domain-contracts@v0.5.0`; these are command envelopes, not duplicate 85-relation schemas and not a hard repository dependency. Follow its Source Authority and transaction/financial integration contract before operation. The exact domain-contract release is commit `fb1c8a3f7fb116f2a00daf05ae335fdfbc7c3f3f`, tree `f3ff5a68a0d5df2e615a650eddc313c9585b7f08`. This provider remains operable without the temporary planning repository.

Negotiation has independent subject+role participants and property scopes. Offers retain attributable immutable terms references; supersession creates a new Offer related to the prior one. Reservation condition IDs are independent facts retained per version. The current commitment remains separate from Payment, availability and possession. Sale milestones retain code+occurrence candidate keys; recording a closing cannot generate absent money/possession facts.

## Trusted execution envelope

`organization`, `purpose`, `action`, `target`, `operation_id`, `expected_revision`, `now`, `payload`, `authority`, `source_authority`, `evidence` are mandatory. `now` is injected by a trusted host clock, not chosen by the requester. Resource references are resolved in the same organization before invocation; the trusted scope allowlist must contain every referenced subject/property/negotiation/offer/effect fact. No requester may supply arbitrary current=true assertions as authentication or acceptance.

Authority is loaded independently from current organization resources and narrowed to actor/action/target/purpose, effective interval and policy revision. A revoked grant, hold or emergency stop denies execution. The Source Authority entry binds exact writer (`woia-re-transactions`), organization, allowed target, fact family, source namespace, map revision and interval. Evidence binds source reference/version, recorded and fresh-through time. A conflicting or stale source blocks, without a latest-wins fallback. The host verifies source attestations and attributable human principal competence before constructing the envelope.

Human decisions bind action, target, organization, exact JSON payload SHA-256, approving principal (different from recorder), current policy revision, interval and immutable source reference. Negotiation/Offer/commitment recording requires this exact human evidence; technical access alone grants no authority. Reservation requires current Mandate version, reservation.commit power, represented subjects and property scopes. Changed reservation commitment rechecks Mandate and decision rather than inheriting prior permission.

## Deterministic recording and persistence

`initial(organization)` creates an empty local state. `execute(state, request)` returns a cloned candidate state and operation receipt; input state never changes. All state mutations and operation-key uniqueness must be persisted atomically under organization+expected_revision compare-and-swap. A caller must reload and revalidate after CAS failure. The reducer's global revision prevents stale concurrent writes when the host satisfies this boundary; it does not independently provide distributed locking or durable storage. One authoritative state per organizational transaction scope is required; independent replicas may not each accept competing reservations.

Operation keys replay only identical action/target/payload/evidence/purpose. Replay still validates current authority/source. Changed material requests under a reused key fail. Reservation create rejects overlapping active Property scopes within the authoritative state. Expiry does not silently free commitments until an explicit sourced expiry command is recorded; this intentionally fails closed if stale active reservations need reconciliation. Release and expiry cannot fabricate refund/payment/availability.

`negotiation.record` registers one human-led context. `offer.record` creates one human-attributed Offer with effective expiry; `offer.supersede` creates a new immutable object and one directed supersession. A superseded/expired Offer cannot commit a new reservation. `reservation.update` appends conditions/expiry while retaining old versions. `sale-transaction.milestone.record` records one exact signature/closing/money/possession fact reference, never infers the others. `close-record` requires a competent SaleClosing source; occurred time cannot be later than trusted now.

## Deliberate non-capabilities

No external communication, autonomous negotiation, legal applicability determination, charge/journal posting, payment, backend selection, authority creation, orchestrator or DBMS. Unknown remote effects are reconciled by their owner before retry; no remote dispatch exists here. Live adapter, physical persistence/locking and Operator E2E are later qualification gates. Public fixtures contain synthetic identities and no private policies.
