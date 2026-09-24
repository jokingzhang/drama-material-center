"""Regression tests for pre-spend project format gates. No network or generation."""
import contextlib
import hashlib
import importlib.util
import io
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    'gate', pathlib.Path(__file__).with_name('video-format-gate.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class GateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        self.lock = {
            'locked': True, 'orientation': 'portrait', 'aspectRatio': '9:16',
            'timelineWidth': 1080, 'timelineHeight': 1920,
            'canvasIds': ['drama-canvas'], 'authority': 'explicit user decision',
        }
        self.write_lock()
        # Format cases isolate this gate; integration cases below re-enable the
        # real dialogue gate to prove a missing dialogue lock cannot spend.
        self.dialogue_patch = patch.object(gate, 'validate_dialogue', return_value={})
        self.dialogue_check = self.dialogue_patch.start()
        self.addCleanup(self.dialogue_patch.stop)

    def write_lock(self, suffix=''):
        (self.root / 'PRODUCTION_RULES.md').write_text(
            '<!-- VIDEO_FORMAT_LOCK -->\n```json\n' + json.dumps(self.lock) + '\n```' + suffix,
            encoding='utf-8')

    def task(self, body=None, **overrides):
        if body is None:
            body = f"画幅：{self.lock['aspectRatio']}\n{{{{Node person}}}}"
        (self.root / 'prompt.md').write_text(body, encoding='utf-8')
        task = {
            'projectUuid': 'drama-canvas', 'promptPath': 'prompt.md',
            'promptSha256': hashlib.sha256(body.encode()).hexdigest(),
            'mediaNodeIds': ['person'], 'localPublicationVerified': True,
            'textNodeId': 'text', 'model': 'Wan 3.0', 'resolution': '720P',
            'durationSeconds': 8, 'x': 100, 'y': 200, 'name': 'scene',
        }
        task.update(overrides)
        return task

    def invoke(self, action, task):
        (self.root / 'task.json').write_text(json.dumps(task), encoding='utf-8')
        with patch.object(sys, 'argv', [
            'video-format-gate.py', action, '--project-dir', str(self.root), '--task', 'task.json',
        ]), contextlib.redirect_stdout(io.StringIO()):
            gate.main()

    def node_responses(self, task, ratio=None):
        body = (self.root / task['promptPath']).read_text(encoding='utf-8')
        params = {
            'prompt': body, 'model': task['model'], 'modeType': 'mixed2video',
            'settings': {'ratio': ratio or self.lock['aspectRatio'], 'resolution': '720P',
                         'duration': 8, 'enableSound': 'on'},
            'advancedSettings': {'extendPrompt': 0},
            'imageList': [{'nodeId': 'person'}], 'mixedListOrder': ['person'],
        }
        return [
            {'data': {'content': [body]}}, {'data': {'params': params}},
            {'edges': [{'source': node, 'target': task['videoNodeId']} for node in ['person', 'text']]},
        ]

    def test_missing_lock_has_no_default(self):
        (self.root / 'PRODUCTION_RULES.md').write_text('no format', encoding='utf-8')
        with self.assertRaises(ValueError):
            gate.load_lock(self.root)

    def test_duplicate_markers_including_malformed_second_block_are_blocked(self):
        for suffix in ['\n<!-- VIDEO_FORMAT_LOCK -->\ninvalid',
                       '\n<!-- VIDEO_FORMAT_LOCK -->\n```json\n{}\n```']:
            with self.subTest(suffix=suffix):
                self.write_lock(suffix)
                with self.assertRaisesRegex(ValueError, 'Exactly one'):
                    gate.load_lock(self.root)

    def test_duplicate_json_keys_are_not_silently_overridden(self):
        text = '<!-- VIDEO_FORMAT_LOCK -->\n```json\n{"orientation":"landscape",' + json.dumps(self.lock)[1:] + '\n```'
        (self.root / 'PRODUCTION_RULES.md').write_text(text, encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'Duplicate JSON key'):
            gate.load_lock(self.root)

    def test_portrait_and_landscape_locks(self):
        gate.check_dimensions(gate.load_lock(self.root), 720, 1280)
        with self.assertRaises(ValueError):
            gate.check_dimensions(self.lock, 1280, 720)
        self.lock.update(orientation='landscape', aspectRatio='16:9', timelineWidth=1920, timelineHeight=1080)
        self.write_lock()
        gate.check_dimensions(gate.load_lock(self.root), 1280, 720)
        with self.assertRaises(ValueError):
            gate.check_dimensions(self.lock, 720, 1280)

    def test_invalid_or_unlocked_schema_is_blocked(self):
        cases = [
            {'locked': False}, {'locked': 'true'}, {'orientation': 'auto'}, {'orientation': {}}, {'aspectRatio': '16:9'},
            {'timelineWidth': True}, {'timelineWidth': 0}, {'timelineHeight': 1080},
            {'canvasIds': 'drama-canvas'}, {'canvasIds': ['drama-canvas', 'drama-canvas']},
            {'canvasIds': ['']}, {'canvasIds': [False]}, {'authority': True}, {'authority': '  '},
        ]
        original = dict(self.lock)
        for invalid in cases:
            with self.subTest(invalid=invalid):
                self.lock = {**original, **invalid}
                self.write_lock()
                with self.assertRaises((ValueError, KeyError)):
                    gate.load_lock(self.root)

    def test_new_project_can_lock_format_before_canvas_but_cannot_create_video(self):
        self.lock['canvasIds'] = []
        self.write_lock()
        self.assertEqual(gate.load_lock(self.root)['aspectRatio'], '9:16')
        with patch.object(gate, 'cli') as remote:
            with self.assertRaisesRegex(ValueError, 'Canvas'):
                self.invoke('create', self.task())
            remote.assert_not_called()

    def test_canvas_binding_is_exact(self):
        for canvas in ['drama', 'another-drama', '', None]:
            with self.subTest(canvas=canvas), self.assertRaisesRegex(ValueError, 'Canvas'):
                gate.validate_task(self.root, self.task(projectUuid=canvas))

    def test_prompt_must_declare_one_matching_ratio(self):
        for body in ['竖屏\n{{Node person}}', '画幅：16:9\n{{Node person}}',
                     '{{Node person}}：参考图画幅：9:16',
                     '画幅：9:16\n画幅：9:16\n{{Node person}}']:
            with self.subTest(body=body), self.assertRaisesRegex(ValueError, 'aspect ratio'):
                gate.validate_task(self.root, self.task(body))

    def test_conflicting_output_orientation_or_ratio_in_body_is_blocked(self):
        for extra in ['横屏电影', '输出比例：16:9', '画幅16:9', '输出方向：landscape',
                      '视频画幅：16：9', '横屏 {{Node person}}']:
            with self.subTest(extra=extra), self.assertRaisesRegex(ValueError, 'Conflicting|aspect ratio'):
                gate.validate_task(self.root, self.task('画幅：9:16\n' + extra + '\n{{Node person}}'))

    def test_scene_reference_orientation_does_not_override_video_format(self):
        body = '画幅：9:16；禁止横屏\n- {{Node person}}：横屏场景母版，画幅：16:9。'
        gate.validate_task(self.root, self.task(body))

    def test_video_direction_cannot_be_hidden_in_reference_line(self):
        body = '画幅：9:16\n- {{Node person}}：视频采用横屏。'
        with self.assertRaisesRegex(ValueError, 'Conflicting'):
            gate.validate_task(self.root, self.task(body))

    def test_non_object_tasks_are_rejected_before_remote_calls(self):
        for task in [[], 'portrait', None, True]:
            with self.subTest(task=task), patch.object(gate, 'cli') as remote:
                with self.assertRaisesRegex(ValueError, 'Task must'):
                    self.invoke('create', task)
                remote.assert_not_called()

    def test_task_metadata_cannot_override_project_format(self):
        for field, value in [('ratio', '16:9'), ('aspectRatio', '16:9'), ('orientation', 'landscape')]:
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'conflicts'):
                gate.validate_task(self.root, self.task(**{field: value}))

    def test_validated_dialogue_is_required_by_shared_task_validator(self):
        task = self.task()
        gate.validate_task(self.root, task)
        self.dialogue_check.assert_called_once_with(self.root, task, (self.root / 'prompt.md').read_text())

    def test_missing_dialogue_lock_blocks_create_and_run_before_remote_call(self):
        self.dialogue_patch.stop()
        for action in ['create', 'run']:
            with self.subTest(action=action), patch.object(gate, 'cli') as remote, patch.object(gate.subprocess, 'run') as process:
                with self.assertRaises(ValueError):
                    self.invoke(action, self.task())
                remote.assert_not_called()
                process.assert_not_called()

    def test_missing_format_lock_blocks_create_and_run_before_remote_call(self):
        (self.root / 'PRODUCTION_RULES.md').write_text('no format', encoding='utf-8')
        for action in ['create', 'run']:
            with self.subTest(action=action), patch.object(gate, 'cli') as remote, patch.object(gate.subprocess, 'run') as process:
                with self.assertRaises(ValueError):
                    self.invoke(action, self.task())
                remote.assert_not_called()
                process.assert_not_called()

    def test_wrong_ratio_blocks_create_and_run_before_remote_call(self):
        for action in ['create', 'run']:
            with self.subTest(action=action), patch.object(gate, 'cli') as remote, patch.object(gate.subprocess, 'run') as process:
                with self.assertRaises(ValueError):
                    self.invoke(action, self.task(ratio='16:9'))
                remote.assert_not_called()
                process.assert_not_called()

    def test_creation_parameters_come_from_lock_for_both_orientations(self):
        for orientation, ratio, width, height in [('portrait', '9:16', 1080, 1920), ('landscape', '16:9', 1920, 1080)]:
            with self.subTest(orientation=orientation):
                self.lock.update(orientation=orientation, aspectRatio=ratio, timelineWidth=width, timelineHeight=height)
                self.write_lock()
                with patch.object(gate, 'cli', return_value={'nodeKey': 'created'}) as remote:
                    self.invoke('create', self.task())
                command = remote.call_args.args[0]
                self.assertEqual([item for item in command if item.startswith('ratio=')], ['ratio=' + ratio])
                self.assertNotIn('--run', command)
                self.assertEqual(json.loads((self.root / 'task.json').read_text())['videoNodeId'], 'created')

    def test_live_node_wrong_ratio_blocks_paid_run(self):
        for orientation, ratio, wrong, width, height in [('portrait', '9:16', '16:9', 1080, 1920), ('landscape', '16:9', '9:16', 1920, 1080)]:
            with self.subTest(orientation=orientation):
                self.lock.update(orientation=orientation, aspectRatio=ratio, timelineWidth=width, timelineHeight=height)
                self.write_lock()
                task = self.task(videoNodeId='video')
                with patch.object(gate, 'cli', side_effect=self.node_responses(task, wrong)), patch.object(gate.subprocess, 'run') as process:
                    with self.assertRaisesRegex(ValueError, 'Node settings'):
                        self.invoke('run', task)
                    process.assert_not_called()
                self.assertNotIn('runDispatched', json.loads((self.root / 'task.json').read_text()))

    def test_live_prompt_change_blocks_paid_run(self):
        task = self.task(videoNodeId='video')
        responses = self.node_responses(task)
        responses[1]['data']['params']['prompt'] += '\n横屏'
        with patch.object(gate, 'cli', side_effect=responses), patch.object(gate.subprocess, 'run') as process:
            with self.assertRaisesRegex(ValueError, 'prompt mismatch'):
                self.invoke('run', task)
            process.assert_not_called()

    def test_matching_preflight_records_three_identical_prompt_hashes(self):
        task = self.task(videoNodeId='video')
        with patch.object(gate, 'cli', side_effect=self.node_responses(task)):
            evidence = gate.preflight(self.root, task)
        self.assertEqual(evidence['threePromptSha256'], [task['promptSha256']] * 3)
        self.assertEqual(evidence['settings']['ratio'], '9:16')

    def test_project_inputs_cannot_escape_or_be_symlinks(self):
        self.task()
        (self.root / 'linked.md').symlink_to(self.root / 'prompt.md')
        for relative in ['../outside.md', str(self.root / 'prompt.md'), 'linked.md']:
            with self.subTest(relative=relative), self.assertRaises(ValueError):
                gate.project_file(self.root, relative)

    def test_publication_flag_must_be_true_not_truthy_text(self):
        with self.assertRaisesRegex(ValueError, 'Formal index'):
            gate.validate_task(self.root, self.task(localPublicationVerified='pending'))


if __name__ == '__main__':
    unittest.main()
