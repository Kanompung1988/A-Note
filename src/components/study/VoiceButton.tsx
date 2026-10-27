"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { transcribeWav } from "@/lib/class/api";
import { startRecording, type Recording } from "@/lib/voice/recorder";

const MAX_SECONDS = 45;

type State = "idle" | "recording" | "transcribing" | "error";

/** Tap to talk, tap again to stop. Muse Voice Transcribe turns the question into text. */
export function VoiceButton({ disabled, onText }: { disabled?: boolean; onText: (text: string) => void }) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const recordingRef = useRef<Recording | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(autoStopRef.current);
      recordingRef.current?.cancel();
    },
    [],
  );

  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  async function stop() {
    clearTimeout(autoStopRef.current);
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return;
    setState("transcribing");
    try {
      const text = await transcribeWav(await recording.stop());
      if (text) onText(text);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  async function toggle() {
    if (state === "recording") return stop();
    try {
      recordingRef.current = await startRecording();
      autoStopRef.current = setTimeout(() => void stop(), MAX_SECONDS * 1000);
      setSeconds(0);
      setState("recording");
    } catch {
      setState("error");
    }
  }

  const label =
    state === "recording" ? `Stop recording (${seconds}s)` : state === "transcribing" ? "Listening…" : state === "error" ? "Microphone unavailable, try again" : "Ask out loud";

  return (
    <motion.button
      type="button"
      onClick={toggle}
      disabled={disabled || state === "transcribing"}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.92 }}
      className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition disabled:opacity-40 ${
        state === "recording" ? "border-rose-400 bg-rose-500 text-white" : state === "error" ? "border-rose-300 text-rose-500" : "border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {state === "recording" && <span className="absolute inset-0 animate-ping rounded-xl bg-rose-400/40" />}
      {state === "transcribing" ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
      ) : state === "recording" ? (
        <span className="relative h-3.5 w-3.5 rounded-sm bg-white" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0014 0M12 18v3" />
        </svg>
      )}
    </motion.button>
  );
}
