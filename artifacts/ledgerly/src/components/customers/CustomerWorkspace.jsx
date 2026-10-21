import React from 'react';
import PartyLedgerDetails from '@/components/accounting/PartyLedgerDetails';
export default function CustomerWorkspace({ customer, open, onOpenChange, onEdit }) {
  return <PartyLedgerDetails party={customer} type="customer" open={open} onOpenChange={onOpenChange} onEdit={onEdit} />;
}
