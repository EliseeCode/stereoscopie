<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { makeObject, disposeObject } from '../lib/objects.js'
import { makeDepthMaterial } from '../lib/depthMaterial.js'

const props = defineProps({
  objectId: { type: String, required: true },
  autoRotate: { type: Boolean, default: false },
  resolution: { type: Object, required: true }, // { w, h }
  depthView: { type: Boolean, default: false },
  text: { type: String, default: 'HELLO' },
  model: { type: Object, default: null }, // uploaded THREE.Object3D, already normalised
})

const emit = defineEmits(['depth'])

const canvas = ref(null)

let renderer, scene, camera, controls, mesh, depthMaterial, renderTarget
let readBuffer, depthBuffer
const extraControls = []
let dirty = true
let raf = 0

function setupRenderTarget(w, h) {
  renderTarget?.dispose()
  renderTarget = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  })
  readBuffer = new Uint8Array(w * h * 4)
  depthBuffer = new Float32Array(w * h)
}

function applyResolution() {
  const { w, h } = props.resolution
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  setupRenderTarget(w, h)
  dirty = true
}

let ownsMesh = false
function setObject(id) {
  if (mesh) {
    scene.remove(mesh)
    if (ownsMesh) disposeObject(mesh)
    mesh = null
  }
  if (id === 'model') {
    // The uploaded model is owned by the app, which disposes it when replaced.
    mesh = props.model
    ownsMesh = false
  } else {
    mesh = makeObject(id, { text: props.text })
    ownsMesh = true
  }
  if (mesh) scene.add(mesh)
  dirty = true
}

// Fixed depth slab, centred on the orbit target and measured along the view
// axis: near = target distance - HALF, far = target distance + HALF. Objects
// are normalised to the unit sphere, so this always contains them, and the
// mapping no longer shifts when you rotate, zoom or change the object.
const DEPTH_HALF_RANGE = 1.5

function updateDepthRange() {
  const dist = camera.position.distanceTo(controls.target)
  depthMaterial.uniforms.near.value = Math.max(0.05, dist - DEPTH_HALF_RANGE)
  depthMaterial.uniforms.far.value = dist + DEPTH_HALF_RANGE
}

function renderDepth() {
  const { w, h } = props.resolution
  updateDepthRange()

  const prevClear = renderer.getClearColor(new THREE.Color())
  const prevAlpha = renderer.getClearAlpha()
  scene.overrideMaterial = depthMaterial
  renderer.setRenderTarget(renderTarget)
  renderer.setClearColor(0x000000, 1)
  renderer.clear()
  renderer.render(scene, camera)
  renderer.readRenderTargetPixels(renderTarget, 0, 0, w, h, readBuffer)
  renderer.setRenderTarget(null)
  renderer.setClearColor(prevClear, prevAlpha)
  scene.overrideMaterial = null

  // readPixels rows run bottom-to-top; flip so depth[0] is the top-left pixel.
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4
    const dst = y * w
    for (let x = 0; x < w; x++) {
      depthBuffer[dst + x] = readBuffer[src + x * 4] / 255
    }
  }
  emit('depth', { depth: depthBuffer, w, h })
}

/** Let another element (e.g. the stereogram canvas) orbit the same camera. */
function addControlSurface(el) {
  if (!el || !camera) return
  const c = new OrbitControls(camera, el)
  c.enableDamping = controls.enableDamping
  c.dampingFactor = controls.dampingFactor
  c.enablePan = false
  c.minDistance = controls.minDistance
  c.maxDistance = controls.maxDistance
  c.target = controls.target // shared target so both orbit the same point
  c.addEventListener('change', () => { dirty = true })
  extraControls.push(c)
}

function loop() {
  raf = requestAnimationFrame(loop)
  controls.update()
  for (const c of extraControls) c.update()
  if (!dirty) return
  dirty = false
  if (props.depthView) {
    // Show the same linear depth the stereogram is built from.
    updateDepthRange()
    scene.overrideMaterial = depthMaterial
    renderer.render(scene, camera)
    scene.overrideMaterial = null
  } else {
    renderer.render(scene, camera)
  }
  renderDepth()
}

onMounted(() => {
  const { w, h } = props.resolution
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true })
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x14161c, 1)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 50)
  camera.position.set(0, 0.6, 3.4)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.2))
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(2, 3, 4)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x88aaff, 0.6)
  rim.position.set(-3, -1, -2)
  scene.add(rim)

  controls = new OrbitControls(camera, canvas.value)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 1.6
  controls.maxDistance = 8
  controls.autoRotate = props.autoRotate
  controls.autoRotateSpeed = 2
  controls.addEventListener('change', () => { dirty = true })

  depthMaterial = makeDepthMaterial()
  applyResolution()
  setObject(props.objectId)
  loop()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  controls?.dispose()
  for (const c of extraControls) c.dispose()
  extraControls.length = 0
  if (mesh) {
    scene.remove(mesh)
    disposeObject(mesh)
  }
  depthMaterial?.dispose()
  renderTarget?.dispose()
  renderer?.dispose()
})

watch(() => props.objectId, (id) => setObject(id))
watch(() => props.model, () => { if (props.objectId === 'model') setObject('model') })
let textTimer = 0
watch(() => props.text, () => {
  if (props.objectId !== 'text') return
  clearTimeout(textTimer)
  textTimer = setTimeout(() => setObject('text'), 150)
})

defineExpose({ addControlSurface })
watch(() => props.autoRotate, (v) => { controls.autoRotate = v })
watch(() => props.depthView, () => { dirty = true })
watch(() => props.resolution, () => applyResolution(), { deep: true })
</script>

<template>
  <canvas ref="canvas" class="three-canvas" />
</template>

<style scoped>
.three-canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
  cursor: grab;
  touch-action: none;
}
.three-canvas:active {
  cursor: grabbing;
}
</style>
