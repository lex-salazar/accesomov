import { useEffect, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'

const DEV_URL = 'http://10.48.226.195:5173'

export default function App() {
  const [loading, setLoading] = useState(true)
  const webviewRef = useRef(null)

  useEffect(() => {
    let subscription

    const startLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return

      // Enviar ubicación inicial
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      sendLocation(initial.coords)

      // Seguir actualizando en tiempo real
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
        (loc) => sendLocation(loc.coords)
      )
    }

    startLocation()
    return () => subscription?.remove()
  }, [])

  const sendLocation = (coords) => {
    const js = `
      window.__nativeLocation = { lat: ${coords.latitude}, lng: ${coords.longitude} };
      window.dispatchEvent(new CustomEvent('native-location', { detail: window.__nativeLocation }));
      true;
    `
    webviewRef.current?.injectJavaScript(js)
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
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        keyboardDisplayRequiresUserAction={false}
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
