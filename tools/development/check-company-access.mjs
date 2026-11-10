// Pure authorization checks; deliberately NOT real Clerk/session acceptance.
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const api=path.join(root,'artifacts/api-server');
const require=createRequire(path.join(api,'package.json'));
const {buildSync}=require('esbuild');
const dir=mkdtempSync(path.join(tmpdir(),'ledgerly-company-access-'));
const env={PATH:process.env.PATH,HOME:dir,LANG:'C',LC_ALL:'C',NODE_ENV:'test',
  NODE_PATH:path.join(api,'node_modules'),
  DATABASE_URL:'postgresql://unused:unused@127.0.0.1:1/ledgerpoint_no_database'};
try {
  for(const [index,file] of [
    'src/middlewares/companyScope.test.ts',
    'src/security/companyPolicy.test.ts',
    'src/security/roles.test.ts',
    'src/security/companyRoutes.test.ts',
  ].entries()){
    const outfile=path.join(dir,`${index}.cjs`);
    buildSync({entryPoints:[path.join(api,file)],outfile,bundle:true,platform:'node',format:'cjs',
      external:['pg','pino','pino-http','pino-pretty','thread-stream','@clerk/express'],logLevel:'warning'});
    execFileSync(process.execPath,['--test',outfile],{cwd:api,env,stdio:'inherit'});
  }
  execFileSync(process.execPath,['--test','artifacts/ledgerly/src/lib/companySelection.test.mjs'],
    {cwd:root,env,stdio:'inherit'});
  console.log('PASS: pure membership/role/company-selection checks only; no Clerk login, session or database acceptance claimed.');
} finally {
  rmSync(dir,{recursive:true,force:true});
  console.log('CLEANUP: owned compiler scratch removed; no application services started.');
}
