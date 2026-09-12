import * as THREE from 'three'
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json'

let font = null
function getFont() {
  if (!font) font = new FontLoader().parse(helvetikerBold)
  return font
}

function makeText(text) {
  const str = (text ?? '').trim() || 'HELLO'
  return new TextGeometry(str, {
    font: getFont(),
    size: 1,
    depth: 0.4,
    curveSegments: 8,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 3,
  })
}

/** Centre text and scale it to fit the camera's view (wide objects shrink less than a sphere fit would). */
function normalizeText(geometry) {
  geometry.center()
  geometry.computeBoundingBox()
  const size = new THREE.Vector3()
  geometry.boundingBox.getSize(size)
  const s = Math.min(2.8 / (size.x || 1), 1.5 / (size.y || 1), 1)
  geometry.scale(s, s, s)
  geometry.computeBoundingSphere()
  return geometry
}

/** Centre a geometry and scale it to fit inside the unit sphere. */
function normalize(geometry) {
  geometry.center()
  geometry.computeBoundingSphere()
  const r = geometry.boundingSphere.radius || 1
  geometry.scale(1 / r, 1 / r, 1 / r)
  geometry.computeBoundingSphere()
  return geometry
}

export const OBJECTS = [
  { id: 'torusKnot', label: 'Torus knot', make: () => new THREE.TorusKnotGeometry(0.6, 0.22, 200, 32) },
  { id: 'teapot', label: 'Utah teapot', make: () => new TeapotGeometry(0.8, 10) },
  { id: 'sphere', label: 'Sphere', make: () => new THREE.SphereGeometry(1, 48, 32) },
  { id: 'box', label: 'Cube', make: () => new THREE.BoxGeometry(1.4, 1.4, 1.4) },
  { id: 'icosahedron', label: 'Icosahedron', make: () => new THREE.IcosahedronGeometry(1, 0) },
  { id: 'torus', label: 'Torus', make: () => new THREE.TorusGeometry(0.8, 0.32, 32, 96) },
  { id: 'cone', label: 'Cone', make: () => new THREE.ConeGeometry(0.9, 1.8, 48) },
  { id: 'dodecahedron', label: 'Dodecahedron', make: () => new THREE.DodecahedronGeometry(1, 0) },
  { id: 'text', label: '3D text', make: (opts) => makeText(opts?.text), normalize: normalizeText },
]

const previewMaterial = new THREE.MeshStandardMaterial({
  color: 0x8fb4ff,
  roughness: 0.45,
  metalness: 0.1,
  flatShading: false,
})

export function makeObject(id, opts = {}) {
  const def = OBJECTS.find((o) => o.id === id) || OBJECTS[0]
  const geometry = (def.normalize || normalize)(def.make(opts))
  const mesh = new THREE.Mesh(geometry, previewMaterial)
  mesh.name = def.id
  return mesh
}

export function disposeObject(obj) {
  if (!obj) return
  obj.traverse((o) => {
    o.geometry?.dispose()
    if (o.material && o.material !== previewMaterial) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        for (const k of Object.keys(m)) if (m[k]?.isTexture) m[k].dispose()
        m.dispose()
      }
    }
  })
}

/** Wrap any Object3D so that it is centred at the origin and fits the unit sphere. */
export function normalizeObject(obj) {
  const box = new THREE.Box3().setFromObject(obj)
  const sphere = new THREE.Sphere()
  box.getBoundingSphere(sphere)
  const wrapper = new THREE.Group()
  wrapper.add(obj)
  obj.position.sub(sphere.center)
  const r = sphere.radius || 1
  wrapper.scale.setScalar(1 / r)
  wrapper.name = 'model'
  return wrapper
}

/**
 * Parse an uploaded STL / OBJ / GLB (or self-contained GLTF) file into an
 * Object3D, normalised to the unit sphere.
 * @param {File} file
 * @returns {Promise<THREE.Object3D>}
 */
export async function loadModelFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  let obj
  if (ext === 'stl') {
    const geometry = new STLLoader().parse(await file.arrayBuffer())
    geometry.computeVertexNormals()
    // STL files are usually Z-up; stand them upright in three's Y-up world.
    geometry.rotateX(-Math.PI / 2)
    obj = new THREE.Mesh(geometry, previewMaterial)
  } else if (ext === 'obj') {
    obj = new OBJLoader().parse(await file.text())
    obj.traverse((o) => {
      if (o.isMesh) {
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals()
        o.material = previewMaterial
      }
    })
  } else if (ext === 'glb' || ext === 'gltf') {
    const buffer = await file.arrayBuffer()
    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().parse(buffer, '', resolve, reject)
    })
    obj = gltf.scene
    obj.traverse((o) => {
      if (o.isMesh && !o.material) o.material = previewMaterial
    })
  } else {
    throw new Error(`Unsupported model format: .${ext} (use .stl, .obj or .glb)`)
  }
  return normalizeObject(obj)
}
