import type * as THREE from 'three';
import { WebGLTier } from '../webgl-capability.service';

// --- Composition constants ---------------------------------------------------
// Every form is normalised to the same bounding radius so the three divisions
// read as equals. The orbit is wide enough that a form never intersects the
// centre ring, and the camera is framed to keep the whole rig inside the canvas.

/** Bounding radius each of the three forms is scaled to. */
const FORM_RADIUS = 0.42;
/** Radius of the still brass ring at the centre. */
const RING_RADIUS = 0.5;
/** Distance from the centre at which the forms orbit. */
const ORBIT_RADIUS = 1.5;
/** Seconds per full revolution — considered, not carousel. */
const ORBIT_PERIOD = 42;

/**
 * "The Specimen Table" — three forms in slow orbit around a still brass ring.
 *
 * All geometry is generated procedurally: zero bytes of model payload, no Draco
 * decoder, no .glb fetch. See docs/06-3d-concept.md for the rationale.
 *
 * The scene owns nothing outside itself and exposes an explicit `dispose()`;
 * `SceneHostDirective` guarantees it is called.
 */
export class HeroOrbitScene {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private rig!: THREE.Group;
  private forms: THREE.Mesh[] = [];
  private disposables: { dispose(): void }[] = [];

  private pointer = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };
  private elapsed = 0;

  constructor(
    private readonly three: typeof THREE,
    private readonly canvas: HTMLCanvasElement,
    private readonly tier: WebGLTier,
  ) {}

  async init(): Promise<void> {
    const T = this.three;
    const lite = this.tier === 'lite';

    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      antialias: !lite,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
    // Framed so the full orbit plus the largest form stays inside the canvas at
    // a 1:1 aspect, with margin for the pointer tilt.
    this.camera.position.set(0, 0.35, 6.4);
    this.camera.lookAt(0, 0, 0);

    this.rig = new T.Group();
    this.scene.add(this.rig);

    this.buildLights();
    this.buildRing();
    this.buildForms(lite);
  }

  private buildLights(): void {
    const T = this.three;

    const hemi = new T.HemisphereLight(0xfbf9f5, 0x0f2019, 0.85);
    this.scene.add(hemi);

    const key = new T.DirectionalLight(0xfff6e8, 1.6);
    key.position.set(-3, 4, 5);
    this.scene.add(key);

    // One tinted point light per division — the same three accents as the CSS.
    const accents: readonly [number, [number, number, number]][] = [
      [0xa85d33, [2.6, 0.6, 1.4]], // food — copper
      [0x2f6b70, [-2.4, -0.4, 1.6]], // packaging — slate teal
      [0x2a5942, [0.4, 2.4, -1.2]], // hygiene — forest
    ];
    for (const [color, [x, y, z]] of accents) {
      const light = new T.PointLight(color, 12, 12, 2);
      light.position.set(x, y, z);
      this.scene.add(light);
    }
  }

  /** The still centre: the standard the three forms are measured against. */
  private buildRing(): void {
    const T = this.three;
    const geometry = new T.TorusGeometry(RING_RADIUS, 0.028, 20, 96);
    const material = new T.MeshStandardMaterial({
      color: 0xc9a227,
      metalness: 0.95,
      roughness: 0.28,
    });
    const ring = new T.Mesh(geometry, material);
    ring.rotation.x = Math.PI * 0.42;
    this.scene.add(ring);
    this.disposables.push(geometry, material);
  }

  /**
   * Scales a geometry so its bounding sphere matches `FORM_RADIUS`.
   *
   * The three forms are built from different primitives (a lathe, a cylinder and
   * a displaced plane) whose natural sizes differ by more than 2×. Without this
   * the vessel reads as a giant bottle next to two small trinkets, which is not
   * the composition — the three divisions are meant to carry equal weight.
   */
  private normalize(geometry: THREE.BufferGeometry): void {
    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere?.radius ?? 1;
    if (radius > 0) {
      geometry.scale(FORM_RADIUS / radius, FORM_RADIUS / radius, FORM_RADIUS / radius);
      geometry.computeBoundingSphere();
    }
    // Re-centre so each form orbits about its own middle rather than its base.
    geometry.center();
  }

  private buildForms(lite: boolean): void {
    const T = this.three;

    // A — vessel (food). Lathed bottle silhouette, warm amber glass.
    // Explicit profile points rather than a formula: a bottle needs a base, a
    // shoulder and a neck, and a single sine gives a lemon.
    const silhouette: readonly (readonly [number, number])[] = [
      [0.0, -0.75], [0.30, -0.75], [0.34, -0.70], [0.35, -0.20],
      [0.34, 0.10], [0.30, 0.28], [0.20, 0.42], [0.13, 0.52],
      [0.12, 0.68], [0.14, 0.75], [0.0, 0.75],
    ];
    const profile = silhouette.map(([x, y]) => new T.Vector2(x, y));
    const vesselGeo = new T.LatheGeometry(profile, lite ? 24 : 48);

    // B — faceted container (packaging). The verrine, the company's signature line.
    const verrineGeo = new T.CylinderGeometry(0.34, 0.22, 0.62, lite ? 6 : 8, 1, false);

    // C — folded sheet (hygiene). A displaced plane: paper, film, material.
    const sheetGeo = new T.PlaneGeometry(0.8, 0.8, lite ? 8 : 24, lite ? 8 : 24);
    const position = sheetGeo.attributes['position'];
    if (position) {
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        position.setZ(i, Math.sin(x * 3.1) * 0.11 + Math.cos(y * 2.4) * 0.07);
      }
      sheetGeo.computeVertexNormals();
    }

    // `lite` drops transmission entirely — refraction is the single most
    // expensive thing in this scene on a mid-range phone.
    const vesselMat = lite
      ? new T.MeshStandardMaterial({ color: 0xd9a05b, metalness: 0.1, roughness: 0.25 })
      : new T.MeshPhysicalMaterial({
          color: 0xe0ab63,
          transmission: 0.92,
          thickness: 0.6,
          ior: 1.45,
          roughness: 0.08,
          metalness: 0,
        });

    const verrineMat = lite
      ? new T.MeshStandardMaterial({ color: 0xbcd4d6, metalness: 0.05, roughness: 0.15 })
      : new T.MeshPhysicalMaterial({
          color: 0xffffff,
          transmission: 0.9,
          thickness: 0.35,
          ior: 1.5,
          roughness: 0.05,
          metalness: 0,
        });

    const sheetMat = new T.MeshStandardMaterial({
      color: 0xf6f3ec,
      roughness: 0.72,
      metalness: 0.02,
      side: T.DoubleSide,
    });

    // Equalise the three silhouettes. Without this the vessel is ~2.4x the
    // sheet's bounding radius and visually dominates the composition.
    for (const geometry of [vesselGeo, verrineGeo, sheetGeo]) {
      this.normalize(geometry);
    }

    const specs: readonly [THREE.BufferGeometry, THREE.Material, number][] = [
      [vesselGeo, vesselMat, 0],
      [verrineGeo, verrineMat, (Math.PI * 2) / 3],
      [sheetGeo, sheetMat, (Math.PI * 4) / 3],
    ];

    for (const [geometry, material, phase] of specs) {
      const mesh = new T.Mesh(geometry, material);
      mesh.userData['phase'] = phase;
      this.rig.add(mesh);
      this.forms.push(mesh);
      this.disposables.push(geometry, material);
    }
  }

  resize(width: number, height: number, pixelRatio: number): void {
    if (width === 0 || height === 0) {
      return;
    }
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Normalised pointer position, −1…1. Ignored on `lite`. */
  setPointer(x: number, y: number): void {
    if (this.tier === 'lite' || this.tier === 'static') {
      return;
    }
    this.target.x = x;
    this.target.y = y;
  }

  update(delta: number): void {
    this.elapsed += delta;

    const base = (this.elapsed / ORBIT_PERIOD) * Math.PI * 2;

    for (const form of this.forms) {
      const phase = (form.userData['phase'] as number) ?? 0;
      const angle = base + phase;
      form.position.x = Math.cos(angle) * ORBIT_RADIUS;
      form.position.z = Math.sin(angle) * ORBIT_RADIUS;
      // Independent float, phase-offset so they never bob in unison. Kept well
      // under the ring radius so a form never clips the centre mark.
      form.position.y = Math.sin(this.elapsed * 0.7 + phase * 1.7) * 0.14;
      form.rotation.y += delta * 0.08;
      form.rotation.x = Math.sin(this.elapsed * 0.35 + phase) * 0.12;
    }

    // Cursor tilt, lerped so it never snaps.
    this.pointer.x += (this.target.x - this.pointer.x) * 0.06;
    this.pointer.y += (this.target.y - this.pointer.y) * 0.06;
    this.rig.rotation.y = this.pointer.x * 0.05;
    this.rig.rotation.x = this.pointer.y * 0.05;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Releases every GPU resource this scene created and forces the context lost,
   * so a route change cannot leak a WebGL context.
   */
  dispose(): void {
    for (const item of this.disposables) {
      item.dispose();
    }
    this.disposables = [];
    this.forms = [];
    this.scene?.clear();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }
}
