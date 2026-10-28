// Generates public/icon-192.png and public/icon-512.png without dependencies.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}

// distance from point to segment
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const r = size * 0.22 // corner radius
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4
      // rounded-square mask
      const cx = Math.min(Math.max(x, r), size - r)
      const cy = Math.min(Math.max(y, r), size - r)
      const inside = Math.hypot(x - cx, y - cy) <= r
      // gradient violet -> blue
      const t = (x + y) / (2 * size)
      let R = 95 + (42 - 95) * t, G = 101 + (138 - 101) * t, B = 176 + (126 - 176) * t
      // white check mark
      const u = x / size, v = y / size
      const d = Math.min(
        segDist(u, v, 0.3, 0.52, 0.44, 0.66),
        segDist(u, v, 0.44, 0.66, 0.72, 0.36),
      )
      if (d < 0.055) { R = G = B = 255 }
      raw[i] = R; raw[i + 1] = G; raw[i + 2] = B; raw[i + 3] = inside ? 255 : 0
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
for (const s of [192, 512]) writeFileSync(`public/icon-${s}.png`, makePng(s))
console.log('icons written')
