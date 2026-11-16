import * as THREE from "three";
import { axisAngle, mul, type Quat } from "../../shared/quat";

/** The phone's world has z up; the screen's has y up and looks down -z. */
const TO_SCREEN: Quat = axisAngle([1, 0, 0], -Math.PI / 2);

export const SLOT_COLORS = [0x4fd1a5, 0xffb454];

/**
 * A paddle modelled in the phone's own axes (handle towards the bottom
 * edge, face towards the screen), so a phone orientation applies to it directly.
 */
export function makePaddle(color: number): THREE.Group {
  const paddle = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.26, 0.016),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
  );
  face.position.y = 0.2;
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.27, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x1b2433 }),
  );
  rim.position.y = 0.2;
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.02, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.9 }),
  );
  paddle.add(rim, face, handle);
  return paddle;
}

export function setFromPhone(target: THREE.Object3D, q: Quat) {
  const [x, y, z, w] = mul(TO_SCREEN, q);
  target.quaternion.set(x, y, z, w);
}

/** The 3D picture on the computer: renderer, lights and whatever is on show. */
export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  private renderer: THREE.WebGLRenderer;
  /** Close-up paddles shown in the lobby, one per phone. */
  private lobby = new THREE.Group();
  private lobbyPaddles: THREE.Group[] = [];
  private swingKick = [0, 0];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.scene.background = new THREE.Color(0x10151f);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(6, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    this.scene.add(sun);

    SLOT_COLORS.forEach((color, slot) => {
      const paddle = makePaddle(color);
      paddle.scale.setScalar(2.2);
      paddle.visible = false;
      const holder = new THREE.Group();
      holder.add(paddle);
      this.lobby.add(holder);
      this.lobbyPaddles[slot] = paddle;
    });
    this.scene.add(this.lobby);
    this.showLobby([]);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvas);
    resize();
  }

  /** Lobby view: a big paddle for each connected phone. */
  showLobby(slots: number[]) {
    this.lobby.visible = true;
    this.camera.position.set(0, 0.9, 2.6);
    this.camera.lookAt(0, 0.1, 0);
    this.lobbyPaddles.forEach((paddle, slot) => {
      paddle.visible = slots.includes(slot);
      const spread = slots.length > 1 ? (slot === 0 ? -0.75 : 0.75) : 0;
      paddle.parent!.position.set(spread, -0.25, 0);
    });
  }

  hideLobby() {
    this.lobby.visible = false;
  }

  setLobbyPaddle(slot: number, q: Quat) {
    setFromPhone(this.lobbyPaddles[slot], q);
  }

  /** A little punch forward so a swing reads on screen. */
  kickLobbyPaddle(slot: number, power: number) {
    this.swingKick[slot] = 0.3 + power * 0.7;
  }

  render(dt: number) {
    this.swingKick.forEach((kick, slot) => {
      this.swingKick[slot] = Math.max(0, kick - dt * 3);
      this.lobbyPaddles[slot].parent!.position.z = -kick * 0.8;
    });
    this.renderer.render(this.scene, this.camera);
  }
}
