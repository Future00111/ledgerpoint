import React from 'react';
import { X } from 'lucide-react';
import { BLOCK_META, TRIGGER_OPTIONS, CONDITION_OPTIONS, ACTION_OPTIONS } from './workflowBlocks';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function WorkflowBlock({ block, onChange, onDelete }) {
  const meta = BLOCK_META[block.type];
  const update = (patch) => onChange({ ...block, ...patch });

  return (
    <div className={`border-l-4 ${meta.border} bg-muted/30 rounded-r-lg p-3 pl-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${meta.badge}`}>{meta.label}</span>
          <span className="text-xs text-muted-foreground">{meta.tagline}</span>
        </div>
        <button onClick={onDelete} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive" title="Remove block">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <BlockContent block={block} update={update} />
    </div>
  );
}

function BlockContent({ block, update }) {
  if (block.type === 'when') {
    return (
      <Select value={block.text || ''} onValueChange={(v) => update({ text: v })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a trigger" /></SelectTrigger>
        <SelectContent>
          {TRIGGER_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (block.type === 'if') {
    const condition = block.config?.condition || '';
    const value = block.config?.value || '';
    return (
      <div className="flex gap-2">
        <Select
          value={condition}
          onValueChange={(v) => update({ config: { ...block.config, condition: v }, text: `${v} ${value}`.trim() })}
        >
          <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Condition" /></SelectTrigger>
          <SelectContent>
            {CONDITION_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          className="h-8 text-sm flex-1"
          placeholder="Value"
          value={value}
          onChange={(e) => update({ config: { ...block.config, value: e.target.value }, text: `${condition} ${e.target.value}`.trim() })}
        />
      </div>
    );
  }
  if (block.type === 'then') {
    return (
      <Select value={block.text || ''} onValueChange={(v) => update({ text: v })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose an action" /></SelectTrigger>
        <SelectContent>
          {ACTION_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (block.type === 'wait') {
    const days = block.config?.days || '';
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="h-8 text-sm w-24"
          placeholder="0"
          value={days}
          onChange={(e) => update({ config: { days: e.target.value }, text: `${e.target.value} days` })}
        />
        <span className="text-sm text-muted-foreground">days</span>
      </div>
    );
  }
  if (block.type === 'else') {
    return <p className="text-xs text-muted-foreground italic">Alternative actions below</p>;
  }
  if (block.type === 'end') {
    return <p className="text-xs text-muted-foreground italic">Stop workflow</p>;
  }
  return null;
}