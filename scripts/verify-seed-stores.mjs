/**
 * Quick sanity check via Chrome CDP (9227): print Dexie store counts for seed data.
 * Prerequisites: http://127.0.0.1:5173 open with --remote-debugging-port=9227
 * Usage: node scripts/verify-seed-stores.mjs
 */
import http from 'http'
import net from 'net'
import crypto from 'crypto'

function getTarget() {
  return new Promise((resolve, reject) => {
    http
      .get('http://127.0.0.1:9227/json', (res) => {
        let b = ''
        res.on('data', (d) => (b += d))
        res.on('end', () => {
          const xs = JSON.parse(b)
          const t = xs.find((x) => x.type === 'page' && x.url.startsWith('http://127.0.0.1:5173'))
          if (!t) reject(new Error('No 5173 page on CDP 9227'))
          else resolve(t)
        })
      })
      .on('error', reject)
  })
}

function evaluate(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl)
    const sock = net.connect(Number(u.port), u.hostname)
    let buf = Buffer.alloc(0)
    let handshaken = false
    let done = false
    const key = crypto.randomBytes(16).toString('base64')
    const send = (obj) => {
      const payload = Buffer.from(JSON.stringify(obj))
      const mask = crypto.randomBytes(4)
      let hdr
      if (payload.length < 126) hdr = Buffer.from([0x81, 0x80 | payload.length])
      else {
        hdr = Buffer.alloc(4)
        hdr[0] = 0x81
        hdr[1] = 0x80 | 126
        hdr.writeUInt16BE(payload.length, 2)
      }
      const enc = Buffer.alloc(payload.length)
      for (let i = 0; i < payload.length; i++) enc[i] = payload[i] ^ mask[i % 4]
      sock.write(Buffer.concat([hdr, mask, enc]))
    }
    sock.on('connect', () => {
      sock.write(
        `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.hostname}:${u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
      )
    })
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      if (!handshaken) {
        const ix = buf.indexOf('\r\n\r\n')
        if (ix < 0) return
        buf = buf.slice(ix + 4)
        handshaken = true
        send({ id: 1, method: 'Runtime.enable' })
        send({
          id: 2,
          method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true },
        })
      }
      while (buf.length >= 2) {
        const b0 = buf[0]
        const b1 = buf[1]
        let len = b1 & 127
        let off = 2
        if (len === 126) {
          if (buf.length < 4) return
          len = buf.readUInt16BE(2)
          off = 4
        }
        if (buf.length < off + len) return
        const p = buf.slice(off, off + len)
        buf = buf.slice(off + len)
        if ((b0 & 15) === 1) {
          const msg = JSON.parse(p.toString())
          if (msg.id === 2) {
            done = true
            sock.end()
            if (msg.error) reject(new Error(JSON.stringify(msg.error)))
            else resolve(msg.result?.result?.value)
          }
        }
      }
    })
    sock.on('error', (e) => {
      if (!done) reject(e)
    })
    setTimeout(() => {
      if (!done) {
        reject(new Error('timeout'))
        sock.destroy()
      }
    }, 15000)
  })
}

const expr = `(() => import('/src/db/database.ts').then(async ({ db }) => ({
  verno: db.verno,
  transactions: await db.transactions.count(),
  accounts: await db.accounts.count(),
  workouts: await db.workouts.count(),
  weeklyPlan: await db.weeklyPlan.count(),
  skillGoals: await db.skillGoals.count(),
  skillStages: await db.skillStages.count(),
  books: await db.books.count(),
  budgets: await db.budgets.count(),
  accountBalances: (await db.accounts.toArray()).map(a => ({ name: a.name, balance: a.balance })),
  skillTitles: (await db.skillGoals.toArray()).map(g => g.title),
})))()`

const t = await getTarget()
const value = await evaluate(t.webSocketDebuggerUrl, expr)
console.log(JSON.stringify(value, null, 2))
const ok =
  value.transactions >= 1 &&
  value.workouts >= 1 &&
  value.skillGoals >= 1 &&
  value.accountBalances.some((a) => a.balance > 0)
if (!ok) {
  console.error('FAIL: expected seeded savings/exercise/skills stores')
  process.exit(1)
}
console.log('OK: stores look seeded')
