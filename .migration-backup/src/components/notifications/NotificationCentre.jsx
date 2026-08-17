import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useNotifications } from './useNotifications';
import { relativeTime } from '@/lib/format';
import { useDevMode, sanitizeNotification } from '@/lib/safeMessages';

const ICONS = { success: CheckCircle2, warning: AlertTriangle, info: Info, error: XCircle };
const ICON_COLOR = {
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
  error: 'text-rose-600',
};

export default function NotificationCentre() {
  const { history, unread, markRead, markAllRead, removeNotif, clearAll } = useNotifications();
  const dev = useDevMode();
  const nav = useNavigate();

  const openItem = (n) => {
    markRead(n.id);
    if (n.route) nav(n.route);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-2 rounded-md hover:bg-muted transition-colors"
          aria-label="Notification centre"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[380px] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unread > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {unread} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={markAllRead}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Mark all as read"
              aria-label="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
              title="Clear all"
              aria-label="Clear all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No notifications yet
            </div>
          ) : (
            history.map((raw) => {
              const n = sanitizeNotification(raw, dev);
              const Icon = ICONS[n.type] || Info;
              return (
                <div
                  key={n.id}
                  className={`group flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-muted/60 transition-colors ${
                    !n.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className="flex-1 text-left flex items-start gap-3 min-w-0"
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${ICON_COLOR[n.type] || 'text-blue-600'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {n.title || n.description}
                      </p>
                      {n.title && n.description && (
                        <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {relativeTime(new Date(n.createdAt).toISOString())}
                      </span>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="p-1 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeNotif(n.id)}
                      className="p-1 rounded-md text-muted-foreground hover:bg-background hover:text-destructive"
                      title="Delete"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}