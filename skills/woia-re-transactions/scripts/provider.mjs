import { begin, finish, fields, references, requireValue, human, time } from './guard.mjs';

export const actions = ['negotiation.record', 'offer.record', 'offer.supersede', 'reservation.create', 'reservation.update', 'reservation.release', 'reservation.expire', 'sale-transaction.milestone.record', 'sale-transaction.close-record'];
export const initial = organization => ({ organization, revision: 0, operations: {}, history: [], negotiations: {}, offers: {}, reservations: {}, sales: {} });
const unique = values => new Set(values).size === values.length;
const factKind = action => action.startsWith('negotiation.') ? 'Negotiation' : action.startsWith('offer.') ? 'Offer' : action.startsWith('reservation.') ? 'Reservation' : action.endsWith('close-record') ? 'SaleClosing' : 'SaleMilestone';
function mandate(q, version, negotiation) {
  const m = q.authority.mandate;
  requireValue(m?.reference === version.mandate_ref && m.version === version.mandate_version && m.current === true && !m.revoked && m.power === 'reservation.commit' && m.property_refs?.length && version.property_refs.every(ref => negotiation.property_refs.includes(ref) && m.property_refs.includes(ref)) && negotiation.participants.every(x => m.subject_refs?.includes(x.subject_ref)) && time(q.now) >= time(m.valid_from) && time(q.now) < time(m.valid_until), 'CURRENT_MANDATE_SCOPE_REQUIRED');
}

