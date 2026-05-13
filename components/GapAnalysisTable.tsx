'use client';
import type { GapItem } from '@/lib/ai/types';

interface GapAnalysisTableProps {
  items: GapItem[];
}

const STATUS_CONFIG = {
  present: { icon: '✅', label: 'Present',  rowBg: 'rgba(34,197,94,0.06)',  badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
  weak:    { icon: '⚠️', label: 'Weak',     rowBg: 'rgba(234,179,8,0.06)', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  missing: { icon: '❌', label: 'Missing',  rowBg: 'rgba(239,68,68,0.06)', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  expired: { icon: '⏰', label: 'Expired',  rowBg: 'rgba(239,68,68,0.06)', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const SEVERITY_CONFIG = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  major:    'bg-orange-500/20 text-orange-400 border-orange-500/30',
  minor:    'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function GapAnalysisTable({ items }: GapAnalysisTableProps) {
  if (!items?.length) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10">
      {/* Header */}
      <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_2fr_2.5fr] gap-2 bg-white/5 px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-widest">
        <span>Document</span>
        <span>Status</span>
        <span>Severity</span>
        <span>Observed Gap</span>
        <span>Recommendation</span>
      </div>

      {/* Rows */}
      {items.map((item, i) => {
        const sc = STATUS_CONFIG[item.status]   ?? STATUS_CONFIG.missing;
        const sv = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.minor;

        return (
          <div
            key={i}
            className="grid grid-cols-[1.5fr_0.8fr_0.8fr_2fr_2.5fr] gap-2 px-4 py-4 border-t border-white/5 transition-colors duration-150 hover:bg-white/5 items-center"
            style={{ backgroundColor: sc.rowBg }}
          >
            {/* Document name */}
            <span className="text-sm font-medium text-white/90">
              {item.item}
            </span>

            {/* Status badge */}
            <span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${sc.badge}`}>
                {sc.icon} {sc.label}
              </span>
            </span>

            {/* Severity badge */}
            <span>
              {item.severity !== undefined && (
                <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full border ${sv}`}>
                  {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                </span>
              )}
            </span>

            {/* Observed Gap */}
            <span className="text-xs text-red-300/90 leading-relaxed font-medium">
              {item.current_gap ? item.current_gap : <span className="italic text-white/30">None observed</span>}
            </span>

            {/* Recommendation */}
            <span className="text-sm text-white/60 leading-snug">
              {item.recommendation}
            </span>
          </div>
        );
      })}
    </div>
  );
}
