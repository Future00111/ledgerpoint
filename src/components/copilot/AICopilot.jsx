import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Sparkles, X, SendHorizonal, Bot } from 'lucide-react';
import MessageBubble from './MessageBubble';

const AGENT_NAME = 'accounting_copilot';

const SUGGESTED_QUESTIONS = [
  'How much VAT do I owe?',
  'Which customers owe me money?',
  'Which suppliers have I spent the most with this year?',
  'Show me overdue invoices',
  'Show me bills due this week',
  'What was my profit last month?',
  'Which transactions still need reviewing?',
  'Why has my bank balance changed this month?',
  'Summarise my business performance',
  'Prepare me for my VAT return',
];

function buildContext(company) {
  return `[Active company: id=${company.id}, name="${company.name}", business_type=${company.business_type || 'general_business'}. You MUST filter every entity query by company_id="${company.id}". Do not access other companies' data.]\n\n`;
}

export default function AICopilot() {
  const { activeCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Reset conversation when the selected company changes
  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setError(null);
  }, [activeCompany?.id]);

  // Subscribe to conversation updates
  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      setSending(false);
    });
    return () => unsubscribe();
  }, [conversation?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const ensureConversation = useCallback(async () => {
    if (conversation) return conversation;
    if (!activeCompany) throw new Error('No active company');
    const conv = base44.agents.createConversation({
      agent_name: AGENT_NAME,
      metadata: {
        name: `Copilot — ${activeCompany.name}`,
        company_id: activeCompany.id,
      },
    });
    setConversation(conv);
    return conv;
  }, [conversation, activeCompany]);

  const sendMessage = async (text) => {
    if (!text.trim() || !activeCompany) return;
    setError(null);
    setSending(true);
    try {
      const conv = await ensureConversation();
      const content = `${buildContext(activeCompany)}${text.trim()}`;
      base44.agents.addMessage(conv, { role: 'user', content });
      setInput('');
    } catch (e) {
      setError(e.message || 'Something went wrong');
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const isWaiting = messages.length > 0 && messages[messages.length - 1].role === 'user';

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all px-4 py-3 group"
          aria-label="Open AI Copilot"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[140px] transition-all duration-300">Ask AI</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 w-full sm:w-[420px] h-[80vh] sm:h-[600px] sm:bottom-5 sm:right-5 sm:rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden sm:rounded-br-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">AI Accounting Copilot</p>
                <p className="text-[11px] text-primary-foreground/70 leading-tight truncate max-w-[230px]">
                  {activeCompany ? activeCompany.name : 'No company selected'}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-primary-foreground/15 rounded-lg transition-colors">
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-2">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">Ask me anything about your accounts</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">I can read your data for {activeCompany?.name || 'this company'} and explain the answers.</p>
                <div className="grid grid-cols-1 gap-1.5 w-full">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={sending || !activeCompany}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted hover:border-primary/40 transition-colors disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, idx) => (
              <MessageBubble key={idx} message={m} />
            ))}

            {(isWaiting || (sending && messages.length === 0)) && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-card">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={activeCompany ? 'Ask about your accounts…' : 'Select a company first'}
                disabled={!activeCompany || sending}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-h-32 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || !activeCompany || sending}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <SendHorizonal className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">Read-only — I can't edit your books. Always check the linked records.</p>
          </form>
        </div>
      )}
    </>
  );
}