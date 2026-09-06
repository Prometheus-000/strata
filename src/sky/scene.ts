/**
 * THE SKY, DRAWN. One three.js scene for every record the engine can draw,
 * with one continuous zoom across five orders of magnitude. The React page
 * mounts it, hands it the skies and the palettes, and reads back where the
 * camera is; nothing else about the page is in here.
 *
 * What is drawn, and why:
 *   - the ground is the theme's dark surface, whatever the page's ground is,
 *     because the night sky is a canvas and the picture has its own;
 *   - a record, a system and a target each own a neighbourhood, drawn as a
 *     hairline ring that faces the camera;
 *   - a planet's radius grows with the cube root of its mass, the decisions
 *     made on it, and it wears the theme in force at the last of them;
 *   - a moon is a decision: filled when a human chose, hollow when an agent
 *     did, wireframe when the record refused it;
 *   - labels appear only while their neighbourhood is between a sliver and
 *     most of the view, so each distance names its own level;
 *   - every decision is also a point of dust, so a record reads as a galaxy
 *     before its rings resolve.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { levelFor, R_RECORD, R_SYSTEM, R_TARGET, type Seeds, type Sky, type SkyNode } from '@strata/identity'
import type { Palette } from '@strata/identity/render'

export interface Readout {
  level: string
  what: string
  distance: number
}

export interface SkyScene {
  flyTo: (node: SkyNode) => void
  home: () => void
  resize: () => void
  dispose: () => void
}

export interface SkySceneOptions {
  skies: Sky[]
  /** The night: ink and ground for the sky itself. */
  palette: Palette
  /** The theme a body wears, from the seeds in force when it was decided. */
  paletteFor: (seeds: Seeds) => Palette
  onReadout: (r: Readout) => void
  /** No frame is ever requested when true; the view still answers to a drag or a fly. */
  reduced: boolean
}

/** CSS colours are sRGB; three's numeric constructor assumes linear. Canvas resolves what three cannot parse. */
const scratch = typeof document !== 'undefined' ? document.createElement('canvas') : null
function cssColor(css: string): THREE.Color {
  if (!scratch) return new THREE.Color(0.5, 0.5, 0.5)
  scratch.width = scratch.height = 1
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = css
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return new THREE.Color().setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace)
}

