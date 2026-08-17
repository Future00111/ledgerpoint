import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUp, Zap } from 'lucide-react';

export default function SetupStep5ImportTransactions({ companyId, bankAccountId }) {
  const [importMode, setImportMode] = useState(null);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Import your bank transactions to get started. You can skip this and add them later.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-6 border-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setImportMode('csv')}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Import from CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Upload a CSV file from your bank</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2 opacity-50 cursor-not-allowed">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Open Banking</p>
              <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
            </div>
          </div>
        </Card>
      </div>

      {importMode === 'csv' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
          <p className="text-sm font-medium text-blue-900">CSV Import Ready</p>
          <p className="text-xs text-blue-800">
            Once you continue, you'll be able to select a CSV file and map the columns to match your bank's format.
          </p>
          <Button variant="outline" size="sm" onClick={() => setImportMode(null)}>Change</Button>
        </div>
      )}

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-900">
          Don't have a CSV file? You can add transactions manually later from the Bank Transactions page.
        </p>
      </div>
    </div>
  );
}