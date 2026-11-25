"""Run through Blender MCP after npx tsx scripts/export-characters.ts."""
import bpy, math
from pathlib import Path
from mathutils import Euler, Quaternion
ROOT=Path('/home/edwin/lab/nintendo_lab')
scene=bpy.data.scenes.new('Garden Friends · Characters')
bpy.context.window.scene=scene
names=[('ren','Ren'),('aiko','Aiko'),('bao','Bảo'),('mimi','Mimi'),('kuma','Kuma'),('yuki','Yuki')]
for i,(key,name) in enumerate(names):
    before=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/source/characters'/f'{key}.glb'))
    objects=set(scene.objects)-before
    collection=bpy.data.collections.new(f'{i+1:02d} · {name}')
    scene.collection.children.link(collection)
    for obj in objects:
        for owner in list(obj.users_collection): owner.objects.unlink(obj)
        collection.objects.link(obj)
    roots=[o for o in objects if o.parent not in objects]
    for obj in roots:
        obj.location.x+=(i-2.5)*1.65
        obj.rotation_mode='QUATERNION'
        obj.rotation_quaternion=Quaternion((0,0,1),math.pi) @ obj.rotation_quaternion
    bpy.ops.object.text_add(location=((i-2.5)*1.65,-.1,-.28),rotation=(math.pi/2,0,0))
    label=bpy.context.object;label.name=f'Label · {name}';label.data.body=name
    label.data.align_x='CENTER';label.data.size=.19
    for owner in list(label.users_collection): owner.objects.unlink(label)
    collection.objects.link(label)
bpy.ops.object.select_all(action='DESELECT')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.shading.type='MATERIAL'
            space.overlay.show_floor=False
            space.overlay.show_extras=False
            space.overlay.show_relationship_lines=False
            space.overlay.show_axis_x=False
            space.overlay.show_axis_y=False
            space.region_3d.view_rotation=Euler((math.pi/2,0,0),'XYZ').to_quaternion()
            space.region_3d.view_perspective='ORTHO'
            space.region_3d.view_location=(0,0,.85)
            space.region_3d.view_distance=9
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/garden-characters.blend'))
print('Imported 6 editable characters into',scene.name)
