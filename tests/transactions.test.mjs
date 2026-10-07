import test from 'node:test';
import assert from 'node:assert/strict';
import { execute, initial, actions } from '../skills/woia-re-transactions/scripts/provider.mjs';
import { digest } from '../skills/woia-re-transactions/scripts/guard.mjs';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';

const now = '2026-10-07T12:00:00Z', before = '2026-10-07T00:00:00Z', after = '2026-10-08T00:00:00Z';
const resources = ['n1', 'o1', 'o2', 'r1', 'r2', 's1', 'p1', 'p2', 'person1', 'closing1', 'money1', 'signature1', 'possession1', 'terms1', 'human-terms1', 'offer-terms1', 'offer-terms2', 'terms2'];
function request(state, action, target, payload) {
  const fact_kind = action.startsWith('negotiation.') ? 'Negotiation' : action.startsWith('offer.') ? 'Offer' : action.startsWith('reservation.') ? 'Reservation' : action.endsWith('close-record') ? 'SaleClosing' : 'SaleMilestone';
  const q = { organization: 'org1', purpose: 'sale-fulfillment', now, action, target, payload, operation_id: `${action}-${target}-${state.revision}`, expected_revision: state.revision,
    authority: { authenticated: true, organization: 'org1', actor: 'recorder1', purpose: 'sale-fulfillment', department: 'Sales', actions, resources, current: true, policy_revision: 'policy1', valid_from: before, valid_until: after,
      mandate: { reference: 'm1', version: 1, power: 'reservation.commit', current: true, property_refs: ['p1', 'p2'], subject_refs: ['person1'], valid_from: before, valid_until: after } },
    source_authority: { organization: 'org1', map_revision: 'map1', writer: 'woia-re-transactions', source: 'competent-source', fact_kinds: [fact_kind], targets: [target], current: true, valid_from: before, valid_until: after },
    evidence: { source: 'competent-source', reference: 'e1', version: 'ev1', fact_kind, recorded_at: before, fresh_until: after } };
  q.human_decision = { principal: 'advisor1', kind: 'competent-human', organization: 'org1', action, target, payload_digest: digest(payload), policy_revision: 'policy1', current: true, reference: 'human-event1', valid_from: before, valid_until: after };
  return q;
}
function negotiation() { const state = initial('org1'); return execute(state, request(state, 'negotiation.record', 'n1', { property_refs: ['p1'], participants: [{ subject_ref: 'person1', role: 'buyer' }], terms_ref: 'human-terms1' })).state; }
function offer() { const state = negotiation(); return execute(state, request(state, 'offer.record', 'o1', { negotiation_ref: 'n1', terms_ref: 'offer-terms1', valid_until: after })).state; }
const reservationPayload = () => ({ negotiation_ref: 'n1', offer_ref: 'o1', property_refs: ['p1'], mandate_ref: 'm1', mandate_version: 1, conditions: [{ condition_id: 'c1', description: 'accepted-condition-ref' }], expires_at: after });
function reserved() { const state = offer(); return execute(state, request(state, 'reservation.create', 'r1', reservationPayload())).state; }

