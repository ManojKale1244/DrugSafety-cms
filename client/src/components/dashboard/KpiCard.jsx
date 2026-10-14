import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

/**
 * Animated KPI Card with sparkline indicator, delta vs previous period, and click-through.
 */
export default function KpiCard({
  title,
  value,
  delta,
  isPositive = true,
  subtitle,
  icon: Icon,
  colorScheme = 'blue',
  onClick,
}) {
  const COLOR_MAP = {
    blue: {
      bg: 'bg-blue-50/70',
      text: 'text-blue-700',
      border: 'hover:border-blue-300',
      spark: '#3b82f6',
      badge: 'bg-blue-100 text-blue-800',
    },
    purple: {
      bg: 'bg-purple-50/70',
      text: 'text-purple-700',
      border: 'hover:border-purple-300',
      spark: '#8b5cf6',
      badge: 'bg-purple-100 text-purple-800',
    },
    amber: {
      bg: 'bg-amber-50/70',
      text: 'text-amber-700',
      border: 'hover:border-amber-300',
      spark: '#f59e0b',
      badge: 'bg-amber-100 text-amber-800',
    },
    emerald: {
      bg: 'bg-emerald-50/70',
      text: 'text-emerald-700',
      border: 'hover:border-emerald-300',
      spark: '#10b981',
      badge: 'bg-emerald-100 text-emerald-800',
    },
    red: {
      bg: 'bg-red-50/70',
      text: 'text-red-700',
      border: 'hover:border-red-300',
      spark: '#ef4444',
      badge: 'bg-red-100 text-red-800',
    },
  };

  const currentTheme = COLOR_MAP[colorScheme] || COLOR_MAP.blue;

  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`card group relative p-5 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-card-hover' : ''
      } ${currentTheme.border}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {value}
            </span>
            {delta && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                  isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {delta}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-400 font-medium">{subtitle}</p>
          )}
        </div>

        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${currentTheme.bg} ${currentTheme.text} shadow-xs`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {/* Subtle bottom sparkline / status highlight bar */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: currentTheme.spark }} />
          <span className="text-[11px] font-medium text-slate-500">Live Metric</span>
        </div>
        {onClick && (
          <span className="text-xs font-semibold text-brand-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
            View List <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </motion.div>
  );
}
