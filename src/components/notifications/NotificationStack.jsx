import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useNotifications } from './useNotifications';

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  error: XCircle,
};

const STYLES = {
  success: { icon: 'text-emerald-600', border: 'border-emerald-200' },
  warning: { icon: 'text-amber-600', border: 'border-amber-200' },
  info: { icon: 'text-blue-600', border: 'border-blue-200' },
  error: { icon: 'text-rose-600', border: 'border-rose-200' },
};

export default function NotificationStack() {
  const { active, dismiss, pause, resume, markRead } = useNotifications();
  const nav = useNavigate();

  const handleClick = (n) => {
    markRead(n.id);
    if (n.route) nav(n.route);
    dismiss(n.id);
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)] pointer-events-none">
      <AnimatePresence initial={false}>
        {active.map((n) => {
          const Icon = ICONS[n.type] || Info;
          const style = STYLES[n.type] || STYLES.info;
          return (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 48, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onMouseEnter={() => pause(n.id)}
              onMouseLeave={() => resume(n.id)}
              onClick={() => handleClick(n)}
              className={`pointer-events-auto relative cursor-pointer flex items-start gap-3 p-3.5 pr-9 rounded-xl border bg-white shadow-lg ${style.border}`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.icon}`} />
              <div className="flex-1 min-w-0">
                {n.title && <p className="text-sm font-semibold text-foreground">{n.title}</p>}
                {n.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.description}</p>
                )}
                {n.type === 'error' && (
                  <p className="text-[10px] text-muted-foreground mt-1">Stays until dismissed • click to open</p>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(n.id);
                }}
                className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}