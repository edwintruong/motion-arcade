import * as THREE from "three";
import { axisAngle, mul, type Quat, type Vec3 } from "../../shared/quat";
import type { SwingKind } from "../../shared/gestures/swing";

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

export type CourtView = "behind-0" | "behind-1" | "side";

export interface CourtFrame {
  ball: Vec3;
  players: { x: number; z: number; swingAge: number; kind: SwingKind }[];
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

const SWING_SECONDS = 0.32;

/** A simple original character: body, head and an arm holding a paddle. */
function makeCharacter(color: number) {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c9a0, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 6, 14), shirt);
  body.position.y = 0.82;
  const legs = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.14, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b3550 }),
  );
  legs.position.y = 0.27;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14), skin);
  head.position.y = 1.52;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    shirt,
  );
  cap.position.y = 1.55;
  // The shoulder swings; the hand holds the paddle at arm's length.
  const shoulder = new THREE.Group();
  shoulder.position.set(0.3, 1.15, 0);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.4, 4, 8), skin);
  arm.rotation.x = -Math.PI / 2;
  arm.position.z = -0.25;
  const hand = new THREE.Group();
  hand.position.z = -0.5;
  const paddle = makePaddle(0xfff3c4);
  paddle.scale.setScalar(1.5);
  hand.add(paddle);
  shoulder.add(arm, hand);
  root.add(body, legs, head, cap, shoulder);
  root.traverse((o) => (o.castShadow = true));
  return { root, shoulder, paddle };
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
  private court = new THREE.Group();
  private ball!: THREE.Mesh;
  private ballShadow!: THREE.Mesh;
  private characters: ReturnType<typeof makeCharacter>[] = [];
  /** Fades out a sudden correction to the ball's position (online play). */
  private ballOffset = new THREE.Vector3();

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
    flat(60, 60, 0x2e7d4f, 0); // grass
    flat(w * 2 + 5, l * 2 + 7, 0x3b8f63, 0.004); // apron
    flat(w * 2, l * 2, 0x2f6fb7, 0.008); // playing surface
    flat(w * 2, kitchen * 2, 0x4aa3a1, 0.012); // the kitchen (non-volley zone)
    const line = (x: number, z: number, width: number, depth: number) =>
      (flat(width, depth, 0xffffff, 0.016).position.set(x, 0.016, z));
    const T = 0.05;
    for (const sx of [-1, 1]) line(sx * w, 0, T, l * 2);
    for (const sz of [-1, 1]) {
      line(0, sz * l, w * 2 + T, T);
      line(0, sz * kitchen, w * 2, T);
      line(0, sz * (kitchen + l) / 2, T, l - kitchen);
    }

    const net = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 2 + 0.6, netHeight),
      new THREE.MeshStandardMaterial({ color: 0x10151f, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    net.position.y = netHeight / 2;
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
    // A ring of trees so the court sits somewhere.
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x6b4a2f }),
      );
      trunk.position.y = 0.7;
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.3, 3 + (i % 3) * 0.6, 9),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2f8f57 : 0x3fa468 }),
      );
      crown.position.y = 2.8;
      tree.add(trunk, crown);
      tree.position.set(Math.cos(angle) * (15 + (i % 4)), 0, Math.sin(angle) * (19 + (i % 3)));
      this.court.add(tree);
    }

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0xf6e94a, emissive: 0x554400 }),
    );
    this.ball.castShadow = true;
    // A dark blob under the ball: the main cue for where it will land.
    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 18),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.court.add(this.ball, this.ballShadow);

    SLOT_COLORS.forEach((color, side) => {
      const character = makeCharacter(color);
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
    this.scene.background = new THREE.Color(0x8fd3ff);
    if (view === "side") {
      this.camera.position.set(-15.5, 8.5, 0);
      this.camera.lookAt(0, 0.6, 0);
    } else {
      const sign = view === "behind-0" ? 1 : -1;
      this.camera.position.set(0, 4.6, sign * 13.2);
      this.camera.lookAt(0, 0.9, -sign * 1.5);
    }
  }

  hideCourt() {
    this.court.visible = false;
    this.scene.background = new THREE.Color(0x10151f);
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

    frame.players.forEach((p, side) => {
      const { root, shoulder, paddle } = this.characters[side];
      root.visible = !(frame.solo && side === 1);
      root.position.set(p.x, 0, p.z);
      const t = p.swingAge / SWING_SECONDS;
      if (t < 1) {
        // Sweep the arm through the stroke; ease out so it snaps then settles.
        const e = 1 - (1 - t) * (1 - t);
        paddle.rotation.set(-Math.PI / 2, 0, 0);
        if (p.kind === "lob") shoulder.rotation.set(-0.9 + e * 2.3, 0, 0);
        else if (p.kind === "smash") shoulder.rotation.set(2.1 - e * 2.6, 0, 0);
        else {
          const from = p.kind === "forehand" ? -1.7 : 1.5;
          shoulder.rotation.set(0.15, from + e * (p.kind === "forehand" ? 2.9 : -2.7), 0);
        }
      } else {
        shoulder.rotation.set(0, 0, 0);
        const q = frame.paddles[side];
        if (q) setFromPhone(paddle, q);
        else paddle.rotation.set(-Math.PI / 2 + 0.5, 0, 0);
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
