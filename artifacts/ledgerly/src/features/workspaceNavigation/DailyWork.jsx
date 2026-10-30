import { Link } from 'react-router-dom';
import { ArrowRight, FileUp, ClipboardList } from 'lucide-react';
import { useWorkspaceCapabilities } from './WorkspaceCapabilities';

export default function DailyWork() {
  const { permissions } = useWorkspaceCapabilities();
  return <DailyWorkLinks canPrepare={permissions.drafts} />;
}
export function DailyWorkLinks({ canPrepare = false }) {
  return <section className="grid gap-3 sm:grid-cols-2" aria-label="Everyday work">
    {[
      { path: '/documents', title: canPrepare ? 'Upload invoices & credits' : 'Supplier source files', description: 'Keep each source file with the bill or credit you prepare.', icon: FileUp },
      { path: '/awaiting-credits', title: 'Track credits you are waiting for', description: 'Review returned items, outstanding claims and received credits.', icon: ClipboardList },
    ].map(({ path, title, description, icon: Icon }) => <Link key={path} to={path} className="workspace-card flex min-h-24 items-center gap-4 p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span></span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>)}
  </section>;
}
