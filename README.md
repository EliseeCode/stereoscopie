# Stereoscopie

Real-time autostereogram ("Magic Eye") generator. A Three.js scene is rendered
to a depth buffer every frame, and that depth map is turned into a single-image
stereogram with a repeating pattern of your choice. Orbit the object and the
stereogram follows.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
```

## How it works

- `src/components/ThreeView.vue` renders the shaded preview, then re-renders the
  scene with `src/lib/depthMaterial.js` (linear view-space depth, 1 = near,
  0 = far) into a render target and reads it back as a `Float32Array`.
- `src/lib/stereogram.js` runs the Thimbleby / Inglis / Witten algorithm per
  scanline: it links pixel pairs that must share a colour, resolves hidden
  surfaces, then fills from the pattern tile. The far plane repeats on exactly
  the tile width, so the guide dots are one tile apart.
- `src/lib/patterns.js` generates seamless tiles (random dots, colour noise,
  blobs, circles, stripes, mosaic) from a seed, and converts uploaded images.
- `src/lib/objects.js` lists the available primitives, each normalised to the
  unit sphere so the depth range stays consistent.

## Viewing

Relax your eyes and look *through* the screen until the two guide dots become
three, then hold that and let the shape come into focus. Toggle
"Cross-eyed viewing" if you prefer to cross your eyes instead.
