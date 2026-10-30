import { Link } from 'react-router-dom';
import { ArrowRight, FileUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceCapabilities } from './WorkspaceCapabilities';

export default function DailyWork({ compact = false }) {
  const { permissions } = useWorkspaceCapabilities();
  return <DailyWorkLinks canPrepare={permissions.drafts} compact={compact} />;
}
export function DailyWorkLinks({ canPrepare = false, compact = false }) {
  if (compact) return <section className="grid gap-3 sm:grid-cols-2" aria-label="Everyday work">
    <Link to="/documents" className="workspace-card flex min-h-20 items-center gap-3 p-4 text-sm font-medium hover:border-primary/30"><FileUp className="h-5 w-5 text-primary" aria-hidden="true" /><span className="flex-1">{canPrepare ? 'Upload invoices & credits' : 'Supplier source files'}</span><ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
    <Link to="/awaiting-credits" className="workspace-card flex min-h-20 items-center gap-3 p-4 text-sm font-medium hover:border-primary/30"><RotateCcw className="h-5 w-5 text-primary" aria-hidden="true" /><span className="flex-1">Track credits you are waiting for</span><ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
  </section>;
  return <section className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]" aria-label="Everyday work">
    <div className="workspace-hero flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
      <div className="max-w-xl">
        <p className="workspace-kicker text-primary">Start with your paperwork</p>
        <h2 className="mt-3 max-w-md text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">A simpler place for every bill and credit.</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Add your supplier files, check the details and prepare a draft. The original stays with its document.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3"><Button asChild className="min-h-11 rounded-xl px-5"><Link to="/documents"><FileUp aria-hidden="true" />{canPrepare ? 'Upload invoices & credits' : 'Supplier source files'}<ArrowRight aria-hidden="true" /></Link></Button><span className="text-xs text-muted-foreground">PDF · JPG · PNG</span></div>
      </div>
      <div className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-primary/15 bg-white/60 text-primary sm:flex" aria-hidden="true"><FileUp className="h-10 w-10" strokeWidth="1.4" /></div>
    </div>
    <Link to="/awaiting-credits" className="workspace-panel group flex flex-col justify-between gap-5 p-5 transition-colors hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-6">
      <span className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><RotateCcw className="h-5 w-5" aria-hidden="true" /></span><ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
      <span><span className="block text-lg font-semibold tracking-tight">Get back what you’re owed.</span><span className="mt-2 block text-sm leading-6 text-muted-foreground">Keep returned items and incoming supplier credits together.</span></span>
      <span className="text-sm font-semibold text-primary">Track credits you are waiting for</span>
    </Link>
  </section>;
}
