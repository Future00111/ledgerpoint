/** Pure public projection of immutable replacement history. No money is calculated,
 * no terms are scaled, and no authority token or internal binding payload is exposed. */
export type ObservationState = { state:'observed'; observed_at:string|null; binding_hash:string|null } | { state:'unobserved' } | { state:'unavailable'; code:string };

const evidenceView=(e:any)=>e?{id:e.id,terms:e.terms,evidence_text:e.evidence_text,evidence_hash:e.evidence_hash,terms_hash:e.terms_hash,recorded_at:e.recorded_at}:null;

export function presentReplacementHistory(originalHash:string,rows:any[],observations:ObservationState[],consumed:boolean) {
  if(observations.length!==rows.length) throw new Error('Observation states must match history rows.');
  const ids=new Set(rows.map(r=>r.id));
  rows.forEach((r,i)=>{
    // History is a single ordered chain: root first, each row naming its predecessor.
    if((i===0?null:rows[i-1].id)!==(r.predecessor_id??null) || ids.size!==rows.length) throw new Error('Replacement history is not a single chain.');
  });
  return {
    original_binding_hash:originalHash,
    consumed,
    current_replacement_id:rows.length?rows[rows.length-1].id:null,
    replaceable:!consumed,
    posting_available:false,
    replacements:rows.map((r,i)=>({
      id:r.id,position:i+1,request_id:r.request_id,predecessor_id:r.predecessor_id??null,
      recorded_at:r.recorded_at,actor_id:r.actor_id,original_binding_hash:r.original_binding_hash,
      current:i===rows.length-1,observation:observations[i],evidence:evidenceView(r.evidence),
    })),
  };
}
