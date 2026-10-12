import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const fmtDateTime = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

export default function DiscussTab({ transaction, companyId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.TransactionComment.filter(
        { company_id: companyId, transaction_id: transaction.id }, '-created_date', 100,
      );
      setComments(list);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [transaction.id, companyId]);

  const post = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await base44.entities.TransactionComment.create({
        company_id: companyId, transaction_id: transaction.id, author_name: 'You', body: text.trim(),
      });
      setText('');
      await load();
    } finally { setPosting(false); }
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="flex items-baseline justify-between">
                <p className="font-medium">{c.author_name || 'You'}</p>
                <p className="text-xs text-muted-foreground/60">{fmtDateTime(c.created_date)}</p>
              </div>
              <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}
      <div className="pt-2 border-t border-border/40">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note…" rows={3} className="text-sm" />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={post} disabled={!text.trim() || posting} className="h-8">{posting ? 'Posting…' : 'Add note'}</Button>
        </div>
      </div>
    </div>
  );
}