import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, X, Search, Mic, Clock,
  Droplets, ShieldAlert, Shield, Car, Zap, Lightbulb,
  AlertTriangle, MessageSquare, Map, Navigation,
  ChevronRight, Siren, HelpCircle, Info,
} from 'lucide-react'
import { API } from './config'
import MapView from './components/MapView'
import ColoniaDetail from './components/ColoniaDetail'
import Toast from './components/Toast'
import ChatView from './components/ChatView'
import NavigationView from './components/NavigationView'
import { GlassFilters } from './components/LiquidGlass'
import DidYouKnow from './components/DidYouKnow'

async function apiFetch(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

const INCIDENTS = [
  { id: 'flood',    Icon: Droplets,    label: 'Inundación',    color: '#3b82f6', bg: '#eff6ff' },
  { id: 'unsafe',   Icon: ShieldAlert, label: 'Zona insegura', color: '#ef4444', bg: '#fef2f2' },
  { id: 'police',   Icon: Shield,      label: 'Operativo',     color: '#6366f1', bg: '#eef2ff' },
  { id: 'traffic',  Icon: Car,         label: 'Tráfico',       color: '#f97316', bg: '#fff7ed' },
  { id: 'power',    Icon: Zap,         label: 'Sin luz',       color: '#eab308', bg: '#fefce8' },
  { id: 'danger',   Icon: AlertTriangle,label:'Peligro',       color: '#dc2626', bg: '#fef2f2' },
]

const MENU_ITEMS = [
  { Icon: Map,          label: 'Mapa de accesibilidad', sub: 'Tlalpan · CDMX' },
  { Icon: Navigation,   label: 'Calcular ruta',          sub: 'Ruta accesible segura' },
  { Icon: MessageSquare,label: 'Asistente IA',           sub: 'Pregunta sobre movilidad', chat: true },
  { Icon: ShieldAlert,  label: 'Zonas de riesgo',        sub: 'Colonias con alto score' },
  { Icon: Info,         label: 'Acerca de AccesoMov',    sub: 'Tlalpan · Hack4Mobility' },
]

/* Genera alarma con Web Audio API */
function createAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    let active = true
    let step = 0

    const playStep = () => {
      if (!active) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sawtooth'
      osc.frequency.value = step % 2 === 0 ? 960 : 720
      gain.gain.setValueAtTime(0.85, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.38)
      step++
      if (active) setTimeout(playStep, 400)
    }
    playStep()
    return () => { active = false; ctx.close() }
  } catch { return () => {} }
}

