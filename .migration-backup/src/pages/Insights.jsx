import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Sparkles, RefreshCw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import InsightCard from '@/components/insights/InsightCard';
import InsightDrillDown from '@/components/insights/InsightDrillDown';
import moment from 'moment';

export default function Insights() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (activeCompany) loadInsights();
  }, [activeCompany]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Insight.filter({ company_id: activeCompany.id }, '-generated_date');
      setInsights(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateNow = async () => {
    setGenerating(true);
    try {
      await base44.functions.invoke('generateInsights', { company_id: activeCompany.id });
      await loadInsights();
      toast({ title: 'Insights generated', description: 'Your daily business summary is ready.' });
    } catch (e) {
      toast({ title: 'Failed to generate insights', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const dismiss = async (insight) => {
    try {
      await base44.entities.Insight.update(insight.id, { is_dismissed: true });
      setInsights(prev => prev.filter(i => i.id !== insight.id));
    } catch (e) {
      toast({ title: 'Failed to dismiss', description: e.message, variant: 'destructive' });
    }
  };

  if (!activeCompany) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Building2 className="w-16 h-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Select a company</h2>
        <p className="text-muted-foreground">AI Insights are generated per company.</p>
      </div>
    );
  }

  const visible = insights.filter(i => !i.is_dismissed);
  const groups = {};
  visible.forEach(i => {
    const d = i.generated_date;
    if (!groups[d]) groups[d] = [];
    groups[d].push(i);
  });
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            AI Insights
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Daily business summary for {activeCompany.name}</p>
        </div>
        <Button onClick={generateNow} disabled={generating || loading} variant="outline">
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating…' : 'Generate now'}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl">
          <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No insights yet. Click “Generate now” to build your business summary.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {moment(date).format('dddd, DD MMMM YYYY')}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groups[date].map(insight => (
                  <InsightCard key={insight.id} insight={insight} onOpen={setSelected} onDismiss={dismiss} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <InsightDrillDown insight={selected} companyId={activeCompany.id} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}