import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';

export default function SetupStep8Completion() {
  return (
    <div className="space-y-8 text-center py-8">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center animate-pulse">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-bold text-foreground">Setup Complete!</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your accounting system is ready to go. You can now start managing your invoices, bills, and transactions.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-left max-w-md mx-auto">
        <p className="text-sm font-medium text-blue-900">Next steps:</p>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>✓ Create your first invoice to start invoicing customers</li>
          <li>✓ Upload bills to track your expenses</li>
          <li>✓ Import bank transactions for reconciliation</li>
          <li>✓ Set up VAT returns when you're ready</li>
        </ul>
      </div>

      <div className="pt-4 space-y-3">
        <p className="text-sm text-muted-foreground">Questions? Check out our help documentation or contact support.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/invoices" className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-input bg-transparent rounded-lg font-medium hover:bg-muted transition-colors">
            View Invoices
          </Link>
        </div>
      </div>
    </div>
  );
}