import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { useCanAccessDevTools } from '@/lib/devAccess';
import { useDevSettings, DEV_SETTING_META } from '@/lib/devSettings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Wrench, Building2, Database, Layers, RotateCcw, Download, Upload, Settings2, Check, Loader2 } from 'lucide-react';

const TEMPLATES = [
  { key: 'general_business', label: 'General Business', desc: 'Standard services & sales' },
  { key: 'construction', label: 'Construction', desc: 'Builders, trades, materials' },
  { key: 'retail', label: 'Retail', desc: 'Card & cash sales, stock' },
  { key: 'restaurant', label: 'Restaurant', desc: 'Food, drink, card payments' },
  { key: 'consultant', label: 'Consultant', desc: 'Retainers, subscriptions, travel' },
  { key: 'garage', label: 'Garage', desc: 'Parts, labour, MOT, fuel' },
  { key: 'property', label: 'Property', desc: 'Rental income & management' },
  { key: 'ecommerce', label: 'E-commerce', desc: 'Online sales, postage, ads' },
];

const EXPORT_ENTITIES = [
  'Company', 'Customer', 'Supplier', 'BankAccount', 'SalesInvoice', 'PurchaseBill',
  'SalesCreditNote', 'SupplierCreditNote', 'BankTransaction', 'Document',
  'EmailCaptureLog', 'VATReturn', 'JournalEntry', 'ChartOfAccount',
];

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Btn({ label, icon: Icon, onClick, busy, variant = 'outline', tone }) {
  return (
    <Button variant={variant} size="sm" onClick={onClick} disabled={busy} className="justify-start">
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {label}
    </Button>
  );
}

