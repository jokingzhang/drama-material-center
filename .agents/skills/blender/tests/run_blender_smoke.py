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

    def run(name, spec, render, expect_success, failure_field='visibilityFailures'):
        spec_path = out/(name+'.json'); spec_path.write_text(json.dumps(spec, indent=2))
        command = [args.blender, '--background', '--factory-startup', '--python-exit-code', '1',
                   '--python', str(ROOT/'scripts/build_previs.py'), '--', '--spec', str(spec_path),
                   '--output', str(out/name)]
        if render:
            command.append('--render')
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
        results.append({'case': name, 'exitCode': completed.returncode, 'expectedOutcome': 'PASS' if expect_success else failure_field, 'observed': report})
        return command

    began = time.perf_counter()
    command = run('landscape', base, True, True)
    run('portrait', portrait, True, True)
    run('fixed', fixed, False, True)
    run('occluded', blocked, True, False)
    run('rapid-target', rapid, True, False, 'motionLimitFailures')
    before = (out/'landscape'/'technical-qa.json').read_bytes()
    with (out/'no-overwrite.log').open('w') as log:
        refused = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    assert refused.returncode != 0
    assert (out/'landscape'/'technical-qa.json').read_bytes() == before

    for name, spec in [('landscape', base), ('portrait', portrait), ('fixed', fixed)]:
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
                            '--python', str(ROOT/'scripts/inspect_scene.py'), '--', '--output', str(snapshot),
                            '--object', 'CAM '+spec['shots'][0]['id']], stdout=log, stderr=subprocess.STDOUT, check=True)
        inspected = json.loads(snapshot.read_text())
        assert inspected['mode'] == 'background_saved_file' and not inspected['isDirty']
        assert inspected['file'] == str(blend) and inspected['selectedObjects'][0]['lens'] == spec['shots'][0]['lens']
        assert digest_before == hashlib.sha256(blend.read_bytes()).hexdigest()
    evidence = {'cases': results, 'savedFileReadback': 'PASS', 'readOnlyInspection': 'PASS', 'noOverwrite': 'PASS',
                'elapsedSeconds': time.perf_counter()-began, 'playback': 'NOT_REVIEWED'}
    (out/'smoke-results.json').write_text(json.dumps(evidence, indent=2))
    print('BLENDER_SMOKE_PASS', str(out))


if __name__ == '__main__':
    main()
