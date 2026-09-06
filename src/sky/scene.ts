/**
 * THE SKY, DRAWN. One three.js scene for every record the engine can draw,
 * with one continuous zoom across five orders of magnitude, and a camera
 * that travels rather than jumps. The React page mounts it, hands it the
 * skies and the palettes, and reads back where the camera is.
 *
 * Two things the night sky taught the first version, and this one keeps:
 * light carries depth, and structure is a disc.
 *
 * What is drawn, and why each thing is allowed to be there:
 *   - the ground is the theme's dark surface whatever the page's ground is,
 *     because the night sky is a canvas and the picture has its own;
 *   - a key light coloured by the warmth seed, a hemisphere from the night,
 *     and a sun at every record's core: the theme in force, which is the
 *     one honest sun a record has, since the engine derives every token
 *     from those six seeds the way a sun lights and makes a system. A body
 *     wears the light of the sun that shone when it was decided — depth is
 *     light;
 *   - a record, a system, a target and an orbit are rings lying in the
 *     plane, so perspective shows the tilt — structure is a disc;
 *   - a planet is a lit surface whose colour is the theme in force at the
 *     last decision made on it and whose sharpness is the energy seed; its
 *     radius grows with the cube root of its mass, the decisions made on it;
 *   - a moon is a decision on an orbit, in time order: filled when a human
 *     chose, hollow when an agent did, wireframe when the record refused it;
 *   - every decision is a point of dust whose brightness is its recency, so
 *     a record reads as a galaxy before its rings resolve;
 *   - a system carries a haze whose density is its mass, and a record a halo:
 *     the field's own scalar, given depth;
 *   - a target three hands reached spikes, because that is the number the
 *     grammar prefers for a candidate;
 *   - a promotion's drains are streamlines toward the promoted place;
 *   - records are joined by filaments wherever they share a target, because
 *     the same target lands in the same place in every record;
 *   - the newest decision in the first record is marked: you are here;
 *   - labels sit at the edge of their ring with a leader line, and appear
 *     only while their neighbourhood is between a sliver and most of the view;
 *   - going in and coming out are gestures. Scroll or pinch zooms toward the
 *     point under the pointer, and a focus walks the ladder as the distance
 *     crosses each level — into the nearest child on the way in, back to the
 *     parent on the way out — so scrolling in descends and scrolling out
 *     ascends without a click. The buttons remain as the keyboard's way in.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { CONVERGE_AT, levelFor, R_MOON, R_RECORD, R_SYSTEM, R_TARGET, seedsAt, type Seeds, type Sky, type SkyNode } from '@strata/identity'
import type { Palette } from '@strata/identity/render'

export interface Readout {
  level: string
  what: string
  distance: number
  /** What a journey is doing, when one is. */
  journey?: string
  /** What the gesture is going into, or coming out of. */
  focus?: string
}

export interface SkyScene {
  flyTo: (node: SkyNode) => void
  home: () => void
  /** Walk the ladder: in from wherever the camera is to the moons of the most-decided target, or out to the supercluster. */
  journey: (direction: 'in' | 'out') => void
  /** Put the camera at `from`, looking at `at`, at once. Straight above the record, the sky is the field. */
  look: (from: readonly [number, number, number], at: readonly [number, number, number]) => void
  resize: () => void
  dispose: () => void
}

export interface SkySceneOptions {
  skies: Sky[]
  /** The night: ink and ground for the sky itself. */
  palette: Palette
  /** The theme a body wears, from the seeds in force when it was decided. */
  paletteFor: (seeds: Seeds) => Palette
  /** The seeds in force now: the key light's warmth, the planets' sharpness. */
  seeds: Seeds
  onReadout: (r: Readout) => void
  /** No frame is ever requested when true; a flight is a jump, and the view still answers to a drag. */
  reduced: boolean
}

/* ---------- colour, and two small textures ---------- */

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

