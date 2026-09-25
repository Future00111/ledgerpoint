import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const EXAMPLES = [
  'Remind customers 7 days after invoices become overdue.',
  'Automatically categorise utility bills.',
  'Notify me if cash falls below £10,000.',
  'Send a monthly management report on the 1st.',
];

export default function AICreateDialog({ open, onOpenChange, onGenerate }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    const userPrompt = prompt.trim();
    setLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an automation assistant for Ledgerly, a UK accounting app. Convert the user's request into an automation workflow.\n\nReturn a JSON object with:\n- name: short automation name\n- description: one sentence description\n- category: one of sales, purchases, banking, vat, documents, reports, ai, notifications\n- requires_approval: true if this could modify accounting data, false if it only notifies or reports\n- workflow: array of blocks, each with type (when, if, then, wait, else, end) and text (human-readable)\n\nUser request: "${userPrompt}"`,
        response_json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            requires_approval: { type: 'boolean' },
            workflow: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  text: { type: 'string' },
                },
              },
            },
          },
        },
      });
      onGenerate({ ...res, ai_prompt: userPrompt });
      setPrompt('');
    } catch {
      onGenerate({
        name: userPrompt.slice(0, 50),
        description: userPrompt,
        category: 'ai',
        requires_approval: true,
        ai_prompt: userPrompt,
        workflow: [
          { type: 'when', text: 'triggered by event' },
          { type: 'then', text: userPrompt },
          { type: 'end' },
        ],
      });
      setPrompt('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Create with AI
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Describe what you want to automate in plain English. We'll draft a workflow for you to review.</p>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Remind customers 7 days after invoices become overdue."
            rows={3}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="text-xs bg-muted hover:bg-muted/70 px-2.5 py-1 rounded-full text-muted-foreground transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={!prompt.trim() || loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Draft</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}