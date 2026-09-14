"""Exercise real Blender export, saved-file readback, visibility failure and no-overwrite behavior."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--blender', required=True)
    parser.add_argument('--output', required=True, help='New evidence directory')
    args = parser.parse_args()
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=False)
    base = json.loads((ROOT/'assets/camera-blocking-example.json').read_text())
    portrait = copy.deepcopy(base)
    portrait.update(id='portrait-blocking-demo', fps=12, frames=24, resolution=[360, 640])
    actor = next(obj for obj in portrait['objects'] if obj.get('identity'))
    actor['locationKeys'] = [
        {'frame': 1, 'value': [-.3, 0, .85]},
        {'frame': 12, 'value': [0, 0, 1.05]},
        {'frame': 24, 'value': [.3, 0, .85]}]
    actor['rotationKeys'] = [{'frame': 1, 'value': [0, 0, 0]}, {'frame': 24, 'value': [0, 0, 20]}]
    actor['ease'] = 'continuous'
    portrait['objects'] = [obj for obj in portrait['objects'] if not obj.get('identity') or obj == actor]
    portrait['shots'] = [{
        'id': 'continuous', 'start': 1, 'end': 24, 'lens': 32, 'ease': 'continuous',
        'positionKeys': [{'frame': 1, 'value': [-.3, -6, 2]}, {'frame': 12, 'value': [.2, -6, 2]},
                         {'frame': 24, 'value': [.45, -6, 2]}],
        'targetKeys': [{'frame': 1, 'value': [0, 0, 1]}],
        'handheld': {'bodyM': .004, 'periodSeconds': 6, 'microM': .0002, 'targetM': .002}}]
    portrait['visibilityChecks'] = [{'object': actor['id'], 'start': 1, 'end': 24, 'minSamples': 3}]
    fixed = copy.deepcopy(portrait)
    fixed['id'] = 'fixed-camera-demo'
    fixed['shots'][0].pop('handheld')
    fixed['shots'][0]['positionKeys'] = [{'frame': 1, 'value': [0, -6, 2]}]
    rapid = copy.deepcopy(fixed)
    rapid['id'] = 'rapid-target-demo'
    rapid['visibilityChecks'] = []
    rapid['shots'][0]['targetKeys'] = [{'frame': 1, 'value': [-2, 0, 1]}, {'frame': 24, 'value': [2, 0, 1]}]
    rapid['shots'][0]['maxAngularSpeedDegPerSecond'] = 5
    blocked = copy.deepcopy(portrait)
    blocked['id'] = 'occluded-demo'
    blocked['objects'].append({
        'id': 'occluder', 'shape': 'box', 'size': [4, .3, 4],
        'locationKeys': [{'frame': 1, 'value': [0, -2, 2]}]})
    results = []

    def run(name, spec, render, expect_success, failure_field='visibilityFailures', options=()):
        spec_path = out/(name+'.json'); spec_path.write_text(json.dumps(spec, indent=2))
        command = [args.blender, '--background', '--factory-startup', '--python-exit-code', '1',
                   '--python', str(ROOT/'scripts/build_previs.py'), '--', '--spec', str(spec_path),
                   '--output', str(out/name)]
        if render:
            command.append('--render')
        command.extend(options)
        with (out/(name+'.log')).open('w') as log:
            completed = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
        assert (completed.returncode == 0) == expect_success, (name, completed.returncode)
        report = json.loads((out/name/'technical-qa.json').read_text())
        assert report['checksPassed'] == expect_success
        assert report['playback'] == 'NOT_REVIEWED' and report['downstreamGeneration'] == 'NOT_RUN'
        if render and expect_success:
            assert report['video']['fullDecode'] == 'PASS'
        if not expect_success:
            assert report[failure_field] and not list((out/name).glob('*.mp4'))
        for shot in spec['shots']:
            assert report['cameraMotion'][shot['id']]['samples'] == shot['end']-shot['start']
            assert len(report['cameraMotion'][shot['id']]['speedSamples']) == shot['end']-shot['start']
        assert all(len(m['speedSamples']) == spec['frames']-1 for m in report['subjectMotion'].values())
        results.append({'case': name, 'exitCode': completed.returncode, 'expectedOutcome': 'PASS' if expect_success else failure_field, 'observed': report})
        return command

    began = time.perf_counter()
    command = run('landscape', base, True, True)
    landscape_report = results[-1]['observed']
    # This short rail contains an initial hold. Duplicate spatial knots must not
    # turn the planned acceleration into a jump or move the stopped camera.
    assert landscape_report['maxRailSampleDeviationM'] < .01
    camera_speeds = landscape_report['cameraMotion']['wide-approach']['speedSamples']
    assert all(v['linearSpeedMPerSecond'] < 1e-5 for v in camera_speeds if v['frame'] <= 10)
    assert max(v['linearSpeedMPerSecond'] for v in camera_speeds) < 2
    assert max(v['linearSpeedMPerSecond'] for v in camera_speeds if 23 <= v['frame'] <= 33) > 3*max(
        v['linearSpeedMPerSecond'] for v in camera_speeds if 11 <= v['frame'] <= 17)
    run('portrait', portrait, True, True)
    run('fixed', fixed, False, True)
    run('occluded', blocked, True, False)
    run('rapid-target', rapid, True, False, 'motionLimitFailures')
    hidden = copy.deepcopy(blocked)
    hidden['visibilityChecks'] = [{'object': actor['id'], 'start': 1, 'end': 24, 'expect': 'hidden'}]
    run('hidden', hidden, False, True)
    early_reveal = copy.deepcopy(fixed)
    early_reveal['visibilityChecks'] = hidden['visibilityChecks']
    run('early-reveal', early_reveal, True, False)
    run('shot-preview', base, True, True, options=['--shot', 'closer-arrival', '--preview-percent', '50'])
    run('cut-preview', base, True, True, options=['--frame-range', '48', '50', '--preview-percent', '50'])
    for name, start, end in [('shot-preview', 49, 96), ('cut-preview', 48, 50)]:
        report = json.loads((out/name/'technical-qa.json').read_text())
        selection = report['video']['sourceTimeline']
        assert (selection['sourceStartFrame'], selection['sourceEndFrame']) == (start, end)
        assert selection['sourceStartSeconds'] == (start-1)/base['fps']
        assert selection['resolution'] == [320, 180] and report['resolution'] == base['resolution']
        assert sorted(p.name for p in (out/name/'frames').glob('*.png')) == ['%06d.png' % f for f in range(start, end+1)]
        # The first local frame must actually depict the requested source moment.
        local_frame = out/name/'frames'/('%06d.png' % start)
        original_frame = out/'landscape'/'frames'/('%06d.png' % start)
        def pixels(path, scale=False):
            cmd = ['ffmpeg', '-v', 'error', '-i', str(path)]
            if scale:
                cmd += ['-vf', 'scale=320:180']
            return subprocess.check_output(cmd+['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
        original, local = pixels(original_frame, True), pixels(local_frame)
        assert len(original) == len(local)
        assert sum(abs(a-b) for a,b in zip(original, local))/len(local) < 5, (name, 'wrong source frame')
    before = (out/'landscape'/'technical-qa.json').read_bytes()
    with (out/'no-overwrite.log').open('w') as log:
        refused = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    assert refused.returncode != 0
    assert (out/'landscape'/'technical-qa.json').read_bytes() == before

    for name, spec in [('landscape', base), ('portrait', portrait), ('fixed', fixed), ('shot-preview', base), ('cut-preview', base)]:
        blend = out/name/(spec['id']+'-'+spec['version']+'.blend')
        # Read an actual saved file in a new process; no state from the builder survives.
        code = '''import bpy, json
s = bpy.context.scene
spec = json.loads(bpy.data.texts['PREVIS SPEC'].as_string())
assert s.frame_end == spec['frames'] and s.render.fps == spec['fps']
assert [s.render.resolution_x, s.render.resolution_y] == spec['resolution']
assert len(bpy.data.cameras) == len(spec['shots'])
assert len(bpy.data.lights) == 1
roots = [o for o in s.objects if o.type == 'EMPTY' and 'identity' in o]
assert len(roots) == len(spec['objects'])
assert len([o for o in roots if o['identity']]) == len([o for o in spec['objects'] if o.get('identity')])
assert not bpy.data.libraries
for shot in spec['shots']:
    s.frame_set(shot['start'])
    cam = s.camera
    assert cam.name == 'CAM '+shot['id'] and cam.data.lens == shot['lens']
    assert cam.data.animation_data is None
    assert cam.constraints['Track To'].target.name == 'LOOK '+shot['id']
    follow = cam.constraints.get('Follow Path')
    if spec['id'] == 'fixed-camera-demo':
        assert follow is None and cam.animation_data is None
    else:
        assert follow.target.type == 'CURVE'
print('SAVED_FILE_READBACK_PASS')
'''
        with (out/(name+'-readback.log')).open('w') as log:
            subprocess.run([args.blender, '--background', str(blend), '--python-exit-code', '1', '--python-expr', code], stdout=log, stderr=subprocess.STDOUT, check=True)
        snapshot = out/(name+'-inspection.json')
        digest_before = hashlib.sha256(blend.read_bytes()).hexdigest()
        with (out/(name+'-inspection.log')).open('w') as log:
            subprocess.run([args.blender, '--background', '--disable-autoexec', str(blend), '--python-exit-code', '1',
                            '--python-expr', "import bpy; print('INITIAL_DIRTY_STATE', bpy.data.is_dirty)",
                            '--python', str(ROOT/'scripts/inspect_scene.py'), '--', '--output', str(snapshot),
                            '--object', 'CAM '+spec['shots'][0]['id']], stdout=log, stderr=subprocess.STDOUT, check=True)
        inspected = json.loads(snapshot.read_text())
        # File loading may itself mark evaluated animation data dirty. Inspection
        # must preserve the state it receives, not invent a clean-state guarantee.
        initial_dirty = next(line.split()[-1] == 'True' for line in (out/(name+'-inspection.log')).read_text().splitlines()
                             if line.startswith('INITIAL_DIRTY_STATE '))
        assert inspected['mode'] == 'background_saved_file' and inspected['isDirty'] == initial_dirty
        assert inspected['file'] == str(blend) and inspected['selectedObjects'][0]['lens'] == spec['shots'][0]['lens']
        assert digest_before == hashlib.sha256(blend.read_bytes()).hexdigest()
    evidence = {'cases': results, 'savedFileReadback': 'PASS', 'readOnlyInspection': 'PASS', 'noOverwrite': 'PASS',
                'elapsedSeconds': time.perf_counter()-began, 'playback': 'NOT_REVIEWED'}
    (out/'smoke-results.json').write_text(json.dumps(evidence, indent=2))
    print('BLENDER_SMOKE_PASS', str(out))


if __name__ == '__main__':
    main()
