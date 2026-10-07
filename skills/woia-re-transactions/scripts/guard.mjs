import { createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function requireValue(value, code) { if (!value) throw new Error(code); }
export function fields(payload, allowed) {
  requireValue(payload && typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).every(k => allowed.includes(k)), 'UNOWNED_FIELDS');
}
export function time(value) { const n = Date.parse(value); requireValue(Number.isFinite(n), 'INVALID_TIME'); return n; }
export function references(request, refs) {
  requireValue(Array.isArray(refs) && refs.length > 0 && refs.every(r => typeof r === 'string' && request.authority.resources.includes(r)), 'REFERENCE_SCOPE');
}
export function begin(state, request, actions, provider) {
  requireValue(state.organization === request.organization && state.organization, 'ORGANIZATION_SCOPE');
  const a = request.authority;
  const now = time(request.now);
  requireValue(a?.authenticated === true && a.organization === state.organization && a.actor && a.purpose === request.purpose && a.policy_revision && a.current === true && !a.revoked && !a.hold && !a.emergency_stop && now >= time(a.valid_from) && now < time(a.valid_until), 'CURRENT_AUTHORITY_REQUIRED');
  requireValue(actions.includes(request.action) && a.actions?.includes(request.action) && a.resources?.includes(request.target), 'ACTION_OR_RESOURCE_DENIED');
  const e = request.evidence, s = request.source_authority;
  requireValue(e?.source && e.reference && e.version && e.recorded_at && e.fact_kind && s?.organization === state.organization && s.map_revision && s.writer === provider && s.source === e.source && s.fact_kinds?.includes(e.fact_kind) && s.targets?.includes(request.target) && s.current === true && !s.conflict && !s.revoked && now >= time(s.valid_from) && now < time(s.valid_until) && time(e.recorded_at) <= now && now <= time(e.fresh_until), 'CURRENT_SCOPED_SOURCE_REQUIRED');
  requireValue(request.operation_id && Number.isInteger(request.expected_revision), 'OPERATION_AND_REVISION_REQUIRED');
  const fingerprint = digest({ action: request.action, target: request.target, payload: request.payload, evidence: request.evidence, purpose: request.purpose });
  const previous = state.operations[request.operation_id];
  if (previous) { requireValue(previous.fingerprint === fingerprint, 'IDEMPOTENCY_CONFLICT'); return { next: structuredClone(state), replay: structuredClone(previous.result) }; }
  requireValue(request.expected_revision === state.revision, 'REVISION_CONFLICT');
  return { next: structuredClone(state), fingerprint };
}
export function human(request) {
  const h = request.human_decision;
  requireValue(h?.principal && h.principal !== request.authority.actor && h.kind === 'competent-human' && h.organization === request.organization && h.action === request.action && h.target === request.target && h.payload_digest === digest(request.payload) && h.policy_revision === request.authority.policy_revision && h.current === true && !h.revoked && h.reference && time(request.now) >= time(h.valid_from) && time(request.now) < time(h.valid_until), 'EXACT_HUMAN_DECISION_REQUIRED');
}
export function finish(context, request, result) {
  context.next.revision += 1;
  context.next.operations[request.operation_id] = { fingerprint: context.fingerprint, result: structuredClone(result) };
  context.next.history.push({ operation_id: request.operation_id, action: request.action, target: request.target, evidence: structuredClone(request.evidence), source_map_revision: request.source_authority.map_revision, human_decision: request.human_decision ? structuredClone(request.human_decision) : null, revision: context.next.revision });
  return { state: context.next, result: structuredClone(result) };
}
