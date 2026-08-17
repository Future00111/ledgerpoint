import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Plus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

export default function EmailAccountManager({ companyId }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState('gmail');
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (companyId) loadAccounts(); }, [companyId]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.EmailAccount.filter({ company_id: companyId });
      setAccounts(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!email) { toast({ title: 'Email address is required', variant: 'destructive' }); return; }
    setAdding(true);
    try {
      await base44.entities.EmailAccount.create({
        company_id: companyId,
        email_address: email,
        provider,
        status: 'connected',
      });
      setEmail('');
      toast({ title: 'Email account added' });
      await loadAccounts();
    } catch (e) { toast({ title: 'Error adding account', variant: 'destructive' }); }
    finally { setAdding(false); }
  };

  const handleRemove = async (id) => {
    if (!confirm('Remove this email account?')) return;
    try {
      await base44.entities.EmailAccount.delete(id);
      toast({ title: 'Account removed' });
      await loadAccounts();
    } catch (e) { toast({ title: 'Error removing account', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Add an email account</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} className="flex-1" />
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail">Gmail</SelectItem>
                <SelectItem value="outlook">Outlook</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={adding} className="gap-2">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : accounts.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-12">
            <Mail className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No email accounts connected yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add an email address above to simulate a connected account</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {accounts.map(acc => (
            <Card key={acc.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{acc.email_address}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs capitalize">{acc.provider}</Badge>
                      <Badge className="text-xs bg-emerald-100 text-emerald-700">{acc.status}</Badge>
                      {acc.last_scan_date && <span className="text-xs text-muted-foreground">Last scan: {moment(acc.last_scan_date).format('DD MMM YYYY')}</span>}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(acc.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}