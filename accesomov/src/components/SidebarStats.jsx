import { motion } from 'framer-motion'
import { TrendingUp, AlertTriangle, MapPin, Activity } from 'lucide-react'

const NIVEL_COLORS = {
  '2-Buena':    '#22c55e',
  '3-Media':    '#eab308',
  '4-Mala':     '#f97316',
  '5-Muy mala': '#ef4444',
}

function Skeleton({ h = 'h-16' }) {
  return <div className={`rounded-2xl animate-pulse ${h}`} style={{ background: '#f2f2f7' }} />
}

function StatCard({ value, label, Icon, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="wz-card p-4 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-2xl font-black tabular-nums" style={{ color }}>{value}</span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#8e8e93' }}>{label}</p>
    </motion.div>
  )
}

export default function SidebarStats({ resumen, loading }) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton h="h-4 w-32" />
        <div className="grid grid-cols-2 gap-2.5">
          <Skeleton /><Skeleton /><Skeleton /><Skeleton />
        </div>
        <Skeleton h="h-32" />
        <Skeleton h="h-20" />
      </div>
    )
  }
  if (!resumen) return null

  const { total_colonias, score_promedio, distribucion_nivel_score, colonias_alto_riesgo, peor_colonia } = resumen

  return (
    <div className="p-4 space-y-3">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
        style={{ color: '#FF6600' }}
      >
        <Activity className="w-3.5 h-3.5" />
        Estadísticas · Tlalpan
      </motion.p>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard value={total_colonias}    label="Colonias"    Icon={MapPin}       color="#00c8b8" delay={0.05} />
        <StatCard value={score_promedio}    label="Score prom." Icon={TrendingUp}    color="#f97316" delay={0.1} />
        <StatCard value={colonias_alto_riesgo} label="En riesgo" Icon={AlertTriangle} color="#ef4444" delay={0.15} />
        <StatCard value={`${Math.round(colonias_alto_riesgo/total_colonias*100)}%`} label="Del total" Icon={Activity} color="#fb923c" delay={0.2} />
      </div>

      {/* Distribución */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="wz-card p-4 space-y-3"
      >
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#8e8e93' }}>Distribución de accesibilidad</p>
        {Object.entries(distribucion_nivel_score).map(([nivel, count], i) => {
          const color = NIVEL_COLORS[nivel] ?? '#6b7280'
          const pct = Math.round((count / total_colonias) * 100)
          const label = nivel.split('-')[1]
          return (
            <div key={nivel}>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs font-semibold text-white">{label}</span>
                <span className="text-xs tabular-nums" style={{ color: '#8e8e93' }}>{count} · {pct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, delay: 0.3 + i * 0.08, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                />
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* Peor colonia */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.55 }}
        className="wz-card p-4"
        style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#ef4444' }}>Peor accesibilidad</p>
        </div>
        <p className="text-sm font-bold text-white leading-tight">{peor_colonia.colonia}</p>
        <p className="text-xs mt-1" style={{ color: '#8e8e93' }}>Score {peor_colonia.score_accesibilidad}/5 · {peor_colonia.INFRAPEAT}</p>
      </motion.div>
    </div>
  )
}
