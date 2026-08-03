import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, ChevronRight, AlertTriangle } from 'lucide-react';
import moment from 'moment';

export default function InsightsSummary({ companyId }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const data = await base44.entities.Insight.filter({ company_id: companyId, generated_date: today }, '-generated_date');
        setInsights(data.filter(i => !i.is_dismissed));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  const critical = insights.filter(i => i.severity === 'critical' || i.severity === 'warning');
  const top = critical[0] || insights[0];

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">AI Insights</p>
              <p className="text-xs text-muted-foreground">{moment().format('DD MMM YYYY')}</p>
            </div>
          </div>
          <Link to="/insights" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="h-12 flex items-center">
            <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : top ? (
          <Link to="/insights" className="block">
            <div className="flex items-start gap-2">
              {(top.severity === 'critical' || top.severity === 'warning') && (
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium leading-snug">{top.title}</p>
                {insights.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">+ {insights.length - 1} more insight{insights.length - 1 !== 1 ? 's' : ''} today</p>
                )}
              </div>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">No insights yet. <Link to="/insights" className="text-primary hover:underline">Generate your daily summary →</Link></p>
        )}
      </CardContent>
    </Card>
  );
}