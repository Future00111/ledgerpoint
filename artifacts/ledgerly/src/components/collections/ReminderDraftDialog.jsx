import React, { useEffect, useState } from 'react';
import { Mail, Copy, CheckCircle2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { aiApi } from '@/components/ai-accountant/api';

const TONES = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'firm', label: 'Firm' },
  { value: 'final', label: 'Final reminder' },
];

export default function ReminderDraftDialog({
  open,
  onOpenChange,
  companyId,
  invoice,
  initialTone = 'professional',
  onRecorded,
}) {
  const { toast } = useToast();
  const [tone, setTone] = useState(initialTone);
  const [draft, setDraft] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [approvalOpened, setApprovalOpened] = useState(false);
  const [approvalId, setApprovalId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTone(initialTone);
    setDraft(null);
    setSubject('');
    setBody('');
    setApprovalOpened(false);
    setApprovalId(null);
  }, [open, invoice?.id, initialTone]);

  const generate = async () => {
    if (!companyId || !invoice?.id) return;
    setGenerating(true);
    try {
      const response = await aiApi.draftCollectionReminder(companyId, invoice.id, tone);
      setDraft(response.draft);
      setSubject(response.draft.subject);
      setBody(response.draft.body);
      toast({
        title: 'Reminder draft ready',
        description: response.draft.source === 'ai' ? 'Review and edit the AI draft before approving it.' : 'Review the data-backed reminder before approving it.',
      });
    } catch (error) {
      toast({ title: 'Could not prepare reminder', description: error.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      toast({ title: 'Reminder copied' });
    } catch {
      toast({ title: 'Could not copy reminder', variant: 'destructive' });
    }
  };

  const approveAndOpenEmail = async () => {
    if (!companyId || !invoice?.id || !draft) return;
    setApproving(true);
    try {
      const response = await aiApi.approveCollectionReminder(companyId, invoice.id, tone, subject, body);
      if (!response.handoff.email) {
        toast({
          title: 'Customer email is missing',
          description: 'The draft has been approved and recorded, but add an email address before preparing an email.',
          variant: 'destructive',
        });
        return;
      }
      setApprovalId(response.handoff.approval_id);
      setApprovalOpened(true);
      window.location.href = response.handoff.mailto;
      toast({ title: 'Email application opened', description: 'Ledgerly has not sent the email. Mark it sent only after you send it yourself.' });
      onRecorded?.();
    } catch (error) {
      toast({ title: 'Could not approve reminder', description: error.message, variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  };

  const markSent = async () => {
    if (!companyId || !invoice?.id || !draft) return;
    setRecording(true);
    try {
      await aiApi.recordCollectionReminderSent(companyId, invoice.id, tone, subject, body, approvalId);
      toast({ title: 'Reminder marked as sent', description: 'The collection history has been updated.' });
      onRecorded?.();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Could not update reminder history', description: error.message, variant: 'destructive' });
    } finally {
      setRecording(false);
    }
  };

  const customerName = draft?.customer_name || invoice?.customer_name || 'Customer';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Draft payment reminder</DialogTitle>
          <DialogDescription>
            Prepare an editable reminder for {customerName}. Ledgerly never sends this message automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm rounded-lg border bg-muted/30 p-3">
            <div><p className="text-xs text-muted-foreground">Invoice</p><p className="font-medium">{invoice?.invoice_number || 'Invoice'}</p></div>
            <div><p className="text-xs text-muted-foreground">Outstanding</p><p className="font-medium">£{Number(invoice?.balance_due || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p></div>
          </div>
          <div className="space-y-2">
            <Label>Reminder tone</Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((option) => (
                <Button key={option.value} type="button" variant={tone === option.value ? 'default' : 'outline'} size="sm" onClick={() => { setTone(option.value); setDraft(null); setApprovalOpened(false); }}>
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          {!draft ? (
            <div className="rounded-lg border border-dashed p-5 text-center">
              <p className="text-sm font-medium">Generate a reviewable reminder from the real invoice details.</p>
              <p className="mt-1 text-xs text-muted-foreground">No message will be sent, and no invoice or payment data will change.</p>
              <Button className="mt-4" onClick={generate} disabled={generating || !invoice?.id}>
                <Sparkles className="mr-2 h-4 w-4" /> {generating ? 'Preparing draft...' : 'Generate draft'}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="reminder-subject">Subject</Label>
                <Input id="reminder-subject" value={subject} maxLength={180} onChange={(event) => setSubject(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder-body">Message</Label>
                <Textarea id="reminder-body" value={body} rows={11} maxLength={4000} onChange={(event) => setBody(event.target.value)} />
              </div>
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Approval records this message in collection history and opens your email application. It does not send email on your behalf.
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {draft && <Button type="button" variant="outline" onClick={copyDraft}><Copy className="mr-2 h-4 w-4" /> Copy</Button>}
          {draft && !approvalOpened && <Button type="button" onClick={approveAndOpenEmail} disabled={approving}><Mail className="mr-2 h-4 w-4" /> {approving ? 'Approving...' : 'Approve & open email'}</Button>}
          {draft && approvalOpened && <Button type="button" onClick={markSent} disabled={recording || !approvalId}><CheckCircle2 className="mr-2 h-4 w-4" /> {recording ? 'Recording...' : 'Mark as sent'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}