export function mountSky(canvas: HTMLCanvasElement, labelsEl: HTMLElement, opts: SkySceneOptions): SkyScene {
  const { skies, palette, paletteFor, onReadout, reduced } = opts
  const INK = cssColor(palette.ink)
  const FAINT = cssColor(palette.faint)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  const labels = new CSS2DRenderer({ element: labelsEl })
  const scene = new THREE.Scene()
  scene.background = cssColor(palette.ground)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.0002, 200)
  camera.position.set(0, 6, 22)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = !reduced
  controls.dampingFactor = 0.1
  controls.minDistance = 0.004
  controls.maxDistance = 30
  controls.zoomSpeed = 1.1
  controls.target.set(0, 0, 0)

  const world = new THREE.Group()
  scene.add(world)
  const rings: THREE.Line[] = []
  const labelled: Array<{ obj: CSS2DObject; node: SkyNode }> = []
  const pickable: THREE.Object3D[] = []
  const disposables: Array<{ dispose: () => void }> = []

  const ringGeo = (() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 96; i++) pts.push(new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2), Math.sin((i / 96) * Math.PI * 2), 0))
    return new THREE.BufferGeometry().setFromPoints(pts)
  })()
  const sphereGeo = new THREE.SphereGeometry(1, 14, 10)
  disposables.push(ringGeo, sphereGeo)

  const label = (node: SkyNode, text: string, cls: string) => {
    const div = document.createElement('div')
    div.className = `sky-label ${cls}`
    div.textContent = text
    div.addEventListener('click', () => flyTo(node))
    const obj = new CSS2DObject(div)
    // The name sits at the right edge of its own ring, outside the body it names.
    obj.position.set(node.pos[0] + node.radius, node.pos[1], node.pos[2])
    world.add(obj)
    labelled.push({ obj, node })
  }
  const ring = (node: SkyNode, radius: number, opacity: number) => {
    const mat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity })
    disposables.push(mat)
    const line = new THREE.Line(ringGeo, mat)
    line.position.set(...node.pos)
    line.scale.setScalar(radius)
    world.add(line)
    rings.push(line)
  }
  const body = (node: SkyNode, radius: number, mat: THREE.Material) => {
    disposables.push(mat)
    const m = new THREE.Mesh(sphereGeo, mat)
    m.position.set(...node.pos)
    m.scale.setScalar(radius)
    m.userData.node = node
    world.add(m)
    pickable.push(m)
  }

  for (const sky of skies) {
    ring(sky.root, R_RECORD, 0.18)
    label(sky.root, `${sky.name} · ${sky.root.mass} decisions`, 'sky-label--record')
    for (const sys of sky.systems) {
      ring(sys, R_SYSTEM, 0.14)
      label(sys, `${sys.name} · ${sys.mass}`, 'sky-label--system')
      for (const tgt of sys.children) {
        const last = tgt.children[tgt.children.length - 1]
        const wears = last?.seeds ? paletteFor(last.seeds) : palette
        const colour = wears.accent ? cssColor(wears.accent) : INK
        body(tgt, R_TARGET * 0.22 * Math.cbrt(Math.max(1, tgt.mass)), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.92 }))
        ring(tgt, R_TARGET, 0.12)
        label(tgt, `${tgt.name} · ${tgt.mass}`, 'sky-label--target')
        for (const moon of tgt.children) {
          const mat = moon.refused
            ? new THREE.MeshBasicMaterial({ color: INK, wireframe: true, transparent: true, opacity: 0.35 })
            : moon.hand === 'human'
              ? new THREE.MeshBasicMaterial({ color: INK })
              : new THREE.MeshBasicMaterial({ color: INK, wireframe: true, transparent: true, opacity: 0.7 })
          body(moon, R_TARGET * 0.05, mat)
          label(moon, `${(moon.index ?? 0) + 1} · ${moon.name}${moon.refused ? ' · refused' : ''} · ${moon.hand}`, 'sky-label--moon')
        }
      }
    }
  }
  {
    const far = new THREE.BufferGeometry().setFromPoints(skies.map((s) => new THREE.Vector3(...s.root.pos)))
    const farMat = new THREE.PointsMaterial({ color: INK, size: 6, sizeAttenuation: false, transparent: true, opacity: 0.9 })
    world.add(new THREE.Points(far, farMat))
    const dust = new THREE.BufferGeometry().setFromPoints(skies.flatMap((s) => s.moons.map((m) => new THREE.Vector3(...m.pos))))
    const dustMat = new THREE.PointsMaterial({ color: FAINT, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.7 })
    world.add(new THREE.Points(dust, dustMat))
    disposables.push(far, farMat, dust, dustMat)
  }

  /* ---------- flying ---------- */

  let flight: { from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3; t0: number; ms: number } | null = null
  const fly = (to: THREE.Vector3, camTo: THREE.Vector3, ms: number) => {
    if (reduced) {
      controls.target.copy(to)
      camera.position.copy(camTo)
      request()
      return
    }
    flight = { from: controls.target.clone(), to, camFrom: camera.position.clone(), camTo, t0: performance.now(), ms }
    request()
  }
  const flyTo = (node: SkyNode) => {
    const to = new THREE.Vector3(...node.pos)
    const d = node.level === 'record' ? 2.4 : node.level === 'system' ? R_SYSTEM * 2.6 : node.level === 'target' ? R_TARGET * 3 : R_TARGET * 0.5
    const dir = camera.position.clone().sub(controls.target).normalize()
    fly(to, to.clone().add(dir.multiplyScalar(d)), 1100)
  }
  const home = () => fly(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 6, 22), 1400)

  const ray = new THREE.Raycaster()
  const onClick = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect()
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(p, camera)
    const hit = ray.intersectObjects(pickable, false)[0]
    if (hit?.object.userData.node) flyTo(hit.object.userData.node as SkyNode)
  }
  canvas.addEventListener('click', onClick)

  /* ---------- level of detail, and the readout ---------- */

  let lastLevel = ''
  const updateDetail = () => {
    const d = camera.position.distanceTo(controls.target)
    const tan = Math.tan((camera.fov / 2) * (Math.PI / 180))
    for (const { obj, node } of labelled) {
      const dist = camera.position.distanceTo(new THREE.Vector3(...node.pos))
      const apparent = node.radius / (dist * tan)
      const [lo, hi] = node.level === 'record' ? [0.02, 0.9] : node.level === 'system' ? [0.05, 0.75] : node.level === 'target' ? [0.06, 0.7] : [0.12, 3]
      obj.visible = apparent > lo && apparent < hi
    }
    for (const r of rings) r.quaternion.copy(camera.quaternion)
    const lv = levelFor(d)
    const key = `${lv.name}:${d.toFixed(3)}`
    if (key !== lastLevel) {
      lastLevel = key
      onReadout({ level: lv.name, what: lv.what, distance: d })
    }
  }

  /* ---------- frame ---------- */

  let pending = false
  let alive = true
  const frame = (now: number) => {
    pending = false
    if (!alive) return
    let moving = controls.update()
    if (flight) {
      const k = Math.min(1, (now - flight.t0) / flight.ms)
      const e = k * k * (3 - 2 * k)
      controls.target.lerpVectors(flight.from, flight.to, e)
      camera.position.lerpVectors(flight.camFrom, flight.camTo, e)
      if (k >= 1) flight = null
      moving = true
    }
    updateDetail()
    renderer.render(scene, camera)
    labels.render(scene, camera)
    if (moving && !reduced) request()
  }
  const request = () => {
    if (pending || !alive) return
    pending = true
    requestAnimationFrame(frame)
  }
  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    labels.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    request()
  }
  controls.addEventListener('change', request)
  canvas.addEventListener('pointermove', request)
  canvas.addEventListener('wheel', request, { passive: true })
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()
  request()

  return {
    flyTo,
    home,
    resize,
    dispose: () => {
      alive = false
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('pointermove', request)
      canvas.removeEventListener('wheel', request)
      controls.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      labelsEl.replaceChildren()
    },
  }
}
