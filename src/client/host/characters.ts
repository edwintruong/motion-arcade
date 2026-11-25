import * as THREE from "three";
import { characterDesign, CHARACTER_DESIGNS } from "../../shared/characters";

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

/** Original modular characters. Shared proportions keep paddle reach identical. */
export function makeCharacter(id: string) {
  const d = characterDesign(id);
  const root = new THREE.Group();
  root.userData.characterId = d.id;
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .85 });
  const skin = material(d.skin), hair = material(d.hair), shirt = material(d.shirt);
  const accent = material(d.accent), white = material(0xfff6e5), ink = material(0x39333e);
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent = root) => {
    const o = new THREE.Mesh(geometry, mat); o.position.set(x,y,z); parent.add(o); return o;
  };
  const orb = (mat: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, parent = root) => {
    const o = mesh(new THREE.SphereGeometry(1, 20, 14), mat, x,y,z,parent); o.scale.set(sx,sy,sz); return o;
  };
  const anime = d.style === 'Anime';
  const radius = anime ? .31 : .36;
  const face = new THREE.Group(); face.position.y = 1.48; root.add(face);
  orb(skin,0,0,0,radius,radius*.95,radius,face);
  // Hair dome leaves the eyes visible; layered locks give each silhouette its identity.
  mesh(new THREE.SphereGeometry(radius+.025,24,14,0,Math.PI*2,0,Math.PI*.53),hair,0,.03,.015,face);
  for (const side of [-1,1]) {
    orb(skin,side*radius,0,0,.065,.09,.06,face);
    orb(material(0xd98f80),side*(radius+.015),-.005,-.048,.032,.052,.018,face);
    orb(white,side*.115,.005,-radius*.92,anime?.066:.046,anime?.087:.061,.025,face);
    orb(ink,side*.115,.005,-radius-.005,anime?.039:.029,anime?.059:.041,.018,face);
    orb(white,side*.115-.01,.025,-radius-.022,.012,.017,.009,face);
    orb(material(0xe5a090),side*.21,-.09,-radius*.8,.061,.028,.014,face);
    const brow=orb(hair,side*.12,.12,-radius*.88,.063,.012,.015,face); brow.rotation.z=side*.12;
  }
  // Rounded button nose, mouth and eyelids read clearly in the Blender close-up too.
  const nose = orb(skin,0,-.055,-radius-.018,.036,.043,.047,face);
  nose.name = 'Button nose';
  orb(material(0xffe5d0),-.008,-.039,-radius-.061,.012,.01,.006,face).name='Nose highlight';
  for (const side of [-1,1]) {
    const lid = orb(hair,side*.115,.066,-radius-.009,anime?.063:.044,.012,.018,face);
    lid.name = 'Upper eyelid';
    if(d.gender === 'Nữ') {
      const lash = orb(hair,side*.167,.065,-radius,.035,.009,.012,face);
      lash.rotation.z=side*.35; lash.name='Eyelash';
    }
  }
  const smile=mesh(new THREE.TorusGeometry(.045,.01,6,16,Math.PI),ink,0,-.12,-radius*.97,face); smile.rotation.z=Math.PI; smile.name='Smile';
  orb(material(0xe69291),0,-.156,-radius*.97,.026,.009,.012,face).name='Lower lip';
  if (d.hairstyle==='spikes') {
    for(let i=-2;i<=2;i++) {
      const spike=mesh(new THREE.ConeGeometry(.105,.3,5),hair,i*.105,.28+(.04*(2-Math.abs(i))),-.025,face); spike.rotation.z=-i*.3;
      const fringe=orb(hair,i*.1,.15,-.26,.08,.16,.045,face); fringe.rotation.z=-.4;
    }
  } else if (d.hairstyle==='twintails') {
    for(const side of [-1,1]) {
      const tail=orb(hair,side*.37,-.12,.06,.14,.36,.15,face); tail.rotation.z=side*.18;
      orb(accent,side*.34,.12,-.02,.09,.06,.08,face);
      const lock=orb(hair,side*.11,.15,-.28,.13,.15,.05,face); lock.rotation.z=side*.3;
    }
  } else if (d.hairstyle==='bob') {
    for(const side of [-1,1]) orb(hair,side*.29,-.06,.04,.12,.29,.22,face);
    for(let i=-2;i<=2;i++) orb(hair,i*.105,.16,-.29,.07,.12,.055,face);
    orb(accent,-.29,.13,-.2,.065,.035,.02,face);
  } else if (d.hairstyle==='swoop') {
    for(let i=0;i<4;i++) { const lock=orb(hair,-.19+i*.1,.18+i*.018,-.24,.13,.15,.085,face);lock.rotation.z=-.6; }
  } else {
    // Soft costume hoods, with prominent animal ears and contrasting inner panels.
    mesh(new THREE.SphereGeometry(radius+.05,24,14,0,Math.PI*2,0,Math.PI*.52),shirt,0,.05,.025,face);
    for(const side of [-1,1]) {
      const bunny=d.hairstyle==='bunny';
      const ear=orb(shirt,side*.23,bunny?.52:.36,.02,bunny?.09:.13,bunny?.29:.13,.07,face); ear.rotation.z=side*-.16;
      const inner=orb(accent,side*.23,bunny?.52:.36,-.045,bunny?.045:.075,bunny?.21:.075,.018,face);inner.rotation.z=side*-.16;
    }
    orb(hair,-.07,.17,-.29,.17,.1,.055,face);
  }
  mesh(new THREE.CapsuleGeometry(anime?.245:.28,anime?.38:.28,8,18),shirt,0,.83,0);
  if (d.id==='mimi' || d.id==='aiko') {
    mesh(new THREE.CylinderGeometry(.22,.34,.23,20),shirt,0,.53,0);
    mesh(new THREE.TorusGeometry(.3,.025,6,24),accent,0,.44,0).rotation.x=Math.PI/2;
  } else {
    orb(accent,0,.7,-.25,.15,.08,.025);
  }
  if(anime) {
    mesh(new THREE.BoxGeometry(.025,.44,.025),white,0,.87,-.25);
    for(const side of [-1,1]) { const collar=orb(accent,side*.09,1.09,-.19,.08,.035,.065);collar.rotation.z=side*.4; }
  } else { orb(accent,0,1.08,-.18,.15,.055,.09); }
  // Separate torso, shoulders, elbows and hips so strokes move the whole body.
  const torso = new THREE.Group(); torso.position.y = .65;
  for (const child of [...root.children]) { root.remove(child); child.position.y -= .65; torso.add(child); }
  root.add(torso);
  const freeShoulder = new THREE.Group(); freeShoulder.position.set(-.32,.43,0); torso.add(freeShoulder);
  mesh(new THREE.CapsuleGeometry(.075,.3,6,12),shirt,0,-.16,0,freeShoulder);
  orb(skin,0,-.37,0,.08,.08,.08,freeShoulder);
  const shoulder = new THREE.Group(); shoulder.position.set(.3,.5,0); torso.add(shoulder);
  const arm = mesh(new THREE.CapsuleGeometry(.075,.16,6,12),shirt,0,0,-.13,shoulder);
  arm.rotation.x = -Math.PI/2;
  const elbow = new THREE.Group(); elbow.position.z = -.26; shoulder.add(elbow);
  const forearm = mesh(new THREE.CapsuleGeometry(.06,.15,6,12),skin,0,0,-.11,elbow);
  forearm.rotation.x = -Math.PI/2;
  orb(skin,0,0,-.23,.078,.078,.078,elbow);
  const hand = new THREE.Group(); hand.position.z = -.25; elbow.add(hand);
  const paddle = makePaddle(d.accent); paddle.scale.setScalar(1.5); hand.add(paddle);
  const feet: THREE.Mesh[] = [];
  const legs = [-1,1].map(side => {
    const hip = new THREE.Group(); hip.position.set(side*.14,.53,0); root.add(hip);
    mesh(new THREE.CapsuleGeometry(.085,.24,6,12),ink,0,-.24,0,hip);
    feet.push(orb(white,0,-.44,-.06,.115,.085,.19,hip));
    return hip;
  });
  root.traverse(o=>{o.castShadow=true;});
  return {root,torso,shoulder,elbow,freeShoulder,paddle,feet,legs,stride:0};
}

export function disposeCharacter(character: ReturnType<typeof makeCharacter>) {
  const materials=new Set<THREE.Material>();
  character.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  materials.forEach(m=>m.dispose());
}

/** One temporary renderer for all roster portraits, then release its WebGL context. */
export function characterPortraits(): Map<string,string> {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setSize(240,260);renderer.setPixelRatio(1);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff,0xb4bea1,2));
  const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(-3,5,4);scene.add(light);
  const camera=new THREE.PerspectiveCamera(33,240/260,.1,20);camera.position.set(0,1.15,4.2);camera.lookAt(0,1,0);
  const portraits=new Map<string,string>();
  try {
    for(const design of CHARACTER_DESIGNS) {
      const c=makeCharacter(design.id);c.root.rotation.y=Math.PI-.13;c.paddle.rotation.x=-Math.PI/3;
      scene.add(c.root);renderer.render(scene,camera);
      portraits.set(design.id,renderer.domElement.toDataURL('image/png'));
      scene.remove(c.root);disposeCharacter(c);
    }
  } finally {renderer.dispose();renderer.forceContextLoss();}
  return portraits;
}
