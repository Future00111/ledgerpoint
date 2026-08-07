import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const initials = (name) =>
  (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Reusable Profile widget — a premium, well-organised record profile (avatar,
// name, role, then a two-column field grid). Replaces basic contact sections.
export default function ProfileCard({ title, subtitle, fields = [], children }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 text-primary font-semibold text-base">
            {initials(title)}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold truncate">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
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
        {children}
      </CardContent>
    </Card>
  );
}