import numpy as np
from PIL import Image
def decode_tile(b, bpp):
    """SNES planar tile -> 8x8 array of color indices"""
    t=np.zeros((8,8),np.uint8)
    for y in range(8):
        for p in range(bpp):
            base=(p//2)*16 + y*2 + (p%2)
            byte=b[base]
            for x in range(8):
                if byte & (0x80>>x): t[y,x]|=1<<p
    return t
def encode_tile(t,bpp):
    out=bytearray(8*bpp)
    for y in range(8):
        for p in range(bpp):
            base=(p//2)*16 + y*2 + (p%2)
            v=0
            for x in range(8):
                if t[y,x]>>p &1: v|=0x80>>x
            out[base]=v
    return bytes(out)
def sheet(data,bpp,cols=32,ntiles=None,scale=2,pal=None):
    sz=8*bpp; n=len(data)//sz if ntiles is None else ntiles
    rows=(n+cols-1)//cols
    img=np.zeros((rows*8,cols*8),np.uint8)
    for i in range(n):
        t=decode_tile(data[i*sz:(i+1)*sz],bpp)
        img[(i//cols)*8:(i//cols)*8+8,(i%cols)*8:(i%cols)*8+8]=t
    mx=(1<<bpp)-1
    im=Image.fromarray((img.astype(np.uint16)*255//mx).astype(np.uint8))
    return im.resize((im.width*scale,im.height*scale),Image.NEAREST)
