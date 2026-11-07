"""
Mercedes-Maybach GLS — E-ACTIVE BODY CONTROL «dance» reference video (Blender).

15 s · 9:16 · 30 fps · 450 frames.

Builds a stylised luxury-SUV blockout (two-tone ruby/obsidian, chrome grille,
cream/brown cabin, driver mannequin, a can in the cup holder), animates the
E-ABC "bounce" mode, the can swaying in place, the driver bobbing his head in
time with the car and a single continuous camera move:

  0.0 – 0.8 s  close-up of the can in the cup holder, car still
  0.8 – 1.8 s  E-ABC engages, bounce ramps up (can sways but stays put)
  1.8 – 4.8 s  camera holds on the can, cabin visibly bouncing around it
  4.8 – 6.4 s  camera rises and turns to the driver, head bobbing to the beat
  6.4 – 9.6 s  camera backs out through the open driver window
  9.6 – 15  s  outside: arcs to the front / driver-side corner, slowly pulls
               away, showing the whole car bouncing

Run with the Blender Python module (pip install bpy) or Blender itself:
    python build_scene.py [-- --out scene.blend]
    blender -b -P build_scene.py -- --out scene.blend
"""

import math
import os
import sys
from math import cos, exp, pi, radians, sin, sqrt

import bpy  # noqa: I001  (bpy must be imported before bmesh in the pip module)
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector

# --------------------------------------------------------------------------
# settings
# --------------------------------------------------------------------------
FPS = 30
DURATION = 15.0
FRAMES = int(FPS * DURATION)  # 450

# E-ABC motion
T0 = 0.8        # s, bounce starts
RAMP = 1.0      # s, ramp to full amplitude
FREQ = 1.6      # Hz, bounce beat (≈96 bpm)
A_HEAVE = 0.045  # m
A_ROLL = radians(2.5)
A_PITCH = radians(1.4)
LIFT = 0.03     # m, body rises when the mode engages
PIVOT = Vector((0.0, 0.0, 0.75))

HERE = os.path.dirname(os.path.abspath(__file__))


def cli(name, default):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    if name in argv:
        return argv[argv.index(name) + 1]
    return default


OUT_BLEND = cli("--out", os.path.join(HERE, "maybach_eabc_reference.blend"))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
scene = bpy.context.scene


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def smoothstep(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


COL_CAR = collection("Car")
COL_INT = collection("Interior")
COL_DRV = collection("Driver")
COL_WHEELS = collection("Wheels")
COL_STUDIO = collection("Studio")


def set_in(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


def principled(name, color, metallic=0.0, rough=0.5, coat=0.0, coat_rough=0.03,
               emission=None, e_strength=0.0, spec=0.5, sheen=0.0):
    m = bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    set_in(b, "Base Color", (*color, 1.0))
    set_in(b, "Metallic", metallic)
    set_in(b, "Roughness", rough)
    set_in(b, "Coat Weight", coat)
    set_in(b, "Coat Roughness", coat_rough)
    set_in(b, "Specular IOR Level", spec)
    set_in(b, "Sheen Weight", sheen)
    if emission:
        set_in(b, "Emission Color", (*emission, 1.0))
        set_in(b, "Emission Strength", e_strength)
    m.diffuse_color = (*color, 1.0)
    return m


def add_bump(mat, scale=60.0, strength=0.08, detail=2.0, kind="noise"):
    nt = mat.node_tree
    b = nt.nodes["Principled BSDF"]
    if kind == "voronoi":
        tex = nt.nodes.new("ShaderNodeTexVoronoi")
        tex.inputs["Scale"].default_value = scale
        out = tex.outputs["Distance"]
    else:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Detail"].default_value = detail
        out = tex.outputs["Fac"]
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    nt.links.new(out, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])


def emission_mat(name, color, strength):
    m = bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1.0)
    e.inputs["Strength"].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    m.diffuse_color = (*color, 1.0)
    return m


