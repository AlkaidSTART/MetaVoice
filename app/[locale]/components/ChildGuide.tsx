"use client";

import { Sparkles, Ear, Wand2 } from "lucide-react";

type ChildGuideMode = "idle" | "listening" | "thinking" | "appending";

interface ChildGuideCopy {
  title: string;
  speakHint: string;
  appendHint: string;
  listening: string;
  thinking: string;
  appendMode: string;
  examples: {
    scene1: string;
    scene2: string;
    append1: string;
  };
}

interface ChildGuideProps {
  mode: ChildGuideMode;
  hasArtwork: boolean;
  lastTranscript?: string;
  copy: ChildGuideCopy;
}

export default function ChildGuide({ mode, hasArtwork, lastTranscript, copy }: ChildGuideProps) {
  const statusText =
    mode === "listening"
      ? copy.listening
      : mode === "thinking"
        ? copy.thinking
        : hasArtwork
          ? copy.appendMode
          : copy.speakHint;

  return (
    <section className="rounded-3xl border border-sakura/10 bg-gradient-to-br from-white to-sakura-light/20 p-4 shadow-sm shadow-sakura/5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sakura-light text-sakura">
          {mode === "listening" ? <Ear className="h-5 w-5" /> : mode === "thinking" ? <Wand2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">{copy.title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{statusText}</p>
          {lastTranscript ? (
            <p className="mt-2 rounded-2xl bg-white/80 px-3 py-2 text-xs text-text-secondary">
              {lastTranscript}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-macaron-blue-light px-3 py-1 text-xs text-text-primary">{copy.examples.scene1}</span>
        <span className="rounded-full bg-mint-light px-3 py-1 text-xs text-text-primary">{copy.examples.scene2}</span>
        <span className="rounded-full bg-butter-light px-3 py-1 text-xs text-text-primary">
          {hasArtwork ? copy.examples.append1 : copy.appendHint}
        </span>
      </div>
    </section>
  );
}
