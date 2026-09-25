import React from 'react';
import { Clock, Sparkles } from 'lucide-react';

const EXAMPLE_CHIPS = [
  'Create an invoice',
  'Find British Gas',
  'Show unpaid customers',
  'Why has profit changed?',
  'Prepare my VAT return',
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Welcome screen for the Ask workspace — shown when the input is empty.
export default function AskWelcome({
  userName,
  smartSuggestions,
  recentSearches,
  quickActions,
  onPickExample,
  onSuggestion,
  onPickRecent,
  onQuickAction,
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </span>
        <p className="text-xl font-semibold tracking-tight">{greeting()}, {userName || 'there'}.</p>
      </div>
      <p className="text-sm text-muted-foreground">What would you like to do today?</p>

      {/* Suggested actions */}
      {smartSuggestions.length > 0 && (
        <section className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Suggested actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {smartSuggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => onSuggestion(s.path)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/50 transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-4 h-4" />
                </span>
                <span className="text-sm font-medium text-foreground truncate">{s.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Try asking */}
      <section className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Try asking</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => onPickExample(c)}
              className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* Quick create */}
      {quickActions && quickActions.length > 0 && (
        <section className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick create</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={() => onQuickAction(a.path)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/30 hover:bg-muted/50 text-xs font-medium transition-colors"
              >
                <a.icon className="w-3.5 h-3.5 text-muted-foreground" />
                {a.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent */}
      {recentSearches.length > 0 && (
        <section className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent</p>
          <div className="flex flex-col gap-0.5">
            {recentSearches.slice(0, 6).map((s, i) => (
              <button
                key={i}
                onClick={() => onPickRecent(s)}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{s}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}