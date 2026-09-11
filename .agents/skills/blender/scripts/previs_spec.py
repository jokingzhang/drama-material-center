"""Small, portable contract for the optional primitive previs builder."""
import math
import re


def require(ok, message):
    if not ok:
        raise ValueError(message)


def fields(value, allowed, label):
    require(isinstance(value, dict), label + ': expected an object')
    unknown = set(value) - set(allowed.split())
    require(not unknown, label + ': unsupported fields ' + ', '.join(sorted(unknown)) + '; use custom bpy when needed')


def vector(value, label, positive=False):
    require(isinstance(value, list) and len(value) == 3, label + ': expected three numbers')
    require(all(type(x) in (int, float) and math.isfinite(x) for x in value), label + ': non-finite number')
    require(not positive or all(x > 0 for x in value), label + ': dimensions must be positive')


def keys(value, label, start, end, cover=False):
    require(isinstance(value, list) and bool(value), label + ': empty track')
    frames = []
    for key in value:
        fields(key, 'frame value', label)
        require(type(key.get('frame')) is int, label + ': integer frame required')
        frames.append(key['frame'])
        vector(key.get('value'), label)
    require(all(start <= f <= end for f in frames), label + ': frame outside interval')
    require(frames == sorted(set(frames)), label + ': duplicate/unordered frame')
    require(not cover or len(frames) == 1 or (frames[0] == start and frames[-1] == end), label + ': cover both shot boundaries')


