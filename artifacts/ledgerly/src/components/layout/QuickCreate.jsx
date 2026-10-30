import { Link } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { Plus, FileText, Receipt, Users, Truck, Undo2, Landmark, FileUp, Building2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useWorkspaceCapabilities } from '@/features/workspaceNavigation/WorkspaceCapabilities';
const icons = { capture: FileUp, invoice: FileText, bill: Receipt, customer_credit: Undo2, supplier_credit: Undo2, payment: Landmark };

export default function QuickCreate() {
  const { activeCompany } = useCompany();
  const { actions, loading, error, refresh } = useWorkspaceCapabilities();
  return <DropdownMenu onOpenChange={open => { if (open) refresh(); }}>
    <DropdownMenuTrigger asChild><Button className="h-11 gap-1.5 px-3" aria-label="Quick create"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Create</span></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuLabel className="text-xs text-muted-foreground">{activeCompany ? `Create in ${activeCompany.name}` : 'Select a company to start'}</DropdownMenuLabel>
      {loading ? <p role="status" className="px-2 py-3 text-sm text-muted-foreground">Checking permissions…</p> : actions.map(item => { const Icon = icons[item.id]; return <DropdownMenuItem asChild key={item.id}><Link className="min-h-11 gap-2" to={item.path}><Icon className="h-4 w-4" />{item.label}</Link></DropdownMenuItem>; })}
      {!loading && activeCompany && !actions.length && <p className="px-2 py-3 text-sm text-muted-foreground">{error || 'No creation shortcuts are available for your current access and setup.'}</p>}
      {error && <DropdownMenuItem className="min-h-11 gap-2" onSelect={event => { event.preventDefault(); refresh(); }}><RefreshCw className="h-4 w-4" />Retry permissions</DropdownMenuItem>}
      <DropdownMenuSeparator /><DropdownMenuLabel className="text-xs text-muted-foreground">Browse</DropdownMenuLabel>
      {activeCompany && <><DropdownMenuItem asChild><Link className="min-h-11 gap-2" to="/customers"><Users className="h-4 w-4" />Customers</Link></DropdownMenuItem><DropdownMenuItem asChild><Link className="min-h-11 gap-2" to="/suppliers"><Truck className="h-4 w-4" />Suppliers</Link></DropdownMenuItem></>}
      <DropdownMenuItem asChild><Link className="min-h-11 gap-2" to="/companies"><Building2 className="h-4 w-4" />Companies</Link></DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
