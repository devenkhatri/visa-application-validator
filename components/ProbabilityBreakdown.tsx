'use client';
import { useEffect, useRef } from 'react';

interface BreakdownItem {
  label: string;
  score: number;
  color: string;
}

interface ProbabilityBreakdownProps {
  breakdown: {
    documents_completeness: number;
    financial_strength:     number;
    travel_history:         number;
    ties_to_home_country:   number;
    application_quality:    number;
  };
}

const ITEMS: { key: keyof ProbabilityBreakdownProps['breakdown']; label: string; color: string }[] = [
  { key: 'documents_completeness', label: 'Documents Completeness', color: '#6366f1' },
  { key: 'financial_strength',     label: 'Financial Strength',     color: '#22c55e' },
  { key: 'travel_history',         label: 'Travel History',         color: '#3b82f6' },
  { key: 'ties_to_home_country',   label: 'Ties to Home Country',   color: '#a855f7' },
  { key: 'application_quality',    label: 'Application Quality',    color: '#f59e0b' },
];

function Bar({ label, score, color, delay }: BreakdownItem & { delay: number }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.width = '0%';
    const timer = setTimeout(() => {
      el.style.transition = 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
      el.style.width       = `${score}%`;
    }, delay);
    return () => clearTimeout(timer);
  }, [score, delay]);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="text-white/70">{label}</span>
        <span className="font-bold text-white">{score}<span className="text-white/40 text-xs">/100</span></span>
      </div>
      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
        />
      </div>
    </div>
  );
}

export default function ProbabilityBreakdown({ breakdown }: ProbabilityBreakdownProps) {
  if (!breakdown) return null;

  return (
    <div className="space-y-4">
      {ITEMS.map((item, i) => (
        <Bar
          key={item.key}
          label={item.label}
          score={breakdown[item.key] ?? 0}
          color={item.color}
          delay={i * 120}
        />
      ))}
    </div>
  );
}
