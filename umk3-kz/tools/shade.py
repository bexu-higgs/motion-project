import numpy as np
from collections import Counter, defaultdict
from fonts import small, big, NAMES
SHIFT={'small':[2,2,1,1,1,1,0,0,0,0,0,0],'big':[3,3,2,2,2,1,1,1,0,0,0,0]}
THR=3
def _key(m,y,x,r):
    H,W=m.shape; k=0
    for dy in range(-r,r+1):
        for dx in range(-r,r+1):
            yy,xx=y+dy,x+dx
            k=k*2+int(bool(m[yy,xx]) if 0<=yy<H and 0<=xx<W else 0)
    return k
class Shader:
    def __init__(self,rom,font):
        get=small if font=='small' else big
        self.font=font
        self.s3=defaultdict(Counter); self.s5=defaultdict(Counter)
        for i in range(0x2f):
            if NAMES[i] in '©®': continue
            g=get(rom,i); m=g>=THR
            for y in range(16):
                for x in range(g.shape[1]):
                    self.s3[_key(m,y,x,1)][g[y,x]]+=1; self.s5[_key(m,y,x,2)][g[y,x]]+=1
    def shade(self,m):
        out=np.zeros(m.shape,np.uint8)
        for y in range(m.shape[0]):
            for x in range(m.shape[1]):
                c5=self.s5.get(_key(m,y,x,2))
                if c5 and sum(c5.values())>=2: v=c5.most_common(1)[0][0]
                else:
                    c3=self.s3.get(_key(m,y,x,1))
                    if c3: v=c3.most_common(1)[0][0]
                    else: v=6 if m[y,x] else 0
                if m[y,x] and v<THR: v=THR+2
                if not m[y,x] and v>=THR: v=2
                out[y,x]=v
        return out
def italic(rows,font,width):
    """rows: list of upright strings ('#'=ink); returns sheared bool mask of shape (16,width)"""
    sh=SHIFT[font]; m=np.zeros((16,width),bool)
    for y,r in enumerate(rows):
        for x,ch in enumerate(r):
            if ch=='#':
                xx=x+sh[y] if y<len(sh) else x
                if 0<=xx<width: m[y,xx]=True
    return m
