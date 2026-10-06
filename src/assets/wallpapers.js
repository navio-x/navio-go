import privacyDark    from './wallpapers/privacy-dark.svg?url'
import privacyLight   from './wallpapers/privacy-light.svg?url'
import cypherpunkDark from './wallpapers/cypherpunk-dark.svg?url'
import cypherpunkLight from './wallpapers/cypherpunk-light.svg?url'
import minimalDark    from './wallpapers/minimal-dark.svg?url'
import minimalLight   from './wallpapers/minimal-light.svg?url'

// `dark`/`light` are CSS background-image values; null means "no image".
// `className` is for a wallpaper that's drawn by a stylesheet rule instead
// (see .bg in WalletBalance.vue).
export const wallpapers = [
  {
    // No wallpaper at all — just the page's own background colour.
    id: 'default',
    label: 'Default',
    previewDark:  'linear-gradient(#1f2630, #1f2630)',
    previewLight: 'linear-gradient(#f9fafb, #f9fafb)',
    dark:  null,
    light: null,
  },
  {
    id: 'blocks',
    label: 'Blocks',
    previewDark:  'linear-gradient(135deg, #1f2630 0%, #272f3a 100%)',
    previewLight: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
    dark:  null,
    light: null,
    className: 'bg',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    previewDark:  'linear-gradient(135deg, #060d1f 0%, #1a1040 100%)',
    previewLight: 'linear-gradient(135deg, #eef2ff 0%, #dde6ff 100%)',
    dark:  `url("${privacyDark}")`,
    light: `url("${privacyLight}")`,
  },
  {
    id: 'cypherpunk',
    label: 'Cypherpunk',
    previewDark:  'linear-gradient(135deg, #020a02 0%, #071407 100%)',
    previewLight: 'linear-gradient(135deg, #f0fff4 0%, #ddfbe8 100%)',
    dark:  `url("${cypherpunkDark}")`,
    light: `url("${cypherpunkLight}")`,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    previewDark:  'linear-gradient(160deg, #12182b 0%, #0d1117 100%)',
    previewLight: 'linear-gradient(160deg, #ffffff 0%, #f0f4f8 100%)',
    dark:  `url("${minimalDark}")`,
    light: `url("${minimalLight}")`,
  },
]
