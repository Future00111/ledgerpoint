import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Briefcase } from 'lucide-react';
import ClientCard from '@/components/accountant/ClientCard';

export default function AccountantPortal() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const { companies, switchCompany } = useCompany();
  const navigate = useNavigate();

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getAccountantClientList', {});
      setClients(res.data.clients || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleView = (client) => {
    const company = companies.find(c => c.id === client.id);
    if (company) switchCompany(company);
    navigate('/');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accountant Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your client companies and review their financial status.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Briefcase className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No client companies yet</p>
            <p className="text-xs text-muted-foreground mt-1">Ask your clients to invite you to their company</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {clients.map(client => (
            <ClientCard key={client.id} client={client} onView={() => handleView(client)} />
          ))}
        </div>
      )}
    </div>
  );
}