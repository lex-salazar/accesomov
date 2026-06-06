import { useState, useEffect, useRef, useCallback } from 'react'
import MapView from './components/MapView'
import SidebarStats from './components/SidebarStats'
import ZonasRiesgo from './components/ZonasRiesgo'
import ColoniaDetail from './components/ColoniaDetail'
import Toast from './components/Toast'
import ChatView from './components/ChatView'
import NavigationView from './components/NavigationView'

const API = 'http://localhost:8000'

const LEGEND = [
  { label: 'Buena',    color: '#22c55e' },
  { label: 'Media',    color: '#eab308' },
  { label: 'Mala',     color: '#f97316' },
  { label: 'Muy mala', color: '#ef4444' },
]

async function apiFetch(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export default function App() {
  const [geojson, setGeojson]           = useState(null)
  const [resumen, setResumen]           = useState(null)
  const [zonasRiesgo, setZonasRiesgo]   = useState([])
  const [initialLoading, setInitial]    = useState(true)

  const [selectedCveCol, setSelected]   = useState(null)
  const [coloniaDetail, setDetail]      = useState(null)
  const [detailLoading, setDetailLoad]  = useState(false)

  const [toast, setToast]               = useState(null)
  const [view, setView]                 = useState('map')   // 'map' | 'chat'
  const mapRef                          = useRef(null)

  const showToast = useCallback((msg) => setToast(msg), [])

  // Carga inicial: tres endpoints en paralelo
  useEffect(() => {
    Promise.all([
      apiFetch('/colonias'),
      apiFetch('/resumen'),
      apiFetch('/zonas-riesgo'),
    ])
      .then(([gj, res, zonas]) => {
        setGeojson(gj)
        setResumen(res)
        setZonasRiesgo(zonas.colonias ?? [])
      })
      .catch(() =>
        showToast(
          'No se pudo conectar con la API en localhost:8000. ¿Está corriendo el backend?'
        )
      )
      .finally(() => setInitial(false))
  }, [showToast])

  // Click en un polígono del mapa → carga detalle con descripción IA
  const handleColoniaClick = useCallback(
    async (cveCol) => {
      if (cveCol === selectedCveCol && coloniaDetail) return
      setSelected(cveCol)
      setDetail(null)
      setDetailLoad(true)
      try {
        const data = await apiFetch(`/colonias/${encodeURIComponent(cveCol)}`)
        setDetail(data)
      } catch (e) {
        showToast(`Error al cargar el detalle: ${e.message}`)
        setSelected(null)
      } finally {
        setDetailLoad(false)
      }
    },
    [selectedCveCol, coloniaDetail, showToast]
  )

  // Click en zonas de riesgo → flyTo en el mapa
  const flyTo = useCallback((lng, lat) => {
    mapRef.current?.flyTo(lng, lat)
  }, [])

  const closeDetail = useCallback(() => {
    setSelected(null)
    setDetail(null)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 bg-gray-900 border-b border-gray-800">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="text-xl">♿</span>
          <div>
            <h1 className="text-sm font-bold leading-none tracking-wide">AccesoMov</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Accesibilidad urbana · Tlalpan, CDMX
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-gray-800 p-0.5 gap-0.5">
          {[
            { id: 'map',  label: 'Mapa' },
            { id: 'nav',  label: 'Navegación' },
            { id: 'chat', label: 'Asistente' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                view === id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Leyenda (solo en vista mapa) */}
        {view === 'map' ? (
          <div className="flex items-center gap-4">
            {LEGEND.map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
            <span className="text-xs text-gray-600 ml-1">1=mejor</span>
          </div>
        ) : (
          <div className="w-48" /> /* spacer para centrar los tabs */
        )}
      </header>

      {/* ── Cuerpo ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {view === 'map' ? (
          <>
            {/* Sidebar izquierdo */}
            <aside className="w-72 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 overflow-hidden">
              <SidebarStats resumen={resumen} loading={initialLoading} />
              <ZonasRiesgo
                colonias={zonasRiesgo}
                loading={initialLoading}
                onSelect={flyTo}
              />
            </aside>

            {/* Área del mapa + panel de detalle */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <MapView
                ref={mapRef}
                geojson={geojson}
                selectedCveCol={selectedCveCol}
                onColoniaClick={handleColoniaClick}
              />
              {(selectedCveCol || detailLoading) && (
                <ColoniaDetail
                  data={coloniaDetail}
                  loading={detailLoading}
                  onClose={closeDetail}
                />
              )}
            </div>
          </>
        ) : view === 'nav' ? (
          /* Vista navegación */
          <NavigationView geojson={geojson} />
        ) : (
          /* Vista chat */
          <div className="flex flex-1 min-h-0 bg-gray-950">
            <ChatView />
          </div>
        )}
      </div>

      {/* Toast de error */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
