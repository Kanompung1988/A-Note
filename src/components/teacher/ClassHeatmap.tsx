"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import type { Cluster } from "@/lib/class/cluster";
import { regionTransform } from "@/lib/regions";
import type { Sheet } from "@/lib/sheets";
import type { AskRecord } from "@/lib/store/types";

type Props = {
  sheet: Sheet;
  asks: AskRecord[];
  clusters: Cluster[];
  active: number | null;
  onSelect: (clusterId: number | null) => void;
};

/**
 * The worksheet with every learner's circled spot laid on top. Shapes come from SAM 3.1 when it
 * outlined the spot, otherwise from the loop. Overlaps darken, so the class's sticking points glow.
 */
export function ClassHeatmap({ sheet, asks, clusters, active, onSelect }: Props) {
  const activeCluster = clusters.find((c) => c.id === active) ?? null;
  const activeAsks = new Set(activeCluster?.askIds ?? []);
  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200" style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }}>
      <Image src={sheet.src} alt={sheet.title} width={sheet.width} height={sheet.height} unoptimized className="absolute inset-0 h-full w-full" />
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${sheet.width} ${sheet.height}`} aria-hidden>
        <AnimatePresence>
          {asks.map((ask) => {
            const highlighted = activeAsks.has(ask.id);
            const opacity = activeCluster ? (highlighted ? 0.32 : 0.06) : 0.18;
            return ask.region ? (
              <motion.path
                key={ask.id}
                d={ask.region.path}
                transform={regionTransform(ask.region)}
                fill="#f97316"
                initial={{ fillOpacity: 0 }}
                animate={{ fillOpacity: opacity }}
                transition={{ duration: 0.6 }}
              />
            ) : (
              <motion.ellipse
                key={ask.id}
                cx={ask.loop.x + ask.loop.w / 2}
                cy={ask.loop.y + ask.loop.h / 2}
                rx={ask.loop.w / 2}
                ry={ask.loop.h / 2}
                fill="#f97316"
                initial={{ fillOpacity: 0 }}
                animate={{ fillOpacity: opacity }}
                transition={{ duration: 0.6 }}
              />
            );
          })}
        </AnimatePresence>
        {activeCluster && (
          <motion.rect
            key={activeCluster.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            x={activeCluster.box.x - 10}
            y={activeCluster.box.y - 10}
            width={activeCluster.box.w + 20}
            height={activeCluster.box.h + 20}
            rx={18}
            fill="none"
            stroke="#ea580c"
            strokeWidth={5}
            strokeDasharray="14 10"
          />
        )}
      </svg>
      {clusters.map((c) => (
        <motion.button
          key={c.id}
          type="button"
          onClick={() => onSelect(active === c.id ? null : c.id)}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.12 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          aria-label={`Spot ${c.id}: ${c.studentIds.length} learners`}
          className={`absolute grid h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full px-2 text-sm font-bold text-white shadow-lg ring-2 ring-white ${
            active === c.id ? "bg-orange-600" : "bg-orange-500"
          }`}
          style={{ left: `${((c.box.x + c.box.w) / sheet.width) * 100}%`, top: `${(c.box.y / sheet.height) * 100}%` }}
        >
          {c.studentIds.length}
        </motion.button>
      ))}
    </div>
  );
}
