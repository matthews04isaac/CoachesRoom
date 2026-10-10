import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { MousePointer2, Trash2, Undo2, Eraser, Type, Triangle, Circle } from 'lucide-react';
import type { Diagram, DiagramItem, DiagramItemKind, DiagramPath, DiagramPathKind, RinkView } from '../../shared/domain';

// Rink geometry in feet (NHL: 200 x 85, 28 ft corner radius).
const W = 200;
const H = 85;
export const VIEW_BOXES: Record<RinkView, [number, number, number, number]> = {
  full: [-3, -3, W + 6, H + 6],
  dzone: [-3, -3, 106, H + 6],
  ozone: [97, -3, 106, H + 6],
  neutral: [52, -3, 96, H + 6],
};
export const VIEW_LABELS: Record<RinkView, string> = { full: 'Full rink', dzone: 'Defensive zone', ozone: 'Offensive zone', neutral: 'Neutral zone' };

const RED = '#d4232f';
const BLUE = '#2f5fd0';

function RinkMarkings({ uid }: { uid: string }) {
  const circles = [
    [31, 20.5],
    [31, 64.5],
    [169, 20.5],
    [169, 64.5],
  ];
  const ndots = [
    [80, 20.5],
    [80, 64.5],
    [120, 20.5],
    [120, 64.5],
  ];
  return (
    <g>
      <defs>
        <clipPath id={`rink-${uid}`}>
          <rect x={0} y={0} width={W} height={H} rx={28} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={W} height={H} rx={28} fill="rgb(var(--rink-ice))" />
      <g clipPath={`url(#rink-${uid})`} strokeWidth={0.5} fill="none">
        {/* goal lines */}
        <line x1={11} y1={0} x2={11} y2={H} stroke={RED} strokeWidth={0.35} />
        <line x1={189} y1={0} x2={189} y2={H} stroke={RED} strokeWidth={0.35} />
        {/* blue lines */}
        <rect x={74} y={0} width={1} height={H} fill={BLUE} stroke="none" opacity={0.85} />
        <rect x={125} y={0} width={1} height={H} fill={BLUE} stroke="none" opacity={0.85} />
        {/* centre red line */}
        <rect x={99.5} y={0} width={1} height={H} fill={RED} stroke="none" opacity={0.8} />
        {/* creases */}
        <path d={`M11 36.5 h4.5 a6 6 0 0 1 0 12 h-4.5`} fill={BLUE} fillOpacity={0.18} stroke={RED} strokeWidth={0.3} />
        <path d={`M189 36.5 h-4.5 a6 6 0 0 0 0 12 h4.5`} fill={BLUE} fillOpacity={0.18} stroke={RED} strokeWidth={0.3} />
        {/* nets */}
        <rect x={7.7} y={39.5} width={3.3} height={6} fill="none" stroke="rgb(var(--rink-line))" strokeWidth={0.4} rx={1} />
        <rect x={189} y={39.5} width={3.3} height={6} fill="none" stroke="rgb(var(--rink-line))" strokeWidth={0.4} rx={1} />
        {/* faceoff circles */}
        {circles.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={15} stroke={RED} strokeWidth={0.35} />
            <circle cx={x} cy={y} r={1} fill={RED} stroke="none" />
          </g>
        ))}
        {ndots.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1} fill={RED} stroke="none" />
        ))}
        <circle cx={100} cy={42.5} r={15} stroke={BLUE} strokeWidth={0.35} />
        <circle cx={100} cy={42.5} r={0.6} fill={BLUE} stroke="none" />
      </g>
      <rect x={0} y={0} width={W} height={H} rx={28} fill="none" stroke="rgb(var(--rink-line))" strokeWidth={0.8} />
    </g>
  );
}

// ---------- path geometry ----------
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Resample a polyline at a fixed step — used to draw the "puck carry" wave. */
function resample(pts: [number, number][], step: number) {
  const out: { x: number; y: number; nx: number; ny: number }[] = [];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (!len) continue;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    let t = carry;
    while (t <= len) {
      out.push({ x: x1 + ux * t, y: y1 + uy * t, nx: -uy, ny: ux });
      t += step;
    }
    carry = t - len;
  }
  return out;
}

