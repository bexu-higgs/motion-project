import numpy as np
from gfx import decode_tile, encode_tile
SMALL_BASE=0x14c5a9; BIG_BASE=0x14ae29
NAMES='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/():!.-,\'©®'
def small(rom,i):
    o=SMALL_BASE+i*64; return np.vstack([decode_tile(rom[o:o+32],4),decode_tile(rom[o+32:o+64],4)])
def big(rom,i):
    o=BIG_BASE+i*128; t=[decode_tile(rom[o+k*32:o+k*32+32],4) for k in range(4)]
    return np.block([[t[0],t[1]],[t[2],t[3]]])
def enc_small(a):
    return encode_tile(a[:8],4)+encode_tile(a[8:16],4)
def enc_big(a):
    return encode_tile(a[:8,:8],4)+encode_tile(a[:8,8:],4)+encode_tile(a[8:,:8],4)+encode_tile(a[8:,8:],4)
def grid(a,rows=None):
    a=a if rows is None else a[:rows]
    return '\n'.join(''.join('.123456789abcdef'[c] for c in r) for r in a)
