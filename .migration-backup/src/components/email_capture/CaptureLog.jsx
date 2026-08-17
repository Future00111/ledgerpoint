import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Paperclip, Mail } from 'lucide-react';
import moment from 'moment';

export default function CaptureLog({ companyId, refreshKey }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (companyId) loadLogs(); }, [companyId, refreshKey]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.EmailCaptureLog.filter({ company_id: companyId }, '-date_found', 100);
      setLogs(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  if (logs.length === 0) return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex flex-col items-center py-12">
        <ScrollText className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-sm">No capture log entries yet</p>
        <p className="text-xs text-muted-foreground mt-1">Run a scan to see captured and ignored emails here</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-2">
      {logs.map(log => (
        <Card key={log.id} className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${log.status === 'captured' ? 'bg-primary/10' : 'bg-muted'}`}>
                <Mail className={`w-5 h-5 ${log.status === 'captured' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{log.email_sender}</p>
                <p className="text-xs text-muted-foreground truncate">{log.email_subject}</p>
                {log.attachment_name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Paperclip className="w-3 h-3" /> {log.attachment_name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{moment(log.date_found).format('DD MMM YYYY, HH:mm')}</p>
              </div>
              <Badge className={`text-xs ${log.status === 'captured' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                {log.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}