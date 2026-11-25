"""Executed through Blender MCP. Exports original arena architecture, metres."""
import bpy, math
from pathlib import Path
ROOT = Path(ARENA_PROJECT_ROOT)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
def material(name, color, metal=0, glow=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=0.55
    p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=glow
    return m
navy=material('Midnight architecture',(0.025,0.045,0.09),0.3)
seat=material('Blue seating',(0.055,0.16,0.25))
cyan=material('Cyan light',(0.05,0.8,1),0.2,2)
magenta=material('Magenta light',(0.65,0.09,0.4),0.2,1)
metal=material('Structural aluminium',(0.14,0.22,0.29),0.7)
def box(name,pos,size,mat,bevel=0.04):
    # Coordinates use Three.js y-up; Blender is z-up.
    bpy.ops.mesh.primitive_cube_add(size=1,location=(pos[0],-pos[2],pos[1]))
    o=bpy.context.object; o.name=name; o.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        m=o.modifiers.new('Soft machined edges','BEVEL'); m.width=bevel; m.segments=2
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=m.name)
    return o
for end in [-1, 1]:
    box('Interior end wall',(0,4,end*16),(25,8,.25),navy)
    for x in [-10,-5,0,5,10]:
        box('Wall inset light',(x,4,end*15.84),(.035,5,.04),cyan)
box('Arena ceiling',(0,8.5,0),(25,.2,32),navy)
# Open camera lanes at both baselines and left sideline.
for side in [-1,1]:
    box('End podium',(0,.3,side*11),(19,.6,1),navy)
    box('Baseline LED',(0,.64,side*10.5),(18,.045,.045),cyan)
for row in range(3):
    x=7.0+row*.85
    box('Grandstand riser',(x,.3+row*.35,0),(.85,.6+row*.7,19),navy)
    for n in range(22):
        z=-8.9+n*.85
        box('Spectator seat',(x,.75+row*.7,z),(.56,.15,.62),seat)
        box('Seat back',(x+.25,1+row*.7,z),(.12,.55,.62),seat)
    box('Stand aisle light',(x-.4,.62+row*.7,0),(.04,.035,19),cyan)
for z in [-9,-3,3,9]:
    box('Arena column',(10,3.4,z),(.3,6.8,.3),metal)
    box('Column strip',(9.82,3.5,z),(.04,5,.08),cyan)
    box('Lighting cantilever',(6,6.8,z),(8,.2,.22),metal)
    box('Overhead panel',(4,6.65,z),(3,.05,.5),cyan)
box('Scoreboard housing',(9,4,0),(.25,2.1,5),navy)
for z in [-2.6,2.6]: box('Scoreboard trim',(8.84,4,z),(.05,2.2,.06),magenta)
# Identity signage faces the main camera.
bpy.ops.object.text_add(location=(0,11,1.05),rotation=(math.pi/2,0,0))
t=bpy.context.object; t.name='Arena identity'; t.data.body='MOTION / ARENA'; t.data.align_x='CENTER'; t.data.size=.65; t.data.extrude=.008; t.data.materials.append(cyan)
bpy.ops.object.convert(target='MESH')
# Batch static geometry by material to keep rendering cost small.
for mat in [navy,seat,cyan,magenta,metal]:
    bpy.ops.object.select_all(action='DESELECT')
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
    for o in objects: o.select_set(True)
    if objects:
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/motion-arena.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'src/client/public/models/motion-arena.glb'),export_format='GLB',export_yup=True)
print('ARENA_EXPORTED', len(bpy.context.scene.objects))