/** A soft radial falloff, white, for haze and halos. */
function hazeTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)') // deviation: the haze texture is the picture, not the frame: a radial falloff painted into a canvas, whose value is the white it fades from
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)') // deviation: the haze texture is the picture, not the frame: a radial falloff painted into a canvas, whose value is the white it fades from
  g.addColorStop(1, 'rgba(255,255,255,0)') // deviation: the haze texture is the picture, not the frame: a radial falloff painted into a canvas, whose value is the white it fades from
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A four-point spike, white, for a target three hands reached. */
function spikeTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  for (const [x0, y0, x1, y1] of [
    [64, 0, 64, 128],
    [0, 64, 128, 64],
  ]) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, 'rgba(255,255,255,0)') // deviation: the spike texture is the picture, not the frame: a four-point flare painted into a canvas, whose value is the white it fades through
    g.addColorStop(0.5, 'rgba(255,255,255,0.9)') // deviation: the spike texture is the picture, not the frame: a four-point flare painted into a canvas, whose value is the white it fades through
    g.addColorStop(1, 'rgba(255,255,255,0)') // deviation: the spike texture is the picture, not the frame: a four-point flare painted into a canvas, whose value is the white it fades through
    ctx.strokeStyle = g
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const v3 = (p: readonly [number, number, number]) => new THREE.Vector3(p[0], p[1], p[2])

/** The oblique home view: high enough above the plane that discs read as discs, far enough that records are points. */
const HOME_FROM: [number, number, number] = [3, -9, 20]

