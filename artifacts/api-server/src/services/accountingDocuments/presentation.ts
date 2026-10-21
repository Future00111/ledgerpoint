const aliases:Record<string,string>={revenue:"income",expenses:"expense",assets:"asset",liabilities:"liability"};
const category=(t:string)=>aliases[t]??t;
const definitions:Record<string,string>={income:"Revenue",cost_of_sales:"Cost of sales",expense:"Operating expenses",
  asset:"Assets",liability:"Liabilities",equity:"Equity"};
export function sections(rows:any[],categories:string[]) {
  return categories.map(cat=>{
    const groups=new Map<string,any>();
    for(const a of rows.filter(r=>category(String(r.account_type).toLowerCase())===cat)) {
      const name=a.report_group??definitions[cat]!;
      const group=groups.get(name)??{name,subtotal_minor:"0",accounts:[]};
      group.accounts.push({account_id:a.account_id,code:a.code,name:a.name,amount_minor:a.amount_minor,display_order:a.display_order??0});
      group.subtotal_minor=(BigInt(group.subtotal_minor)+BigInt(a.amount_minor)).toString();
      groups.set(name,group);
    }
    for(const g of groups.values()) g.accounts.sort((a:any,b:any)=>a.display_order-b.display_order||String(a.code).localeCompare(String(b.code)));
    const ordered=[...groups.values()].sort((a,b)=>(a.accounts[0]?.display_order??0)-(b.accounts[0]?.display_order??0)||a.name.localeCompare(b.name));
    return {category:cat,label:definitions[cat],groups:ordered,total_minor:ordered.reduce((n,g)=>n+BigInt(g.subtotal_minor),0n).toString()};
  });
}
export function movementAccounts(lines:any[]) {
  const byId=new Map<string,any>();
  for(const l of lines) {
    const income=category(String(l.account_type).toLowerCase())==="income";
    const a=byId.get(l.account_id)??{account_id:l.account_id,code:l.account_code,name:l.account_name,
      account_type:l.account_type,report_group:l.report_group,display_order:l.display_order,amount_minor:"0"};
    const movement=(BigInt(l.debit_minor)-BigInt(l.credit_minor))*(income?-1n:1n);
    a.amount_minor=(BigInt(a.amount_minor)+movement).toString();byId.set(l.account_id,a);
  }
  return [...byId.values()];
}
