// Android FLAG_SECURE: blocks screenshots, screen recording and the
// app-switcher thumbnail while a sensitive screen (seed phrase entry or
// display) is up — see android/.../SecureScreenPlugin.java. No-op off
// native; routes opt in with `meta.secureScreen` (router/index.js).
import { Capacitor, registerPlugin } from '@capacitor/core'

const SecureScreen = registerPlugin('SecureScreen')

export function setSecureScreen(secure) {
  if (Capacitor.getPlatform() !== 'android') return
  SecureScreen.setSecure({ secure: !!secure }).catch(() => {})
}
