import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import AskTrigger from '@/components/ask/AskTrigger';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import WidgetCard from '@/components/dashboard/WidgetCard';
import WidgetErrorBoundary from '@/components/dashboard/WidgetErrorBoundary';
import { WIDGETS, DEFAULT_LAYOUT, normalizeLayout } from '@/components/dashboard/widgetRegistry';
import { Button } from '@/components/ui/button';
import {
  Settings2, Check, RotateCcw, Save, Plus, Building2,
} from 'lucide-react';

const KEY = 'lp.dashboard.layouts.v2';

function loadState() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && r.saved && r.saved.Default) {
      const saved = {};
      Object.keys(r.saved).forEach((k) => (saved[k] = normalizeLayout(r.saved[k])));
      return { active: r.active || 'Default', saved };
    }
  } catch {
    /* ignore */
  }
  return { active: 'Default', saved: { Default: normalizeLayout(DEFAULT_LAYOUT) } };
}

function persist(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export default function Dashboard() {
  const { activeCompany, loading } = useCompany();
  const nav = useNavigate();
  const [state, setState] = useState(loadState);
  const [editMode, setEditMode] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width:1024px)').matches
  );
  const dragId = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);

  useEffect(() => {
    const m = window.matchMedia('(min-width:1024px)');
    const h = (e) => setIsDesktop(e.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);

  const layout = state.saved[state.active] || normalizeLayout(DEFAULT_LAYOUT);

  const updateArr = (fn) => {
    setState((s) => {
      const arr = fn(s.saved[s.active] || normalizeLayout(DEFAULT_LAYOUT));
      const saved = { ...s.saved, [s.active]: arr };
      const next = { ...s, saved };
      persist(next);
      return next;
    });
  };

  const onDragStart = (id) => {
    dragId.current = id;
    setDraggingId(id);
  };
  const onDragOver = (e, id) => {
    e.preventDefault();
    if (overId !== id) setOverId(id);
  };
  const onDrop = (id) => {
    const from = dragId.current;
    clearDrag();
    if (!from || from === id) return;
    updateArr((arr) => {
      const i = arr.findIndex((x) => x.id === from);
      const j = arr.findIndex((x) => x.id === id);
      if (i < 0 || j < 0) return arr;
      const cp = arr.slice();
      const [m] = cp.splice(i, 1);
      cp.splice(j, 0, m);
      return cp;
    });
  };
  const clearDrag = () => {
    dragId.current = null;
    setDraggingId(null);
    setOverId(null);
  };

  const cycleW = (id) => updateArr((arr) => arr.map((x) => (x.id === id ? { ...x, w: x.w >= 3 ? 1 : x.w + 1 } : x)));
  const cycleH = (id) => updateArr((arr) => arr.map((x) => (x.id === id ? { ...x, h: x.h >= 2 ? 1 : x.h + 1 } : x)));
  const hide = (id) => updateArr((arr) => arr.map((x) => (x.id === id ? { ...x, hidden: true } : x)));
  const show = (id) => updateArr((arr) => arr.map((x) => (x.id === id ? { ...x, hidden: false } : x)));

  const reset = () =>
    setState((s) => {
      const next = { ...s, saved: { ...s.saved, [s.active]: normalizeLayout(DEFAULT_LAYOUT) } };
      persist(next);
      return next;
    });

  const saveAs = () => {
    const name = window.prompt('Save current layout as:', 'My Layout');
    if (!name) return;
    setState((s) => {
      const next = { active: name, saved: { ...s.saved, [name]: JSON.parse(JSON.stringify(s.saved[s.active] || normalizeLayout(DEFAULT_LAYOUT))) } };
      persist(next);
      return next;
    });
  };

  const switchLayout = (name) => {
    setState((s) => {
      const next = { ...s, active: name };
      persist(next);
      return next;
    });
  };

  const hiddenWidgets = Object.values(WIDGETS).filter((w) => layout.find((x) => x.id === w.id)?.hidden);
  const edit = editMode && isDesktop;

  const order = isDesktop ? layout : [...layout].sort((a, b) => WIDGETS[a.id].priority - WIDGETS[b.id].priority);
  const visible = order.filter((x) => !x.hidden);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeCompany) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Building2 className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Welcome to Ledgerly</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Set up your first business to unlock your Business Command Centre — KPIs, priorities, cashflow and insights.
        </p>
        <Button className="mt-4" onClick={() => nav('/setup')}>
          Start setup
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DashboardHeader />

      {/* Ask bar */}
      <div className="max-w-2xl">
        <AskTrigger />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={editMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditMode((v) => !v)}
        >
          {editMode ? <Check className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
          {editMode ? 'Done' : 'Customise'}
        </Button>

        {editMode && (
          <>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={saveAs}>
              <Save className="w-3.5 h-3.5" />
              Save as
            </Button>
            {hiddenWidgets.length > 0 && (
              <div className="relative">
                <select
                  onChange={(e) => e.target.value && show(e.target.value)}
                  value=""
                  className="h-8 text-xs rounded-md border border-input bg-transparent pl-3 pr-7 appearance-none cursor-pointer"
                >
                  <option value="" disabled>
                    + Add widget
                  </option>
                  {hiddenWidgets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground hidden sm:inline">Layout</label>
          <select
            value={state.active}
            onChange={(e) => switchLayout(e.target.value)}
            className="h-8 text-xs rounded-md border border-input bg-transparent pl-2 pr-7 appearance-none cursor-pointer"
          >
            {Object.keys(state.saved).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {editMode && isDesktop && (
        <div className="text-xs text-muted-foreground rounded-lg bg-muted/60 px-3 py-2">
          Drag the <span className="font-medium">⠿</span> handle to move widgets · use Narrow/Wide/Full and Short/Tall to resize · hide widgets you don't need.
        </div>
      )}

      {/* Widget grid */}
      <div className={isDesktop ? 'grid grid-cols-12 gap-4' : 'flex flex-col gap-4'}>
        {visible.map((item) => {
          const meta = WIDGETS[item.id];
          if (!meta) return null;
          const Comp = meta.component;
          return (
            <WidgetCard
              key={item.id}
              meta={meta}
              size={item}
              editMode={edit}
              dragging={draggingId === item.id}
              dragOver={!!overId && overId !== item.id && !!draggingId}
              onDragStart={() => onDragStart(item.id)}
              onDragOver={(e) => onDragOver(e, item.id)}
              onDrop={() => onDrop(item.id)}
              onDragEnd={clearDrag}
              onCycleW={() => cycleW(item.id)}
              onCycleH={() => cycleH(item.id)}
              onHide={() => hide(item.id)}
            >
              <WidgetErrorBoundary>
                <Comp company={activeCompany} h={item.h} />
              </WidgetErrorBoundary>
            </WidgetCard>
          );
        })}
      </div>

      {editMode && hiddenWidgets.length === Object.keys(WIDGETS).length - visible.length && visible.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">
          All widgets are hidden. <button onClick={reset} className="text-primary underline">Reset dashboard</button>
        </div>
      )}
    </div>
  );
}