def glass_mat(name, tint, reflect=0.12):
    m = bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (*tint, 1.0)
    gl = nt.nodes.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.02
    gl.inputs["Color"].default_value = (1, 1, 1, 1)
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.25
    mth = nt.nodes.new("ShaderNodeMath")
    mth.operation = "MULTIPLY_ADD"
    mth.inputs[1].default_value = 0.85
    mth.inputs[2].default_value = reflect
    nt.links.new(lw.outputs["Fresnel"], mth.inputs[0])
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(mth.outputs[0], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(gl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    m.diffuse_color = (*tint, 0.3)
    return m


def finish_mesh(me, smooth=True, sharp=32):
    if smooth:
        me.shade_smooth()
        if sharp:
            me.set_sharp_from_angle(angle=radians(sharp))
    else:
        me.shade_flat()


def obj_from_bm(name, bm, mats, coll, smooth=True, sharp=32, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    finish_mesh(me, smooth, sharp)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    if parent is not None:
        parent_keep(ob, parent)
    return ob


def parent_keep(child, parent):
    bpy.context.view_layer.update()
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


def empty(name, loc, coll, parent=None, size=0.1):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    e.location = loc
    coll.objects.link(e)
    if parent is not None:
        parent_keep(e, parent)
    return e


def xform(bm, loc=(0, 0, 0), rot=None, scale=None):
    M = Matrix.Translation(Vector(loc))
    if rot is not None:
        if isinstance(rot, (Quaternion, Euler)):
            M = M @ rot.to_matrix().to_4x4()
        else:
            M = M @ rot
    if scale is not None:
        M = M @ Matrix.Diagonal((*scale, 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)


def bm_rbox(size, bevel=0.0, segs=3):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bevel = min(bevel, min(size) * 0.49)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segs,
                        profile=0.5, affect="EDGES", clamp_overlap=True)
    return bm


def rbox(name, size, loc, mat, coll, bevel=0.0, segs=3, rot=None, parent=None, sharp=32):
    bm = bm_rbox(size, bevel, segs)
    xform(bm, loc, rot)
    return obj_from_bm(name, bm, [mat], coll, smooth=bevel > 0, sharp=sharp, parent=parent)


def bm_cyl(r1, r2, depth, segs=32, caps=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs,
                          radius1=r1, radius2=r2, depth=depth)
    return bm


def cyl(name, r, depth, loc, mat, coll, rot=None, segs=32, r2=None, parent=None, sharp=40):
    bm = bm_cyl(r, r if r2 is None else r2, depth, segs)
    xform(bm, loc, rot)
    return obj_from_bm(name, bm, [mat], coll, sharp=sharp, parent=parent)


def bm_sphere(r, u=32, v=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    return bm


def ellipsoid(name, radii, loc, mat, coll, rot=None, parent=None, u=32, v=16):
    bm = bm_sphere(1.0, u, v)
    bmesh.ops.scale(bm, vec=Vector(radii), verts=bm.verts)
    xform(bm, loc, rot)
    return obj_from_bm(name, bm, [mat], coll, sharp=0, parent=parent)


def bm_torus(R, r, nu=64, nv=16):
    bm = bmesh.new()
    rows = []
    for i in range(nu):
        a = 2 * pi * i / nu
        row = []
        for j in range(nv):
            b = 2 * pi * j / nv
            rr = R + r * cos(b)
            row.append(bm.verts.new((rr * cos(a), rr * sin(a), r * sin(b))))
        rows.append(row)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((rows[i][j], rows[(i + 1) % nu][j],
                          rows[(i + 1) % nu][(j + 1) % nv], rows[i][(j + 1) % nv]))
    return bm


def track_rot(direction, up=Vector((0, 0, 1))):
    """Rotation whose local +Z points along `direction`."""
    return Vector(direction).normalized().to_track_quat("Z", "Y")


def limb(name, p1, p2, r1, r2, mat, coll, parent=None, segs=20):
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    bm = bm_cyl(r1, r2, d.length, segs)
    xform(bm, (p1 + p2) / 2, track_rot(d))
    return obj_from_bm(name, bm, [mat], coll, sharp=0, parent=parent)


def beam(name, p1, p2, w, h, mat, coll, bevel=0.0, parent=None, up=(0, 0, 1)):
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    x = d.normalized()
    z = Vector(up)
    y = z.cross(x).normalized()
    z = x.cross(y).normalized()
    R = Matrix((x, y, z)).transposed().to_4x4()
    bm = bm_rbox((d.length, w, h), bevel)
    xform(bm, (p1 + p2) / 2, R)
    return obj_from_bm(name, bm, [mat], coll, smooth=bevel > 0, parent=parent)


def rrect(x0, x1, hw, r, z, n=6):
    """Rounded rectangle ring in plan view (CCW from above). z: float or f(x)."""
    pts = []
    corners = [(x1 - r, -hw + r, -90), (x1 - r, hw - r, 0),
               (x0 + r, hw - r, 90), (x0 + r, -hw + r, 180)]
    for cx, cy, a0 in corners:
        for i in range(n + 1):
            a = radians(a0 + 90 * i / n)
            x, y = cx + r * cos(a), cy + r * sin(a)
            pts.append((x, y, z(x) if callable(z) else z))
    return pts


def bm_loft(rings, cap0=True, cap1=True):
    bm = bmesh.new()
    vrings = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, b in zip(vrings[:-1], vrings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap0:
        bm.faces.new(list(reversed(vrings[0])))
    if cap1:
        bm.faces.new(vrings[-1])
    return bm


def bevel_sharp(bm, offset, segs, angle=30):
    edges = [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > radians(angle)]
    bmesh.ops.bevel(bm, geom=edges, offset=offset, segments=segs, profile=0.5,
                    affect="EDGES", clamp_overlap=True)


def bm_prism(poly, ext_a, ext_b):
    """Closed prism: planar polygon `poly` swept from poly+ext_a to poly+ext_b."""
    ext_a, ext_b = Vector(ext_a), Vector(ext_b)
    ring_a = [tuple(Vector(p) + ext_a) for p in poly]
    ring_b = [tuple(Vector(p) + ext_b) for p in poly]
    bm = bm_loft([ring_a, ring_b])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_polygon(poly):
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in poly]
    bm.faces.new(vs)
    return bm


def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)


# --------------------------------------------------------------------------
# materials
# --------------------------------------------------------------------------
M_BLACK = principled("Paint_Obsidian", (0.004, 0.004, 0.005), rough=0.16, coat=1.0, coat_rough=0.02)
M_RED = principled("Paint_Ruby", (0.13, 0.004, 0.008), metallic=0.5, rough=0.3, coat=1.0, coat_rough=0.02)
M_CREAM = principled("Leather_Cream", (0.66, 0.53, 0.36), rough=0.55, sheen=0.2)
add_bump(M_CREAM, scale=180, strength=0.05)
M_BROWN = principled("Leather_Brown", (0.19, 0.050, 0.018), rough=0.42, sheen=0.2)
add_bump(M_BROWN, scale=160, strength=0.06)
M_WOOD = principled("Wood_Gloss", (0.075, 0.026, 0.010), rough=0.22, coat=1.0, coat_rough=0.02)
add_bump(M_WOOD, scale=12, strength=0.02, detail=6)
M_CHROME = principled("Chrome", (0.92, 0.92, 0.94), metallic=1.0, rough=0.05)
M_ALU = principled("Alu_Satin", (0.72, 0.72, 0.74), metallic=1.0, rough=0.22)
M_WELL = principled("WheelWell", (0.012, 0.012, 0.012), rough=0.85)
M_TRIM = principled("Trim_GlossBlack", (0.006, 0.006, 0.007), rough=0.12, coat=0.6)
M_RUBBER = principled("Tyre", (0.018, 0.018, 0.019), rough=0.7)
M_CARPET = principled("Carpet", (0.36, 0.27, 0.18), rough=0.95)
add_bump(M_CARPET, scale=400, strength=0.15)
M_SKIN = principled("Skin", (0.50, 0.32, 0.23), rough=0.45)
set_in(M_SKIN.node_tree.nodes["Principled BSDF"], "Subsurface Weight", 0.15)
M_SUIT = principled("Suit", (0.012, 0.012, 0.015), rough=0.6, sheen=0.1)
M_SHIRT = principled("Shirt", (0.80, 0.80, 0.82), rough=0.6)
M_HAIR = principled("Hair", (0.018, 0.011, 0.007), rough=0.45)
M_SHADES = principled("Sunglasses", (0.004, 0.004, 0.004), rough=0.03, coat=1.0)
M_PLATE = principled("Plate", (0.85, 0.85, 0.85), rough=0.35)
M_PLATE_BLUE = principled("PlateBlue", (0.0, 0.05, 0.35), rough=0.35)
M_LENS = principled("HeadlightLens", (0.01, 0.012, 0.016), rough=0.03, coat=1.0, metallic=0.2)
M_MESH = principled("IntakeMesh", (0.30, 0.30, 0.32), metallic=1.0, rough=0.3)
add_bump(M_MESH, scale=90, strength=0.6, kind="voronoi")
M_DRL = emission_mat("LED_DRL", (0.85, 0.92, 1.0), 25.0)
M_TAIL = emission_mat("LED_Tail", (1.0, 0.02, 0.01), 12.0)
M_AMBIENT = emission_mat("Ambient_Light", (1.0, 0.18, 0.22), 6.0)
M_GLASS_SIDE = glass_mat("Glass_Privacy", (0.10, 0.10, 0.11), reflect=0.18)
M_GLASS_FRONT = glass_mat("Glass_Windscreen", (0.55, 0.57, 0.6), reflect=0.12)
M_MIRROR = principled("MirrorGlass", (0.9, 0.9, 0.9), metallic=1.0, rough=0.0)

# can label: silver top/bottom, ruby & black band
M_CAN = bpy.data.materials.new("Can")
if M_CAN.node_tree is None:
    M_CAN.use_nodes = True
_nt = M_CAN.node_tree
_b = _nt.nodes["Principled BSDF"]
set_in(_b, "Metallic", 0.85)
set_in(_b, "Roughness", 0.18)
set_in(_b, "Coat Weight", 0.6)
_tc = _nt.nodes.new("ShaderNodeTexCoord")
_sep = _nt.nodes.new("ShaderNodeSeparateXYZ")
_ramp = _nt.nodes.new("ShaderNodeValToRGB")
_map = _nt.nodes.new("ShaderNodeMapRange")
_map.inputs["From Min"].default_value = 0.0
_map.inputs["From Max"].default_value = 1.0
_nt.links.new(_tc.outputs["Generated"], _sep.inputs[0])
_nt.links.new(_sep.outputs["Z"], _map.inputs["Value"])
_nt.links.new(_map.outputs["Result"], _ramp.inputs["Fac"])
_cr = _ramp.color_ramp
_cr.interpolation = "CONSTANT"
_cr.elements[0].position = 0.0
_cr.elements[0].color = (0.8, 0.8, 0.82, 1)
for pos, col in [(0.07, (0.35, 0.012, 0.02, 1)), (0.42, (0.01, 0.01, 0.012, 1)),
                 (0.47, (0.85, 0.85, 0.87, 1)), (0.50, (0.01, 0.01, 0.012, 1)),
                 (0.62, (0.35, 0.012, 0.02, 1)), (0.90, (0.8, 0.8, 0.82, 1))]:
    el = _cr.elements.new(pos)
    el.color = col
_nt.links.new(_ramp.outputs["Color"], _b.inputs["Base Color"])

# dashboard screen image (procedural UI, packed into the .blend)


def make_screen_image(w=1024, h=224):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    img = np.zeros((h, w, 3), np.float32)
    img[:] = (0.003, 0.006, 0.016)
    blue = np.array([0.12, 0.45, 1.0], np.float32)
    # instrument cluster (left half): two dials
    for cx, needle in ((140.0, 0.9), (370.0, 2.2)):
        cy = h / 2
        r = np.hypot(xx - cx, yy - cy)
        ang = np.arctan2(yy - cy, xx - cx)
        img += (np.exp(-((r - 88) / 2.5) ** 2) * 0.9)[..., None] * blue
        ticks = ((np.abs(((ang / (2 * pi)) * 48) % 1 - 0.5) > 0.40) & (r > 72) & (r < 84))
        img += ticks[..., None].astype(np.float32) * np.array([0.55, 0.75, 1.0]) * 0.7
        # needle
        nx, ny = cos(needle), sin(needle)
        t = (xx - cx) * nx + (yy - cy) * ny
        dist = np.abs(-(xx - cx) * ny + (yy - cy) * nx)
        img += ((dist < 2.2) & (t > 0) & (t < 80))[..., None].astype(np.float32) * np.array([1.0, 0.25, 0.2])
        img += (np.exp(-(r / 30) ** 2) * 0.10)[..., None] * blue
    # centre info tile between dials
    tile = (np.abs(xx - 255) < 34) & (np.abs(yy - h / 2) < 50)
    img[tile] = (0.02, 0.05, 0.12)
    # navigation (right half)
    nav = xx > 540
    img[nav] = (0.010, 0.018, 0.035)
    grid = nav & ((((xx - 540) % 46) < 2) | ((yy % 38) < 2))
    img[grid] = (0.04, 0.06, 0.10)
    route_y = h / 2 + 40 * np.sin((xx - 540) / 90.0)
    route = nav & (np.abs(yy - route_y) < 3.5) & (xx < 960)
    img[route] = (0.1, 0.55, 1.0)
    for tx in (580, 700, 820):
        t2 = (np.abs(xx - tx - 45) < 50) & (yy > 20) & (yy < 56)
        img[t2] = (0.05, 0.09, 0.18)
        bar = (np.abs(xx - tx - 45) < 34) & (np.abs(yy - 38) < 3)
        img[bar] = (0.2, 0.75, 0.45) if tx == 580 else (0.6, 0.7, 0.9)
    # thin divider between the two screens
    img[(np.abs(xx - 520) < 6)] = (0.0, 0.0, 0.0)
    rgba = np.concatenate([np.clip(img, 0, 1), np.ones((h, w, 1), np.float32)], axis=2)
    im = bpy.data.images.new("DashScreen", w, h, alpha=False)
    im.pixels.foreach_set(rgba[::-1].ravel())
    im.pack()
    return im


M_SCREEN = bpy.data.materials.new("Screen")
if M_SCREEN.node_tree is None:
    M_SCREEN.use_nodes = True
_nt = M_SCREEN.node_tree
_b = _nt.nodes["Principled BSDF"]
set_in(_b, "Base Color", (0.0, 0.0, 0.0, 1))
set_in(_b, "Roughness", 0.05)
set_in(_b, "Coat Weight", 1.0)
_tex = _nt.nodes.new("ShaderNodeTexImage")
_tex.image = make_screen_image()
_nt.links.new(_tex.outputs["Color"], _b.inputs["Emission Color"])
set_in(_b, "Emission Strength", 3.0)

# --------------------------------------------------------------------------
# rig: static root (wheels) + animated body
# --------------------------------------------------------------------------
ROOT = empty("CAR_ROOT", (0, 0, 0), COL_CAR, size=1.0)
BODY = empty("BODY_EABC", PIVOT, COL_CAR, parent=ROOT, size=0.6)


def lower_top(x):
    """Height of the hood / belt line along the car."""
    return 1.04 + 0.14 * (2.6 - x) / 5.2


GH_Z0 = 1.04
GH_H = 1.84 - GH_Z0


def gh_hw(z):
    """Greenhouse half-width (outer) at height z."""
    return 0.955 - 0.125 * (z - GH_Z0) / GH_H


def ws_x(z):
    """Windscreen outer plane x at height z."""
    return 1.05 - 0.95 * (z - GH_Z0) / GH_H


def win_bottom(x):
    return lower_top(x) + 0.045


WIN_TOP = 1.72

# body slots shared by every boolean operand (INDEX material mode)
BODY_MATS = [M_BLACK, M_RED, M_CREAM, M_CHROME, M_WELL, M_TRIM]
I_BLACK, I_RED, I_CREAM, I_CHROME, I_WELL, I_TRIM = range(6)


def operand(name, bm, mat_index, coll):
    for f in bm.faces:
        f.material_index = mat_index
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in BODY_MATS:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


# lower body (hood + doors + bumpers)
lower = bm_loft([rrect(-2.58, 2.60, 0.99, 0.32, 0.27, 8),
                 rrect(-2.57, 2.57, 0.995, 0.31, 0.62, 8),
                 rrect(-2.56, 2.54, 0.99, 0.30, lower_top, 8)])
bevel_sharp(lower, 0.07, 4)
BODY_SHELL = operand("Body_Shell", lower, I_BLACK, COL_CAR)

# greenhouse (pillars, roof)
gh = bm_loft([rrect(-2.55, 1.05, 0.955, 0.14, GH_Z0, 6),
              rrect(-2.44, 0.10, 0.83, 0.16, 1.84, 6)])
bevel_sharp(gh, 0.06, 4)
GH = operand("Greenhouse", gh, I_BLACK, COL_CAR)

m = BODY_SHELL.modifiers.new("union", "BOOLEAN")
m.operation = "UNION"
m.solver = "EXACT"
m.object = GH
m.material_mode = "INDEX"
apply_mods(BODY_SHELL)
bpy.data.objects.remove(GH)

# cut-outs: cabin cavity, windows, wheel arches
COL_CUT = collection("Cutters")
cav = bm_loft([rrect(-2.46, 0.90, 0.80, 0.10, 0.50),
               rrect(-2.46, 0.90, 0.80, 0.10, 0.95),
               rrect(-2.47, 0.90, 0.91, 0.10, 1.03),
               rrect(-2.48, 0.90, 0.91, 0.10, 1.12),
               rrect(-2.40, 0.10, 0.80, 0.10, 1.785)])
operand("cut_cavity", cav, I_CREAM, COL_CUT)


def side_window_polys():
    wb = win_bottom
    fx = lambda z: ws_x(z) - 0.13  # noqa: E731  (front edge follows the A-pillar)
    z0 = wb(0.80)
    fr = [(fx(z0), z0), (-0.26, wb(-0.26)), (-0.26, WIN_TOP), (fx(WIN_TOP), WIN_TOP)]
    rr = [(-0.36, wb(-0.36)), (-1.42, wb(-1.42)), (-1.42, WIN_TOP), (-0.36, WIN_TOP)]
    qt = [(-1.54, wb(-1.54)), (-2.20, wb(-2.20)), (-2.32, 1.64), (-2.24, WIN_TOP), (-1.54, WIN_TOP)]
    return {"front": fr, "rear": rr, "quarter": qt}


WINDOWS = side_window_polys()
for side in (1, -1):
    for key, poly in WINDOWS.items():
        pts = [(x, 0.0, z) for x, z in poly]
        bm = bm_prism(pts, (0, side * 0.55, 0), (0, side * 1.40, 0))
        operand(f"cut_win_{key}_{side}", bm, I_CHROME, COL_CUT)

# windscreen
WS_N = Vector((GH_H, 0.0, 0.95)).normalized()


def ws_poly(inset=0.10, z0=1.125, z1=1.735, grow=0.0):
    return [(ws_x(z0), -(gh_hw(z0) - inset) - grow, z0 - grow),
            (ws_x(z0), (gh_hw(z0) - inset) + grow, z0 - grow),
            (ws_x(z1), (gh_hw(z1) - inset) + grow, z1 + grow),
            (ws_x(z1), -(gh_hw(z1) - inset) - grow, z1 + grow)]


operand("cut_windscreen", bm_prism(ws_poly(), -WS_N * 0.07, WS_N * 0.2), I_TRIM, COL_CUT)

# rear window (near-vertical tailgate glass)
RW_N = Vector((-GH_H, 0.0, 0.11)).normalized()


def rw_x(z):
    return -2.55 + 0.11 * (z - GH_Z0) / GH_H


def rw_poly(z0=1.30, z1=1.70, inset=0.13, grow=0.0):
    return [(rw_x(z0), -(gh_hw(z0) - inset) - grow, z0 - grow),
            (rw_x(z1), -(gh_hw(z1) - inset) - grow, z1 + grow),
            (rw_x(z1), (gh_hw(z1) - inset) + grow, z1 + grow),
            (rw_x(z0), (gh_hw(z0) - inset) + grow, z0 - grow)]


operand("cut_rearwindow", bm_prism(rw_poly(), -RW_N * 0.07, RW_N * 0.2), I_TRIM, COL_CUT)

AXLES = (1.55, -1.585)
WHEEL_R = 0.40
WHEEL_Y = 0.855
for ax in AXLES:
    for side in (1, -1):
        bm = bm_cyl(0.485, 0.485, 0.50, 48)
        xform(bm, (ax, side * 1.11, WHEEL_R), Euler((radians(90), 0, 0)))
        operand(f"cut_arch_{ax}_{side}", bm, I_WELL, COL_CUT)

m = BODY_SHELL.modifiers.new("cuts", "BOOLEAN")
m.operation = "DIFFERENCE"
m.solver = "EXACT"
m.operand_type = "COLLECTION"
m.collection = COL_CUT
m.material_mode = "INDEX"
apply_mods(BODY_SHELL)
for o in list(COL_CUT.objects):
    bpy.data.objects.remove(o)
bpy.data.collections.remove(COL_CUT)

# two-tone split: ruby above the shoulder line, obsidian below
bm = bmesh.new()
bm.from_mesh(BODY_SHELL.data)
split_no = Vector((0.14 / 5.2, 0, 1)).normalized()
split_co = Vector((0, 0, lower_top(0.0) - 0.05))
bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                       plane_co=split_co, plane_no=split_no)
for f in bm.faces:
    if f.material_index == I_BLACK and (f.calc_center_median() - split_co).dot(split_no) > 0:
        f.material_index = I_RED
bm.to_mesh(BODY_SHELL.data)
bm.free()
finish_mesh(BODY_SHELL.data, True, 30)
parent_keep(BODY_SHELL, BODY)


def body_part(name, bm, mat, coll=COL_CAR, smooth=True, sharp=32):
    return obj_from_bm(name, bm, [mat], coll, smooth=smooth, sharp=sharp, parent=BODY)


# --------------------------------------------------------------------------
# glass
# --------------------------------------------------------------------------
def side_glass(poly, side, grow=0.015):
    cx = sum(p[0] for p in poly) / len(poly)
    cz = sum(p[1] for p in poly) / len(poly)
    pts = []
    for x, z in poly:
        d = Vector((x - cx, z - cz))
        d = d.normalized() * grow
        x2, z2 = x + d.x, z + d.y
        pts.append((x2, side * (gh_hw(z2) - 0.014), z2))
    return bm_polygon(pts)


for side in (1, -1):
    for key, poly in WINDOWS.items():
        if side == 1 and key == "front":
            continue  # driver's window is rolled down
        body_part(f"Glass_{key}_{'L' if side > 0 else 'R'}", side_glass(poly, side), M_GLASS_SIDE, smooth=False)
# driver's window: only the top edge peeks out of the door
_dw = [(0.70, win_bottom(0.70) - 0.02), (-0.24, win_bottom(-0.24) - 0.02),
       (-0.24, win_bottom(-0.24) + 0.015), (0.70, win_bottom(0.70) + 0.015)]
body_part("Glass_front_L_lowered", bm_polygon([(x, gh_hw(z) - 0.03, z) for x, z in _dw]), M_GLASS_SIDE, smooth=False)
body_part("Glass_windscreen", bm_polygon([tuple(Vector(p) - WS_N * 0.012) for p in ws_poly(grow=0.015)]),
          M_GLASS_FRONT, smooth=False)
body_part("Glass_rear", bm_polygon([tuple(Vector(p) - RW_N * 0.012) for p in rw_poly(grow=0.015)]),
          M_GLASS_SIDE, smooth=False)

# --------------------------------------------------------------------------
# exterior details
# --------------------------------------------------------------------------
LEAN = Euler((0, radians(-5.2), 0))

# grille
rbox("Grille_Frame", (0.05, 0.80, 0.56), (2.565, 0, 0.70), M_CHROME, COL_CAR, bevel=0.03, rot=LEAN, parent=BODY)
rbox("Grille_Back", (0.05, 0.71, 0.47), (2.580, 0, 0.70), M_TRIM, COL_CAR, bevel=0.01, rot=LEAN, parent=BODY)
bm = bmesh.new()
for i in range(23):
    y = -0.33 + 0.66 * i / 22
    w = 0.022 if i == 11 else 0.012
    b2 = bm_rbox((0.03, w, 0.46), 0.004, 2)
    xform(b2, (2.598, y, 0.70), LEAN)
    me_tmp = bpy.data.meshes.new("tmp")
    b2.to_mesh(me_tmp)
    b2.free()
    bm.from_mesh(me_tmp)
    bpy.data.meshes.remove(me_tmp)
body_part("Grille_Bars", bm, M_CHROME)

# number plate (blank)
rbox("Plate", (0.012, 0.52, 0.11), (2.612, 0, 0.345), M_PLATE, COL_CAR, bevel=0.004, parent=BODY)
rbox("Plate_EU", (0.014, 0.04, 0.105), (2.613, -0.235, 0.345), M_PLATE_BLUE, COL_CAR, parent=BODY)

# lower intake: chrome frame + mesh
rbox("Intake_Mesh", (0.03, 1.50, 0.13), (2.598, 0, 0.475), M_MESH, COL_CAR, bevel=0.02, parent=BODY)
beam("Intake_Chrome_Top", (2.615, -0.78, 0.555), (2.615, 0.78, 0.555), 0.02, 0.022, M_CHROME, COL_CAR, 0.006, BODY)
for s in (1, -1):
    beam(f"Intake_Chrome_Side_{s}", (2.615, s * 0.78, 0.555), (2.56, s * 0.86, 0.40), 0.02, 0.022, M_CHROME,
         COL_CAR, 0.006, BODY)
rbox("Skid_Chrome", (0.06, 1.0, 0.07), (2.585, 0, 0.30), M_CHROME, COL_CAR, bevel=0.02, parent=BODY)
for y in (-0.32, 0.0, 0.32):
    rbox(f"Skid_Slot_{y}", (0.065, 0.24, 0.028), (2.590, y, 0.30), M_TRIM, COL_CAR, bevel=0.01, parent=BODY)

# headlights + LED light signature
for s in (1, -1):
    yaw = Euler((0, radians(-5.2), radians(-14 * s)))
    rbox(f"Headlight_{s}", (0.07, 0.36, 0.12), (2.53, s * 0.585, 0.93), M_LENS, COL_CAR, bevel=0.02,
         rot=yaw, parent=BODY)
    for k in range(3):
        cyl(f"Projector_{s}_{k}", 0.022, 0.03, (2.565 - 0.02 * k, s * (0.47 + 0.075 * k), 0.94), M_CHROME,
            COL_CAR, rot=Euler((0, radians(90), 0)), segs=20, parent=BODY)
    beam(f"DRL_low_{s}", (2.58, s * 0.43, 0.88), (2.50, s * 0.75, 0.885), 0.012, 0.012, M_DRL, COL_CAR, 0.0, BODY)
    beam(f"DRL_in_{s}", (2.583, s * 0.425, 0.875), (2.578, s * 0.43, 0.98), 0.012, 0.012, M_DRL, COL_CAR, 0.0, BODY)
    # tail lights
    beam(f"Tail_{s}", (-2.575, s * 0.52, 1.10), (-2.52, s * 0.93, 1.10), 0.02, 0.06, M_TAIL, COL_CAR, 0.0, BODY)

beam("Tailgate_Chrome", (-2.585, -0.5, 1.05), (-2.585, 0.5, 1.05), 0.015, 0.02, M_CHROME, COL_CAR, 0.005, BODY)

# side: mirrors, handles, chrome sill and belt lines, roof rails
for s in (1, -1):
    rbox(f"Mirror_Arm_{s}", (0.10, 0.10, 0.04), (0.80, s * 1.0, 1.16), M_TRIM, COL_CAR, bevel=0.015, parent=BODY)
    rbox(f"Mirror_Cap_{s}", (0.13, 0.22, 0.13), (0.80, s * 1.10, 1.22), M_RED, COL_CAR, bevel=0.045,
         rot=Euler((0, 0, radians(-6 * s))), parent=BODY)
    rbox(f"Mirror_Glass_{s}", (0.01, 0.19, 0.10), (0.735, s * 1.105, 1.22), M_MIRROR, COL_CAR, bevel=0.004,
         rot=Euler((0, 0, radians(-6 * s))), parent=BODY)
    for x in (0.12, -1.0):
        rbox(f"Handle_{s}_{x}", (0.17, 0.03, 0.032), (x, s * 0.997, 1.0), M_CHROME, COL_CAR, bevel=0.012,
             parent=BODY)
    rbox(f"Sill_Chrome_{s}", (2.15, 0.07, 0.045), (-0.02, s * 1.0, 0.335), M_CHROME, COL_CAR, bevel=0.015,
         parent=BODY)
    beam(f"Door_Chrome_{s}", (0.98, s * 0.997, 0.42), (-1.06, s * 0.997, 0.42), 0.012, 0.03, M_CHROME,
         COL_CAR, 0.004, BODY)
    z1, z2 = win_bottom(0.86) - 0.012, win_bottom(-2.22) - 0.012
    beam(f"Belt_Chrome_{s}", (0.86, s * (gh_hw(z1) + 0.004), z1), (-2.22, s * (gh_hw(z2) + 0.004), z2),
         0.012, 0.016, M_CHROME, COL_CAR, 0.004, BODY)
    beam(f"Roof_Rail_{s}", (0.02, s * 0.70, 1.895), (-2.22, s * 0.70, 1.895), 0.035, 0.03, M_ALU, COL_CAR,
         0.01, BODY)
    for x in (0.0, -2.2):
        rbox(f"Rail_Foot_{s}_{x}", (0.10, 0.04, 0.07), (x, s * 0.70, 1.86), M_ALU, COL_CAR, bevel=0.012,
             parent=BODY)

# --------------------------------------------------------------------------
# wheels (static — the body moves over them)
# --------------------------------------------------------------------------


def build_wheel(name, loc, side):
    parts = bmesh.new()
    me_list = []
    rot = Euler((radians(-90 * side), 0, 0))  # local Z -> outward (±Y)

    def add(bmx, mat):
        xform(bmx, loc, rot)
        ob = obj_from_bm(f"{name}_{mat.name}_{len(me_list)}", bmx, [mat], COL_WHEELS, sharp=35)
        parent_keep(ob, ROOT)
        me_list.append(ob)

    tyre = bm_cyl(WHEEL_R, WHEEL_R, 0.30, 64)
    bevel_sharp(tyre, 0.07, 4, angle=60)
    add(tyre, M_RUBBER)
    barrel = bm_cyl(0.305, 0.305, 0.31, 64)
    xform(barrel, (0, 0, 0.0))
    add(barrel, M_TRIM)
    disc = bm_cyl(0.22, 0.22, 0.02, 48)
    xform(disc, (0, 0, 0.02))
    add(disc, M_ALU)
    lip = bm_torus(0.296, 0.012, 64, 10)
    xform(lip, (0, 0, 0.152))
    add(lip, M_CHROME)
    spokes = bmesh.new()
    n = 24
    for i in range(n):
        a = 2 * pi * i / n
        b2 = bm_rbox((0.215, 0.016, 0.022), 0.006, 2)
        # radial, slightly dished toward the hub, twisted like a turbine
        M = (Matrix.Rotation(a, 4, "Z") @ Matrix.Translation((0.185, 0, 0.125)) @
             Matrix.Rotation(radians(-9), 4, "Y") @ Matrix.Rotation(radians(18), 4, "X"))
        bmesh.ops.transform(b2, matrix=M, verts=b2.verts)
        tmp = bpy.data.meshes.new("tmp")
        b2.to_mesh(tmp)
        b2.free()
        spokes.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    add(spokes, M_CHROME)
    hub = bm_cyl(0.075, 0.06, 0.05, 40)
    xform(hub, (0, 0, 0.14))
    add(hub, M_CHROME)
    cap = bm_cyl(0.035, 0.035, 0.012, 32)
    xform(cap, (0, 0, 0.168))
    add(cap, M_TRIM)
    parts.free()


for ax in AXLES:
    for s in (1, -1):
        build_wheel(f"Wheel_{'F' if ax > 0 else 'R'}{'L' if s > 0 else 'R'}", (ax, s * WHEEL_Y, WHEEL_R), s)

# --------------------------------------------------------------------------
# interior
# --------------------------------------------------------------------------
I = COL_INT


def ip(name, bm, mat, smooth=True, sharp=32):
    return obj_from_bm(name, bm, [mat], I, smooth=smooth, sharp=sharp, parent=BODY)


def irbox(name, size, loc, mat, bevel=0.0, rot=None, segs=3):
    return rbox(name, size, loc, mat, I, bevel=bevel, rot=rot, parent=BODY, segs=segs)


irbox("Carpet", (3.32, 1.58, 0.04), (-0.76, 0, 0.50), M_CARPET, 0.01)
# dashboard
irbox("Dash_Lower", (0.46, 1.80, 0.36), (0.79, 0, 0.86), M_CREAM, 0.05)
irbox("Dash_Upper", (0.50, 1.80, 0.13), (0.80, 0, 1.075), M_BROWN, 0.05, segs=4)
irbox("Dash_Wood", (0.02, 1.76, 0.055), (0.565, 0, 0.94), M_WOOD, 0.006)
irbox("Dash_Ambient", (0.006, 1.70, 0.006), (0.557, 0, 0.973), M_AMBIENT)
irbox("Screen_Bezel", (0.025, 0.90, 0.20), (0.565, 0.24, 1.125), M_TRIM, 0.012, rot=Euler((0, radians(-10), 0)))
_scr = bmesh.new()
_uv = _scr.loops.layers.uv.new("UVMap")
_c = Vector((0.551, 0.24, 1.125))
_R = Euler((0, radians(-10), 0)).to_matrix()
_vs = [_scr.verts.new(_c + _R @ Vector(v)) for v in
       ((0, -0.43, -0.085), (0, 0.43, -0.085), (0, 0.43, 0.085), (0, -0.43, 0.085))]
_f = _scr.faces.new(_vs)
for loop, uv in zip(_f.loops, ((1, 0), (0, 0), (0, 1), (1, 1))):
    loop[_uv].uv = uv
ip("Screens", _scr, M_SCREEN, smooth=False)
irbox("Binnacle", (0.13, 0.94, 0.03), (0.60, 0.24, 1.24), M_BROWN, 0.012)
for k, y in enumerate((-0.165, -0.055, 0.055, 0.165)):
    irbox(f"Vent_{k}", (0.02, 0.092, 0.06), (0.555, y, 1.01), M_CHROME, 0.02)
    irbox(f"Vent_in_{k}", (0.02, 0.074, 0.044), (0.550, y, 1.01), M_TRIM, 0.01)
for s in (1, -1):
    cyl(f"Vent_round_{s}", 0.045, 0.03, (0.56, s * 0.80, 1.04), M_CHROME, I, rot=Euler((0, radians(90), 0)),
        parent=BODY)

# centre console
irbox("Console_Front", (0.30, 0.30, 0.38), (0.43, 0, 0.69), M_CREAM, 0.04)
irbox("Console_Front_Top", (0.18, 0.24, 0.012), (0.38, 0, 0.885), M_TRIM, 0.004, rot=Euler((0, radians(-8), 0)))
irbox("Console", (0.86, 0.30, 0.22), (-0.13, 0, 0.61), M_CREAM, 0.04)
irbox("Console_Wood", (0.38, 0.27, 0.014), (0.10, 0, 0.726), M_WOOD, 0.006)
irbox("Armrest", (0.50, 0.28, 0.07), (-0.31, 0, 0.75), M_BROWN, 0.03)
irbox("Console_Chrome_L", (0.80, 0.008, 0.012), (-0.12, 0.152, 0.70), M_CHROME, 0.003)
irbox("Console_Chrome_R", (0.80, 0.008, 0.012), (-0.12, -0.152, 0.70), M_CHROME, 0.003)
irbox("Gear_Pad", (0.11, 0.07, 0.02), (0.27, 0.0, 0.738), M_ALU, 0.008)
CUP = [(0.12, 0.058), (0.12, -0.058)]
for k, (x, y) in enumerate(CUP):
    cyl(f"Cup_Hole_{k}", 0.040, 0.004, (x, y, 0.7335), M_TRIM, I, segs=40, parent=BODY)
    ob = obj_from_bm(f"Cup_Ring_{k}", (lambda b: (xform(b, (x, y, 0.735)), b)[1])(bm_torus(0.042, 0.004, 48, 10)),
                     [M_CHROME], I, sharp=0, parent=BODY)

# steering wheel
SW_C = Vector((0.12, 0.45, 1.12))
SW_D = Vector((cos(radians(25)), 0, -sin(radians(25))))  # toward the dash
SW_ROT = track_rot(-SW_D)
rim = bm_torus(0.19, 0.022, 72, 14)
for f in rim.faces:
    c = f.calc_center_median()
    ang = math.degrees(math.atan2(c.y, c.x)) % 180
    f.material_index = 1 if (45 < ang < 135) else 0
xform(rim, SW_C, SW_ROT)
obj_from_bm("Steering_Rim", rim, [M_WOOD, M_CREAM], I, sharp=0, parent=BODY)
_up = SW_ROT @ Vector((0, 1, 0))
_rt = SW_ROT @ Vector((1, 0, 0))
cyl("Steering_Hub", 0.075, 0.07, SW_C + SW_D * 0.03, M_CREAM, I, rot=SW_ROT, parent=BODY)
cyl("Steering_Badge", 0.035, 0.074, SW_C + SW_D * 0.028, M_ALU, I, rot=SW_ROT, parent=BODY)
for name, d in (("L", _rt), ("R", -_rt), ("B", -_up)):
    beam(f"Steering_Spoke_{name}", SW_C + d * 0.06 + SW_D * 0.015, SW_C + d * 0.18 + SW_D * 0.005, 0.045, 0.018,
         M_ALU, I, 0.006, BODY, up=tuple(-SW_D))
cyl("Steering_Column", 0.04, 0.42, SW_C + SW_D * 0.26, M_TRIM, I, rot=track_rot(SW_D), parent=BODY)

# seats


def seat(prefix, x, y, w=0.54, occupied=False):
    irbox(f"{prefix}_Cushion", (0.56, w, 0.15), (x, y, 0.715), M_BROWN, 0.05, segs=4)
    irbox(f"{prefix}_Bolster_L", (0.52, 0.07, 0.07), (x, y + w / 2 - 0.035, 0.80), M_BROWN, 0.03)
    irbox(f"{prefix}_Bolster_R", (0.52, 0.07, 0.07), (x, y - w / 2 + 0.035, 0.80), M_BROWN, 0.03)
    irbox(f"{prefix}_Pipe", (0.57, w + 0.01, 0.012), (x, y, 0.64), M_CREAM, 0.004)
    rot = Euler((0, radians(-12), 0))
    bx = x - 0.29
    irbox(f"{prefix}_Back", (0.14, w, 0.74), (bx, y, 1.15), M_BROWN, 0.05, rot=rot, segs=4)
    irbox(f"{prefix}_Back_Cream", (0.10, w - 0.12, 0.62), (bx + 0.03, y, 1.14), M_CREAM, 0.04, rot=rot)
    irbox(f"{prefix}_Headrest", (0.11, 0.30, 0.20), (bx - 0.12, y, 1.62), M_BROWN, 0.045, rot=rot, segs=4)
    irbox(f"{prefix}_Pillow", (0.04, 0.24, 0.12), (bx - 0.05, y, 1.60), M_CREAM, 0.02, rot=rot)
    irbox(f"{prefix}_Base", (0.40, w - 0.10, 0.12), (x, y, 0.58), M_TRIM, 0.02)


seat("Seat_Driver", -0.22, 0.45, occupied=True)
seat("Seat_Pass", -0.22, -0.45)
seat("Seat_RearL", -1.30, 0.42, 0.58)
seat("Seat_RearR", -1.30, -0.42, 0.58)
irbox("Rear_Console", (0.70, 0.22, 0.24), (-1.25, 0, 0.62), M_CREAM, 0.04)
irbox("Rear_Console_Top", (0.66, 0.20, 0.015), (-1.25, 0, 0.745), M_WOOD, 0.005)
irbox("Rear_Bench3", (0.5, 1.4, 0.15), (-2.05, 0, 0.66), M_BROWN, 0.05)
irbox("Rear_Bench3_Back", (0.14, 1.4, 0.56), (-2.32, 0, 0.98), M_BROWN, 0.05, rot=Euler((0, radians(-10), 0)))

# door trims (both sides)
for s in (1, -1):
    irbox(f"Door_Top_{s}", (1.12, 0.05, 0.06), (0.29, s * 0.885, 1.10), M_BROWN, 0.02)
    irbox(f"Door_Wood_{s}", (1.05, 0.012, 0.025), (0.28, s * 0.86, 1.045), M_WOOD, 0.004)
    irbox(f"Door_Ambient_{s}", (1.05, 0.006, 0.005), (0.28, s * 0.857, 1.028), M_AMBIENT)
    irbox(f"Door_Armrest_{s}", (0.62, 0.09, 0.06), (0.05, s * 0.775, 0.93), M_BROWN, 0.025)
    irbox(f"Door_Handle_{s}", (0.10, 0.015, 0.025), (0.50, s * 0.86, 1.075), M_CHROME, 0.007)
    irbox(f"Door_Switches_{s}", (0.20, 0.03, 0.012), (0.12, s * 0.78, 0.965), M_ALU, 0.005)
    cyl(f"Door_Speaker_{s}", 0.065, 0.012, (0.62, s * 0.797, 0.66), M_ALU, I,
        rot=Euler((radians(90), 0, 0)), segs=40, parent=BODY)
    irbox(f"RearDoor_Top_{s}", (1.0, 0.05, 0.06), (-0.88, s * 0.885, 1.12), M_BROWN, 0.02)
    irbox(f"RearDoor_Ambient_{s}", (0.95, 0.006, 0.005), (-0.88, s * 0.857, 1.04), M_AMBIENT)
    irbox(f"Tub_{s}", (1.0, 0.18, 0.40), (-1.585, s * 0.78, 0.70), M_CREAM, 0.03)

# rear-view mirror
irbox("RVM_Stem", (0.02, 0.02, 0.10), (0.16, 0, 1.70), M_TRIM)
irbox("RVM", (0.035, 0.27, 0.075), (0.16, 0, 1.63), M_TRIM, 0.02)

# the can (pivot at its base inside the holder so it sways in place)
CAN_BASE = Vector((CUP[0][0], CUP[0][1], 0.69))
CAN = empty("CAN_PIVOT", CAN_BASE, I, parent=BODY, size=0.05)
_can = bm_cyl(0.033, 0.033, 0.112, 48)
xform(_can, (0, 0, 0.056))
_neck = bm_cyl(0.033, 0.0285, 0.010, 48)
xform(_neck, (0, 0, 0.117))
tmp = bpy.data.meshes.new("tmp")
_neck.to_mesh(tmp)
_neck.free()
_can.from_mesh(tmp)
bpy.data.meshes.remove(tmp)
xform(_can, CAN_BASE)
obj_from_bm("Can_Body", _can, [M_CAN], I, sharp=40, parent=CAN)
cyl("Can_Lid", 0.0275, 0.004, CAN_BASE + Vector((0, 0, 0.1215)), M_ALU, I, segs=40, parent=CAN)
rbox("Can_Tab", (0.026, 0.012, 0.002), CAN_BASE + Vector((0.004, 0, 0.1245)), M_ALU, I, bevel=0.0009, parent=CAN)

# --------------------------------------------------------------------------
# driver mannequin
# --------------------------------------------------------------------------
D = COL_DRV
HIP = Vector((-0.27, 0.45, 0.86))
NECK = Vector((-0.31, 0.45, 1.44))
TORSO = empty("DRV_TORSO", HIP, D, parent=BODY, size=0.08)
HEAD = empty("DRV_HEAD", NECK, D, parent=TORSO, size=0.08)

ellipsoid("Drv_Pelvis", (0.15, 0.19, 0.10), (-0.25, 0.45, 0.86), M_SUIT, D, parent=TORSO)
ellipsoid("Drv_Torso", (0.12, 0.20, 0.30), (-0.32, 0.45, 1.14), M_SUIT, D,
          rot=Euler((0, radians(-8), 0)), parent=TORSO)
ellipsoid("Drv_Shirt", (0.02, 0.034, 0.065), (-0.205, 0.45, 1.35), M_SHIRT, D,
          rot=Euler((0, radians(-8), 0)), parent=TORSO)
beam("Drv_Tie", (-0.186, 0.45, 1.36), (-0.200, 0.45, 1.20), 0.022, 0.012, M_TRIM, D, 0.004, TORSO, up=(1, 0, 0))
limb("Drv_Neck", NECK + Vector((0, 0, -0.04)), NECK + Vector((-0.01, 0, 0.07)), 0.055, 0.05, M_SKIN, D, TORSO)

SH = {1: Vector((-0.33, 0.645, 1.355)), -1: Vector((-0.33, 0.255, 1.355))}
HAND = {1: Vector((0.105, 0.638, 1.132)), -1: Vector((0.105, 0.262, 1.132))}


def elbow(S, H, L1, L2, pole):
    d = (H - S).length
    d = min(d, L1 + L2 - 1e-3)
    axis = (H - S).normalized()
    a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
    h = sqrt(max(L1 * L1 - a * a, 0))
    p = Vector(pole)
    p = (p - axis * p.dot(axis)).normalized()
    return S + axis * a + p * h


for s in (1, -1):
    side_off = 1 if s == 1 else -1
    S, H = SH[s], HAND[s]
    E = elbow(S, H, 0.30, 0.29, (0, 0.55 * side_off, -1))
    ellipsoid(f"Drv_Shoulder_{s}", (0.07, 0.07, 0.065), S, M_SUIT, D, parent=TORSO)
    limb(f"Drv_UpperArm_{s}", S, E, 0.052, 0.043, M_SUIT, D, TORSO)
    ellipsoid(f"Drv_Elbow_{s}", (0.044, 0.044, 0.044), E, M_SUIT, D, parent=TORSO)
    limb(f"Drv_Forearm_{s}", E, H - (H - E).normalized() * 0.06, 0.042, 0.035, M_SUIT, D, TORSO)
    limb(f"Drv_Cuff_{s}", H - (H - E).normalized() * 0.075, H - (H - E).normalized() * 0.05, 0.034, 0.034,
         M_SHIRT, D, TORSO)
    ellipsoid(f"Drv_Hand_{s}", (0.05, 0.035, 0.045), H, M_SKIN, D, parent=TORSO)
    # legs
    hipj = Vector((-0.24, 0.45 + 0.10 * s, 0.85))
    knee = Vector((0.20, 0.45 + 0.11 * s, 0.90))
    ankle = Vector((0.43, 0.45 + 0.12 * s, 0.585))
    limb(f"Drv_Thigh_{s}", hipj, knee, 0.078, 0.062, M_SUIT, D, BODY)
    ellipsoid(f"Drv_Knee_{s}", (0.062, 0.062, 0.062), knee, M_SUIT, D, parent=BODY)
    limb(f"Drv_Shin_{s}", knee, ankle, 0.055, 0.045, M_SUIT, D, BODY)
    rbox(f"Drv_Shoe_{s}", (0.25, 0.09, 0.08), ankle + Vector((0.08, 0, -0.035)), M_TRIM, D, bevel=0.035,
         rot=Euler((0, radians(-25), 0)), parent=BODY)

# head (children of the head pivot)
HC = Vector((-0.33, 0.45, 1.57))
ellipsoid("Drv_Head", (0.098, 0.080, 0.118), HC, M_SKIN, D, parent=HEAD, u=40, v=24)
ellipsoid("Drv_Jaw", (0.075, 0.070, 0.06), HC + Vector((0.025, 0, -0.065)), M_SKIN, D, parent=HEAD)
ellipsoid("Drv_Hair", (0.102, 0.086, 0.088), HC + Vector((-0.012, 0, 0.045)), M_HAIR, D, parent=HEAD, u=40, v=24)
ellipsoid("Drv_Nose", (0.025, 0.014, 0.022), HC + Vector((0.098, 0, -0.005)), M_SKIN, D, parent=HEAD)
for s in (1, -1):
    ellipsoid(f"Drv_Ear_{s}", (0.022, 0.012, 0.03), HC + Vector((-0.005, s * 0.079, -0.005)), M_SKIN, D,
              parent=HEAD)
    rbox(f"Drv_Lens_{s}", (0.012, 0.052, 0.036), HC + Vector((0.096, s * 0.035, 0.018)), M_SHADES, D,
         bevel=0.01, parent=HEAD)
    beam(f"Drv_Temple_{s}", HC + Vector((0.09, s * 0.062, 0.03)), HC + Vector((-0.01, s * 0.083, 0.02)), 0.005,
         0.006, M_SHADES, D, 0.0, HEAD)
beam("Drv_Bridge", HC + Vector((0.104, 0.012, 0.024)), HC + Vector((0.104, -0.012, 0.024)), 0.006, 0.005,
     M_SHADES, D, 0.0, HEAD)

# --------------------------------------------------------------------------
# studio
# --------------------------------------------------------------------------
S_ = COL_STUDIO
# floor: dark wet asphalt
M_FLOOR = principled("Floor_WetAsphalt", (0.004, 0.004, 0.0045), rough=0.3, spec=0.5)
_nt = M_FLOOR.node_tree
_b = _nt.nodes["Principled BSDF"]
_n = _nt.nodes.new("ShaderNodeTexNoise")
_n.inputs["Scale"].default_value = 0.6
_n.inputs["Detail"].default_value = 4
_rm = _nt.nodes.new("ShaderNodeMapRange")
_rm.inputs["From Min"].default_value = 0.4
_rm.inputs["From Max"].default_value = 0.6
_rm.inputs["To Min"].default_value = 0.12
_rm.inputs["To Max"].default_value = 0.6
_nt.links.new(_n.outputs["Fac"], _rm.inputs["Value"])
_nt.links.new(_rm.outputs["Result"], _b.inputs["Roughness"])
_v = _nt.nodes.new("ShaderNodeTexVoronoi")
_v.inputs["Scale"].default_value = 900
_bp = _nt.nodes.new("ShaderNodeBump")
_bp.inputs["Strength"].default_value = 0.25
_nt.links.new(_v.outputs["Distance"], _bp.inputs["Height"])
_nt.links.new(_bp.outputs["Normal"], _b.inputs["Normal"])
_g = bmesh.new()
bmesh.ops.create_grid(_g, x_segments=1, y_segments=1, size=60)
obj_from_bm("Floor", _g, [M_FLOOR], S_, smooth=False)

# backdrop with the red horizon light line (as in the reference photos)
M_BACK = bpy.data.materials.new("Backdrop_RedLine")
if M_BACK.node_tree is None:
    M_BACK.use_nodes = True
_nt = M_BACK.node_tree
_nt.nodes.remove(_nt.nodes["Principled BSDF"])
_tc = _nt.nodes.new("ShaderNodeTexCoord")
_sp = _nt.nodes.new("ShaderNodeSeparateXYZ")
_nt.links.new(_tc.outputs["Object"], _sp.inputs[0])


def gauss(src, center, width, gain):
    a = _nt.nodes.new("ShaderNodeMath")
    a.operation = "SUBTRACT"
    a.inputs[1].default_value = center
    _nt.links.new(src, a.inputs[0])
    b = _nt.nodes.new("ShaderNodeMath")
    b.operation = "DIVIDE"
    b.inputs[1].default_value = width
    _nt.links.new(a.outputs[0], b.inputs[0])
    c = _nt.nodes.new("ShaderNodeMath")
    c.operation = "MULTIPLY"
    _nt.links.new(b.outputs[0], c.inputs[0])
    _nt.links.new(b.outputs[0], c.inputs[1])
    d = _nt.nodes.new("ShaderNodeMath")
    d.operation = "MULTIPLY"
    d.inputs[1].default_value = -1.0
    _nt.links.new(c.outputs[0], d.inputs[0])
    e = _nt.nodes.new("ShaderNodeMath")
    e.operation = "EXPONENT"
    _nt.links.new(d.outputs[0], e.inputs[0])
    f = _nt.nodes.new("ShaderNodeMath")
    f.operation = "MULTIPLY"
    f.inputs[1].default_value = gain
    _nt.links.new(e.outputs[0], f.inputs[0])
    return f.outputs[0]


def mul(a, b):
    n = _nt.nodes.new("ShaderNodeMath")
    n.operation = "MULTIPLY"
    _nt.links.new(a, n.inputs[0])
    _nt.links.new(b, n.inputs[1])
    return n.outputs[0]


LINE_Z = 0.95
fade = gauss(_sp.outputs["X"], 0.0, 9.0, 1.0)
glow = mul(gauss(_sp.outputs["Z"], LINE_Z, 0.55, 0.9), fade)
core = mul(gauss(_sp.outputs["Z"], LINE_Z, 0.018, 40.0), fade)
e1 = _nt.nodes.new("ShaderNodeEmission")
e1.inputs["Color"].default_value = (1.0, 0.03, 0.02, 1)
_nt.links.new(glow, e1.inputs["Strength"])
e2 = _nt.nodes.new("ShaderNodeEmission")
e2.inputs["Color"].default_value = (1.0, 0.55, 0.5, 1)
_nt.links.new(core, e2.inputs["Strength"])
add = _nt.nodes.new("ShaderNodeAddShader")
_nt.links.new(e1.outputs[0], add.inputs[0])
_nt.links.new(e2.outputs[0], add.inputs[1])
_nt.links.new(add.outputs[0], _nt.nodes["Material Output"].inputs["Surface"])


def backdrop(name, center, facing_deg):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in ((-30, 0, -1), (30, 0, -1), (30, 0, 12), (-30, 0, 12))]
    bm.faces.new(vs)
    xform(bm, center, Euler((0, 0, radians(facing_deg))))
    ob = obj_from_bm(name, bm, [M_BACK], S_, smooth=False)
    # object-space Z of the line must be world height -> keep origin at floor
    return ob


# behind the car as seen from the final front-left camera, plus one on the other side
backdrop("Backdrop_A", (-11.0, -11.5, 0), -46)
backdrop("Backdrop_B", (2.0, 15.0, 0), 180 - 15)

# world: near-black
world = bpy.data.worlds.new("World")
scene.world = world
if world.node_tree is None:
    world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.004, 0.005, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0


def area_light(name, size, loc, target, power, color=(1, 1, 1), parent=None, camera_visible=False,
               size_y=None, spread=None):
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape = "RECTANGLE"
    ld.size = size
    ld.size_y = size_y if size_y is not None else size
    ld.energy = power
    ld.color = color
    if spread is not None:
        ld.spread = radians(spread)
    ob = bpy.data.objects.new(name, ld)
    S_.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    ob.visible_camera = camera_visible
    if parent is not None:
        parent_keep(ob, parent)
    return ob


area_light("Key_Top", 7.0, (-0.5, 0.0, 5.5), (-0.5, 0, 0), 900, (1.0, 0.98, 0.96), size_y=3.5)
area_light("Strip_Left", 7.0, (0.3, 4.6, 2.3), (0.0, 0.0, 0.8), 450, size_y=0.5)
area_light("Strip_Right", 7.0, (0.3, -4.6, 2.3), (0.0, 0.0, 0.8), 200, size_y=0.5)
area_light("Front_Soft", 3.0, (6.5, 2.0, 2.4), (0.0, 0.0, 0.7), 350, (1.0, 0.97, 0.94), size_y=1.6)
area_light("Rim_Red", 12.0, (-7.0, -6.0, 1.3), (0.0, 0.0, 0.9), 900, (1.0, 0.04, 0.03), size_y=1.2)
area_light("Rim_Red_B", 8.0, (-6.5, 6.0, 1.3), (0.0, 0.0, 0.9), 350, (1.0, 0.04, 0.03), size_y=1.0)
# keep the big soft boxes out of the floor reflection (light linking: exclude floor)
FLOOR_EXCL = bpy.data.collections.new("LL_ExcludeFloor")
FLOOR_EXCL.objects.link(bpy.data.objects["Floor"])
FLOOR_EXCL.collection_objects[0].light_linking.link_state = "EXCLUDE"
for _ln in ("Key_Top", "Front_Soft", "Strip_Left", "Strip_Right"):
    bpy.data.objects[_ln].light_linking.receiver_collection = FLOOR_EXCL
# cabin lights travel with the body
area_light("Cabin_Dome", 1.1, (-0.35, 0.0, 1.76), (-0.35, 0.0, 0.5), 9, (1.0, 0.86, 0.72), BODY, size_y=0.6)
area_light("Cabin_Front", 0.35, (0.35, 0.0, 1.70), (0.0, 0.25, 0.9), 4, (1.0, 0.9, 0.8), BODY, size_y=0.2)
area_light("Cabin_Console", 0.3, (0.40, -0.35, 1.30), (0.12, 0.05, 0.75), 1.5, (1.0, 0.92, 0.85), BODY, size_y=0.2)

# --------------------------------------------------------------------------
# animation
# --------------------------------------------------------------------------
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = FRAMES
W = 2 * pi * FREQ


def env(t, start=T0, ramp=RAMP):
    return smoothstep((t - start) / ramp)


def body_state(t):
    e = env(t)
    tt = t - T0
    heave = LIFT * e + A_HEAVE * e * sin(W * tt)
    roll = A_ROLL * e * sin(0.5 * W * tt)
    pitch = A_PITCH * e * sin(0.5 * W * tt + pi / 2) * smoothstep(tt / 0.6)
    return heave, roll, pitch


def body_delta(t):
    h, r, p = body_state(t)
    return (Matrix.Translation(PIVOT + Vector((0, 0, h))) @ Euler((r, p, 0)).to_matrix().to_4x4() @
            Matrix.Translation(-PIVOT))


def frame_time(f):
    return (f - 1) / FPS


for ob in (BODY, CAN, TORSO, HEAD):
    ob.rotation_mode = "XYZ"

for f in range(1, FRAMES + 1):
    t = frame_time(f)
    tt = t - T0
    h, r, p = body_state(t)
    BODY.location = PIVOT + Vector((0, 0, h))
    BODY.rotation_euler = (r, p, 0)
    BODY.keyframe_insert("location", frame=f)
    BODY.keyframe_insert("rotation_euler", frame=f)

    e = env(t)
    CAN.location = CAN_BASE + Vector((0, 0, 0.0015 * e * sin(W * tt - 1.3)))
    CAN.rotation_euler = (radians(2.2) * e * sin(W * tt - 1.1), radians(1.6) * e * sin(0.5 * W * tt - 0.7), 0)
    CAN.keyframe_insert("location", frame=f)
    CAN.rotation_euler.z = 0
    CAN.keyframe_insert("rotation_euler", frame=f)

    eh = env(t, 1.1, 0.8)
    TORSO.location = HIP + Vector((0, 0, 0.008 * eh * sin(W * tt - 0.4)))
    TORSO.rotation_euler = (radians(2.0) * eh * sin(0.5 * W * tt - 0.3), radians(-1.2) * eh * sin(W * tt - 0.5), 0)
    TORSO.keyframe_insert("location", frame=f)
    TORSO.keyframe_insert("rotation_euler", frame=f)

    HEAD.rotation_euler = (radians(7.0) * eh * sin(0.5 * W * tt - 0.2),
                           radians(2.0) * eh + radians(9.0) * eh * sin(W * tt - 0.5),
                           radians(5.0) * eh * sin(0.5 * W * tt + 1.0))
    HEAD.keyframe_insert("rotation_euler", frame=f)

# --------------------------------------------------------------------------
# camera — one continuous move
# --------------------------------------------------------------------------
cam_data = bpy.data.cameras.new("Camera")
cam_data.sensor_fit = "VERTICAL"
cam_data.sensor_height = 36.0
cam_data.sensor_width = 36.0
cam_data.clip_start = 0.01
cam_data.clip_end = 200
CAM = bpy.data.objects.new("Camera", cam_data)
scene.collection.objects.link(CAM)
scene.camera = CAM
CAM.rotation_mode = "QUATERNION"

# (time, position, look-at) in car coordinates
CAM_KEYS = [
    (0.0, (0.22, 0.17, 0.93), (0.12, 0.055, 0.755)),
    (3.0, (0.29, 0.24, 1.02), (0.11, 0.05, 0.765)),
    (4.8, (0.44, 0.20, 1.40), (-0.10, 0.30, 1.15)),
    (6.4, (0.34, 0.52, 1.47), (-0.32, 0.43, 1.42)),
    (8.0, (0.18, 0.95, 1.42), (-0.32, 0.40, 1.36)),
    (9.6, (0.45, 1.80, 1.42), (-0.15, 0.30, 1.22)),
    (11.6, (2.8, 3.4, 1.22), (0.35, 0.0, 0.90)),
    (15.0, (4.9, 4.6, 0.95), (0.30, -0.15, 0.80)),
]


def hermite_path(keys, idx, t):
    ts = [k[0] for k in keys]
    ps = [Vector(k[idx]) for k in keys]
    n = len(keys)
    if t <= ts[0]:
        return ps[0].copy()
    if t >= ts[-1]:
        return ps[-1].copy()
    i = max(j for j in range(n - 1) if ts[j] <= t)

    def tangent(j):
        if j == 0 or j == n - 1:
            return Vector((0, 0, 0))
        return (ps[j + 1] - ps[j - 1]) / (ts[j + 1] - ts[j - 1])

    t0, t1 = ts[i], ts[i + 1]
    dt = t1 - t0
    s = (t - t0) / dt
    h00 = 2 * s ** 3 - 3 * s ** 2 + 1
    h10 = s ** 3 - 2 * s ** 2 + s
    h01 = -2 * s ** 3 + 3 * s ** 2
    h11 = s ** 3 - s ** 2
    return h00 * ps[i] + h10 * dt * tangent(i) + h01 * ps[i + 1] + h11 * dt * tangent(i + 1)


def attach(t):
    """How much the camera rides with the body (0 = locked to the world)."""
    return 0.5 * (1 - smoothstep((t - 6.6) / 3.0))


def lens(t):
    return 18.0 + 4.0 * smoothstep((t - 8.5) / 6.0)


prev_q = None
for f in range(1, FRAMES + 1):
    t = frame_time(f)
    P = hermite_path(CAM_KEYS, 1, t)
    T = hermite_path(CAM_KEYS, 2, t)
    a = attach(t)
    Dm = body_delta(t)
    Pw = P.lerp(Dm @ P, a)
    Tw = T.lerp(Dm @ T, a)
    up = Vector((0, 0, 1)).lerp(Dm.to_3x3() @ Vector((0, 0, 1)), a).normalized()
    fwd = (Tw - Pw).normalized()
    right = fwd.cross(up).normalized()
    upv = right.cross(fwd)
    R = Matrix((right, upv, -fwd)).transposed()
    q = R.to_quaternion()
    if prev_q is not None and prev_q.dot(q) < 0:
        q.negate()
    prev_q = q
    CAM.location = Pw
    CAM.rotation_quaternion = q
    CAM.keyframe_insert("location", frame=f)
    CAM.keyframe_insert("rotation_quaternion", frame=f)
    cam_data.lens = lens(t)
    cam_data.keyframe_insert("lens", frame=f)

# --------------------------------------------------------------------------
# render settings
# --------------------------------------------------------------------------
r = scene.render
r.engine = "CYCLES"
r.resolution_x = 1080
r.resolution_y = 1920
r.resolution_percentage = 100
r.use_motion_blur = True
r.motion_blur_shutter = 0.4
r.image_settings.file_format = "PNG"
c = scene.cycles
c.device = "CPU"
c.samples = 32
c.use_adaptive_sampling = True
c.adaptive_threshold = 0.03
c.use_denoising = True
try:
    c.denoiser = "OPENIMAGEDENOISE"
except TypeError:
    pass
c.max_bounces = 6
c.diffuse_bounces = 2
c.glossy_bounces = 2
c.transmission_bounces = 3
c.transparent_max_bounces = 12
c.caustics_reflective = False
c.caustics_refractive = False
c.blur_glossy = 1.0
scene.view_settings.view_transform = "AgX"
for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
    try:
        scene.view_settings.look = look
        break
    except TypeError:
        continue
scene.view_settings.exposure = 0.0

scene.frame_set(1)
os.makedirs(os.path.dirname(os.path.abspath(OUT_BLEND)), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT_BLEND), compress=True)
print("saved", OUT_BLEND)
