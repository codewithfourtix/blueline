// Scene — owns the Three.js renderer, camera, lighting and post-processing.
//
// World-space convention: the simulation works in a 2-D (x, y) plane; we map it
// onto the ground plane as (x, 0, y) with +Y up. A smooth chase camera trails
// the ego like the Tesla "3D driving visualisation", and an UnrealBloomPass
// gives the ego body and the blue path their signature glow.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { THEME } from "./theme.ts";
import { smoothTowards } from "../core/math.ts";

export type CameraMode = "chase" | "top";

export class Scene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  cameraMode: CameraMode = "chase";

  // Smoothed camera target state.
  private camPos = new THREE.Vector3(0, 30, -40);
  private camLook = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.background = this.makeGradientBackground();
    this.scene.fog = new THREE.Fog(THEME.fog, 80, 360);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.copy(this.camPos);

    this.setupLights();
    this.setupGround();

    // Post-processing chain: render -> bloom -> output(color-correct).
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5, // strength — subtle glow, keep lane lines crisp not blown out
      0.5, // radius
      0.9, // threshold — only the brightest (emissive) things bloom
    );
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener("resize", () => this.onResize());
  }

  /** Vertical navy gradient background — the Tesla "sky", never pure black. */
  private makeGradientBackground(): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
    g.addColorStop(0.0, hex(THEME.bgTop));
    g.addColorStop(0.62, hex(THEME.background));
    g.addColorStop(1.0, hex(THEME.bgHorizon));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xaebfff, 0x0a0e14, 0.75);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xcfe0ff, 1.0);
    key.position.set(60, 120, 40);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x44557a, 0.45);
    fill.position.set(-50, 60, -30);
    this.scene.add(fill);
  }

  private setupGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshStandardMaterial({ color: THEME.ground, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    this.scene.add(ground);

    // A faint grid over the terrain gives motion & depth cues; fog fades it out.
    const grid = new THREE.GridHelper(6000, 300, THEME.grid, THEME.grid);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    grid.position.y = -0.04;
    this.scene.add(grid);
  }

  add(obj: THREE.Object3D): void {
    this.scene.add(obj);
  }

  /** Reposition the chase/top camera to follow the ego smoothly. */
  updateCamera(egoX: number, egoY: number, egoYaw: number, dt: number): void {
    const fx = Math.cos(egoYaw);
    const fz = Math.sin(egoYaw);
    let targetPos: THREE.Vector3;
    let targetLook: THREE.Vector3;

    if (this.cameraMode === "chase") {
      // Behind and above, looking ahead of the car.
      targetPos = new THREE.Vector3(egoX - fx * 16, 9, egoY - fz * 16);
      targetLook = new THREE.Vector3(egoX + fx * 12, 1.5, egoY + fz * 12);
    } else {
      targetPos = new THREE.Vector3(egoX - fx * 2, 60, egoY - fz * 2);
      targetLook = new THREE.Vector3(egoX + fx * 8, 0, egoY + fz * 8);
    }

    const rate = 6;
    this.camPos.x = smoothTowards(this.camPos.x, targetPos.x, rate, dt);
    this.camPos.y = smoothTowards(this.camPos.y, targetPos.y, rate, dt);
    this.camPos.z = smoothTowards(this.camPos.z, targetPos.z, rate, dt);
    this.camLook.x = smoothTowards(this.camLook.x, targetLook.x, rate, dt);
    this.camLook.y = smoothTowards(this.camLook.y, targetLook.y, rate, dt);
    this.camLook.z = smoothTowards(this.camLook.z, targetLook.z, rate, dt);

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  render(): void {
    this.composer.render();
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }
}
