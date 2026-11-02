"use client";

import type { ReactNode } from "react";
import type { Shape } from "@/lib/ink/geometry";

export type ToolName = "pen" | "highlighter" | "text" | "shape" | "lasso" | "eraser";
export type PenSize = "fine" | "medium" | "bold";

export type ToolChoice = { tool: ToolName; color: string; highlight: string; size: PenSize; shape: Shape };

export const DEFAULT_CHOICE: ToolChoice = { tool: "pen", color: "#1e293b", highlight: "#facc15", size: "medium", shape: "line" };

/** Pen width as a share of the page width. */
export const PEN_SIZES: Record<PenSize, number> = { fine: 0.0022, medium: 0.0032, bold: 0.0058 };

// Orange is kept for loops the learner asked about, so no pen is orange.
const INK = [
  { color: "#1e293b", label: "Black" },
  { color: "#2563eb", label: "Blue" },
  { color: "#dc2626", label: "Red" },
  { color: "#16a34a", label: "Green" },
  { color: "#7c3aed", label: "Purple" },
];
const HIGHLIGHTS = [
  { color: "#facc15", label: "Yellow" },
  { color: "#4ade80", label: "Green" },
  { color: "#f472b6", label: "Pink" },
  { color: "#38bdf8", label: "Blue" },
];
const SHAPES: { shape: Shape; label: string; icon: ReactNode }[] = [
  { shape: "line", label: "Line", icon: <path d="M5 19L19 5" /> },
  { shape: "arrow", label: "Arrow", icon: <path d="M5 19L19 5M11 5h8v8" /> },
  { shape: "rect", label: "Rectangle", icon: <rect x="4" y="6" width="16" height="12" rx="1" /> },
  { shape: "ellipse", label: "Ellipse", icon: <ellipse cx="12" cy="12" rx="8" ry="6" /> },
];

type Props = {
  choice: ToolChoice;
  onChoose: (choice: ToolChoice) => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  canClear: boolean;
  onClear: () => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  /** "Check my work"; hidden when not set */
  onCheck?: () => void;
  canCheck?: boolean;
  checking?: boolean;
  /** extra actions at the end, e.g. "Hand in" */
  actions?: ReactNode;
};

