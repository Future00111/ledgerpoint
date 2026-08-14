import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

function Field({ label, required, children }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</Label>
      <div className="mt-1">{children}</div>
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
    <div className="space-y-3.5">
      <Field label="From account">
        <div className="h-9 px-3 flex items-center text-sm rounded-md border border-input bg-muted/40">{fromAccount?.account_name || '—'}</div>
      </Field>
      <Field label="To account" required>
        <Select value={toAccountId} onValueChange={setToAccountId}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select account" /></SelectTrigger>
          <SelectContent>
            {bankAccounts.filter((a) => a.id !== transaction.bank_account_id).map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Amount" required>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" className="h-9 text-sm" />
      </Field>
      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
      </Field>
      <div className="pt-1">
        <Button size="sm" onClick={submit} disabled={!toAccountId || !amount} className="h-8 w-full">Transfer</Button>
      </div>
    </div>
  );
}