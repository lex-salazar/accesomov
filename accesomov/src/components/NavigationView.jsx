import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PersonStanding, Bike, Car, MapPin, X, Navigation,
  Accessibility, Loader2, ArrowLeft, Search,
  ShieldCheck, ShieldAlert, Clock, Route as RouteIcon, ArrowRight,
  Leaf,
} from 'lucide-react'
import Map, { Source, Layer, Marker } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { API } from '../config'
import { LiquidButton } from './LiquidGlass'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const INITIAL_VIEW = { longitude: -99.1332, latitude: 19.2954, zoom: 12 }

const COLOR_EXPR = [
  'case',
  ['<=', ['get', 'score_accesibilidad'], 2.5], '#22c55e',
  ['<=', ['get', 'score_accesibilidad'], 3.5], '#eab308',
  ['<=', ['get', 'score_accesibilidad'], 4.5], '#f97316',
  '#ef4444',
]

const MODES = [
  { id: 'walking', Icon: PersonStanding, label: 'Peatón',   profile: 'walking' },
  { id: 'cycling', Icon: Bike,           label: 'Ciclista', profile: 'cycling' },
  { id: 'driving', Icon: Car,            label: 'Auto',     profile: 'driving-traffic' },
]

const SUGGESTIONS = [
  'Centro de Tlalpan', 'Pedregal de San Ángel',
  'Ciudad Universitaria', 'San Pedro Mártir', 'Coapa',
]

function formatDuration(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function routeSafety(colonias) {
  if (!colonias?.length) return null
  const avg = colonias.reduce((s, c) => s + c.score_accesibilidad, 0) / colonias.length
  if (avg <= 2.5) return { label: 'Muy segura',   color: '#22c55e', Icon: ShieldCheck }
  if (avg <= 3.5) return { label: 'Segura',        color: '#16a34a', Icon: ShieldCheck }
  if (avg <= 4.2) return { label: 'Moderada',      color: '#d97706', Icon: ShieldAlert }
  return             { label: 'Con riesgos',     color: '#ef4444', Icon: ShieldAlert }
}

function scoreColor(s) {
  if (s <= 2.5) return '#22c55e'
  if (s <= 3.5) return '#eab308'
  if (s <= 4.5) return '#f97316'
  return '#ef4444'
}

async function geocode(q) {
  if (q.length < 3) return []
  try {
    const r = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
      `?proximity=-99.1332,19.2954&country=mx&language=es&limit=6&access_token=${MAPBOX_TOKEN}`
    )
    return (await r.json()).features ?? []
  } catch { return [] }
}