export const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export function Toolbar({ choice, onChoose, canUndo, onUndo, canRedo, onRedo, canClear, onClear, zoom, onZoom, onCheck, canCheck, checking, actions }: Props) {
  const pick = (tool: ToolName) => onChoose({ ...choice, tool });
  const inks = choice.tool === "highlighter" ? HIGHLIGHTS : INK;
  const showColors = choice.tool === "pen" || choice.tool === "text" || choice.tool === "shape" || choice.tool === "highlighter";
  const showSizes = choice.tool === "pen" || choice.tool === "shape";
  const zoomAt = ZOOMS.indexOf(zoom);

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 [scrollbar-width:none]">
      <ToolButton label="Pen (P)" active={choice.tool === "pen"} onClick={() => pick("pen")}>
        <Icon>
          <path d="M4 20l4-1L19 8l-3-3L5 16z" />
          <path d="M14 7l3 3" />
        </Icon>
      </ToolButton>
      <ToolButton label="Highlighter (H)" active={choice.tool === "highlighter"} onClick={() => pick("highlighter")}>
        <span className="block h-5 w-5 rounded-sm opacity-70" style={{ background: choice.highlight }} />
      </ToolButton>
      <ToolButton label="Text (T)" active={choice.tool === "text"} onClick={() => pick("text")}>
        <Icon>
          <path d="M5 6V4h14v2M12 4v16M9 20h6" />
        </Icon>
      </ToolButton>
      <ToolButton label="Shapes (S)" active={choice.tool === "shape"} onClick={() => pick("shape")}>
        <Icon>{SHAPES.find((s) => s.shape === choice.shape)?.icon}</Icon>
      </ToolButton>
      <ToolButton label="Select and move (L)" active={choice.tool === "lasso"} onClick={() => pick("lasso")}>
        <Icon>
          <path d="M7 15c-3-1-4-4-2-6.5S12 4 16 5s5 4 3 6.5-6 3.5-9 3.5" strokeDasharray="3 2.5" />
          <path d="M9 15l-2 5" />
        </Icon>
      </ToolButton>
      <ToolButton label="Eraser (E)" active={choice.tool === "eraser"} onClick={() => pick("eraser")}>
        <Icon>
          <path d="M16 3l5 5-11 11H5l-3-3z" />
          <path d="M9 10l5 5" />
        </Icon>
      </ToolButton>

      {choice.tool === "shape" && (
        <>
          <Divider />
          {SHAPES.map((s) => (
            <ToolButton key={s.shape} label={s.label} small active={choice.shape === s.shape} onClick={() => onChoose({ ...choice, shape: s.shape })}>
              <Icon>{s.icon}</Icon>
            </ToolButton>
          ))}
        </>
      )}

      {showColors && (
        <>
          <Divider />
          {inks.map(({ color, label }) => {
            const active = choice.tool === "highlighter" ? choice.highlight === color : choice.color === color;
            return (
              <ToolButton
                key={color}
                label={label}
                small
                active={active}
                onClick={() => onChoose(choice.tool === "highlighter" ? { ...choice, highlight: color } : { ...choice, color })}
              >
                <span className={`block h-5 w-5 rounded-full ${choice.tool === "highlighter" ? "opacity-70" : ""}`} style={{ background: color }} />
              </ToolButton>
            );
          })}
        </>
      )}

      {showSizes && (
        <>
          <Divider />
          {(["fine", "medium", "bold"] as const).map((size) => (
            <ToolButton key={size} label={`${size[0].toUpperCase()}${size.slice(1)} line`} small active={choice.size === size} onClick={() => onChoose({ ...choice, size })}>
              <span className="block rounded-full bg-slate-700" style={{ width: { fine: 4, medium: 7, bold: 11 }[size], height: { fine: 4, medium: 7, bold: 11 }[size] }} />
            </ToolButton>
          ))}
        </>
      )}

      <Divider />
      <ToolButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
        <Icon>
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h10a6 6 0 010 12h-3" />
        </Icon>
      </ToolButton>
      <ToolButton label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
        <Icon>
          <path d="M15 14l5-5-5-5" />
          <path d="M20 9H10a6 6 0 000 12h3" />
        </Icon>
      </ToolButton>
      <ToolButton label="Clear page" disabled={!canClear} onClick={onClear}>
        <Icon>
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </Icon>
      </ToolButton>

      <Divider />
      <ToolButton label="Zoom out" small disabled={zoomAt <= 0} onClick={() => onZoom(ZOOMS[Math.max(0, zoomAt - 1)])}>
        <Icon>
          <path d="M6 12h12" />
        </Icon>
      </ToolButton>
      <button
        type="button"
        onClick={() => onZoom(1)}
        title="Fit to width"
        className="h-10 shrink-0 rounded-lg px-1.5 text-xs font-semibold tabular-nums text-slate-600 hover:bg-slate-100"
      >
        {Math.round(zoom * 100)}%
      </button>
      <ToolButton label="Zoom in" small disabled={zoomAt >= ZOOMS.length - 1} onClick={() => onZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomAt + 1)])}>
        <Icon>
          <path d="M6 12h12M12 6v12" />
        </Icon>
      </ToolButton>

      <span className="ml-auto hidden shrink-0 pl-3 text-xs text-slate-400 2xl:block">Circle anything you don&apos;t get, then tap “Ask here”</span>
      {onCheck && (
        <button
          type="button"
          onClick={onCheck}
          disabled={!canCheck}
          title="A-Note reads your working and marks the first slip"
          className="ml-auto flex h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40 2xl:ml-3"
        >
          {checking ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          )}
          {checking ? "Checking…" : "Check my work"}
        </button>
      )}
      {actions}
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function Divider() {
  return <span className="mx-1.5 h-6 w-px shrink-0 bg-slate-200" />;
}

function ToolButton({
  label,
  active,
  disabled,
  small,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  small?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`grid shrink-0 place-items-center rounded-lg text-slate-700 transition disabled:opacity-30 ${small ? "h-9 w-9" : "h-10 w-10"} ${
        active ? "bg-sky-100 ring-2 ring-sky-400" : "hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
