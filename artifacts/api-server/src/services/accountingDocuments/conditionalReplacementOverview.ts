import { DraftError, uuid } from '../financialDrafts/contract';
import { scope, transact } from './core';
import { history as readHistory, replacementSchema } from './conditionalReplacements';
import { readReplacementBinding } from './replacementBindings';
import { presentReplacementHistory, type ObservationState } from './replacementPresentation';

/** Read-only overview: existing immutable history plus per-version verified observation
 * state and existing permanent consumption. Never a posting or qualification decision. */
export async function conditionalReplacementOverview(company:string,actor:string,id:string) {
  uuid(id);
  // One read-only transaction: history, per-version observation and consumption are a single snapshot.
  return transact(async q=>{
    await scope(q,company,actor);
    await replacementSchema(q);
    const history=await readHistory(q,company,id);
    const observations:ObservationState[]=[];
    for(const row of history.replacements) {
      try {
        // Explicit id verifies that exact historical version only; it never falls back to original terms.
        const binding=await readReplacementBinding(q,company,id,row.id);
        observations.push(binding?.observation
          ? {state:'observed',observed_at:binding.observation.observed_at??null,binding_hash:binding.observation.binding_hash??null}
          : {state:'unobserved'});
      } catch(error) {
        if(error instanceof DraftError && error.status===503) {observations.push({state:'unavailable',code:error.code});continue;}
        throw error;
      }
    }
    const consumed=Boolean((await q.query(`SELECT 1 FROM accounting_paid_credit_operations WHERE company_id=$1
      AND intent->>'original_id'=$2::text AND intent ? 'conditional_admission' LIMIT 1`,[company,id])).rowCount);
    return presentReplacementHistory(history.original_binding_hash,history.replacements,observations,consumed);
  },true);
}
