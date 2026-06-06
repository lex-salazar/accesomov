import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, ChevronRight } from 'lucide-react'

const FACTS = [
  { text: 'La CDMX es la ciudad con mayor congestión vehicular del mundo según TomTom 2024.', source: 'TomTom 2024' },
  { text: 'Un conductor promedio en CDMX pierde 152 horas al año en tráfico — equivalente a 19 jornadas laborales.', source: 'TomTom 2024' },
  { text: 'Todo trayecto en CDMX se alarga en promedio un 52% frente a flujo normal. Un viaje de 30 min se convierte en 45.', source: 'TomTom 2024' },
  { text: 'Recorrer 10 km en CDMX tarda en promedio 32 minutos, a solo 18.8 km/h.', source: 'TomTom 2024' },
  { text: 'Una persona que vive y trabaja en CDMX invierte al menos 82 minutos diarios en transportarse.', source: 'SEMOVI 2025' },
  { text: 'Si vives en CDMX pero trabajas en zona conurbada, ese tiempo sube a 175 minutos al día, casi 3 horas.', source: 'SEMOVI 2025' },
  { text: 'El tráfico de CDMX genera 983 kg de CO₂ al año por persona, equivalente a llenar el tanque 8 veces.', source: 'UNAM Global' },
  { text: 'El Metro de CDMX transportó más de 1,171 millones de usuarios en 2024.', source: 'STC Metro 2024' },
  { text: 'La Línea 2 del Metro es la más usada de CDMX, con un promedio de 581,000 pasajeros diarios.', source: 'STC Metro 2024' },
  { text: 'El 65% de los estudiantes universitarios de CDMX tarda entre 30 minutos y 2 horas para llegar a clases.', source: 'INEGI / Máspormás' },
  { text: 'El tiempo de traslado promedio de jóvenes universitarios en CDMX es de 74 minutos; el 36% usa dos medios de transporte.', source: 'Gaceta CCH, UNAM' },
  { text: 'En 2024 murieron 533 personas por hechos de tránsito en CDMX, el nivel más alto desde 2019.', source: 'SEMOVI' },
  { text: 'El 71% de las víctimas mortales por siniestros viales en CDMX tienen entre 18 y 45 años.', source: 'SEMOVI 2025' },
  { text: 'Una bicicleta emite apenas 2.2 g de CO₂ por km, incluyendo su fabricación.', source: 'ConBici 2024' },
  { text: 'Un auto urbano emite entre 100 y 120 g de CO₂ por km, hasta 54 veces más que una bici.', source: 'ConBici 2024' },
  { text: 'Reemplazar 3 km diarios en auto por bicicleta elimina aproximadamente 300 kg de CO₂ al año.', source: 'PNUMA' },
  { text: 'El transporte aporta el 45% de las emisiones totales de CO₂ en la Zona Metropolitana del Valle de México.', source: 'SEDEMA 2020' },
  { text: 'Solo el 62.6% de las calles en CDMX tienen banquetas; apenas el 23.3% tiene rampas.', source: 'El Universal / INEGI' },
  { text: 'El 80% del espacio vial en CDMX se destina a vehículos; solo el 20-30% a banquetas y zonas peatonales.', source: 'CoRe Ciudades Vivibles' },
  { text: 'Hasta 2023, solo el 21% de las estaciones del Metro de CDMX eran accesibles para personas en silla de ruedas.', source: 'Nexos / Pacto Federal 2023' },
  { text: 'En 2024, Ecobici alcanzó un récord de 22.2 millones de viajes anuales y más de 188,000 usuarios.', source: 'Expansión Obras 2026' },
  { text: 'La red ciclista de CDMX ha crecido a más de 535 km de infraestructura con 9,300 bicicletas.', source: 'El Congresista MX 2026' },
  { text: 'Para 2050, el 66% de la población mundial vivirá en zonas urbanas, haciendo urgente la movilidad inteligente.', source: 'ONU / Adm. Pública Digital 2024' },
  { text: 'En Ámsterdam se usa IA con datos ciudadanos para detectar barreras de accesibilidad en calles.', source: 'Amsterdam Intelligence 2024' },
  { text: 'El uso de IA en movilidad urbana puede reducir en un 80% los costos de recopilación de datos.', source: 'BID / Cuantico 2025' },
]

export default function DidYouKnow() {
  const [index, setIndex] = useState(0)
  const [dir, setDir]     = useState(1)

  useEffect(() => {
    const id = setInterval(() => {
      setDir(1)
      setIndex(i => (i + 1) % FACTS.length)
    }, 6000)
    return () => clearInterval(id)
  }, [])

  const next = () => { setDir(1);  setIndex(i => (i + 1) % FACTS.length) }
  const fact = FACTS[index]

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #f2f2f7', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Lightbulb size={13} color="#FF6600" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#FF6600', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          ¿Sabías que…?
        </span>
        <span style={{ fontSize: 11, color: '#c7c7cc', marginLeft: 'auto' }}>{index + 1}/{FACTS.length}</span>
      </div>

      <div
        style={{ background: '#fff7ed', borderRadius: 14, padding: '12px 14px', border: '1px solid #ffe4cc', cursor: 'pointer', minHeight: 72, position: 'relative', overflow: 'hidden' }}
        onClick={next}
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={index}
            custom={dir}
            initial={{ opacity: 0, x: dir * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1c1c1e', lineHeight: 1.5, marginBottom: 6 }}>
              {fact.text}
            </p>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#FF6600' }}>
              Fuente: {fact.source}
            </p>
          </motion.div>
        </AnimatePresence>

        <ChevronRight size={14} color="#ffa366" style={{ position: 'absolute', bottom: 12, right: 12 }} />
      </div>
    </div>
  )
}
