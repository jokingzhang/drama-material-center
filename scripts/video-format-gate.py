#!/usr/bin/env python3
"""Project-locked video generation through the official LibTV CLI (fail closed)."""
import argparse, hashlib, json, pathlib, re, subprocess, sys

# Keep the same checks when this entry point is executed or imported for audits.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from dialogue_gate import validate_dialogue


def unique_json_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'Duplicate JSON key: {key}')
        result[key] = value
    return result


def read_json(text):
    return json.loads(text, object_pairs_hook=unique_json_object)


def nonempty_string(value):
    return isinstance(value, str) and bool(value.strip()) and value == value.strip()


def unique_strings(value):
    return (isinstance(value, list) and all(nonempty_string(item) for item in value)
            and len(value) == len(set(value)))


def load_lock(project):
    text = project_file(project, 'PRODUCTION_RULES.md').read_text(encoding='utf-8')
    # Count the marker too: a second malformed block must not be silently ignored.
    if text.count('<!-- VIDEO_FORMAT_LOCK -->') != 1:
        raise ValueError('Exactly one VIDEO_FORMAT_LOCK is required; no template/default fallback')
    blocks = re.findall(r'<!-- VIDEO_FORMAT_LOCK -->\s*```json\s*(.*?)\s*```', text, re.S)
    if len(blocks) != 1:
        raise ValueError('Exactly one VIDEO_FORMAT_LOCK is required; no template/default fallback')
    lock = read_json(blocks[0])
    if not isinstance(lock, dict):
        raise ValueError('Project video lock must be a JSON object')
    orientation = lock.get('orientation')
    if not isinstance(orientation, str):
        raise ValueError('Project video orientation must be portrait or landscape')
    ratio = {'portrait': '9:16', 'landscape': '16:9'}.get(orientation)
    if not ratio or lock.get('aspectRatio') != ratio or lock.get('locked') is not True:
        raise ValueError('Invalid or unlocked project video orientation')
    w, h = lock['timelineWidth'], lock['timelineHeight']
    check_dimensions(lock, w, h)
    # A new drama can lock its format before it has a canvas. Creating/running
    # video nodes still requires an exact canvas binding in validate_task().
    if not unique_strings(lock.get('canvasIds')) or not nonempty_string(lock.get('authority')):
        raise ValueError('Explicit authority and a unique canvasIds array are required')
    return lock


def check_dimensions(lock, width, height):
    if type(width) is not int or type(height) is not int or min(width, height) <= 0:
        raise ValueError('Video dimensions must be positive integers')
    a, b = map(int, lock['aspectRatio'].split(':'))
    if width * b != height * a:
        raise ValueError(f'FORMAT_MISMATCH: {width}x{height} != project {a}:{b}')


def project_file(project, relative):
    root = pathlib.Path(project).resolve()
    if not nonempty_string(relative):
        raise ValueError('Input must be an existing project-contained relative file')
    candidate = pathlib.Path(relative)
    if candidate.is_absolute() or '..' in candidate.parts:
        raise ValueError('Input must be an existing project-contained relative file')
    current = root
    for part in candidate.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError('Project inputs must not be symbolic links')
    path = current.resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError('Input must be an existing project-contained relative file')
    return path


