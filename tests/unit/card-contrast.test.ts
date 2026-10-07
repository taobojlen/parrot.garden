import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('app/assets/css/main.css', 'utf8')
const colors = Object.fromEntries([...css.matchAll(/--color-([\w-]+):\s*#([\da-f]{6})/gi)]
  .map(([, name, hex]) => [name, hex.match(/../g)!.map(channel => parseInt(channel, 16))]))

function luminance(rgb: number[]) {
  return rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0)
}

describe('glass card text contrast', () => {
  it('uses light default and toned text for Nuxt UI components on dark surfaces', () => {
    expect(css).toMatch(/--ui-text:\s*var\(--color-pale-sky\)/)
    expect(css).toMatch(/--ui-text-toned:\s*var\(--color-pale-sky\)/)
  })

  const files = [
    'pages/dashboard.vue', 'pages/login.vue', 'pages/log.vue',
    'pages/sources/[id].vue', 'pages/targets/[id].vue',
    'components/TemplatePreview.vue', 'components/ConfirmModal.vue',
  ]

  it.each(files)('%s keeps secondary text at WCAG AA contrast over a bright image', (file) => {
    const alpha = Number(css.match(/\.bg-default\s*\{[^}]*?background-color:\s*rgba\(0, 0, 0, ([\d.]+)\)/)![1])
    // White is the brightest possible image. Include the white/10 row hover overlay.
    const background = 255 * (1 - alpha) * 0.9 + 255 * 0.1
    const source = readFileSync(`app/${file}`, 'utf8')
    const classes = [...source.matchAll(/text-(sky-reflection|pale-sky|muted)(?:\/(\d+))?/g)]
    expect(classes.length).toBeGreaterThan(0)
    for (const [className, color, opacity] of classes) {
      const rgb = colors[color === 'muted' ? 'pale-sky' : color]!
      const textAlpha = opacity ? Number(opacity) / 100 : 1
      const foreground = rgb.map(channel => channel * textAlpha + background * (1 - textAlpha))
      const ratio = (luminance(foreground) + 0.05) / (luminance([background, background, background]) + 0.05)
      expect(ratio, className).toBeGreaterThanOrEqual(4.5)
    }
  })
})
