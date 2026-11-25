import * as THREE from "three";
import { makeCharacter, makePaddle, disposeCharacter } from "./characters";
import { DEFAULT_CHARACTERS } from "../../shared/characters";
export { makePaddle } from "./characters";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { axisAngle, mul, type Quat, type Vec3 } from "../../shared/quat";
import type { SwingKind } from "../../shared/gestures/swing";

/** The phone's world has z up; the screen's has y up and looks down -z. */
const TO_SCREEN: Quat = axisAngle([1, 0, 0], -Math.PI / 2);

export const SLOT_COLORS = [0xc76b50, 0x7a9c83];

/**
 * A paddle modelled in the phone's own axes (handle towards the bottom
 * edge, face towards the screen), so a phone orientation applies to it directly.
 */

export function setFromPhone(target: THREE.Object3D, q: Quat) {
  const [x, y, z, w] = mul(TO_SCREEN, q);
  target.quaternion.set(x, y, z, w);
}

export type CourtView = "behind-0" | "behind-1" | "side";

export interface CourtFrame {
  ball: Vec3;
  players: { x: number; z: number; swingAge: number; kind: SwingKind; power?: number }[];
  /** Latest phone orientation for each side that has a phone. */
  paddles: (Quat | undefined)[];
  /** Hide the far player (practice against the ball machine). */
  solo: boolean;
}

/** Court dimensions the picture needs; the game passes its own in. */
export interface CourtSize {
  halfWidth: number;
  halfLength: number;
  kitchen: number;
  netHeight: number;
}

const SWING_SECONDS = 0.66;

