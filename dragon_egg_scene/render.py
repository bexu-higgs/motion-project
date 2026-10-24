"""
Render the Dragon Egg blockout (Cycles, CPU-friendly settings).

    python render.py --blend dragon_egg_scene.blend --out renders/frames
                     [--frames 1,180,400] [--range 1-720] [--percent 100] [--samples 8]

--frames renders single stills; otherwise the frame range is rendered as an
animation. Existing PNGs are kept, so an interrupted render can be resumed.
Cameras switch automatically through the timeline markers (SH01..SH07).
"""
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


bpy.ops.wm.open_mainfile(filepath=os.path.abspath(arg("--blend", "dragon_egg_scene.blend")))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
c = scene.cycles
c.device = "CPU"
c.samples = int(arg("--samples", "8"))
c.use_adaptive_sampling = True
c.adaptive_threshold = 0.05
c.use_denoising = True
c.denoising_prefilter = "FAST"
c.max_bounces, c.diffuse_bounces, c.glossy_bounces = 3, 1, 1
c.transmission_bounces, c.transparent_max_bounces = 1, 2
c.use_fast_gi = True
scene.world.light_settings.distance = 3.0
scene.render.use_persistent_data = True
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.render.resolution_percentage = int(arg("--percent", "100"))
scene.render.image_settings.file_format = "PNG"
out = os.path.abspath(arg("--out", "renders/frames"))
os.makedirs(out, exist_ok=True)

markers = sorted((m.frame, m.camera) for m in scene.timeline_markers if m.camera)


def camera_for(f):
    cam = markers[0][1]
    for fr, cm in markers:
        if fr <= f:
            cam = cm
    return cam


if arg("--frames"):
    for f in (int(x) for x in arg("--frames").split(",")):
        scene.frame_set(f)
        scene.camera = camera_for(f)
        scene.render.filepath = os.path.join(out, f"frame_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", f, flush=True)
else:
    a, b = (int(x) for x in arg("--range", "1-720").split("-"))
    scene.frame_start, scene.frame_end = a, b
    scene.camera = camera_for(a)
    scene.render.use_overwrite = False
    scene.render.use_placeholder = True
    scene.render.filepath = os.path.join(out, "frame_")
    bpy.ops.render.render(animation=True)
