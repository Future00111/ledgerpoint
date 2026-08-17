import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';

export default function HealthScore({ companyId }) {
  const [score, setScore] = useState(0);
  const [metrics, setMetrics] = useState({
    bankAccountsConnected: { value: 0, max: 20, label: 'Bank Accounts Connected' },
    transactionsReview: { value: 0, max: 20, label: 'Transactions Up to Date' },
    documentsReview: { value: 0, max: 20, label: 'Documents Reviewed' },
    unmatchedTransactions: { value: 0, max: 20, label: 'No Unmatched Transactions' },
    vatStatus: { value: 0, max: 20, label: 'VAT Returns Current' },
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (companyId) {
      calculateHealthScore();
    }
  }, [companyId]);

  const calculateHealthScore = async () => {
    try {
      // Fetch bank accounts
      const bankAccounts = await base44.entities.BankAccount.filter({ company_id: companyId });
      const bankScore = bankAccounts.length > 0 ? 20 : 0;

      // Fetch transactions awaiting review
      const transactions = await base44.entities.BankTransaction.filter({
        company_id: companyId,
        status: 'review',
      });
      const transactionScore = transactions.length === 0 ? 20 : Math.max(0, 20 - Math.min(10, transactions.length));

      // Fetch documents awaiting review
      const documents = await base44.entities.Document.filter({
        company_id: companyId,
        status: { $in: ['pending_extraction', 'pending_review'] },
      });
      const documentScore = documents.length === 0 ? 20 : Math.max(0, 20 - Math.min(10, documents.length));

      // Fetch unmatched transactions
      const unmatchedTransactions = await base44.entities.BankTransaction.filter({
        company_id: companyId,
        status: 'review',
      });
      const unmatchedScore = unmatchedTransactions.length === 0 ? 20 : Math.max(0, 20 - Math.min(10, unmatchedTransactions.length));

      // Fetch VAT returns status
      const vatReturns = await base44.entities.VATReturn.filter({
        company_id: companyId,
        status: { $in: ['draft', 'ready_for_review'] },
      });
      const vatScore = vatReturns.length === 0 ? 20 : 10;

      const newMetrics = {
        bankAccountsConnected: {
          ...metrics.bankAccountsConnected,
          value: bankScore,
          count: bankAccounts.length,
        },
        transactionsReview: {
          ...metrics.transactionsReview,
          value: transactionScore,
          count: transactions.length,
        },
        documentsReview: {
          ...metrics.documentsReview,
          value: documentScore,
          count: documents.length,
        },
        unmatchedTransactions: {
          ...metrics.unmatchedTransactions,
          value: unmatchedScore,
          count: unmatchedTransactions.length,
        },
        vatStatus: {
          ...metrics.vatStatus,
          value: vatScore,
          count: vatReturns.length,
        },
      };

      setMetrics(newMetrics);

      const totalScore = Object.values(newMetrics).reduce((sum, m) => sum + m.value, 0);
      setScore(totalScore);

      // Generate message
      if (totalScore >= 90) {
        setMessage('Your bookkeeping is up to date.');
      } else if (totalScore >= 70) {
        setMessage('You\'re doing well, just a few items to review.');
      } else if (totalScore >= 50) {
        setMessage('Some attention needed to keep records current.');
      } else {
        setMessage('Please review your outstanding items.');
      }
    } catch (e) {
      console.error('Error calculating health score:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bookkeeping Health</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (value, max) => {
    const percentage = (value / max) * 100;
    if (percentage === 100) return 'text-emerald-600';
    if (percentage >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Bookkeeping Health</CardTitle>
            <CardDescription>How current is your accounting?</CardDescription>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}/100</p>
            <p className="text-xs text-muted-foreground mt-1">{message}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Progress value={score} max={100} className="h-3" />

        <div className="space-y-4">
          {Object.entries(metrics).map(([key, metric]) => {
            const percentage = (metric.value / metric.max) * 100;
            const isHealthy = metric.value === metric.max;

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isHealthy ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : metric.value >= metric.max / 2 ? (
                      <Clock className="w-4 h-4 text-amber-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span className="text-sm font-medium text-foreground">{metric.label}</span>
                  </div>
                  <span className={`text-xs font-semibold ${getStatusColor(metric.value, metric.max)}`}>
                    {metric.value}/{metric.max}
                  </span>
                </div>
                <Progress value={percentage} max={100} className="h-1.5" />
                {metric.count !== undefined && metric.count > 0 && (
                  <p className="text-xs text-muted-foreground pl-6">
                    {metric.count} item{metric.count > 1 ? 's' : ''} pending
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <Zap className="w-3 h-3 inline mr-1" />
            Scores are updated in real-time based on your outstanding items.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}