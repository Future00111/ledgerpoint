import React from 'react';
import { cn } from '@/lib/utils';

// Reusable status card used across the dashboard (Today's Priority, Business
// Health, and future VAT / Open Banking / Bank Feed / Payroll / AI status
// cards). Guarantees equal width, height, padding, radius, icon size,
// alignment, typography and internal spacing for a consistent visual rhythm.
const TONE = {
  default: { iconWrap: 'bg-primary/10 text-primary', dot: 'bg-primary' },
  emerald: { iconWrap: 'bg-emerald-500/10 text-emerald-600', dot: 'bg-emerald-500' },
  amber: { iconWrap: 'bg-amber-500/10 text-amber-600', dot: 'bg-amber-500' },
  orange: { iconWrap: 'bg-orange-500/10 text-orange-600', dot: 'bg-orange-500' },
  rose: { iconWrap: 'bg-rose-500/10 text-rose-600', dot: 'bg-rose-500' },
  muted: { iconWrap: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

export default function StatusCard({
  as: As = 'button',
  icon: Icon,
  kicker,
  title,
  value,
  meta,
  tone = 'default',
  onClick,
  to,
  className,
  children,
}) {
  const t = TONE[tone] || TONE.default;
  const props = onClick ? { onClick } : {};
  return (
    <As
      {...props}
      to={to}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 h-11 text-left hover:shadow-sm transition-shadow w-full sm:w-auto',
        className
      )}
    >
      {Icon && (
        <span className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0', t.iconWrap)}>
          <Icon className="w-4 h-4" />
        </span>
      )}
      <span className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
        {kicker && (
          <span className="block text-[10px] text-muted-foreground leading-tight uppercase tracking-wide">{kicker}</span>
        )}
        <span className="block text-xs font-medium text-foreground leading-tight truncate">
          {title}
          {value != null && <span className="ml-1 font-semibold">{value}</span>}
        </span>
      </span>
      {meta != null && (
        <span className="text-[11px] text-muted-foreground flex-shrink-0">{meta}</span>
      )}
      {children}
    </As>
  );
}