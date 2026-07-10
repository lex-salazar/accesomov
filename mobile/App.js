import { useEffect, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View, ActivityIndicator, Alert, Vibration } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'
import * as FileSystem from 'expo-file-system/legacy'
import * as Speech from 'expo-speech'
import { Audio } from 'expo-av'

const DEV_URL = process.env.EXPO_PUBLIC_FRONTEND_URL ?? 'http://localhost:5173'
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL  ?? 'http://localhost:8000'

export default function App() {
  const [loading, setLoading] = useState(true)
  const webviewRef   = useRef(null)
  const recordingRef = useRef(null)
  const alarmRef     = useRef(null)

  // Configurar audio al iniciar — permite sonido aunque el iPhone esté en silencio
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS:   false,
      staysActiveInBackground: false,
    }).catch(() => {})
  }, [])

  // ── Geolocalización + Brújula ────────────────────────────────────────────
  useEffect(() => {
    let posSub, headingSub
    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return

      // Posición GPS
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      sendToWeb('native-location', {
        lat: initial.coords.latitude,
        lng: initial.coords.longitude,
        heading: initial.coords.heading ?? 0,
      })
      posSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 0, timeInterval: 2000 },
        (loc) => sendToWeb('native-location', {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          heading: loc.coords.heading ?? 0,
        })
      )

      // Brújula — actualiza heading continuamente aunque no te muevas
      headingSub = await Location.watchHeadingAsync((h) => {
        const js = `window.__compass = ${Math.round(h.trueHeading ?? h.magHeading ?? 0)}; true;`
        webviewRef.current?.injectJavaScript(js)
      })
    }
    start()
    return () => { posSub?.remove(); headingSub?.remove() }
  }, [])

  // ── Enviar al WebView — el polling en useVoice.js lee __voiceResult/__voiceError
  const sendToWeb = (type, detail) => {
    let js
    if (type === 'voice-result') {
      js = `window.__voiceResult = ${JSON.stringify(detail.texto || '')}; true;`
    } else if (type === 'voice-error') {
      js = `window.__voiceError = ${JSON.stringify(detail.message || 'Error')}; true;`
    } else {
      // native-location y otros siguen con CustomEvent
      js = `window.dispatchEvent(new CustomEvent('${type}', { detail: ${JSON.stringify(detail)} })); true;`
    }
    webviewRef.current?.injectJavaScript(js)
  }

  // ── Grabación de audio + Whisper ─────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        sendToWeb('voice-error', { message: 'Permiso de micrófono denegado' })
        return
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      recordingRef.current = recording
      sendToWeb('voice-started', {})
    } catch (e) {
      sendToWeb('voice-error', { message: 'No se pudo iniciar el micrófono' })
    }
  }

  const stopRecording = async () => {
    const recording = recordingRef.current
    if (!recording) return
    recordingRef.current = null
    try {
      await recording.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
      const uri = recording.getURI()
      sendToWeb('voice-processing', {})

      // Leer como base64 y enviar como JSON — más fiable que multipart en WebView
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      })

      const res = await fetch(`${BACKEND}/transcribir-b64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_b64: base64, mime: 'audio/m4a' }),
      })

      if (!res.ok) {
        const err = await res.text()
        sendToWeb('voice-error', { message: `Error ${res.status}: ${err}` })
        return
      }

      const data = await res.json()
      const texto = data.texto || ''
      sendToWeb('voice-result', { texto })
    } catch (e) {
      sendToWeb('voice-error', { message: `Error: ${e.message}` })
    }
  }

  // ── Mensajes desde el WebView ────────────────────────────────────────────
  const onMessage = async (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'START_RECORDING') await startRecording()
      if (msg.type === 'STOP_RECORDING')  await stopRecording()
      if (msg.type === 'SPEAK') {
        const text = (msg.text || '').trim()
        if (!text) return
        try {
          // Configurar audio para ignorar silent mode
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            allowsRecordingIOS: false,
          })
          // Descargar MP3 del backend y reproducir con expo-av
          const url = `${BACKEND}/tts?text=${encodeURIComponent(text)}`
          const { sound } = await Audio.Sound.createAsync(
            { uri: url },
            { shouldPlay: true, volume: 1.0 }
          )
          sound.setOnPlaybackStatusUpdate(s => {
            if (s.didJustFinish) sound.unloadAsync()
          })
        } catch (e) {
          // Fallback a expo-speech si el backend no responde
          try { Speech.stop() } catch {}
          Speech.speak(text, { language: 'es-MX', rate: 0.85 })
        }
      }

      if (msg.type === 'STOP_SPEECH') {
        try { Speech.stop() } catch {}
      }

      if (msg.type === 'ALARM_START') {
        if (alarmRef.current) return
        // Vibración pulsante (funciona aunque esté en silencio)
        Vibration.vibrate([0, 400, 200, 400, 200, 400, 200, 400], true)
        // Voz de alerta
        try {
          Speech.speak('Alerta de pánico activada. Solicitar ayuda.', {
            language: 'es-MX', rate: 0.85,
          })
        } catch {}
        alarmRef.current = true
      }

      if (msg.type === 'ALARM_STOP') {
        Vibration.cancel()
        try { Speech.stop() } catch {}
        alarmRef.current = null
      }
    } catch {}
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FF6600" />
        </View>
      )}
      <WebView
        ref={webviewRef}
        source={{ uri: DEV_URL }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        keyboardDisplayRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  webview:   { flex: 1, backgroundColor: '#f2f2f7' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f2f2f7', zIndex: 10,
  },
})