def validate_prompt_format(body, lock):
    # The explicit video-format declaration is mandatory; artwork dimensions
    # or a template filename never supply a missing production format.
    video_lines = []
    for line in body.splitlines():
        is_reference = bool(re.match(r'\s*(?:[-*]\s*)?(?:\*\*)?\{\{Node [^}]+\}\}', line))
        is_reference = is_reference or bool(re.match(r'\s*(?:[-*]\s*)?参考(?:图|图片|场景|母版)', line))
        if is_reference and not re.search(r'(?:视频|输出)\s*(?:画幅|比例|方向|[：:]|采用|使用|做成|生成)', line):
            continue
        video_lines.append(line)
    video_text = '\n'.join(video_lines)
    ratio_pattern = r'(\d+\s*[:：]\s*\d+)'
    declared = re.findall(r'画幅\s*[：:]\s*' + ratio_pattern, video_text)
    normalize = lambda value: re.sub(r'\s+', '', value).replace('：', ':')
    if len(declared) != 1 or normalize(declared[0]) != lock['aspectRatio']:
        raise ValueError('Prompt aspect ratio conflicts with the project lock; repair local version first')

    # Check other explicit output declarations instead of accepting a correct
    # header followed by conflicting instructions. Reference-image lines may
    # legitimately describe a landscape scene master for a portrait video.
    output_labels = r'(?:画幅|视频比例|输出比例|视频画幅|输出画幅|aspect\s*ratio|aspectRatio)'
    for ratio in re.findall(output_labels + r'\s*[：:=]?\s*' + ratio_pattern, video_text, re.I):
        if normalize(ratio) != lock['aspectRatio']:
            raise ValueError('Conflicting output aspect ratio in prompt')
    opposite = '横屏|landscape' if lock['orientation'] == 'portrait' else '竖屏|portrait'
    for line in video_lines:
        if not line.strip():
            continue
        # Reject contradictory orientation instructions. A simple explicit
        # negative (e.g. 禁止横屏) is a constraint, not a second orientation.
        for match in re.finditer(opposite, line, re.I):
            prefix = line[:match.start()]
            if re.search(r'(?:不(?:要|得|使用|采用|做成|是)?|禁止|避免|非|no|not)\s*$', prefix, re.I):
                continue
            raise ValueError('Conflicting output orientation in prompt')


def validate_task(project, task):
    lock = load_lock(project)
    if not isinstance(task, dict):
        raise ValueError('Task must be a JSON object')
    if not nonempty_string(task.get('projectUuid')) or task['projectUuid'] not in lock['canvasIds']:
        raise ValueError('Canvas is not bound to this drama')
    body = project_file(project, task['promptPath']).read_text(encoding='utf-8')
    if hashlib.sha256(body.encode()).hexdigest() != task['promptSha256']:
        raise ValueError('Local prompt hash mismatch')
    validate_prompt_format(body, lock)
    for field in ('ratio', 'aspectRatio'):
        if task.get(field, lock['aspectRatio']) != lock['aspectRatio']:
            raise ValueError('Task ratio conflicts with the project lock')
    if task.get('orientation', lock['orientation']) != lock['orientation']:
        raise ValueError('Task orientation conflicts with the project lock')
    if not unique_strings(task.get('mediaNodeIds')):
        raise ValueError('mediaNodeIds must be a unique array')
    refs = re.findall(r'\{\{Node ([^}]+)\}\}', body)
    if refs != task['mediaNodeIds'] or len(refs) != len(set(refs)):
        raise ValueError('Prompt references must match ordered, unique mediaNodeIds')
    if task.get('localPublicationVerified') is not True:
        raise ValueError('Formal index, local API and page verification required before creation')
    validate_dialogue(project, task, body)
    return lock, body


def cli(args):
    result = subprocess.run(['libtv', *args], text=True, capture_output=True, check=True)
    return read_json(result.stdout)