def validate(spec):
    fields(spec, 'schemaVersion id version purpose fps frames resolution objects shots visibilityChecks', 'spec')
    require(spec.get('schemaVersion') == 1, 'schemaVersion must be 1')
    require(bool(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', spec.get('id', ''))), 'invalid id')
    require(bool(re.fullmatch(r'v\d{2,}', spec.get('version', ''))), 'version must be vNN')
    require(spec.get('purpose') in ('camera', 'blocking', 'state', 'performance'), 'declare purpose')
    require(type(spec.get('fps')) is int and 1 <= spec['fps'] <= 120, 'fps must be an integer from 1 to 120')
    require(type(spec.get('frames')) is int and spec['frames'] > 0, 'positive integer frames required')
    n = spec['frames']
    res = spec.get('resolution')
    require(isinstance(res, list) and len(res) == 2 and all(type(v) is int and v > 0 and v % 2 == 0 for v in res), 'resolution must contain positive even width/height')
    objects = spec.get('objects', [])
    require(isinstance(objects, list), 'objects must be a list')
    ids, identities, colors = set(), set(), set()
    for obj in objects:
        fields(obj, 'id identity shape size color locationKeys rotationKeys ease', 'object')
        oid = obj.get('id', '')
        require(isinstance(oid, str) and bool(oid) and oid not in ids, 'duplicate/empty object id')
        ids.add(oid)
        require(obj.get('shape') in ('box', 'sphere', 'cylinder', 'capsule'), oid + ': unsupported primitive; use custom bpy for this geometry')
        vector(obj.get('size'), oid + '.size', positive=True)
        if obj['shape'] == 'capsule':
            require(obj['size'][2] > min(obj['size'][:2]), oid + ': capsule height must exceed diameter')
        keys(obj.get('locationKeys'), oid + '.locationKeys', 1, n)
        if obj.get('rotationKeys') is not None:
            keys(obj['rotationKeys'], oid + '.rotationKeys', 1, n)
        require(obj.get('ease', 'linear') in ('linear', 'smooth', 'continuous'), oid + ': unknown easing')
        color = obj.get('color', [.45, .45, .45])
        vector(color, oid + '.color')
        require(all(0 <= v <= 1 for v in color), oid + ': color out of range')
        if obj.get('identity'):
            require(obj['identity'] not in identities, 'one root per identity')
            require(tuple(color) not in colors, 'identity colors must be distinct')
            identities.add(obj['identity']); colors.add(tuple(color))
    shots = spec.get('shots', [])
    require(isinstance(shots, list) and bool(shots), 'shots required')
    cursor, shot_ids = 1, set()
    for shot in shots:
        fields(shot, 'id start end lens positionKeys targetKeys ease handheld maxAngularSpeedDegPerSecond', 'shot')
        sid = shot.get('id')
        require(isinstance(sid, str) and bool(sid) and sid not in shot_ids, 'duplicate/empty shot id')
        shot_ids.add(sid)
        a, b = shot.get('start'), shot.get('end')
        require(type(a) is int and type(b) is int and a == cursor and a <= b <= n, 'shots must cover timeline exactly without gaps or overlaps')
        cursor = b + 1
        require(type(shot.get('lens')) in (int, float) and math.isfinite(shot['lens']) and shot['lens'] > 0, sid + ': invalid lens')
        keys(shot.get('positionKeys'), sid + '.positionKeys', a, b, cover=True)
        keys(shot.get('targetKeys'), sid + '.targetKeys', a, b, cover=True)
        require(shot.get('ease', 'linear') in ('linear', 'smooth', 'continuous'), sid + ': unknown easing')
        if 'maxAngularSpeedDegPerSecond' in shot:
            limit = shot['maxAngularSpeedDegPerSecond']
            require(type(limit) in (int, float) and math.isfinite(limit) and limit > 0, sid + ': angular speed limit must be positive')
        motion = shot.get('handheld', {})
        require(isinstance(motion, dict), 'handheld must be an object')
        for name, value in motion.items():
            require(name in ('bodyM', 'periodSeconds', 'microM', 'targetM'), 'unknown handheld field: ' + name)
            require(type(value) in (int, float) and math.isfinite(value) and value >= 0, 'invalid handheld value')
        require(motion.get('periodSeconds', 6) > 0, 'handheld period must be positive')
        for f in range(a, b + 1):
            p = sample(shot['positionKeys'], f, shot.get('ease', 'linear'))
            t = sample(shot['targetKeys'], f, shot.get('ease', 'linear'))
            require(sum((x-y)**2 for x, y in zip(p, t)) > 1e-8, sid + ': camera coincides with target')
            require((p[0]-t[0])**2 + (p[1]-t[1])**2 > 1e-8, sid + ': vertical pole needs a custom camera up-axis rig')
    require(cursor == n + 1, 'shots do not reach final frame')
    for check in spec.get('visibilityChecks', []):
        fields(check, 'object start end minSamples', 'visibility check')
        require(check.get('object') in ids, 'visibility check references unknown object')
        require(type(check.get('start')) is int and type(check.get('end')) is int and 1 <= check['start'] <= check['end'] <= n, 'invalid visibility window')
        require(type(check.get('minSamples', 1)) is int and 1 <= check.get('minSamples', 1) <= 3, 'minSamples must be 1..3')
    return spec


def continuous_slope(track, index, component):
    """Shape-preserving Hermite tangent in units/frame, with nonuniform key times."""
    def interval(i):
        h = track[i+1]['frame']-track[i]['frame']
        return h, (track[i+1]['value'][component]-track[i]['value'][component])/h
    if len(track) == 2:
        return interval(0)[1]
    if 0 < index < len(track)-1:
        h0, d0 = interval(index-1); h1, d1 = interval(index)
        if d0*d1 <= 0:
            return 0.
        w0, w1 = 2*h1+h0, h1+2*h0
        return (w0+w1)/(w0/d0+w1/d1)
    first, second = (0, 1) if index == 0 else (len(track)-2, len(track)-3)
    h0, d0 = interval(first); h1, d1 = interval(second)
    slope = ((2*h0+h1)*d0-h0*d1)/(h0+h1)
    if slope*d0 <= 0:
        return 0.
    if d0*d1 <= 0 and abs(slope) > abs(3*d0):
        return 3*d0
    return slope


def sample(track, frame, ease='linear'):
    if frame <= track[0]['frame']:
        return list(track[0]['value'])
    for index, (a, b) in enumerate(zip(track, track[1:])):
        if frame <= b['frame']:
            h = b['frame'] - a['frame']
            u = (frame - a['frame']) / h
            if ease == 'continuous':
                return [(2*u**3-3*u*u+1)*x + (u**3-2*u*u+u)*h*continuous_slope(track,index,j)
                        + (-2*u**3+3*u*u)*y + (u**3-u*u)*h*continuous_slope(track,index+1,j)
                        for j, (x, y) in enumerate(zip(a['value'], b['value']))]
            if ease == 'smooth':
                u = u*u*(3-2*u)
            return [x+(y-x)*u for x, y in zip(a['value'], b['value'])]
    return list(track[-1]['value'])
