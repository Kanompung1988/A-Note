"use client";

export type ToolChoice = { tool: "pen" | "highlighter" | "eraser"; color: string };

const PEN_COLORS = [
  { color: "#1e293b", label: "Black pen" },
  { color: "#2563eb", label: "Blue pen" },
  { color: "#dc2626", label: "Red pen" },
];
const HIGHLIGHT = "#facc15";

type Props = {
  choice: ToolChoice;
  onChoose: (choice: ToolChoice) => void;
  canUndo: boolean;
  onUndo: () => void;
  canClear: boolean;
  onClear: () => void;
};

export function Toolbar({ choice, onChoose, canUndo, onUndo, canClear, onClear }: Props) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-2">
      {PEN_COLORS.map(({ color, label }) => (
        <ToolButton
          key={color}
          label={label}
          active={choice.tool === "pen" && choice.color === color}
          onClick={() => onChoose({ tool: "pen", color })}
        >
          <span className="block h-5 w-5 rounded-full" style={{ background: color }} />
        </ToolButton>
      ))}
      <ToolButton label="Highlighter" active={choice.tool === "highlighter"} onClick={() => onChoose({ tool: "highlighter", color: HIGHLIGHT })}>
        <span className="block h-5 w-5 rounded-sm opacity-70" style={{ background: HIGHLIGHT }} />
      </ToolButton>
      <ToolButton label="Eraser" active={choice.tool === "eraser"} onClick={() => onChoose({ tool: "eraser", color: choice.color })}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M16 3l5 5-11 11H5l-3-3z" />
          <path d="M9 10l5 5" />
        </svg>
      </ToolButton>
      <span className="mx-2 h-6 w-px bg-slate-200" />
      <ToolButton label="Undo" disabled={!canUndo} onClick={onUndo}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h10a6 6 0 010 12h-3" />
        </svg>
      </ToolButton>
      <ToolButton label="Clear page" disabled={!canClear} onClick={onClear}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
      </ToolButton>
      <span className="ml-auto hidden text-xs text-slate-400 sm:block">Circle anything you don&apos;t get, then tap “Ask here”</span>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-10 w-10 place-items-center rounded-lg text-slate-700 transition disabled:opacity-30 ${
        active ? "bg-sky-100 ring-2 ring-sky-400" : "hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
