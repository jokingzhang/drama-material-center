"""Run in a fresh Blender background process; never modifies an interactive scene."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import time

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from previs_spec import sample, validate


def curves(owner):
    ad = owner.animation_data
    if not ad or not ad.action:
        return []
    if hasattr(ad.action, 'fcurves'):
        return list(ad.action.fcurves)
    result = []
    for layer in ad.action.layers:
        for strip in layer.strips:
            bag = strip.channelbag(ad.action_slot, ensure=False)
            if bag:
                result.extend(bag.fcurves)
    return result


def linear_keys(owner):
    for fc in curves(owner):
        for point in fc.keyframe_points:
            point.interpolation = 'LINEAR'


def wobble(seconds, settings, target=False):
    from mathutils import Vector
    amp = settings.get('targetM' if target else 'bodyM', 0)
    period = settings.get('periodSeconds', 6)
    micro = 0 if target else settings.get('microM', 0)
    return Vector((amp*math.sin(2*math.pi*seconds/period+.3)+micro*math.sin(2*math.pi*seconds/1.13),
                   amp*.6*math.sin(2*math.pi*seconds/(period*1.3)+.8),
                   amp*.45*math.sin(2*math.pi*seconds/(period*.9)) + micro*.5*math.sin(2*math.pi*seconds/.97)))


def main():
    import bpy
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--spec', required=True)
    p.add_argument('--output', required=True, help='A NEW directory; existing paths are refused')
    p.add_argument('--render', action='store_true', help='Render all frames and encode a silent H.264 preview')
    p.add_argument('--engine', choices=['BLENDER_WORKBENCH', 'BLENDER_EEVEE', 'CYCLES'], default='BLENDER_WORKBENCH')
    args = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not bpy.app.background:
        raise RuntimeError('Use a fresh --background --factory-startup process; interactive reset is forbidden')
    began = time.perf_counter()
    spec_path = Path(args.spec).resolve(strict=True)
    spec_bytes = spec_path.read_bytes()
    spec = validate(json.loads(spec_bytes))
    out = Path(args.output).expanduser().absolute()
    if out.exists() or out.is_symlink():
        raise FileExistsError('Output already exists; choose a new run/version: ' + str(out))
    if args.render and (not shutil.which('ffmpeg') or not shutil.which('ffprobe')):
        raise RuntimeError('ffmpeg and ffprobe must be available before --render')
    out.mkdir(parents=True, exist_ok=False)
    (out/'spec.json').write_bytes(spec_bytes)
    for filename in ['build_previs.py', 'previs_spec.py']:
        shutil.copyfile(Path(__file__).resolve().parent/filename, out/filename)
    backups = out/'backups'; backups.mkdir()
    stem = spec['id']+'-'+spec['version']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.name = spec['id']; s.frame_start = 1; s.frame_end = spec['frames']
    s.unit_settings.system = 'METRIC'; s.unit_settings.scale_length = 1
    s.render.fps = spec['fps']; s.render.fps_base = 1
    s.render.resolution_x, s.render.resolution_y = spec['resolution']
    s.render.resolution_percentage = 100
    s.render.engine = args.engine
    s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGB'
    s.view_settings.view_transform = 'Standard'
    s.display.shading.color_type = 'MATERIAL'
    s.display.shading.light = 'STUDIO'
    s.display.shading.show_shadows = True
    s.display.shading.show_cavity = True
    s.display.render_aa = '8'
    if hasattr(s, 'eevee'):
        s.eevee.taa_render_samples = 32
    if args.engine == 'CYCLES':
        s.cycles.samples = 24; s.cycles.use_denoising = True
    world = bpy.data.worlds.new('Unlit world'); s.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0
    light_data = bpy.data.lights.new('Preview area', 'AREA')
    light_data.energy = 550; light_data.shape = 'DISK'; light_data.size = 5
    light = bpy.data.objects.new('Preview area', light_data); s.collection.objects.link(light)
    light.location = (0, -1, 5)
    s['purpose'] = spec['purpose']; s['status'] = 'INTERNAL'
    s['warning'] = 'Root-motion primitive previs; no natural gait, performance or downstream acceptance implied.'
    roots = {}

    def material(oid, rgb):
        m = bpy.data.materials.new(oid+' color'); m.diffuse_color = (*rgb, 1)
        m.use_nodes = True
        bs = m.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value = (*rgb, 1)
        bs.inputs['Roughness'].default_value = .8
        return m

    def finish_part(obj, root, mat):
        obj.parent = root; obj['previs_id'] = root['previs_id']
        obj.data.materials.append(mat)
        for polygon in obj.data.polygons:
            polygon.use_smooth = obj.name.startswith('Round')

    for desc in spec['objects']:
        root = bpy.data.objects.new(desc['id'], None); s.collection.objects.link(root)
        roots[desc['id']] = root
        root['previs_id'] = desc['id']; root['identity'] = desc.get('identity', '')
        root['color_identity'] = json.dumps(desc.get('color', [.45, .45, .45]))
        root['size'] = desc['size']
        size = Vector(desc['size']); shape = desc['shape']
        mat = material(desc['id'], desc.get('color', [.45, .45, .45]))
        if shape == 'box':
            bpy.ops.mesh.primitive_cube_add(size=1)
            obj = bpy.context.object; obj.scale = size
            finish_part(obj, root, mat)
        elif shape == 'sphere':
            bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1)
            obj = bpy.context.object; obj.name = 'Round '+desc['id']; obj.scale = size/2
            finish_part(obj, root, mat)
        elif shape == 'cylinder':
            bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1, depth=1)
            obj = bpy.context.object; obj.name = 'Round '+desc['id']; obj.scale = (size.x/2, size.y/2, size.z)
            finish_part(obj, root, mat)
        else:
            radius = min(size.x, size.y)/2
            body_height = size.z - 2*radius
            if body_height <= 0:
                raise ValueError('Capsule height must exceed diameter')
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1, depth=1)
            obj = bpy.context.object; obj.name = 'Round '+desc['id']+' body'; obj.scale = (size.x/2, size.y/2, body_height)
            finish_part(obj, root, mat)
            for sign in [-1, 1]:
                bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1, location=(0, 0, sign*body_height/2))
                obj = bpy.context.object; obj.name = 'Round '+desc['id']+' cap'; obj.scale = (size.x/2, size.y/2, radius)
                finish_part(obj, root, mat)
        root.location = sample(desc['locationKeys'], 1)
    bpy.ops.wm.save_as_mainfile(filepath=str(backups/(stem+'-01-layout.blend')))
    for desc in spec['objects']:
        root = roots[desc['id']]
        for f in range(1, spec['frames']+1):
            root.location = sample(desc['locationKeys'], f, desc.get('ease', 'linear'))
            if len(desc['locationKeys']) > 1:
                root.keyframe_insert(data_path='location', frame=f)
            if desc.get('rotationKeys'):
                root.rotation_euler = [math.radians(v) for v in sample(desc['rotationKeys'], f, desc.get('ease', 'linear'))]
                root.keyframe_insert(data_path='rotation_euler', frame=f)
        linear_keys(root)
    s.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(backups/(stem+'-02-blocking.blend')))

    shot_objects = []
    for desc in spec['shots']:
        data = bpy.data.cameras.new(desc['id']); data.lens = desc['lens']; data.sensor_width = 36
        data.clip_start = .02; data.clip_end = 1000; data.dof.use_dof = False
        cam = bpy.data.objects.new('CAM '+desc['id'], data); s.collection.objects.link(cam)
        target = bpy.data.objects.new('LOOK '+desc['id'], None); s.collection.objects.link(target)
        target.empty_display_type = 'SPHERE'; target.empty_display_size = .08
        coords = []
        for f in range(desc['start'], desc['end']+1):
            seconds = (f-desc['start'])/spec['fps']; hh = desc.get('handheld', {})
            coords.append(Vector(sample(desc['positionKeys'], f, desc.get('ease', 'linear')))+wobble(seconds, hh))
            target.location = Vector(sample(desc['targetKeys'], f, desc.get('ease', 'linear')))+wobble(seconds, hh, True)
            target.keyframe_insert(data_path='location', frame=f)
        linear_keys(target)
        distances = [0.]
        for a, b in zip(coords, coords[1:]):
            distances.append(distances[-1]+(b-a).length)
        if distances[-1] > 1e-8:
            curve = bpy.data.curves.new('RAIL '+desc['id'], 'CURVE')
            curve.dimensions = '3D'; curve.resolution_u = 24; curve.use_path = True
            rail = bpy.data.objects.new(curve.name, curve); s.collection.objects.link(rail); rail.hide_render = True
            spline = curve.splines.new('BEZIER')
            indices = sorted(set(list(range(0, len(coords), 3))+[len(coords)-1]))
            spline.bezier_points.add(len(indices)-1)
            for bp, index in zip(spline.bezier_points, indices):
                bp.co = coords[index]; bp.handle_left_type = 'AUTO'; bp.handle_right_type = 'AUTO'
            follow = cam.constraints.new('FOLLOW_PATH'); follow.target = rail
            follow.use_fixed_location = True; follow.use_curve_follow = False
            for i, distance in enumerate(distances):
                follow.offset_factor = distance/distances[-1]
                follow.keyframe_insert(data_path='offset_factor', frame=desc['start']+i)
            linear_keys(cam)
        else:
            cam.location = coords[0]
        track = cam.constraints.new('TRACK_TO'); track.target = target
        track.track_axis = 'TRACK_NEGATIVE_Z'; track.up_axis = 'UP_Y'
        marker = s.timeline_markers.new(desc['id'], frame=desc['start']); marker.camera = cam
        shot_objects.append((desc, cam, target, coords))
    s.camera = shot_objects[0][1]; s.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(backups/(stem+'-03-cameras.blend')))
    built = time.perf_counter()
    report = {'status': 'TECHNICAL_CHECK_ONLY', 'blenderVersion': bpy.app.version_string,
              'specSha256': hashlib.sha256(spec_bytes).hexdigest(), 'frames': spec['frames'], 'fps': spec['fps'],
              'resolution': spec['resolution'], 'purpose': spec['purpose'], 'cameraSwitches': [], 'boundaryChecks': [],
              'maxTrackErrorDegrees': 0., 'maxRailSampleDeviationM': 0., 'visibilityFailures': [],
              'cameraMotion': {shot['id']: {'samples': 0, 'maxAngularSpeedDegPerSecond': 0.,
                  'maxAngularSpeedFrame': None, 'maxLinearSpeedMPerSecond': 0.,
                  'minTargetDistanceM': None, 'angularLimitDegPerSecond': shot.get('maxAngularSpeedDegPerSecond')}
                  for shot in spec['shots']}, 'motionLimitFailures': [],
              'playback': 'NOT_REVIEWED', 'downstreamGeneration': 'NOT_RUN', 'humanAcceptance': 'PENDING',
              'timeScope': 'Script runtime only; prior design and subsequent playback/integration are not measured.'}
    prev = None; prev_origin = None; prev_rotation = None
    for f in range(1, spec['frames']+1):
        s.frame_set(f); dg = bpy.context.evaluated_depsgraph_get()
        desc, cam, target, coords = next(x for x in shot_objects if x[0]['start'] <= f <= x[0]['end'])
        assert s.camera == cam and cam.data.lens == desc['lens'], ('camera/lens mismatch', f)
        ev = cam.evaluated_get(dg); origin = ev.matrix_world.translation
        aim = target.evaluated_get(dg).matrix_world.translation
        rotation = ev.matrix_world.to_quaternion()
        forward = rotation @ Vector((0, 0, -1))
        error = math.degrees(forward.angle((aim-origin).normalized()))
        report['maxTrackErrorDegrees'] = max(report['maxTrackErrorDegrees'], error)
        report['maxRailSampleDeviationM'] = max(report['maxRailSampleDeviationM'], (origin-coords[f-desc['start']]).length)
        if cam != prev:
            report['cameraSwitches'].append({'frame': f, 'camera': cam.name, 'target': target.name, 'lens': cam.data.lens})
        motion = report['cameraMotion'][desc['id']]
        distance = (aim-origin).length
        motion['minTargetDistanceM'] = min(distance, motion['minTargetDistanceM']) if motion['minTargetDistanceM'] is not None else distance
        if cam == prev:
            # atan2 avoids acos losing very small handheld rotations to float rounding.
            delta = prev_rotation.rotation_difference(rotation).normalized()
            angle = 2*math.atan2(math.sqrt(delta.x**2+delta.y**2+delta.z**2), abs(delta.w))
            speed = math.degrees(angle)*spec['fps']
            motion['samples'] += 1
            motion['maxLinearSpeedMPerSecond'] = max(motion['maxLinearSpeedMPerSecond'], (origin-prev_origin).length*spec['fps'])
            if speed > motion['maxAngularSpeedDegPerSecond']:
                motion['maxAngularSpeedDegPerSecond'] = speed; motion['maxAngularSpeedFrame'] = f
            limit = desc.get('maxAngularSpeedDegPerSecond')
            if limit is not None and speed > limit:
                report['motionLimitFailures'].append({'frame': f, 'shot': desc['id'], 'angularSpeedDegPerSecond': speed, 'limit': limit})
        prev = cam; prev_origin = origin.copy(); prev_rotation = rotation.copy()
        for check in spec.get('visibilityChecks', []):
            if not check['start'] <= f <= check['end']:
                continue
            obj = roots[check['object']]; oe = obj.evaluated_get(dg); visible = 0
            for z in [-.2, 0, .2]:
                point = oe.matrix_world @ Vector((0, 0, z*obj['size'][2]))
                projected = world_to_camera_view(s, ev, point)
                if projected.z > 0 and 0 < projected.x < 1 and 0 < projected.y < 1:
                    hit, loc, normal, index, hit_obj, matrix = s.ray_cast(dg, origin, (point-origin).normalized())
                    visible += int(hit and hit_obj.get('previs_id') == check['object'])
            if visible < check.get('minSamples', 1):
                report['visibilityFailures'].append({'frame': f, 'object': check['object'], 'visibleSamples': visible})
    for desc, cam, target, _ in shot_objects:
        cut = desc['start']
        for f, sub in ([(1, 0)] if cut == 1 else [(cut-1, 0), (cut-1, .999), (cut, 0), (cut, .001)]):
            s.frame_set(f, subframe=sub)
            expected = next(x for x in shot_objects if x[0]['start'] <= f <= x[0]['end'])
            assert s.camera == expected[1]
            report['boundaryChecks'].append({'frame': f, 'subframe': sub, 'camera': s.camera.name, 'lens': s.camera.data.lens})
    report['checksPassed'] = report['maxTrackErrorDegrees'] < .1 and not report['visibilityFailures'] and not report['motionLimitFailures']
    s.frame_set(1)
    embedded = bpy.data.texts.new('PREVIS SPEC'); embedded.write(json.dumps(spec, ensure_ascii=False, indent=2))
    qa = bpy.data.texts.new('TECHNICAL QA - playback still required'); qa.write(json.dumps(report, indent=2))
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.color_type = 'MATERIAL'
                area.spaces.active.overlay.show_overlays = False
    s.render.filepath = '//frames/'
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(stem+'.blend')))
    report['buildSeconds'] = built-began
    report['auditSeconds'] = time.perf_counter()-built
    (out/'technical-qa.json').write_text(json.dumps(report, indent=2))
    if not report['checksPassed']:
        raise RuntimeError('Technical checks failed; preserved diagnostic scene and report; do not use as input')
    if args.render:
        started = time.perf_counter(); frames_dir = out/'frames'; frames_dir.mkdir()
        for f in range(1, spec['frames']+1):
            s.frame_set(f); s.render.filepath = str(frames_dir/('%06d.png'%f))
            bpy.ops.render.render(write_still=True)
        report['renderSeconds'] = time.perf_counter()-started
        started = time.perf_counter(); video = out/(stem+'.mp4')
        subprocess.run(['ffmpeg', '-v', 'error', '-n', '-framerate', str(spec['fps']), '-start_number', '1', '-i', str(frames_dir/'%06d.png'), '-frames:v', str(spec['frames']), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(video)], check=True)
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames,duration', '-of', 'json', str(video)]))['streams'][0]
        assert int(probe['nb_read_frames']) == spec['frames']
        assert [probe['width'], probe['height']] == spec['resolution']
        from fractions import Fraction
        assert Fraction(probe['r_frame_rate']) == spec['fps']
        assert abs(float(probe['duration'])-spec['frames']/spec['fps']) < 1/spec['fps']
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-f', 'null', '-'], check=True)
        report['video'] = {'path': video.name, 'sha256': hashlib.sha256(video.read_bytes()).hexdigest(), 'probe': probe, 'fullDecode': 'PASS'}
        report['encodeAndDecodeSeconds'] = time.perf_counter()-started
    report['scriptTotalSeconds'] = time.perf_counter()-began
    (out/'technical-qa.json').write_text(json.dumps(report, indent=2))
    print('PREVIS_BUILT', str(out), json.dumps({'checksPassed': report['checksPassed'], 'rendered': args.render}), flush=True)


if __name__ == '__main__':
    main()
