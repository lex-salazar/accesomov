import { forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Map, { Source, Layer, Marker } from 'react-map-gl'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const INITIAL_VIEW = { longitude: -99.1332, latitude: 19.2954, zoom: 12 }

// score ≤2.5 → verde | ≤3.5 → amarillo | ≤4.5 → naranja | >4.5 → rojo
const COLOR_EXPR = [
  'case',
  ['<=', ['get', 'score_accesibilidad'], 2.5], '#22c55e',
  ['<=', ['get', 'score_accesibilidad'], 3.5], '#eab308',
  ['<=', ['get', 'score_accesibilidad'], 4.5], '#f97316',
  '#ef4444',
]

const MapView = forwardRef(function MapView(
  { geojson, selectedCveCol, onColoniaClick, incidents = [], userLocation },
  ref
) {
  const mapRef = useRef(null)
  const [cursor, setCursor] = useState('auto')
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    if (!geojson) return
    setShowHint(true)
    const t = setTimeout(() => setShowHint(false), 2000)
    return () => clearTimeout(t)
  }, [geojson])

  useImperativeHandle(ref, () => ({
    flyTo: (lng, lat) => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1500 })
    },
  }), [])

  const handleClick = useCallback(
    (event) => {
      const feature = event.features?.[0]
      if (feature) onColoniaClick(feature.properties.cve_col)
    },
    [onColoniaClick]
  )

  const handleMouseMove = useCallback((event) => {
    setCursor(event.features?.length > 0 ? 'pointer' : 'auto')
  }, [])

  const handleMouseLeave = useCallback(() => setCursor('auto'), [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={INITIAL_VIEW}
          mapStyle="mapbox://styles/mapbox/light-v11"
          interactiveLayerIds={geojson ? ['colonias-fill'] : []}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          cursor={cursor}
          style={{ width: '100%', height: '100%' }}
        >
          {geojson && (
            <Source id="colonias" type="geojson" data={geojson}>
              {/* Relleno coloreado por score */}
              <Layer
                id="colonias-fill"
                type="fill"
                paint={{
                  'fill-color': COLOR_EXPR,
                  'fill-opacity': 0.7,
                }}
              />
              {/* Borde fino general */}
              <Layer
                id="colonias-outline"
                type="line"
                paint={{
                  'line-color': 'rgba(0,0,0,0.12)',
                  'line-width': 0.5,
                }}
              />
              <Layer
                id="colonias-selected"
                type="line"
                paint={{
                  'line-color': '#FF6600',
                  'line-width': 2.5,
                }}
                filter={['==', ['get', 'cve_col'], selectedCveCol ?? '']}
              />
            </Source>
          )}

          {/* Pins de incidentes reportados */}
          {incidents.map((inc) => (
            <Marker key={inc.id} longitude={inc.lng} latitude={inc.lat}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: inc.color, border: '3px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
                transform: 'translate(-50%,-50%)',
              }}>
                <inc.Icon size={15} color="white" />
              </div>
            </Marker>
          ))}

          {/* Punto de ubicación del usuario */}
          {userLocation && (
            <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
              <div style={{ transform: 'translate(-50%,-50%)', position: 'relative' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#FF6600', border: '3px solid white', boxShadow: '0 2px 8px rgba(255,102,0,0.5)', position: 'relative', zIndex: 1 }} />
                <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'rgba(255,102,0,0.15)', animation: 'pulse 2s infinite' }} />
              </div>
            </Marker>
          )}
        </Map>

        {/* Overlay de carga mientras llega el GeoJSON */}
        {!geojson && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-gray-900/90 rounded-xl px-5 py-3 flex items-center gap-3 text-sm text-gray-300 shadow-xl">
              <svg className="animate-spin h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando colonias…
            </div>
          </div>
        )}

        {/* Hint — aparece 2s y fade out */}
        <AnimatePresence>
          {showHint && !selectedCveCol && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.4 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            >
              <div className="lg-pill text-slate-300 text-xs px-4 py-2 rounded-full whitespace-nowrap">
                Toca una colonia para ver su detalle
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
})

export default MapView
