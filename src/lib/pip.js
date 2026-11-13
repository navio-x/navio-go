// Android picture-in-picture: the app shrinks into a small floating window
// that stays on top of other apps, and App.vue shows PipTicker (pairs and
// live prices) in place of the normal UI while `pipActive` is set — see
// android/.../PipPlugin.java. The WebView keeps running in that window, so
// the price socket stays live. Android 8+ only; everywhere else
// `pipSupported` stays false and the entry point isn't shown.
import { ref, watch, onUnmounted } from 'vue'
import { Capacitor, registerPlugin } from '@capacitor/core'

const Pip = registerPlugin('Pip')

export const pipSupported = ref(false)
// Android 12+: the window can also open by itself (setPipAutoEnter).
export const pipAutoSupported = ref(false)
export const pipActive = ref(false)

/**
 * How PipTicker lays out `rows` pairs, in abstract units: the content box
 * is `w` × `h` units and PipTicker scales the unit so that box always fits
 * the window, whatever size the system or the user gives it. The system
 * picks the window's size from the aspect ratio alone and a wide, short
 * window ends up large, so few pairs are stacked (pair and change above the
 * price) in a compact, squarish window instead of sitting in one or two
 * wide rows; four or more use one line each.
 */
export function pipLayout(rows) {
  const n = Math.max(1, rows)
  if (n <= 3) {
    const h = n * 44 + 8
    // Never wider than 4:3: a lone pair would otherwise ask for a banner.
    return { stacked: true, w: 100, h, ratioW: Math.round(Math.min(100, h * 4 / 3)), ratioH: h }
  }
  const h = n * 15 + 6
  return { stacked: false, w: 100, h, ratioW: 100, ratioH: h }
}

if (Capacitor.getPlatform() === 'android') {
  Pip.isSupported()
    .then(({ supported, autoEnter }) => {
      pipSupported.value = !!supported
      pipAutoSupported.value = !!autoEnter
    })
    .catch(() => {})
  // Guarded like the other listeners: addListener has been seen to throw on
  // some Android/Capacitor builds.
  try {
    Promise.resolve(Pip.addListener('pipChange', ({ active }) => { pipActive.value = !!active })).catch(() => {})
  } catch (e) {
    console.error('[pip] listener unavailable:', e)
  }
}

/** Shrinks the app into the floating window, sized for `rows` ticker rows. Resolves false when the system refuses. */
export async function enterPip(rows) {
  if (!pipSupported.value) return false
  try {
    const { ratioW, ratioH } = pipLayout(rows)
    await Pip.enter({ width: ratioW, height: ratioH })
    return true
  } catch (e) {
    console.error('[pip] enter failed:', e)
    return false
  }
}

// How many mounted screens are showing the markets list right now; App.vue
// turns it (with the route and the lock state) into setPipAutoEnter().
export const pipMarketsOnScreen = ref(0)

/** For a component with a markets list: counts it in while `visible` is true and it is mounted. */
export function usePipMarketsOnScreen(visible) {
  let counted = false
  const set = (on) => {
    if (on === counted) return
    counted = on
    pipMarketsOnScreen.value += on ? 1 : -1
  }
  watch(visible, (v) => set(!!v), { immediate: true })
  onUnmounted(() => set(false))
}

/**
 * Android 12+: with `rows` > 0, leaving the app (home gesture or button)
 * shrinks it into the floating window by itself, sized for that many rows;
 * 0 turns that off. A no-op on older Android, where only enterPip() works.
 */
let lastAuto = 0
export function setPipAutoEnter(rows) {
  if (!pipSupported.value || rows === lastAuto) return
  lastAuto = rows
  const { ratioW, ratioH } = pipLayout(rows)
  Pip.setAutoEnter({ enabled: rows > 0, width: ratioW, height: ratioH })
    .catch((e) => console.error('[pip] auto-enter update failed:', e))
}
