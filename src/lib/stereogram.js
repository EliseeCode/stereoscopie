/**
 * Single-image random-dot / textured autostereogram generator.
 *
 * Implements the algorithm from Thimbleby, Inglis & Witten,
 * "Displaying 3D Images: Algorithms for Single Image Random Dot Stereograms"
 * (IEEE Computer, 1994), including optional hidden-surface removal.
 *
 * Depth convention: Float32Array, one value per pixel, row-major.
 *   0 = far plane (background), 1 = nearest point.
 *
 * Geometry: with E the eye separation in pixels and mu the depth-of-field
 * factor, the on-screen separation for depth z is
 *   sep(z) = (1 - mu z) E / (2 - mu z)
 * so sep(0) = E/2 and sep(1) = E (1 - mu) / (2 - mu).
 * We choose E = 2 * tileWidth so that the far plane repeats exactly on the
 * tile period, and derive mu from the requested depth strength.
 *
 * Depth values are quantised to 8 bits (they come from an 8-bit render
 * target anyway), which lets us precompute separation and ray slope tables.
 */

const LEVELS = 256
const INV = 1 / (LEVELS - 1)
const sepTable = new Int32Array(LEVELS)
const slopeTable = new Float32Array(LEVELS) // zt = z + slope * t
const tMaxTable = new Int32Array(LEVELS)    // iterations until zt >= 1
let tableKey = ''

function buildTables(E, mu) {
  const key = E + ':' + mu
  if (key === tableKey) return
  tableKey = key
  for (let i = 0; i < LEVELS; i++) {
    const z = i / (LEVELS - 1)
    sepTable[i] = Math.round(((1 - mu * z) * E) / (2 - mu * z))
    const slope = (2 * (2 - mu * z)) / (mu * E)
    slopeTable[i] = slope
    tMaxTable[i] = Math.max(1, Math.ceil((1 - z) / slope))
  }
}

/**
 * @param {Float32Array} depth  w*h values in [0,1]
 * @param {number} w
 * @param {number} h
 * @param {ImageData} tile      repeating texture (any size)
 * @param {object} opts
 * @param {number}  opts.depthStrength   0..1, ratio by which the nearest separation shrinks (default 0.35)
 * @param {boolean} opts.crossEyed       invert depth for cross-eyed viewing
 * @param {boolean} opts.hiddenSurface   run the visibility test (default true)
 * @param {boolean} opts.anchorCentre    seed the pattern from the centre (default) or the right edge
 * @param {ImageData} [opts.out]         reusable output buffer (must be w*h)
 * @returns {ImageData}
 */
export function generateStereogram(depth, w, h, tile, opts = {}) {
  const {
    depthStrength = 0.35,
    crossEyed = false,
    hiddenSurface = true,
    anchorCentre = true,
  } = opts

  const out = opts.out && opts.out.width === w && opts.out.height === h
    ? opts.out
    : new ImageData(w, h)

  const scratch = getScratch(w)
  const { same, zi, zrow, raised, root, seedX } = scratch
  const centre = w >> 1

  const tileW = tile.width
  const tileH = tile.height
  const pix = new Uint32Array(out.data.buffer)
  const tilePix = new Uint32Array(tile.data.buffer)

  // E = 2 * tileW gives sep(0) = tileW exactly.
  const E = 2 * tileW
  // depthStrength d -> near/far ratio r = 1 - d = 2(1-mu)/(2-mu)  =>  mu = 2d/(1+d)
  const d = Math.min(0.95, Math.max(0.01, depthStrength))
  const mu = (2 * d) / (1 + d)
  buildTables(E, mu)

  const BIG = 1 << 30

  for (let y = 0; y < h; y++) {
    const row = y * w

    // Quantised, optionally inverted depth for this row, plus the row minimum.
    let zmin = LEVELS
    let zmax = -1
    for (let x = 0; x < w; x++) {
      let q = (depth[row + x] * (LEVELS - 1) + 0.5) | 0
      if (crossEyed) q = LEVELS - 1 - q
      zi[x] = q
      zrow[x] = q * INV
      if (q < zmin) zmin = q
      if (q > zmax) zmax = q
      same[x] = x
    }
    // A flat row has nothing to occlude anything.
    const testOcclusion = hiddenSurface && zmax > zmin

    // Distance to the nearest pixel that rises above the row's floor level.
    // Floor-level pixels can never occlude, so a pixel with no raised
    // neighbour within reach is trivially visible.
    if (testOcclusion) {
      let last = -BIG
      for (let x = 0; x < w; x++) {
        if (zi[x] > zmin) last = x
        raised[x] = x - last
      }
      last = BIG
      for (let x = w - 1; x >= 0; x--) {
        if (zi[x] > zmin) last = x
        const dr = last - x
        if (dr < raised[x]) raised[x] = dr
      }
    }

    for (let x = 0; x < w; x++) {
      const q = zi[x]
      const sep = sepTable[q]
      let left = x - (sep >> 1)
      let right = left + sep
      if (left < 0 || right >= w) continue

      if (testOcclusion) {
        const tMax = tMaxTable[q]
        if (raised[x] <= tMax) {
          const z = zrow[x]
          const slope = slopeTable[q]
          const lim = Math.min(tMax, x, w - 1 - x)
          let visible = true
          for (let t = 1; t <= lim; t++) {
            const zt = z + slope * t
            if (zrow[x - t] >= zt || zrow[x + t] >= zt) {
              visible = false
              break
            }
          }
          if (!visible) continue
        }
      }

      // Union the two pixels, keeping chains ordered left -> right.
      let l = same[left]
      while (l !== left && l !== right) {
        if (l < right) {
          left = l
          l = same[left]
        } else {
          same[left] = right
          left = right
          l = same[left]
          right = l
        }
      }
      same[left] = right
    }

    // Resolve each chain to its rightmost member (root).
    for (let x = w - 1; x >= 0; x--) {
      const s = same[x]
      root[x] = s === x ? x : root[s]
    }

    // Anchor column: the background pixel nearest the image centre (or the
    // right edge in classic mode). Each chain is seeded by its last member at
    // or before the anchor, so the tile's phase is continuous on both sides
    // and the object's distortions spread outward symmetrically. Anchoring on
    // background matters: on the object the local period differs from the
    // tile width, and an anchor there would draw a seam down that column.
    let anchor = w - 1
    if (anchorCentre) {
      anchor = centre
      for (let i = 0; i < w; i++) {
        const x = i & 1 ? centre - ((i + 1) >> 1) : centre + (i >> 1)
        if (x < 0 || x >= w) continue
        if (zi[x] === zmin) {
          anchor = x
          break
        }
      }
    }
    for (let x = 0; x < w; x++) seedX[x] = -1
    for (let x = 0; x < w; x++) {
      const r = root[x]
      if (x <= anchor) seedX[r] = x
      else if (seedX[r] < 0) seedX[r] = x
    }
    const ty = (y % tileH) * tileW
    for (let x = 0; x < w; x++) {
      pix[row + x] = tilePix[ty + (seedX[root[x]] % tileW)]
    }
  }

  return out
}

let scratchCache = null
function getScratch(w) {
  if (!scratchCache || scratchCache.w !== w) {
    scratchCache = {
      w,
      same: new Int32Array(w),
      zi: new Int32Array(w),
      zrow: new Float32Array(w),
      raised: new Int32Array(w),
      root: new Int32Array(w),
      seedX: new Int32Array(w),
    }
  }
  return scratchCache
}

/** Separation on the far plane, in pixels, for a given tile. */
export function farSeparation(tile) {
  return tile.width
}
