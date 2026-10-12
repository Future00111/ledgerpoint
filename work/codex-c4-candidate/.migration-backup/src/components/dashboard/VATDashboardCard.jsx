import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Calendar, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import moment from 'moment';
import { calculateVATReturn } from '@/lib/vatCalculation';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

function getCurrentQuarter() {
  const now = moment();
  const month = now.month();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  const start = moment().month(quarterStartMonth).startOf('month');
  const end = moment().month(quarterStartMonth + 2).endOf('month');
  return { start, end };
}

function getFilingDeadline(quarterEnd) {
  return moment(quarterEnd).add(1, 'month').add(7, 'days');
}

export default function VATDashboardCard() {
  const { activeCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeCompany) loadData();
  }, [activeCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      const quarter = getCurrentQuarter();
      const [calc, bankTxns] = await Promise.all([
        calculateVATReturn(activeCompany.id, quarter.start.format('YYYY-MM-DD'), quarter.end.format('YYYY-MM-DD')),
        base44.entities.BankTransaction.filter({ company_id: activeCompany.id }),
      ]);
      const reviewCount = bankTxns.filter(t => t.status === 'review').length;
      const deadline = getFilingDeadline(quarter.end);
      const daysUntil = Math.max(0, Math.round(moment(deadline).diff(moment(), 'days')));
      setData({
        vatDue: calc.box5_net_vat,
        quarterStart: quarter.start,
        quarterEnd: quarter.end,
        deadline,
        daysUntil,
        reviewCount,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="h-28 flex items-center justify-center">
            <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const quarterLabel = `${data.quarterStart.format('DD MMM')} – ${data.quarterEnd.format('DD MMM YYYY')}`;
  const deadlineLabel = data.deadline.format('DD MMM YYYY');
  const isOverdue = data.daysUntil === 0;
  const isUrgent = data.daysUntil > 0 && data.daysUntil <= 14;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            VAT Dashboard
          </CardTitle>
          <Link to="/vat" className="text-xs text-primary hover:underline font-medium">View returns</Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Estimated VAT Due</p>
            <p className={`text-2xl font-bold ${data.vatDue >= 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
              {formatCurrency(Math.abs(data.vatDue))}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{data.vatDue >= 0 ? 'to pay HMRC' : 'to reclaim'}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Current Quarter</span>
            </div>
            <p className="text-sm font-medium">{quarterLabel}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">Filing Deadline</span>
            </div>
            <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : ''}`}>
              {isOverdue ? 'Overdue' : `${data.daysUntil} days`}
            </p>
            <p className="text-xs text-muted-foreground">{deadlineLabel}</p>
          </div>
          <div>
            <Link to="/transactions" className="block hover:bg-muted/50 -mx-1 px-1 py-0.5 rounded transition-colors">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className={`w-3.5 h-3.5 ${data.reviewCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">Awaiting Review</span>
              </div>
              <p className="text-sm font-medium flex items-center gap-1">
                {data.reviewCount} {data.reviewCount === 1 ? 'txn' : 'txns'}
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              </p>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}