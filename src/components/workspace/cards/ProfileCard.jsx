import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const initials = (name) =>
  (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Reusable Profile widget — avatar, name, role, a two-column field grid, and
// optional quick actions (e.g. Email / Call / Edit) rendered as a button row.
export default function ProfileCard({ title, subtitle, fields = [], actions = [], children }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 text-primary font-semibold text-base flex-shrink-0">
            {initials(title)}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold truncate">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-2.5">
          {fields.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5">
              {f.icon && <f.icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm font-medium break-words">{f.value || '—'}</p>
              </div>
            </div>
          ))}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
            {actions.map((a, i) => (
              <Button key={i} variant="outline" size="sm" onClick={a.onClick} className="gap-1.5 h-7 text-xs">
                {a.icon && <a.icon className="w-3.5 h-3.5" />} {a.label}
              </Button>
            ))}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}