declare module 'cloudflare:workers' {
  export const env: {
    IMAGES?: {
      input(stream: ReadableStream<Uint8Array>): {
        transform(options: { width: number; height: number; fit: 'scale-down' }): {
          output(options: { format: 'image/webp'; quality: number; anim: boolean }): Promise<{
            response(): Response
          }>
        }
      }
    }
  }
}
