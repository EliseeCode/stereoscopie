import * as THREE from 'three'
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
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

export function disposeObject(mesh) {
  if (!mesh) return
  mesh.geometry?.dispose()
}
