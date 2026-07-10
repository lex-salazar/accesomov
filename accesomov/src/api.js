import { API } from './config'

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, options)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  colonias:     ()     => request('/colonias'),
  zonasRiesgo:  ()     => request('/zonas-riesgo'),
  colonia:      (cve)  => request(`/colonias/${encodeURIComponent(cve)}`),
  resumen:      ()     => request('/resumen'),
  chat:         (msgs) => request('/chat', json({ messages: msgs })),
  rutaAnalisis: (body) => request('/ruta-analisis', json(body)),
  rutaOsm:      (body) => request('/ruta-osm', json(body)),
  postReporte:  (body) => request('/reportes', json(body)),
  reportes:     ()     => request('/reportes'),
}
