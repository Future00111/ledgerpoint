import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../WidgetPrimitives';
import {
  Zap, FileText, Receipt, Users, Truck, FolderOpen, ArrowLeftRight, BarChart3,
} from 'lucide-react';

const ACTIONS = [
  { label: 'New Invoice', route: '/invoices/new', icon: FileText },
  { label: 'New Bill', route: '/bills/new', icon: Receipt },
  { label: 'New Customer', route: '/customers', icon: Users },
  { label: 'New Supplier', route: '/suppliers', icon: Truck },
  { label: 'Upload Document', route: '/documents', icon: FolderOpen },
  { label: 'Import Bank Statement', route: '/transactions', icon: ArrowLeftRight },
  { label: 'Open Reports', route: '/reports', icon: BarChart3 },
];

export default function QuickActionsWidget() {
  const nav = useNavigate();
  return (
    <div className="grid grid-cols-2 gap-2">
      {ACTIONS.map((a) => (
        <button
          key={a.label}
          onClick={() => nav(a.route)}
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors text-left"
        >
          <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <a.icon className="w-3.5 h-3.5" />
          </span>
          <span className="text-[11px] font-medium leading-tight">{a.label}</span>
        </button>
      ))}
    </div>
  );
}