"""
Render frames of the saved scene.

    blender -b shol.blend -P render.py -- --out frames/ [--frames 1-576] [--res 1280x720] [--samples 14]
    python render.py --blend shol.blend --out frames/ ...        (with the bpy module)

Frames already present in --out are skipped, so an interrupted render can be resumed.
"""
import os
import sys
import time

import bpy


def parse(argv):
    args = argv[argv.index('--') + 1:] if '--' in argv else argv[1:]
    opt = {'frames': None, 'res': None, 'samples': None, 'out': 'frames', 'blend': None,
           'overwrite': False}
    i = 0
    while i < len(args):
        a = args[i]
        if a == '--overwrite':
            opt['overwrite'] = True
            i += 1
            continue
        opt[a.lstrip('-')] = args[i + 1]
        i += 2
    return opt


def frame_list(spec, sc):
    if not spec:
        return list(range(sc.frame_start, sc.frame_end + 1))
    out = []
    for part in spec.split(','):
        if '-' in part:
            a, b = part.split('-')
            step = 1
            if ':' in b:
                b, step = b.split(':')
            out += list(range(int(a), int(b) + 1, int(step)))
        else:
            out.append(int(part))
    return out


def main():
    opt = parse(sys.argv)
    if opt['blend']:
        bpy.ops.wm.open_mainfile(filepath=opt['blend'])
    sc = bpy.context.scene
    if opt['res']:
        w, h = opt['res'].split('x')
        sc.render.resolution_x, sc.render.resolution_y = int(w), int(h)
    if opt['samples']:
        sc.cycles.samples = int(opt['samples'])
    os.makedirs(opt['out'], exist_ok=True)
    frames = frame_list(opt['frames'], sc)
    t0 = time.time()
    for n, f in enumerate(frames):
        path = os.path.join(opt['out'], f"f{f:04d}.png")
        if os.path.exists(path) and not opt['overwrite']:
            continue
        sc.frame_set(f)
        sc.render.filepath = path
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"frame {f} ({n + 1}/{len(frames)}) {time.time() - t:.1f}s  total {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
