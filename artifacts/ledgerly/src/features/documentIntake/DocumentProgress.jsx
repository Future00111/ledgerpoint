import { documentProgress } from './presentation.mjs';

export default function DocumentProgress({ captureMode = false, reviewed = false, saved = false }) {
  const steps = documentProgress(captureMode, reviewed, saved);
  return <ol className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl bg-muted/40 px-4 py-3 text-sm" aria-label="Document progress">{steps.map((step, index) => <li key={step.label} aria-current={step.current ? 'step' : undefined} className={`flex items-center gap-2 ${step.current ? 'font-medium text-foreground' : 'text-muted-foreground'}`}><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${step.current ? 'bg-primary/10 text-primary' : 'bg-background'}`}>{index + 1}</span>{step.label}</li>)}</ol>;
}
