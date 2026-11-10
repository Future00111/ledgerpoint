import React, { useState, useEffect } from 'react';
import * as nativeEntities from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

export default function EmailAccountManager({ companyId }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { if (companyId) loadAccounts(); }, [companyId]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const list = await nativeEntities.EmailAccount.filter({ company_id: companyId });
      setAccounts(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleRemove = async (id) => {
    if (!confirm('Remove this email account?')) return;
    try {
      await nativeEntities.EmailAccount.delete(id);
      toast({ title: 'Account removed' });
      await loadAccounts();
    } catch (e) { toast({ title: 'Error removing account', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      <EmailConnectionUnavailable />

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : accounts.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-12">
            <Mail className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No saved email account records</p>
            <p className="text-xs text-muted-foreground mt-1">Use the Document inbox to upload invoices and credits.</p>
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
                      <EmailAccountConnectionStatus />
                      {acc.last_scan_date && <span className="text-xs text-muted-foreground">Recorded scan date: {moment(acc.last_scan_date).format('DD MMM YYYY')}</span>}
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
export function EmailAccountConnectionStatus() {
  return <Badge variant="secondary" className="text-xs">Connection unavailable</Badge>;
}

export function EmailConnectionUnavailable() {
  return (<Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Email connections unavailable</p>
          <p className="text-sm text-muted-foreground">Mailbox authorization is not implemented. Adding an address cannot establish a connection.</p>
          <Button disabled>Connect email — unavailable</Button>
        </CardContent>
      </Card>);
}
