"""
CLOUD TITAN — бұлттардан құралған алып құдіретті тұлға (толық дене).

Blender 4.2+ / 5.x үшін процедуралық генератор.

Қолдану:
  1) Blender → Scripting қойындысы → осы файлды ашып → Run Script.
  2) Немесе терминалдан:
       blender -b -P cloud_titan.py -- --save cloud_titan.blend
       blender -b -P cloud_titan.py -- --save cloud_titan.blend --render renders/

Не құрылады ("CloudTitan" коллекциясы):
  Titan_Body        – бұлт-денесі (metaball → mesh), Armature-ге байланған
  Titan_Wisps       – дене айналасындағы түтінді жұқа бұлт (Volume)
  Titan_FaceVoid    – беттің орнындағы жарқыраған бұлтты аспан "терезесі"
  Titan_StarEye     – беттегі үлкен қара төрт сәулелі жұлдыз
  Titan_Crescent    – беттегі жарық доға
  Titan_Sparkle_*   – жарқыраған жұлдыздар (+ Glow жарқылы)
  Titan_Thorn_*     – иықтан/арқадан шыққан иілген тікенектер
  Titan_CloudBase   – аяқ астындағы бұлт теңізі
  Titan_Rig         – қарапайым қаңқа (анимацияға дайын)
  Cam_Full / Cam_Portrait, жарық көздері
"""

import math
import random
import sys

import bmesh
import bpy
from mathutils import Vector

# --------------------------------------------------------------------------
# Баптаулар
# --------------------------------------------------------------------------
SEED = 7
MB_RESOLUTION = 0.055        # бұлт торының қадамы (кіші = егжей-тегжейлі, баяу)
PUFF_DENSITY = 1.0           # бұлт "бүрлерінің" тығыздығы
ADD_CLOUD_BASE = True        # аяқ астындағы бұлт теңізі
ADD_WISPS = True             # дене айналасындағы көлемді түтін (Cycles-те баяулатады)
ADD_RIG = True               # анимацияға арналған қаңқа
CLEAN_DEFAULT_SCENE = True   # әдепкі Cube/Light/Camera-ны өшіру
COLLECTION = "CloudTitan"

# Түстер (суреттердегі палитра: қою көк-сұр көлеңке, лаванда-ақ жарық)
COL_SHADOW = (0.030, 0.032, 0.055)
COL_CLOUD = (0.20, 0.20, 0.28)
COL_LIGHT = (0.80, 0.80, 1.00)
COL_GLOW = (0.86, 0.84, 1.00)
COL_STAR_DARK = (0.004, 0.004, 0.008)
COL_WORLD = (0.006, 0.007, 0.016)

# Metaball (stiffness=2, threshold=0.6) үшін көрінетін радиус = 0.575 * radius
K_VIS = 0.575

rng = random.Random(SEED)

# --------------------------------------------------------------------------
# Қаңқа (A-pose, кейіпкер -Y бағытына қарайды, биіктігі ~18 м)
# --------------------------------------------------------------------------
J = {
    "pelvis": Vector((0.0, 0.05, 9.2)),
    "abdomen": Vector((0.0, 0.0, 10.9)),
    "chest": Vector((0.0, 0.05, 12.5)),
    "neck_base": Vector((0.0, 0.15, 13.7)),
    "neck_top": Vector((0.0, 0.05, 15.2)),
    "head": Vector((0.0, 0.0, 16.5)),
    "head_top": Vector((0.0, 0.0, 18.1)),
}
for s, sx in (("L", 1.0), ("R", -1.0)):
    J["clav_" + s] = Vector((0.9 * sx, 0.15, 13.6))
    J["shoulder_" + s] = Vector((2.7 * sx, 0.12, 13.3))
    J["elbow_" + s] = Vector((4.35 * sx, 0.35, 11.0))
    J["wrist_" + s] = Vector((5.5 * sx, -0.1, 8.85))
    J["hand_" + s] = Vector((5.85 * sx, -0.25, 8.05))
    J["hip_" + s] = Vector((1.05 * sx, 0.05, 8.9))
    J["knee_" + s] = Vector((1.35 * sx, -0.2, 4.9))
    J["ankle_" + s] = Vector((1.5 * sx, 0.15, 1.0))
    J["toe_" + s] = Vector((1.65 * sx, -1.15, 0.3))

# Беттің "терезесі" (басқа қатысты)
FACE_C = Vector((0.0, -0.78, 16.45))     # бет шұңқырының орталығы
FACE_SEMI = Vector((0.80, 0.60, 1.18))   # шұңқырдың жарты осьтері


def face_pt(u, v, y):
    """Бет терезесіндегі нормаланған (u, v ∈ [-1, 1]) нүкте."""
    return Vector((FACE_C.x + u * FACE_SEMI.x, y, FACE_C.z + v * FACE_SEMI.z))


