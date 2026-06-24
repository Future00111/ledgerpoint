import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Mail } from 'lucide-react';
import moment from 'moment';

export default function CaptureLog({ companyId, refreshKey }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (companyId) loadLogs(); }, [companyId, refreshKey]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.EmailCaptureLog.filter({ company_id: companyId }, '-scan_date', 50);
      setLogs(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  if (logs.length === 0) return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex flex-col items-center py-12">
        <ScrollText className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-sm">No scan activity yet</p>
        <p className="text-xs text-muted-foreground mt-1">Run a scan to see capture logs here</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-2">
      {logs.map(log => (
        <Card key={log.id} className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{log.email_address}</p>
                <p className="text-xs text-muted-foreground">{moment(log.scan_date).format('DD MMM YYYY, HH:mm')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right text-xs">
                <p><span className="font-medium">{log.emails_scanned}</span> scanned</p>
                <p className="text-emerald-600"><span className="font-medium">{log.documents_found}</span> found</p>
                <p className="text-muted-foreground"><span className="font-medium">{log.emails_ignored}</span> ignored</p>
              </div>
              <Badge className={`text-xs ${log.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {log.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}