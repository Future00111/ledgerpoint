import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import AskTrigger from '@/components/ask/AskTrigger';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import MorningBriefing from '@/components/dashboard/MorningBriefing';
import DashboardSuggestions from '@/components/dashboard/DashboardSuggestions';
import { useDashboardActivity } from '@/components/dashboard/useDashboardActivity';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import WidgetCard from '@/components/dashboard/WidgetCard';
import WidgetErrorBoundary from '@/components/dashboard/WidgetErrorBoundary';
import {
  WIDGETS, MODES, buildModeLayout, normalizeLayout,
  SECTION_ORDER, SECTION_TITLES, sectionOf,
} from '@/components/dashboard/widgetRegistry';
import { Button } from '@/components/ui/button';
import { Settings2, Check, RotateCcw, Save, Building2, Plus, LayoutGrid, LayoutTemplate, Focus, Sparkles } from 'lucide-react';

const KEY = 'lp.dashboard.layouts.v3';

function defaultState() {
  const saved = {};
  Object.keys(MODES).forEach((k) => (saved[k] = buildModeLayout(k)));
  return { mode: 'owner', active: 'owner', saved };
}

function loadState() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && r.saved && r.mode && MODES[r.mode]) {
      const saved = {};
      Object.keys(r.saved).forEach((k) => (saved[k] = normalizeLayout(r.saved[k])));
      Object.keys(MODES).forEach((k) => {
        if (!saved[k]) saved[k] = buildModeLayout(k);
      });
      return { mode: r.mode, active: r.active || r.mode, saved };
    }
  } catch {
    /* ignore */
  }
  return defaultState();
}

