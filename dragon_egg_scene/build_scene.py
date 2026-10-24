"""
Айдаһар жұмыртқасы — Blender blockout сахнасы (30 с, 16:9, 24 fps)
Dragon Egg — procedural Blender blockout scene (30 s, 16:9, 24 fps)

Builds the whole scene from code: forest, stepping stones, buried dragon egg,
a mannequin person and a baby dragon (procedural IK rigs), shell-fracture
debris and seven shot cameras bound to timeline markers. Saves a .blend.

Run with the Blender binary:
    blender -b -P build_scene.py -- --out dragon_egg_scene.blend
or with the bpy module (pip install bpy):
    python build_scene.py --out dragon_egg_scene.blend
"""
import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Vector, Matrix, Quaternion, noise
from bpy_extras import anim_utils

FPS = 24
FRAME_END = 720
UP = Vector((0, 0, 1))
rng = random.Random(7)


# ---------------------------------------------------------------- math utils
def clamp(x, a, b):
    return max(a, min(b, x))


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(t):
    t = clamp(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def ramp(f, f0, f1):
    return smooth((f - f0) / (f1 - f0))


def _cp(v):
    return v.copy() if hasattr(v, "copy") else v


def nz(x, seed=0.0):
    """1D smooth noise in [-1, 1]."""
    return noise.noise(Vector((x, seed * 1.37 + 0.5, seed * 0.71 + 3.3)))


class Track:
    """Interpolates (frame, value) keys. 'smooth' eases in/out at every key,
    'spline' is a Catmull-Rom curve that keeps velocity through keys."""

    def __init__(self, keys, mode="smooth"):
        self.k = sorted(keys, key=lambda k: k[0])
        self.mode = mode

    def __call__(self, f):
        k = self.k
        if f <= k[0][0]:
            return _cp(k[0][1])
        if f >= k[-1][0]:
            return _cp(k[-1][1])
        i = 0
        while not (k[i][0] <= f <= k[i + 1][0]):
            i += 1
        f0, v0 = k[i]
        f1, v1 = k[i + 1]
        t = (f - f0) / (f1 - f0)
        if self.mode == "linear":
            return v0 + (v1 - v0) * t
        if self.mode == "smooth":
            return v0 + (v1 - v0) * smooth(t)
        span = f1 - f0
        m0 = (v1 - k[i - 1][1]) * (span / (f1 - k[i - 1][0])) if i > 0 else (v1 - v0) * 0.0
        m1 = (k[i + 2][1] - v0) * (span / (k[i + 2][0] - f0)) if i + 2 < len(k) else (v1 - v0) * 0.0
        t2, t3 = t * t, t * t * t
        return (v0 * (2 * t3 - 3 * t2 + 1) + m0 * (t3 - 2 * t2 + t)
                + v1 * (-2 * t3 + 3 * t2) + m1 * (t3 - t2))


class ModeTrack:
    """Blends between functions of the frame: [(frame, fn), ...]."""

    def __init__(self, keys):
        self.k = keys

    def __call__(self, f):
        k = self.k
        if f <= k[0][0]:
            return k[0][1](f)
        if f >= k[-1][0]:
            return k[-1][1](f)
        i = 0
        while not (k[i][0] <= f < k[i + 1][0]):
            i += 1
        (f0, a), (f1, b) = k[i], k[i + 1]
        if a is b:
            return a(f)
        t = smooth((f - f0) / (f1 - f0))
        va, vb = a(f), b(f)
        return va.lerp(vb, t) if isinstance(va, Vector) else va + (vb - va) * t


def basis(x, y, z, origin):
    return Matrix(((x.x, y.x, z.x, origin.x),
                   (x.y, y.y, z.y, origin.y),
                   (x.z, y.z, z.z, origin.z),
                   (0, 0, 0, 1)))


def frame_yz(origin, yaxis, zhint):
    """Matrix with local +Y along yaxis and +Z as close to zhint as possible."""
    y = yaxis.normalized()
    z = (zhint - y * zhint.dot(y))
    if z.length < 1e-6:
        z = Vector((0, 0, 1)) if abs(y.z) < 0.9 else Vector((0, 1, 0))
        z = z - y * z.dot(y)
    z.normalize()
    return basis(y.cross(z), y, z, origin)


def seg_matrix(a, b, hint):
    """Limb segment: origin at joint a, local -Z points to b, +Y toward hint."""
    z = (a - b).normalized()
    y = hint - z * hint.dot(z)
    if y.length < 1e-6:
        y = Vector((0, 1, 0)) - z * z.y
    y.normalize()
    return basis(y.cross(z), y, z, a)


def ik2(root, target, l1, l2, pole):
    d = target - root
    dist = clamp(d.length, abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999)
    dn = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    p = pole - dn * pole.dot(dn)
    p.normalize()
    return root + dn * a + p * h, root + dn * dist


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def T(v):
    return Matrix.Translation(Vector(v))


# ------------------------------------------------------------- key storage
class KeyStore:
    """Collects per-frame values and writes them as F-curves in bulk."""

    def __init__(self):
        self.ids = {}
        self.lastq = {}

    def put(self, idb, path, idx, f, val):
        ptr = idb.as_pointer()
        if ptr not in self.ids:
            self.ids[ptr] = (idb, {})
        self.ids[ptr][1].setdefault((path, idx), []).append((f, float(val)))

    def matrix(self, ob, f, M):
        loc, q, sca = M.decompose()
        ptr = ob.as_pointer()
        prev = self.lastq.get(ptr)
        if prev is not None and prev.dot(q) < 0:
            q.negate()
        self.lastq[ptr] = q
        for i in range(3):
            self.put(ob, "location", i, f, loc[i])
            self.put(ob, "scale", i, f, sca[i])
        for i in range(4):
            self.put(ob, "rotation_quaternion", i, f, q[i])

    def flush(self):
        for idb, chans in self.ids.values():
            ad = idb.animation_data_create()
            act = bpy.data.actions.new(idb.name + "_Action")
            slot = act.slots.new(id_type=idb.id_type, name=idb.name)
            ad.action = act
            ad.action_slot = slot
            cb = anim_utils.action_ensure_channelbag_for_slot(act, slot)
            for (path, idx), seq in chans.items():
                seq.sort()
                keys = []
                for j, (f, v) in enumerate(seq):
                    if 0 < j < len(seq) - 1 and abs(v - seq[j - 1][1]) < 1e-5 and abs(v - seq[j + 1][1]) < 1e-5:
                        continue
                    keys.append((f, v))
                fc = cb.fcurves.new(path, index=idx)
                fc.keyframe_points.add(len(keys))
                fc.keyframe_points.foreach_set("co", [c for k in keys for c in k])
                fc.keyframe_points.foreach_set("interpolation", [1] * len(keys))
                fc.update()


KS = KeyStore()


# ------------------------------------------------------------- scene setup
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = FRAME_END
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080


def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


C_ENV, C_PATH, C_EGG = collection("ENV_Forest"), collection("ENV_StonePath"), collection("EGG")
C_PERSON, C_DRAGON = collection("CHR_Person"), collection("CHR_BabyDragon")
C_CAM, C_LIGHT = collection("CAMERAS"), collection("LIGHTS")


# ---------------------------------------------------------------- materials
def material(name, color, rough=0.7, emit=None, emit_strength=0.0, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    m.diffuse_color = (*color, 1)
    return m


def sock(coll, identifier):
    return next(s for s in coll if s.identifier == identifier)


def mix_rgb(nt):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    return m


def node_mix_material(name, col_a, col_b, mask_builder, rough=0.8):
    """Principled material whose base color mixes col_a/col_b by a mask."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    mix = mix_rgb(nt)
    sock(mix.inputs, "A_Color").default_value = (*col_a, 1)
    sock(mix.inputs, "B_Color").default_value = (*col_b, 1)
    nt.links.new(mask_builder(nt), mix.inputs["Factor"])
    nt.links.new(sock(mix.outputs, "Result_Color"), b.inputs["Base Color"])
    m.diffuse_color = (*col_a, 1)
    return m


def mask_normal_up(lo, hi, noise_scale=6.0, noise_amt=0.25):
    def build(nt):
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Normal"], sep.inputs[0])
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = noise_scale
        nt.links.new(tc.outputs["Object"], tex.inputs["Vector"])
        add = nt.nodes.new("ShaderNodeMath")
        add.operation = "MULTIPLY_ADD"
        nt.links.new(tex.outputs["Fac"], add.inputs[0])
        add.inputs[1].default_value = noise_amt
        nt.links.new(sep.outputs["Z"], add.inputs[2])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = lo
        mr.inputs["From Max"].default_value = hi
        nt.links.new(add.outputs[0], mr.inputs["Value"])
        return mr.outputs["Result"]
    return build


def mask_noise(scale, lo, hi, coord="Object"):
    def build(nt):
        tc = nt.nodes.new("ShaderNodeTexCoord")
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Detail"].default_value = 6
        nt.links.new(tc.outputs[coord], tex.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = lo
        mr.inputs["From Max"].default_value = hi
        nt.links.new(tex.outputs["Fac"], mr.inputs["Value"])
        return mr.outputs["Result"]
    return build


def mask_belly():
    """Dragon belly: surfaces whose object-space normal points down."""
    return mask_normal_up(-0.15, -0.55, noise_scale=10, noise_amt=0.0)


MAT = {
    "ground": node_mix_material("Ground_MossSoil", (0.075, 0.06, 0.035), (0.10, 0.20, 0.04), mask_noise(0.35, 0.42, 0.58), 0.95),
    "stone": node_mix_material("Stone_Mossy", (0.15, 0.15, 0.14), (0.07, 0.15, 0.03), mask_normal_up(0.45, 0.85), 0.85),
    "bark": node_mix_material("Bark_MossBase", (0.16, 0.12, 0.085), (0.10, 0.18, 0.05), mask_noise(1.2, 0.5, 0.62), 0.9),
    "leaf": material("Canopy_Leaves", (0.07, 0.17, 0.04), 0.8),
    "fern": material("Fern", (0.09, 0.26, 0.05), 0.7),
    "bush": material("Bush", (0.06, 0.18, 0.04), 0.8),
    "water": material("Stream_Water", (0.02, 0.045, 0.04), 0.04),
    "soil": material("Soil_Dark", (0.13, 0.085, 0.05), 0.95),
    "mush": material("Mushroom_Cap", (0.55, 0.12, 0.05), 0.5),
    "mush_stem": material("Mushroom_Stem", (0.8, 0.75, 0.6), 0.6),
    # person
    "jacket": material("Person_Jacket_Rust", (0.42, 0.17, 0.06), 0.75),
    "pants": material("Person_Pants_Dark", (0.08, 0.09, 0.12), 0.85),
    "boots": material("Person_Boots_Brown", (0.12, 0.07, 0.04), 0.6),
    "skin": material("Person_Skin", (0.42, 0.24, 0.155), 0.55),
    "hair": material("Person_Hair", (0.06, 0.04, 0.03), 0.6),
    "bag": material("Person_Backpack", (0.22, 0.24, 0.13), 0.8),
    "dark": material("Dark_Detail", (0.01, 0.01, 0.01), 0.4),
    # dragon
    "scales": node_mix_material("Dragon_Scales", (0.03, 0.30, 0.33), (0.78, 0.62, 0.40), mask_belly(), 0.45),
    "membrane": material("Dragon_WingMembrane", (0.05, 0.42, 0.40), 0.5),
    "horn": material("Dragon_Horn_Ivory", (0.86, 0.80, 0.64), 0.4),
    "eye": material("Dragon_Eye_Gold", (1.0, 0.65, 0.08), 0.15, emit=(1.0, 0.6, 0.08), emit_strength=1.5),
    "mouth": material("Dragon_Mouth", (0.35, 0.04, 0.05), 0.4),
    # egg
    "egg_in": material("Egg_Inner_Membrane", (0.5, 0.42, 0.28), 0.5),
    "glow": material("Egg_Inner_Glow", (1.0, 0.6, 0.15), 0.5, emit=(1.0, 0.55, 0.12), emit_strength=0.0),
}
for k in ("membrane",):
    MAT[k].use_backface_culling = False


def egg_shell_material():
    """Speckled teal-bronze shell; the top (exposed part) is mossy like a stone.
    Uses the 'eggco' attribute (original egg coordinates) so fragments match."""
    m = bpy.data.materials.new("Egg_Shell_StoneMoss")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.55
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "eggco"
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(attr.outputs["Vector"], sep.inputs[0])
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 9.0
    nt.links.new(attr.outputs["Vector"], vor.inputs["Vector"])
    shell = mix_rgb(nt)
    sock(shell.inputs, "A_Color").default_value = (0.035, 0.075, 0.075, 1)
    sock(shell.inputs, "B_Color").default_value = (0.16, 0.11, 0.045, 1)
    nt.links.new(vor.outputs["Distance"], shell.inputs["Factor"])
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 3.0
    nt.links.new(attr.outputs["Vector"], tex.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    nt.links.new(tex.outputs["Fac"], add.inputs[0])
    add.inputs[1].default_value = 0.3
    nt.links.new(sep.outputs["Z"], add.inputs[2])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.55
    mr.inputs["From Max"].default_value = 0.68
    nt.links.new(add.outputs[0], mr.inputs["Value"])
    moss = mix_rgb(nt)
    nt.links.new(sock(shell.outputs, "Result_Color"), sock(moss.inputs, "A_Color"))
    sock(moss.inputs, "B_Color").default_value = (0.09, 0.14, 0.045, 1)
    nt.links.new(mr.outputs["Result"], moss.inputs["Factor"])
    nt.links.new(sock(moss.outputs, "Result_Color"), b.inputs["Base Color"])
    m.diffuse_color = (0.25, 0.3, 0.28, 1)
    return m


MAT["egg"] = egg_shell_material()
_gb = MAT["glow"].node_tree.nodes["Principled BSDF"]
GLOW_PATH = 'nodes["Principled BSDF"].inputs[%d].default_value' % next(
    i for i, s in enumerate(_gb.inputs) if s.name == "Emission Strength")


# ------------------------------------------------------------ mesh builders
def finish_mesh(name, bm, mats, smooth_shade=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    if smooth_shade:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    return me


def add_obj(name, me, coll, mat_matrix=None):
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.rotation_mode = "QUATERNION"
    if mat_matrix is not None:
        ob.matrix_world = mat_matrix
    return ob


def bm_ellipsoid(bm, r, offset=(0, 0, 0), seg=16, rings=10, mat=0, xform=None):
    tmp = bmesh.new()
    bmesh.ops.create_uvsphere(tmp, u_segments=seg, v_segments=rings, radius=1.0)
    M = (xform or Matrix()) @ T(offset) @ Matrix.Diagonal((*r, 1.0))
    bmesh.ops.transform(tmp, matrix=M, verts=tmp.verts)
    merge_into(bm, tmp, mat)


def merge_into(bm, tmp, mat):
    vmap = {}
    for v in tmp.verts:
        vmap[v] = bm.verts.new(v.co)
    for fc in tmp.faces:
        nf = bm.faces.new([vmap[v] for v in fc.verts])
        nf.material_index = mat
    tmp.free()


def revolve(bm, profile, seg=16, mat=0, xform=None, jitter=None):
    """Surface of revolution around local Z. profile: [(radius, z)], top->bottom."""
    tmp = bmesh.new()
    rings = []
    for j, (r, z) in enumerate(profile):
        if r < 1e-6:
            rings.append([tmp.verts.new((0, 0, z))])
            continue
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            rr = r * (1 + (jitter(a, z) if jitter else 0))
            ring.append(tmp.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        rings.append(ring)
    for a, b in zip(rings[:-1], rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(seg):
            i2 = (i + 1) % seg
            if len(a) == 1:
                tmp.faces.new((a[0], b[i2], b[i]))
            elif len(b) == 1:
                tmp.faces.new((a[i], a[i2], b[0]))
            else:
                tmp.faces.new((a[i], a[i2], b[i2], b[i]))
    bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
    if xform:
        bmesh.ops.transform(tmp, matrix=xform, verts=tmp.verts)
    merge_into(bm, tmp, mat)


def capsule_profile(L, r0, r1, n=4):
    prof = [(r0 * math.cos(math.pi / 2 * (1 - i / n)), r0 * math.sin(math.pi / 2 * (1 - i / n))) for i in range(n + 1)]
    prof += [(r1 * math.cos(math.pi / 2 * i / n), -L - r1 * math.sin(math.pi / 2 * i / n)) for i in range(n + 1)]
    return prof


def bm_capsule(bm, L, r0, r1, mat=0, xform=None, seg=14):
    revolve(bm, capsule_profile(L, r0, r1), seg=seg, mat=mat, xform=xform)


def bm_cone(bm, base, tip, r, mat=0, seg=8):
    d = tip - base
    M = seg_matrix(tip, base, Vector((0, 0, 1)) if abs(d.normalized().z) < 0.9 else Vector((0, 1, 0)))
    revolve(bm, [(0, 0), (r * 0.6, -d.length * 0.5), (r, -d.length), (0, -d.length)], seg=seg, mat=mat, xform=M)


def simple_mesh(name, builder, mats):
    bm = bmesh.new()
    builder(bm)
    return finish_mesh(name, bm, mats)


# ------------------------------------------------------------------ terrain
def path_x(y):
    return 0.8 * math.sin(0.3 * y)


def stream_y(x):
    return -5.0 + 0.6 * math.sin(0.3 * x)


def ground_h(x, y):
    p = Vector((x, y, 0))
    h = 0.9 * noise.noise(p * 0.06 + Vector((0, 0, 0.5)))
    h += 0.15 * noise.noise(p * 0.25 + Vector((0, 0, 3.1)))
    h += 0.03 * noise.noise(p * 0.9 + Vector((0, 0, 7.7)))
    yy = clamp(y, -13.0, 1.0)
    dpath = math.hypot(x - path_x(yy), y - yy)
    flat = max(smooth(1 - (dpath - 1.0) / 3.5), smooth(1 - (math.hypot(x, y) - 2.5) / 4.0))
    h *= 1 - 0.85 * flat
    ds = abs(y - stream_y(x))
    h -= 0.42 * smooth(1 - (ds - 0.45) / 0.75)
    # gentle rise of terrain far from the clearing gives depth
    h += 0.02 * max(0.0, math.hypot(x, y) - 8.0)
    return h


def water_z(x):
    return ground_h(x, stream_y(x)) + 0.2


G0 = ground_h(0, 0)


def build_ground():
    size, step = 72.0, 0.3
    n = int(size / step)
    bm = bmesh.new()
    verts = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x = -size / 2 + i * step
            y = -size / 2 + j * step + 4
            row.append(bm.verts.new((x, y, ground_h(x, y))))
        verts.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
    add_obj("Ground_ForestFloor", finish_mesh("Ground", bm, [MAT["ground"]]), C_ENV)

    bm = bmesh.new()
    prev = None
    for i in range(121):
        x = -36 + i * 0.6
        yc = stream_y(x)
        dx = 0.18 * math.cos(0.3 * x)
        nrm = Vector((-dx, 1, 0)).normalized()
        z = water_z(x)
        a = bm.verts.new((x - nrm.x * 1.25, yc - nrm.y * 1.25, z))
        b = bm.verts.new((x + nrm.x * 1.25, yc + nrm.y * 1.25, z))
        if prev:
            bm.faces.new((prev[0], a, b, prev[1]))
        prev = (a, b)
    add_obj("Stream_Water", finish_mesh("Water", bm, [MAT["water"]]), C_ENV)


def rock_mesh(name, r, seed, flatten=0.55, mat="stone"):
    def b(bm):
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=3, radius=1.0)
        off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
        for v in tmp.verts:
            d = 1 + 0.22 * noise.noise(v.co * 1.4 + off) + 0.06 * noise.noise(v.co * 4 + off)
            co = v.co * d
            co = Vector((co.x * r[0], co.y * r[1], co.z * r[2]))
            top = r[2] * flatten
            if co.z > top:
                co.z = top + (co.z - top) * 0.25
            v.co = co
        merge_into(bm, tmp, 0)
    return simple_mesh(name, b, [MAT[mat]])


# ------------------------------------------------------------- the stone path
STEP_T = 13          # frames between footfalls
LAND_EGG = 180       # right foot lands on the egg-stone
N_STEPS = 18
STEP_LEN = 0.62
EGG_A, EGG_B = 0.80, 0.58
EGG_TOP0 = G0 + 0.25
EGG_Z0 = EGG_TOP0 - EGG_A
EGG_Z1 = G0 + 0.79
ANKLE_H = 0.08

footfalls = []   # dicts: frame, side, ankle, fwd


def path_point(y, side):
    d = Vector((0.24 * math.cos(0.3 * y), 1, 0)).normalized()
    right = Vector((d.y, -d.x, 0))
    return Vector((path_x(y), y, 0)) + right * (0.10 * side), d


stones = []
for i in range(N_STEPS + 1):
    k = N_STEPS - 1 - i
    side = 1 if k % 2 == 0 else -1
    y = -k * STEP_LEN
    if i == N_STEPS - 1:
        p, d = Vector((0.06, 0.0, 0)), Vector((0, 1, 0))
        top = EGG_TOP0
    else:
        p, d = path_point(y, side)
        if i == N_STEPS - 2:
            p.y -= 0.06
        top = ground_h(p.x, p.y) + 0.13 + rng.random() * 0.05
        if abs(p.y - stream_y(p.x)) < 1.2:
            top = max(top, water_z(p.x) + 0.1)
    ankle = Vector((p.x, p.y, top + ANKLE_H))
    footfalls.append(dict(frame=LAND_EGG - k * STEP_T, side="R" if side > 0 else "L", ankle=ankle, fwd=d, top=top))
    if i < N_STEPS - 1:
        stones.append((p + d * 0.06, top))

PUSHED_STONES = []


def build_stones():
    for j, (p, top) in enumerate(stones):
        r = (0.24 + rng.random() * 0.06, 0.27 + rng.random() * 0.06, 0.22)
        me = rock_mesh(f"PathStone_{j:02d}", r, j + 1)
        ztop = max(v.co.z for v in me.vertices)
        gz = ground_h(p.x, p.y)
        bottom = min(v.co.z for v in me.vertices)
        sc = 1.0
        if top - ztop + bottom > gz - 0.05:     # deep stream: make stone taller
            sc = (top - gz + 0.05) / (ztop - bottom)
        M = T((p.x, p.y, top - ztop * sc)) @ rot("Z", rng.uniform(0, 360)) @ Matrix.Diagonal((1, 1, sc, 1))
        ob = add_obj(f"PathStone_{j:02d}", me, C_PATH, M)
        if math.hypot(p.x, p.y) < 1.05:
            PUSHED_STONES.append((ob, M.copy(), Vector((p.x, p.y, 0))))
    # extra rocks around the path
    for j in range(70):
        x, y = rng.uniform(-14, 14), rng.uniform(-16, 12)
        dp = abs(x - path_x(clamp(y, -13, 1)))
        if dp < 0.9 or math.hypot(x, y) < 2.2:
            continue
        s = rng.uniform(0.15, 0.7) * (1.0 if dp > 2 else 0.6)
        me = rock_mesh(f"Rock_{j:02d}", (s * rng.uniform(0.8, 1.4), s, s * 0.6), 100 + j, flatten=0.7)
        add_obj(f"Rock_{j:02d}", me, C_ENV, T((x, y, ground_h(x, y) - s * 0.15)) @ rot("Z", rng.uniform(0, 360)))


# -------------------------------------------------------------------- forest
def trunk_mesh(name, H, r0, lean, seed):
    def b(bm):
        prof = [(0.0, H + 0.3)]
        for i in range(16, -1, -1):
            z = H * (i / 16) ** 1.4 - 0.4
            r = r0 * (1 - 0.55 * max(z, 0) / H) + r0 * 0.9 * math.exp(-max(z, 0) / 0.45)
            prof.append((r, z))
        prof.append((0.0, -0.6))
        off = Vector((seed, seed * 2, 0))

        def jit(a, z):
            return 0.12 * noise.noise(Vector((math.cos(a) * 2, math.sin(a) * 2, z * 0.4)) + off) + \
                (0.25 * math.exp(-max(z, 0) / 0.5) * max(0, math.sin(5 * a + seed)))
        tmp = bmesh.new()
        revolve(tmp, prof, seg=14, jitter=jit)
        for v in tmp.verts:
            v.co.x += lean * (max(v.co.z, 0) / H) ** 2 * H * 0.08
        merge_into(bm, tmp, 0)
        r2 = random.Random(seed)
        for k in range(r2.randint(2, 4)):     # a few big branches
            h = r2.uniform(0.45, 0.8) * H
            a = r2.uniform(0, 2 * math.pi)
            base = Vector((lean * (h / H) ** 2 * H * 0.08, 0, h))
            tip = base + Vector((math.cos(a) * 3.5, math.sin(a) * 3.5, r2.uniform(1.5, 3.5)))
            bm_cone(bm, base, tip, r0 * 0.35, seg=7)
    return simple_mesh(name, b, [MAT["bark"]])


def blob_mesh(name, r, seed, mat):
    def b(bm):
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=3, radius=1.0)
        off = Vector((seed, seed * 0.3, seed * 0.7))
        for v in tmp.verts:
            v.co = v.co * (1 + 0.28 * noise.noise(v.co * 1.8 + off))
            v.co = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
        merge_into(bm, tmp, 0)
    return simple_mesh(name, b, [MAT[mat]])


def fern_mesh(name, seed):
    r2 = random.Random(seed)

    def b(bm):
        for k in range(8):
            ang = 2 * math.pi * k / 8 + r2.uniform(-0.3, 0.3)
            L = r2.uniform(0.55, 0.95)
            ca, sa = math.cos(ang), math.sin(ang)
            perp = Vector((-sa, ca, 0))
            prev = None
            for s in range(9):
                t = s / 8
                d = t * L
                h = L * 0.6 * math.sin(math.pi * t * 0.8) - 0.15 * t * t
                w = 0.10 * math.sin(math.pi * min(t * 1.05, 1.0)) + 0.004
                c = Vector((ca * d, sa * d, h))
                a, bb = bm.verts.new(c - perp * w), bm.verts.new(c + perp * w)
                if prev:
                    bm.faces.new((prev[0], prev[1], bb, a))
                prev = (a, bb)
    me = simple_mesh(name, b, [MAT["fern"]])
    return me


CAMERA_KEEP_OUT = []   # filled from camera paths before scattering


def far_from_cams(x, y, r):
    return all(math.hypot(x - cx, y - cy) > r for cx, cy in CAMERA_KEEP_OUT)


def build_forest():
    trunks = [trunk_mesh(f"TreeTrunk_{i}", rng.uniform(17, 24), rng.uniform(0.3, 0.55), rng.uniform(-1, 1), i) for i in range(6)]
    blobs = [blob_mesh(f"Canopy_{i}", (rng.uniform(2.5, 4), rng.uniform(2.5, 4), rng.uniform(1.5, 2.2)), i, "leaf") for i in range(4)]
    placed = []
    tries = 0
    while len(placed) < 150 and tries < 6000:
        tries += 1
        x, y = rng.uniform(-30, 30), rng.uniform(-28, 30)
        yy = clamp(y, -13, 1)
        if math.hypot(x - path_x(yy), y - yy) < 2.1 or math.hypot(x, y) < 4.2:
            continue
        if abs(y - stream_y(x)) < 1.4 or not far_from_cams(x, y, 1.6):
            continue
        if any(math.hypot(x - px, y - py) < 2.6 for px, py in placed):
            continue
        placed.append((x, y))
        s = rng.uniform(0.75, 1.3)
        me = trunks[len(placed) % len(trunks)]
        M = T((x, y, ground_h(x, y))) @ rot("Z", rng.uniform(0, 360)) @ Matrix.Scale(s, 4)
        add_obj(f"Tree_{len(placed):03d}", me, C_ENV, M)
        if rng.random() < 0.45:
            for c in range(rng.randint(1, 3)):
                h = rng.uniform(13, 22)
                cp = Vector((x + rng.uniform(-3, 3), y + rng.uniform(-3, 3), ground_h(x, y) + h))
                add_obj(f"Canopy_{len(placed):03d}_{c}", blobs[rng.randrange(4)], C_ENV,
                        T(cp) @ rot("Z", rng.uniform(0, 360)) @ Matrix.Scale(rng.uniform(0.8, 1.4), 4))
    ferns = [fern_mesh(f"Fern_{i}", i) for i in range(4)]
    bushes = [blob_mesh(f"Bush_{i}", (0.7, 0.6, 0.45), 50 + i, "bush") for i in range(3)]
    n = 0
    for k in range(900):
        x, y = rng.uniform(-18, 18), rng.uniform(-18, 14)
        yy = clamp(y, -13, 1)
        dp = math.hypot(x - path_x(yy), y - yy)
        if dp < 0.75 or math.hypot(x, y) < 1.9 or abs(y - stream_y(x)) < 0.7:
            continue
        if not far_from_cams(x, y, 0.6) or rng.random() > clamp((dp - 0.5) / 2.0, 0.25, 1.0):
            continue
        n += 1
        if rng.random() < 0.82:
            M = T((x, y, ground_h(x, y) - 0.03)) @ rot("Z", rng.uniform(0, 360)) @ Matrix.Scale(rng.uniform(0.6, 1.3), 4)
            add_obj(f"Fern_{n:03d}", ferns[n % 4], C_ENV, M)
        else:
            M = T((x, y, ground_h(x, y) + 0.05)) @ rot("Z", rng.uniform(0, 360)) @ Matrix.Scale(rng.uniform(0.6, 1.5), 4)
            add_obj(f"Bush_{n:03d}", bushes[n % 3], C_ENV, M)
    # fallen logs
    for k, (x, y, a, L) in enumerate([(-4.5, -2.0, 20, 5.0), (5.5, -8.0, 75, 6.0), (3.8, 3.5, -30, 4.5), (-6.0, -10.0, 110, 5.5)]):
        me = simple_mesh(f"Log_{k}", lambda bm, L=L: bm_capsule(bm, L, 0.32, 0.26, xform=rot("Y", 90) @ T((0, 0, L / 2))), [MAT["bark"]])
        add_obj(f"FallenLog_{k}", me, C_ENV, T((x, y, ground_h(x, y) + 0.18)) @ rot("Z", a))
    # small mushroom clusters near the egg (fairy-tale hint)
    mush = simple_mesh("Mushroom", lambda bm: (
        revolve(bm, [(0, 0.11), (0.05, 0.1), (0.065, 0.075), (0.02, 0.07), (0, 0.07)], seg=12, mat=1),
        bm_capsule(bm, 0.07, 0.012, 0.016, mat=0, xform=T((0, 0, 0.075)), seg=8)), [MAT["mush_stem"], MAT["mush"]])
    for k in range(14):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(1.6, 2.6)
        x, y = math.cos(a) * r, math.sin(a) * r
        if y < -0.8 and abs(x) < 1.0:
            continue
        add_obj(f"Mushroom_{k:02d}", mush, C_ENV, T((x, y, ground_h(x, y) - 0.01)) @ rot("Z", rng.uniform(0, 360)) @ Matrix.Scale(rng.uniform(0.7, 1.6), 4))


# ======================================================================= EGG
def egg_profile(n=28):
    prof = []
    for i in range(n + 1):
        th = math.pi * i / n
        z = EGG_A * math.cos(th)
        r = EGG_B * math.sin(th) * (1 - 0.1 * z / EGG_A)
        prof.append((0.0 if i in (0, n) else r, z))
    return prof


def egg_center_z(f):
    return EGG_RISE(f)


EGG_RISE = Track([(1, EGG_Z0), (250, EGG_Z0), (262, EGG_Z0 + 0.12), (272, EGG_Z0 + 0.14), (286, EGG_Z0 + 0.5),
                  (294, EGG_Z0 + 0.55), (312, EGG_Z0 + 1.05), (322, EGG_Z0 + 1.22), (336, EGG_Z1)], "smooth")


def shake_env(f, events):
    return sum(a * math.exp(-(f - f0) / tau) for f0, a, tau in events if f >= f0)


EGG_SHAKE_EVENTS = [(184, 0.4, 6), (250, 1.0, 10), (262, 0.6, 8), (286, 1.0, 10), (312, 1.0, 12),
                    (322, 0.8, 8), (336, 0.6, 10), (318, 0.5, 6), (340, 0.5, 6), (352, 0.7, 6), (361, 0.9, 5), (367, 1.2, 5)]


def egg_matrix(f):
    s = shake_env(f, EGG_SHAKE_EVENTS)
    s += 0.35 * ramp(f, 250, 262) * (1 - ramp(f, 330, 345))
    tx = 3.5 * s * nz(f * 0.55, 1)
    ty = 3.5 * s * nz(f * 0.55, 2)
    jx = 0.012 * s * nz(f * 0.7, 3)
    jy = 0.012 * s * nz(f * 0.7, 4)
    return T((jx, jy, egg_center_z(f))) @ rot("X", tx) @ rot("Y", ty)


FRAGS = []      # dicts: ob, c (local centroid), n, kind, sim


def build_egg():
    bm = bmesh.new()
    revolve(bm, egg_profile(32), seg=44)
    bm.faces.index_update()
    bm.faces.ensure_lookup_table()
    # fracture seeds: Fibonacci directions + a cluster under the foot
    seeds = []
    N = 34
    for i in range(N):
        zz = 1 - 2 * (i + 0.5) / N
        r = math.sqrt(1 - zz * zz)
        a = i * math.pi * (3 - math.sqrt(5)) + rng.uniform(-0.2, 0.2)
        if zz > 0.86:
            continue
        seeds.append((Vector((r * math.cos(a), r * math.sin(a), zz)).normalized(), "shell"))
    seeds.append((Vector((0.07, 0, 1)).normalized(), "hole"))
    for k in range(5):
        a = 2 * math.pi * k / 5
        seeds.append((Vector((0.07 + 0.22 * math.cos(a), 0.22 * math.sin(a), 1)).normalized(), "hole"))
    for k in range(7):
        a = 2 * math.pi * k / 7 + 0.3
        seeds.append((Vector((0.5 * math.cos(a), 0.5 * math.sin(a), 0.85)).normalized(), "shell"))
    groups = [[] for _ in seeds]
    for fc in bm.faces:
        c = fc.calc_center_median()
        u = Vector((c.x / EGG_B, c.y / EGG_B, c.z / EGG_A))
        u.normalize()
        best, bd = 0, 9
        for si, (s, kind) in enumerate(seeds):
            d = (u - s).length + 0.06 * noise.noise(u * 6.0)
            if kind == "hole":
                d *= 1.25
            if d < bd:
                best, bd = si, d
        groups[best].append(fc.index)
    for si, faces in enumerate(groups):
        if not faces:
            continue
        sub = bm.copy()
        sub.faces.index_update()
        sub.faces.ensure_lookup_table()
        keep = set(faces)
        bmesh.ops.delete(sub, geom=[f for f in sub.faces if f.index not in keep], context="FACES")
        cen = sum((v.co for v in sub.verts), Vector()) / len(sub.verts)
        lay = sub.verts.layers.float_vector.new("eggco") if hasattr(sub.verts.layers, "float_vector") else None
        for v in sub.verts:
            if lay is not None:
                v[lay] = v.co.copy()
            v.co -= cen
        me = finish_mesh(f"EggShard_{si:02d}", sub, [MAT["egg"], MAT["egg_in"]])
        if lay is None:
            at = me.attributes.new("eggco", "FLOAT_VECTOR", "POINT")
            at.data.foreach_set("vector", [c for v in me.vertices for c in (v.co + cen)])
        nrm = []
        for v in me.vertices:
            q = v.co + cen
            nrm.append(Vector((q.x / EGG_B ** 2, q.y / EGG_B ** 2, q.z / EGG_A ** 2)).normalized())
        me.normals_split_custom_set_from_vertices(nrm)
        ob = add_obj(f"EggShard_{si:02d}", me, C_EGG)
        mod = ob.modifiers.new("Shell", "SOLIDIFY")
        mod.thickness = 0.035
        mod.offset = -1
        mod.use_rim = True
        mod.material_offset = 1
        mod.material_offset_rim = 1
        mod.use_even_offset = True
        kind = seeds[si][1]
        z = seeds[si][0].z
        n = Vector((cen.x, cen.y, 0))
        n = n.normalized() if n.length > 1e-4 else Vector((1, 0, 0))
        if kind == "shell":
            cam_side = n.dot(Vector((0.46, -0.89, 0))) > 0.25 or n.y < -0.3
            if z < -0.6:
                kind = "cup"
            elif z < -0.3:
                kind = "front" if cam_side else "rim"
            else:
                kind = "fly"
        FRAGS.append(dict(ob=ob, c=cen, n=n, kind=kind, seed=si, z=z))
    bm.free()
    glow = simple_mesh("EggGlow", lambda b: revolve(b, egg_profile(20), seg=24, xform=Matrix.Scale(0.9, 4)), [MAT["glow"]])
    return add_obj("EggInnerGlow", glow, C_EGG)


def debris_sim(M0, v, w, f0, rest, fend=FRAME_END, bounce=0.25, settle_floor=None):
    """Ballistic tumble with ground contact. Returns {frame: Matrix}."""
    pos = M0.translation.copy()
    q = M0.to_quaternion()
    sca = M0.to_scale()
    out = {f0: M0.copy()}
    sub = 4
    dt = 1.0 / FPS / sub
    resting = False
    for f in range(f0 + 1, fend + 1):
        for _ in range(sub):
            if resting:
                break
            v.z -= 9.81 * dt
            pos += v * dt
            if w.length > 1e-6:
                q = Quaternion(w.normalized(), w.length * dt) @ q
            gz = (settle_floor(pos) if settle_floor else ground_h(pos.x, pos.y)) + rest
            if pos.z < gz:
                pos.z = gz
                if v.z < 0:
                    v.z = -v.z * bounce
                v.x *= 0.55
                v.y *= 0.55
                w *= 0.55
                if v.length < 0.25:
                    resting = True
        out[f] = Matrix.LocRotScale(pos.copy(), q.copy(), sca)
    return out


# ================================================================== PERSON
# segment lengths
THIGH, SHIN, UPARM, FOREARM = 0.44, 0.42, 0.29, 0.26
HIP_W, SHOULDER_W, PELVIS_TO_HIP, SPINE = 0.095, 0.185, 0.06, 0.48


def build_person():
    P = {}

    def mk(name, builder, mats):
        P[name] = add_obj("Person_" + name, simple_mesh("Person_" + name, builder, mats), C_PERSON)

    mk("Pelvis", lambda bm: bm_ellipsoid(bm, (0.165, 0.11, 0.13)), [MAT["pants"]])

    def chest(bm):
        revolve(bm, [(0, 0.5), (0.12, 0.49), (0.175, 0.44), (0.19, 0.36), (0.165, 0.2), (0.155, 0.06), (0.0, 0.02)],
                seg=18, xform=Matrix.Diagonal((1.0, 0.64, 1.0, 1.0)))
        revolve(bm, [(0, 0.53), (0.07, 0.52), (0.085, 0.46), (0.06, 0.44), (0, 0.44)], seg=14)   # collar
    mk("Chest", chest, [MAT["jacket"], MAT["bag"]])
    mk("Neck", lambda bm: bm_capsule(bm, 0.07, 0.048, 0.048), [MAT["skin"]])

    def head(bm):
        bm_ellipsoid(bm, (0.082, 0.098, 0.112))
        bm_ellipsoid(bm, (0.09, 0.104, 0.1), (0, -0.02, 0.03), mat=1)
        bm_ellipsoid(bm, (0.086, 0.06, 0.07), (0, -0.05, -0.03), mat=1)
        bm_ellipsoid(bm, (0.014, 0.022, 0.028), (0, 0.098, -0.01))                     # nose
        for s in (-1, 1):
            bm_ellipsoid(bm, (0.012, 0.025, 0.03), (s * 0.08, -0.005, 0.0))            # ears
            bm_ellipsoid(bm, (0.012, 0.008, 0.009), (s * 0.032, 0.088, 0.022), mat=2)  # eyes
            bm_ellipsoid(bm, (0.022, 0.006, 0.005), (s * 0.033, 0.09, 0.042), mat=1)   # brows
    mk("Head", head, [MAT["skin"], MAT["hair"], MAT["dark"]])
    for s in ("L", "R"):
        mk("UpperArm_" + s, lambda bm: bm_capsule(bm, UPARM, 0.058, 0.046), [MAT["jacket"]])
        mk("Forearm_" + s, lambda bm: bm_capsule(bm, FOREARM, 0.046, 0.036), [MAT["jacket"]])

        def hand(bm):
            bm_ellipsoid(bm, (0.042, 0.022, 0.075), (0, 0, -0.08))
            bm_ellipsoid(bm, (0.012, 0.012, 0.035), (0.035, 0.01, -0.05))
        mk("Hand_" + s, hand, [MAT["skin"]])
        mk("Thigh_" + s, lambda bm: bm_capsule(bm, THIGH, 0.078, 0.056), [MAT["pants"]])
        mk("Shin_" + s, lambda bm: bm_capsule(bm, SHIN, 0.056, 0.045), [MAT["pants"]])

        def boot(bm):
            bm_ellipsoid(bm, (0.054, 0.128, 0.05), (0, 0.06, -0.038))
            revolve(bm, [(0, 0.1), (0.056, 0.1), (0.058, -0.02), (0.0, -0.03)], seg=14)
        mk("Boot_" + s, boot, [MAT["boots"]])
    return P


# --------------------------------------------------------------- walk cycle
FF = sorted(footfalls, key=lambda d: d["frame"])
SWING = 10


def foot_keys_from_walk(side):
    keys = []
    mine = [d for d in FF if d["side"] == side]
    for j, d in enumerate(mine):
        t, A = d["frame"], d["ankle"]
        arc = 0.13 + max(0.0, A.z - (mine[j - 1]["ankle"].z if j else A.z))
        keys.append((t, A, 10.0, d["fwd"], arc if j else 0.0))
        keys.append((t + 3, A, 0.0, d["fwd"], 0.0))
        if j + 1 < len(mine):
            lift = mine[j + 1]["frame"] - SWING
            keys.append((lift - 4, A, 0.0, d["fwd"], 0.0))
            keys.append((lift, A, -24.0, d["fwd"], 0.0))
    return keys


def walk_pelvis_keys():
    keys = []
    ext = FF + [dict(frame=LAND_EGG + STEP_T, side="L", ankle=Vector((0.0, 0.62, EGG_TOP0 + 0.1)), fwd=Vector((0, 1, 0)))]
    for j in range(1, len(ext)):
        a, b = ext[j - 1]["ankle"], ext[j]["ankle"]
        m = (a + b) / 2
        keys.append((ext[j]["frame"], Vector((m.x, m.y, (a.z + b.z) / 2 + 0.845))))
        if j + 1 < len(ext):
            c = ext[j + 1]["ankle"]
            mm = ((a + b) / 2 + (b + c) / 2) / 2
            side = 1 if ext[j]["side"] == "R" else -1
            fwd = (c - a).normalized()
            right = Vector((fwd.y, -fwd.x, 0)).normalized()
            p = Vector((mm.x, mm.y, b.z + 0.885)) + right * (0.022 * side)
            keys.append((ext[j]["frame"] + STEP_T / 2, p))
    return keys


WALK_PELVIS = Track(walk_pelvis_keys(), "spline")


def walk_fwd(f):
    a, b = WALK_PELVIS(f - 6), WALK_PELVIS(f + 6)
    d = Vector((b.x - a.x, b.y - a.y, 0))
    return d.normalized() if d.length > 1e-4 else Vector((0, 1, 0))


def gpt(x, y, dz=ANKLE_H):
    return Vector((x, y, ground_h(x, y) + dz))


def yaw_vec(deg):
    a = math.radians(deg)
    return Vector((math.sin(a), math.cos(a), 0))


ER = FF[-1]["ankle"].copy()                 # right ankle on the egg-stone
LST = FF[-2]["ankle"].copy()                # left ankle on the last stone
F_FWD = Vector((0, 1, 0))
R_BACK1 = gpt(0.13, -0.88)
L_BACK1 = gpt(-0.14, -1.42)
R_STAND = gpt(0.15, -1.86)
L_FLINCH = gpt(-0.17, -1.98)
R_KNEEL = gpt(0.14, -1.14)
L_PRE = gpt(-0.15, -1.62)
L_KNEEL = gpt(-0.13, -1.78, 0.08)
R_KNEEL2 = gpt(0.13, -1.76, 0.08)

FOOT_KEYS = {
    "R": [k for k in foot_keys_from_walk("R") if k[0] <= LAND_EGG] + [
        (184, ER, 0.0, F_FWD, 0.0),
        (191, ER + Vector((0, 0.04, -0.42)), 8.0, F_FWD, 0.0),
        (210, ER + Vector((0.01, 0.03, -0.40)), 5.0, F_FWD, 0.0),
        (220, ER + Vector((0, -0.06, 0.10)), -15.0, F_FWD, 0.0),
        (230, R_BACK1, 0.0, F_FWD, 0.06),
        (244, R_BACK1, -20.0, F_FWD, 0.0),
        (258, R_STAND, 0.0, yaw_vec(12), 0.1),
        (484, R_STAND, 0.0, yaw_vec(12), 0.0),
        (488, R_STAND, -20.0, yaw_vec(12), 0.0),
        (500, R_KNEEL, 6.0, F_FWD, 0.12),
        (505, R_KNEEL, 0.0, F_FWD, 0.0),
        (645, R_KNEEL, 0.0, F_FWD, 0.0),
        (651, R_KNEEL, -20.0, F_FWD, 0.0),
        (668, R_KNEEL2, -62.0, F_FWD, 0.06),
    ],
    "L": [k for k in foot_keys_from_walk("L") if k[0] <= LAND_EGG] + [
        (186, LST, -26.0, F_FWD, 0.0),
        (212, LST, -12.0, F_FWD, 0.0),
        (226, LST, -22.0, F_FWD, 0.0),
        (243, L_BACK1, 0.0, yaw_vec(-8), 0.1),
        (372, L_BACK1, 0.0, yaw_vec(-8), 0.0),
        (384, L_FLINCH, 0.0, yaw_vec(-15), 0.06),
        (500, L_FLINCH, 0.0, yaw_vec(-15), 0.0),
        (504, L_FLINCH, -20.0, yaw_vec(-15), 0.0),
        (516, L_PRE, 0.0, F_FWD, 0.1),
        (522, L_PRE, -10.0, F_FWD, 0.0),
        (552, L_KNEEL, -62.0, F_FWD, 0.03),
    ],
}


def foot_state(side, f):
    k = FOOT_KEYS[side]
    if f <= k[0][0]:
        i, t = 0, 0.0
    elif f >= k[-1][0]:
        i, t = len(k) - 2, 1.0
    else:
        i = 0
        while not (k[i][0] <= f <= k[i + 1][0]):
            i += 1
        t = (f - k[i][0]) / (k[i + 1][0] - k[i][0])
    a, b = k[i], k[i + 1]
    s = smooth(t)
    pos = a[1].lerp(b[1], s)
    pos.z += b[4] * math.sin(math.pi * t)
    pitch = lerp(a[2], b[2], s)
    fwd = a[3].lerp(b[3], s).normalized()
    # heel lift: rotate about the toe
    if pitch < 0:
        p = math.radians(pitch)
        toe = pos + fwd * 0.15 - UP * 0.07
        y = fwd * math.cos(p) + UP * math.sin(p)
        z = UP * math.cos(p) - fwd * math.sin(p)
        pos = toe - y * 0.15 + z * 0.07
    return pos, fwd, pitch


# --- pelvis / spine after the walk
PEL = Track([
    (184, WALK_PELVIS(184)),
    (191, WALK_PELVIS(184) + Vector((0, 0.10, -0.33))),
    (197, WALK_PELVIS(184) + Vector((0.01, 0.08, -0.37))),
    (204, WALK_PELVIS(184) + Vector((0.0, 0.05, -0.31))),
    (212, WALK_PELVIS(184) + Vector((-0.01, 0.02, -0.34))),
    (222, Vector((-0.04, -0.42, G0 + 0.93))),
    (232, Vector((-0.03, -0.72, G0 + 0.95))),
    (245, Vector((-0.02, -1.13, G0 + 0.95))),
    (259, Vector((0.0, -1.62, G0 + 0.95))),
    (275, Vector((0.0, -1.65, G0 + 0.9))),
    (330, Vector((0.0, -1.64, G0 + 0.91))),
    (366, Vector((0.0, -1.58, G0 + 0.93))),
    (380, Vector((-0.02, -1.84, G0 + 0.9))),
    (392, Vector((-0.02, -1.9, G0 + 0.93))),
    (484, Vector((-0.01, -1.9, G0 + 0.94))),
    (500, Vector((0.0, -1.52, G0 + 0.94))),
    (518, Vector((0.0, -1.42, G0 + 0.93))),
    (552, Vector((0.0, -1.47, G0 + 0.585))),
    (620, Vector((0.0, -1.46, G0 + 0.6))),
    (645, Vector((0.0, -1.46, G0 + 0.6))),
    (668, Vector((0.0, -1.42, G0 + 0.57))),
    (720, Vector((0.0, -1.42, G0 + 0.575))),
], "smooth")

YAW = Track([(184, math.degrees(math.atan2(walk_fwd(184).x, walk_fwd(184).y))), (222, 0.0), (720, 0.0)])
LEAN = Track([(1, 9.0), (184, 9.0), (191, 32.0), (212, 26.0), (228, 6.0), (258, -3.0), (300, -9.0), (336, -6.0),
              (366, 6.0), (372, 4.0), (380, -18.0), (402, -9.0), (440, 0.0), (482, 6.0), (520, 6.0), (552, 12.0),
              (592, 17.0), (640, 14.0), (668, 10.0), (695, 18.0), (720, 20.0)])


def walk_lean_sway(f):
    return 1.0 - ramp(f, 182, 190)


def person_pelvis(f):
    if f <= 184:
        p = WALK_PELVIS(f)
        fwd = walk_fwd(f)
    else:
        p = PEL(f)
        fwd = yaw_vec(YAW(f))
    # breathing / tremor sway
    p = p + UP * (0.004 * math.sin(f / FPS * 2 * math.pi * 0.3))
    tremor = 0.012 * ramp(f, 250, 258) * (1 - ramp(f, 330, 345))
    p = p + Vector((nz(f * 0.4, 11), nz(f * 0.4, 12), 0)) * tremor
    return p, fwd


PB = {}


def person_body(f):
    if f in PB:
        return PB[f]
    p, fwd = person_pelvis(f)
    right = Vector((fwd.y, -fwd.x, 0)).normalized()
    feet = {s: foot_state(s, f) for s in ("L", "R")}
    # keep stance feet reachable: lower the pelvis if needed
    for s, sg in (("L", -1), ("R", 1)):
        A = feet[s][0]
        hip = p + right * (HIP_W * sg) - UP * PELVIS_TO_HIP
        dxy = math.hypot(hip.x - A.x, hip.y - A.y)
        reach = (THIGH + SHIN) * 0.985
        if dxy < reach:
            zmax = A.z + math.sqrt(reach * reach - dxy * dxy)
            if hip.z > zmax:
                p.z -= hip.z - zmax
    # spine: lean forward, walk counter-twist
    w = walk_lean_sway(f)
    phase = 0.0
    if f < 190:
        rd = feet["R"][0] - p
        phase = rd.dot(fwd)
    twist = -18.0 * phase * w
    lean = LEAN(f)
    chest_rot = rot(right, -lean) @ rot(UP, twist)
    cf = (chest_rot.to_3x3() @ fwd).normalized()
    cu = (chest_rot.to_3x3() @ UP).normalized()
    cr = cf.cross(cu).normalized()
    pel_m = basis(right, fwd, UP, p)
    sh = p + cu * SPINE
    neck = sh + cu * 0.03
    B = dict(p=p, fwd=fwd, right=right, feet=feet, cf=cf, cu=cu, cr=cr, pel_m=pel_m, sh=sh, neck=neck,
             chest_m=basis(cr, cf, cu, p),
             shoulder={"L": sh - cr * SHOULDER_W - cu * 0.03, "R": sh + cr * SHOULDER_W - cu * 0.03},
             hip={"L": p - right * HIP_W - UP * PELVIS_TO_HIP, "R": p + right * HIP_W - UP * PELVIS_TO_HIP})
    B["head_c"] = neck + cu * 0.13
    # legs (IK)
    B["knee"], B["ankle"] = {}, {}
    for s in ("L", "R"):
        A, ffwd, pitch = feet[s]
        pole = fwd * 1.0 + UP * 0.1
        if s == "L" and f > 520:
            pole = fwd * 1.0 - UP * 0.6 * ramp(f, 520, 552)
        if s == "R" and f > 645:
            pole = fwd * 1.0 - UP * 0.6 * ramp(f, 645, 668)
        k, a = ik2(B["hip"][s], A, THIGH, SHIN, pole)
        B["knee"][s], B["ankle"][s] = k, a
    PB[f] = B
    return B


# ================================================================== DRAGON
D_ANCH = {"FL": Vector((-0.12, 0.2, -0.07)), "FR": Vector((0.12, 0.2, -0.07)),
          "RL": Vector((-0.13, -0.2, -0.05)), "RR": Vector((0.13, -0.2, -0.05))}
D_LEG = {"F": (0.17, 0.16), "R": (0.18, 0.17)}
N_NECK, N_TAIL = 8, 11


def build_dragon():
    D = {}

    def mk(name, builder, mats):
        D[name] = add_obj("Dragon_" + name, simple_mesh("Dragon_" + name, builder, mats), C_DRAGON)
        return D[name]

    def chest(bm):
        bm_ellipsoid(bm, (0.19, 0.25, 0.19))
        for y in (-0.12, -0.02, 0.08):
            bm_cone(bm, Vector((0, y, 0.16)), Vector((0, y - 0.04, 0.25)), 0.03, mat=1)
    mk("Chest", chest, [MAT["scales"], MAT["horn"]])

    def hips(bm):
        bm_ellipsoid(bm, (0.17, 0.21, 0.165))
        for y in (-0.08, 0.04):
            bm_cone(bm, Vector((0, y, 0.14)), Vector((0, y - 0.04, 0.215)), 0.026, mat=1)
    mk("Hips", hips, [MAT["scales"], MAT["horn"]])
    for i in range(N_NECK):
        r = lerp(0.105, 0.068, i / (N_NECK - 1))

        def nb(bm, r=r):
            bm_ellipsoid(bm, (r, r * 1.05, r))
            bm_cone(bm, Vector((0, 0, r * 0.8)), Vector((0, -0.03, r + 0.04)), 0.018, mat=1)
        mk(f"Neck_{i}", nb, [MAT["scales"], MAT["horn"]])

    def head(bm):
        bm_ellipsoid(bm, (0.1, 0.12, 0.092))
        bm_ellipsoid(bm, (0.07, 0.12, 0.052), (0, 0.14, -0.022))
        bm_ellipsoid(bm, (0.05, 0.09, 0.016), (0, 0.12, -0.05), mat=2)
        for s in (-1, 1):
            bm_ellipsoid(bm, (0.035, 0.035, 0.018), (s * 0.05, 0.07, 0.065))
            bm_cone(bm, Vector((s * 0.05, -0.05, 0.06)), Vector((s * 0.09, -0.17, 0.12)), 0.026, mat=1)
            bm_ellipsoid(bm, (0.008, 0.06, 0.035), (s * 0.095, -0.06, 0.015),
                         xform=None)
            bm_ellipsoid(bm, (0.01, 0.01, 0.008), (s * 0.026, 0.25, 0.006), mat=3)
        bm_cone(bm, Vector((0, -0.02, 0.08)), Vector((0, -0.09, 0.13)), 0.02, mat=1)
    mk("Head", head, [MAT["scales"], MAT["horn"], MAT["mouth"], MAT["dark"]])
    mk("Jaw", lambda bm: bm_ellipsoid(bm, (0.06, 0.12, 0.026), (0, 0.11, -0.012)), [MAT["scales"]])
    for s in ("L", "R"):
        def eye(bm):
            bm_ellipsoid(bm, (0.037, 0.037, 0.037), seg=16, rings=12)
            bm_ellipsoid(bm, (0.007, 0.012, 0.026), (0, 0.032, 0), mat=1)
        mk("Eye_" + s, eye, [MAT["eye"], MAT["dark"]])
    for i in range(N_TAIL):
        r = lerp(0.1, 0.024, i / (N_TAIL - 1))
        mk(f"Tail_{i}", lambda bm, r=r: bm_ellipsoid(bm, (r, r * 1.2, r * 0.95)), [MAT["scales"]])
    mk("TailTip", lambda bm: bm_ellipsoid(bm, (0.06, 0.07, 0.012), (0, 0.04, 0)), [MAT["horn"]])
    for leg in D_ANCH:
        fr = leg[0]
        l1, l2 = D_LEG[fr]
        r0 = 0.06 if fr == "F" else 0.078
        mk("Upper_" + leg, lambda bm, l1=l1, r0=r0: bm_capsule(bm, l1, r0, r0 * 0.75), [MAT["scales"]])
        mk("Lower_" + leg, lambda bm, l2=l2: bm_capsule(bm, l2, 0.042, 0.032), [MAT["scales"]])

        def paw(bm):
            bm_ellipsoid(bm, (0.045, 0.06, 0.028), (0, 0.025, -0.012))
            for x in (-0.025, 0, 0.025):
                bm_cone(bm, Vector((x, 0.07, -0.015)), Vector((x, 0.1, -0.03)), 0.01, mat=1)
        mk("Paw_" + leg, paw, [MAT["scales"], MAT["horn"]])
    for s in ("L", "R"):
        D["Wing_" + s] = build_wing(s)
    return D


def build_wing(side):
    sg = 1 if side == "R" else -1
    J0, J1, J2 = Vector((0, 0, 0)), Vector((0.28, 0.06, 0.1)), Vector((0.5, 0.0, 0.16))
    T1, T2, T3, E = Vector((0.9, 0.08, 0.22)), Vector((0.85, -0.22, 0.08)), Vector((0.62, -0.42, -0.02)), Vector((0.05, -0.32, -0.02))

    def scal(a, b):
        return (a + b) / 2 + (J2 - (a + b) / 2) * 0.28
    bm = bmesh.new()
    pts = [J2, T1, scal(T1, T2), T2, scal(T2, T3), T3, scal(T3, E), E, J0, J1]
    vs = [bm.verts.new(p) for p in pts]
    for i in range(1, len(vs) - 1):
        f = bm.faces.new((vs[0], vs[i], vs[i + 1]))
        f.material_index = 0
    for a, b, r in ((J0, J1, 0.03), (J1, J2, 0.024), (J2, T1, 0.014), (J2, T2, 0.012), (J2, T3, 0.011)):
        bm_capsule(bm, (b - a).length, r, r * 0.7, mat=1, xform=seg_matrix(a, b, Vector((0, 0, 1))), seg=8)
    bm_cone(bm, J2, J2 + Vector((0.02, 0.06, 0.03)), 0.012, mat=2)
    if sg < 0:
        bmesh.ops.transform(bm, matrix=Matrix.Diagonal((-1, 1, 1, 1)), verts=bm.verts)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    me = finish_mesh("Dragon_Wing_" + side, bm, [MAT["membrane"], MAT["scales"], MAT["horn"]])
    ob = add_obj("Dragon_Wing_" + side, me, C_DRAGON)
    ob.shape_key_add(name="Basis")
    fold = ob.shape_key_add(name="Fold")
    for v, kv in zip(me.vertices, fold.data):
        x, y, z = v.co.x * sg, v.co.y, v.co.z
        kv.co = Vector(((0.02 + 0.1 * x) * sg, 0.25 * y - 0.5 * x, 0.45 * z + 0.08 * x))
    return ob


# dragon timeline -----------------------------------------------------------
BURST = 372
GD = G0 + 0.02
D_ROOT = Track([(BURST, Vector((0, 0.05, GD + 0.10))), (396, Vector((0, 0.03, GD + 0.24))),
                (420, Vector((0, 0.0, GD + 0.36))), (575, Vector((0, -0.02, GD + 0.36))),
                (612, Vector((0.0, -0.36, GD + 0.36))), (650, Vector((0, -0.42, GD + 0.37))),
                (690, Vector((0, -0.8, GD + 0.42))), (720, Vector((0, -0.8, GD + 0.42)))])
D_YAW = Track([(BURST, 15.0), (470, 0.0), (530, -90.0), (720, -90.0)])     # 0 = facing +X
D_PITCH = Track([(BURST, -18.0), (400, 8.0), (425, 16.0), (470, 8.0), (600, 4.0), (650, 6.0), (690, 34.0), (720, 34.0)])
D_HEAD_LOCAL = Track([(BURST, Vector((0, 0.25, -0.05))), (384, Vector((0, 0.33, 0.12))), (398, Vector((0, 0.40, 0.58))),
                      (410, Vector((0, 0.43, 0.54))), (430, Vector((0, 0.46, 0.5))), (466, Vector((0.08, 0.46, 0.5))),
                      (560, Vector((0.0, 0.47, 0.48))), (720, Vector((0.0, 0.47, 0.48)))])
D_DIR_LOCAL = Track([(BURST, Vector((0, 0.3, -1))), (384, Vector((0, 0.8, 0.2))), (398, Vector((0, 0.45, 1))),
                     (410, Vector((0, 1, 0.1))), (430, Vector((0, 1, 0.25))), (466, Vector((0.7, 0.7, 0.0))),
                     (720, Vector((0.7, 0.7, 0)))])
D_ROLL = Track([(470, 0.0), (488, 24.0), (505, -8.0), (520, 0.0), (636, 10.0), (660, 12.0), (690, 22.0), (720, 22.0)])
D_JAW = Track([(BURST, 0.0), (393, 0.0), (400, 34.0), (410, 28.0), (417, 0.0), (497, 0.0), (501, 10.0), (507, 0.0)])
D_EYE = Track([(BURST, 0.6), (390, 1.0), (437, 1.0), (440, 0.1), (443, 1.0), (518, 1.0), (521, 0.1), (524, 1.0),
               (625, 1.0), (642, 0.45), (660, 0.4), (674, 0.08), (720, 0.08)])
D_FOLD = Track([(BURST, 1.0), (422, 1.0), (448, 0.0), (470, 0.12), (502, 0.65), (540, 0.85), (700, 1.0)])
D_FLAP = Track([(BURST, 0.0), (422, 0.0), (440, 42.0), (452, -6.0), (462, 30.0), (476, 6.0), (502, 0.0), (690, 0.0),
                (697, 16.0), (704, 0.0), (711, 12.0), (720, 2.0)])
D_TAIL_CURL = Track([(BURST, 26.0), (400, 18.0), (425, 0.0), (660, 0.0), (710, -9.0), (720, -9.0)])
D_WAG = Track([(BURST, 0.0), (420, 1.0), (640, 1.0), (680, 1.8), (720, 1.8)])


def dragon_body_matrix(f):
    R = D_ROOT(f)
    yaw, pitch = D_YAW(f), D_PITCH(f)
    breath = 0.008 * math.sin(f / FPS * 2 * math.pi * 0.5)
    fd = Vector((math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0))
    right = fd.cross(UP).normalized()
    M = basis(right, fd, UP, R + UP * breath)
    return M @ rot("X", pitch)


# person hand scripted helpers ---------------------------------------------
def hang(side, swing=True):
    sg = 1 if side == "R" else -1

    def fn(f):
        B = person_body(f)
        sw = 0.0
        if swing:
            other = B["feet"]["L" if side == "R" else "R"][0]
            sw = clamp((other - B["p"]).dot(B["fwd"]) * 0.5, -0.2, 0.2)
        return B["shoulder"][side] - B["cu"] * 0.5 + B["cf"] * (0.04 + sw) + B["cr"] * (0.05 * sg)
    return fn


def flail(side):
    sg = 1 if side == "R" else -1
    return lambda f: person_body(f)["shoulder"][side] + person_body(f)["cr"] * (0.5 * sg) + UP * 0.06 + person_body(f)["cf"] * 0.1


def balance_low(side):
    sg = 1 if side == "R" else -1
    return lambda f: person_body(f)["shoulder"][side] + person_body(f)["cr"] * (0.3 * sg) - UP * 0.38 + person_body(f)["cf"] * 0.2


def brace_egg(side):
    pt = Vector((0.3, 0.06, EGG_TOP0 + 0.0)) if side == "R" else Vector((-0.26, -0.06, EGG_TOP0 + 0.0))
    return lambda f: pt


def brace(side):
    sg = 1 if side == "R" else -1
    return lambda f: person_body(f)["shoulder"][side] + person_body(f)["cr"] * (0.22 * sg) - UP * 0.42 + person_body(f)["cf"] * 0.08


def reach_egg(f):
    B = person_body(f)
    return B["shoulder"]["R"] + B["cf"] * 0.42 - UP * 0.22 - B["cr"] * 0.05


def shield(f):
    B = person_body(f)
    return B["head_c"] + B["cf"] * 0.26 + UP * 0.02 - B["cr"] * 0.02


def extend_hand(f):
    B = person_body(f)
    return B["shoulder"]["R"] + B["cf"] * 0.46 - UP * 0.24 - B["cr"] * 0.08


def on_knee(side_knee):
    return lambda f: person_body(f)["knee"][side_knee] + UP * 0.07 + person_body(f)["cr"] * -0.02


HAND_R_SCRIPT = ModeTrack([(1, hang("R")), (184, hang("R")), (189, flail("R")), (195, flail("R")), (203, brace_egg("R")), (211, brace_egg("R")),
                           (222, hang("R")), (262, hang("R")), (272, brace("R")), (340, brace("R")), (364, reach_egg),
                           (370, reach_egg), (377, shield), (404, shield), (430, hang("R")), (552, hang("R")),
                           (588, extend_hand), (720, extend_hand)])
HAND_L_SCRIPT = ModeTrack([(1, hang("L")), (184, hang("L")), (189, flail("L")), (195, flail("L")), (203, brace_egg("L")), (211, brace_egg("L")),
                           (222, hang("L")), (262, hang("L")), (272, brace("L")), (372, brace("L")), (380, balance_low("L")),
                           (410, balance_low("L")), (436, hang("L")), (532, hang("L")), (556, on_knee("R")), (720, on_knee("R"))])


DS = {}


def chest_point(f):
    B = person_body(f)
    return B["p"] + B["cu"] * 0.32 + B["cf"] * 0.1


def dragon_state(f):
    if f in DS:
        return DS[f]
    M = dragon_body_matrix(f)
    R3 = M.to_3x3()
    B = person_body(f)

    def head_local(f):
        return dragon_body_matrix(f) @ D_HEAD_LOCAL(f)

    def head_sniff(f):
        h = HAND_R_SCRIPT(f)
        j = 0.012 * math.sin(f * 2.2) * (1 - ramp(f, 600, 608))
        return h + Vector((0.0, 0.2 + j, -0.1))

    def head_under(f):
        return HAND_R_SCRIPT(f) + Vector((0, 0.07, -0.1))

    def head_nuzzle(f):
        Bf = person_body(f)
        return chest_point(f) + Bf["fwd"] * 0.15 - UP * 0.03

    HP = ModeTrack([(1, head_local), (575, head_local), (596, head_sniff), (606, head_sniff), (618, head_under),
                    (652, head_under), (690, head_nuzzle), (720, head_nuzzle)])(f)
    nb = M @ Vector((0, 0.3, 0.1))
    d = HP - nb
    if d.length > 0.62:
        HP = nb + d.normalized() * 0.62

    def dir_local(f):
        return (dragon_body_matrix(f).to_3x3() @ D_DIR_LOCAL(f)).normalized()

    def dir_person(f):
        return (person_body(f)["head_c"] - HP).normalized()

    def dir_hand(f):
        return (HAND_R_SCRIPT(f) - HP).normalized()

    def dir_under(f):
        v = person_body(f)["head_c"] - HP
        v.z = 0
        return (v.normalized() + UP * 0.35).normalized()

    def dir_nuzzle(f):
        return (person_body(f)["cr"] - UP * 0.15).normalized()

    hf = ModeTrack([(1, dir_local), (468, dir_local), (488, dir_person), (578, dir_person), (594, dir_hand),
                    (606, dir_hand), (618, dir_under), (652, dir_under), (688, dir_nuzzle), (720, dir_nuzzle)])(f)
    shake = 0.0
    if 410 <= f <= 428:
        shake = 26.0 * math.sin((f - 410) / 18 * 3 * 2 * math.pi) * math.sin((f - 410) / 18 * math.pi)
    nuzzle = 7.0 * math.sin((f - 675) / 30 * 2 * math.pi) * ramp(f, 675, 690)
    hf = (rot(UP, shake + nuzzle).to_3x3() @ hf).normalized()
    up0 = R3 @ Vector((0, 0, 1))
    Hm = frame_yz(HP, hf, up0 if f < 470 else UP)
    Hm = Hm @ rot("Y", D_ROLL(f) + 0.5 * nuzzle)
    DS[f] = dict(M=M, HP=HP, H=Hm, nb=nb)
    return DS[f]


def hand_on_head(f):
    H = dragon_state(f)["H"]
    stroke = (0.5 - 0.5 * math.cos((f - 618) / 24 * 2 * math.pi)) * (1 - 0.6 * ramp(f, 680, 700))
    return H @ Vector((0.0, 0.07 - 0.11 * stroke, 0.122))


def hand_hug_neck(f):
    D = dragon_state(f)
    Bf = person_body(f)
    neck_mid = D["nb"].lerp(D["HP"], 0.5)
    return neck_mid + Bf["fwd"] * 0.09 - Bf["cr"] * 0.03 + UP * 0.05


HAND_R = ModeTrack([(1, HAND_R_SCRIPT), (606, HAND_R_SCRIPT), (618, hand_on_head), (720, hand_on_head)])
HAND_L = ModeTrack([(1, HAND_L_SCRIPT), (668, HAND_L_SCRIPT), (695, hand_hug_neck), (720, hand_hug_neck)])
PALM_DOWN_W = Track([(1, 0.0), (552, 0.0), (588, 0.6), (606, 0.6), (618, 1.0), (720, 1.0)])
HUG_W = Track([(1, 0.0), (668, 0.0), (695, 1.0), (720, 1.0)])


def look_target(f):
    def ahead(f):
        B = person_body(f)
        q = B["p"] + B["fwd"] * 2.3
        return Vector((q.x, q.y, ground_h(q.x, q.y)))

    def egg_top(f):
        return egg_matrix(f) @ Vector((0, 0, EGG_A * 0.9))

    def foot_r(f):
        return person_body(f)["ankle"]["R"]

    def dragon_head(f):
        return dragon_state(f)["HP"] if f >= BURST else egg_top(f)

    return ModeTrack([(1, ahead), (140, ahead), (172, egg_top), (184, foot_r), (214, foot_r), (232, egg_top),
                      (372, egg_top), (392, dragon_head), (720, dragon_head)])(f)


# =============================================================== CAMERAS
class Shot:
    def __init__(self, name, f0, f1, pos, tgt, lens, fstop, shake_amp=0.004, impacts=()):
        self.name, self.f0, self.f1 = name, f0, f1
        self.pos, self.tgt, self.lens, self.fstop = pos, tgt, lens, fstop
        self.shake_amp, self.impacts = shake_amp, impacts


def pel_smooth(f):
    s = sum((person_body(clamp(f + d, 1, FRAME_END))["p"] for d in range(-6, 7)), Vector()) / 13
    return s


SHOTS = [
    Shot("SH01_Establish_Forest", 1, 96,
         Track([(1, Vector((3.0, -1.6, G0 + 3.4))), (96, Vector((2.15, -2.4, G0 + 1.6)))], "smooth"),
         lambda f: pel_smooth(f) + Vector((0, 0, 0.35 + 0.3 * (1 - ramp(f, 1, 96)))),
         Track([(1, 24.0), (96, 28.0)]), 5.6, 0.004),
    Shot("SH02_POV_Stone_Path", 97, 172,
         lambda f: (lambda P, d: Vector((P.x, P.y, 0)) - d * 1.35 + Vector((d.y, -d.x, 0)) * 0.7
                    + Vector((0, 0, ground_h(P.x, P.y) + 2.2)))(pel_smooth(f), walk_fwd(f)),
         lambda f: (lambda P, d: Vector((P.x, P.y, 0)) + d * 2.3 + Vector((0, 0, ground_h(P.x, P.y) + 0.1)))(pel_smooth(f), walk_fwd(f)),
         Track([(97, 26.0), (172, 26.0)]), 5.6, 0.005),
    Shot("SH03_Foot_Breaks_Shell", 173, 240,
         Track([(173, Vector((2.35, -0.25, G0 + 0.5))), (240, Vector((2.25, -0.3, G0 + 0.58)))]),
         lambda f: Vector((0.0, -0.3, G0 + 0.72)).lerp(Vector((0.0, -0.5, G0 + 0.85)), ramp(f, 205, 238)),
         Track([(173, 24.0), (240, 24.0)]), 4.0, 0.005, impacts=[(184, 0.05, 6), (191, 0.03, 5)]),
    Shot("SH04_Egg_Rises", 241, 340,
         Track([(241, Vector((2.55, 0.1, G0 + 0.62))), (340, Vector((3.2, -0.45, G0 + 1.05)))]),
         lambda f: Vector((-0.1, -0.8, G0 + 0.65)).lerp(Vector((-0.1, -0.55, G0 + 1.05)), ramp(f, 241, 340)),
         Track([(241, 24.0), (340, 24.0)]), 5.6, 0.005,
         impacts=[(250, 0.03, 12), (262, 0.02, 8), (286, 0.03, 10), (312, 0.035, 12), (322, 0.025, 8), (336, 0.02, 10)]),
    Shot("SH05_Hatching", 341, 468,
         Track([(341, Vector((2.25, -3.65, G0 + 0.6))), (468, Vector((1.95, -3.2, G0 + 0.68)))]),
         lambda f: Vector((0.0, 0.0, EGG_Z1 + 0.05)).lerp(Vector((0.15, 0.05, G0 + 0.9)), ramp(f, 380, 440)),
         Track([(341, 30.0), (468, 30.0)]), 5.6, 0.004,
         impacts=[(352, 0.008, 5), (361, 0.01, 5), (367, 0.012, 5), (BURST, 0.05, 10)]),
    Shot("SH06_First_Contact_OTS", 469, 600,
         lambda f: (lambda P: Vector((P.x + 1.0, P.y - 1.6, P.z + 0.82)))(pel_smooth(f)),
         lambda f: dragon_state(f)["HP"].lerp(HAND_R_SCRIPT(f), 0.35 * ramp(f, 560, 595)) - UP * 0.1,
         Track([(469, 32.0), (600, 34.0)]), 4.0, 0.004),
    Shot("SH07_Bond_Embrace", 601, 720,
         Track([(601, Vector((2.25, -0.95, G0 + 0.92))), (650, Vector((2.15, -1.2, G0 + 0.92))),
                (692, Vector((1.95, -0.85, G0 + 1.0))), (720, Vector((2.3, -0.78, G0 + 1.18)))], "spline"),
         lambda f: (person_body(f)["head_c"].lerp(dragon_state(f)["HP"], 0.55)) - UP * 0.08,
         Track([(601, 32.0), (690, 32.0), (720, 30.0)]), 3.2, 0.003),
]


def camera_matrix(sh, f):
    pos = sh.pos(f)
    tgt = sh.tgt(f)
    dist = (tgt - pos).length
    amp = sh.shake_amp + shake_env(f, [(f0, a, tau) for f0, a, tau in sh.impacts])
    hi = shake_env(f, [(f0, a, tau) for f0, a, tau in sh.impacts])
    off = Vector((nz(f * 0.035, 31), nz(f * 0.035, 32), nz(f * 0.035, 33))) * sh.shake_amp * 2.5
    off += Vector((nz(f * 0.9, 41), nz(f * 0.9, 42), nz(f * 0.9, 43))) * hi
    tgt = tgt + Vector((nz(f * 0.03, 51), nz(f * 0.03, 52), nz(f * 0.03, 53))) * amp * dist * 0.6
    pos = pos + off
    z = (pos - tgt).normalized()
    x = UP.cross(z).normalized()
    y = z.cross(x)
    return basis(x, y, z, pos), dist


# ================================================================= LIGHTS
def build_lights():
    sun_d = bpy.data.lights.new("Sun_WarmKey", "SUN")
    sun_d.energy = 4.2
    sun_d.color = (1.0, 0.86, 0.68)
    sun_d.angle = math.radians(2.5)
    sun = bpy.data.objects.new("Sun_WarmKey", sun_d)
    C_LIGHT.objects.link(sun)
    sun.rotation_euler = (math.radians(52), 0, math.radians(200))
    w = bpy.data.worlds.new("ForestSky")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.36, 0.5, 0.55, 1)
    bg.inputs["Strength"].default_value = 0.65
    scene.world = w
    egg_d = bpy.data.lights.new("EggGlow_Light", "POINT")
    egg_d.color = (1.0, 0.55, 0.18)
    egg_d.energy = 0
    egg_d.shadow_soft_size = 0.2
    egg_l = bpy.data.objects.new("EggGlow_Light", egg_d)
    C_LIGHT.objects.link(egg_l)
    egg_l.rotation_mode = "QUATERNION"
    return egg_l


EGG_LIGHT = Track([(1, 0.0), (184, 0.0), (188, 25.0), (200, 6.0), (290, 6.0), (320, 60.0), (340, 90.0), (352, 160.0),
                   (361, 220.0), (367, 320.0), (BURST, 2200.0), (380, 900.0), (410, 150.0), (460, 0.0)])
GLOW = Track([(1, 0.0), (184, 0.0), (188, 3.0), (200, 1.5), (290, 1.5), (340, 6.0), (367, 14.0), (BURST, 25.0), (378, 0.0)])
CRACK = Track([(1, 0.0), (296, 0.0), (318, 0.004), (340, 0.008), (352, 0.012), (361, 0.016), (367, 0.022), (BURST, 0.03)])


# ================================================================== BUILD
def main(out_path):
    # camera keep-out zones for vegetation
    for sh in SHOTS:
        for f in range(sh.f0, sh.f1 + 1, 6):
            p = sh.pos(f)
            CAMERA_KEEP_OUT.append((p.x, p.y))
    build_ground()
    build_stones()
    build_forest()
    glow = build_egg()
    glow.visible_shadow = False
    P = build_person()
    D = build_dragon()
    egg_light = build_lights()

    # crater ring + soil clumps
    crater = add_obj("Egg_SoilCrater", simple_mesh("Egg_SoilCrater", lambda bm: revolve(
        bm, [(0.42, 0.0), (0.5, 0.12), (0.62, 0.17), (0.85, 0.1), (1.15, 0.0), (1.2, -0.1)], seg=36,
        jitter=lambda a, z: 0.1 * noise.noise(Vector((math.cos(a) * 3, math.sin(a) * 3, z)))), [MAT["soil"]]), C_EGG)
    clumps = []
    for k in range(18):
        a = 2 * math.pi * k / 18 + rng.uniform(-0.15, 0.15)
        zl = rng.uniform(0.5, 0.62)
        r = EGG_B * math.sqrt(max(0.0, 1 - (zl / EGG_A) ** 2)) * (1 - 0.1 * zl / EGG_A) + 0.04
        s = rng.uniform(0.06, 0.13)
        me = rock_mesh(f"SoilClump_{k:02d}", (s * 1.3, s, s * 0.8), 300 + k, flatten=0.8, mat="soil" if k % 3 else "stone")
        ob = add_obj(f"SoilClump_{k:02d}", me, C_EGG)
        clumps.append(dict(ob=ob, c=Vector((math.cos(a) * r, math.sin(a) * r, zl)), size=s,
                           detach=int(rng.uniform(258, 318)), n=Vector((math.cos(a), math.sin(a), 0)),
                           q=Quaternion(Vector((rng.random(), rng.random(), rng.random())).normalized(), rng.uniform(0, 6))))

    # ---- precompute debris simulations
    for c in clumps:
        f0 = c["detach"]
        M0 = egg_matrix(f0) @ T(c["c"]) @ c["q"].to_matrix().to_4x4()
        v = c["n"] * rng.uniform(0.5, 1.1) + UP * rng.uniform(0.2, 0.8)
        c["sim"] = debris_sim(M0, v, Vector((rng.uniform(-6, 6), rng.uniform(-6, 6), 0)), f0, c["size"] * 0.4)

    def frag_pre(fr, f):
        gap = CRACK(f) * (0.6 + 0.8 * (0.5 + 0.5 * nz(fr["seed"], 7)))
        return egg_matrix(f) @ T(fr["c"] + fr["n"] * gap + Vector((0, 0, gap * 0.5 * fr["z"])))

    for fr in FRAGS:
        if fr["kind"] in ("fly", "front"):
            M0 = frag_pre(fr, BURST)
            sp = 1.0 if fr["kind"] == "fly" else 0.55
            v = fr["n"] * rng.uniform(0.9, 1.9) * sp + UP * rng.uniform(1.2, 2.6) * sp
            if fr["n"].y < -0.3:
                v.y *= 0.7       # don't hit the person too hard
            w = Vector((rng.uniform(-9, 9), rng.uniform(-9, 9), rng.uniform(-4, 4)))
            fr["sim"] = debris_sim(M0, v, w, BURST, 0.04, bounce=0.2)

    # ---- per-frame animation
    for f in range(1, FRAME_END + 1):
        EM = egg_matrix(f)
        # egg fragments
        for fr in FRAGS:
            ob, k = fr["ob"], fr["kind"]
            if k == "hole":
                s = ramp(f, 184, 191)
                M = EM @ T(fr["c"] + Vector((0, 0, -0.28 * s)) + fr["n"] * 0.04 * s) @ rot(fr["n"].cross(UP).normalized() if fr["n"].length else "X", 70 * s)
                if f >= 194:
                    M = M @ Matrix.Scale(0.0001, 4)
            elif f < BURST or k == "cup":
                M = frag_pre(fr, min(f, BURST))
            elif k == "rim":
                a = 32 * smooth((f - BURST) / 7) - 6 * math.sin(clamp((f - BURST - 7) / 8, 0, 1) * math.pi)
                piv = fr["c"] - Vector((0, 0, 0.18)) - fr["n"] * 0.0
                axis = UP.cross(fr["n"]).normalized()
                M = egg_matrix(BURST) @ T(piv) @ rot(axis, a) @ T(-piv) @ T(fr["c"] + fr["n"] * CRACK(BURST))
            else:
                M = fr["sim"][f]
            KS.matrix(ob, f, M)
        # glow / light
        gs = 1.0 - ramp(f, BURST, BURST + 6)
        KS.matrix(glow, f, EM @ Matrix.Scale(max(gs, 0.0001), 4))
        KS.put(MAT["glow"].node_tree, GLOW_PATH, 0, f, GLOW(f))
        lp = EM.translation + Vector((0, 0, 0.1)) if f < BURST + 10 else dragon_body_matrix(f) @ Vector((0, 0.1, 0.3))
        KS.matrix(egg_light, f, T(lp))
        KS.put(egg_light.data, "energy", 0, f, EGG_LIGHT(f))
        # crater + clumps + pushed stones
        rise = clamp((egg_center_z(f) - EGG_Z0) / (EGG_Z1 - EGG_Z0), 0, 1)
        cz = Matrix.Diagonal((0.85 + 0.15 * rise, 0.85 + 0.15 * rise, max(rise, 0.001), 1.0))
        KS.matrix(crater, f, T((0, 0, G0 - 0.03)) @ cz)
        for c in clumps:
            M = c["sim"][f] if f >= c["detach"] else EM @ T(c["c"]) @ c["q"].to_matrix().to_4x4()
            KS.matrix(c["ob"], f, M)
        for ob, M0, p in PUSHED_STONES:
            d = p.normalized() if p.length > 1e-4 else Vector((0, -1, 0))
            push = 0.35 * smooth(rise * 1.6)
            KS.matrix(ob, f, T(d * push + UP * 0.05 * push) @ M0 @ rot("X", -22 * smooth(rise * 1.6)))

        # ---- person
        B = person_body(f)
        mats = {"Pelvis": B["pel_m"], "Chest": B["chest_m"]}
        look = look_target(f)
        hc = B["head_c"]
        hf = (look - hc)
        hf = (hf.normalized() * 0.85 + B["cf"] * 0.15).normalized()
        hf.z = clamp(hf.z, -0.8, 0.65)
        Hm = frame_yz(hc, hf, B["cu"])
        mats["Head"] = Hm
        mats["Neck"] = seg_matrix(B["neck"] - B["cu"] * 0.04, hc - Hm.to_3x3() @ Vector((0, 0.01, 0.07)), B["cf"])
        for s, sg in (("L", -1), ("R", 1)):
            mats["Thigh_" + s] = seg_matrix(B["hip"][s], B["knee"][s], B["fwd"])
            mats["Shin_" + s] = seg_matrix(B["knee"][s], B["ankle"][s], B["fwd"])
            A, ffwd, pitch = B["feet"][s]
            p = math.radians(pitch)
            yv = ffwd * math.cos(p) + UP * math.sin(p)
            zv = UP * math.cos(p) - ffwd * math.sin(p)
            mats["Boot_" + s] = basis(yv.cross(zv), yv, zv, B["ankle"][s])
            hand_t = (HAND_R if s == "R" else HAND_L)(f)
            pole = -B["cf"] * 1.0 + B["cr"] * (0.4 * sg) - UP * 0.3
            reach_pole = -UP * 1.0 + B["cr"] * (0.7 * sg)
            w = PALM_DOWN_W(f) if s == "R" else HUG_W(f)
            if s == "R":
                w = max(w, ramp(f, 186, 190) * (1 - ramp(f, 205, 222)), ramp(f, 364, 377) * (1 - ramp(f, 404, 430)))
            else:
                w = max(w, ramp(f, 186, 190) * (1 - ramp(f, 205, 222)))
            pole = pole.lerp(reach_pole, w)
            elbow, wrist = ik2(B["shoulder"][s], hand_t, UPARM, FOREARM, pole)
            mats["UpperArm_" + s] = seg_matrix(B["shoulder"][s], elbow, B["cf"])
            mats["Forearm_" + s] = seg_matrix(elbow, wrist, B["cf"])
            fa = (wrist - elbow).normalized()
            hdir, palm = fa, B["cr"] * sg
            if s == "R" and PALM_DOWN_W(f) > 0:
                if f >= 606:
                    Hd = dragon_state(f)["H"].to_3x3()
                    flat = -(Hd @ Vector((0, 1, 0)))
                    ph = Hd @ Vector((0, 0, 1))
                else:
                    flat = Vector((B["cf"].x, B["cf"].y, -0.25)).normalized()
                    ph = UP
                ww = PALM_DOWN_W(f)
                hdir = fa.lerp(flat, ww).normalized()
                palm = palm.lerp(ph, ww)
            mats["Hand_" + s] = seg_matrix(wrist, wrist + hdir, palm)
        for name, M in mats.items():
            KS.matrix(P[name], f, M)

        # ---- dragon
        if f < BURST:
            hidden = T((0, 0.05, EGG_Z0 + 0.3)) @ Matrix.Scale(0.0001, 4)
            for ob in D.values():
                KS.matrix(ob, f, hidden)
            continue
        DS_f = dragon_state(f)
        M, Hm, HP, nb = DS_f["M"], DS_f["H"], DS_f["HP"], DS_f["nb"]
        R3 = M.to_3x3()
        bu = R3 @ Vector((0, 0, 1))
        KS.matrix(D["Chest"], f, M @ T((0, 0.12, 0.02)))
        KS.matrix(D["Hips"], f, M @ T((0, -0.17, 0.0)))
        hf = Hm.to_3x3() @ Vector((0, 1, 0))
        hu = Hm.to_3x3() @ Vector((0, 0, 1))
        p0, p3 = nb, HP - hf * 0.09 - hu * 0.03
        p1 = nb + (R3 @ Vector((0, 0.45, 0.9))).normalized() * 0.2
        p2 = p3 - hf * 0.16 - hu * 0.05
        prev = None
        for i in range(N_NECK):
            t = i / (N_NECK - 1)
            q = p0 * (1 - t) ** 3 + p1 * 3 * (1 - t) ** 2 * t + p2 * 3 * (1 - t) * t * t + p3 * t ** 3
            tan = (p1 - p0) * 3 * (1 - t) ** 2 + (p2 - p1) * 6 * (1 - t) * t + (p3 - p2) * 3 * t * t
            dorsal = (bu * 0.5 - (R3 @ Vector((0, 1, 0)))).normalized().lerp(hu, t)
            KS.matrix(D[f"Neck_{i}"], f, frame_yz(q, tan, dorsal))
        KS.matrix(D["Head"], f, Hm)
        KS.matrix(D["Jaw"], f, Hm @ T((0, 0.02, -0.06)) @ rot("X", -D_JAW(f)))
        for s, sg in (("L", -1), ("R", 1)):
            KS.matrix(D["Eye_" + s], f, Hm @ T((sg * 0.068, 0.075, 0.035)) @ rot("Z", -sg * 35) @ Matrix.Diagonal((1, 1, max(D_EYE(f), 0.05), 1)))
        # tail
        pos = M @ Vector((0, -0.34, 0.0))
        d = (R3 @ Vector((0, -1, -0.35))).normalized()
        curl, wag = D_TAIL_CURL(f), D_WAG(f)
        for i in range(N_TAIL):
            r = lerp(0.1, 0.024, i / (N_TAIL - 1))
            ang = curl * (0.5 + i * 0.12) + 9.0 * wag * math.sin(f / FPS * 2 * math.pi * (0.45 + 0.3 * wag) - i * 0.55)
            d = (rot(UP, ang).to_3x3() @ d).normalized()
            floor = ground_h(pos.x, pos.y) + 0.02 + r
            if pos.z < floor + 0.01:
                d.z = max(d.z, 0.0)
                d.normalize()
            pos = pos + d * (0.085 if i else 0.0)
            pos.z = max(pos.z, floor)
            KS.matrix(D[f"Tail_{i}"], f, frame_yz(pos, d, UP))
        KS.matrix(D["TailTip"], f, frame_yz(pos + d * 0.03, d, UP))
        # legs
        for leg, anc in D_ANCH.items():
            l1, l2 = D_LEG[leg[0]]
            root = M @ anc
            foot = dragon_foot(leg, f, M)
            pole = (R3 @ Vector((0, -1 if leg[0] == "F" else 1, 0.1)))
            knee, ank = ik2(root, foot, l1, l2, pole)
            KS.matrix(D["Upper_" + leg], f, seg_matrix(root, knee, R3 @ Vector((0, 1, 0))))
            KS.matrix(D["Lower_" + leg], f, seg_matrix(knee, ank, R3 @ Vector((0, 1, 0))))
            fwd = R3 @ Vector((0, 1, 0))
            fwd.z = 0
            KS.matrix(D["Paw_" + leg], f, frame_yz(ank, fwd, UP))
        # wings
        for s, sg in (("L", -1), ("R", 1)):
            W = M @ T((sg * 0.1, 0.12, 0.15)) @ rot("Y", -sg * D_FLAP(f))
            KS.matrix(D["Wing_" + s], f, W)
            KS.put(D["Wing_" + s].data.shape_keys, 'key_blocks["Fold"].value', 0, f, D_FOLD(f))

    # ---- cameras
    cams = []
    for sh in SHOTS:
        cd = bpy.data.cameras.new("CAM_" + sh.name)
        cd.sensor_width = 36
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = sh.fstop
        cd.clip_start = 0.05
        cd.clip_end = 200
        cam = bpy.data.objects.new("CAM_" + sh.name, cd)
        C_CAM.objects.link(cam)
        cam.rotation_mode = "QUATERNION"
        for f in range(max(1, sh.f0 - 2), min(FRAME_END, sh.f1 + 2) + 1):
            Mc, dist = camera_matrix(sh, f)
            KS.matrix(cam, f, Mc)
            KS.put(cd, "lens", 0, f, sh.lens(f))
            KS.put(cd, "dof.focus_distance", 0, f, dist)
        m = scene.timeline_markers.new(sh.name, frame=sh.f0)
        m.camera = cam
        cams.append(cam)
    scene.camera = cams[0]
    KS.flush()

    # ---- render defaults (EEVEE, 1080p)
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 24
    scene.eevee.use_shadows = True
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    scene.render.image_settings.file_format = "PNG"
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out_path), compress=True)
    print("SAVED", out_path)


# dragon feet: simple automatic gait ------------------------------------------
_FEET = {}


def dragon_foot(leg, f, M):
    st = _FEET.get(leg)
    home = M @ (D_ANCH[leg] + Vector((0.04 if "R" == leg[1] else -0.04, 0.03, 0)))
    home.z = ground_h(home.x, home.y) + 0.045
    if st is None:
        st = _FEET[leg] = dict(pos=home.copy(), step=None)
    if st["step"]:
        a, b, s0 = st["step"]
        t = (f - s0) / 7.0
        if t >= 1:
            st["pos"], st["step"] = b, None
        else:
            p = a.lerp(b, smooth(t))
            p.z += 0.07 * math.sin(math.pi * t)
            return p
    partner = {"FL": "RR", "RR": "FL", "FR": "RL", "RL": "FR"}[leg]
    others_stepping = sum(1 for k, v in _FEET.items() if v["step"] and k != partner)
    if (st["pos"] - home).length > 0.09 and others_stepping == 0:
        st["step"] = (st["pos"].copy(), home + (home - st["pos"]) * 0.25, f)
        st["step"][1].z = home.z
    return st["pos"].copy()


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    out = "dragon_egg_scene.blend"
    if "--out" in argv:
        out = argv[argv.index("--out") + 1]
    main(out)