/** The 3D picture on the computer: renderer, lights and whatever is on show. */
export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  private renderer: THREE.WebGLRenderer;
  /** Close-up paddles shown in the lobby, one per phone. */
  private lobby = new THREE.Group();
  private lobbyPaddles: THREE.Group[] = [];
  private mascot?: ReturnType<typeof makeCharacter>;
  private selectedCharacters: string[] = [...DEFAULT_CHARACTERS];
  private swingKick = [0, 0];
  private court = new THREE.Group();
  private ball!: THREE.Mesh;
  private ballShadow!: THREE.Mesh;
  private ballMarker!: THREE.Mesh;
  private characters: ReturnType<typeof makeCharacter>[] = [];
  /** Fades out a sudden correction to the ball's position (online play). */
  private ballOffset = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene.background = new THREE.Color(0xf6f1e7);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb4bea1, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(6, 14, 8);
    sun.castShadow = true;
    sun.shadow.normalBias = 0.025;
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
    this.previewCharacter(DEFAULT_CHARACTERS[0]);
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
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0.9, 2.6);
    this.camera.lookAt(0, 0.1, 0);
    this.lobbyPaddles.forEach((paddle, slot) => {
      paddle.visible = slots.includes(slot);
      const spread = slots.length > 1 ? (slot === 0 ? -0.75 : 0.75) : 0;
      paddle.parent!.position.set(spread, -0.25, 0);
    });
  }

  previewCharacter(id: string) {
    if (this.mascot) { this.lobby.remove(this.mascot.root); disposeCharacter(this.mascot); }
    this.mascot = makeCharacter(id);
    this.mascot.root.rotation.y = Math.PI - 0.2;
    this.mascot.root.position.set(-0.85, -1.02, -0.3);
    this.mascot.root.scale.setScalar(0.66);
    this.mascot.paddle.rotation.x = -Math.PI / 3;
    this.lobby.add(this.mascot.root);
  }

  setCharacter(side: number, id: string) {
    this.selectedCharacters[side] = id;
    const previous = this.characters[side];
    if (!previous) return;
    const next = makeCharacter(id);
    next.root.position.copy(previous.root.position);
    next.root.rotation.copy(previous.root.rotation);
    next.root.visible = previous.root.visible;
    this.court.remove(previous.root);
    disposeCharacter(previous);
    this.characters[side] = next;
    this.court.add(next.root);
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

  // ---- the court ----------------------------------------------------------

  buildCourt(size: CourtSize) {
    const { halfWidth: w, halfLength: l, kitchen, netHeight } = size;
    const flat = (width: number, depth: number, color: number, y: number) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = y;
      mesh.receiveShadow = true;
      this.court.add(mesh);
      return mesh;
    };
    flat(100, 100, 0xdce5ce, 0); // grass
    flat(w * 2 + 5, l * 2 + 7, 0xe7c5a9, 0.004); // apron
    flat(w * 2, l * 2, 0x739c8a, 0.008); // playing surface
    flat(w * 2, kitchen * 2, 0xa6c3a4, 0.012); // the kitchen (non-volley zone)
    const line = (x: number, z: number, width: number, depth: number) =>
      (flat(width, depth, 0xffffff, 0.016).position.set(x, 0.016, z));
    const T = 0.05;
    for (const sx of [-1, 1]) line(sx * w, 0, T, l * 2);
    for (const sz of [-1, 1]) {
      line(0, sz * l, w * 2 + T, T);
      line(0, sz * kitchen, w * 2, T);
      line(0, sz * (kitchen + l) / 2, T, l - kitchen);
    }

    // Real open mesh keeps the far player's ball visible through the net.
    const strands: number[] = [];
    for (let x = -w - 0.3; x <= w + 0.3; x += 0.12)
      strands.push(x, 0, 0, x, netHeight, 0);
    for (let y = 0; y <= netHeight; y += 0.1)
      strands.push(-w - 0.3, y, 0, w + 0.3, y, 0);
    const net = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(strands, 3)),
      new THREE.LineBasicMaterial({ color: 0x243c45, transparent: true, opacity: 0.65 }),
    );
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(w * 2 + 0.6, 0.06, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    tape.position.y = netHeight;
    this.court.add(net, tape);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, netHeight + 0.06, 10),
        new THREE.MeshStandardMaterial({ color: 0x1b2433 }),
      );
      post.position.set(sx * (w + 0.3), (netHeight + 0.06) / 2, 0);
      post.castShadow = true;
      this.court.add(post);
    }
    // Original Blender architecture; gameplay geometry remains exact and independent.
    new GLTFLoader().load('/models/pickle-garden.glb', ({ scene }) => {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      this.court.add(scene);
    }, undefined, (error) => console.warn('Arena model unavailable; using the court alone.', error));

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0xffce38, emissive: 0x5c3500 }),
    );
    this.ball.castShadow = true;
    // A dark blob under the ball: the main cue for where it will land.
    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 18),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.22, 32),
      new THREE.MeshBasicMaterial({ color: 0x96503f, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    this.ballMarker.rotation.x = -Math.PI / 2;
    this.court.add(this.ball, this.ballShadow, this.ballMarker);

    SLOT_COLORS.forEach((color, side) => {
      const character = makeCharacter(this.selectedCharacters[side]);
      if (side === 0) character.root.rotation.y = 0; // faces -z, towards the net
      else character.root.rotation.y = Math.PI;
      this.characters[side] = character;
      this.court.add(character.root);
    });
    this.court.visible = false;
    this.scene.add(this.court);
  }

  showCourt(view: CourtView) {
    this.lobby.visible = false;
    this.court.visible = true;
    this.scene.background = new THREE.Color(0xf6f1e7);
    // A long lens from far away keeps both players upright in the side view.
    this.camera.fov = view === "side" ? 24 : 50;
    this.camera.updateProjectionMatrix();
    if (view === "side") {
      this.camera.position.set(-34, 15, 0);
      this.camera.lookAt(0, 0.4, 0);
    } else {
      const sign = view === "behind-0" ? 1 : -1;
      this.camera.position.set(0, 6.4, sign * 14.6);
      this.camera.lookAt(0, 0.9, -sign * 1.5);
    }
  }

  hideCourt() {
    this.court.visible = false;
    this.scene.background = new THREE.Color(0xf6f1e7);
  }

  /** Call when the ball's position was corrected, to blend instead of jump. */
  smoothBallFrom(previous: Vec3, now: Vec3) {
    this.ballOffset.set(previous[0] - now[0], previous[1] - now[1], previous[2] - now[2]);
  }

  drawCourt(frame: CourtFrame, dt: number) {
    this.ballOffset.multiplyScalar(Math.exp(-dt * 12));
    this.ball.position.set(...frame.ball).add(this.ballOffset);
    this.ballShadow.position.set(this.ball.position.x, 0.02, this.ball.position.z);
    this.ballShadow.scale.setScalar(1 + this.ball.position.y * 0.25);
    // Marks the current ground projection, not a predicted landing position.
    this.ballMarker.position.set(this.ball.position.x, 0.025, this.ball.position.z);

    frame.players.forEach((p, side) => {
      const character = this.characters[side];
      const { root, torso, shoulder, elbow, freeShoulder, paddle, legs } = character;
      root.visible = !(frame.solo && side === 1);
      const dx = p.x - root.position.x, dz = p.z - root.position.z;
      const distance = Math.hypot(dx, dz);
      const moving = dt > 0 && distance / dt > 0.15 && distance < 1;
      if (moving) character.stride += distance * 9;
      const step = moving ? Math.sin(character.stride) : 0;
      legs.forEach((leg, i) => { leg.rotation.x = step * (i === 0 ? 1 : -1) * .65; });
      const breathing = Math.sin(performance.now() * .003 + side) * .008;
      root.position.set(p.x, moving ? Math.abs(step) * .045 : breathing, p.z);
      const power = p.power ?? .5;
      const t = p.swingAge / (SWING_SECONDS - power * .16);
      // Wind-up, contact, follow-through, then blend back to ready stance.
      const envelope = t < 1 ? Math.sin(Math.PI * Math.max(0,t)) : 0;
      const stroke = t < 1 ? Math.sin(Math.PI * Math.min(1, t / .68)) : 0;
      const follow = t < 1 ? Math.sin(Math.PI * Math.max(0, (t - .3) / .7)) : 0;
      const direction = p.kind === "backhand" ? -1 : 1;
      const amplitude = .65 + power * .55;
      torso.rotation.set(moving ? .08 : 0, direction * (stroke * -.45 + follow * .7) * amplitude, moving ? -dx / Math.max(distance,.01) * .06 : 0);
      torso.position.y = .65 - envelope * .04;
      freeShoulder.rotation.set(step * -.3 + envelope * .45, -direction * envelope * .35, -.15 - envelope * .35);
      shoulder.rotation.set(.2, -.25, -.1);
      elbow.rotation.set(.3, 0, 0);
      if (t < 1) {
        if (p.kind === "lob") shoulder.rotation.x += (stroke * -.6 + follow * 1.4) * amplitude;
        else if (p.kind === "smash") shoulder.rotation.x += (stroke * 2.3 - follow * .8) * amplitude;
        else shoulder.rotation.y += direction * (stroke * -1.35 + follow * 2.2) * amplitude;
        elbow.rotation.x += envelope * .55;
        elbow.rotation.y = direction * (stroke * -.5 + follow * .45);
        paddle.rotation.set(-Math.PI/2 + envelope * .4, 0, direction * follow * .3);
        legs[side === 0 ? 1 : 0].rotation.x += envelope * .2;
      } else {
        const q = frame.paddles[side];
        if (q) setFromPhone(paddle, q);
        else paddle.rotation.set(-Math.PI / 2 + .5, 0, 0);
      }
    });
  }

  render(dt: number) {
    this.swingKick.forEach((kick, slot) => {
      this.swingKick[slot] = Math.max(0, kick - dt * 3);
      this.lobbyPaddles[slot].parent!.position.z = -kick * 0.8;
    });
    this.renderer.render(this.scene, this.camera);
  }
}
