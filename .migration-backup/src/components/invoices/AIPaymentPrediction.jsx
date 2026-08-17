import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE = { emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600' };

const Field = ({ label, value, tone }) => (
  <div className="rounded-md border border-border bg-card px-2.5 py-2 min-w-0">
    <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">{label}</p>
    <p className={cn('text-sm font-semibold mt-0.5 truncate', tone ? TONE[tone] : '')}>{value}</p>
  </div>
);

// AI Payment Prediction — likelihood, risk score, predicted payment date and
// confidence, with the risk factors driving the prediction.
export default function AIPaymentPrediction({ likelihood, likelihoodTone, riskScore, riskLabel, riskTone, predictedDate, confidence, riskFactors = [] }) {
  const conf = Math.max(0, Math.min(100, Math.round(confidence)));
  return (
    <Card className="border border-primary/20 bg-primary/5 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">AI Payment Prediction</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <Field label="Likelihood of Payment" value={likelihood} tone={likelihoodTone} />
          <Field label="Risk Score" value={`${riskScore} · ${riskLabel}`} tone={riskTone} />
          <Field label="Predicted Payment Date" value={predictedDate} />
          <div className="rounded-md border border-border bg-card px-2.5 py-2 min-w-0">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Confidence</p>
            <p className="text-sm font-semibold mt-0.5">{conf}%</p>
            <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${conf}%` }} />
            </div>
          </div>
        </div>

        {riskFactors.length > 0 && (
          <div className="pt-3 border-t border-border">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1.5 inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Risk Factors
            </p>
            <ul className="space-y-1">
              {riskFactors.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                  <span className="text-rose-500 mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}