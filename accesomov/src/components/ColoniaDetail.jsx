import { motion } from 'framer-motion'
import { X, Users, ShieldAlert, ShieldCheck, ShieldOff, Shield } from 'lucide-react'

const INFRA = {
  Alta:  { color: '#16a34a', Icon: ShieldCheck,  badge: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)' },
  Media: { color: '#b45309', Icon: Shield,        badge: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.3)' },
  Baja:  { color: '#c2410c', Icon: ShieldAlert,   badge: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)' },
  Nula:  { color: '#dc2626', Icon: ShieldOff,     badge: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
}

function scoreColor(s) {
  if (s <= 2.5) return '#16a34a'
  if (s <= 3.5) return '#b45309'
  if (s <= 4.5) return '#c2410c'
  return '#dc2626'
}

function Skeleton() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }} className="animate-pulse">
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: '#f2f2f7', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          <div style={{ height: 16, borderRadius: 8, background: '#f2f2f7', width: '70%' }} />
          <div style={{ height: 24, borderRadius: 8, background: '#f2f2f7', width: '40%' }} />
        </div>
      </div>
      <div style={{ height: 12, borderRadius: 6, background: '#f2f2f7' }} />
      <div style={{ height: 12, borderRadius: 6, background: '#f2f2f7', width: '80%' }} />
    </div>
  )
}

export default function ColoniaDetail({ data, loading, onClose }) {
  const infra     = data ? (INFRA[data.INFRAPEAT] ?? INFRA.Nula) : null
  const scoreCol  = data ? scoreColor(data.score_accesibilidad) : null

  return (
    <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', overflow: 'hidden' }}>
      {/* Handle */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 2 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#c7c7cc' }} />
      </div>

      {loading ? <Skeleton /> : data ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
          style={{ padding: '8px 16px 24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            {/* Score */}
            <div style={{
              width: 64, height: 64, borderRadius: 18, flexShrink: 0, border: `2px solid ${scoreCol}`,
              background: `${scoreCol}12`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: scoreCol, lineHeight: 1 }}>{data.score_accesibilidad}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#8e8e93', marginTop: 2 }}>/ 5</span>
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#000', marginBottom: 8, lineHeight: 1.2 }}>{data.colonia}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: infra.badge, border: `1px solid ${infra.border}`, color: infra.color }}>
                  <infra.Icon size={11} />
                  {data.INFRAPEAT}
                </span>
                {data.pob_2010 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: '#f2f2f7', color: '#3c3c43' }}>
                    <Users size={11} />
                    {data.pob_2010.toLocaleString('es-MX')}
                  </span>
                )}
              </div>
            </div>

            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X size={15} color="#8e8e93" />
            </button>
          </div>

          {/* Descripción IA */}
          <div style={{ background: '#fff7ed', borderRadius: 16, padding: 14, border: '1px solid #ffe4cc' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#FF6600', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Análisis IA
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: '#3c3c43' }}>
              {data.descripcion_ia}
            </p>
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}
