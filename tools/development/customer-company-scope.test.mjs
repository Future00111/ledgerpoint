import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {build}=createRequire(root+'/artifacts/api-server/package.json')('esbuild');
const source=readFileSync(root+'/artifacts/ledgerly/src/pages/Customers.jsx','utf8');
const clauses=new Map([...source.matchAll(/import (.*?) from ['"](.*?)['"]/g)].map(m=>[m[2],m[1]]));
const result=await build({stdin:{contents:source,loader:'jsx'},bundle:true,write:false,
  platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'boundary-only',setup(build){
    build.onResolve({filter:/.*/},({path:p})=>p==='react'||p.startsWith('react/')?{path:p,external:true}:{path:p,namespace:'stub'});
    build.onLoad({filter:/.*/,namespace:'stub'},({path:p})=>{
      if(p==='@/lib/useCompany')return {contents:'export const useCompany=()=>globalThis.__customerScopeFixture;'};
      const names=clauses.get(p)?.match(/\{(.*?)\}/)?.[1].split(',').map(s=>s.trim()).filter(Boolean)??[];
      return {contents:'export default ()=>null;\n'+names.map(n=>`export const ${n}=()=>null;`).join('\n')};
    });
  }}]});
const mod={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(
  createRequire(root+'/artifacts/ledgerly/package.json'),mod,mod.exports);
function boundary(company){
  globalThis.__customerScopeFixture={activeCompany:company};
  try{return mod.exports.default()}finally{delete globalThis.__customerScopeFixture}
}
test('actual Customers boundary gives A and B separate React state lifetimes',()=>{
  const a=boundary({id:'A'}),b=boundary({id:'B'});
  assert.equal(a.type,b.type);
  assert.equal(a.key,'A');assert.equal(b.key,'B');
  assert.equal(b.props.activeCompany.id,'B');
});
test('clearing company unmounts the prior directory and open forms',()=>{
  assert.notEqual(boundary(null).key,boundary({id:'A'}).key);
});
test('refreshing the same company does not unnecessarily remount its workspace',()=>{
  assert.equal(boundary({id:'A',name:'before'}).key,boundary({id:'A',name:'after'}).key);
});
