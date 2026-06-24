import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Eye } from 'lucide-react';
import moment from 'moment';
import ManualJournalForm from '@/components/general_ledger/ManualJournalForm';
import JournalDetail from '@/components/general_ledger/JournalDetail';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const typeLabels = {
  sales_invoice: 'Sales Invoice',
  purchase_bill: 'Purchase Bill',
  sales_credit_note: 'Sales Credit Note',
  supplier_credit_note: 'Supplier Credit Note',
  bank_transaction: 'Bank Transaction',
  manual_journal: 'Manual Journal',
};

export default function GeneralLedger() {
  const { activeCompany } = useCompany();
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (activeCompany) loadJournals();
  }, [activeCompany]);

  const loadJournals = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.JournalEntry.filter({ company_id: activeCompany.id }, 'date');
      setJournals(list);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error loading journals', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestJournal = async () => {
    try {
      // Fetch accounts by code
      const accounts = await base44.entities.ChartOfAccount.filter({ company_id: activeCompany.id });
      const bankAccount = accounts.find(a => a.code === '1000');
      const salesAccount = accounts.find(a => a.code === '4000');
      
      if (!bankAccount || !salesAccount) {
        toast({ title: 'Error', description: 'Required accounts not found. Please ensure default accounts are created.', variant: 'destructive' });
        return;
      }

      await base44.entities.JournalEntry.bulkCreate([
        {
          company_id: activeCompany.id,
          date: new Date().toISOString().split('T')[0],
          reference: 'TEST-001',
          description: 'Test Journal Entry',
          account_id: bankAccount.id,
          account_code: '1000',
          account_name: 'Bank Account',
          debit: 100,
          credit: 0,
          source_type: 'manual_journal',
          source_record_id: null,
          is_system_generated: false,
        },
        {
          company_id: activeCompany.id,
          date: new Date().toISOString().split('T')[0],
          reference: 'TEST-001',
          description: 'Test Journal Entry',
          account_id: salesAccount.id,
          account_code: '4000',
          account_name: 'Sales',
          debit: 0,
          credit: 100,
          source_type: 'manual_journal',
          source_record_id: null,
          is_system_generated: false,
        },
      ]);
      
      toast({ title: 'Success', description: 'Test journal created: Debit 1000 Bank Account £100, Credit 4000 Sales £100' });
      loadJournals();
    } catch (e) {
      toast({ title: 'Error creating test journal', description: e.message, variant: 'destructive' });
    }
  };

  const filtered = journals.filter(j => {
    const matchSearch = j.reference?.includes(search) || j.description?.toLowerCase().includes(search.toLowerCase()) || j.account_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || j.source_type === typeFilter;
    const matchDateFrom = !dateFrom || j.date >= dateFrom;
    const matchDateTo = !dateTo || j.date <= dateTo;
    return matchSearch && matchType && matchDateFrom && matchDateTo;
  });

  const totalDebits = filtered.reduce((sum, j) => sum + (j.debit || 0), 0);
  const totalCredits = filtered.reduce((sum, j) => sum + (j.credit || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  if (!activeCompany) {
    return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">General Ledger</h1>
          <p className="text-muted-foreground text-sm mt-1">{journals.length} journal entry{journals.length !== 1 ? 'ies' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Manual Journal
          </Button>
          <Button onClick={handleTestJournal} variant="outline" className="gap-2">
            Test Journal
          </Button>
        </div>
      </div>

      {/* Balance Check */}
      <Card className={`border-0 shadow-sm ${isBalanced ? 'bg-emerald-50' : 'bg-red-50'}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${isBalanced ? 'text-emerald-900' : 'text-red-900'}`}>
              {isBalanced ? '✓ Ledger is balanced' : '✗ Ledger is not balanced'}
            </p>
            <p className={`text-xs ${isBalanced ? 'text-emerald-700' : 'text-red-700'}`}>
              Total Debits: {gbp.format(totalDebits)} | Total Credits: {gbp.format(totalCredits)} | Difference: {gbp.format(Math.abs(totalDebits - totalCredits))}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(typeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" placeholder="From" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <Input type="date" placeholder="To" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>

      {/* Journal Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <p className="text-muted-foreground">No journal entries found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Card className="border-0 shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Reference</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-left font-medium">Account</th>
                  <th className="px-4 py-3 text-right font-medium">Debit</th>
                  <th className="px-4 py-3 text-right font-medium">Credit</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(journal => (
                  <tr key={journal.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">{moment(journal.date).format('DD MMM YYYY')}</td>
                    <td className="px-4 py-3 font-mono text-xs">{journal.reference}</td>
                    <td className="px-4 py-3 text-sm truncate max-w-xs">{journal.description}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{journal.account_code}</div>
                      <div className="text-xs text-muted-foreground">{journal.account_name}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {journal.debit > 0 ? gbp.format(journal.debit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {journal.credit > 0 ? gbp.format(journal.credit) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={journal.is_system_generated ? 'outline' : 'secondary'} className="text-xs">
                        {typeLabels[journal.source_type] || journal.source_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {journal.source_record_id && (
                        <Button variant="ghost" size="icon" onClick={() => { setViewing(journal); setDetailOpen(true); }} title="View source">
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <ManualJournalForm open={formOpen} onOpenChange={setFormOpen} onSave={loadJournals} />
      <JournalDetail journal={viewing} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}