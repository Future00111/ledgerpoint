import{disposableTarget,verifyTarget}from'./testTarget';
const target=disposableTarget();
async function main(){
 const {pool}=await import('@workspace/db');await verifyTarget(pool,target.database);
 const {enqueueIntakeJob,recoverIntakeJob}=await import('./service');
 process.once('message',async(input:any)=>{try{
  const data=input.mode==='commit'?await enqueueIntakeJob(input.company,input.actor,input.source,input.body):await recoverIntakeJob(input.company,input.actor,input.source,input.body.request_id);
  process.send?.({ok:true,data});
  if(input.mode==='recover'){await pool.end();process.disconnect?.();}
  // The commit producer remains alive until the harness kills the actual process.
 }catch(error:any){process.send?.({ok:false,code:error.code??'WORKER_FAILED'});await pool.end();process.disconnect?.();}});
 process.send?.({ready:true});
}
main().catch(()=>{process.exitCode=1;process.disconnect?.();});