test('human negotiation references existing identity and property without copying identities', () => { const s = negotiation(); assert.equal(s.negotiations.n1.participants[0].subject_ref, 'person1'); assert.equal(s.revision, 1); });
test('offer supersession preserves the original attributable terms', () => { const s = offer(); const n = execute(s, request(s, 'offer.supersede', 'o2', { negotiation_ref: 'n1', terms_ref: 'offer-terms2', valid_until: after, supersedes: 'o1' })).state; assert.deepEqual(n.offers.o1, s.offers.o1); assert.equal(n.offers.o2.supersedes, 'o1'); });
test('superseded offer cannot create a reservation', () => { let s = offer(); s = execute(s, request(s, 'offer.supersede', 'o2', { negotiation_ref: 'n1', terms_ref: 'terms2', valid_until: after, supersedes: 'o1' })).state; assert.throws(() => execute(s, request(s, 'reservation.create', 'r1', reservationPayload())), /CURRENT_ACCEPTED_OFFER/); });
test('competing reservation rejected atomically without state mutation', () => { const s = reserved(), copy = structuredClone(s); assert.throws(() => execute(s, request(s, 'reservation.create', 'r2', reservationPayload())), /COMPETING_RESERVATION/); assert.deepEqual(s, copy); });
test('reservation changes preserve previous condition version', () => { const s = reserved(); const n = execute(s, request(s, 'reservation.update', 'r1', { conditions: [{ condition_id: 'c2', description: 'amended-condition-ref' }], expires_at: after })).state; assert.equal(n.reservations.r1.versions.length, 2); assert.deepEqual(n.reservations.r1.versions[0], s.reservations.r1.versions[0]); });
test('mandate revocation rejects changed reservation commitment', () => { const s = reserved(), q = request(s, 'reservation.update', 'r1', { conditions: [], expires_at: after }); q.authority.mandate.revoked = true; assert.throws(() => execute(s, q), /CURRENT_MANDATE/); });
test('expired commitment cannot be extended as active before explicit reconciliation', () => { let s = offer(); const p = reservationPayload(); p.expires_at = '2026-10-07T13:00:00Z'; s = execute(s, request(s, 'reservation.create', 'r1', p)).state; const q = request(s, 'reservation.update', 'r1', { conditions: [], expires_at: after }); q.now = '2026-10-07T13:00:00Z'; assert.throws(() => execute(s, q), /RESERVATION_EXPIRED_RECONCILE/); });
test('expiry is explicit and cannot infer release before accepted expiry', () => { const s = reserved(), q = request(s, 'reservation.expire', 'r1', { reason: 'time' }); assert.throws(() => execute(s, q), /NOT_EXPIRED/); });
test('release does not create payment or availability facts', () => { const s = reserved(); const n = execute(s, request(s, 'reservation.release', 'r1', { reason: 'human-release' })); assert.equal(n.state.reservations.r1.status, 'RELEASED'); assert.equal(n.result.money_posted, false); assert.equal(n.result.external_contact_executed, false); assert.equal(n.state.payments, undefined); });
test('closing is distinct from all independent milestones', () => { let s = offer(); s = execute(s, request(s, 'sale-transaction.milestone.record', 's1', { negotiation_ref: 'n1', milestone_code: 'money', occurrence_id: 'occ1', fact_ref: 'money1' })).state; const n = execute(s, request(s, 'sale-transaction.close-record', 's1', { negotiation_ref: 'n1', closing_fact_ref: 'closing1', occurred_at: now })).state; assert.equal(n.sales.s1.milestones.length, 1); assert.equal(n.sales.s1.milestones[0].milestone_code, 'money'); assert.equal(n.sales.s1.closing.closing_fact_ref, 'closing1'); assert.equal(n.sales.s1.possession, undefined); });
test('duplicate milestone key denied', () => { let s = offer(); const p = { negotiation_ref: 'n1', milestone_code: 'signature', occurrence_id: 'occ1', fact_ref: 'signature1' }; s = execute(s, request(s, 'sale-transaction.milestone.record', 's1', p)).state; assert.throws(() => execute(s, request(s, 'sale-transaction.milestone.record', 's1', p)), /INDEPENDENT_MILESTONE/); });
test('same operation replays and changed payload conflicts', () => { const s = offer(), q = request(s, 'reservation.create', 'r1', reservationPayload()), n = execute(s, q); assert.deepEqual(execute(n.state, q), n); const conflict = structuredClone(q); conflict.payload.expires_at = '2026-10-09T00:00:00Z'; assert.throws(() => execute(n.state, conflict), /IDEMPOTENCY_CONFLICT/); });
test('stale competing writer rejected', () => { const s = offer(), q = request(s, 'reservation.create', 'r1', reservationPayload()); q.expected_revision--; assert.throws(() => execute(s, q), /REVISION_CONFLICT/); });
for (const [name, mutate, code] of [
  ['cross organization', q => q.organization = 'org2', 'ORGANIZATION_SCOPE'],
  ['missing grant', q => q.authority.actions = [], 'ACTION_OR_RESOURCE_DENIED'],
  ['resource mismatch', q => q.authority.resources = [], 'ACTION_OR_RESOURCE_DENIED'],
  ['wrong purpose', q => q.purpose = 'unapproved', 'CURRENT_AUTHORITY_REQUIRED'],
  ['expired authority', q => q.authority.valid_until = before, 'CURRENT_AUTHORITY_REQUIRED'],
  ['revoked authority', q => q.authority.revoked = true, 'CURRENT_AUTHORITY_REQUIRED'],
  ['emergency hold', q => q.authority.emergency_stop = true, 'CURRENT_AUTHORITY_REQUIRED'],
  ['wrong source writer', q => q.source_authority.writer = 'woia-sales-pipeline', 'CURRENT_SCOPED_SOURCE_REQUIRED'],
  ['wrong source target', q => q.source_authority.targets = ['other'], 'CURRENT_SCOPED_SOURCE_REQUIRED'],
  ['conflicting source', q => q.source_authority.conflict = true, 'CURRENT_SCOPED_SOURCE_REQUIRED'],
  ['future source map', q => q.source_authority.valid_from = after, 'CURRENT_SCOPED_SOURCE_REQUIRED'],
  ['stale source', q => q.evidence.fresh_until = before, 'CURRENT_SCOPED_SOURCE_REQUIRED'],
  ['wrong fact family', q => { q.evidence.fact_kind = 'Payment'; q.source_authority.fact_kinds = ['Payment']; }, 'FACT_KIND_MISMATCH'],
  ['autonomous negotiation', q => delete q.human_decision, 'EXACT_HUMAN_DECISION_REQUIRED'],
  ['changed human terms', q => q.payload.terms_ref = 'different', 'EXACT_HUMAN_DECISION_REQUIRED'],
  ['self approval', q => q.human_decision.principal = q.authority.actor, 'EXACT_HUMAN_DECISION_REQUIRED'],
  ['agent offers under Leasing', q => q.authority.department = 'Leasing', 'SALES_OWNER_REQUIRED'],
]) test(name, () => { const s = initial('org1'), q = request(s, 'negotiation.record', 'n1', { property_refs: ['p1'], participants: [{ subject_ref: 'person1', role: 'buyer' }], terms_ref: 'terms1' }); mutate(q); assert.throws(() => execute(s, q), new RegExp(code)); assert.equal(s.revision, 0); });
test('unowned financial/contact/pipeline fields denied', () => { const s = initial('org1'), q = request(s, 'negotiation.record', 'n1', { property_refs: ['p1'], participants: [{ subject_ref: 'person1', role: 'buyer' }], terms_ref: 'terms1', pipeline_stage: 'won', payment: 'paid', send_external: true }); assert.throws(() => execute(s, q), /UNOWNED_FIELDS/); });
test('replay still rechecks revoked current authority', () => { const s = offer(), q = request(s, 'reservation.create', 'r1', reservationPayload()), n = execute(s, q); q.authority.revoked = true; assert.throws(() => execute(n.state, q), /CURRENT_AUTHORITY/); });
test('future closing fact is not present closing evidence', () => { const s = offer(), q = request(s, 'sale-transaction.close-record', 's1', { negotiation_ref: 'n1', closing_fact_ref: 'closing1', occurred_at: after }); assert.throws(() => execute(s, q), /COMPETENT_CLOSING_FACT/); });
test('JSON schema compiles and validates exact action variants', () => {
  const schema = JSON.parse(readFileSync(new URL('../skills/woia-re-transactions/assets/request.schema.json', import.meta.url)));
  const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);
  const s = initial('org1'), q = request(s, 'negotiation.record', 'n1', { property_refs: ['p1'], participants: [{ subject_ref: 'person1', role: 'buyer' }], terms_ref: 'terms1' });
  assert.equal(validate(q), true, JSON.stringify(validate.errors));
  const invalid = structuredClone(q); invalid.payload.send_external = true; assert.equal(validate(invalid), false);
  const incomplete = structuredClone(q); delete incomplete.human_decision; assert.equal(validate(incomplete), false);
  const mismatch = structuredClone(q); mismatch.action = 'offer.record'; assert.equal(validate(mismatch), false);
});