export function execute(state, request) {
  const q = structuredClone(request), c = begin(state, q, actions, 'woia-re-transactions'), p = q.payload;
  requireValue(['Sales', 'Leasing'].includes(q.authority.department), 'TRANSACTION_OWNER_REQUIRED');
  if (!q.action.startsWith('reservation.')) requireValue(q.authority.department === 'Sales', 'SALES_OWNER_REQUIRED');
  requireValue(q.evidence.fact_kind === factKind(q.action), 'FACT_KIND_MISMATCH');
  if (c.replay) return { state: c.next, result: c.replay };
  if (q.action === 'negotiation.record') {
    fields(p, ['property_refs', 'participants', 'terms_ref']); human(q); references(q, p.property_refs);
    requireValue(!c.next.negotiations[q.target] && unique(p.property_refs) && Array.isArray(p.participants) && p.participants.length && p.participants.every(x => x.subject_ref && x.role && Object.keys(x).every(k => ['subject_ref', 'role'].includes(k)) && q.authority.resources.includes(x.subject_ref)) && unique(p.participants.map(x => `${x.subject_ref}:${x.role}`)) && p.terms_ref && q.authority.resources.includes(p.terms_ref), 'NEGOTIATION_CONTEXT_REQUIRED');
    c.next.negotiations[q.target] = { ...p, evidence: q.evidence };
  } else if (q.action.startsWith('offer.')) {
    fields(p, ['negotiation_ref', 'terms_ref', 'valid_until', 'supersedes']); human(q);
    requireValue(c.next.negotiations[p.negotiation_ref] && q.authority.resources.includes(p.negotiation_ref) && p.terms_ref && q.authority.resources.includes(p.terms_ref) && !c.next.offers[q.target] && time(p.valid_until) > time(q.now), 'ATTRIBUTABLE_OFFER_REQUIRED');
    if (q.action === 'offer.supersede') {
      const old = c.next.offers[p.supersedes];
      requireValue(old && old.negotiation_ref === p.negotiation_ref && !Object.values(c.next.offers).some(x => x.supersedes === p.supersedes) && q.authority.resources.includes(p.supersedes), 'SUPERSESSION_CONFLICT');
    } else requireValue(!p.supersedes, 'USE_OFFER_SUPERSEDE');
    c.next.offers[q.target] = { ...p, evidence: q.evidence };
  } else if (q.action.startsWith('reservation.')) {
    let r = c.next.reservations[q.target];
    if (q.action === 'reservation.create') {
      fields(p, ['negotiation_ref', 'offer_ref', 'property_refs', 'mandate_ref', 'mandate_version', 'conditions', 'expires_at']); human(q); references(q, p.property_refs);
      const n = c.next.negotiations[p.negotiation_ref], o = c.next.offers[p.offer_ref];
      requireValue(!r && n && o?.negotiation_ref === p.negotiation_ref && q.authority.resources.includes(p.negotiation_ref) && q.authority.resources.includes(p.offer_ref) && time(o.valid_until) > time(q.now) && !Object.values(c.next.offers).some(x => x.supersedes === p.offer_ref), 'CURRENT_ACCEPTED_OFFER_REQUIRED');
      mandate(q, p, n);
      requireValue(unique(p.property_refs) && Array.isArray(p.conditions) && p.conditions.every(x => x.condition_id && x.description && Object.keys(x).every(k => ['condition_id', 'description'].includes(k))) && unique(p.conditions.map(x => x.condition_id)) && time(p.expires_at) > time(q.now), 'RESERVATION_CONDITIONS_REQUIRED');
      requireValue(!Object.values(c.next.reservations).some(x => x.status === 'ACTIVE' && x.versions.at(-1).property_refs.some(ref => p.property_refs.includes(ref))), 'COMPETING_RESERVATION');
      r = c.next.reservations[q.target] = { status: 'ACTIVE', versions: [{ ...p, evidence: q.evidence }] };
    } else {
      requireValue(r?.status === 'ACTIVE', 'ACTIVE_RESERVATION_REQUIRED');
      if (q.action === 'reservation.update') {
        fields(p, ['conditions', 'expires_at']); human(q);
        requireValue(time(q.now) < time(r.versions.at(-1).expires_at), 'RESERVATION_EXPIRED_RECONCILE_REQUIRED');
        mandate(q, r.versions.at(-1), c.next.negotiations[r.versions.at(-1).negotiation_ref]);
        requireValue(Array.isArray(p.conditions) && p.conditions.every(x => x.condition_id && x.description && Object.keys(x).every(k => ['condition_id', 'description'].includes(k))) && unique(p.conditions.map(x => x.condition_id)) && time(p.expires_at) > time(q.now), 'RESERVATION_CONDITIONS_REQUIRED');
        r.versions.push({ ...r.versions.at(-1), ...p, evidence: q.evidence });
      } else {
        fields(p, ['reason']); requireValue(p.reason, 'REASON_REQUIRED');
        if (q.action === 'reservation.expire') requireValue(time(q.now) >= time(r.versions.at(-1).expires_at), 'NOT_EXPIRED'); else human(q);
        r.status = q.action === 'reservation.expire' ? 'EXPIRED' : 'RELEASED';
        r.terminal_evidence = q.evidence;
      }
    }
  } else {
    requireValue(q.authority.department === 'Sales', 'SALES_OWNER_REQUIRED');
    const s = c.next.sales[q.target] ??= { milestones: [], closing: null };
    if (q.action === 'sale-transaction.milestone.record') {
      fields(p, ['negotiation_ref', 'milestone_code', 'occurrence_id', 'fact_ref']);
      requireValue(c.next.negotiations[p.negotiation_ref] && q.authority.resources.includes(p.negotiation_ref) && ['signature', 'closing', 'money', 'possession'].includes(p.milestone_code) && p.occurrence_id && p.fact_ref && q.authority.resources.includes(p.fact_ref) && !s.milestones.some(x => x.milestone_code === p.milestone_code && x.occurrence_id === p.occurrence_id), 'INDEPENDENT_MILESTONE_REQUIRED');
      requireValue(!s.negotiation_ref || s.negotiation_ref === p.negotiation_ref, 'SALE_CONTEXT_CONFLICT');
      s.negotiation_ref = p.negotiation_ref; s.milestones.push({ ...p, evidence: q.evidence });
    } else {
      fields(p, ['negotiation_ref', 'closing_fact_ref', 'occurred_at']); human(q);
      requireValue(c.next.negotiations[p.negotiation_ref] && q.authority.resources.includes(p.negotiation_ref) && q.authority.resources.includes(p.closing_fact_ref) && !s.closing && (!s.negotiation_ref || s.negotiation_ref === p.negotiation_ref) && time(p.occurred_at) <= time(q.now) && q.evidence.fact_kind === 'SaleClosing', 'COMPETENT_CLOSING_FACT_REQUIRED');
      s.negotiation_ref = p.negotiation_ref; s.closing = { ...p, evidence: q.evidence };
    }
  }
  return finish(c, q, { action: q.action, target: q.target, recorded: true, external_contact_executed: false, money_posted: false });
}
