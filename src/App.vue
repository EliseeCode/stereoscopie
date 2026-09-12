<script setup>
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import ThreeView from './components/ThreeView.vue'
import StereogramView from './components/StereogramView.vue'
import ControlPanel from './components/ControlPanel.vue'
import { makePattern, imageToTile, loadImageFile } from './lib/patterns.js'
import { loadModelFile, disposeObject } from './lib/objects.js'

const RESOLUTIONS = {
  'Match display (sharp)': 'display',
  'Match display × 2 (HiDPI)': 'display2',
  '480 × 360': { w: 480, h: 360 },
  '640 × 480': { w: 640, h: 480 },
  '800 × 600': { w: 800, h: 600 },
  '1024 × 768': { w: 1024, h: 768 },
}

const objectId = ref('box')
const text = ref('HELLO')
const patternId = ref('blobs')
const seed = ref(1)
const tileWidthManual = ref(80)
const autoTile = ref(true)
const EYE_SEPARATION_MM = 65
const depthStrength = ref(0.35)
const resolutionKey = ref('Match display (sharp)')
const crossEyed = ref(true)
const showGuides = true
const autoRotate = ref(false)
const hiddenSurface = true
const displayWidth = 4096 // no practical cap; the canvas is fitted to the panel
const stereogramView = ref(null)
const threeView = ref(null)

const sidebarOpen = ref(true)
const depthView = ref(false)
try {
  if (localStorage.getItem('stereoscopie.sidebar') === 'closed') sidebarOpen.value = false
} catch (_) { /* storage unavailable */ }
watch(sidebarOpen, (v) => {
  try { localStorage.setItem('stereoscopie.sidebar', v ? 'open' : 'closed') } catch (_) { /* ignore */ }
})

onMounted(() => {
  threeView.value?.addControlSurface(stereogramView.value?.canvas)
})

const uploadedImage = shallowRef(null)
const uploadedModel = shallowRef(null)
const modelError = ref('')

async function onModelUpload(file) {
  modelError.value = ''
  try {
    const model = await loadModelFile(file)
    const previous = uploadedModel.value
    uploadedModel.value = model
    objectId.value = 'model'
    // Let the scene swap meshes before releasing the old model's GPU resources.
    await nextTick()
    if (previous) disposeObject(previous)
  } catch (e) {
    console.warn('Could not load model', e)
    modelError.value = e?.message || 'Could not load this model.'
  }
}
const depthData = shallowRef(null)

const displaySize = ref({ cssWidth: 640, dpr: 1 })
const resolution = ref({ w: 640, h: 480 })

const MAX_WIDTH = 2048
let resizeTimer = 0
function updateResolution() {
  const mode = RESOLUTIONS[resolutionKey.value]
  if (typeof mode === 'object') {
    resolution.value = mode
    return
  }
  const scale = mode === 'display2' ? Math.min(2, displaySize.value.dpr) : 1
  let w = Math.round(displaySize.value.cssWidth * scale)
  w = Math.max(320, Math.min(MAX_WIDTH, w)) & ~1
  const h = Math.round((w * 3) / 4) & ~1
  if (resolution.value.w !== w || resolution.value.h !== h) resolution.value = { w, h }
}
function onDisplaySize(size) {
  displaySize.value = size
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(updateResolution, 120)
}
watch(resolutionKey, updateResolution, { immediate: true })

/** CSS pixels per millimetre, assuming the CSS standard of 96 px per inch. */
const cssPxPerMm = computed(() => 96 / 25.4)

/** Canvas pixels per CSS pixel of the displayed stereogram. */
const canvasScale = computed(() => resolution.value.w / Math.max(1, displaySize.value.cssWidth))

/** Tile width so that the far-plane separation (E/2) is half the eye spacing on screen. */
const autoTileWidth = computed(() => {
  const px = (EYE_SEPARATION_MM / 2) * cssPxPerMm.value * canvasScale.value
  return Math.max(20, Math.min(400, Math.round(px)))
})

const tileWidth = computed({
  get: () => (autoTile.value ? autoTileWidth.value : tileWidthManual.value),
  set: (v) => { tileWidthManual.value = v },
})

/** Physical width of one tile on screen, in mm. */
const tileMm = computed(() => tileWidth.value / canvasScale.value / cssPxPerMm.value)

const tile = computed(() => {
  if (patternId.value === 'upload' && uploadedImage.value) {
    return imageToTile(uploadedImage.value, tileWidth.value)
  }
  return makePattern(patternId.value, tileWidth.value, seed.value)
})