async function fetchRoute(origin, dest, profile) {
  const r = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
    `${origin[0]},${origin[1]};${dest[0]},${dest[1]}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
  )
  if (!r.ok) throw new Error(`Error ${r.status}`)
  const d = await r.json()
  if (!d.routes?.length) throw new Error('Sin ruta disponible.')
  return d.routes[0]
}

function RoutePin({ letter, color }) {
  return (
    <div style={{ transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: color, border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 900, boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
        {letter}
      </div>
      <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `9px solid ${color}` }} />
    </div>
  )
}

function SearchScreen({ label, letter, color, onConfirm, onBack }) {
  const [text, setText] = useState('')
  const [results, setRes] = useState([])
  const [busy, setBusy] = useState(false)
  const debounce = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  const onChange = (val) => {
    setText(val)
    clearTimeout(debounce.current)
    if (val.length >= 3) {
      setBusy(true)
      debounce.current = setTimeout(async () => { setRes(await geocode(val)); setBusy(false) }, 320)
    } else { setRes([]) }
  }

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 360, damping: 38 }}
      style={{ position: 'absolute', inset: 0, zIndex: 100, background: '#fff', display: 'flex', flexDirection: 'column', paddingTop: 'var(--sat)' }}
    >
      <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ width: 42, height: 42, borderRadius: 14, background: '#f2f2f7', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
          <ArrowLeft size={18} color="#000" />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: '#f2f2f7', borderRadius: 14, border: `2px solid ${color}`, height: 48 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
            {letter}
          </div>
          <input ref={inputRef} value={text} onChange={e => onChange(e.target.value)}
            placeholder={`¿${label}?`}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#000', fontSize: 16, fontFamily: 'inherit' }}
          />
          {text && <button onClick={() => { setText(''); setRes([]) }} style={{ cursor: 'pointer', background: 'none', border: 'none' }}><X size={16} color="#8e8e93" /></button>}
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '12px 0 0' }} />

      <div style={{ flex: 1, overflowY: 'auto' }} className="thin-scroll">
        {busy && <div style={{ display: 'flex', justifyContent: 'center', padding: 28 }}><Loader2 size={22} color="#FF6600" className="animate-spin" /></div>}

        {results.map((s, i) => (
          <motion.button key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: i * 0.04 }}
            onClick={() => onConfirm(s)}
            style={{ width: '100%', textAlign: 'left', padding: '13px 20px', display: 'flex', gap: 14, alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', background: '#fff', border: 'none' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff7ed', border: '1px solid #ffe4cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={16} color="#FF6600" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.text}</p>
              <p style={{ fontSize: 12, color: '#8e8e93', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.place_name.split(',').slice(1, 3).join(',')}</p>
            </div>
          </motion.button>
        ))}

        {!busy && text.length >= 3 && results.length === 0 && (
          <p style={{ textAlign: 'center', color: '#8e8e93', fontSize: 14, padding: 28 }}>Sin resultados para "{text}"</p>
        )}

        {text.length < 3 && (
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Lugares en Tlalpan</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => onChange(s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f2f2f7', borderRadius: 14, textAlign: 'left', cursor: 'pointer', border: 'none' }}
                >
                  <Search size={15} color="#8e8e93" />
                  <span style={{ fontSize: 14, color: '#000', fontWeight: 500 }}>{s}</span>
                  <ArrowRight size={13} color="#c7c7cc" style={{ marginLeft: 'auto' }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

const EMPTY = { shortName: '', coords: null }

// 'mapbox' = ruta rápida (morada) | 'osm' = ruta accesible OSM (verde)
const ROUTE_ENGINES = [
  { id: 'osm',    label: 'Accesible',  sublabel: 'OSM + score', color: '#16a34a', Icon: Leaf },
  { id: 'mapbox', label: 'Rápida',     sublabel: 'Mapbox',      color: '#6c5ce7', Icon: RouteIcon },
]

export default function NavigationView({ geojson, tabHeight = 68, topOffset = 0, onBack, userLocation }) {
  const mapRef = useRef(null)
  const [origin,  setOrigin]  = useState(EMPTY)
  const [dest,    setDest]    = useState(EMPTY)
  const [mode,    setMode]    = useState('walking')
  const [engine,  setEngine]  = useState('osm')
  const [route,   setRoute]   = useState(null)
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [search,  setSearch]  = useState(null)

  const routeColor = ROUTE_ENGINES.find(e => e.id === engine)?.color ?? '#6c5ce7'

  const handleRoute = async () => {
    if (!origin.coords || !dest.coords) return
    setLoading(true); setResult(null); setError(null)
    try {
      let routeGeom, distKm, durMin, colonias, analisis_ia

      if (engine === 'osm') {
        // Ruta accesible via OSMnx
        const res = await fetch(`${API}/ruta-osm`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin_lat: origin.coords[1], origin_lng: origin.coords[0],
            dest_lat:   dest.coords[1],   dest_lng:   dest.coords[0],
            modo: mode,
          }),
        })
        if (!res.ok) throw new Error(`Error OSM ${res.status}: ${await res.text()}`)
        const data = await res.json()
        routeGeom = data.geometry
        distKm    = data.properties.distancia_km
        durMin    = data.properties.duracion_min
        colonias  = data.properties.colonias
        analisis_ia = data.properties.analisis_ia
      } else {
        // Ruta rápida via Mapbox Directions
        const profile = MODES.find(m => m.id === mode).profile
        const r = await fetchRoute(origin.coords, dest.coords, profile)
        routeGeom = r.geometry
        distKm    = r.distance / 1000
        durMin    = Math.round(r.duration / 60)
        const res = await fetch(`${API}/ruta-analisis`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates: routeGeom.coordinates, modo: mode, distancia_km: parseFloat(distKm.toFixed(2)), duracion_min: durMin }),
        })
        const data = await res.json()
        colonias    = data.colonias
        analisis_ia = data.analisis_ia
      }

      setRoute({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: routeGeom }] })
      setResult({ colonias, analisis_ia, distancia_km: distKm, duracion_min: durMin })

      const coords = routeGeom.coordinates
      const lngs = coords.map(c => c[0]), lats = coords.map(c => c[1])
      mapRef.current?.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: 130, bottom: 260, left: 36, right: 36 }, duration: 1200 }
      )
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const cancelRoute = () => { setRoute(null); setResult(null); setError(null) }
  const hasRoute = !!result
  const safety = hasRoute ? routeSafety(result.colonias) : null
  const safeTop = topOffset > 0 ? `${topOffset}px` : 'calc(var(--sat) + 10px)'

  return (
    <div style={{ position: 'absolute', inset: 0 }}>

      <Map ref={mapRef} mapboxAccessToken={MAPBOX_TOKEN} initialViewState={INITIAL_VIEW}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
      >
        {geojson && (
          <Source id="colonias" type="geojson" data={geojson}>
            <Layer id="colonias-fill"    type="fill" paint={{ 'fill-color': COLOR_EXPR, 'fill-opacity': 0.35 }} />
            <Layer id="colonias-outline" type="line" paint={{ 'line-color': 'rgba(0,0,0,0.1)', 'line-width': 0.5 }} />
          </Source>
        )}
        {route && (
          <Source id="route" type="geojson" data={route}>
            <Layer id="route-case" type="line"
              paint={{ 'line-color': routeColor, 'line-width': 13, 'line-opacity': 0.35 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer id="route-fill" type="line"
              paint={{ 'line-color': routeColor, 'line-width': 9 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </Source>
        )}
        {origin.coords && <Marker longitude={origin.coords[0]} latitude={origin.coords[1]}><RoutePin letter="A" color="#22c55e" /></Marker>}
        {dest.coords   && <Marker longitude={dest.coords[0]}   latitude={dest.coords[1]}><RoutePin letter="B" color="#ef4444" /></Marker>}

        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
            <div style={{ transform: 'translate(-50%,-50%)', position: 'relative' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#FF6600', border: '3px solid white', boxShadow: '0 2px 8px rgba(255,102,0,0.5)', position: 'relative', zIndex: 1 }} />
              <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'rgba(255,102,0,0.15)', animation: 'pulse 2s infinite' }} />
            </div>
          </Marker>
        )}
      </Map>

      {onBack && (
        <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.88 }}
          onClick={onBack}
          style={{ position: 'absolute', zIndex: 25, top: 'calc(var(--sat) + 14px)', left: 16, width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={20} color="#000" />
        </motion.button>
      )}

      <AnimatePresence>
        {!hasRoute && (
          <motion.div
            initial={{ y: -70, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -70, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 38 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingTop: safeTop, paddingLeft: onBack ? 72 : 0, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
          >
            <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => setSearch('origin')}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: '#f2f2f7', borderRadius: 14, border: `1px solid ${origin.coords ? 'rgba(34,197,94,0.6)' : 'rgba(0,0,0,0.08)'}`, textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>A</div>
                <span style={{ flex: 1, fontSize: 15, color: origin.coords ? '#000' : '#aeaeb2', fontWeight: origin.coords ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {origin.shortName || '¿Dónde empiezas?'}
                </span>
                {origin.coords && <button onPointerDown={e => { e.stopPropagation(); setOrigin(EMPTY); cancelRoute() }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} color="#8e8e93" /></button>}
              </button>
              <div style={{ paddingLeft: 22 }}><div style={{ width: 2, height: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 1 }} /></div>
              <button onClick={() => setSearch('dest')}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: '#f2f2f7', borderRadius: 14, border: `1px solid ${dest.coords ? 'rgba(239,68,68,0.6)' : 'rgba(0,0,0,0.08)'}`, textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>B</div>
                <span style={{ flex: 1, fontSize: 15, color: dest.coords ? '#000' : '#aeaeb2', fontWeight: dest.coords ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dest.shortName || '¿A dónde vas?'}
                </span>
                {dest.coords && <button onPointerDown={e => { e.stopPropagation(); setDest(EMPTY); cancelRoute() }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} color="#8e8e93" /></button>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasRoute && (
          <motion.div
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 38 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingTop: 'var(--sat)', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: '#fff7ed', border: '1px solid #ffe4cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Navigation size={18} color="#FF6600" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Llegando a</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dest.shortName}</p>
              </div>
              {safety && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, background: `${safety.color}18`, border: `1px solid ${safety.color}40`, flexShrink: 0 }}>
                  <safety.Icon size={12} color={safety.color} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: safety.color }}>{safety.label}</span>
                </div>
              )}
              <button onClick={cancelRoute} style={{ width: 36, height: 36, borderRadius: 12, background: '#fef2f2', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={15} color="#ef4444" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }}
        style={{ position: 'absolute', left: 0, right: 0, zIndex: 20, bottom: `calc(var(--sab) + ${tabHeight}px)`, background: '#fff', borderTop: '1px solid rgba(0,0,0,0.08)', borderRadius: '24px 24px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.1)', maxHeight: hasRoute ? '54vh' : 'auto', overflowY: hasRoute ? 'auto' : 'visible' }}
        className="thin-scroll"
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#c7c7cc' }} />
        </div>

        <div style={{ padding: '4px 16px 20px' }}>
          {!hasRoute ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Selector de engine: OSM accesible vs Mapbox rápida */}
              <div style={{ display: 'flex', gap: 8 }}>
                {ROUTE_ENGINES.map(eng => (
                  <button key={eng.id} onClick={() => setEngine(eng.id)}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 8px', borderRadius: 14, cursor: 'pointer', border: `2px solid ${engine === eng.id ? eng.color : 'rgba(0,0,0,0.08)'}`, background: engine === eng.id ? `${eng.color}12` : '#f2f2f7', transition: 'all 0.15s' }}
                  >
                    <eng.Icon size={18} color={engine === eng.id ? eng.color : '#8e8e93'} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: engine === eng.id ? eng.color : '#8e8e93' }}>{eng.label}</span>
                    <span style={{ fontSize: 10, color: '#aeaeb2' }}>{eng.sublabel}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6, padding: 4, background: '#f2f2f7', borderRadius: 18, border: '1px solid rgba(0,0,0,0.06)' }}>
                {MODES.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 10, paddingBottom: 10, borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: mode === m.id ? '#fff' : '#8e8e93', overflow: 'hidden', border: 'none', background: 'transparent' }}
                  >
                    {mode === m.id && (
                      <motion.div layoutId="mode-bg" style={{ position: 'absolute', inset: 0, borderRadius: 14, background: '#FF6600', boxShadow: '0 4px 12px rgba(255,102,0,0.35)' }} transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
                    )}
                    <m.Icon size={18} style={{ position: 'relative', zIndex: 1 }} />
                    <span style={{ position: 'relative', zIndex: 1 }}>{m.label}</span>
                  </button>
                ))}
              </div>

              <LiquidButton onClick={handleRoute} disabled={!origin.coords || !dest.coords || loading}
                style={{ width: '100%', padding: '15px 0', fontSize: 15, fontWeight: 800, background: (!origin.coords || !dest.coords || loading) ? '#e5e5ea' : '#FF6600', color: (!origin.coords || !dest.coords || loading) ? '#aeaeb2' : '#fff' }}
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Calculando…</> : <><RouteIcon size={17} /> Calcular ruta accesible</>}
              </LiquidButton>

              {error && <p style={{ fontSize: 13, color: '#ef4444', padding: '10px 14px', background: '#fef2f2', borderRadius: 14, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}

              {!origin.coords && (
                <p style={{ textAlign: 'center', fontSize: 13, color: '#8e8e93', fontWeight: 500 }}>Toca los campos de arriba para buscar origen y destino</p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, background: '#f2f2f7', borderRadius: 18, padding: '14px 16px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: '#000', letterSpacing: '-0.04em', lineHeight: 1 }}>{formatDuration(result.duracion_min)}</span>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>Tiempo estimado</p>
                </div>
                <div style={{ flex: 1, background: '#f2f2f7', borderRadius: 18, padding: '14px 16px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: '#000', letterSpacing: '-0.04em', lineHeight: 1 }}>{result.distancia_km.toFixed(1)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#8e8e93' }}>km</span>
                  </div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>Distancia</p>
                </div>
              </div>

              {safety && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: `${safety.color}0e`, borderRadius: 16, border: `1px solid ${safety.color}25` }}>
                  <safety.Icon size={18} color={safety.color} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: safety.color }}>Ruta {safety.label}</p>
                    <p style={{ fontSize: 11, color: '#8e8e93', marginTop: 1 }}>Basado en scores de accesibilidad</p>
                  </div>
                </div>
              )}

              {result.analisis_ia && (
                <div style={{ background: '#fff7ed', borderRadius: 18, padding: 14, border: '1px solid #ffe4cc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff7ed', border: '1px solid #ffe4cc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Accessibility size={13} color="#FF6600" />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#FF6600', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Análisis de accesibilidad</span>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: '#3c3c43' }}>{result.analisis_ia}</p>
                </div>
              )}

              {result.colonias?.length > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{result.colonias.length} colonias en la ruta</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {result.colonias.map(c => (
                      <div key={c.cve_col} style={{ background: '#f2f2f7', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, backgroundColor: scoreColor(c.score_accesibilidad), boxShadow: `0 0 6px ${scoreColor(c.score_accesibilidad)}` }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.colonia}</p>
                          <p style={{ fontSize: 11, color: '#8e8e93' }}>{c.INFRAPEAT} peatonal</p>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 900, color: scoreColor(c.score_accesibilidad), flexShrink: 0 }}>{c.score_accesibilidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={cancelRoute} style={{ width: '100%', padding: '13px 0', borderRadius: 14, background: '#f2f2f7', color: '#3c3c43', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(0,0,0,0.08)' }}>
                Nueva ruta
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {search === 'origin' && (
          <SearchScreen key="so" label="Origen" letter="A" color="#22c55e"
            onBack={() => setSearch(null)}
            onConfirm={s => { setOrigin({ shortName: s.text, coords: s.center }); mapRef.current?.flyTo({ center: s.center, zoom: 14, duration: 800 }); setSearch(null) }}
          />
        )}
        {search === 'dest' && (
          <SearchScreen key="sd" label="Destino" letter="B" color="#ef4444"
            onBack={() => setSearch(null)}
            onConfirm={s => { setDest({ shortName: s.text, coords: s.center }); mapRef.current?.flyTo({ center: s.center, zoom: 14, duration: 800 }); setSearch(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
