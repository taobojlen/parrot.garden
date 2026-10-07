import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadConfig() {
  vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
  return (await import('../../nuxt.config')).default
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('PostHog error tracking', () => {
  it('enables client and server exception capture', async () => {
    const config = await loadConfig()
    expect(config.modules).toContain('@posthog/nuxt')
    expect(config.posthogConfig.clientConfig).toMatchObject({
      api_host: 'https://ph.btao.org',
      defaults: '2026-01-30',
      capture_exceptions: true,
    })
    expect(config.posthogConfig.serverConfig.enableExceptionAutocapture).toBe(true)
  })

  it('keeps source-map credentials build-only and enables upload when configured', async () => {
    vi.stubEnv('POSTHOG_CLI_API_KEY', 'test-build-only-key')
    vi.stubEnv('POSTHOG_CLI_PROJECT_ID', '12345')
    vi.stubEnv('POSTHOG_CLI_HOST', 'https://eu.posthog.com')
    const config = await loadConfig()
    expect(config.posthogConfig.host).toBe('https://eu.posthog.com')
    expect(config.posthogConfig.sourcemaps).toMatchObject({
      enabled: true,
      personalApiKey: 'test-build-only-key',
      projectId: '12345',
    })
    expect(JSON.stringify(config.runtimeConfig)).not.toContain('test-build-only-key')
    expect(config.sourcemap.client).toBe('hidden')
    expect(config.nitro.rollupConfig.output.sourcemapExcludeSources).toBe(false)
  })

  it('builds without source-map upload credentials', async () => {
    vi.stubEnv('POSTHOG_CLI_API_KEY', '')
    vi.stubEnv('POSTHOG_CLI_PROJECT_ID', '')
    const config = await loadConfig()
    expect(config.posthogConfig.sourcemaps.enabled).toBe(false)
  })
})
