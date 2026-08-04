import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import {
  LayoutDashboard,
  Building2,
  Users,
  Truck,
  FileText,
  Receipt,
  Undo2,
  RotateCcw,
  Landmark,
  Calculator,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Settings,
  FolderOpen,
  Briefcase,
  Mail,
  Filter,
  BarChart3,
  BookOpen,
  Grid3x3,
  Lightbulb
} from 'lucide-react';
import AICopilot from '@/components/copilot/AICopilot';
import { Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Companies', path: '/companies', icon: Building2 },
  { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Suppliers', path: '/suppliers', icon: Truck },
  { label: 'Sales Invoices', path: '/invoices', icon: FileText },
  { label: 'Purchase Bills', path: '/bills', icon: Receipt },
  { label: 'Sales Credit Notes', path: '/sales-credit-notes', icon: Undo2 },
  { label: 'Supplier Credit Notes', path: '/supplier-credit-notes', icon: RotateCcw },
  { label: 'Bank Accounts', path: '/bank-accounts', icon: Landmark },
  { label: 'Bank Transactions', path: '/transactions', icon: Landmark },
  { label: 'VAT Returns', path: '/vat', icon: Calculator },
  { label: 'Documents', path: '/documents', icon: FolderOpen },
  { label: 'Chart of Accounts', path: '/chart-of-accounts', icon: BookOpen },
  { label: 'General Ledger', path: '/general-ledger', icon: Grid3x3 },
  { label: 'Email Capture', path: '/email-capture', icon: Mail },
  { label: 'Email Rules', path: '/email-rules', icon: Filter },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
  { label: 'AI Insights', path: '/insights', icon: Sparkles },
  { label: 'Smart Suggestions', path: '/smart-suggestions', icon: Lightbulb },
  { label: 'Accountant Portal', path: '/accountant', icon: Briefcase },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { companies, activeCompany, switchCompany } = useCompany();

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-border
        transform transition-transform duration-200 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-border">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Landmark className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="font-semibold text-lg tracking-tight">LedgerUK</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-muted rounded-md">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Company selector */}
          {companies.length > 0 && (
            <div className="px-3 py-3 border-b border-border">
              <DropdownMenu>
                <DropdownMenuTrigger className="w-full flex items-center justify-between px-3 py-2 text-sm bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                  <span className="truncate font-medium">{activeCompany?.name || 'Select company'}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {companies.map(c => (
                    <DropdownMenuItem key={c.id} onClick={() => switchCompany(c)}>
                      <Building2 className="w-4 h-4 mr-2" />
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/companies">
                      <Settings className="w-4 h-4 mr-2" />
                      Manage companies
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {navItems.map(item => {
              const isActive = location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                  `}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="px-3 py-3 border-t border-border">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
            >
              <LogOut className="w-[18px] h-[18px]" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center h-16 px-4 lg:px-6 border-b border-border bg-white flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 hover:bg-muted rounded-md mr-2">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <AICopilot />
    </div>
  );
}