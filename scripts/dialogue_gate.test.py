import copy
import hashlib
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

from dialogue_gate import contract_lines, prompt_lines, validate_dialogue

spec = importlib.util.spec_from_file_location('production_gate', pathlib.Path(__file__).with_name('video-format-gate.py'))
production_gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(production_gate)


class DialogueGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)
        (self.root / 'production').mkdir()
        (self.root / 'library').mkdir()
        self.script = self.root / 'library/script.md'
        self.script.write_text('甲：我自己决定。\n乙：好，等你答复。', encoding='utf-8')
        self.rows = '|ID|说话者|逐字对白|\n|---|---|---|\n|D01|甲|我自己决定。|\n|D02|乙（电话）|好，等你答复。|\n'
        self.confirmation = {'confirmed': True, 'source': 'test:user-message-1', 'quote': '按这版剧本和台词设计分镜。'}
        self.lock = {'script': {'assetId': 'script', 'sha256': self.digest(self.script), 'confirmation': copy.deepcopy(self.confirmation)},
                     'confirmation': copy.deepcopy(self.confirmation), 'units': {'U01': ['D01', 'D02'], 'U02': []}}
        self.body = '画幅：9:16。甲拿起手机。甲：“我自己决定。”乙（电话）：“好，等你答复。”'
        self.write_contract()

    @staticmethod
    def digest(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def write_contract(self):
        self.contract = self.root / 'library/contract.md'
        self.contract.write_text(self.rows + '\n<!-- DIALOGUE_LOCK -->\n```json\n' + json.dumps(self.lock, ensure_ascii=False) + '\n```\n', encoding='utf-8')
        assets = [
            {'assetId': 'script', 'materialType': 'story.episode-script', 'subject': {'episodeId': 'EP01'}, 'path': 'script.md', 'sha256': self.digest(self.script)},
            {'assetId': 'dialogue', 'materialType': 'contract.dialogue', 'subject': {'episodeId': 'EP01'}, 'path': 'contract.md', 'sha256': self.digest(self.contract)}]
        (self.root / 'production/asset-bindings.v1.json').write_text(json.dumps({'assets': assets}), encoding='utf-8')
        self.task = {'dialogueLock': {'assetId': 'dialogue', 'sha256': self.digest(self.contract), 'unitId': 'U01'}}

    def tearDown(self):
        self.tmp.cleanup()

    def test_exact_words_speakers_and_order_pass(self):
        self.assertEqual(validate_dialogue(self.root, self.task, self.body)['lineIds'], ['D01', 'D02'])

    def test_missing_lock_is_not_silent(self):
        with self.assertRaisesRegex(ValueError, 'DIALOGUE_LOCK_REQUIRED'):
            validate_dialogue(self.root, {}, self.body)

    def test_changed_added_deleted_reordered_speaker_and_punctuation_block(self):
        variants = [self.body.replace('自己', '亲自'), self.body + '甲：“谢谢。”',
                    self.body.replace('甲：“我自己决定。”', ''),
                    '乙（电话）：“好，等你答复。”甲：“我自己决定。”',
                    self.body.replace('乙（电话）：', '甲：'), self.body.replace('答复。', '答复！')]
        for body in variants:
            with self.subTest(body=body), self.assertRaisesRegex(ValueError, 'DIALOGUE_MISMATCH'):
                validate_dialogue(self.root, self.task, body)

    def test_visual_only_edit_keeps_dialogue(self):
        validate_dialogue(self.root, self.task, self.body.replace('拿起手机', '放下手机，看向窗外'))

    def test_confirmations_required_separately(self):
        for location in ('script', 'dialogue'):
            with self.subTest(location=location):
                target = self.lock['script']['confirmation'] if location == 'script' else self.lock['confirmation']
                target['confirmed'] = False
                self.write_contract()
                with self.assertRaisesRegex(ValueError, 'explicit user confirmation'):
                    validate_dialogue(self.root, self.task, self.body)
                target['confirmed'] = True

    def test_confirmation_cannot_be_a_bare_boolean(self):
        self.lock['confirmation'] = {'confirmed': True}
        self.write_contract()
        with self.assertRaisesRegex(ValueError, 'locator'):
            validate_dialogue(self.root, self.task, self.body)

    def test_stale_contract_and_script_block(self):
        self.contract.write_text(self.contract.read_text() + '\nchanged')
        with self.assertRaisesRegex(ValueError, 'stale'):
            validate_dialogue(self.root, self.task, self.body)
        self.write_contract()
        self.script.write_text('修改后的剧本')
        with self.assertRaisesRegex(ValueError, 'stale'):
            validate_dialogue(self.root, self.task, self.body)

    def test_contract_cannot_introduce_words_absent_from_script(self):
        self.rows = self.rows.replace('我自己决定。', '我替你决定。')
        self.write_contract()
        with self.assertRaisesRegex(ValueError, 'confirmed script'):
            validate_dialogue(self.root, self.task, self.body)

    def test_missing_or_reordered_coverage_blocks(self):
        for mapping in ({'U01': ['D01']}, {'U01': ['D02', 'D01']}, {'U01': ['D01', 'D02'], 'U02': ['D02']}):
            self.lock['units'] = mapping
            self.write_contract()
            with self.assertRaisesRegex(ValueError, 'cover confirmed dialogue'):
                validate_dialogue(self.root, self.task, self.body)

    def test_explicit_silent_unit_passes_but_speech_fails(self):
        self.task['dialogueLock']['unitId'] = 'U02'
        validate_dialogue(self.root, self.task, '只有键盘声，无对白。')
        with self.assertRaisesRegex(ValueError, 'DIALOGUE_MISMATCH'):
            validate_dialogue(self.root, self.task, self.body)

    def test_unknown_unit_is_not_silent(self):
        self.task['dialogueLock']['unitId'] = 'U03'
        with self.assertRaisesRegex(ValueError, 'Unit missing'):
            validate_dialogue(self.root, self.task, '')

    def test_nested_quotes_preserve_original_text(self):
        self.assertEqual(prompt_lines('甲：“别替我把“愿意”填上。”'), [{'speaker': '甲', 'text': '别替我把“愿意”填上。'}])

    def test_ambiguous_quote_and_unclosed_quote_block(self):
        for body in ('甲笑着说“我自己决定。”', '甲：“我自己决定。', '甲：“我自己决定。」'):
            with self.subTest(body=body), self.assertRaises(ValueError):
                prompt_lines(body)

    def test_written_text_is_not_spoken(self):
        self.assertEqual(prompt_lines('画面文字：“明天见”。书面文字：“九点”。'), [])

    def test_existing_table_header_variants(self):
        rows = self.rows.replace('|ID|', '|对白ID|').replace('说话者', '说话人').replace('逐字对白', '逐字台词')
        self.assertEqual(contract_lines(rows)[1]['speaker'], '乙（电话）')

    def test_duplicate_contract_line_id_blocks(self):
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            contract_lines(self.rows.replace('D02', 'D01'))

    def test_duplicate_lock_markers_block_even_with_one_good_block(self):
        self.rows += '\n<!-- DIALOGUE_LOCK -->\n'
        self.write_contract()
        with self.assertRaisesRegex(ValueError, 'Exactly one'):
            validate_dialogue(self.root, self.task, self.body)

    def test_wrong_episode_blocks(self):
        index = self.root / 'production/asset-bindings.v1.json'
        data = json.loads(index.read_text())
        data['assets'][0]['subject']['episodeId'] = 'EP02'
        index.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'same episode'):
            validate_dialogue(self.root, self.task, self.body)

    def test_changed_words_block_real_entry_before_any_cli_call(self):
        lock = {'locked': True, 'orientation': 'portrait', 'aspectRatio': '9:16',
                'timelineWidth': 1080, 'timelineHeight': 1920, 'canvasIds': ['test-canvas'], 'authority': 'test user decision'}
        (self.root / 'PRODUCTION_RULES.md').write_text('<!-- VIDEO_FORMAT_LOCK -->\n```json\n' + json.dumps(lock) + '\n```')
        changed = self.body.replace('我自己决定。', '我替你决定。')
        prompt = self.root / 'prompt.md'
        prompt.write_text(changed, encoding='utf-8')
        task = {**self.task, 'projectUuid': 'test-canvas', 'promptPath': 'prompt.md',
                'promptSha256': self.digest(prompt), 'mediaNodeIds': [], 'localPublicationVerified': True}
        (self.root / 'task.json').write_text(json.dumps(task), encoding='utf-8')
        for action in ('check', 'create', 'run'):
            with self.subTest(action=action), patch.object(sys, 'argv', ['gate', action, '--project-dir', str(self.root), '--task', 'task.json']), \
                    patch.object(production_gate, 'cli') as remote, patch.object(production_gate.subprocess, 'run') as process:
                with self.assertRaisesRegex(ValueError, 'DIALOGUE_MISMATCH'):
                    production_gate.main()
                remote.assert_not_called()
                process.assert_not_called()

    def test_cross_project_contract_and_symlink_block(self):
        index = self.root / 'production/asset-bindings.v1.json'
        data = json.loads(index.read_text())
        data['assets'][1]['path'] = '../contract.md'
        index.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'parents or symlinks'):
            validate_dialogue(self.root, self.task, self.body)
        self.write_contract()
        link = self.root / 'library/link.md'
        link.symlink_to(self.contract)
        data = json.loads(index.read_text())
        data['assets'][1]['path'] = 'link.md'
        index.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'parents or symlinks'):
            validate_dialogue(self.root, self.task, self.body)


if __name__ == '__main__':
    unittest.main()