function wavePath(pts: [number, number][]) {
  // Sample every 0.4ft and offset along the normal: a ~4ft wavelength, 0.8ft amplitude.
  const s = resample(pts, 0.4);
  if (s.length < 2) return smoothPath(pts);
  const off = (i: number) => Math.sin(i * 0.63) * 0.8 * Math.min(1, (s.length - 1 - i) / 6);
  return s.map((p, i) => `${i ? 'L' : 'M'}${(p.x + p.nx * off(i)).toFixed(2)} ${(p.y + p.ny * off(i)).toFixed(2)}`).join(' ');
}

const PATH_STYLE: Record<DiagramPathKind, { dash?: string; arrow: boolean; label: string }> = {
  skate: { arrow: true, label: 'Skate' },
  carry: { arrow: true, label: 'Puck carry' },
  pass: { dash: '2 1.4', arrow: true, label: 'Pass' },
  shot: { arrow: true, label: 'Shot' },
  backward: { dash: '0.4 1.2', arrow: true, label: 'Backward skate' },
  line: { arrow: false, label: 'Line' },
};

function PathShape({ path, uid, selected, onPointerDown }: { path: DiagramPath; uid: string; selected?: boolean; onPointerDown?: (e: RPointerEvent) => void }) {
  const st = PATH_STYLE[path.kind];
  const d = path.kind === 'carry' ? wavePath(path.points) : smoothPath(path.points);
  const color = 'rgb(var(--ink))';
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: onPointerDown ? 'move' : undefined }}>
      {onPointerDown && <path d={smoothPath(path.points)} stroke="transparent" strokeWidth={4} fill="none" />}
      {selected && <path d={smoothPath(path.points)} stroke="rgb(var(--accent))" strokeOpacity={0.35} strokeWidth={3} fill="none" strokeLinecap="round" />}
      {path.kind === 'shot' ? (
        <>
          <path d={d} stroke={color} strokeWidth={1.3} fill="none" markerEnd={`url(#arrow-${uid})`} />
          <path d={d} stroke="rgb(var(--rink-ice))" strokeWidth={0.45} fill="none" />
        </>
      ) : (
        <path d={d} stroke={color} strokeWidth={0.55} strokeDasharray={st.dash} strokeLinecap="round" fill="none" markerEnd={st.arrow ? `url(#arrow-${uid})` : undefined} />
      )}
    </g>
  );
}

function ItemShape({ item, selected, onPointerDown }: { item: DiagramItem; selected?: boolean; onPointerDown?: (e: RPointerEvent) => void }) {
  const ring = selected ? <circle cx={item.x} cy={item.y} r={4.6} fill="none" stroke="rgb(var(--accent))" strokeWidth={0.6} strokeDasharray="1 0.8" /> : null;
  const common = { onPointerDown, style: { cursor: onPointerDown ? 'grab' : undefined } };
  const text = (t: string, fill = '#fff', size = 3) => (
    <text x={item.x} y={item.y + size * 0.36} textAnchor="middle" fontSize={size} fontWeight={700} fill={fill} fontFamily="Inter, sans-serif" style={{ pointerEvents: 'none', userSelect: 'none' }}>
      {t}
    </text>
  );
  const label = item.label ?? '';
  switch (item.kind) {
    case 'F':
    case 'D':
      return (
        <g {...common}>
          {ring}
          <circle cx={item.x} cy={item.y} r={3.2} fill={item.kind === 'F' ? 'rgb(var(--accent))' : BLUE} stroke="rgb(var(--rink-ice))" strokeWidth={0.4} />
          {text(label || item.kind, '#fff', label.length > 2 ? 2 : 2.8)}
        </g>
      );
    case 'G':
      return (
        <g {...common}>
          {ring}
          <rect x={item.x - 3} y={item.y - 3} width={6} height={6} rx={1.4} fill="#111" stroke="rgb(var(--rink-ice))" strokeWidth={0.4} />
          {text(label || 'G')}
        </g>
      );
    case 'X':
      return (
        <g {...common}>
          {ring}
          <circle cx={item.x} cy={item.y} r={3.2} fill="rgb(var(--rink-ice))" stroke="rgb(var(--ink))" strokeWidth={0.45} />
          {text(label || 'X', 'rgb(var(--ink))', label.length > 2 ? 2 : 2.8)}
        </g>
      );
    case 'C':
      return (
        <g {...common}>
          {ring}
          <polygon points={`${item.x},${item.y - 3.6} ${item.x + 3.4},${item.y + 2.6} ${item.x - 3.4},${item.y + 2.6}`} fill="#0f766e" stroke="rgb(var(--rink-ice))" strokeWidth={0.4} />
          {text('C', '#fff', 2.4)}
        </g>
      );
    case 'puck':
      return (
        <g {...common}>
          {ring}
          <circle cx={item.x} cy={item.y} r={1.3} fill="#0a0a0a" stroke="rgb(var(--rink-ice))" strokeWidth={0.3} />
        </g>
      );
    case 'cone':
      return (
        <g {...common}>
          {ring}
          <polygon points={`${item.x},${item.y - 2.2} ${item.x + 1.8},${item.y + 1.6} ${item.x - 1.8},${item.y + 1.6}`} fill="#f97316" />
        </g>
      );
    case 'net':
      return (
        <g {...common}>
          {ring}
          <rect x={item.x - 1.7} y={item.y - 3} width={3.4} height={6} rx={0.8} fill="none" stroke="rgb(var(--ink))" strokeWidth={0.5} />
        </g>
      );
    case 'text':
      return (
        <g {...common}>
          {ring}
          <text x={item.x} y={item.y + 1} textAnchor="middle" fontSize={3.2} fontWeight={600} fill="rgb(var(--ink))" fontFamily="Inter, sans-serif" style={{ userSelect: 'none' }}>
            {label || 'Text'}
          </text>
        </g>
      );
  }
}

