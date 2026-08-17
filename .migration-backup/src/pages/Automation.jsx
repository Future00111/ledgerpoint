import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles, Plus, Zap } from 'lucide-react';
import AutomationStats from '@/components/automation/AutomationStats';
import AutomationCard from '@/components/automation/AutomationCard';
import WorkflowBuilder from '@/components/automation/WorkflowBuilder';
import TemplateLibrary from '@/components/automation/TemplateLibrary';
import AutomationActivity from '@/components/automation/AutomationActivity';
import AICreateDialog from '@/components/automation/AICreateDialog';

export default function Automation() {
  const { activeCompany } = useCompany();
  const [automations, setAutomations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preset, setPreset] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [tab, setTab] = useState('automations');

  useEffect(() => {
    if (activeCompany?.id) loadData();
  }, [activeCompany?.id]);

  const loadData = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const [autos, acts] = await Promise.all([
        base44.entities.Automation.filter({ company_id: activeCompany.id }),
        base44.entities.AutomationActivity.filter({ company_id: activeCompany.id }, '-run_date', 20),
      ]);
      setAutomations(autos || []);
      setActivities(acts || []);
    } catch {
      toast({ variant: 'destructive', title: 'Could not load automations' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editing) {
        await base44.entities.Automation.update(editing.id, data);
        toast({ title: 'Automation updated' });
      } else {
        await base44.entities.Automation.create({
          ...data,
          company_id: activeCompany.id,
          created_by_ai: preset?.source === 'ai',
          ai_prompt: preset?.source === 'ai' ? (preset.ai_prompt || '') : '',
        });
        toast({ title: 'Automation created' });
      }
      setBuilderOpen(false);
      setEditing(null);
      setPreset(null);
      loadData();
    } catch {
      toast({ variant: 'destructive', title: 'Could not save automation' });
    }
  };

  const handleToggle = async (auto) => {
    const status = auto.status === 'active' ? 'paused' : 'active';
    try {
      await base44.entities.Automation.update(auto.id, { status });
      loadData();
    } catch {
      toast({ variant: 'destructive', title: 'Could not update automation' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Automation.delete(id);
      toast({ title: 'Automation deleted' });
      loadData();
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete automation' });
    }
  };

  const handleUseTemplate = (template) => {
    setEditing(null);
    setPreset({
      name: template.name,
      description: template.description,
      category: template.category,
      requires_approval: true,
      source: 'template',
      workflow: template.workflow.map((b, i) => ({ ...b, id: `block_${Date.now()}_${i}` })),
    });
    setBuilderOpen(true);
  };

  const handleAIGenerate = (generated) => {
    setAiOpen(false);
    setEditing(null);
    setPreset({
      ...generated,
      source: 'ai',
      workflow: (generated.workflow || []).map((b, i) => ({ ...b, id: `block_${Date.now()}_${i}` })),
    });
    setBuilderOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automation</h1>
          <p className="text-sm text-muted-foreground mt-1">Automate repetitive accounting tasks without coding.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="w-4 h-4" /> Ask AI
          </Button>
          <Button onClick={() => { setEditing(null); setPreset(null); setBuilderOpen(true); }}>
            <Plus className="w-4 h-4" /> Create Automation
          </Button>
        </div>
      </div>

      {/* Stats */}
      <AutomationStats automations={automations} activities={activities} loading={loading} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="automations">My Automations</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="automations" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : automations.length === 0 ? (
            <EmptyState
              onCreate={() => { setEditing(null); setPreset(null); setBuilderOpen(true); }}
              onBrowseTemplates={() => setTab('templates')}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {automations.map((auto) => (
                <AutomationCard
                  key={auto.id}
                  automation={auto}
                  onToggle={() => handleToggle(auto)}
                  onEdit={() => { setEditing(auto); setPreset(null); setBuilderOpen(true); }}
                  onDelete={() => handleDelete(auto.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplateLibrary onUseTemplate={handleUseTemplate} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <AutomationActivity activities={activities} loading={loading} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <WorkflowBuilder
        open={builderOpen}
        onOpenChange={(v) => { setBuilderOpen(v); if (!v) { setEditing(null); setPreset(null); } }}
        automation={editing}
        preset={preset}
        onSave={handleSave}
      />
      <AICreateDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        onGenerate={handleAIGenerate}
      />
    </div>
  );
}

function EmptyState({ onCreate, onBrowseTemplates }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Zap className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-semibold text-lg">No automations yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Automate repetitive tasks and save hours every month. Start from scratch or use a template.
      </p>
      <div className="flex gap-2 mt-4">
        <Button onClick={onCreate}><Plus className="w-4 h-4" /> Create Automation</Button>
        <Button variant="outline" onClick={onBrowseTemplates}>Browse Templates</Button>
      </div>
    </div>
  );
}