export function mountSky(canvas: HTMLCanvasElement, labelsEl: HTMLElement, opts: SkySceneOptions): SkyScene {
  const { skies, palette, paletteFor, seeds, onReadout, reduced } = opts
  const INK = cssColor(palette.ink)
  const FAINT = cssColor(palette.faint)
  const GROUND = cssColor(palette.ground)
  const KEY = cssColor(palette.accent ?? palette.ink)
  const gloss = Math.max(0, Math.min(1, seeds.energy))

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  const labels = new CSS2DRenderer({ element: labelsEl })
  const scene = new THREE.Scene()
  scene.background = GROUND
  scene.fog = new THREE.Fog(GROUND, 8, 48)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.0002, 200)
  camera.position.set(...HOME_FROM)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = !reduced
  controls.dampingFactor = 0.1
  controls.minDistance = 0.004
  controls.maxDistance = 30
  // Zoom is ours: it anchors on the pointer and walks the ladder. Turning stays OrbitControls'.
  controls.enableZoom = false
  controls.enablePan = false
  controls.target.set(0, 0, 0)
  const MIN_D = 0.004
  const MAX_D = 30

  /* ---------- light ---------- */

  // Warmth is the temperature of the key light: the same seed that tints every neutral.
  scene.add(new THREE.HemisphereLight(FAINT, GROUND, 0.55))
  const key = new THREE.DirectionalLight(KEY, 1.4)
  key.position.set(4, 6, 8)
  scene.add(key)
  const fill = new THREE.DirectionalLight(FAINT, 0.35)
  fill.position.set(-5, -3, 4)
  scene.add(fill)

  const world = new THREE.Group()
  scene.add(world)
  const labelled: Array<{ obj: CSS2DObject; node: SkyNode }> = []
  const pickable: THREE.Object3D[] = []
  const hazes: Array<{ obj: THREE.Sprite; node: SkyNode }> = []
  const disposables: Array<{ dispose: () => void }> = []

  const ringGeo = (() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 96; i++) pts.push(new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2), Math.sin((i / 96) * Math.PI * 2), 0))
    return new THREE.BufferGeometry().setFromPoints(pts)
  })()
  const sphereGeo = new THREE.SphereGeometry(1, 20, 14)
  const haze = hazeTexture()
  const spike = spikeTexture()
  disposables.push(ringGeo, sphereGeo, haze, spike)

  const label = (node: SkyNode, text: string, cls: string, anchor?: THREE.Vector3) => {
    const div = document.createElement('div')
    div.className = `sky-label ${cls}`
    div.textContent = text
    div.addEventListener('click', () => flyTo(node))
    const obj = new CSS2DObject(div)
    obj.position.copy(anchor ?? new THREE.Vector3(node.pos[0] + node.radius, node.pos[1], node.pos[2]))
    world.add(obj)
    labelled.push({ obj, node })
  }
  /** A ring in the plane: the neighbourhood a node owns, seen in perspective. */
  const ring = (at: readonly [number, number, number], radius: number, opacity: number, colour: THREE.Color = INK) => {
    const mat = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity })
    disposables.push(mat)
    const line = new THREE.Line(ringGeo, mat)
    line.position.set(...at)
    line.scale.setScalar(radius)
    world.add(line)
    return line
  }
  const body = (node: SkyNode, radius: number, mat: THREE.Material) => {
    disposables.push(mat)
    const m = new THREE.Mesh(sphereGeo, mat)
    m.position.set(...node.pos)
    m.scale.setScalar(radius)
    m.userData.node = node
    world.add(m)
    pickable.push(m)
    return m
  }
  const sprite = (at: readonly [number, number, number], size: number, map: THREE.Texture, colour: THREE.Color, opacity: number) => {
    const mat = new THREE.SpriteMaterial({ map, color: colour, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })
    disposables.push(mat)
    const s = new THREE.Sprite(mat)
    s.position.set(...at)
    s.scale.set(size, size, 1)
    world.add(s)
    return s
  }
  const wears = (node: SkyNode): Palette => {
    const last = node.children[node.children.length - 1]
    return last?.seeds ? paletteFor(last.seeds) : palette
  }
  const colourOf = (node: SkyNode) => {
    const w = wears(node)
    return w.accent ? cssColor(w.accent) : INK
  }

  /* ---------- bodies ---------- */

  const targetByKey = new Map<string, SkyNode>()
  const moonByIndex: Map<Sky, Map<number, SkyNode>> = new Map()
  const dustPoints: THREE.Vector3[] = []
  const dustColours: number[] = []

  for (const sky of skies) {
    const N = Math.max(1, sky.state.events.length)
    // The sun: the theme in force at the end of the record — for the first record, the seeds in force now.
    const sunSeeds = sky === skies[0] ? seeds : seedsAt(sky.state, Infinity)
    const sunPalette = sunSeeds ? paletteFor(sunSeeds) : palette
    const coreColour = sunPalette.accent ? cssColor(sunPalette.accent) : INK
    ring(sky.root.pos, R_RECORD, 0.16)
    // The halo, and the sun: the record's mass as light, and the light every body inside it is lit by.
    hazes.push({ obj: sprite(sky.root.pos, R_RECORD * 1.7, haze, coreColour, 0.04 + 0.02 * Math.log2(1 + sky.root.mass)), node: sky.root })
    hazes.push({ obj: sprite(sky.root.pos, R_RECORD * 0.22, haze, coreColour, 0.3), node: { ...sky.root, radius: R_RECORD * 0.11 } })
    const core = new THREE.PointLight(coreColour, 0.6 * Math.log2(2 + sky.root.mass), R_RECORD * 2.6, 2)
    core.position.set(...sky.root.pos)
    world.add(core)
    label(sky.root, `${sky.name} · ${sky.root.mass} decisions`, 'sky-label--record')
    const moons = new Map<number, SkyNode>()
    moonByIndex.set(sky, moons)

    for (const sys of sky.systems) {
      const sysColour = colourOf(sys)
      ring(sys.pos, R_SYSTEM, 0.13)
      // The haze: this system's mass, as the field's scalar with depth.
      hazes.push({ obj: sprite(sys.pos, R_SYSTEM * 2.2, haze, sysColour, 0.03 + 0.03 * Math.log2(1 + sys.mass)), node: sys })
      label(sys, `${sys.name} · ${sys.mass}`, 'sky-label--system')

      for (const tgt of sys.children) {
        targetByKey.set(`${sky.name} ${tgt.key}`, tgt)
        const colour = colourOf(tgt)
        const r = R_TARGET * 0.22 * Math.cbrt(Math.max(1, tgt.mass))
        body(
          tgt,
          r,
          new THREE.MeshPhysicalMaterial({
            color: colour,
            roughness: 0.9 - 0.6 * gloss,
            metalness: 0.05 + 0.2 * gloss,
            clearcoat: 0.5 * gloss,
            clearcoatRoughness: 0.4,
            emissive: colour,
            emissiveIntensity: 0.08,
          }),
        )
        ring(tgt.pos, R_TARGET, 0.11)
        if (tgt.mass >= CONVERGE_AT) sprite(tgt.pos, R_TARGET * 3.2, spike, colour, 0.55)
        label(tgt, `${tgt.name} · ${tgt.mass}`, 'sky-label--target')

        // Orbits, then moons on them, in time order.
        const orbits = new Set<number>()
        for (const moon of tgt.children) {
          const d = Math.hypot(moon.pos[0] - tgt.pos[0], moon.pos[1] - tgt.pos[1])
          const rounded = Math.round(d * 1e4) / 1e4
          if (!orbits.has(rounded)) {
            orbits.add(rounded)
            ring(tgt.pos, rounded, 0.16)
          }
          const mat = moon.refused
            ? new THREE.MeshBasicMaterial({ color: INK, wireframe: true, transparent: true, opacity: 0.35 })
            : moon.hand === 'human'
              ? new THREE.MeshStandardMaterial({ color: INK, roughness: 0.75, emissive: INK, emissiveIntensity: 0.12 })
              : new THREE.MeshBasicMaterial({ color: INK, wireframe: true, transparent: true, opacity: 0.7 })
          body(moon, R_MOON * 0.16, mat)
          moons.set(moon.index ?? -1, moon)
          label(moon, `${(moon.index ?? 0) + 1} · ${moon.name}${moon.refused ? ' · refused' : ''} · ${moon.hand}`, 'sky-label--moon')
          // Dust: brightness is recency.
          dustPoints.push(v3(moon.pos))
          const b = 0.3 + 0.7 * ((moon.index ?? 0) / N)
          dustColours.push(INK.r * b, INK.g * b, INK.b * b)
        }
      }
    }

    // Drains: streamlines from each source toward the promoted place.
    sky.state.events.forEach((ev) => {
      if (!ev.drains) return
      const to = moons.get(ev.i)?.parent
      if (!to) return
      for (const src of ev.drains) {
        const from = moons.get(src)?.parent
        if (!from || from === to) continue
        const a = v3(from.pos)
        const b = v3(to.pos)
        const mid = a.clone().lerp(b, 0.5)
        mid.z += a.distanceTo(b) * 0.35
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32))
        const mat = new THREE.LineBasicMaterial({ color: colourOf(to), transparent: true, opacity: 0.4 })
        disposables.push(geo, mat)
        world.add(new THREE.Line(geo, mat))
      }
    })
  }

  // Dust, for every record at once.
  {
    const geo = new THREE.BufferGeometry().setFromPoints(dustPoints)
    geo.setAttribute('color', new THREE.Float32BufferAttribute(dustColours, 3))
    const mat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85 })
    disposables.push(geo, mat)
    world.add(new THREE.Points(geo, mat))
  }
  // Filaments: records joined wherever they share a target.
  {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < skies.length; i++)
      for (let j = i + 1; j < skies.length; j++)
        for (const t of skies[i].targets) {
          const twin = targetByKey.get(`${skies[j].name} ${t.key.replace(`${skies[i].name}/`, `${skies[j].name}/`)}`)
          if (twin) pts.push(v3(t.pos), v3(twin.pos))
        }
    if (pts.length) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      const mat = new THREE.LineBasicMaterial({ color: FAINT, transparent: true, opacity: 0.035 })
      disposables.push(geo, mat)
      world.add(new THREE.LineSegments(geo, mat))
    }
  }
  // You are here: the newest decision in the first record.
  {
    const first = skies[0]
    const newest = [...(moonByIndex.get(first)?.values() ?? [])].filter((m) => !m.refused).sort((a, b) => (b.index ?? 0) - (a.index ?? 0))[0]
    if (newest) {
      ring(newest.pos, R_MOON * 0.6, 0.9, KEY)
      label(newest, 'now', 'sky-label--now', new THREE.Vector3(newest.pos[0] + R_MOON * 0.6, newest.pos[1], newest.pos[2]))
    }
  }

  /* ---------- flying ---------- */

  interface Leg {
    to: THREE.Vector3
    camTo: THREE.Vector3
    ms: number
    say?: string
    /** What the leg lands on; undefined leaves the focus alone, null is the supercluster. */
    focus?: SkyNode | null
  }
  const legs: Leg[] = []
  let flight: { from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3; t0: number; ms: number; say?: string } | null = null

  /** A flight's length scales with how many orders of magnitude it crosses, so going in feels like going in. */
  const durationFor = (camTo: THREE.Vector3, to: THREE.Vector3) => {
    const d0 = Math.max(1e-4, camera.position.distanceTo(controls.target))
    const d1 = Math.max(1e-4, camTo.distanceTo(to))
    return Math.min(4200, 1300 + 900 * Math.abs(Math.log10(d1 / d0)))
  }
  const start = (leg: Leg) => {
    if (leg.focus !== undefined) focus = leg.focus?.level === 'decision' ? (leg.focus.parent ?? leg.focus) : leg.focus
    if (reduced) {
      controls.target.copy(leg.to)
      camera.position.copy(leg.camTo)
      if (leg.say) say(leg.say)
      request()
      return
    }
    flight = { from: controls.target.clone(), to: leg.to, camFrom: camera.position.clone(), camTo: leg.camTo, t0: performance.now(), ms: leg.ms, say: leg.say }
    if (leg.say) say(leg.say)
    request()
  }
  const queue = (leg: Leg) => {
    if (flight) legs.push(leg)
    else start(leg)
  }
  /** Where to stand to see a node: along the current line of sight, a few radii out, keeping the view oblique. */
  const standFor = (node: SkyNode): THREE.Vector3 => {
    const to = v3(node.pos)
    const d = node.level === 'record' ? 2.6 : node.level === 'system' ? R_SYSTEM * 2.8 : node.level === 'target' ? R_TARGET * 3.2 : R_TARGET * 0.5
    const dir = camera.position.clone().sub(controls.target).normalize()
    // Never look straight down the plane's normal, or discs collapse to circles; keep at least a low elevation.
    if (Math.abs(dir.z) > 0.92) dir.set(0.35, -0.5, 0.78).normalize()
    return to.clone().add(dir.multiplyScalar(d))
  }
  const legFor = (node: SkyNode, say?: string): Leg => {
    const to = v3(node.pos)
    const camTo = standFor(node)
    return { to, camTo, ms: durationFor(camTo, to), say }
  }
  const flyTo = (node: SkyNode) => {
    legs.length = 0
    flight = null
    focus = node.level === 'decision' ? (node.parent ?? node) : node
    start(legFor(node))
  }
  const home = () => {
    legs.length = 0
    flight = null
    focus = null
    const to = new THREE.Vector3(0, 0, 0)
    const camTo = v3(HOME_FROM)
    start({ to, camTo, ms: durationFor(camTo, to), say: 'out to the supercluster' })
  }
  const journey = (direction: 'in' | 'out') => {
    legs.length = 0
    flight = null
    const first = skies[0]
    // The ladder goes to the most-decided target in the record, through its own family.
    const tgt = first.targets.reduce((a, b) => (b.mass > a.mass ? b : a), first.targets[0])
    const sys = tgt?.parent
    const moon = tgt?.children[tgt.children.length - 1]
    const ladder: Array<[SkyNode | undefined, string]> = [
      [first.root, `into ${first.name}`],
      [sys, `into ${sys?.name ?? 'a system'}`],
      [tgt, `to ${tgt?.name ?? 'a target'}`],
      [moon, 'to its history'],
    ]
    const steps = direction === 'in' ? ladder : [...ladder].reverse().slice(1)
    for (const [node, say] of steps) if (node) queue({ ...legFor(node, say), focus: node })
    if (direction === 'out') queue({ to: new THREE.Vector3(0, 0, 0), camTo: v3(HOME_FROM), ms: 2600, say: 'out to the supercluster', focus: null })
  }

  const ray = new THREE.Raycaster()
  const onClick = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect()
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(p, camera)
    const hit = ray.intersectObjects(pickable, false)[0]
    if (hit?.object.userData.node) flyTo(hit.object.userData.node as SkyNode)
  }
  canvas.addEventListener('click', onClick)

  /* ---------- gestures: in and out ---------- */

  let lastKey = ''

  /** What the camera is going into or coming out of. Starts at nothing: the supercluster. */
  let focus: SkyNode | null = null
  const pointer = new THREE.Vector2(0, 0)
  const onPointerMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  }
  canvas.addEventListener('pointermove', onPointerMove)

  /** The point under the pointer on the plane through the target that faces the camera: what a zoom keeps still. */
  const anchorUnder = (ndc: THREE.Vector2): THREE.Vector3 => {
    ray.setFromCamera(ndc, camera)
    const normal = camera.position.clone().sub(controls.target).normalize()
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, controls.target)
    const out = new THREE.Vector3()
    return ray.ray.intersectPlane(plane, out) ? out : controls.target.clone()
  }
  const nearestChild = (node: SkyNode | null, to: THREE.Vector3): SkyNode | null => {
    const pool = node ? node.children : skies.map((s) => s.root)
    let best: SkyNode | null = null
    let bestD = Infinity
    for (const c of pool) {
      const d = to.distanceTo(v3(c.pos))
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    return best
  }
  /** The distance at which a level begins, from the readout's own ladder, so the gesture and the readout agree. */
  const enters = (level: SkyNode['level']) => (level === 'record' ? 3.2 : level === 'system' ? 1.1 : level === 'target' ? R_SYSTEM * 1.6 : R_TARGET * 1.8)
  let drift: { to: THREE.Vector3; t0: number; ms: number } | null = null
  const settleOn = (node: SkyNode | null) => {
    if (node === focus) return
    focus = node
    lastKey = ''
    if (node) drift = { to: v3(node.pos), t0: performance.now(), ms: reduced ? 0 : 520 }
  }
  /** Walk the ladder: after a zoom, the focus is whatever level the distance says, nearest to where we are looking. */
  const refocus = () => {
    const d = camera.position.distanceTo(controls.target)
    const at = controls.target
    // Out: while the distance is beyond the level we are focused on, climb.
    while (focus && d >= enters(focus.level)) focus = focus.parent ?? null
    // In: while a child's level has begun, descend to the nearest one.
    for (;;) {
      const childLevel: SkyNode['level'] | null = !focus ? 'record' : focus.level === 'record' ? 'system' : focus.level === 'system' ? 'target' : null
      if (!childLevel || d >= enters(childLevel)) break
      const next = nearestChild(focus, at)
      if (!next) break
      settleOn(next)
    }
    lastKey = ''
  }
  /** Zoom by a factor (< 1 goes in), keeping the point under `ndc` still on the way in and easing toward the parent on the way out. */
  const zoomBy = (factor: number, ndc: THREE.Vector2) => {
    legs.length = 0
    flight = null
    const d0 = camera.position.distanceTo(controls.target)
    const d1 = Math.min(MAX_D, Math.max(MIN_D, d0 * factor))
    const f = d1 / d0
    const dir = camera.position.clone().sub(controls.target).normalize()
    if (f < 1) {
      const anchor = anchorUnder(ndc)
      controls.target.copy(anchor.clone().add(controls.target.clone().sub(anchor).multiplyScalar(f)))
    } else if (focus?.parent || (focus && skies.length)) {
      const home = focus.parent ? v3(focus.parent.pos) : v3(focus.pos)
      controls.target.lerp(home, Math.min(1, (1 - 1 / f) * 0.6))
    }
    camera.position.copy(controls.target).add(dir.multiplyScalar(d1))
    refocus()
    request()
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    // A trackpad pinch arrives as a wheel with ctrlKey; it deserves a gentler scale than a scroll.
    const k = e.ctrlKey ? 0.012 : e.deltaMode === 1 ? 0.06 : 0.0022
    zoomBy(Math.exp(e.deltaY * k), pointer)
  }
  canvas.addEventListener('wheel', onWheel, { passive: false })
  // Two fingers: a pinch, anchored between them.
  let pinch: { d: number; mid: THREE.Vector2 } | null = null
  const touchInfo = (e: TouchEvent) => {
    const r = canvas.getBoundingClientRect()
    const [a, b] = [e.touches[0], e.touches[1]]
    const mid = new THREE.Vector2((((a.clientX + b.clientX) / 2 - r.left) / r.width) * 2 - 1, -(((a.clientY + b.clientY) / 2 - r.top) / r.height) * 2 + 1)
    return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mid }
  }
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) pinch = touchInfo(e)
  }
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 2 || !pinch) return
    e.preventDefault()
    const now = touchInfo(e)
    if (now.d > 0 && pinch.d > 0) zoomBy(pinch.d / now.d, now.mid)
    pinch = now
  }
  const onTouchEnd = () => {
    pinch = null
  }
  canvas.addEventListener('touchstart', onTouchStart, { passive: true })
  canvas.addEventListener('touchmove', onTouchMove, { passive: false })
  canvas.addEventListener('touchend', onTouchEnd)
  canvas.addEventListener('touchcancel', onTouchEnd)
  // Keys: the same gesture for a hand on a keyboard.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === '=' || e.key === '+') zoomBy(0.8, new THREE.Vector2(0, 0))
    else if (e.key === 'ArrowDown' || e.key === '-' || e.key === '_') zoomBy(1.25, new THREE.Vector2(0, 0))
    else return
    e.preventDefault()
  }
  canvas.addEventListener('keydown', onKey)
  canvas.tabIndex = 0

  /* ---------- level of detail, and the readout ---------- */

  let journeyWord: string | undefined
  const say = (word: string) => {
    journeyWord = word
    lastKey = ''
  }
  const updateDetail = () => {
    const d = camera.position.distanceTo(controls.target)
    const tan = Math.tan((camera.fov / 2) * (Math.PI / 180))
    for (const { obj, node } of labelled) {
      const dist = camera.position.distanceTo(v3(node.pos))
      const apparent = node.radius / (dist * tan)
      const [lo, hi] = node.level === 'record' ? [0.02, 0.9] : node.level === 'system' ? [0.05, 0.75] : node.level === 'target' ? [0.06, 0.7] : [0.12, 3]
      obj.visible = apparent > lo && apparent < hi
    }
    // Haze thins as you approach and is gone once you are inside it, so it never fogs the bodies it stands for.
    for (const { obj, node } of hazes) {
      const dist = camera.position.distanceTo(v3(node.pos))
      const apparent = node.radius / (dist * tan)
      const m = obj.material as THREE.SpriteMaterial
      const full = m.userData.full ?? (m.userData.full = m.opacity)
      const fade = apparent < 0.35 ? 1 : apparent > 0.7 ? 0 : 1 - (apparent - 0.35) / 0.35
      m.opacity = full * fade
      m.visible = fade > 0
    }
    const lv = levelFor(d)
    const k = `${lv.name}:${d.toFixed(3)}:${journeyWord ?? ''}:${focus?.key ?? ''}`
    if (k !== lastKey) {
      lastKey = k
      onReadout({ level: lv.name, what: lv.what, distance: d, journey: journeyWord, focus: focus?.name })
    }
  }

  /* ---------- frame ---------- */

  let pending = false
  let alive = true
  const frame = (now: number) => {
    pending = false
    if (!alive) return
    let moving = controls.update()
    if (drift) {
      // The focus settles under the camera without changing the distance: the ladder is walked, not jumped.
      const k = drift.ms === 0 ? 1 : Math.min(1, (now - drift.t0) / drift.ms)
      const e = k * k * (3 - 2 * k)
      const d = camera.position.distanceTo(controls.target)
      const dir = camera.position.clone().sub(controls.target).normalize()
      controls.target.lerp(drift.to, e * 0.35)
      camera.position.copy(controls.target).add(dir.multiplyScalar(d))
      if (k >= 1) drift = null
      moving = true
    }
    if (flight) {
      const k = Math.min(1, (now - flight.t0) / flight.ms)
      const e = k * k * (3 - 2 * k)
      controls.target.lerpVectors(flight.from, flight.to, e)
      // Distance eases in the log, so the approach decelerates as the scale shrinks.
      const d0 = flight.camFrom.distanceTo(flight.from)
      const d1 = flight.camTo.distanceTo(flight.to)
      const dirFrom = flight.camFrom.clone().sub(flight.from).normalize()
      const dirTo = flight.camTo.clone().sub(flight.to).normalize()
      const dir = dirFrom.lerp(dirTo, e).normalize()
      const dist = Math.exp(THREE.MathUtils.lerp(Math.log(Math.max(1e-4, d0)), Math.log(Math.max(1e-4, d1)), e))
      camera.position.copy(controls.target).add(dir.multiplyScalar(dist))
      if (k >= 1) {
        flight = null
        const next = legs.shift()
        if (next) start(next)
        else journeyWord = undefined
      }
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
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()
  request()

  return {
    flyTo,
    home,
    journey,
    look: (from, at) => {
      legs.length = 0
      flight = null
      camera.position.set(...from)
      controls.target.set(...at)
      request()
    },
    resize,
    dispose: () => {
      alive = false
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('pointermove', request)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
      canvas.removeEventListener('keydown', onKey)
      controls.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      labelsEl.replaceChildren()
    },
  }
}
