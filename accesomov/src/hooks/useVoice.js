import { useState, useEffect, useCallback, useRef } from 'react'

export function useVoice(onResult) {
  const [recording, setRecording] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const isRecordingRef = useRef(false)   // fuente de verdad — no depende de eventos nativos
  const onResultRef    = useRef(onResult)

  useEffect(() => { onResultRef.current = onResult }, [onResult])

  // Polling — el nativo deja el resultado en window.__voiceResult
  useEffect(() => {
    const poll = setInterval(() => {
      if (window.__voiceResult !== undefined && window.__voiceResult !== null) {
        const texto = window.__voiceResult
        window.__voiceResult = null
        setLoading(false)
        setRecording(false)
        isRecordingRef.current = false
        if (texto) onResultRef.current(texto)
        else setError('No se entendió, intenta de nuevo')
      }
      if (window.__voiceError) {
        setError(window.__voiceError)
        window.__voiceError = null
        setLoading(false)
        setRecording(false)
        isRecordingRef.current = false
      }
    }, 300)
    return () => clearInterval(poll)
  }, [])

  const start = useCallback(() => {
    if (isRecordingRef.current) return
    setError(null)
    if (!window.ReactNativeWebView) { setError('Voz solo disponible en la app móvil'); return }
    isRecordingRef.current = true
    setRecording(true)
    setLoading(false)
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'START_RECORDING' }))
  }, [])

  const stop = useCallback(() => {
    if (!isRecordingRef.current) return
    isRecordingRef.current = false
    setRecording(false)
    setLoading(true)
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'STOP_RECORDING' }))
  }, [])

  return { recording, loading, error, start, stop }
}
