// Resolves once the browser has painted the current DOM. Await it right
// before long synchronous work (SDK init, wallet load, unlock) so the loader
// is actually on screen, and its compositor-driven animation already running,
// before the main thread is tied up. The timeout covers hidden pages, where
// requestAnimationFrame doesn't fire.
export function nextPaint() {
  return new Promise((resolve) => {
    const fallback = setTimeout(resolve, 100)
    requestAnimationFrame(() => setTimeout(() => { clearTimeout(fallback); resolve() }, 0))
  })
}