function download(name, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DevelopmentTools() {
  const { activeCompany, loadCompanies, switchCompany } = useCompany();
  const { toast } = useToast();
  const [settings, toggleSetting] = useDevSettings();
  const [busy, setBusy] = useState(null);
  const [template, setTemplate] = useState('general_business');
  const importRef = useRef(null);
  const canDev = useCanAccessDevTools();

  if (!canDev) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20">
        <Wrench className="w-10 h-10 text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Development Tools are only available in a development environment or to users with the Developer role.
        </p>
      </div>
    );
  }

  const run = async (key, fn) => {
    setBusy(key);
    try {
      const res = await fn();
      return res;
    } finally {
      setBusy(null);
    }
  };

  const handleCreateDemo = async () => {
    if (!window.confirm('Create a new demo company "Ledgerly Demo Ltd" with full sample data?')) return;
    const res = await run('create', () =>
      base44.functions.invoke('manageDemoCompany', { action: 'create', template })
    );
    const data = res?.data || {};
    toast({ title: 'Demo company created', description: `Ledgerly Demo Ltd ready · ${JSON.stringify(data.counts || {})}` });
    await loadCompanies();
    if (data.company_id) {
      const c = (await base44.functions.invoke('getUserCompanies', {})).data?.companies?.find((x) => x.id === data.company_id);
      if (c) switchCompany(c);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset the demo company back to fresh sample data? This deletes all current demo data.')) return;
    const res = await run('reset', () => base44.functions.invoke('manageDemoCompany', { action: 'reset', template }));
    toast({ title: 'Demo company reset', description: JSON.stringify(res?.data?.counts || {}) });
    await loadCompanies();
  };

  const handleDeleteDemo = async () => {
    if (!window.confirm('Permanently delete the demo company and ALL its data?')) return;
    await run('delete', () => base44.functions.invoke('manageDemoCompany', { action: 'delete' }));
    toast({ title: 'Demo company deleted' });
    await loadCompanies();
  };

  const handleGenerate = async (months, random) => {
    if (!activeCompany) return toast({ title: 'Select a company first', variant: 'destructive' });
    const res = await run(`gen-${months}`, () =>
      base44.functions.invoke('generateDemoData', { company_id: activeCompany.id, months, template, random: !!random })
    );
    toast({ title: random ? 'Random data generated' : `${months} month(s) of data generated`, description: JSON.stringify(res?.data?.counts || {}) });
  };

  const handleResetTarget = async (target) => {
    if (!activeCompany) return toast({ title: 'Select a company first', variant: 'destructive' });
    if (!window.confirm(`Delete ${target} for ${activeCompany.name}? This cannot be undone.`)) return;
    const res = await run(`rst-${target}`, () =>
      base44.functions.invoke('resetDemoData', { company_id: activeCompany.id, target })
    );
    toast({ title: `Deleted ${target}`, description: JSON.stringify(res?.data?.deleted || {}) });
  };

  const handleExport = async (kind) => {
    if (!activeCompany) return toast({ title: 'Select a company first', variant: 'destructive' });
    const data = await run(`exp-${kind}`, async () => {
      const out = {};
      for (const t of EXPORT_ENTITIES) {
        try {
          out[t] = await base44.entities[t].filter({ company_id: activeCompany.id }, '-created_date', 5000);
        } catch {
          out[t] = [];
        }
      }
      return out;
    });
    if (kind === 'csv') {
      const rows = (data.BankTransaction || []).map((t) => ({
        date: t.date, description: t.description, money_in: t.money_in, money_out: t.money_out,
        balance: t.balance, status: t.status, account: t.bank_account_name,
      }));
      const headers = Object.keys(rows[0] || {});
      const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
      download(`ledgerly-${activeCompany.id}-transactions.csv`, csv, 'text/csv');
    } else {
      download(`ledgerly-${activeCompany.id}-${kind}.json`, JSON.stringify(data, null, 2));
    }
    toast({ title: `Exported ${kind.toUpperCase()}` });
  };

  const handleImport = async (e, kind) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!activeCompany) return toast({ title: 'Select a company first', variant: 'destructive' });
      let total = 0;
      for (const t of EXPORT_ENTITIES) {
        const rows = (data[t] || []).map((r) => ({ ...r, company_id: activeCompany.id, id: undefined, created_date: undefined, updated_date: undefined, created_by_id: undefined }));
        if (rows.length) {
          try { await base44.entities[t].bulkCreate(rows); total += rows.length; } catch { /* skip */ }
        }
      }
      toast({ title: 'Import complete', description: `${total} records imported into ${activeCompany.name}` });
      await loadCompanies();
    } catch (err) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Development Tools</h1>
              <p className="text-sm text-muted-foreground">
                Hidden module · visible only in development or with the Developer role.{' '}
                {activeCompany ? `Active company: ${activeCompany.name}` : 'No active company.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1 — Demo Company */}
      <SectionCard icon={Building2} title="Demo Company" description="Create a ready-made Ledgerly Demo Ltd with customers, suppliers, invoices, bills, banking, VAT and more.">
        <div className="flex flex-wrap gap-2">
          <Btn label="Create Demo Company" icon={Building2} onClick={handleCreateDemo} busy={busy === 'create'} variant="default" />
          <Btn label="Reset Demo Company" icon={RotateCcw} onClick={handleResetDemo} busy={busy === 'reset'} />
          <Btn label="Delete Demo Company" icon={RotateCcw} onClick={handleDeleteDemo} busy={busy === 'delete'} />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Creates Ledgerly Demo Ltd · General Business · VAT registered · Quarterly · Year ending 31 March · GBP, with 10 customers, 10 suppliers, 2 bank accounts, 50 invoices, 35 bills, 5 sales credit notes, 5 supplier credit notes, 120 bank transactions, 20 documents, 15 email captures, 3 VAT periods, 50 journal entries — and populates dashboard KPIs.
        </p>
      </SectionCard>

      {/* Section 2 — Generate Demo Data */}
      <SectionCard icon={Database} title="Generate Demo Data" description="Add time-based or random transactions to the active company using the selected template.">
        <div className="flex flex-wrap gap-2">
          <Btn label="Generate 1 Month" icon={Database} onClick={() => handleGenerate(1)} busy={busy === 'gen-1'} />
          <Btn label="Generate 3 Months" icon={Database} onClick={() => handleGenerate(3)} busy={busy === 'gen-3'} />
          <Btn label="Generate 6 Months" icon={Database} onClick={() => handleGenerate(6)} busy={busy === 'gen-6'} />
          <Btn label="Generate 12 Months" icon={Database} onClick={() => handleGenerate(12)} busy={busy === 'gen-12'} />
          <Btn label="Generate Random Transactions" icon={Database} onClick={() => handleGenerate(0, true)} busy={busy === 'gen-0'} />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Generates invoices, bills, payments, bank transactions, journal entries, VAT, documents, customer & supplier payments, reconciliations, dashboard data and business insights — driven by the template below.
        </p>
      </SectionCard>

      {/* Section 3 — Business Templates */}
      <SectionCard icon={Layers} title="Business Templates" description="Pick a template to shape generated suppliers, customers and transactions. The same accounting engine is used for all templates.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTemplate(t.key)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                template === t.key ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t.label}</span>
                {template === t.key && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Future-ready: new templates can be added to the engine without redesigning this module. Garage includes Euro Car Parts, GSF, TPS, Screwfix, Shell, BP, Snap-on, British Gas, BT Business; income Labour, MOT, Tyres, Diagnostics, Air Conditioning, Parts.
        </p>
      </SectionCard>

      {/* Section 4 — Reset */}
      <SectionCard icon={RotateCcw} title="Reset" description="Delete specific record types for the active company.">
        <div className="flex flex-wrap gap-2">
          <Btn label="Delete Transactions" icon={RotateCcw} onClick={() => handleResetTarget('transactions')} busy={busy === 'rst-transactions'} />
          <Btn label="Delete Customers" icon={RotateCcw} onClick={() => handleResetTarget('customers')} busy={busy === 'rst-customers'} />
          <Btn label="Delete Suppliers" icon={RotateCcw} onClick={() => handleResetTarget('suppliers')} busy={busy === 'rst-suppliers'} />
          <Btn label="Delete Documents" icon={RotateCcw} onClick={() => handleResetTarget('documents')} busy={busy === 'rst-documents'} />
          <Btn label="Delete Everything" icon={RotateCcw} onClick={() => handleResetTarget('everything')} busy={busy === 'rst-everything'} variant="destructive" />
        </div>
      </SectionCard>

      {/* Section 5 — Export */}
      <SectionCard icon={Download} title="Export" description="Download the active company's data.">
        <div className="flex flex-wrap gap-2">
          <Btn label="Export Demo Database" icon={Download} onClick={() => handleExport('database')} busy={busy === 'exp-database'} />
          <Btn label="Export CSV" icon={Download} onClick={() => handleExport('csv')} busy={busy === 'exp-csv'} />
          <Btn label="Export JSON" icon={Download} onClick={() => handleExport('json')} busy={busy === 'exp-json'} />
        </div>
      </SectionCard>

      {/* Section 6 — Import */}
      <SectionCard icon={Upload} title="Import" description="Import a previously exported demo database (JSON) or CSV file into the active company.">
        <div className="flex flex-wrap gap-2">
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'database')} />
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" />
            Import Demo Database (JSON)
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </Button>
        </div>
      </SectionCard>

      {/* Section 7 — Developer Settings */}
      <SectionCard icon={Settings2} title="Developer Settings" description="Local development flags stored in your browser.">
        <div className="divide-y divide-border">
          {DEV_SETTING_META.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-3 first:pt-0">
              <div>
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
              <Switch checked={settings[s.key]} onCheckedChange={() => toggleSetting(s.key)} />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}