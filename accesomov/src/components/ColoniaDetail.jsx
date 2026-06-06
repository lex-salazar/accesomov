import { motion } from 'framer-motion'
import { X, Users, ShieldAlert, ShieldCheck, ShieldOff, Shield } from 'lucide-react'

const INFRA = {
  Alta:  { color: '#22c55e', Icon: ShieldCheck,  badge: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
  Media: { color: '#eab308', Icon: Shield,        badge: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.3)' },
  Baja:  { color: '#f97316', Icon: ShieldAlert,   badge: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  Nula:  { color: '#ef4444', Icon: ShieldOff,     badge: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
}

function scoreColor(s) {
  if (s <= 2.5) return '#22c55e'
  if (s <= 3.5) return '#eab308'
  if (s <= 4.5) return '#f97316'
  return '#ef4444'
}

function Skeleton() {
  return (
    <div className="p-5 space-y-3 animate-pulse">
      <div className="flex gap-4 items-start">
        <div className="w-16 h-16 rounded-2xl flex-shrink-0" style={{ background: '#f2f2f7' }} />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 rounded-lg w-48" style={{ background: '#f2f2f7' }} />
          <div className="h-7 rounded-xl w-20" style={{ background: '#f2f2f7' }} />
        </div>
      </div>
      <div className="h-3 rounded" style={{ background: '#f2f2f7' }} />
      <div className="h-3 rounded w-4/5" style={{ background: '#f2f2f7' }} />
    </div>
  )
}

export default function ColoniaDetail({ data, loading, onClose }) {
  const infra = data ? (INFRA[data.INFRAPEAT] ?? INFRA.Nula) : null
  const scoreCol = data ? scoreColor(data.score_accesibilidad) : null

  return (
    <div className="wz-sheet rounded-t-[28px] overflow-hidden">
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
      </div>

      {loading ? <Skeleton /> : data ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="px-5 pb-5 pt-2"
        >
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            {/* Score ring */}
            <div
              className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border-2"
              style={{ borderColor: scoreCol, background: `${scoreCol}12`, boxShadow: `0 0 20px ${scoreCol}30` }}
            >
              <span className="text-xl font-black tabular-nums leading-none" style={{ color: scoreCol }}>{data.score_accesibilidad}</span>
              <span className="text-[9px] font-bold mt-0.5" style={{ color: '#8e8e93' }}>/ 5</span>
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-base font-black text-white leading-tight mb-2">{data.colonia}</h3>
              <div className="flex flex-wrap gap-2">
                {/* Infrapeat badge */}
                <span
                  className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl"
                  style={{ background: infra.badge, border: `1px solid ${infra.border}`, color: infra.color }}
                >
                  <infra.Icon className="w-3 h-3" />
                  {data.INFRAPEAT}
                </span>
                {data.pob_2010 && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                    <Users className="w-3 h-3" />
                    {data.pob_2010.toLocaleString('es-MX')}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#f2f2f7', color: '#8e8e93' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Descripción IA */}
          <div className="wz-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#FF6600' }}>
              Análisis IA
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {data.descripcion_ia}
            </p>
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}