const tilePreview = computed(() => {
  const t = tile.value
  const c = document.createElement('canvas')
  c.width = t.width
  c.height = t.height
  c.getContext('2d').putImageData(t, 0, 0)
  return c.toDataURL()
})

function regenerate() {
  let next
  do next = Math.floor(Math.random() * 1_000_000)
  while (next === seed.value)
  seed.value = next
}

async function onUpload(file) {
  try {
    uploadedImage.value = await loadImageFile(file)
    patternId.value = 'upload'
  } catch (e) {
    console.error('Could not load image', e)
  }
}

function onDepth(data) {
  depthData.value = { ...data }
}

// If the user switches away from "upload" and back before uploading, fall back.
watch(objectId, (id) => {
  if (id === 'model' && !uploadedModel.value) objectId.value = 'box'
})
watch(patternId, (id) => {
  if (id === 'upload' && !uploadedImage.value) patternId.value = 'blobs'
})
</script>

<template>
  <div class="app" :class="{ collapsed: !sidebarOpen }">
    <aside v-show="sidebarOpen" class="sidebar">
      <header class="sidebar-head">
        <div>
          <h1 class="title">Stereoscopie</h1>
          <p class="subtitle">Real-time autostereogram from a Three.js scene</p>
        </div>
        <button class="btn small" title="Hide controls" @click="sidebarOpen = false">◀ Hide</button>
      </header>
      <section class="view scene">
        <div class="view-head">
          <h2>Scene</h2>
          <div class="segmented">
            <button class="btn small" :class="{ active: !depthView }" @click="depthView = false">Shaded</button>
            <button class="btn small" :class="{ active: depthView }" @click="depthView = true">Depth</button>
          </div>
        </div>
        <ThreeView
          ref="threeView"
          :depth-view="depthView"
          :text="text"
          :model="uploadedModel"
          :object-id="objectId"
          :auto-rotate="autoRotate"
          :resolution="resolution"
          @depth="onDepth"
        />
      </section>
      <ControlPanel
        v-model:objectId="objectId"
        v-model:text="text"
        v-model:patternId="patternId"
        v-model:tileWidth="tileWidth"
        v-model:autoTile="autoTile"
        :tile-mm="tileMm"
        v-model:depthStrength="depthStrength"
        v-model:crossEyed="crossEyed"
        v-model:autoRotate="autoRotate"
        :has-upload="!!uploadedImage"
        :has-model="!!uploadedModel"
        :model-error="modelError"
        :tile-preview="tilePreview"
        @regenerate="regenerate"
        @upload="onUpload"
        @upload-model="onModelUpload"
      />
    </aside>

    <main class="main">
      <section class="view">
        <div class="view-head start">
          <button v-if="!sidebarOpen" class="btn small" title="Show controls" @click="sidebarOpen = true">▶ Show controls</button>
          <h2>Stereogram</h2>
        </div>
        <StereogramView
          ref="stereogramView"
          :display-width="displayWidth"
          :depth-data="depthData"
          :tile="tile"
          :depth-strength="depthStrength"
          :cross-eyed="crossEyed"
          :hidden-surface="hiddenSurface"
          :show-guides="showGuides"
          @display-size="onDisplaySize"
        />
      </section>
    </main>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 20px;
  padding: 20px;
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
}
.app.collapsed {
  grid-template-columns: 1fr;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}
.sidebar-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.title {
  font-size: 22px;
  margin: 0;
  letter-spacing: 0.02em;
}
.subtitle {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.main {
  min-width: 0;
  min-height: 0;
}
.main .view {
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.view {
  background: var(--panel);
  border-radius: 12px;
  padding: 14px;
}
.view-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.view-head h2 {
  margin: 0;
}
.view-head.start {
  justify-content: flex-start;
}
.btn.small {
  padding: 3px 8px;
  font-size: 12px;
}
.segmented {
  display: flex;
}
.segmented .btn {
  border-radius: 0;
}
.segmented .btn:first-child {
  border-radius: 6px 0 0 6px;
}
.segmented .btn:last-child {
  border-radius: 0 6px 6px 0;
  border-left: none;
}
.segmented .btn.active {
  background: var(--accent);
  color: #0e1015;
  border-color: var(--accent);
}
.view h2 {
  flex: none;
  margin: 0 0 10px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
@media (max-width: 900px) {
  .app {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }
  .sidebar {
    overflow: visible;
  }
  .main .view {
    height: 70vh;
  }
}
</style>
