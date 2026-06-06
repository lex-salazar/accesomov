import { useState, useRef, useCallback } from 'react'
import Map, { Source, Layer, Marker } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const API = 'http://localhost:8000'
const INITIAL_VIEW = { longitude: -99.1332, latitude: 19.2954, zoom: 12 }

const COLOR_EXPR = [
  'case',
  ['<=', ['get', 'score_accesibilidad'], 2.5], '#22c55e',
  ['<=', ['get', 'score_accesibilidad'], 3.5], '#eab308',
  ['<=', ['get', 'score_accesibilidad'], 4.5], '#f97316',
  '#ef4444',
]

const MODES = [
  { id: 'walking', icon: '🚶', label: 'Peatón',  profile: 'walking' },
  { id: 'cycling', icon: '🚲', label: 'Ciclista', profile: 'cycling' },
  { id: 'driving', icon: '🚗', label: 'Auto',     profile: 'driving-traffic' },
]

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
      `?proximity=-99.1332,19.2954&country=mx&language=es&limit=5&access_token=${MAPBOX_TOKEN}`
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
  return (await r.json()).routes?.[0] ?? null
}

// Pin visible en el mapa con etiqueta A / B
function MapPin({ letter, color }) {
  return (
    <div className="flex flex-col items-center" style={{ transform: 'translate(-50%, -100%)' }}>
      <div
        className="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: color }}
      >
        {letter}
      </div>
      <div
        className="w-0 h-0"
        style={{
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `7px solid ${color}`,
        }}
      />
    </div>
  )
}

