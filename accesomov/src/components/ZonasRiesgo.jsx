import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, AlertOctagon, MapPin } from 'lucide-react'

function scoreColor(s) {
  if (s >= 5)   return '#ef4444'
  if (s >= 4.5) return '#f97316'
  return '#fb923c'
}

export default function ZonasRiesgo({ colonias, loading, onSelect }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="px-4 pb-4">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3"
      >
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4" style={{ color: '#ef4444' }} />
          <span className="text-sm font-bold text-white">Zonas de riesgo</span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            {loading ? '…' : colonias.length}
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4" style={{ color: '#aeaeb2' }} />
          : <ChevronDown className="w-4 h-4" style={{ color: '#aeaeb2' }} />
        }
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden space-y-2"
          >
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: '#f2f2f7', animationDelay: `${i*60}ms` }} />
                ))
              : colonias.map((col, i) => (
                  <motion.button
                    key={col.cve_col}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.025 }}
                    onClick={() => onSelect(col.centroide.lng, col.centroide.lat)}
                    className="w-full wz-card flex items-center gap-3 px-4 py-3 text-left active:scale-[0.98] transition-transform"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${scoreColor(col.score_accesibilidad)}18`, border: `1px solid ${scoreColor(col.score_accesibilidad)}35` }}
                    >
                      <MapPin className="w-4 h-4" style={{ color: scoreColor(col.score_accesibilidad) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate leading-tight">{col.colonia}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#8e8e93' }}>{col.INFRAPEAT} peatonal</p>
                    </div>
                    <span className="text-base font-black tabular-nums flex-shrink-0" style={{ color: scoreColor(col.score_accesibilidad) }}>
                      {col.score_accesibilidad}
                    </span>
                  </motion.button>
                ))
            }
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
