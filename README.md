# AccesoMov

> Movilidad urbana accesible en Tlalpan, CDMX — mapa de accesibilidad, rutas seguras con IA y reportes ciudadanos en tiempo real.

![Stack](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Stack](https://img.shields.io/badge/FastAPI-Python-009688?style=flat-square&logo=fastapi)
![Stack](https://img.shields.io/badge/Expo-SDK%2054-000020?style=flat-square&logo=expo)
![Stack](https://img.shields.io/badge/Mapbox-GL%20JS-4264FB?style=flat-square&logo=mapbox)
![Stack](https://img.shields.io/badge/Groq-llama3--70b-F55036?style=flat-square)

---

## ¿Qué es AccesoMov?

AccesoMov ayuda a peatones, ciclistas y personas con movilidad reducida a navegar Tlalpan de forma segura. Cruza datos abiertos de infraestructura urbana (banquetas, rampas, ciclovías, iluminación) con un modelo de accesibilidad propio, y los enriquece con análisis de lenguaje natural vía Groq AI.

**Hecho para Hack4Mobility 2025 · CDMX**

---

## Arquitectura

```
accesomov/
├── accesomov/     ← Frontend   (Vite + React + Mapbox GL)
├── back/          ← Backend    (FastAPI + Groq + GeoPandas)
└── mobile/        ← App móvil  (Expo SDK 54 + WebView)
```

---

## Funcionalidades

| Módulo | Descripción |
|---|---|
| Mapa de accesibilidad | 179 colonias de Tlalpan coloreadas por score (verde → rojo) |
| Detalle de colonia | Infraestructura peatonal, ciclista, rampas, iluminación + análisis IA |
| Rutas accesibles | Origen → destino con Mapbox Directions, evaluadas por zonas de riesgo |
| Reportes ciudadanos | Inundación · zona insegura · operativo · tráfico · sin luz · peligro |
| Botón de pánico | Alarma sonora via Web Audio API, activable desde mapa y sidebar |
| Asistente IA | Chat contextual sobre movilidad en Tlalpan (Groq llama3-70b) |
| Datos curiosos | 50 estadísticas rotativas sobre movilidad urbana en CDMX |
| Geolocalización nativa | Coordenadas reales via expo-location → inyectadas al WebView |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Vite · React 18 · Tailwind CSS · Framer Motion |
| Mapas | Mapbox GL JS · Mapbox Directions API · react-map-gl |
| Backend | FastAPI · Python 3.11 · GeoPandas · Shapely |
| IA | Groq API (llama-3.3-70b-versatile) |
| Móvil | Expo SDK 54 · React Native WebView · expo-location |
| Datos | GeoJSON Tlalpan — Datos Abiertos CDMX |

---

## Instalación rápida

### Requisitos previos

- Node.js 18+ y Yarn
- Python 3.11+
- [Expo Go](https://expo.dev/go) en el iPhone (SDK 54)
- Token de [Mapbox](https://mapbox.com) (gratuito)
- API key de [Groq](https://console.groq.com) (gratuita)

---

### Backend

```bash
cd back
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Agregar: GROQ_API_KEY=gsk_...

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> Docs interactivos: `http://localhost:8000/docs`

---

### Frontend

```bash
cd accesomov
yarn install

cp .env.example .env
# Agregar: VITE_MAPBOX_TOKEN=pk.eyJ1...
```

```bash
yarn dev
```

---

### App móvil

```bash
cd mobile
yarn install
```

Editar la IP en `App.js`:
```js
const DEV_URL = 'http://TU_IP_LOCAL:5173'
```

```bash
yarn start
# Escanear QR con Expo Go (misma red WiFi)
```

---

## Variables de entorno

| Archivo | Variable | Descripción |
|---|---|---|
| `back/.env` | `GROQ_API_KEY` | API key de [Groq](https://console.groq.com) |
| `accesomov/.env` | `VITE_MAPBOX_TOKEN` | Token de [Mapbox](https://account.mapbox.com) |
| `accesomov/.env` | `VITE_API_URL` | URL del backend, ej. `http://192.168.0.x:8000` |

En la misma red WiFi (para Expo Go), usa tu IP local en lugar de `localhost`:

```bash
# Obtener tu IP local en Mac
ipconfig getifaddr en0
```

Copia el ejemplo y edita los valores:

```bash
cp accesomov/.env.example accesomov/.env
# Agregar VITE_MAPBOX_TOKEN, VITE_API_URL

cp back/.env.example back/.env
# Agregar GROQ_API_KEY
```

---

## Endpoints del backend

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/colonias` | GeoJSON con todas las colonias y scores |
| `GET` | `/resumen` | Estadísticas generales de accesibilidad |
| `GET` | `/zonas-riesgo` | Top colonias con mayor score de riesgo |
| `GET` | `/colonias/{cve_col}` | Detalle + análisis IA de una colonia |
| `POST` | `/chat` | Chat con asistente de movilidad |
| `POST` | `/ruta-analisis` | Análisis de accesibilidad de una ruta |

---

## Score de accesibilidad

Score del **1 al 5** combinando cuatro indicadores de infraestructura urbana:

| Indicador | Peso |
|---|---|
| Infraestructura peatonal (banquetas, rampas) | 40% |
| Infraestructura ciclista | 25% |
| Iluminación pública | 20% |
| Densidad vial | 15% |

| Score | Color | Interpretación |
|---|---|---|
| ≤ 2.5 | Verde | Buena accesibilidad |
| 2.5 – 3.5 | Amarillo | Accesibilidad media |
| 3.5 – 4.5 | Naranja | Accesibilidad deficiente |
| > 4.5 | Rojo | Accesibilidad crítica |

---

## Cómo funciona la geolocalización en móvil

El WebView de React Native no expone `navigator.geolocation`. La solución:

```
expo-location (nativo)
       ↓  injectJavaScript
   WebView
       ↓  CustomEvent 'native-location'
   React → punto naranja en mapa
```

`mobile/App.js` obtiene las coordenadas y las inyecta:
```js
window.dispatchEvent(new CustomEvent('native-location', { detail: { lat, lng } }))
```

`src/App.jsx` las escucha y actualiza el marcador. En desktop usa `navigator.geolocation` como fallback.

---

## Estructura del frontend

```
src/
├── App.jsx                # Layout, estado global, geolocalización
├── config.js              # URL del backend
├── index.css              # Sistema de diseño (naranja + blanco)
└── components/
    ├── MapView.jsx        # Mapa con capas GeoJSON y pins de incidentes
    ├── NavigationView.jsx # Búsqueda origen/destino y visualización de ruta
    ├── ChatView.jsx       # Asistente IA (sidebar)
    ├── ColoniaDetail.jsx  # Panel de detalle de colonia
    ├── DidYouKnow.jsx     # Carrusel de 50 datos curiosos sobre CDMX
    ├── SidebarStats.jsx   # Estadísticas de accesibilidad
    ├── ZonasRiesgo.jsx    # Lista de colonias con mayor riesgo
    ├── LiquidGlass.jsx    # Filtros SVG y componente LiquidButton
    └── Toast.jsx          # Notificaciones de error
```

---

## Datos utilizados

| Dataset | Fuente |
|---|---|
| Infraestructura peatonal y ciclista por colonia | Instituto de Planeación Democrática y Prospectiva, CDMX |
| Niveles de accesibilidad de infraestructura | Datos Abiertos CDMX |
| Estadísticas de movilidad | TomTom 2024 · SEMOVI 2025 · INEGI · STC Metro |

Los shapefiles originales no se incluyen por tamaño. El GeoJSON procesado (`back/tlalpan_accesibilidad.geojson`) sí está incluido.

---

## Consideraciones éticas

- Datos agregados por colonia — nunca por individuo
- Sin recolección de ubicaciones ni datos de usuarios
- Las descripciones de IA son orientativas, no diagnósticos técnicos
- Zonas periféricas pueden estar subrepresentadas en los datos fuente

---

## Equipo

| Nombre | Rol |
|---|---|
| | |
| | |
| | |

**Hack4Mobility 2025 · Tlalpan, CDMX**
