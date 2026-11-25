/** Export the exact procedural game meshes for editing in Blender. */
import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { makeCharacter, disposeCharacter } from '../src/client/host/characters';
import { CHARACTER_DESIGNS } from '../src/shared/characters';

// GLTFExporter uses the browser FileReader API for its binary Blob buffers.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend?: () => void;
  readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then(value => { this.result=value; this.onloadend?.(); }); }
  readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(value => { this.result=`data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
}
Object.assign(globalThis, { FileReader: NodeFileReader });
await mkdir('assets/source/characters', {recursive:true});
for (const d of CHARACTER_DESIGNS) {
  const c=makeCharacter(d.id);
  c.root.name=d.name;c.shoulder.name='SwingShoulder';c.paddle.name='Paddle';
  c.feet.forEach((foot,i)=>foot.name=`Foot_${i}`);
  c.paddle.rotation.x=-Math.PI/3;
  const binary=await new GLTFExporter().parseAsync(c.root,{binary:true});
  if(!(binary instanceof ArrayBuffer))throw new Error('Expected a binary GLB');
  await writeFile(`assets/source/characters/${d.id}.glb`,Buffer.from(binary));
  disposeCharacter(c);
  console.log(`Exported ${d.name}`);
}
