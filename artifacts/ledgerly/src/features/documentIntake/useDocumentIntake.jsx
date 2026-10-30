import { useCallback, useEffect, useRef, useState } from 'react';
import { documentIntake } from '@/api/documentIntake.mjs';
import { buildReviewedDraft, createScopeGate, emptyAcknowledgements, envelopeKey, reviewMatches } from './model.mjs';

export function useIntakeSources(companyId, documentId = null) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ key: null, loading: true, data: null, error: null });
  const key = JSON.stringify([companyId, documentId]);
  const latestKey = useRef(key); latestKey.current = key;
  const gate = useRef(createScopeGate());
  useEffect(() => {
    const controller = new AbortController();
    const ticket = gate.current.begin(key);
    setState(previous => ({ key, loading: true, data: previous.key === key ? previous.data : null, error: null }));
    if (companyId) documentIntake.list(companyId, documentId, controller.signal).then(data => {
      if (!Array.isArray(data?.sources) || typeof data.can_manage !== 'boolean') throw new Error('Source files could not be verified. Please retry.');
      if (gate.current.current(ticket, latestKey.current) && !controller.signal.aborted) setState({ key, loading: false, data, error: null });
    }).catch(error => {
      if (gate.current.current(ticket, latestKey.current) && !controller.signal.aborted) setState({ key, loading: false, data: null, error });
    });
    else setState({ key, loading: false, data: null, error: null });
    return () => { gate.current.invalidate(); controller.abort(); };
  }, [key, companyId, documentId, version]);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  return { ...(state.key === key ? state : { loading: true, data: null, error: null }), refresh };
}

/** Capture review is distinct from the existing protected posting review. */
export function useCaptureDraft({ companyId, sourceId, kind, envelope, scope = null }) {
  const key = JSON.stringify([companyId, sourceId, kind, scope]);
  const signature = envelopeKey(envelope);
  const latest = useRef({ key, signature }); latest.current = { key, signature };
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ key: null, loading: Boolean(sourceId), source: null, canManage: false, error: null });
  const [review, setReview] = useState(null);
  const [acknowledgements, setAcknowledgements] = useState(emptyAcknowledgements);
  const [busy, setBusy] = useState(false);
  const gate = useRef(createScopeGate());
  const pending = useRef(new Set());
  const invalidateReview = useCallback(() => { setReview(null); setAcknowledgements(emptyAcknowledgements()); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const ticket = gate.current.begin(key);
    pending.current.forEach(item => item.abort()); pending.current.clear();
    invalidateReview(); setBusy(false);
    setState({ key, loading: Boolean(sourceId), source: null, canManage: false, error: null });
    if (sourceId && companyId) documentIntake.get(companyId, sourceId, controller.signal).then(data => {
      if (!data?.source?.id || typeof data.can_manage !== 'boolean') throw new Error('The source file could not be verified.');
      if (gate.current.current(ticket, latest.current.key) && !controller.signal.aborted) setState({ key, loading: false, source: data.source, canManage: data.can_manage, error: null });
    }).catch(error => {
      if (gate.current.current(ticket, latest.current.key) && !controller.signal.aborted) setState({ key, loading: false, source: null, canManage: false, error });
    });
    return () => { gate.current.invalidate(); controller.abort(); pending.current.forEach(item => item.abort()); pending.current.clear(); };
  }, [key, companyId, sourceId, kind, version, invalidateReview]);
  useEffect(() => { if (review && review.envelopeKey !== signature) invalidateReview(); }, [signature, review, invalidateReview]);
  const current = state.key === key ? state : { loading: true, source: null, canManage: false, error: null };
  const currentReview = reviewMatches(review, key, envelope) ? review : null;
  const canManage = current.canManage === true && ['purchase_bill', 'supplier_credit_note'].includes(kind) && !current.source?.document_id;

  const run = async (body, saving) => {
    if (!canManage || busy || pending.current.size > 0 || current.loading || !current.source) throw new Error('The source file is not available for draft preparation.');
    const controller = new AbortController(); pending.current.add(controller);
    const requestKey = key; const requestSignature = envelopeKey(body);
    const requestReview = review;
    // The caller normalises native date inputs before review. Any later edit invalidates its result.
    setBusy(true); setState(previous => ({ ...previous, error: null }));
    if (!saving) invalidateReview();
    try {
      const result = saving
        ? await documentIntake.draft(companyId, sourceId, buildReviewedDraft(requestReview, key, body, acknowledgements), requestReview.revision, controller.signal)
        : await documentIntake.review(companyId, sourceId, body, controller.signal);
      if (controller.signal.aborted || latest.current.key !== requestKey || latest.current.signature !== requestSignature) return null;
      if (saving) return result;
      if (!result?.review_fingerprint || result.revision == null || !result.money) throw new Error('The reviewed totals could not be verified. Review again.');
      setReview({ ...result, key, envelopeKey: requestSignature });
      setAcknowledgements(emptyAcknowledgements());
      setState(previous => ({ ...previous, source: { ...previous.source, revision: result.revision } }));
      return result;
    } catch (error) {
      if (!controller.signal.aborted && latest.current.key === requestKey) {
        setState(previous => ({ ...previous, error }));
        if (['REVIEW_STALE', 'REVISION_CONFLICT', 'SOURCE_ALREADY_LINKED'].includes(error.code)) invalidateReview();
      }
      return null;
    } finally { pending.current.delete(controller); if (!controller.signal.aborted && latest.current.key === requestKey) setBusy(false); }
  };
  return { ...current, canManage, busy, currentReview, acknowledgements,
    acknowledge: (field, value) => setAcknowledgements(previous => ({ ...previous, [field]: value === true })),
    invalidateReview, refresh: () => setVersion(value => value + 1),
    reviewEnvelope: body => run(body, false), saveDraft: body => run(body, true),
  };
}
