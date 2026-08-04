import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SettingsTab from '@/components/suggestions/SettingsTab';
import RulesTab from '@/components/suggestions/RulesTab';
import LearningTab from '@/components/suggestions/LearningTab';
import AuditTab from '@/components/suggestions/AuditTab';
import { Sparkles } from 'lucide-react';

export default function SmartSuggestions() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" /> Smart Account Suggestions
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Reduce bookkeeping time with intelligent ledger account suggestions.</p>
      </div>
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
        <TabsContent value="rules" className="mt-4"><RulesTab /></TabsContent>
        <TabsContent value="learning" className="mt-4"><LearningTab /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}