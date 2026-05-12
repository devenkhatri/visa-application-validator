'use client';
import { useEffect, useRef } from 'react';

interface ScoreGaugeProps {
  score: number;
  verdict: string;
}

const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string; glow: string }> = {
  strong:       { label: 'STRONG',       color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   glow: '#22c55e' },
  moderate:     { label: 'MODERATE',     color: '#eab308', bg: 'rgba(234,179,8,0.15)',   glow: '#eab308' },
  weak:         { label: 'WEAK',         color: '#f97316', bg: 'rgba(249,115,22,0.15)',  glow: '#f97316' },
  insufficient: { label: 'INSUFFICIENT', color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  glow: '#ef4444' },
};

function getVerdictConfig(verdict: string) {
  return VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.insufficient;
}

export default function ScoreGauge({ score, verdict }: ScoreGaugeProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const cfg       = getVerdictConfig(verdict);

  const size   = 200;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ   = 2 * Math.PI * radius;

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    // Animate dash offset from full (empty) to target
    const target = circ - (score / 100) * circ;
    el.style.transition = 'none';
    el.style.strokeDashoffset = String(circ);
    // Trigger animation after a brief delay
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.strokeDashoffset = String(target);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [score, circ]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <circle
            ref={circleRef}
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={cfg.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ}
            style={{ filter: `drop-shadow(0 0 8px ${cfg.glow})` }}
          />
        </svg>
        {/* Score text — centered absolutely over the SVG */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-black text-white leading-none">{score}</span>
          <span className="text-sm text-white/50 mt-1 tracking-widest">/100</span>
        </div>
      </div>

      {/* Verdict badge */}
      <div
        className="px-5 py-2 rounded-full text-sm font-bold tracking-widest uppercase"
        style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.color}40` }}
      >
        {cfg.label}
      </div>
    </div>
  );
}
