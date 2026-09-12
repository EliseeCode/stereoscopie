/**
 * Procedural, seamlessly tileable pattern generators.
 * Every generator returns an ImageData of size x size.
 */

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PALETTES = [
  ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'],
  ['#0b132b', '#1c2541', '#3a506b', '#5bc0be', '#6fffe9'],
  ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0'],
  ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
]

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function makeCanvas(size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

function randomDots(size, seed) {
  const rnd = mulberry32(seed)
  const img = new ImageData(size, size)
  const px = new Uint32Array(img.data.buffer)
  for (let i = 0; i < px.length; i++) {
    px[i] = rnd() < 0.5 ? 0xff000000 : 0xffffffff
  }
  return img
}

function colorNoise(size, seed) {
  const rnd = mulberry32(seed)
  const pal = PALETTES[seed % PALETTES.length].map(hexToRgb)
  const img = new ImageData(size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = pal[Math.floor(rnd() * pal.length)]
    d[i] = r
    d[i + 1] = g
    d[i + 2] = b
    d[i + 3] = 255
  }
  return img
}

function stripes(size, seed) {
  const rnd = mulberry32(seed)
  const pal = PALETTES[seed % PALETTES.length].map(hexToRgb)
  const bands = 4 + Math.floor(rnd() * 4)
  const bandW = size / bands
  const img = new ImageData(size, size)
  const d = img.data
  let i = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = Math.floor((((x + y) % size) + size) % size / bandW) % pal.length
      const [r, g, b] = pal[k]
      d[i++] = r
      d[i++] = g
      d[i++] = b
      d[i++] = 255
    }
  }
  return img
}

function circles(size, seed) {
  const rnd = mulberry32(seed)
  const pal = PALETTES[seed % PALETTES.length]
  const c = makeCanvas(size)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = pal[0]
  ctx.fillRect(0, 0, size, size)
  const n = 3 + Math.floor(rnd() * 2)
  const cell = size / n
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const cx = (gx + 0.5) * cell + (rnd() - 0.5) * cell * 0.5
      const cy = (gy + 0.5) * cell + (rnd() - 0.5) * cell * 0.5
      const r = cell * (0.2 + rnd() * 0.25)
      ctx.fillStyle = pal[1 + Math.floor(rnd() * (pal.length - 1))]
      // Draw at 9 offsets so discs wrap seamlessly across tile edges.
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          ctx.beginPath()
          ctx.arc(cx + ox * size, cy + oy * size, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }
  return ctx.getImageData(0, 0, size, size)
}

function blobs(size, seed) {
  const rnd = mulberry32(seed)
  const pal = PALETTES[seed % PALETTES.length].map(hexToRgb)
  const img = new ImageData(size, size)
  const d = img.data

  // Tileable value noise: random lattice that wraps.
  function lattice(n) {
    const g = new Float32Array(n * n)
    for (let i = 0; i < g.length; i++) g[i] = rnd()
    return (x, y) => g[((y % n) + n) % n * n + ((x % n) + n) % n]
  }
  function sample(get, n, u, v) {
    const fx = u * n
    const fy = v * n
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0
    const sx = tx * tx * (3 - 2 * tx)
    const sy = ty * ty * (3 - 2 * ty)
    const a = get(x0, y0)
    const b = get(x0 + 1, y0)
    const c = get(x0, y0 + 1)
    const e = get(x0 + 1, y0 + 1)
    return (a + (b - a) * sx) * (1 - sy) + (c + (e - c) * sx) * sy
  }
  const l1 = lattice(4)
  const l2 = lattice(8)
  const l3 = lattice(16)

  let i = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const n = 0.5 * sample(l1, 4, u, v) + 0.3 * sample(l2, 8, u, v) + 0.2 * sample(l3, 16, u, v)
      const f = Math.min(pal.length - 1, Math.max(0, n * pal.length))
      const k = Math.floor(f)
      const k2 = Math.min(pal.length - 1, k + 1)
      const t = f - k
      d[i++] = pal[k][0] + (pal[k2][0] - pal[k][0]) * t
      d[i++] = pal[k][1] + (pal[k2][1] - pal[k][1]) * t
      d[i++] = pal[k][2] + (pal[k2][2] - pal[k][2]) * t
      d[i++] = 255
    }
  }
  return img
}

function checker(size, seed) {
  const rnd = mulberry32(seed)
  const pal = PALETTES[seed % PALETTES.length].map(hexToRgb)
  const n = 4 + 2 * Math.floor(rnd() * 3)
  const cell = size / n
  const img = new ImageData(size, size)
  const d = img.data
  let i = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / cell)
      const gy = Math.floor(y / cell)
      // Colour cells pseudo-randomly but deterministically so the tile still wraps.
      const k = (gx * 7 + gy * 13 + ((gx + gy) & 1) * 3) % pal.length
      const [r, g, b] = pal[k]
      d[i++] = r
      d[i++] = g
      d[i++] = b
      d[i++] = 255
    }
  }
  return img
}

export const PATTERNS = [
  { id: 'randomDots', label: 'Random dots (classic)', make: randomDots },
  { id: 'colorNoise', label: 'Colour noise', make: colorNoise },
  { id: 'blobs', label: 'Smooth blobs', make: blobs },
  { id: 'circles', label: 'Tiled circles', make: circles },
  { id: 'stripes', label: 'Diagonal stripes', make: stripes },
  { id: 'checker', label: 'Mosaic tiles', make: checker },
]

export function makePattern(id, size, seed) {
  const p = PATTERNS.find((p) => p.id === id) || PATTERNS[0]
  return p.make(size, seed)
}

/**
 * Turn an uploaded image into a tile of the requested width, keeping aspect ratio.
 * @param {HTMLImageElement} img
 * @param {number} width
 */
export function imageToTile(img, width) {
  const height = Math.max(8, Math.round((width * img.naturalHeight) / img.naturalWidth))
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}
