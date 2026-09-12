<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { generateStereogram } from '../lib/stereogram.js'

const props = defineProps({
  depthData: { type: Object, default: null }, // { depth, w, h }
  tile: { type: Object, required: true },     // ImageData
  depthStrength: { type: Number, default: 0.35 },
  crossEyed: { type: Boolean, default: false },
  hiddenSurface: { type: Boolean, default: true },
  showGuides: { type: Boolean, default: true },
  displayWidth: { type: Number, default: 1000 },
})

const emit = defineEmits(['display-size'])

const canvas = ref(null)
const box = ref(null)
const lastMs = ref(0)
const fit = ref({ w: 640, h: 480 })
let ctx
let resizeObserver
let out = null

function drawGuides(w) {
  const sep = props.tile.width
  const y = 18
  const r = 6
  for (const cx of [w / 2 - sep / 2, w / 2 + sep / 2]) {
    ctx.beginPath()
    ctx.arc(cx, y, r + 2, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, y, r, 0, Math.PI * 2)
    ctx.fillStyle = '#111'
    ctx.fill()
  }
}

function render() {
  if (!ctx || !props.depthData) return
  const { depth, w, h } = props.depthData
  if (canvas.value.width !== w || canvas.value.height !== h) {
    canvas.value.width = w
    canvas.value.height = h
  }
  const t0 = performance.now()
  out = generateStereogram(depth, w, h, props.tile, {
    depthStrength: props.depthStrength,
    crossEyed: props.crossEyed,
    hiddenSurface: props.hiddenSurface,
    out,
  })
  ctx.putImageData(out, 0, 0)
  if (props.showGuides) drawGuides(w)
  lastMs.value = performance.now() - t0
}

function fullscreen() {
  const el = canvas.value
  const req = el.requestFullscreen || el.webkitRequestFullscreen
  if (req) req.call(el)
}

function download() {
  canvas.value.toBlob((blob) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'stereogram.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }, 'image/png')
}

/** Largest rectangle with the canvas aspect that fits the box (and the width cap). */
function fitToBox() {
  const el = canvas.value
  const b = box.value
  if (!el || !b) return
  const aspect = el.width / el.height || 4 / 3
  const rect = b.getBoundingClientRect()
  let w = Math.min(rect.width, props.displayWidth)
  let h = w / aspect
  if (rect.height > 0 && h > rect.height) {
    h = rect.height
    w = h * aspect
  }
  // Keep the CSS size identical to the (even-sized) render buffer so the
  // browser never resamples the canvas, which would duplicate a column.
  const fw = Math.max(2, Math.floor(w) & ~1)
  const fh = Math.max(2, Math.round((fw * 3) / 4) & ~1)
  fit.value = { w: fw, h: fh }
  reportDisplaySize()
}

function reportDisplaySize() {
  const el = canvas.value
  if (!el) return
  let w = fit.value.w
  // In fullscreen the browser forces the canvas to the whole screen with
  // object-fit: contain, so the drawn width is limited by the height too.
  if (document.fullscreenElement === el) {
    const rect = el.getBoundingClientRect()
    const aspect = el.width / el.height || 4 / 3
    w = Math.min(rect.width, rect.height * aspect)
  }
  emit('display-size', { cssWidth: Math.round(w), dpr: window.devicePixelRatio || 1 })
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  render()
  resizeObserver = new ResizeObserver(fitToBox)
  resizeObserver.observe(box.value)
  document.addEventListener('fullscreenchange', reportDisplaySize)
  fitToBox()
})

watch(() => props.displayWidth, fitToBox)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('fullscreenchange', reportDisplaySize)
})

watch(
  () => [props.depthData, props.tile, props.depthStrength, props.crossEyed, props.hiddenSurface, props.showGuides],
  render,
)

defineExpose({ download, fullscreen, lastMs, canvas })
</script>

<template>
  <div class="stereogram">
    <div ref="box" class="canvas-box">
      <canvas ref="canvas" class="stereogram-canvas" :style="{ width: fit.w + 'px', height: fit.h + 'px' }" />
    </div>
    <div class="stereogram-footer">
      <span class="hint">
        {{ crossEyed ? 'Cross your eyes' : 'Look through the image' }} until the two dots become three.
        Drag here to orbit, scroll to zoom.
      </span>
      <span class="timing">{{ lastMs.toFixed(1) }} ms</span>
      <button class="btn" @click="fullscreen">Fullscreen</button>
      <button class="btn" @click="download">Download PNG</button>
    </div>
  </div>
</template>

<style scoped>
.stereogram {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.canvas-box {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stereogram-canvas {
  display: block;
  border-radius: 8px;
  background: #000;
  /* Never let the browser bilinear-filter the dots: it creates moiré lines. */
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  cursor: grab;
  touch-action: none;
}
.stereogram-canvas:active {
  cursor: grabbing;
}
.stereogram-canvas:fullscreen {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 0;
  background: #000;
}
.stereogram-footer {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--muted);
}
.hint {
  flex: 1;
}
.timing {
  font-variant-numeric: tabular-nums;
}
</style>