export default function App() {
  const [geojson, setGeojson]          = useState(null)
  const [zonasRiesgo, setZonasRiesgo]  = useState([])
  const [initialLoading, setInitial]   = useState(true)
  const [selectedCveCol, setSelected]  = useState(null)
  const [coloniaDetail, setDetail]     = useState(null)
  const [detailLoading, setDetailLoad] = useState(false)
  const [toast, setToast]              = useState(null)
  const [mode, setMode]                = useState('home')
  const [sidebarOpen, setSidebar]      = useState(false)
  const [chatOpen, setChatOpen]        = useState(false)
  const [reportOpen, setReport]        = useState(false)
  const [selectedIncident, setIncident]= useState(null)
  const [incidentSent, setIncidentSent]= useState(false)
  const [panicActive, setPanic]        = useState(false)
  const [sheetCollapsed, setSheetCol]  = useState(false)
  const [userLocation, setUserLoc]     = useState(null)
  const [incidentPins, setIncPins]     = useState([])
  const stopAlarm                      = useRef(null)
  const mapRef                         = useRef(null)

  const showToast = useCallback((msg) => setToast(msg), [])

  // Geolocalización — recibe desde Expo nativo via postMessage
  useEffect(() => {
    const handleNative = (e) => {
      const loc = e.detail ?? e.data
      if (!loc?.lat || !loc?.lng) return
      setUserLoc(loc)
      // Solo volar la primera vez
      setUserLoc(prev => {
        if (!prev) mapRef.current?.flyTo(loc.lng, loc.lat)
        return loc
      })
    }
    window.addEventListener('native-location', handleNative)

    // Fallback: navigator.geolocation funciona en browser normal
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setUserLoc(loc)
          mapRef.current?.flyTo(loc.lng, loc.lat)
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      )
    }

    // Si ya hay ubicación nativa previa (inyectada antes del listener)
    if (window.__nativeLocation) handleNative({ detail: window.__nativeLocation })

    return () => window.removeEventListener('native-location', handleNative)
  }, [])

  useEffect(() => {
    Promise.all([
      apiFetch('/colonias'),
      apiFetch('/zonas-riesgo'),
    ])
      .then(([gj, zonas]) => {
        setGeojson(gj)
        setZonasRiesgo(zonas.colonias ?? [])
      })
      .catch(() => showToast('No se pudo conectar con la API.'))
      .finally(() => setInitial(false))
  }, [showToast])

  const handleColoniaClick = useCallback(async (cveCol) => {
    if (cveCol === selectedCveCol && coloniaDetail) return
    setSelected(cveCol); setDetail(null); setDetailLoad(true)
    try {
      const data = await apiFetch(`/colonias/${encodeURIComponent(cveCol)}`)
      setDetail(data)
    } catch (e) { showToast(`Error: ${e.message}`); setSelected(null) }
    finally { setDetailLoad(false) }
  }, [selectedCveCol, coloniaDetail, showToast])

  const closeDetail = useCallback(() => { setSelected(null); setDetail(null) }, [])

  const togglePanic = () => {
    if (panicActive) {
      stopAlarm.current?.()
      stopAlarm.current = null
      setPanic(false)
    } else {
      stopAlarm.current = createAlarm()
      setPanic(true)
    }
  }

  const sendIncident = () => {
    if (!selectedIncident) return
    const inc = INCIDENTS.find(i => i.id === selectedIncident)
    const loc = userLocation ?? { lat: 19.2954, lng: -99.1332 }
    // Offset pequeño aleatorio para que varios reportes no se apilen exactamente
    const pin = {
      id: Date.now(),
      lat: loc.lat + (Math.random() - 0.5) * 0.0004,
      lng: loc.lng + (Math.random() - 0.5) * 0.0004,
      color: inc.color,
      Icon: inc.Icon,
      label: inc.label,
    }
    setIncPins(p => [...p, pin])
    // Volar al pin en el mapa
    mapRef.current?.flyTo(pin.lng, pin.lat)
    setIncidentSent(true)
    setTimeout(() => { setIncidentSent(false); setReport(false); setIncident(null) }, 1800)
  }

  function scoreColor(s) {
    if (s >= 5)   return '#ef4444'
    if (s >= 4.5) return '#f97316'
    return '#fb923c'
  }

  return (
    <div style={{ position: 'relative', height: '100dvh', background: '#f2f2f7', overflow: 'hidden' }}>
      <GlassFilters />

      {/* ── Mapa ── */}
      <div className="absolute inset-0">
        {mode === 'home' ? (
          <MapView ref={mapRef} geojson={geojson} selectedCveCol={selectedCveCol} onColoniaClick={handleColoniaClick} incidents={incidentPins} userLocation={userLocation} />
        ) : (
          <NavigationView geojson={geojson} tabHeight={0} topOffset={0} onBack={() => setMode('home')} userLocation={userLocation} />
        )}
      </div>

      {/* ── Colonia detail ── */}
      <AnimatePresence>
        {mode === 'home' && (selectedCveCol || detailLoading) && (
          <motion.div key="detail" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 40 }}
            style={{ position: 'absolute', left: 0, right: 0, zIndex: 25, bottom: 0, paddingBottom: 'var(--sab)' }}>
            <ColoniaDetail data={coloniaDetail} loading={detailLoading} onClose={closeDetail} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HOME: bottom sheet Waze-style ── */}
      <AnimatePresence>
        {mode === 'home' && !selectedCveCol && !detailLoading && (
          <motion.div
            key="home-sheet"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.4 }}
            onDragEnd={(_, i) => { if (i.offset.y > 80) setSheetCol(true); if (i.offset.y < -40) setSheetCol(false) }}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
              background: '#ffffff', borderRadius: '22px 22px 0 0',
              boxShadow: '0 -2px 20px rgba(0,0,0,0.12)',
              paddingBottom: 'var(--sab)',
              maxHeight: sheetCollapsed ? 52 : '72vh',
              overflow: 'hidden',
              transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Handle */}
            <div onClick={() => setSheetCol(c => !c)} style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 8px', cursor: 'pointer' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#c7c7cc' }} />
            </div>

            <div style={{ padding: '0 16px 16px' }}>
              {/* Search → va a nav */}
              <button onClick={() => setMode('nav')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: '#f2f2f7', borderRadius: 14, padding: '13px 16px', border: 'none', cursor: 'pointer', marginBottom: 14 }}>
                <Search size={18} color="#8e8e93" />
                <span style={{ flex: 1, textAlign: 'left', fontSize: 16, color: '#8e8e93' }}>¿A dónde vas?</span>
                <Mic size={16} color="#c7c7cc" />
              </button>

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button onClick={() => setReport(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#f2f2f7', borderRadius: 12, padding: '12px 14px', border: 'none', cursor: 'pointer' }}>
                  <AlertTriangle size={18} color="#FF6600" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>Reportar</span>
                </button>
                <button
                  onClick={togglePanic}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: panicActive ? '#ef4444' : '#f2f2f7', borderRadius: 12, padding: '12px 14px', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  <Siren size={18} color={panicActive ? '#fff' : '#ef4444'} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: panicActive ? '#fff' : '#ef4444' }}>
                    {panicActive ? 'ACTIVO' : 'Pánico'}
                  </span>
                </button>
              </div>

              {/* Zonas de riesgo */}
              {!initialLoading && zonasRiesgo.length > 0 && (
                <>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#8e8e93', marginBottom: 8 }}>Zonas de riesgo</p>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {zonasRiesgo.slice(0, 4).map((col, i) => (
                      <button key={col.cve_col} onClick={() => mapRef.current?.flyTo(col.centroide.lng, col.centroide.lat)}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px', borderBottom: i < 3 ? '1px solid #f2f2f7' : 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 12, background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Clock size={16} color="#8e8e93" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.colonia}</p>
                          <p style={{ fontSize: 12, color: '#8e8e93', marginTop: 1 }}>Score {col.score_accesibilidad} · {col.INFRAPEAT}</p>
                        </div>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: scoreColor(col.score_accesibilidad), flexShrink: 0, boxShadow: `0 0 6px ${scoreColor(col.score_accesibilidad)}` }} />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Datos curiosos */}
              {!sheetCollapsed && <DidYouKnow />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hamburger FAB top-left ── */}
      {mode === 'home' && !selectedCveCol && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => setSidebar(true)}
          style={{ position: 'absolute', zIndex: 25, top: 'calc(var(--sat) + 14px)', left: 16, width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Menu size={20} color="#000" />
        </motion.button>
      )}

      {/* ── Panic indicator top bar ── */}
      <AnimatePresence>
        {panicActive && (
          <motion.div
            initial={{ y: -60 }} animate={{ y: 0 }} exit={{ y: -60 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, paddingTop: 'calc(var(--sat) + 8px)', paddingBottom: 12, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Siren size={20} color="white" />
              <span style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>ALARMA ACTIVADA</span>
            </div>
            <button onClick={togglePanic} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 10, padding: '6px 14px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Incident report sheet ── */}
      <AnimatePresence>
        {reportOpen && (
          <>
            <motion.div key="rep-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setReport(false); setIncident(null) }}
              style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.35)' }}
            />
            <motion.div key="rep-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 38 }}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 41, background: '#fff', borderRadius: '24px 24px 0 0', paddingBottom: 'var(--sab)', boxShadow: '0 -4px 32px rgba(0,0,0,0.2)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: '#c7c7cc' }} />
              </div>
              <div style={{ padding: '4px 20px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#000' }}>Reportar incidente</p>
                  <button onClick={() => { setReport(false); setIncident(null) }} style={{ width: 32, height: 32, borderRadius: 10, background: '#f2f2f7', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={16} color="#3c3c43" />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                  {INCIDENTS.map(({ id, Icon, label, color, bg }) => (
                    <button key={id} onClick={() => setIncident(id)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px', borderRadius: 16, border: `2px solid ${selectedIncident === id ? color : 'transparent'}`, background: selectedIncident === id ? bg : '#f2f2f7', cursor: 'pointer', transition: 'all 0.15s' }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={22} color={color} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#000', textAlign: 'center' }}>{label}</span>
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {incidentSent ? (
                    <motion.div key="sent" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      style={{ textAlign: 'center', padding: '16px 0', fontSize: 16, fontWeight: 700, color: '#22c55e' }}
                    >
                      Reporte enviado. ¡Gracias!
                    </motion.div>
                  ) : (
                    <motion.button key="send" onClick={sendIncident} disabled={!selectedIncident}
                      style={{ width: '100%', padding: '15px 0', borderRadius: 14, background: selectedIncident ? '#FF6600' : '#e5e5ea', color: selectedIncident ? '#fff' : '#aeaeb2', fontSize: 15, fontWeight: 800, border: 'none', cursor: selectedIncident ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}
                    >
                      Enviar reporte
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Sidebar menú (hamburger) ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div key="sb-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebar(false)}
              style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div key="sb-panel" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.85 }}
              style={{ position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 41, width: '78%', maxWidth: 320, background: '#fff', display: 'flex', flexDirection: 'column', paddingTop: 'var(--sat)', boxShadow: '8px 0 40px rgba(0,0,0,0.2)' }}
            >
              {/* Header */}
              <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f2f2f7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: '#FF6600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Map size={22} color="white" />
                  </div>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#000', letterSpacing: '-0.03em' }}>AccesoMov</p>
                    <p style={{ fontSize: 12, color: '#8e8e93', marginTop: 1 }}>Tlalpan · CDMX</p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }} className="thin-scroll">
                {MENU_ITEMS.map(({ Icon, label, sub, chat }) => (
                  <button key={label}
                    onClick={() => { setSidebar(false); if (chat) setChatOpen(true) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff7ed', border: '1px solid #ffe4cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color="#FF6600" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#000' }}>{label}</p>
                      <p style={{ fontSize: 12, color: '#8e8e93', marginTop: 1 }}>{sub}</p>
                    </div>
                    <ChevronRight size={16} color="#c7c7cc" />
                  </button>
                ))}
              </div>

              {/* Panic button en sidebar */}
              <div style={{ padding: '16px 20px', paddingBottom: 'calc(var(--sab) + 16px)', borderTop: '1px solid #f2f2f7' }}>
                <button onClick={() => { setSidebar(false); togglePanic() }}
                  style={{ width: '100%', padding: '15px 0', borderRadius: 14, background: panicActive ? '#ef4444' : '#fff0f0', border: `2px solid ${panicActive ? '#ef4444' : '#fca5a5'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <Siren size={20} color={panicActive ? '#fff' : '#ef4444'} />
                  <span style={{ fontSize: 15, fontWeight: 800, color: panicActive ? '#fff' : '#ef4444' }}>
                    {panicActive ? 'Desactivar alarma' : 'Botón de pánico'}
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Chat sidebar ── */}
      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div key="chat-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
              style={{ position: 'absolute', inset: 0, zIndex: 42, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
            />
            <motion.div key="chat-panel" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.85 }}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 43, width: '88%', maxWidth: 400, background: '#fff', display: 'flex', flexDirection: 'column', paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)', boxShadow: '-8px 0 40px rgba(0,0,0,0.2)', borderLeft: '1px solid #f2f2f7' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f2f2f7', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: '#fff7ed', border: '1px solid #ffe4cc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={18} color="#FF6600" />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#000' }}>Asistente IA</p>
                    <p style={{ fontSize: 11, color: '#FF6600', fontWeight: 600 }}>Movilidad · Tlalpan</p>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} style={{ width: 36, height: 36, borderRadius: 10, background: '#f2f2f7', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={16} color="#3c3c43" />
                </button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <ChatView sidebar />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
