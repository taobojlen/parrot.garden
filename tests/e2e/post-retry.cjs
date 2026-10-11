const { createRequire } = require('node:module')
const { readFileSync, readdirSync } = require('node:fs')
const { createHmac } = require('node:crypto')
const { resolve, dirname } = require('node:path')
const assert = require('node:assert/strict')
const wranglerRequire = createRequire(require.resolve('wrangler'))
const { Miniflare, convertV4MiniflareOptions, Response } = wranglerRequire('miniflare')

const feed = 'https://btao.org/notes/feed.xml'
const guid = 'https://btao.org/notes/oKcj21FbYi9r_HRs76Tbb/'
const photo = 'https://images.btao.org/note-images/oKcj21FbYi9r_HRs76Tbb/img_3828.webp'
const text = 'i bought this copy of accelerando for £3 in a charity shop, and it turns out it’s a signed copy!'
const cid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const secret = 'local-test-secret-not-for-production-123456'
const alt = 'photo of the title page of a book: accelerando by charles stross, with his signature'
const bundle = resolve(process.argv[2] ?? '.output/retry-test/index.js')
// Padding exercises the upload byte limit with a small, deterministic image fixture.
const image = process.argv[3]
  ? readFileSync(process.argv[3])
  : Buffer.concat([readFileSync('tests/fixtures/retry-photo.png'), Buffer.alloc(2_000_001)])
const xml = process.argv[4]
  ? readFileSync(process.argv[4])
  : `<rss><channel><item><guid>${guid}</guid><description><![CDATA[<img src="${photo}" alt="${alt}">]]></description></item></channel></rss>`
const uploaded = []
const posts = []
async function outbound(request) {
  const url = request.url
  if (url === feed) return new Response(xml)
  if (url === photo) return new Response(image, { headers: { 'content-type': process.argv[3] ? 'image/webp' : 'image/png' } })
  if (url.includes('/com.atproto.identity.resolveHandle?')) return Response.json({ did: 'did:plc:test' })
  if (url === 'https://plc.directory/did:plc:test') return Response.json({ service: [{ id: '#atproto_pds', serviceEndpoint: 'https://pds.example' }] })
  if (url.endsWith('/com.atproto.server.createSession')) return Response.json({ did: 'did:plc:test', handle: 'btao.org', accessJwt: 'test', refreshJwt: 'test' })
  if (url.endsWith('/com.atproto.repo.uploadBlob')) {
    const bytes = await request.arrayBuffer()
    uploaded.push({ bytes: bytes.byteLength, contentType: request.headers.get('content-type') })
    return Response.json({ blob: { $type: 'blob', ref: { $link: cid }, mimeType: request.headers.get('content-type'), size: bytes.byteLength } })
  }
  if (url.endsWith('/com.atproto.repo.createRecord')) {
    posts.push((await request.json()).record)
    return Response.json({ uri: 'at://did:plc:test/app.bsky.feed.post/1', cid })
  }
  throw new Error(`Unexpected outbound request: ${url}`)
}

async function main() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, scriptPath: bundle, modulesRoot: dirname(bundle),
    compatibilityDate: '2025-07-15', compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'], images: { binding: 'IMAGES' },
    bindings: { NUXT_BETTER_AUTH_URL: 'http://localhost:3000', NUXT_BETTER_AUTH_SECRET: secret },
    outboundService: outbound,
  }))
  try {
    const db = await mf.getD1Database('DB')
    for (const file of readdirSync('server/db/migrations/sqlite').filter(f => f.endsWith('.sql')).sort()) {
      const sql = readFileSync(`server/db/migrations/sqlite/${file}`, 'utf8')
      for (const statement of sql.split('--> statement-breakpoint').flatMap(s => s.split(';')).filter(s => s.trim())) await db.prepare(statement).run()
    }
    const now = Math.floor(Date.now() / 1000)
    await db.prepare('INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind('user', 'Test', 'test@example.com', 1, now, now).run()
    await db.prepare('INSERT INTO session (id,token,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind('session', 'local-token', 'user', now + 3600, now, now).run()
    await db.prepare('INSERT INTO source (id,user_id,name,url,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind('source', 'user', 'Notes', feed, now, now).run()
    await db.prepare('INSERT INTO target (id,user_id,name,type,credentials,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind('target', 'user', 'Bluesky', 'bluesky', JSON.stringify({ handle: 'btao.org', appPassword: 'test', maxCharacters: 300 }), now, now).run()
    await db.prepare('INSERT INTO connection (id,user_id,source_id,target_id,template,include_images,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind('connection', 'user', 'source', 'target', '{{content}}', 1, now, now).run()
    await db.prepare('INSERT INTO post_log (id,connection_id,item_guid,item_content,status,attempts,error,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind('failed-post', 'connection', guid, text, 'failed', 1, 'BlobTooLarge', now).run()
    const signature = createHmac('sha256', secret).update('local-token').digest('base64')
    const response = await mf.dispatchFetch('http://localhost:3000/api/post-log/failed-post/retry', {
      method: 'POST', headers: { cookie: `better-auth.session_token=${encodeURIComponent(`local-token.${signature}`)}`, origin: 'http://localhost:3000' },
    })
    const body = await response.text()
    const state = await db.prepare('SELECT status,error FROM post_log WHERE id=?').bind('failed-post').first()
    console.log(JSON.stringify({ httpStatus: response.status, body, uploaded, posts, state }, null, 2))
    assert.equal(response.status, 200)
    assert.equal(posts.length, 1)
    assert.equal(posts[0].text, text)
    assert.equal(posts[0].embed?.$type, 'app.bsky.embed.images')
    assert.equal(posts[0].embed.images.length, 1)
    assert.equal(posts[0].embed.images[0].alt.trim(), alt)
    assert.equal(uploaded.length, 1)
    assert.equal(uploaded[0].contentType, 'image/webp')
    assert.ok(uploaded[0].bytes > 0)
    assert.ok(uploaded[0].bytes <= 2_000_000)
    assert.equal(state.status, 'posted')
    assert.equal(state.error, null)
    console.log(`PASS: authenticated retry uploaded ${image.length} → ${uploaded[0].bytes} bytes with image embed and alt text`)
  } finally {
    await mf.dispose()
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
