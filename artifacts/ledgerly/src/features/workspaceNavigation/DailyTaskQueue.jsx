import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function DailyTaskQueue({ tasks }) {
  return <section className="workspace-panel" aria-label="Tasks to review">
    <div className="workspace-panel-header"><div><h2 className="workspace-section-title">Ready for your attention</h2><p className="mt-1 text-xs text-muted-foreground">Pick a task and carry on from where you left off.</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium">{tasks.reduce((total, task) => total + task.count, 0)} items</span></div>
    <div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">{tasks.map(({ label, count, detail, to, icon: Icon, urgent }) => <Link key={to} to={to} className="group flex min-h-28 items-center gap-4 p-5 transition-colors hover:bg-muted/30 sm:px-6">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${urgent && count ? 'bg-amber-50 text-amber-800' : 'bg-muted text-primary'}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></span>
      <span className={`text-2xl font-semibold tabular-nums ${urgent && count ? 'text-amber-800' : ''}`}>{count}</span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>)}</div>
  </section>;
}

