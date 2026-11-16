import test from 'node:test';import assert from 'node:assert/strict';
import { initialState } from './core.mjs';import { currentView } from './current-view.mjs';
test('current view preserves source/history and separates publication from parent acceptance', () => {
 const catalog={version:1,source:{source_bullet_count:92},tasks:[{id:'a',title:'Parent',priority:1,dependencies:[],files:['a.js'],kind:'implementation',approval:'approved',acceptance:['Whole journey']}]};
 const q=initialState(catalog);q.tasks.a.evidence={commit:'abc'};q.tasks.a.acceptedOutcomes=[{id:'child',acceptedAt:10,remaining:['Other cases'],nextAction:'Implement other cases'}];
 const a={codeHead:'abc',queueState:q},before=structuredClone(a);
 let v=currentView(catalog,a,{now:20,publishedCommits:['abc']});assert.equal(v.tasks[0].acceptance,'child-only');assert.equal(v.tasks[0].publication,'published');assert.deepEqual(v.tasks[0].remainingAcceptanceCriteria,['Whole journey']);assert.deepEqual(a,before);
 q.events.push({type:'reopen',taskId:'a',at:15});v=currentView(catalog,a,{now:20,publishedCommits:['abc']});assert.equal(v.tasks[0].acceptance,'parent-not-accepted');assert.equal(v.tasks[0].childOutcomes.length,1);
});
test('dependency reopen invalidates historical outcomes even after dependency reacceptance', () => {
 const make=(id,dependencies=[])=>({id,title:id,priority:1,dependencies,files:[id+'.js'],kind:'implementation',approval:'approved',acceptance:['All cases']});
 for(const discovered of [false,true]){
  const c={version:1,tasks:[make('root'),make('mid',['root']),make('parent',discovered?[]:['mid'])]};const q=initialState(c);
  q.tasks.root.status='done';q.tasks.mid.status='done';if(discovered)q.tasks.parent.discoveredDependencies=['mid'];
  q.tasks.parent.checkpoint='Old next';q.tasks.parent.acceptedOutcomes=[{id:'slice',acceptedAt:10,remaining:['Rest'],nextAction:'Old next'}];
  let v=currentView(c,{codeHead:'abc',queueState:q},{now:30});assert.equal(v.tasks[2].acceptance,'child-only');
  q.events.push({type:'reopen',taskId:'root',at:10});
  v=currentView(c,{codeHead:'abc',queueState:q},{now:30});assert.equal(v.tasks[2].acceptance,'parent-not-accepted');assert.notEqual(v.tasks[2].nextAction,'Old next');
 }
});
