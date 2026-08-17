import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import WorkflowBlock from './WorkflowBlock';
import { BLOCK_TYPES, BLOCK_META, CATEGORY_OPTIONS } from './workflowBlocks';

let blockId = 0;
const newBlock = (type) => ({
  id: `block_${++blockId}_${Date.now()}`,
  type,
  text: '',
  config: {},
});

export default function WorkflowBuilder({ open, onOpenChange, automation, preset, onSave }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('sales');
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (preset) {
      setName(preset.name || '');
      setCategory(preset.category || 'sales');
      setDescription(preset.description || '');
      setBlocks((preset.workflow || []).map((b) => ({ ...b, id: b.id || `block_${++blockId}` })));
      setRequiresApproval(preset.requires_approval ?? true);
      setTestMode(false);
    } else if (automation) {
      setName(automation.name || '');
      setCategory(automation.category || 'sales');
      setDescription(automation.description || '');
      setBlocks((automation.workflow || []).map((b) => ({ ...b, id: b.id || `block_${++blockId}` })));
      setRequiresApproval(automation.requires_approval ?? true);
      setTestMode(automation.test_mode ?? false);
    } else {
      setName('');
      setCategory('sales');
      setDescription('');
      setBlocks([newBlock('when'), newBlock('then'), newBlock('end')]);
      setRequiresApproval(true);
      setTestMode(false);
    }
  }, [open, preset, automation]);

  const updateBlock = (id, patch) => setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const deleteBlock = (id) => setBlocks((prev) => prev.filter((b) => b.id !== id));
  const addBlock = (type, afterId) => {
    const block = newBlock(type);
    if (afterId) {
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === afterId);
        const copy = [...prev];
        copy.splice(idx + 1, 0, block);
        return copy;
      });
    } else {
      setBlocks((prev) => [...prev, block]);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      category,
      description: description.trim(),
      workflow: blocks.map(({ id, ...rest }) => rest),
      requires_approval: requiresApproval,
      test_mode: testMode,
      status: automation?.status || 'draft',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{automation ? 'Edit Automation' : 'Build Automation'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Overdue Invoice Reminders" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this automation do?" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Workflow</Label>
            <div className="space-y-2">
              {blocks.map((block) => (
                <React.Fragment key={block.id}>
                  <WorkflowBlock block={block} onChange={(p) => updateBlock(block.id, p)} onDelete={() => deleteBlock(block.id)} />
                  <div className="flex justify-center -my-0.5">
                    <AddBlockButton onAdd={(type) => addBlock(type, block.id)} />
                  </div>
                </React.Fragment>
              ))}
              {blocks.length === 0 && (
                <div className="text-center py-4">
                  <AddBlockButton onAdd={(type) => addBlock(type)} />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-border">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium">Require approval</p>
                <p className="text-xs text-muted-foreground">Pause for review before modifying accounting data</p>
              </div>
              <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium">Test mode</p>
                <p className="text-xs text-muted-foreground">Log actions without executing them</p>
              </div>
              <Switch checked={testMode} onCheckedChange={setTestMode} />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {automation ? 'Save Changes' : 'Create Automation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddBlockButton({ onAdd }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1 rounded-full bg-white border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Add block">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {BLOCK_TYPES.map((type) => (
          <DropdownMenuItem key={type} onClick={() => onAdd(type)}>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded mr-2 ${BLOCK_META[type].badge}`}>{BLOCK_META[type].label}</span>
            <span className="text-xs text-muted-foreground">{BLOCK_META[type].tagline}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}