function persist(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export default function Dashboard() {
  const { activeCompany, loading } = useCompany();
  const nav = useNavigate();
  const [state, setState] = useState(loadState);
  const [editMode, setEditMode] = useState(false);
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem('lp.dashboard.focus') === '1');
  const [adaptive, setAdaptive] = useState(() => localStorage.getItem('lp.dashboard.adaptive') === '1');
  const activity = useDashboardActivity(activeCompany?.id);

  useEffect(() => {
    localStorage.setItem('lp.dashboard.focus', focusMode ? '1' : '0');
  }, [focusMode]);
  useEffect(() => {
    localStorage.setItem('lp.dashboard.adaptive', adaptive ? '1' : '0');
  }, [adaptive]);

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

  const layout = state.saved[state.active] || buildModeLayout(state.mode);

  const updateArr = (fn) => {
    setState((s) => {
      const arr = fn(s.saved[s.active] || buildModeLayout(s.mode));
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
  const clearDrag = () => {
    dragId.current = null;
    setDraggingId(null);
    setOverId(null);
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

  const cycleW = (id) => updateArr((arr) => arr.map((x) => (x.id === id ? { ...x, w: x.w >= 3 ? 1 : x.w + 1 } : x)));
  const cycleH = (id) => updateArr((arr) => arr.map((x) => (x.id === id ? { ...x, h: x.h >= 2 ? 1 : x.h + 1 } : x)));
  const toggleCollapse = (id) => updateArr((arr) => arr.map((x) => (x.id === id ? { ...x, collapsed: !x.collapsed } : x)));
  const hide = (id) => updateArr((arr) => arr.map((x) => (x.id === id && !WIDGETS[id].core ? { ...x, hidden: true } : x)));
  const show = (id) => updateArr((arr) => arr.map((x) => (x.id === id ? { ...x, hidden: false } : x)));

  const switchMode = (modeKey) =>
    setState((s) => {
      const saved = { ...s.saved, [modeKey]: s.saved[modeKey] || buildModeLayout(modeKey) };
      const next = { ...s, mode: modeKey, active: modeKey, saved };
      persist(next);
      return next;
    });

  const reset = () =>
    setState((s) => {
      const saved = { ...s.saved, [s.mode]: buildModeLayout(s.mode) };
      const next = { ...s, active: s.mode, saved };
      persist(next);
      return next;
    });

  const saveAs = () => {
    const name = window.prompt('Save current layout as:', 'My Layout');
    if (!name) return;
    setState((s) => {
      const saved = { ...s.saved, [name]: JSON.parse(JSON.stringify(s.saved[s.active] || buildModeLayout(s.mode))) };
      const next = { ...s, active: name, saved };
      persist(next);
      return next;
    });
  };

  const switchLayout = (name) =>
    setState((s) => {
      const next = { ...s, active: name, mode: MODES[name] ? name : s.mode };
      persist(next);
      return next;
    });

  const hiddenWidgets = Object.values(WIDGETS).filter(
    (w) => !w.core && layout.find((x) => x.id === w.id)?.hidden
  );
  const edit = editMode && isDesktop && !focusMode;
  const customLayouts = Object.keys(state.saved).filter((n) => !MODES[n]);

  const order = isDesktop ? layout : [...layout].sort((a, b) => WIDGETS[a.id].priority - WIDGETS[b.id].priority);
  const allVisible = order.filter((x) => !x.hidden);
  // Focus Mode: a calm, distraction-free view of only the core widgets —
  // Ask, Today's Priority and Business Health — which live in the header and
  // the Ask bar. The widget grid is hidden entirely.
  const visible = focusMode ? [] : allVisible;

  const attentionScore = (id) => activity[id] || 0;
  let groups = SECTION_ORDER.map((sec) => ({
    section: sec,
    items: visible.filter((x) => sectionOf(x.id) === sec),
  })).filter((g) => g.items.length);

  if (adaptive) {
    groups = groups.map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => attentionScore(b.id) - attentionScore(a.id)),
    }));
    groups.sort((a, b) => {
      const am = Math.max(0, ...a.items.map((i) => attentionScore(i.id)));
      const bm = Math.max(0, ...b.items.map((i) => attentionScore(i.id)));
      return bm - am;
    });
  }

  const renderCard = (item) => {
    const meta = WIDGETS[item.id];
    if (!meta) return null;
    const Comp = meta.component;
    return (
      <WidgetCard
        key={item.id}
        meta={meta}
        size={item}
        company={activeCompany}
        editMode={edit}
        collapsed={!!item.collapsed}
        attention={attentionScore(item.id) > 0}
        isCore={!!meta.core}
        dragging={draggingId === item.id}
        dragOver={!!overId && overId !== item.id && !!draggingId}
        onDragStart={() => onDragStart(item.id)}
        onDragOver={(e) => onDragOver(e, item.id)}
        onDrop={() => onDrop(item.id)}
        onDragEnd={clearDrag}
        onCycleW={() => cycleW(item.id)}
        onCycleH={() => cycleH(item.id)}
        onToggleCollapse={() => toggleCollapse(item.id)}
        onHide={() => hide(item.id)}
      >
        <WidgetErrorBoundary>
          <Comp company={activeCompany} h={item.h} />
        </WidgetErrorBoundary>
      </WidgetCard>
    );
  };

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

      {/* Ask bar — the single entry point into the Ask workspace */}
      <div className="max-w-2xl">
        <AskTrigger />
      </div>

      {!focusMode && <MorningBriefing company={activeCompany} />}

      {focusMode ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
            <Focus className="w-6 h-6" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Focus mode — a calm view of what matters now: Ask, Today's Priority and Business Health.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setFocusMode(false)}>
            Exit focus mode
          </Button>
        </div>
      ) : (
        <>
          {/* Smart Suggestions — never auto-applied */}
          {!edit && (
            <DashboardSuggestions activity={activity} layout={layout} onAddWidget={show} />
          )}

          {/* Dashboard settings */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant={editMode ? 'default' : 'outline'} size="sm" onClick={() => setEditMode((v) => !v)}>
                {editMode ? <Check className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                {editMode ? 'Done' : 'Customise'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <LayoutTemplate className="w-3.5 h-3.5" />
                    Templates
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Dashboard templates</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={state.mode} onValueChange={switchMode}>
                    {Object.entries(MODES).map(([key, m]) => (
                      <DropdownMenuRadioItem key={key} value={key}>
                        <m.icon className="w-3.5 h-3.5 mr-1" />
                        {m.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setFocusMode((v) => !v)}>
                    <Focus className="w-3.5 h-3.5" />
                    {focusMode ? 'Exit focus mode' : 'Focus mode'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setAdaptive((v) => !v)}>
                    <Sparkles className="w-3.5 h-3.5" />
                    {adaptive ? 'Adaptive order: on' : 'Adaptive order: off'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEditMode((v) => !v)}>
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Widget layout
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={reset}>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset template
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={saveAs}>
                    <Save className="w-3.5 h-3.5" />
                    Save layout as
                  </DropdownMenuItem>
                  {hiddenWidgets.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Plus className="w-3.5 h-3.5" />
                        Add widgets
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-52">
                        {hiddenWidgets.map((w) => (
                          <DropdownMenuItem key={w.id} onSelect={() => show(w.id)}>
                            <w.icon className="w-3.5 h-3.5" />
                            {w.title}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {customLayouts.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        Custom templates
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-52">
                        {customLayouts.map((name) => (
                          <DropdownMenuItem key={name} onSelect={() => switchLayout(name)}>
                            {name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <span className="text-xs text-muted-foreground">
              {focusMode ? 'Focus mode' : adaptive ? 'Adaptive order' : MODES[state.mode]?.label}
            </span>
          </div>

          {edit && (
            <div className="text-xs text-muted-foreground rounded-lg bg-muted/60 px-3 py-2">
              Drag the grip handle to move widgets · use Narrow/Wide/Full and Short/Tall to resize · collapse widgets you want to keep but tuck away · hide widgets you don't need. Pinned widgets stay. Switching templates changes only the layout — never your data.
            </div>
          )}

          {/* Widget sections */}
          {groups.map((g) => (
            <div key={g.section} className="space-y-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                {SECTION_TITLES[g.section]}
              </h2>
              <div className={isDesktop ? 'grid grid-cols-12 gap-4' : 'flex flex-col gap-4'}>
                {g.items.map((item) => renderCard(item))}
              </div>
            </div>
          ))}

          {visible.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              All widgets are hidden.{' '}
              <button onClick={reset} className="text-primary underline">
                Reset dashboard
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}