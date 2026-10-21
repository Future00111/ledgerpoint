import React from 'react';
import PartyLedgerDetails from '@/components/accounting/PartyLedgerDetails';
export default function SupplierDetails({ supplier, open, onOpenChange }) {
  return <PartyLedgerDetails party={supplier} type="supplier" open={open} onOpenChange={onOpenChange} />;
}
