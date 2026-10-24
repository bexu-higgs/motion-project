"""
«Бір-біріне қарау» — 5 секундтық ірі план сахнасы (shot / reverse-shot)
"Look at each other" — 5 s close-up scene that follows the hatching.

Reuses the forest, the hatched shell and both characters from build_scene.py
and gives them a new performance: the person is frightened at first, the baby
dragon reacts in a cute way (dilating pupils, head tilts, chirps, a little hop),
the person softens and starts to walk toward it. Five cuts alternate between
the two faces in close-up and end on an over-the-dragon shot of the approach.

    python build_closeup.py --out dragon_egg_closeup.blend
    blender -b -P build_closeup.py -- --out dragon_egg_closeup.blend
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import build_scene as bs  # noqa: E402
from build_scene import Track, ModeTrack, Vector, UP, T, ramp, rot, nz, gpt, yaw_vec  # noqa: E402

FRAMES = 120          # 5 s at 24 fps
SRC = 468             # film frame whose shell/debris state is reused (end of SH05)
G0, GD = bs.G0, bs.GD
V = Vector

# ------------------------------------------------------------------ person
R0, L0 = bs.R_STAND, bs.L_FLINCH
R_BACK = gpt(0.16, -2.04)
R_FWD = gpt(0.14, -1.62)
L_FWD = gpt(-0.15, -1.42)
FWD = V((0, 1, 0))

FOOT_KEYS = {
    "R": [(1, R0, 0.0, yaw_vec(12), 0.0), (5, R0, -18.0, yaw_vec(12), 0.0),          # recoil half-step
          (15, R_BACK, 0.0, yaw_vec(10), 0.05), (98, R_BACK, 0.0, yaw_vec(10), 0.0),
          (101, R_BACK, -20.0, yaw_vec(10), 0.0), (112, R_FWD, 0.0, FWD, 0.1)],       # approach
    "L": [(1, L0, 0.0, yaw_vec(-15), 0.0), (106, L0, 0.0, yaw_vec(-15), 0.0),
          (110, L0, -20.0, yaw_vec(-15), 0.0), (121, L_FWD, 0.0, FWD, 0.1)],
}
PEL = Track([(1, V((0.0, -1.9, G0 + 0.935))), (14, V((0.0, -1.99, G0 + 0.9))), (55, V((0.0, -1.99, G0 + 0.9))),
             (80, V((0.0, -1.96, G0 + 0.935))), (98, V((0.0, -1.97, G0 + 0.94))), (112, V((0.0, -1.8, G0 + 0.925))),
             (121, V((0.0, -1.62, G0 + 0.9)))])
LEAN = Track([(1, -4.0), (10, -13.0), (55, -11.0), (78, 3.0), (98, 5.0), (120, 12.0)])
HEAD_ROLL = Track([(1, 0.0), (56, 0.0), (76, 9.0), (98, 7.0), (120, 3.0)])
FACE_FEAR = Track([(1, 0.55), (8, 1.0), (54, 0.9), (72, 0.0)])
FACE_SMILE = Track([(1, 0.0), (62, 0.0), (80, 1.0), (120, 1.0)])
FACE_BLINK = Track([(1, 0.0), (66, 0.0), (68, 1.0), (71, 0.0)])


def cu_pelvis(f):
    p = PEL(f)
    tremble = 0.004 * (1 - ramp(f, 50, 70))
    p = p + V((nz(f * 0.9, 61), nz(f * 0.9, 62), 0.5 * nz(f * 0.9, 63))) * tremble
    breath = 0.004 + 0.003 * (1 - ramp(f, 50, 75))
    p = p + UP * (breath * math.sin(f / bs.FPS * 2 * math.pi * (0.55 - 0.25 * ramp(f, 50, 75))))
    return p, FWD.copy()


def defend(f):      # right hand raised in front of the chest, palm toward the dragon
    B = bs.person_body(f)
    return B["shoulder"]["R"] + B["cf"] * 0.22 - B["cu"] * 0.17 + B["cr"] * 0.04


def heart(f):       # left hand pressed to the chest
    B = bs.person_body(f)
    return B["shoulder"]["L"] + B["cf"] * 0.18 - B["cu"] * 0.25 + B["cr"] * 0.12


def offer(f):       # right hand held out low, palm up
    B = bs.person_body(f)
    return B["shoulder"]["R"] + B["cf"] * 0.42 - UP * 0.32 - B["cr"] * 0.05


hang_r, hang_l = bs.hang("R"), bs.hang("L")
HAND_R = ModeTrack([(1, hang_r), (4, hang_r), (12, defend), (58, defend), (78, hang_r), (102, hang_r), (120, offer)])
HAND_L = ModeTrack([(1, hang_l), (5, hang_l), (14, heart), (60, heart), (80, hang_l), (120, hang_l)])


def hand_orient(side, f, B, fa, hdir, palm):
    if side == "R":
        w_def = ramp(f, 4, 12) * (1 - ramp(f, 58, 78))
        w_off = ramp(f, 102, 120)
        hdir = hdir.lerp((UP * 0.85 + B["cf"] * 0.15).normalized(), w_def)
        palm = palm.lerp(B["cf"], w_def)
        hdir = hdir.lerp((B["cf"] * 0.8 - UP * 0.2).normalized(), w_off).normalized()
        palm = palm.lerp(UP, w_off)
    else:
        w = ramp(f, 5, 14) * (1 - ramp(f, 60, 80))
        hdir = hdir.lerp((B["cr"] * 0.8 + UP * 0.4).normalized(), w).normalized()
        palm = palm.lerp(-B["cf"], w)
    return hdir, palm


# ------------------------------------------------------------------ dragon
D_ROOT = Track([(1, V((0, 0.0, GD + 0.36))), (84, V((0, 0.0, GD + 0.36))), (88, V((0, -0.02, GD + 0.40))),
                (92, V((0, -0.02, GD + 0.36))), (96, V((0, -0.03, GD + 0.39))), (100, V((0, -0.03, GD + 0.36))),
                (120, V((0, -0.06, GD + 0.36)))])
D_YAW = Track([(1, -78.0), (60, -86.0), (120, -90.0)])
D_PITCH = Track([(1, 6.0), (120, 8.0)])
HEAD_LOCAL = Track([(1, V((0, 0.45, 0.5))), (27, V((0, 0.46, 0.49))), (48, V((0, 0.5, 0.43))), (70, V((0, 0.5, 0.44))),
                    (90, V((0, 0.47, 0.5))), (120, V((0, 0.48, 0.48)))])
D_ROLL = Track([(1, 0.0), (36, 0.0), (50, 24.0), (66, 18.0), (84, 18.0), (93, -15.0), (108, -6.0), (120, 0.0)])
D_JAW = Track([(1, 0.0), (44, 0.0), (48, 12.0), (54, 0.0), (86, 0.0), (90, 16.0), (97, 0.0)])
D_EYE = Track([(1, 1.0), (32, 1.0), (35, 0.1), (39, 1.0), (84, 1.0), (90, 0.45), (104, 0.55), (112, 1.0)])
PUPIL = Track([(1, 0.45), (30, 0.45), (46, 1.0), (120, 1.0)])
D_FOLD = Track([(1, 0.35), (45, 0.8), (120, 0.9)])
D_FLAP = Track([(1, 0.0), (84, 0.0), (87, 14.0), (90, 0.0), (93, 10.0), (96, 0.0)])
D_WAG = Track([(1, 0.6), (80, 0.8), (90, 1.8), (120, 1.5)])
DS = {}


def cu_dragon_state(f):
    if f in DS:
        return DS[f]
    M = bs.dragon_body_matrix(f)
    HP = M @ HEAD_LOCAL(f)
    look = bs.person_body(f)["head_c"] + UP * 0.02
    hf = (look - HP).normalized()
    sway = 3.0 * nz(f * 0.05, 71)
    Hm = bs.frame_yz(HP, hf, UP) @ rot("Y", D_ROLL(f) + sway)
    DS[f] = dict(M=M, HP=HP, H=Hm, nb=M @ V((0, 0.3, 0.1)))
    return DS[f]


# ------------------------------------------------------------------ cameras
def ph(f):
    return bs.person_body(f)["head_c"]


def dh(f):
    return bs.dragon_state(f)["HP"]


def d_eyes(f):
    return bs.dragon_state(f)["H"] @ V((0, 0.08, 0.035))


def eye_line(f):
    v = dh(f) - ph(f)
    v.z = 0
    v.normalize()
    return v, V((v.y, -v.x, 0))      # toward the dragon, and the side all cameras stay on


def fixed(f_ref, base, a, b, f0, f1):
    """Camera position from the eye line at f_ref, pushing from offset a to offset b."""
    v, side = eye_line(f_ref)
    p0 = base(f_ref) + v * a[0] + side * a[1] + UP * a[2]
    p1 = base(f_ref) + v * b[0] + side * b[1] + UP * b[2]
    return Track([(f0, p0), (f1, p1)], "linear")


def build_shots():
    return [
        bs.Shot("CU1_Person_Afraid", 1, 26, fixed(13, ph, (1.05, 0.2, -0.22), (0.97, 0.19, -0.2), 1, 26),
                lambda f: ph(f) - UP * 0.13, Track([(1, 45.0)]), 2.2, 0.0025),
        bs.Shot("CU2_Dragon_Cute", 27, 55, fixed(41, dh, (-0.92, 0.26, 0.1), (-0.85, 0.24, 0.09), 27, 55),
                d_eyes, Track([(27, 50.0)]), 2.8, 0.0025),
        bs.Shot("CU3_Person_Softens", 56, 80, fixed(68, ph, (0.95, 0.19, -0.2), (0.88, 0.18, -0.19), 56, 80),
                lambda f: ph(f) - UP * 0.06, Track([(56, 50.0)]), 2.2, 0.0025),
        bs.Shot("CU4_Dragon_Happy", 81, 98, fixed(90, dh, (-0.88, 0.26, 0.1), (-0.82, 0.24, 0.09), 81, 98),
                d_eyes, Track([(81, 50.0)]), 2.8, 0.003),
        bs.Shot("MS5_Person_Approaches", 99, FRAMES, fixed(110, dh, (0.8, 0.26, 0.12), (0.86, 0.28, 0.13), 99, FRAMES),
                lambda f: ph(f) - UP * 0.35, Track([(99, 40.0)]), 2.8, 0.003),
    ]


def add_face_fills():
    """Soft warm fills so both faces read in close-up (the dragon is backlit, the person in tree shade)."""
    for name, energy, pos, tgt in (("CU_Fill_Dragon", 5.0, V((0.5, -1.3, G0 + 1.3)), V((0.0, -0.46, G0 + 0.86))),
                                   ("CU_Fill_Person", 4.0, V((0.45, -1.05, G0 + 1.75)), V((0.0, -2.0, G0 + 1.5)))):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.size = 0.8
        ld.color = (1.0, 0.9, 0.8)
        lo = bpy.data.objects.new(name, ld)
        bs.C_LIGHT.objects.link(lo)
        z = (pos - tgt).normalized()          # area lights shine along local -Z
        x = UP.cross(z).normalized()
        lo.matrix_world = bs.basis(x, z.cross(x), z, pos)


def main(out_path):
    # same vegetation keep-out as the film, so the forest is identical
    for sh in bs.SHOTS:
        for f in range(sh.f0, sh.f1 + 1, 6):
            p = sh.pos(f)
            bs.CAMERA_KEEP_OUT.append((p.x, p.y))
    W = bs.build_world(face_rig=True, cute_eyes=True)
    bs.animate_world(W, SRC, key=1)
    bs.PB.clear()
    bs.DS.clear()
    bs._FEET.clear()

    # swap in the close-up performance
    bs.FOOT_KEYS = FOOT_KEYS
    bs.person_pelvis = cu_pelvis
    bs.walk_lean_sway = lambda f: 0.0
    bs.LEAN, bs.HEAD_ROLL = LEAN, HEAD_ROLL
    bs.FACE_FEAR, bs.FACE_SMILE, bs.FACE_BLINK = FACE_FEAR, FACE_SMILE, FACE_BLINK
    bs.HAND_R, bs.HAND_L, bs.HAND_ORIENT = HAND_R, HAND_L, hand_orient
    bs.PALM_DOWN_W = bs.HUG_W = Track([(1, 0.0)])
    bs.D_ROOT, bs.D_YAW, bs.D_PITCH = D_ROOT, D_YAW, D_PITCH
    bs.D_JAW, bs.D_EYE, bs.PUPIL = D_JAW, D_EYE, PUPIL
    bs.D_FOLD, bs.D_FLAP, bs.D_WAG, bs.D_TAIL_CURL = D_FOLD, D_FLAP, D_WAG, Track([(1, 0.0)])
    bs.dragon_state = cu_dragon_state
    bs.look_target = lambda f: bs.dragon_state(f)["HP"] + UP * 0.03

    for f in range(1, FRAMES + 1):
        bs.pose_person(W["P"], f)
        bs.pose_dragon(W["D"], f)
    add_face_fills()
    cams = bs.build_cameras(build_shots(), FRAMES)
    bs.scene.camera = cams[0]
    bs.scene.frame_start, bs.scene.frame_end = 1, FRAMES
    bs.KS.flush()
    bs.save(out_path)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    main(argv[argv.index("--out") + 1] if "--out" in argv else "dragon_egg_closeup.blend")
