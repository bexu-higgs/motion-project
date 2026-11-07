"""
Render frames of the reference scene.

    python render.py -- --blend maybach_eabc_reference.blend --out frames/ \
        [--start 1] [--end 450] [--step 1] [--scale 100] [--width 720 --height 1280] [--samples 32]
    blender -b maybach_eabc_reference.blend -P render.py -- --out frames/

Frames are written as frames/f_0001.png ... ; encode with ffmpeg (see README).
"""
import os
import sys

import bpy


def cli(name, default):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    return argv[argv.index(name) + 1] if name in argv else default


blend = cli("--blend", None)
if blend:
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(blend))
scene = bpy.context.scene
out = os.path.abspath(cli("--out", "frames"))
os.makedirs(out, exist_ok=True)
start = int(cli("--start", scene.frame_start))
end = int(cli("--end", scene.frame_end))
step = int(cli("--step", 1))
scene.render.resolution_percentage = int(cli("--scale", 100))
if cli("--width", None):
    scene.render.resolution_x = int(cli("--width", 0))
    scene.render.resolution_y = int(cli("--height", 0))
scene.cycles.samples = int(cli("--samples", scene.cycles.samples))
threads = int(cli("--threads", 0))
if threads:
    scene.render.threads_mode = "FIXED"
    scene.render.threads = threads
skip_existing = cli("--skip-existing", "1") == "1"

for f in range(start, end + 1, step):
    path = os.path.join(out, f"f_{f:04d}.png")
    if skip_existing and os.path.exists(path):
        continue
    scene.frame_set(f)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"frame {f} -> {path}", flush=True)