let uidCounter = 0;
function useUid() {
  return useMemo(() => `r${++uidCounter}`, []);
}

/** Read-only rink diagram. */
export function DiagramView({ diagram, className, title }: { diagram: Diagram | null | undefined; className?: string; title?: string }) {
  const uid = useUid();
  const d = diagram ?? { view: 'full' as RinkView, items: [], paths: [] };
  const vb = VIEW_BOXES[d.view] ?? VIEW_BOXES.full;
  return (
    <svg viewBox={vb.join(' ')} className={clsx('block w-full', className)} role="img" aria-label={title ?? `Rink diagram (${VIEW_LABELS[d.view]})`}>
      <ArrowDefs uid={uid} />
      <RinkMarkings uid={uid} />
      {d.paths.map((p) => (
        <PathShape key={p.id} path={p} uid={uid} />
      ))}
      {d.items.map((it) => (
        <ItemShape key={it.id} item={it} />
      ))}
    </svg>
  );
}

function ArrowDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <marker id={`arrow-${uid}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse" markerUnits="strokeWidth">
        <path d="M0 0 L10 5 L0 10 z" fill="rgb(var(--ink))" />
      </marker>
    </defs>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
type Tool = 'select' | DiagramItemKind | DiagramPathKind;
const ITEM_TOOLS: { tool: DiagramItemKind; label: string; icon: ReactNode }[] = [
  { tool: 'F', label: 'Forward', icon: <Dot color="rgb(var(--accent))" t="F" /> },
  { tool: 'D', label: 'Defence', icon: <Dot color={BLUE} t="D" /> },
  { tool: 'G', label: 'Goalie', icon: <span className="flex h-5 w-5 items-center justify-center rounded bg-black text-[10px] font-bold text-white">G</span> },
  { tool: 'X', label: 'Opponent', icon: <span className="flex h-5 w-5 items-center justify-center rounded-full border border-ink text-[10px] font-bold">X</span> },
  { tool: 'C', label: 'Coach', icon: <Triangle className="h-4 w-4 fill-teal-700 text-teal-700" /> },
  { tool: 'puck', label: 'Puck', icon: <Circle className="h-3 w-3 fill-current" /> },
  { tool: 'cone', label: 'Cone', icon: <Triangle className="h-4 w-4 fill-orange-500 text-orange-500" /> },
  { tool: 'net', label: 'Net', icon: <span className="h-4 w-3 rounded-sm border-2 border-current" /> },
  { tool: 'text', label: 'Text', icon: <Type className="h-4 w-4" /> },
];
const PATH_TOOLS: DiagramPathKind[] = ['skate', 'carry', 'pass', 'shot', 'backward', 'line'];

function Dot({ color, t }: { color: string; t: string }) {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
      {t}
    </span>
  );
}

function PathIcon({ kind }: { kind: DiagramPathKind }) {
  const uid = useUid();
  const pts: [number, number][] = [
    [2, 12],
    [22, 4],
  ];
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6">
      <ArrowDefs uid={uid} />
      <g transform="scale(1)">
        <PathShape path={{ id: 'i', kind, points: pts }} uid={uid} />
      </g>
    </svg>
  );
}

const newId = () => Math.random().toString(36).slice(2, 9);

export function DiagramEditor({ value, onChange, height }: { value: Diagram; onChange: (d: Diagram) => void; height?: string }) {
  const uid = useUid();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<{ type: 'item' | 'path'; id: string } | null>(null);
  const [history, setHistory] = useState<Diagram[]>([]);
  const [draft, setDraft] = useState<DiagramPath | null>(null);
  const drag = useRef<{ type: 'item' | 'path'; id: string; start: [number, number]; orig: Diagram; moved: boolean } | null>(null);

  const commit = useCallback(
    (next: Diagram, prev: Diagram = value) => {
      setHistory((h) => [...h.slice(-40), prev]);
      onChange(next);
    },
    [onChange, value],
  );

  const toRink = (e: { clientX: number; clientY: number }): [number, number] => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return [Math.round(Math.min(W, Math.max(0, p.x)) * 10) / 10, Math.round(Math.min(H, Math.max(0, p.y)) * 10) / 10];
  };

  const onBgDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const p = toRink(e);
    if (tool === 'select') {
      setSelected(null);
      return;
    }
    if ((PATH_TOOLS as string[]).includes(tool)) {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDraft({ id: newId(), kind: tool as DiagramPathKind, points: [p] });
      return;
    }
    const kind = tool as DiagramItemKind;
    let label: string | undefined;
    if (kind === 'text') {
      label = window.prompt('Text label', '') || undefined;
      if (!label) return;
    }
    const item: DiagramItem = { id: newId(), kind, x: p[0], y: p[1], ...(label ? { label } : {}) };
    commit({ ...value, items: [...value.items, item] });
    setSelected({ type: 'item', id: item.id });
  };

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toRink(e);
    if (draft) {
      const last = draft.points[draft.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2.5) setDraft({ ...draft, points: [...draft.points, p] });
      return;
    }
    const dg = drag.current;
    if (!dg) return;
    const dx = p[0] - dg.start[0];
    const dy = p[1] - dg.start[1];
    if (Math.abs(dx) + Math.abs(dy) > 0.3) dg.moved = true;
    if (dg.type === 'item') {
      onChange({ ...dg.orig, items: dg.orig.items.map((it) => (it.id === dg.id ? { ...it, x: clamp(it.x + dx, 0, W), y: clamp(it.y + dy, 0, H) } : it)) });
    } else {
      onChange({ ...dg.orig, paths: dg.orig.paths.map((pt) => (pt.id === dg.id ? { ...pt, points: pt.points.map(([x, y]) => [clamp(x + dx, 0, W), clamp(y + dy, 0, H)] as [number, number]) } : pt)) });
    }
  };

  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (draft) {
      const p = toRink(e);
      let pts = draft.points;
      const last = pts[pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.5) pts = [...pts, p];
      if (pts.length >= 2 && Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]) > 3) {
        commit({ ...value, paths: [...value.paths, { ...draft, points: simplify(pts) }] });
      }
      setDraft(null);
      return;
    }
    const dg = drag.current;
    if (dg?.moved) setHistory((h) => [...h.slice(-40), dg.orig]);
    drag.current = null;
  };

  const startDrag = (type: 'item' | 'path', id: string) => (e: RPointerEvent) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelected({ type, id });
    drag.current = { type, id, start: toRink(e), orig: value, moved: false };
  };

  const removeSelected = useCallback(() => {
    if (!selected) return;
    commit(selected.type === 'item' ? { ...value, items: value.items.filter((i) => i.id !== selected.id) } : { ...value, paths: value.paths.filter((p) => p.id !== selected.id) });
    setSelected(null);
  }, [selected, value, commit]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      onChange(h[h.length - 1]);
      return h.slice(0, -1);
    });
    setSelected(null);
  }, [onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        removeSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'Escape') {
        setTool('select');
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, removeSelected, undo]);

  const selItem = selected?.type === 'item' ? value.items.find((i) => i.id === selected.id) : undefined;
  const vb = VIEW_BOXES[value.view] ?? VIEW_BOXES.full;

  return (
    <div className="rounded-xl border border-line bg-raised/40">
      <div className="flex flex-wrap items-center gap-1 border-b border-line p-2">
        <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} label="Select / move (Esc)">
          <MousePointer2 className="h-4 w-4" />
        </ToolBtn>
        <Sep />
        {ITEM_TOOLS.map((t) => (
          <ToolBtn key={t.tool} active={tool === t.tool} onClick={() => setTool(t.tool)} label={`Place ${t.label}`}>
            {t.icon}
          </ToolBtn>
        ))}
        <Sep />
        {PATH_TOOLS.map((k) => (
          <ToolBtn key={k} active={tool === k} onClick={() => setTool(k)} label={`Draw ${PATH_STYLE[k].label} (drag on the rink)`}>
            <PathIcon kind={k} />
          </ToolBtn>
        ))}
        <Sep />
        <ToolBtn onClick={undo} label="Undo (Ctrl+Z)" disabled={!history.length}>
          <Undo2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={removeSelected} label="Delete selected (Del)" disabled={!selected}>
          <Trash2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={() => {
            if (value.items.length + value.paths.length && window.confirm('Clear the whole diagram?')) commit({ ...value, items: [], paths: [] });
          }}
          label="Clear all"
        >
          <Eraser className="h-4 w-4" />
        </ToolBtn>
        <select className="input ml-auto h-8 w-auto py-0 text-xs" value={value.view} onChange={(e) => commit({ ...value, view: e.target.value as RinkView })} aria-label="Rink view">
          {(Object.keys(VIEW_LABELS) as RinkView[]).map((v) => (
            <option key={v} value={v}>
              {VIEW_LABELS[v]}
            </option>
          ))}
        </select>
      </div>
      <svg
        ref={svgRef}
        viewBox={vb.join(' ')}
        className="block w-full touch-none select-none"
        style={{ maxHeight: height ?? '60vh', cursor: tool === 'select' ? 'default' : 'crosshair' }}
        onPointerDown={onBgDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        role="application"
        aria-label="Rink diagram editor"
      >
        <ArrowDefs uid={uid} />
        <RinkMarkings uid={uid} />
        {value.paths.map((p) => (
          <PathShape key={p.id} path={p} uid={uid} selected={selected?.id === p.id} onPointerDown={tool === 'select' ? startDrag('path', p.id) : undefined} />
        ))}
        {draft && draft.points.length > 1 && <PathShape path={draft} uid={uid} />}
        {value.items.map((it) => (
          <ItemShape key={it.id} item={it} selected={selected?.id === it.id} onPointerDown={tool === 'select' ? startDrag('item', it.id) : undefined} />
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-xs text-muted">
        {selItem && ['F', 'D', 'G', 'X', 'text'].includes(selItem.kind) ? (
          <label className="flex items-center gap-2">
            Label
            <input
              className="input h-7 w-28 py-0 text-xs"
              maxLength={selItem.kind === 'text' ? 24 : 3}
              value={selItem.label ?? ''}
              onChange={(e) => onChange({ ...value, items: value.items.map((i) => (i.id === selItem.id ? { ...i, label: e.target.value || undefined } : i)) })}
            />
          </label>
        ) : (
          <span>{tool === 'select' ? 'Drag items or routes to move them. Select a player to edit its label.' : (PATH_TOOLS as string[]).includes(tool) ? 'Click and drag on the rink to draw.' : 'Click on the rink to place.'}</span>
        )}
        <span className="ml-auto">
          {value.items.length} items · {value.paths.length} routes
        </span>
      </div>
    </div>
  );
}

function ToolBtn({ active, onClick, label, children, disabled }: { active?: boolean; onClick: () => void; label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx('flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 transition-colors disabled:opacity-30', active ? 'bg-accent/15 text-accent ring-1 ring-accent/50' : 'text-muted hover:bg-raised hover:text-ink')}
    >
      {children}
    </button>
  );
}
const Sep = () => <span className="mx-1 h-5 w-px bg-line" />;
const clamp = (n: number, a: number, b: number) => Math.round(Math.min(b, Math.max(a, n)) * 10) / 10;

/** Drop points closer than 3ft to keep saved routes small and smooth. */
function simplify(pts: [number, number][]) {
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const l = out[out.length - 1];
    if (Math.hypot(pts[i][0] - l[0], pts[i][1] - l[1]) >= 3) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out.length > 60 ? out.filter((_, i) => i % Math.ceil(out.length / 60) === 0 || i === out.length - 1) : out;
}

export function DiagramLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {(['skate', 'carry', 'pass', 'shot', 'backward'] as DiagramPathKind[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <PathIcon kind={k} /> {PATH_STYLE[k].label}
        </span>
      ))}
    </div>
  );
}
