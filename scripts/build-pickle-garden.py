"""Run inside Blender via MCP; retain original scene, export garden decor only."""
import bpy, math
from pathlib import Path
ROOT = Path('/home/edwin/lab/nintendo_lab')
scene = bpy.data.scenes.new('Pickle Garden')
bpy.context.window.scene = scene

def mat(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    node = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = .85
    return m
cream=mat('Garden · warm cream',(.88,.76,.57))
clay=mat('Garden · terracotta',(.6,.24,.14))
sage=mat('Garden · sage',(.28,.48,.29))
lime=mat('Garden · pear',(.53,.65,.32))
wood=mat('Garden · oak',(.38,.23,.13))
white=mat('Garden · chalk',(.96,.92,.8))
court=mat('Garden · court',(.17,.34,.26))
kitchen=mat('Garden · kitchen',(.38,.55,.37))
decor=[]
def box(name,pos,size,material,bevel=.1,export=True):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('Rounded edges','BEVEL'); mod.width=bevel; mod.segments=3
    if export: decor.append(o)
    return o

def sphere(name,pos,scale,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=pos)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth=True
    decor.append(o); return o

for x in [-6.5,6.5]:
    for y in [-8,-3,3,8]:
        box('Tree trunk',(x,y,.75),(.24,.24,1.5),wood)
        sphere('Pear canopy',(x,y,2),(1,1,1.35),sage)
        sphere('Soft canopy',(x+.35,y,2.65),(.7,.7,.8),lime)
        box('Tree planter',(x,y,.2),(1.55,1.55,.4),cream,.18)
    for y in [-5.5,5.5]:
        box('Bench seat',(x,y,.55),(.75,1.9,.18),clay)
        box('Bench back',(x+(.32 if x>0 else -.32),y,.9),(.14,1.9,.65),cream)
        for dy in [-.65,.65]: box('Bench foot',(x,y+dy,.25),(.5,.15,.5),wood)
for y in [-9.5,9.5]:
    box('Garden border',(0,y,.18),(10,.35,.36),cream)
    for x in [-4.5,-3,3,4.5]:
        sphere('Round shrub',(x,y,.55),(.65,.55,.65),sage)
        for dx in [-.2,.2]: sphere('Clay blossom',(x+dx,y-.35,.9),(.12,.12,.12),clay)
# Preview-only court: runtime uses exact game dimensions instead.
box('Preview ground',(0,0,-.12),(18,23,.2),lime,.15,False)
box('Preview apron',(0,0,-.005),(9,17,.05),cream,.1,False)
box('Preview playing surface',(0,0,.03),(6.1,13.41,.03),court,0,False)
box('Preview kitchen',(0,0,.05),(6.1,4.26,.02),kitchen,0,False)
for x in [-3.05,3.05]: box('Sideline',(x,0,.07),(.05,13.41,.02),white,0,False)
for y in [-6.705,-2.13,2.13,6.705]: box('Court line',(0,y,.07),(6.1,.05,.02),white,0,False)
for y in [-4.4175,4.4175]: box('Center line',(0,y,.07),(.05,4.575,.02),white,0,False)
for x in [-3.3,3.3]: box('Net post',(x,0,.48),(.09,.09,.96),wood,.02,False)
box('Net tape',(0,0,.94),(6.6,.045,.06),white,.01,False)
for x in range(-32,33): box('Net mesh',(x/10,0,.47),(.012,.015,.9),wood,0,False)
for z in range(1,10): box('Net mesh',(0,0,z/10),(6.6,.015,.012),wood,0,False)
bpy.ops.object.select_all(action='DESELECT')
for o in decor: o.select_set(True)
bpy.context.view_layer.objects.active=decor[0]
bpy.ops.export_scene.gltf(filepath=str(ROOT/'src/client/public/models/pickle-garden.glb'),export_format='GLB',use_selection=True,export_yup=True)
# Friendly material viewport, framed on the new scene.
from mathutils import Quaternion, Euler
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.region_3d.view_distance=26
            area.spaces.active.region_3d.view_location=(0,0,0)
            area.spaces.active.region_3d.view_rotation=Euler((math.radians(48),0,math.radians(-25)),'XYZ').to_quaternion()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/pickle-garden.blend'))
print('PICKLE_GARDEN_EXPORTED',len(decor))