# --------------------------------------------------------------------------
# Көмекші функциялар
# --------------------------------------------------------------------------
def get_collection():
    col = bpy.data.collections.get(COLLECTION)
    if col is None:
        col = bpy.data.collections.new(COLLECTION)
        bpy.context.scene.collection.children.link(col)
    else:
        for ob in list(col.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
    return col


def link(ob):
    bpy.data.collections[COLLECTION].objects.link(ob)
    return ob


def set_in(node, names, value):
    """Principled BSDF кірістерінің аты нұсқаға қарай өзгереді."""
    if isinstance(names, str):
        names = (names,)
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False


def new_material(name):
    mat = bpy.data.materials.get(name)
    if mat:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new(name)
    if hasattr(mat, "use_nodes") and not mat.use_nodes:
        mat.use_nodes = True
    mat.node_tree.nodes.clear()
    return mat


def frame_driver(socket, expr):
    """Анимация үшін #frame драйвері (Python қажет етпейтін қарапайым өрнек)."""
    fc = socket.driver_add("default_value")
    fc.driver.type = "SCRIPTED"
    fc.driver.expression = expr
    return fc


def rgba(c, a=1.0):
    return (c[0], c[1], c[2], a)


def mix_color_node(nt, blend="MIX"):
    n = nt.nodes.new("ShaderNodeMix")
    n.data_type = "RGBA"
    n.blend_type = blend
    return n


# --------------------------------------------------------------------------
# Материалдар
# --------------------------------------------------------------------------
def mat_cloud(name="M_TitanCloud", dark=COL_SHADOW, light=COL_CLOUD):
    mat = new_material(name)
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    out.location = (900, 0)
    bsdf = N.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (550, 0)
    set_in(bsdf, "Roughness", 0.95)
    set_in(bsdf, ("Specular IOR Level", "Specular"), 0.15)
    set_in(bsdf, ("Sheen Weight", "Sheen"), 0.35)
    set_in(bsdf, "Sheen Roughness", 0.6)
    set_in(bsdf, "Sheen Tint", rgba(COL_LIGHT))

    tc = N.new("ShaderNodeTexCoord")
    tc.location = (-900, 0)
    noise = N.new("ShaderNodeTexNoise")
    noise.location = (-700, 100)
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = 0.35
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.6
    frame_driver(noise.inputs["W"], "frame / 300")
    L.new(tc.outputs["Object"], noise.inputs["Vector"])

    ramp = N.new("ShaderNodeValToRGB")
    ramp.location = (-480, 100)
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = rgba(dark)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = rgba(light)
    L.new(noise.outputs["Fac"], ramp.inputs["Fac"])

    # Бүрлердің арасындағы терең көлеңке
    ao = N.new("ShaderNodeAmbientOcclusion")
    ao.location = (-200, 150)
    ao.inputs["Distance"].default_value = 0.8
    L.new(ramp.outputs["Color"], ao.inputs["Color"])

    # Төмен қарай қараңғылану (аяқтары қою, басы жарық)
    sep = N.new("ShaderNodeSeparateXYZ")
    sep.location = (-700, -200)
    L.new(tc.outputs["Object"], sep.inputs["Vector"])
    mr = N.new("ShaderNodeMapRange")
    mr.location = (-480, -200)
    mr.inputs["From Min"].default_value = 1.0
    mr.inputs["From Max"].default_value = 15.0
    mr.inputs["To Min"].default_value = 0.35
    mr.inputs["To Max"].default_value = 1.0
    L.new(sep.outputs["Z"], mr.inputs["Value"])
    mul = mix_color_node(nt, "MULTIPLY")
    mul.location = (50, 100)
    mul.inputs["Factor"].default_value = 1.0
    L.new(ao.outputs["Color"], mul.inputs["A"])
    L.new(mr.outputs["Result"], mul.inputs["B"])
    L.new(mul.outputs["Result"], bsdf.inputs["Base Color"])

    # Бұлт шетінің әлсіз жарығы (жарық бұлт арқылы өтетіндей)
    lw = N.new("ShaderNodeLayerWeight")
    lw.location = (50, -250)
    lw.inputs["Blend"].default_value = 0.35
    pw = N.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.location = (230, -250)
    pw.inputs[1].default_value = 2.5
    L.new(lw.outputs["Facing"], pw.inputs[0])
    sc = N.new("ShaderNodeMath")
    sc.operation = "MULTIPLY"
    sc.location = (380, -250)
    sc.inputs[1].default_value = 0.08
    L.new(pw.outputs[0], sc.inputs[0])
    set_in(bsdf, ("Emission Color", "Emission"), rgba(COL_LIGHT))
    L.new(sc.outputs[0], bsdf.inputs["Emission Strength"])

    L.new(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def mat_face_void():
    """Бас ішіндегі жарқыраған бұлтты аспан."""
    mat = new_material("M_TitanFaceVoid")
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    out.location = (900, 0)
    tc = N.new("ShaderNodeTexCoord")
    tc.location = (-900, 0)

    vor = N.new("ShaderNodeTexVoronoi")
    vor.location = (-650, 150)
    vor.voronoi_dimensions = "4D"
    vor.feature = "SMOOTH_F1"
    vor.inputs["Scale"].default_value = 6.0
    if "Detail" in vor.inputs:
        vor.inputs["Detail"].default_value = 3.0
    frame_driver(vor.inputs["W"], "frame / 200")
    L.new(tc.outputs["Object"], vor.inputs["Vector"])

    noise = N.new("ShaderNodeTexNoise")
    noise.location = (-650, -150)
    noise.inputs["Scale"].default_value = 2.0
    noise.inputs["Detail"].default_value = 8.0
    L.new(tc.outputs["Object"], noise.inputs["Vector"])

    m = N.new("ShaderNodeMath")
    m.operation = "MULTIPLY_ADD"
    m.location = (-420, 0)
    m.inputs[1].default_value = 0.6
    L.new(vor.outputs["Distance"], m.inputs[0])
    L.new(noise.outputs["Fac"], m.inputs[2])

    ramp = N.new("ShaderNodeValToRGB")
    ramp.location = (-220, 0)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = rgba(COL_GLOW)
    ramp.color_ramp.elements[1].position = 0.95
    ramp.color_ramp.elements[1].color = rgba((0.16, 0.16, 0.30))
    L.new(m.outputs[0], ramp.inputs["Fac"])

    # Жоғарғы-оң жақ ең жарық
    grad = N.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    grad.location = (-420, -300)
    mp = N.new("ShaderNodeMapping")
    mp.location = (-620, -300)
    mp.inputs["Location"].default_value = (-0.25, 0.0, -0.35)
    mp.inputs["Scale"].default_value = (0.8, 0.8, 0.6)
    L.new(tc.outputs["Object"], mp.inputs["Vector"])
    L.new(mp.outputs[0], grad.inputs["Vector"])
    st = N.new("ShaderNodeMapRange")
    st.location = (-220, -300)
    st.inputs["To Min"].default_value = 0.8
    st.inputs["To Max"].default_value = 4.5
    L.new(grad.outputs["Fac"], st.inputs["Value"])

    em = N.new("ShaderNodeEmission")
    em.location = (300, 0)
    L.new(ramp.outputs["Color"], em.inputs["Color"])
    L.new(st.outputs["Result"], em.inputs["Strength"])
    L.new(em.outputs[0], out.inputs["Surface"])
    return mat


def mat_dark_star():
    mat = new_material("M_TitanStarDark")
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    out.location = (700, 0)
    bsdf = N.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (350, 0)
    set_in(bsdf, "Base Color", rgba(COL_STAR_DARK))
    set_in(bsdf, "Roughness", 0.6)
    set_in(bsdf, ("Specular IOR Level", "Specular"), 0.2)
    set_in(bsdf, ("Emission Color", "Emission"), rgba(COL_LIGHT))
    lw = N.new("ShaderNodeLayerWeight")
    lw.location = (-200, -200)
    lw.inputs["Blend"].default_value = 0.2
    sc = N.new("ShaderNodeMath")
    sc.operation = "MULTIPLY"
    sc.location = (50, -200)
    sc.inputs[1].default_value = 0.25
    L.new(lw.outputs["Facing"], sc.inputs[0])
    L.new(sc.outputs[0], bsdf.inputs["Emission Strength"])
    L.new(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def mat_emit(name, color, strength, twinkle=None):
    mat = new_material(name)
    nt = mat.node_tree
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = rgba(color)
    em.inputs["Strength"].default_value = strength
    if twinkle:
        frame_driver(em.inputs["Strength"], twinkle)
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return mat


def mat_glow(name, color, strength, power=4.0):
    """Жұлдыз айналасындағы жұмсақ жарқыл (мөлдір + сәулелену)."""
    mat = new_material(name)
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    out.location = (700, 0)
    tc = N.new("ShaderNodeTexCoord")
    tc.location = (-600, 0)
    grad = N.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    grad.location = (-400, 0)
    L.new(tc.outputs["Object"], grad.inputs["Vector"])
    pw = N.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.location = (-200, 0)
    pw.inputs[1].default_value = power
    L.new(grad.outputs["Fac"], pw.inputs[0])
    ml = N.new("ShaderNodeMath")
    ml.operation = "MULTIPLY"
    ml.location = (0, 0)
    ml.inputs[1].default_value = strength
    L.new(pw.outputs[0], ml.inputs[0])
    em = N.new("ShaderNodeEmission")
    em.location = (200, 0)
    em.inputs["Color"].default_value = rgba(color)
    L.new(ml.outputs[0], em.inputs["Strength"])
    tr = N.new("ShaderNodeBsdfTransparent")
    tr.location = (200, 150)
    add = N.new("ShaderNodeAddShader")
    add.location = (450, 0)
    L.new(tr.outputs[0], add.inputs[0])
    L.new(em.outputs[0], add.inputs[1])
    L.new(add.outputs[0], out.inputs["Surface"])
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "BLENDED"
    return mat


def mat_wisps():
    mat = new_material("M_TitanWisps")
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    out.location = (500, 0)
    vol = N.new("ShaderNodeVolumePrincipled")
    vol.location = (200, 0)
    vol.inputs["Color"].default_value = rgba((0.55, 0.55, 0.72))
    vol.inputs["Density"].default_value = 0.06
    vol.inputs["Anisotropy"].default_value = 0.3
    L.new(vol.outputs[0], out.inputs["Volume"])
    return mat


# --------------------------------------------------------------------------
# Metaball құрастырушы
# --------------------------------------------------------------------------
class Meta:
    def __init__(self, name, resolution):
        self.mb = bpy.data.metaballs.new(name)
        self.mb.resolution = resolution
        self.mb.render_resolution = resolution
        self.mb.threshold = 0.6
        self.ob = link(bpy.data.objects.new(name, self.mb))

    def ball(self, co, vis_r, neg=False, stiff=2.0):
        e = self.mb.elements.new()
        e.type = "BALL"
        e.co = co
        e.stiffness = stiff
        e.radius = vis_r / K_VIS
        e.use_negative = neg
        return e

    def ellipsoid(self, co, semi, neg=False, stiff=2.0, rot=None):
        e = self.mb.elements.new()
        e.type = "ELLIPSOID"
        e.co = co
        e.stiffness = stiff
        e.radius = 1.0
        e.size_x, e.size_y, e.size_z = (s / K_VIS for s in semi)
        e.use_negative = neg
        if rot is not None:
            e.rotation = rot
        return e

    def capsule(self, a, b, vis_r):
        d = b - a
        e = self.mb.elements.new()
        e.type = "CAPSULE"
        e.co = (a + b) * 0.5
        e.stiffness = 2.0
        e.radius = vis_r / K_VIS
        e.size_x = d.length * 0.5
        e.rotation = Vector((1, 0, 0)).rotation_difference(d.normalized())
        return e

    def to_mesh(self, name):
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(self.ob.evaluated_get(dg))
        me.name = name
        mb = self.mb
        bpy.data.objects.remove(self.ob, do_unlink=True)
        bpy.data.metaballs.remove(mb)
        ob = link(bpy.data.objects.new(name, me))
        for p in me.polygons:
            p.use_smooth = True
        return ob


def rand_dir():
    while True:
        v = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if 0.01 < v.length_squared <= 1.0:
            return v.normalized()


def perp_frame(d):
    d = d.normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(up).normalized()
    w = d.cross(u).normalized()
    return u, w


def puff(meta, c, r, out):
    """Бір бұлт бүрі + оның сыртқы жағындағы ұсақ бүрлер (гүлді қырыққабат пішіні)."""
    meta.ball(c, r, stiff=3.0)
    if r < 0.14:
        return
    for _ in range(rng.randint(2, 5)):
        dv = (rand_dir() + out * 1.3).normalized()
        sr = r * rng.uniform(0.28, 0.48)
        if sr >= 0.08:
            meta.ball(c + dv * r * rng.uniform(0.75, 0.95), sr, stiff=4.0)


def limb(meta, a, b, ra, rb, puffs=1.0, subdiv=3, pmin=0.28, pmax=0.6):
    """Кесінді бойынша бұлт-аяқ/қол: өзек + беттегі бүрлер."""
    for i in range(subdiv):
        t0, t1 = i / subdiv, (i + 1) / subdiv
        r = (ra + (rb - ra) * (t0 + t1) * 0.5) * 0.82
        meta.capsule(a.lerp(b, t0), a.lerp(b, t1), r)
    d = b - a
    u, w = perp_frame(d)
    n = int(PUFF_DENSITY * puffs * d.length * (ra + rb) * 9)
    for _ in range(n):
        t = rng.random()
        r = ra + (rb - ra) * t
        ang = rng.uniform(0, math.tau)
        radial = u * math.cos(ang) + w * math.sin(ang)
        c = a.lerp(b, t) + radial * r * rng.uniform(0.62, 0.9)
        puff(meta, c, r * rng.uniform(pmin, pmax) * rng.uniform(0.7, 1.0), radial)


def blob(meta, c, semi, puffs=1.0, pmin=0.18, pmax=0.42, skip=None, core=0.86):
    """Эллипсоид пішінді бұлт массасы."""
    meta.ellipsoid(c, Vector(semi) * core)
    area = 4 * math.pi * ((semi[0] * semi[1]) ** 1.6 + (semi[0] * semi[2]) ** 1.6
                          + (semi[1] * semi[2]) ** 1.6) ** (1 / 1.6) / 3
    n = int(PUFF_DENSITY * puffs * area * 6)
    m = min(semi)
    for _ in range(n):
        dv = rand_dir()
        if skip and skip(dv):
            continue
        p = c + Vector((dv.x * semi[0], dv.y * semi[1], dv.z * semi[2])) * rng.uniform(0.8, 0.97)
        puff(meta, p, m * rng.uniform(pmin, pmax) * rng.uniform(0.7, 1.0), dv)


# --------------------------------------------------------------------------
# Дене
# --------------------------------------------------------------------------
def build_body():
    meta = Meta("TitanMeta", MB_RESOLUTION)

    # Кеуде, іш, жамбас, жауырын
    sternum = lambda dv: dv.y < -0.55 and abs(dv.x) < 0.35 and dv.z > -0.4   # кеуде жұлдызының орны
    blob(meta, J["chest"], (2.05, 1.25, 1.45), puffs=1.2, skip=sternum)
    blob(meta, Vector((0, 0.25, 13.45)), (1.95, 1.0, 0.65), puffs=1.2)    # трапеция/иық белдеуі
    blob(meta, J["abdomen"], (1.2, 0.95, 1.15), puffs=1.0)
    blob(meta, J["pelvis"], (1.4, 1.0, 0.9), puffs=1.0)
    blob(meta, Vector((0, 0.55, 12.2)), (1.7, 0.9, 1.6), puffs=0.8)       # арқа

    # Мойын — жіңішке әрі ұзын (суреттегідей)
    limb(meta, J["neck_base"], J["neck_top"], 0.62, 0.48, puffs=0.6, pmin=0.2, pmax=0.4)

    # Бас: жоғары кең, иекке қарай жіңішкеретін жұмыртқа
    in_face = lambda dv: dv.y < -0.2 and abs(dv.x) < 0.8 and -0.9 < dv.z < 0.85
    blob(meta, Vector((0, 0.1, 16.75)), (1.08, 1.12, 1.25), puffs=1.8, pmin=0.14, pmax=0.3, skip=in_face)
    blob(meta, Vector((0, 0.0, 15.75)), (0.78, 0.92, 0.9), puffs=1.5, pmin=0.14, pmax=0.3, skip=in_face)
    # Бет шұңқыры (теріс элемент)
    meta.ellipsoid(FACE_C + Vector((0, -0.32, 0)), FACE_SEMI * 1.05, neg=True, stiff=6.0)
    # Шұңқыр шетіндегі бүрлер (ішкі жарықпен жарқырайды)
    for i in range(54):
        a = i / 54 * math.tau
        u, v = math.cos(a) * 1.04, math.sin(a) * 1.04
        p = face_pt(u, v, -1.02 + 0.22 * u * u + rng.uniform(-0.05, 0.05))
        puff(meta, p, rng.uniform(0.12, 0.22), Vector((u * 0.5, -1, v * 0.5)).normalized())
    # Шұңқыр ішіндегі (иек тұсындағы) бұлттар
    for _ in range(30):
        p = face_pt(rng.uniform(-0.65, 0.65), rng.uniform(-1.0, -0.5), rng.uniform(-0.85, -0.65))
        puff(meta, p, rng.uniform(0.08, 0.17), Vector((0, -1, 0.4)).normalized())

    # Иық (дельта бұлшықеті) — ірі бұлт шоқтары
    for s in ("L", "R"):
        blob(meta, J["shoulder_" + s] + Vector((0, 0, 0.15)), (1.0, 1.0, 0.95), puffs=1.6)
        limb(meta, J["clav_" + s], J["shoulder_" + s], 0.7, 0.85, puffs=0.8)
        limb(meta, J["shoulder_" + s], J["elbow_" + s], 0.74, 0.56, puffs=1.2)
        limb(meta, J["elbow_" + s], J["wrist_" + s], 0.58, 0.38, puffs=1.1)
        build_hand(meta, s)
        limb(meta, J["hip_" + s], J["knee_" + s], 0.92, 0.62, puffs=1.1, pmax=0.5)
        limb(meta, J["knee_" + s], J["ankle_" + s], 0.62, 0.4, puffs=1.2, pmax=0.5)
        limb(meta, J["ankle_" + s], J["toe_" + s], 0.45, 0.3, puffs=0.8, subdiv=2)

    body = meta.to_mesh("Titan_Body")
    body.data.materials.append(mat_cloud())
    return body


def hand_frame(s):
    sx = 1.0 if s == "L" else -1.0
    d = (J["hand_" + s] - J["wrist_" + s]).normalized()
    fwd = Vector((0, -1, 0))
    fwd = (fwd - d * fwd.dot(d)).normalized()
    side = d.cross(fwd).normalized() * sx
    return d, fwd, side, sx


def finger_paths(s):
    d, fwd, side, sx = hand_frame(s)
    palm = J["hand_" + s]
    paths = []
    for i in range(4):
        off = (i - 1.5) * 0.19
        base = palm + fwd * off + d * 0.12
        ln = 0.95 - abs(i - 1.3) * 0.12
        curl = -side * sx * 0.0 + Vector((-sx, 0, 0)) * 0.35
        p0 = base
        p1 = base + d * ln * 0.55 + fwd * off * 0.5
        p2 = base + d * ln + fwd * off * 0.8 + curl
        paths.append((p0, p1, p2, 0.12))
    # Бас бармақ
    t0 = J["wrist_" + s] + d * 0.35 + fwd * 0.25
    paths.append((t0, t0 + fwd * 0.4 + d * 0.2, t0 + fwd * 0.65 + d * 0.5 + Vector((-sx * 0.15, 0, 0)), 0.13))
    return paths


def build_hand(meta, s):
    d, fwd, side, sx = hand_frame(s)
    meta.ellipsoid(J["hand_" + s] - d * 0.15, (0.42, 0.42, 0.42))
    for _ in range(14):
        meta.ball(J["hand_" + s] - d * 0.15 + rand_dir() * 0.38, rng.uniform(0.12, 0.2))
    for p0, p1, p2, r in finger_paths(s):
        meta.capsule(p0, p1, r)
        meta.capsule(p1, p2, r * 0.75)


def build_cloud_base():
    meta = Meta("BaseMeta", MB_RESOLUTION * 1.4)
    for _ in range(int(320 * PUFF_DENSITY)):
        a = rng.uniform(0, math.tau)
        rr = 9.0 * math.sqrt(rng.random())
        h = max(0.0, 1.6 - rr * 0.13) * rng.uniform(0.4, 1.0)
        puff(meta, Vector((math.cos(a) * rr, math.sin(a) * rr * 0.8 + 0.5, h)),
             rng.uniform(0.45, 1.2) * (1.1 - rr / 14), Vector((0, 0, 1)))
    ob = meta.to_mesh("Titan_CloudBase")
    ob.data.materials.append(mat_cloud("M_TitanCloudBase", COL_SHADOW, (0.30, 0.30, 0.42)))
    return ob


# --------------------------------------------------------------------------
# Тор (mesh) генераторлары
# --------------------------------------------------------------------------
def bezier(p0, p1, p2, t):
    return p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + p2 * t * t


def sweep_tube(name, pts, radii, ring=14):
    """Нүктелер бойымен айнымалы радиусты түтік (тікенек, доға)."""
    bm = bmesh.new()
    n = len(pts)
    t0 = (pts[1] - pts[0]).normalized()
    nrm, _ = perp_frame(t0)
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        nrm = (nrm - t * nrm.dot(t)).normalized()
        bn = t.cross(nrm)
        r = radii[i]
        if r <= 0.0:
            rings.append([bm.verts.new(p)])
            continue
        rings.append([bm.verts.new(p + (nrm * math.cos(a) + bn * math.sin(a)) * r)
                      for a in (k / ring * math.tau for k in range(ring))])
    for a, b in zip(rings[:-1], rings[1:]):
        if len(b) == 1:
            for k in range(ring):
                bm.faces.new((a[k], a[(k + 1) % ring], b[0]))
        elif len(a) == 1:
            for k in range(ring):
                bm.faces.new((a[0], b[(k + 1) % ring], b[k]))
        else:
            for k in range(ring):
                bm.faces.new((a[k], a[(k + 1) % ring], b[(k + 1) % ring], b[k]))
    if len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return link(bpy.data.objects.new(name, me))


def thorn(name, base, ctrl, tip, r0, mat):
    pts, radii = [], []
    steps = 30
    for i in range(steps + 1):
        t = i / steps
        pts.append(bezier(base, ctrl, tip, t))
        radii.append(r0 * (1 - t) ** 2.2 if i < steps else 0.0)
    ob = sweep_tube(name, pts, radii)
    ob.data.materials.append(mat)
    return ob


def star_outline(right, up, left, down, exp, n=40):
    """Ойыс жақты төрт сәулелі жұлдыз (астроида)."""
    pts = []
    quads = ((right, up, 1, 1), (left, up, -1, 1), (left, down, -1, -1), (right, down, 1, -1))
    for qi, (ex, ey, sx, sy) in enumerate(quads):
        rng_t = range(n) if qi % 2 == 0 else range(n, 0, -1)
        for k in rng_t:
            t = k / n * math.pi / 2
            pts.append((sx * ex * math.cos(t) ** exp, sy * ey * math.sin(t) ** exp))
    # реттеу: бұрыш бойынша
    pts.sort(key=lambda p: math.atan2(p[1], p[0]))
    return pts


def star_mesh(name, center, ext, exp, bend=0.0, rings=10, facing=Vector((0, -1, 0))):
    """Жұлдыз пішінді жазық/иілген тор. ext=(оң, жоғары, сол, төмен)."""
    outline = star_outline(*ext, exp=exp)
    maxl = max(ext)
    bm = bmesh.new()
    c = bm.verts.new(center)
    grid = []
    rot = Vector((0, -1, 0)).rotation_difference(facing).to_matrix()
    for k in range(1, rings + 1):
        f = k / rings
        row = []
        for (u, v) in outline:
            uu, vv = u * f, v * f
            dist2 = (uu * uu + vv * vv) / (maxl * maxl)
            local = Vector((uu, bend * dist2 * maxl, vv))
            row.append(bm.verts.new(center + rot @ local))
        grid.append(row)
    m = len(outline)
    for k in range(m):
        bm.faces.new((c, grid[0][(k + 1) % m], grid[0][k]))
    for a, b in zip(grid[:-1], grid[1:]):
        for k in range(m):
            bm.faces.new((a[k], a[(k + 1) % m], b[(k + 1) % m], b[k]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return link(bpy.data.objects.new(name, me))


def glow_card(name, center, size, mat, facing=Vector((0, -1, 0))):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    ob.data.materials.append(mat)
    ob.rotation_euler = Vector((0, 0, 1)).rotation_difference(-facing).to_euler()
    ob.location = center
    ob.scale = (size, size, size)
    ob.visible_shadow = False
    return ob


def sparkle(name, center, size, strength=40.0, glow=1.0, ext=None, twinkle_phase=0.0,
            facing=Vector((0, -1, 0)), glow_strength=3.0):
    ext = ext or (size, size, size, size)
    ob = star_mesh(name, center, ext, exp=5.0, rings=6, facing=facing)
    expr = "%.1f * (1 + 0.35 * sin(frame / 9 + %.2f))" % (strength, twinkle_phase)
    ob.data.materials.append(mat_emit("M_" + name, COL_GLOW, strength, twinkle=expr))
    ob.visible_shadow = False
    objs = [ob]
    if glow > 0:
        g = glow_card(name + "_Glow", center + facing * 0.01, max(ext) * 1.6 * glow,
                      mat_glow("M_" + name + "_Glow", COL_GLOW, glow_strength), facing=facing)
        objs.append(g)
    return objs


def ellipsoid_shell(name, center, semi, back_only=True, seg=48, rings=32):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    if back_only:
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.15], context="VERTS")
    for v in bm.verts:
        v.co = Vector((v.co.x * semi[0], v.co.y * semi[1], v.co.z * semi[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = link(bpy.data.objects.new(name, me))
    ob.location = center
    return ob


# --------------------------------------------------------------------------
# Бет, жұлдыздар, тікенектер
# --------------------------------------------------------------------------
def build_face():
    objs = []
    # Жарқыраған "аспан" — шұңқырдың артқы қабырғасының алдында
    void = ellipsoid_shell("Titan_FaceVoid", Vector((FACE_C.x, -1.0, FACE_C.z)),
                           (FACE_SEMI.x * 1.15, 0.36, FACE_SEMI.z * 1.15))
    void.data.materials.append(mat_face_void())
    objs.append(void)

    # Үлкен қара жұлдыз — беттің сол жағында, төменгі сәулесі мойынға дейін созылған
    star = star_mesh("Titan_StarEye", face_pt(-0.35, 0.15, -1.12),
                     (0.66, 0.8, 0.8, 1.55), exp=3.4, bend=0.4, rings=14)
    sol = star.modifiers.new("Thickness", "SOLIDIFY")
    sol.thickness = 0.06
    sol.offset = 1.0
    star.data.materials.append(mat_dark_star())
    objs.append(star)

    # Жарық доға (ай орағы сияқты) — маңдайдан оң жаққа қарай
    pts, radii = [], []
    n = 60
    for i in range(n + 1):
        t = i / n
        a = math.radians(100 - 118 * t)
        pts.append(face_pt(-0.1 + math.cos(a) * 0.8, 0.08 + math.sin(a) * 0.72,
                           -0.78 - 0.1 * math.sin(math.pi * t)))
        radii.append(0.024 * math.sin(math.pi * t) ** 0.6 + 0.002)
    arc = sweep_tube("Titan_Crescent", pts, radii, ring=8)
    arc.data.materials.append(mat_emit("M_TitanCrescent", COL_GLOW, 25.0))
    objs.append(arc)

    # Беттегі жарқыраған жұлдыздар
    objs += sparkle("Titan_Sparkle_Face", face_pt(0.18, 0.42, -0.86), 0.3,
                    ext=(0.26, 0.34, 0.26, 0.34), strength=60, twinkle_phase=0.0)
    objs += sparkle("Titan_Sparkle_Face2", face_pt(0.55, 0.62, -0.8), 0.12,
                    strength=40, twinkle_phase=1.7)
    return objs


def build_extras():
    objs = []
    # Кеудедегі жарық жұлдыз (ұзын тік сәулемен)
    objs += sparkle("Titan_Sparkle_Chest", Vector((0.0, -1.6, 12.95)), 0.6,
                    ext=(0.6, 1.35, 0.6, 0.5), strength=50, glow=1.0, twinkle_phase=0.6,
                    glow_strength=1.2)
    # Дене бойындағы ұсақ жұлдыздар
    spots = [(-1.35, -0.75, 15.6, 0.12), (2.6, -1.05, 13.9, 0.1), (-3.2, -0.6, 12.6, 0.09),
             (0.9, -1.25, 10.8, 0.08), (-0.7, -1.1, 9.6, 0.07), (4.6, -0.5, 10.4, 0.07),
             (-5.0, -0.55, 9.6, 0.07), (1.5, -1.1, 6.0, 0.06)]
    for i, (x, y, z, s) in enumerate(spots):
        objs += sparkle("Titan_Sparkle_%02d" % i, Vector((x, y, z)), s, strength=35,
                        glow=1.0, twinkle_phase=i * 1.3)

    mat = mat_cloud("M_TitanThorn", COL_SHADOW, (0.24, 0.24, 0.34))
    thorns = [
        # (атауы, түбі, бақылау нүктесі, ұшы, түбінің радиусы, сүйек)
        ("Shoulder_R", (-2.35, 0.2, 13.9), (-2.9, 0.3, 15.1), (-2.65, 0.55, 16.5), 0.45, "shoulder.R"),
        ("ShoulderOut_R", (-3.25, 0.3, 13.6), (-4.1, 0.3, 14.3), (-4.4, 0.65, 15.7), 0.36, "shoulder.R"),
        ("Neck_R", (-0.95, 0.2, 14.3), (-1.3, 0.2, 15.0), (-1.45, 0.3, 15.7), 0.22, "chest"),
        ("Shoulder_L", (2.45, 0.2, 13.8), (3.7, 0.25, 14.25), (5.2, 0.5, 14.55), 0.38, "shoulder.L"),
        ("ShoulderUp_L", (1.6, 0.3, 14.1), (1.95, 0.3, 15.0), (1.65, 0.55, 15.9), 0.3, "shoulder.L"),
        ("Back_L", (0.9, 1.0, 13.3), (1.3, 2.0, 14.6), (1.7, 2.9, 16.0), 0.42, "chest"),
        ("Back_R", (-0.9, 1.0, 13.3), (-1.3, 2.0, 14.6), (-1.7, 2.9, 16.0), 0.42, "chest"),
        ("Elbow_L", (4.4, 0.6, 11.1), (5.1, 1.1, 11.4), (5.6, 1.7, 12.1), 0.26, "upper_arm.L"),
        ("Elbow_R", (-4.4, 0.6, 11.1), (-5.1, 1.1, 11.4), (-5.6, 1.7, 12.1), 0.26, "upper_arm.R"),
    ]
    thorn_objs = []
    for nm, b, c, t, r, bone in thorns:
        ob = thorn("Titan_Thorn_" + nm, Vector(b), Vector(c), Vector(t), r, mat)
        ob["rig_bone"] = bone
        thorn_objs.append(ob)
    # Саусақ ұштарындағы тырнақ-тікенектер
    for s, side in (("L", "L"), ("R", "R")):
        for i, (p0, p1, p2, r) in enumerate(finger_paths(s)):
            dvec = (p2 - p1).normalized()
            ob = thorn("Titan_Claw_%s%d" % (s, i), p2 - dvec * 0.1, p2 + dvec * 0.25,
                       p2 + dvec * 0.45 + Vector((0, 0, -0.08)), r * 0.7, mat)
            ob["rig_bone"] = "hand." + side
            thorn_objs.append(ob)
    return objs, thorn_objs


def build_wisps(body):
    """Дене айналасындағы түтінді көлем (Mesh to Volume + Volume Displace)."""
    vd = bpy.data.volumes.new("Titan_Wisps")
    ob = link(bpy.data.objects.new("Titan_Wisps", vd))
    m = ob.modifiers.new("MeshToVolume", "MESH_TO_VOLUME")
    m.object = body
    m.resolution_mode = "VOXEL_SIZE"
    m.voxel_size = 0.12
    m.interior_band_width = 0.35
    if hasattr(m, "density"):
        m.density = 1.0
    tex = bpy.data.textures.get("T_TitanWisps") or bpy.data.textures.new("T_TitanWisps", "CLOUDS")
    tex.noise_scale = 1.1
    tex.noise_depth = 3
    d = ob.modifiers.new("Displace", "VOLUME_DISPLACE")
    d.texture = tex
    d.strength = 0.55
    vd.materials.append(mat_wisps())
    return ob


# --------------------------------------------------------------------------
# Қаңқа (rig) және салмақтар
# --------------------------------------------------------------------------
BONES = [
    # (атауы, басы, соңы, ата-анасы)
    ("root", Vector((0, 0, 0)), Vector((0, 0, 2.0)), None),
    ("hips", "pelvis", "abdomen", "root"),
    ("spine", "abdomen", "chest", "hips"),
    ("chest", "chest", "neck_base", "spine"),
    ("neck", "neck_base", "neck_top", "chest"),
    ("head", "neck_top", "head_top", "neck"),
]
for _s in ("L", "R"):
    BONES += [
        ("shoulder." + _s, "clav_" + _s, "shoulder_" + _s, "chest"),
        ("upper_arm." + _s, "shoulder_" + _s, "elbow_" + _s, "shoulder." + _s),
        ("forearm." + _s, "elbow_" + _s, "wrist_" + _s, "upper_arm." + _s),
        ("hand." + _s, "wrist_" + _s, "hand_" + _s, "forearm." + _s),
        ("thigh." + _s, "hip_" + _s, "knee_" + _s, "hips"),
        ("shin." + _s, "knee_" + _s, "ankle_" + _s, "thigh." + _s),
        ("foot." + _s, "ankle_" + _s, "toe_" + _s, "shin." + _s),
    ]


def _pt(p):
    return J[p] if isinstance(p, str) else p


def build_rig():
    arm = bpy.data.armatures.new("Titan_Rig")
    ob = link(bpy.data.objects.new("Titan_Rig", arm))
    ob.show_in_front = True
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    for name, h, t, parent in BONES:
        eb = arm.edit_bones.new(name)
        eb.head, eb.tail = _pt(h), _pt(t)
        if parent:
            eb.parent = arm.edit_bones[parent]
            eb.use_connect = (eb.parent.tail - eb.head).length < 1e-3
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def skin(body, rig):
    """Әр төбеге ең жақын 2 сүйек бойынша жұмсақ салмақ."""
    segs = [(n, _pt(h), _pt(t)) for n, h, t, _ in BONES if n != "root"]
    groups = {n: body.vertex_groups.new(name=n) for n, _, _ in segs}
    buckets = {n: ([], []) for n, _, _ in segs}
    for v in body.data.vertices:
        p = v.co
        ds = sorted(((seg_dist(p, a, b), n) for n, a, b in segs))[:2]
        if p.z > J["neck_top"].z + 0.2:       # бас толығымен басқа
            ds = [(0.0, "head")]
        ws = [1.0 / (d ** 4 + 1e-3) for d, _ in ds]
        tot = sum(ws)
        for (d, n), w in zip(ds, ws):
            buckets[n][0].append(v.index)
            buckets[n][1].append(w / tot)
    for n, (idx, wts) in buckets.items():
        for i, w in zip(idx, wts):
            groups[n].add([i], w, "REPLACE")
    mod = body.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    body.parent = rig


def add_idle_animation(rig):
    """Жай "тыныс алу": кеуде кеңейеді, бас сәл көтеріледі (циклді, 300 кадр)."""
    pb = rig.pose.bones
    for b in ("chest", "head", "upper_arm.L", "upper_arm.R"):
        pb[b].rotation_mode = "XYZ"
    keys = ((1, 0.0), (150, 1.0), (300, 0.0))
    for frame, k in keys:
        pb["chest"].scale = (1 + 0.025 * k,) * 3
        pb["chest"].keyframe_insert("scale", frame=frame)
        pb["head"].rotation_euler = (math.radians(-4 * k), 0, math.radians(2 * k))
        pb["head"].keyframe_insert("rotation_euler", frame=frame)
        for s in ("L", "R"):
            pb["upper_arm." + s].rotation_euler = (0, 0, math.radians(3 * k) * (1 if s == "L" else -1))
            pb["upper_arm." + s].keyframe_insert("rotation_euler", frame=frame)
    if rig.animation_data and rig.animation_data.action:
        act = rig.animation_data.action
        curves = getattr(act, "fcurves", None)
        if curves is None:      # Blender 5: slotted actions
            curves = [fc for layer in act.layers for strip in layer.strips
                      for bag in strip.channelbags for fc in bag.fcurves]
        for fc in curves:
            for kp in fc.keyframe_points:
                kp.interpolation = "SINE"
            fc.modifiers.new("CYCLES")


def parent_to_bone(ob, rig, bone):
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    ob.matrix_world = mw


# --------------------------------------------------------------------------
# Сахна: әлем, жарық, камера, рендер
# --------------------------------------------------------------------------
def look_at(ob, target):
    d = (Vector(target) - ob.location).normalized()
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def build_scene():
    scn = bpy.context.scene
    world = bpy.data.worlds.get("W_TitanNight") or bpy.data.worlds.new("W_TitanNight")
    if hasattr(world, "use_nodes") and not world.use_nodes:
        world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = rgba(COL_WORLD)
        bg.inputs["Strength"].default_value = 1.0
    scn.world = world

    lights = [
        # (атауы, түрі, орны, қуаты, түсі, өлшемі)
        ("Light_FaceGlow", "POINT", (0.1, -3.2, 16.8), 900, (0.82, 0.8, 1.0), 0.8),
        ("Light_FaceInner", "POINT", (0.0, -0.95, 16.5), 300, (0.85, 0.85, 1.0), 0.4),
        ("Light_ChestStar", "POINT", (0.0, -2.4, 13.2), 150, (0.85, 0.85, 1.0), 0.3),
        ("Light_Key", "AREA", (9.0, -12.0, 26.0), 2500, (0.75, 0.75, 0.95), 8.0),
        ("Light_Rim", "AREA", (-8.0, 12.0, 20.0), 9000, (0.6, 0.62, 0.9), 8.0),
        ("Light_Fill", "AREA", (-10.0, -18.0, 6.0), 600, (0.35, 0.38, 0.65), 10.0),
    ]
    for name, typ, loc, power, col, size in lights:
        ld = bpy.data.lights.new(name, typ)
        ld.energy = power
        ld.color = col
        if typ == "AREA":
            ld.size = size
        else:
            ld.shadow_soft_size = size
        ob = link(bpy.data.objects.new(name, ld))
        ob.location = loc
        ob.visible_camera = False
        if typ == "AREA":
            look_at(ob, (0, 0, 12))

    cams = {}
    for name, loc, target, lens in (("Cam_Full", (0, -46, 4.5), (0, 0, 9.6), 55),
                                    ("Cam_Portrait", (0, -30, 15.2), (0, 0, 15.1), 80)):
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.clip_end = 500
        ob = link(bpy.data.objects.new(name, cd))
        ob.location = loc
        look_at(ob, target)
        cams[name] = ob
    scn.camera = cams["Cam_Full"]

    scn.render.engine = "CYCLES"
    scn.cycles.samples = 128
    scn.cycles.use_denoising = True
    scn.cycles.volume_step_rate = 4.0
    scn.render.resolution_x = 1080
    scn.render.resolution_y = 1920
    scn.render.fps = 30
    scn.frame_start, scn.frame_end = 1, 300
    scn.view_settings.view_transform = "AgX" if "AgX" in [
        i.identifier for i in scn.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    scn.view_settings.look = "None"
    return cams


# --------------------------------------------------------------------------
# Негізгі
# --------------------------------------------------------------------------
def clean_default():
    for n in ("Cube", "Light", "Camera"):
        ob = bpy.data.objects.get(n)
        if ob:
            bpy.data.objects.remove(ob, do_unlink=True)


def build():
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    if CLEAN_DEFAULT_SCENE:
        clean_default()
    get_collection()

    body = build_body()
    face_objs = build_face()
    extras, thorns = build_extras()
    base = build_cloud_base() if ADD_CLOUD_BASE else None
    cams = build_scene()

    if ADD_RIG:
        rig = build_rig()
        skin(body, rig)
        bpy.context.view_layer.update()
        for ob in face_objs:
            parent_to_bone(ob, rig, "head")
        for ob in extras:
            bone = "chest" if "Chest" in ob.name else ("head" if ob.location.z > 15.2 else None)
            if bone:
                parent_to_bone(ob, rig, bone)
            else:
                mw = ob.matrix_world.copy()
                ob.parent = rig
                ob.matrix_world = mw
        for ob in thorns:
            parent_to_bone(ob, rig, ob["rig_bone"])
        add_idle_animation(rig)
        bpy.context.scene.frame_set(1)

    if ADD_WISPS:
        build_wisps(body)

    print("Cloud Titan: %d vertices, %d faces" % (len(body.data.vertices), len(body.data.polygons)))
    return cams


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    cams = build()
    if "--save" in argv:
        path = argv[argv.index("--save") + 1]
        bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath(path), compress=True)
    if "--render" in argv:
        outdir = argv[argv.index("--render") + 1].rstrip("/") + "/"
        scn = bpy.context.scene
        scale = int(argv[argv.index("--scale") + 1]) if "--scale" in argv else 50
        samples = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else 64
        scn.cycles.samples = samples
        scn.render.resolution_percentage = scale
        for cam, (rx, ry) in (("Cam_Full", (1080, 1920)), ("Cam_Portrait", (1080, 1440))):
            scn.camera = cams[cam]
            scn.render.resolution_x, scn.render.resolution_y = rx, ry
            scn.render.filepath = outdir + "preview_" + cam.split("_")[1].lower() + ".png"
            bpy.ops.render.render(write_still=True)
        scn.camera = cams["Cam_Full"]
        scn.render.resolution_x, scn.render.resolution_y = 1080, 1920
        scn.render.resolution_percentage = 100


if __name__ == "__main__":
    main()
