"""Behavior checks for the small config contract; Blender rendering is checked separately."""
import copy
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
from previs_spec import sample, validate


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.spec = json.loads((ROOT/'assets/camera-blocking-example.json').read_text())

    def test_example_and_portrait_continuous_variant(self):
        validate(self.spec)
        spec = copy.deepcopy(self.spec)
        spec['resolution'] = [360, 640]
        spec['fps'] = 12
        spec['shots'] = [spec['shots'][0]]
        spec['shots'][0]['end'] = 96
        spec['shots'][0]['positionKeys'][-1]['frame'] = 96
        validate(spec)
        self.assertEqual(len(spec['shots']), 1)

    def test_cut_gap_and_overlap_are_rejected(self):
        for start in [48, 50]:
            with self.subTest(start=start):
                spec = copy.deepcopy(self.spec)
                spec['shots'][1]['start'] = start
                with self.assertRaisesRegex(ValueError, 'gaps or overlaps'):
                    validate(spec)

    def test_duplicate_identity_and_color_are_rejected(self):
        actors = [obj for obj in self.spec['objects'] if obj.get('identity')]
        actors[1]['identity'] = actors[0]['identity']
        with self.assertRaisesRegex(ValueError, 'one root'):
            validate(self.spec)
        actors[1]['identity'] = 'CHAR-C'
        actors[1]['color'] = actors[0]['color']
        with self.assertRaisesRegex(ValueError, 'colors must be distinct'):
            validate(self.spec)

    def test_degenerate_camera_and_invisible_unknown_subject_are_rejected(self):
        spec = copy.deepcopy(self.spec)
        spec['shots'][0]['targetKeys'] = spec['shots'][0]['positionKeys']
        with self.assertRaisesRegex(ValueError, 'coincides'):
            validate(spec)
        self.spec['visibilityChecks'][0]['object'] = 'missing'
        with self.assertRaisesRegex(ValueError, 'unknown object'):
            validate(self.spec)

    def test_nonfinite_and_odd_resolution_are_rejected(self):
        spec = copy.deepcopy(self.spec)
        spec['objects'][0]['size'][0] = float('nan')
        with self.assertRaisesRegex(ValueError, 'non-finite'):
            validate(spec)
        self.spec['resolution'][0] = 359
        with self.assertRaisesRegex(ValueError, 'even'):
            validate(self.spec)

    def test_unsupported_zoom_and_invalid_capsule_are_not_silently_ignored(self):
        spec = copy.deepcopy(self.spec)
        spec['shots'][0]['lensKeys'] = [{'frame': 1, 'value': 32}, {'frame': 48, 'value': 70}]
        with self.assertRaisesRegex(ValueError, 'unsupported fields lensKeys'):
            validate(spec)
        actor = next(obj for obj in self.spec['objects'] if obj['shape'] == 'capsule')
        actor['size'][2] = .1
        with self.assertRaisesRegex(ValueError, 'capsule height'):
            validate(self.spec)

    def test_linear_pass_through_and_smooth_hold_differ(self):
        track = [{'frame': 1, 'value': [0, 0, 0]}, {'frame': 11, 'value': [10, 0, 0]}]
        self.assertEqual(sample(track, 3), [2, 0, 0])
        self.assertAlmostEqual(sample(track, 3, 'smooth')[0], 1.04)
        self.assertEqual(sample(track, 30), [10, 0, 0])
        self.assertEqual(sample(track[:1], 30), [0, 0, 0])

    def test_continuous_keys_preserve_velocity_and_pass_exactly(self):
        track = [{'frame': 1, 'value': [0, 0, 0]}, {'frame': 11, 'value': [1, 0, 0]},
                 {'frame': 31, 'value': [5, 0, 0]}]
        self.assertEqual(sample(track, 11, 'continuous'), [1, 0, 0])
        dt = .0001
        incoming = (1-sample(track,11-dt,'continuous')[0])/dt
        outgoing = (sample(track,11+dt,'continuous')[0]-1)/dt
        self.assertGreater(incoming, .1)
        self.assertAlmostEqual(incoming, outgoing, places=5)
        # The curve stays within each scalar interval, even with uneven key timing.
        values = [sample(track,1+i*.1,'continuous')[0] for i in range(301)]
        self.assertTrue(all(a <= b for a,b in zip(values,values[1:])))

    def test_continuous_preserves_holds_and_direction_extrema(self):
        track = [{'frame': 1, 'value': [0, 0, 0]}, {'frame': 11, 'value': [1, 0, 0]},
                 {'frame': 21, 'value': [1, 0, 0]}, {'frame': 31, 'value': [-2, 0, 0]}]
        self.assertEqual(sample(track, 16, 'continuous'), [1, 0, 0])
        values = [sample(track,1+i*.1,'continuous')[0] for i in range(301)]
        self.assertLessEqual(max(values), 1)
        self.assertGreaterEqual(min(values), -2)
        self.assertEqual(sample(track[:1], 16, 'continuous'), [0, 0, 0])

    def test_explicit_angular_limit_is_optional_and_positive(self):
        self.spec['shots'][0]['ease'] = 'continuous'
        self.spec['shots'][0]['maxAngularSpeedDegPerSecond'] = 12
        validate(self.spec)
        self.spec['shots'][0]['maxAngularSpeedDegPerSecond'] = 0
        with self.assertRaisesRegex(ValueError, 'limit must be positive'):
            validate(self.spec)


if __name__ == '__main__':
    unittest.main()
