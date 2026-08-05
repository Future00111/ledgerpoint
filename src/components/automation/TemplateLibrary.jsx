import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './workflowBlocks';
import { AUTOMATION_TEMPLATES } from './automationTemplates';

export default function TemplateLibrary({ onUseTemplate }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {AUTOMATION_TEMPLATES.map((tpl) => {
        const Icon = CATEGORY_ICONS[tpl.category] || CATEGORY_ICONS.notifications;
        const previewBlocks = (tpl.workflow || []).filter((b) => b.type === 'when' || b.type === 'then').slice(0, 2);
        return (
          <Card key={tpl.name} className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm leading-tight">{tpl.name}</p>
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[tpl.category]}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex-1">{tpl.description}</p>
            <div className="flex flex-wrap gap-1">
              {previewBlocks.map((b, i) => (
                <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {b.type.toUpperCase()}: {b.text}
                </span>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => onUseTemplate(tpl)}>
              Use Template
            </Button>
          </Card>
        );
      })}
    </div>
  );
}