def preflight(project, task):
    lock, body = validate_task(project, task)
    text = cli(['node', task['textNodeId'], '-p', task['projectUuid']])
    video = cli(['node', task['videoNodeId'], '-p', task['projectUuid']])
    graph = cli(['project', task['projectUuid']])
    params = video['data']['params']
    bodies = [body.strip(), '\n'.join(text['data']['content']).strip(), params['prompt'].strip()]
    if len(set(bodies)) != 1:
        raise ValueError('Local/text/video prompt mismatch')
    expected = {'ratio': lock['aspectRatio'], 'resolution': task['resolution'],
                'duration': task['durationSeconds'], 'enableSound': 'on'}
    if params['settings'] != expected or params['model'] != task['model'] or params['modeType'] != 'mixed2video':
        raise ValueError('Node settings differ from project-locked task')
    if params.get('advancedSettings', {}).get('extendPrompt') != 0:
        raise ValueError('Unexpected prompt extension')
    media = sum((params.get(k + 'List', []) for k in ['image', 'audio', 'video']), [])
    ids = [x['nodeId'] for x in media]
    if len(ids) != len(set(ids)) or set(ids) != set(task['mediaNodeIds']):
        raise ValueError('Actual media references differ')
    expected_order = sorted(task['mediaNodeIds'], key=lambda n: {'image': 0, 'video': 1, 'audio': 2}[task.get('mediaTypes', {}).get(n, 'image')])
    if params.get('mixedListOrder') != expected_order:
        raise ValueError('Mixed reference order differs')
    if params.get('mixedList') is not None and [x['nodeId'] for x in params['mixedList']] != expected_order:
        raise ValueError('Stale mixed media list')
    incoming = {e['source'] for e in graph['edges'] if e['target'] == task['videoNodeId']}
    if incoming != set(task['mediaNodeIds'] + [task['textNodeId']]):
        raise ValueError('Actual graph edges differ')
    return {'projectLock': lock, 'threePromptSha256': [hashlib.sha256(x.encode()).hexdigest() for x in bodies],
            'settings': expected, 'mediaAndEdges': 'PASS'}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('action', choices=['check', 'create', 'run', 'media'])
    ap.add_argument('--project-dir', required=True)
    ap.add_argument('--task')
    ap.add_argument('--file')
    ap.add_argument('--final', action='store_true')
    args = ap.parse_args()
    lock = load_lock(args.project_dir)
    if args.action == 'media':
        path = project_file(args.project_dir, args.file)
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', str(path)], text=True))['streams'][0]
        check_dimensions(lock, probe['width'], probe['height'])
        if args.final and (probe['width'], probe['height']) != (lock['timelineWidth'], lock['timelineHeight']):
            raise ValueError('Final dimensions differ from locked timeline')
        print(json.dumps({'status': 'PASS', 'dimensions': probe, 'lock': lock}, ensure_ascii=False)); return
    task_path = project_file(args.project_dir, args.task)
    task = read_json(task_path.read_text(encoding='utf-8'))
    lock, body = validate_task(args.project_dir, task)
    if args.action == 'check':
        print(json.dumps({'status': 'PASS', 'projectLock': lock}, ensure_ascii=False)); return
    if args.action == 'create':
        if task.get('videoNodeId'):
            raise ValueError('Task already has videoNodeId; no duplicate creation')
        command = ['node', '--x', str(task['x']), '--y', str(task['y']), 'create', task['name'], '-p', task['projectUuid'], '-t', 'video']
        for setting in [f"model={task['model']}", 'modeType=mixed2video', f"ratio={lock['aspectRatio']}", f"resolution={task['resolution']}", f"duration={task['durationSeconds']}", 'enableSound=on', 'extendPrompt=0', 'count=1']:
            command.extend(['-s', setting])
        for node in [task['textNodeId'], *task['mediaNodeIds']]:
            command.extend(['--left', node])
        result = cli(command + ['--prompt', body])
        task['videoNodeId'] = result.get('nodeKey') or result.get('newNodeKey')
        if not task['videoNodeId']: raise ValueError('Created node response missing ID; inspect before retry')
        task_path.write_text(json.dumps(task, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(result, ensure_ascii=False)); return
    if task.get('runDispatched'):
        raise ValueError('Already dispatched; inspect existing run instead of retrying')
    evidence = preflight(args.project_dir, task)
    task['preflight'] = evidence
    task['runDispatched'] = True
    task_path.write_text(json.dumps(task, ensure_ascii=False, indent=2) + '\n')
    # CLI waits for terminal state. No second submission or external task polling.
    subprocess.run(['libtv', 'node', task['videoNodeId'], '-p', task['projectUuid'], '--run'], check=True)

if __name__ == '__main__':
    try: main()
    except (ValueError, KeyError, TypeError, AttributeError, IndexError, OSError, subprocess.CalledProcessError) as exc:
        print(f'VIDEO_FORMAT_GATE_BLOCKED: {exc}', file=sys.stderr); sys.exit(1)
