import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import AskTrigger from '@/components/ask/AskTrigger';
import DailyWork from '@/features/workspaceNavigation/DailyWork';
import EmptyState from '@/components/workspace/EmptyState';
import { moveWidget } from '@/features/workspaceNavigation/model.mjs';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
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

export default function CustomDashboard() {
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
  const [moveAnnouncement, setMoveAnnouncement] = useState('');

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
  const move = (id, direction) => {
    updateArr(arr => moveWidget(arr, id, direction, sectionOf));
    setMoveAnnouncement(`${WIDGETS[id].title} moved ${direction < 0 ? 'earlier' : 'later'} in its section.`);
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
    const peers = layout.filter(widget => !widget.hidden && sectionOf(widget.id) === sectionOf(item.id));
    const position = peers.findIndex(widget => widget.id === item.id);
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
        onMoveEarlier={() => move(item.id, -1)}
        onMoveLater={() => move(item.id, 1)}
        canMoveEarlier={!adaptive && position > 0}
        canMoveLater={!adaptive && position < peers.length - 1}
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

  if (!activeCompany) return <section className="workspace-card"><EmptyState icon={Building2} title="Choose your company" description="Your dashboard layouts stay saved. Open a company to see its figures and next steps." action={<Button onClick={() => nav('/companies')}>Open companies</Button>} /></section>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-8">
      <section className="space-y-5">
        <div>
          <DashboardHeader />

          {/* Ask bar — the single entry point into the Ask workspace */}
          <div className="mt-5 max-w-3xl">
            <AskTrigger />
          </div>
        </div>
      </section>
      <DailyWork compact />
      <p className="sr-only" role="status" aria-live="polite">{moveAnnouncement}</p>

      {focusMode ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
            <Focus className="w-6 h-6" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Focus mode keeps your daily links and Ask available. Your saved widgets are hidden until you leave focus mode.
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-3 py-3">
            <div className="flex items-center gap-2">
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Your workspace</span>
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
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {adaptive ? 'Adaptive order' : MODES[state.mode]?.label}
            </span>
          </div>

          {editMode && !isDesktop && <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Widget arrangement is available on a wider screen. Your saved layout and templates are unchanged.</p>}
          {edit && (
            <div className="text-xs text-muted-foreground rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2.5">
              Use the earlier/later buttons to move a widget within its section, or drag its handle. Resize, collapse or hide widgets to suit your work. Pinned widgets stay. Templates change only the layout, never your data. {adaptive && 'Turn off adaptive order in Templates to move widgets yourself.'}
            </div>
          )}

          {/* Widget sections */}
          {groups.map((g) => (
            <div key={g.section} className="space-y-3">
              <div className="flex items-center gap-3 px-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {SECTION_TITLES[g.section]}
                </h2>
                <div className="h-px flex-1 bg-border/70" />
              </div>
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