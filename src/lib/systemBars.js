// Android status bar / navigation bar colours (native NavigationBar plugin —
// see android/.../NavigationBarPlugin.java). No-ops off native.
//
// The bars are painted to match whatever page is on screen rather than a
// fixed per-theme colour: pages don't all share one background (most are
// gray-50, a few are white), and a fixed colour leaves a visible band
// against the ones it doesn't match.
import { Capacitor, registerPlugin } from '@capacitor/core'

const SystemBars = registerPlugin('NavigationBar')

export function setSystemBarColors(color, { darkIcons }) {
  if (!Capacitor.isNativePlatform()) return
  SystemBars.setStatusBarColor({ color, darkIcons }).catch(() => {})
  SystemBars.setColor({ color, darkButtons: darkIcons }).catch(() => {})
}

// Computed colours can come back in any CSS colour space (Tailwind's palette
// is oklch), so let a canvas do the conversion to sRGB bytes.
let ctx = null
function toRgba(cssColor) {
  ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = cssColor
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  return { r, g, b, a }
}

/** First fully opaque background colour at or above `el`, or null. */
function opaqueBackground(el) {
  for (let node = el; node; node = node.parentElement) {
    const c = toRgba(getComputedStyle(node).backgroundColor)
    if (c.a === 255) return c
  }
  return null
}

// An OS light/dark switch makes Capacitor repaint the area behind the bars
// with the OS theme's colour, even when the app's own theme didn't change.
if (Capacitor.isNativePlatform()) {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => setTimeout(syncSystemBarsToPage, 350))
}

/**
 * Paints both bars with the current page's background (the routed view's
 * root element, see App.vue's [data-scroll-root]) and picks dark or light
 * icons from how bright that colour is.
 */
export function syncSystemBarsToPage() {
  if (!Capacitor.isNativePlatform()) return
  const view = document.querySelector('[data-scroll-root]')?.firstElementChild
  const bg = opaqueBackground(view ?? document.getElementById('app'))
  if (!bg) return
  const hex = '#' + [bg.r, bg.g, bg.b].map((v) => v.toString(16).padStart(2, '0')).join('')
  const brightness = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b
  setSystemBarColors(hex, { darkIcons: brightness > 150 })
}