// Input en dos estados: buscando vs confirmado
function PlaceInput({ label, letter, color, state, onChange, onSelect, onClear, debounceRef }) {
  const [open, setOpen] = useState(false)
  const isConfirmed = !!state.coords

  if (isConfirmed) {
    return (
      <div className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-2xl px-4 py-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md"
          style={{ backgroundColor: color }}
        >
          {letter}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-500 leading-none mb-0.5 font-medium">{label}</p>
          <p className="text-sm text-white font-semibold truncate">{state.shortName}</p>
          <p className="text-[10px] text-gray-500 truncate">{state.subtitle}</p>
        </div>
        <button
          onClick={onClear}
          className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-white text-xs transition-colors flex-shrink-0"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 focus-within:border-blue-500 rounded-2xl px-4 py-3 transition-colors">
        <div
          className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ borderColor: color, color }}
        >
          {letter}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-500 leading-none mb-0.5 font-medium">{label}</p>
          <input
            type="text"
            value={state.text}
            onChange={e => {
              onChange(e.target.value)
              setOpen(true)
              clearTimeout(debounceRef.current)
              if (e.target.value.length >= 3) {
                debounceRef.current = setTimeout(async () => {
                  const features = await geocode(e.target.value)
                  onChange(e.target.value, features)
                }, 350)
              } else {
                onChange(e.target.value, [])
              }
            }}
            onFocus={() => state.suggestions.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Escribe una dirección…"
            className="w-full bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
          />
        </div>
        {state.text && (
          <button onClick={onClear} className="text-gray-600 hover:text-gray-300 text-xs transition-colors flex-shrink-0">✕</button>
        )}
      </div>

      {open && state.suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-2 w-full bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          {state.suggestions.map((s, i) => (
            <button
              key={s.id}
              onMouseDown={() => { onSelect(s); setOpen(false) }}
              className="w-full text-left px-4 py-3 hover:bg-gray-800 border-b border-gray-800 last:border-0 transition-colors flex items-start gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-gray-400">📍</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{s.text}</p>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">
                  {s.place_name.split(',').slice(1, 3).join(',')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const EMPTY_PLACE = { text: '', shortName: '', subtitle: '', coords: null, suggestions: [] }

export default function NavigationView({ geojson }) {
  const mapRef    = useRef(null)
  const debounceO = useRef(null)
  const debounceD = useRef(null)

  const [origin, setOrigin] = useState(EMPTY_PLACE)
  const [dest,   setDest]   = useState(EMPTY_PLACE)
  const [mode,   setMode]   = useState('walking')
  const [route,  setRoute]  = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]  = useState(null)

  const selectPlace = useCallback((feature, setter) => {
    setter({
      text:        feature.place_name,
      shortName:   feature.text,
      subtitle:    feature.place_name.split(',').slice(1, 3).join(','),
      coords:      feature.center,
      suggestions: [],
    })
    setRoute(null)
    setResult(null)
    // Fly al punto seleccionado para confirmación visual inmediata
    mapRef.current?.flyTo({ center: feature.center, zoom: 15, duration: 900 })
  }, [])

  const handleChangeOrigin = (text, suggestions) => {
    setOrigin(p => ({ ...p, text, coords: null, suggestions: suggestions ?? p.suggestions }))
  }
  const handleChangeDest = (text, suggestions) => {
    setDest(p => ({ ...p, text, coords: null, suggestions: suggestions ?? p.suggestions }))
  }

  const clearOrigin = () => { setOrigin(EMPTY_PLACE); setRoute(null); setResult(null) }
  const clearDest   = () => { setDest(EMPTY_PLACE);   setRoute(null); setResult(null) }

  const handleRoute = async () => {
    if (!origin.coords || !dest.coords) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const profile = MODES.find(m => m.id === mode).profile
      const mapboxRoute = await fetchRoute(origin.coords, dest.coords, profile)
      if (!mapboxRoute) throw new Error('No se encontró una ruta entre estos puntos.')

      const distKm = mapboxRoute.distance / 1000
      const durMin = Math.round(mapboxRoute.duration / 60)
      const coords = mapboxRoute.geometry.coordinates

      setRoute({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: mapboxRoute.geometry }] })

      const lngs = coords.map(c => c[0])
      const lats = coords.map(c => c[1])
      mapRef.current?.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 80, duration: 1000 }
      )

      const res = await fetch(`${API}/ruta-analisis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: coords, modo: mode, distancia_km: parseFloat(distKm.toFixed(2)), duracion_min: durMin }),
      })
      if (!res.ok) throw new Error(`Error del servidor (${res.status})`)
      const data = await res.json()
      setResult({ ...data, distancia_km: distKm, duracion_min: durMin })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 min-h-0">

      {/* ── Panel izquierdo ── */}
      <aside className="w-[340px] flex-shrink-0 flex flex-col bg-gray-950 border-r border-gray-800/60 overflow-y-auto sidebar-scroll">
        <div className="p-5 space-y-4">

          {/* Header */}
          <div className="pb-1">
            <h2 className="text-base font-bold text-white tracking-tight">Ruta accesible</h2>
            <p className="text-xs text-gray-500 mt-0.5">Planifica un viaje seguro en Tlalpan</p>
          </div>

          {/* Inputs con línea conectora */}
          <div className="relative">
            <PlaceInput
              label="Origen" letter="A" color="#22c55e"
              state={origin}
              onChange={handleChangeOrigin}
              onSelect={f => selectPlace(f, setOrigin)}
              onClear={clearOrigin}
              debounceRef={debounceO}
            />
            {/* Conector vertical */}
            <div className="absolute left-[30px] top-[72px] w-[2px] h-4 bg-gray-700 z-10" />
            <div className="h-3" />
            <PlaceInput
              label="Destino" letter="B" color="#ef4444"
              state={dest}
              onChange={handleChangeDest}
              onSelect={f => selectPlace(f, setDest)}
              onClear={clearDest}
              debounceRef={debounceD}
            />
          </div>

          {/* Modo de transporte */}
          <div className="bg-gray-900 rounded-2xl p-1 flex gap-1">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  mode === m.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="text-sm">{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Botón */}
          <button
            onClick={handleRoute}
            disabled={!origin.coords || !dest.coords || loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <><Spinner /> Calculando ruta…</> : 'Calcular ruta'}
          </button>

          {/* Hint cuando no hay coords */}
          {!origin.coords && !dest.coords && (
            <p className="text-center text-xs text-gray-600">
              Selecciona un origen y destino para comenzar
            </p>
          )}
          {origin.coords && !dest.coords && (
            <p className="text-center text-xs text-gray-500">
              Ahora selecciona el destino
            </p>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Resultados */}
          {result && (
            <div className="space-y-3 pt-1">
              <div className="h-px bg-gray-800" />

              {/* Métricas */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-900 rounded-2xl px-4 py-3 text-center">
                  <p className="text-xl font-bold text-white tabular-nums">{result.distancia_km.toFixed(1)}<span className="text-sm font-normal text-gray-500 ml-1">km</span></p>
                  <p className="text-[10px] text-gray-500 mt-0.5">distancia</p>
                </div>
                <div className="bg-gray-900 rounded-2xl px-4 py-3 text-center">
                  <p className="text-xl font-bold text-white tabular-nums">{result.duracion_min}<span className="text-sm font-normal text-gray-500 ml-1">min</span></p>
                  <p className="text-[10px] text-gray-500 mt-0.5">tiempo estimado</p>
                </div>
              </div>

              {/* Análisis IA */}
              {result.analisis_ia && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center text-sm">♿</div>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Análisis de accesibilidad</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{result.analisis_ia}</p>
                </div>
              )}

              {/* Colonias */}
              {result.colonias.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-1">
                    {result.colonias.length} colonias en la ruta
                  </p>
                  <div className="space-y-1.5">
                    {result.colonias.map(c => (
                      <div key={c.cve_col} className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: scoreColor(c.score_accesibilidad) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium truncate">{c.colonia}</p>
                          <p className="text-[10px] text-gray-500">{c.INFRAPEAT} peatonal</p>
                        </div>
                        <span className="text-xs font-bold tabular-nums" style={{ color: scoreColor(c.score_accesibilidad) }}>
                          {c.score_accesibilidad}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Mapa ── */}
      <div className="flex-1 relative">
        <div style={{ position: 'absolute', inset: 0 }}>
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={INITIAL_VIEW}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            style={{ width: '100%', height: '100%' }}
          >
            {/* Colonias accesibilidad */}
            {geojson && (
              <Source id="colonias" type="geojson" data={geojson}>
                <Layer
                  id="colonias-fill"
                  type="fill"
                  paint={{ 'fill-color': COLOR_EXPR, 'fill-opacity': 0.3 }}
                />
                <Layer
                  id="colonias-outline"
                  type="line"
                  paint={{ 'line-color': 'rgba(255,255,255,0.07)', 'line-width': 0.5 }}
                />
              </Source>
            )}

            {/* Ruta */}
            {route && (
              <Source id="route" type="geojson" data={route}>
                <Layer
                  id="route-glow"
                  type="line"
                  paint={{ 'line-color': '#3b82f6', 'line-width': 14, 'line-blur': 10, 'line-opacity': 0.25 }}
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                />
                <Layer
                  id="route-line"
                  type="line"
                  paint={{ 'line-color': '#60a5fa', 'line-width': 4.5 }}
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                />
              </Source>
            )}

            {/* Pin de origen — aparece apenas se selecciona */}
            {origin.coords && (
              <Marker longitude={origin.coords[0]} latitude={origin.coords[1]}>
                <MapPin letter="A" color="#22c55e" />
              </Marker>
            )}

            {/* Pin de destino — aparece apenas se selecciona */}
            {dest.coords && (
              <Marker longitude={dest.coords[0]} latitude={dest.coords[1]}>
                <MapPin letter="B" color="#ef4444" />
              </Marker>
            )}
          </Map>

          {/* Hint inicial */}
          {!origin.coords && !dest.coords && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="bg-gray-900/85 backdrop-blur-md text-gray-400 text-xs px-4 py-2 rounded-full border border-gray-700/60 whitespace-nowrap shadow-xl">
                Ingresa una dirección de origen para comenzar
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
