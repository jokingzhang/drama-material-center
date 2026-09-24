"""Pre-spend dialogue checks against the current, user-confirmed formal contract.

No network calls and no writes. Confirmation evidence is recorded by the agent
from real user decisions; this validator cannot authenticate a conversation.
"""
import hashlib
import json
import pathlib
import re


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'Duplicate JSON key: {key}')
        result[key] = value
    return result


def read_json(text):
    return json.loads(text, object_pairs_hook=unique_object)


def contained_file(project, relative):
    root = pathlib.Path(project).resolve()
    if not isinstance(relative, str) or pathlib.Path(relative).is_absolute():
        raise ValueError('Dialogue sources must use project-relative paths')
    path = root / relative
    if '..' in pathlib.Path(relative).parts or any(p.is_symlink() for p in [path, *path.parents] if p != root):
        raise ValueError('Dialogue sources cannot traverse parents or symlinks')
    if not path.resolve().is_relative_to(root) or not path.is_file():
        raise ValueError('Dialogue source missing or outside project')
    return path


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def approval(value, name):
    if not isinstance(value, dict) or value.get('confirmed') is not True:
        raise ValueError(f'{name} requires the existing explicit user confirmation')
    if any(not isinstance(value.get(k), str) or not value[k].strip() for k in ('source', 'quote')):
        raise ValueError(f'{name} requires a user-message locator and verbatim quote')


def bound_source(project, assets, asset_id, material_type, expected_hash):
    candidates = [a for a in assets if a.get('assetId') == asset_id]
    if len(candidates) != 1:
        raise ValueError('Dialogue/script source must resolve to one current formal asset')
    asset = candidates[0]
    if asset.get('materialType') != material_type or asset.get('status', '').startswith(('REJECTED', 'SUPERSEDED', 'MISSING')):
        raise ValueError('Wrong or unavailable dialogue/script asset')
    # Formal binding paths are relative to library, as in the existing schema.
    relative = asset['path']
    if pathlib.Path(relative).is_absolute() or relative.startswith('library/'):
        raise ValueError('Formal asset path must be relative to library')
    path = contained_file(project, 'library/' + relative)
    if sha256(path) != expected_hash or asset.get('sha256') != expected_hash:
        raise ValueError('Dialogue/script source changed; stale confirmation or task')
    return asset, path


def contract_lines(text):
    """Read the existing contract.dialogue Markdown table, preserving row order."""
    aliases = {'id': {'ID', '对白ID', '台词ID'},
               'speaker': {'说话者', '说话人'},
               'text': {'逐字对白', '逐字台词', '逐字正文'}}
    columns = None
    result = []
    for raw in text.splitlines():
        if not raw.strip().startswith('|'):
            columns = None
            continue
        cells = [c.strip().replace(r'\|', '|') for c in re.split(r'(?<!\\)\|', raw.strip().strip('|'))]
        if all(re.fullmatch(r':?-+:?', c) for c in cells):
            continue
        header = {key: next((i for i, c in enumerate(cells) if c in names), None) for key, names in aliases.items()}
        if all(i is not None for i in header.values()):
            columns = header
            continue
        if columns is not None:
            if len(cells) <= max(columns.values()):
                raise ValueError('Malformed dialogue table row')
            row = {key: cells[i] for key, i in columns.items()}
            if not all(row.values()) or row['id'] in [r['id'] for r in result]:
                raise ValueError('Empty or duplicate dialogue line')
            result.append(row)
    if not result:
        # A truly silent scope still needs a formal, explicit declaration.
        if '本范围无对白' not in text:
            raise ValueError('No readable dialogue table or explicit silent-scope declaration')
    return result


def prompt_lines(body):
    """Explicit attribution: 角色（声源）：“逐字正文”. Nested quotes stay verbatim.

    Other quoted text must be explicitly labelled 画面文字/书面文字. Ambiguous
    quotation is rejected instead of guessing that it is not new dialogue.
    """
    pairs = {'“': '”', '「': '」', '『': '』', '"': '"'}
    closers = set(pairs.values())
    result = []
    i = 0
    while i < len(body):
        if body[i] not in pairs:
            if body[i] in closers:
                raise ValueError('Unbalanced prompt quotation')
            i += 1
            continue
        start = i
        stack = [pairs[body[i]]]
        i += 1
        while i < len(body) and stack:
            char = body[i]
            if char == stack[-1]:
                stack.pop()
            elif char in pairs:
                stack.append(pairs[char])
            elif char in closers:
                raise ValueError('Mismatched prompt quotation')
            i += 1
        if stack:
            raise ValueError('Unclosed prompt quotation')
        prefix = re.search(r'([\w·]+(?:（[^（）\n]+）)?)\s*[：:]\s*$', body[:start])
        if not prefix:
            raise ValueError('Quoted prompt text requires explicit speaker attribution or 画面文字 label')
        speaker = prefix[1]
        if speaker in ('画面文字', '书面文字'):
            continue
        result.append({'speaker': speaker, 'text': body[start + 1:i - 1]})
    return result


def validate_dialogue(project, task, body):
    spec = task.get('dialogueLock')
    if not isinstance(spec, dict):
        raise ValueError('DIALOGUE_LOCK_REQUIRED: confirm script → confirm dialogue → design shots')
    assets = read_json(contained_file(project, 'production/asset-bindings.v1.json').read_text(encoding='utf-8'))['assets']
    asset, path = bound_source(project, assets, spec['assetId'], 'contract.dialogue', spec['sha256'])
    text = path.read_text(encoding='utf-8')
    marker = '<!-- DIALOGUE_LOCK -->'
    blocks = re.findall(re.escape(marker) + r'\s*```json\s*(.*?)\s*```', text, re.S)
    if text.count(marker) != 1 or len(blocks) != 1:
        raise ValueError('Exactly one DIALOGUE_LOCK block is required in the formal contract')
    lock = read_json(blocks[0])
    script = lock['script']
    script_asset, script_path = bound_source(project, assets, script['assetId'], 'story.episode-script', script['sha256'])
    episode = asset.get('subject', {}).get('episodeId')
    if not episode or script_asset.get('subject', {}).get('episodeId') != episode:
        raise ValueError('Script and dialogue must belong to the same episode')
    approval(script.get('confirmation'), 'Script')
    approval(lock.get('confirmation'), 'Dialogue')
    lines = contract_lines(text)
    script_text = script_path.read_text(encoding='utf-8')
    if any(line['text'] not in script_text for line in lines):
        raise ValueError('Dialogue contract differs from the confirmed script')
    units = lock['units']
    if not isinstance(units, dict) or not units or any(not isinstance(ids, list) for ids in units.values()):
        raise ValueError('Missing unit-to-dialogue mapping')
    ids = [line['id'] for line in lines]
    if [line_id for unit_ids in units.values() for line_id in unit_ids] != ids:
        raise ValueError('Unit mapping must cover confirmed dialogue exactly once, in order')
    unit_id = spec['unitId']
    if unit_id not in units:
        raise ValueError('Unit missing from confirmed dialogue mapping; do not assume silence')
    expected = [{k: line[k] for k in ('speaker', 'text')} for line in lines if line['id'] in units[unit_id]]
    actual = prompt_lines(body)
    if actual != expected:
        raise ValueError('DIALOGUE_MISMATCH: added/removed/reordered/changed words or speaker; no paid submission')
    return {'status': 'PASS', 'contractSha256': spec['sha256'], 'scriptSha256': script['sha256'],
            'unitId': unit_id, 'lineIds': units[unit_id]}
