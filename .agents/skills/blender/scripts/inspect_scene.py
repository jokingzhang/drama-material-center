"""Read-only Blender snapshot. A background snapshot describes the saved file, not another open window."""
import argparse
from collections import Counter
import json
import os
from pathlib import Path
import sys


def inspect_scene(scene_name=None, object_names=()):
    import bpy
    scene = bpy.data.scenes.get(scene_name) if scene_name else bpy.context.scene
    if scene is None:
        raise ValueError('Requested scene does not exist')
    missing = [name for name in object_names if name not in scene.objects]
    if missing:
        raise ValueError('Objects missing from requested scene: ' + ', '.join(missing))
    result = {
        'mode': ('background_saved_file' if bpy.data.filepath else 'background_unsaved_scene') if bpy.app.background else 'interactive_instance',
        'pid': os.getpid(), 'blenderVersion': bpy.app.version_string,
        'executable': bpy.app.binary_path, 'file': bpy.data.filepath or None,
        'isSaved': bpy.data.is_saved, 'isDirty': bpy.data.is_dirty,
        'activeScene': bpy.context.scene.name if bpy.context.scene else None,
        'inspectedScene': scene.name,
        'scenes': [{'name': s.name, 'objectCount': len(s.objects), 'types': dict(Counter(o.type for o in s.objects)),
            'collections': [c.name for c in s.collection.children],
            'camera': s.camera.name if s.camera else None, 'currentFrame': s.frame_current,
            'frames': [s.frame_start, s.frame_end], 'fps': s.render.fps/s.render.fps_base,
            'resolution': [s.render.resolution_x, s.render.resolution_y],
            'resolutionPercentage': s.render.resolution_percentage,
            'units': s.unit_settings.system, 'unitScale': s.unit_settings.scale_length,
            'engine': s.render.engine, 'output': s.render.filepath,
            'cameraMarkers': [{'name': m.name, 'frame': m.frame, 'camera': m.camera.name}
                              for m in s.timeline_markers if m.camera]}
            for s in bpy.data.scenes],
        'linkedLibraries': [lib.filepath for lib in bpy.data.libraries],
        'selectedObjects': [],
        'scope': 'Current instance only; no frame change, render, save, connection setup or scene mutation.'}
    for name in object_names:
        obj = scene.objects[name]
        item = {'name': obj.name, 'type': obj.type, 'parent': obj.parent.name if obj.parent else None,
                'localLocation': list(obj.location), 'worldLocation': list(obj.matrix_world.translation),
                'rotationMode': obj.rotation_mode, 'dimensions': list(obj.dimensions),
                'hideRender': obj.hide_render, 'hideViewport': obj.hide_viewport,
                'animated': obj.animation_data is not None,
                'constraints': [{'name': c.name, 'type': c.type, 'influence': c.influence,
                    'target': getattr(c, 'target', None).name if getattr(c, 'target', None) else None}
                    for c in obj.constraints]}
        if obj.type == 'CAMERA':
            item['lens'] = obj.data.lens; item['sensorWidth'] = obj.data.sensor_width
        result['selectedObjects'].append(item)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scene')
    parser.add_argument('--object', action='append', default=[])
    parser.add_argument('--output', help='Optional new JSON file; existing files are refused')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    payload = json.dumps(inspect_scene(args.scene, args.object), ensure_ascii=False, indent=2)
    if args.output:
        with Path(args.output).expanduser().open('x', encoding='utf-8') as target:
            target.write(payload)
    print(payload)


if __name__ == '__main__':
    main()
