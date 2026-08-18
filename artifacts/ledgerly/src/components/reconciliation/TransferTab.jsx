import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft } from 'lucide-react';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}{required && <span className="text-rose-500 ml-1">*</span>}</Label>
      {children}
    </div>
  );
}

export default function TransferTab({ transaction, bankAccounts, onTransfer }) {
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState(String(txnAmount(transaction)));
  const [description, setDescription] = useState('');
  const fromAccount = bankAccounts.find((a) => a.id === transaction.bank_account_id);

  const submit = () => {
    if (!toAccountId || !amount) return;
    onTransfer({ to_account_id: toAccountId, amount: Number(amount), description });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
        <div className="flex-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">From</p>
          <p className="text-sm font-bold text-slate-900">{fromAccount?.account_name || '—'}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm text-slate-400">
          <ArrowRightLeft className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">To<span className="text-rose-500 ml-1">*</span></p>
          <Select value={toAccountId} onValueChange={setToAccountId}>
            <SelectTrigger className="h-8 border-none bg-transparent shadow-none px-0 focus:ring-0 font-bold text-sm hover:text-[#007bff] transition-colors">
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent>
              {bankAccounts.filter((a) => a.id !== transaction.bank_account_id).map((a) => (
                <SelectItem key={a.id} value={a.id} className="font-medium">{a.account_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Amount" required>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">£</span>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" className="h-10 pl-8 bg-white border-slate-200 shadow-sm font-bold tabular-nums focus-visible:ring-[#007bff]" />
          </div>
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Transfer details..." className="h-10 bg-white border-slate-200 shadow-sm focus-visible:ring-[#007bff]" />
        </Field>
      </div>

      <div className="pt-2">
        <Button 
          onClick={submit} 
          disabled={!toAccountId || !amount} 
          className="w-full h-11 bg-[#007bff] hover:bg-[#0062cc] text-white font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all"
        >
          Record Transfer
        </Button>
      </div>
    </div>
  );
}
