import numpy as np
def decode(data, start=0, max_blocks=None, stop_at_end=True):
    out=[]; p1=p2=0; i=start; n=0
    while i+9<=len(data):
        h=data[i]; shift=h>>4; filt=(h>>2)&3; end=h&1
        for b in data[i+1:i+9]:
            for nib in (b>>4, b&15):
                s = nib-16 if nib>=8 else nib
                if shift<=12: s=(s<<shift)>>1
                else: s = -2048 if s<0 else 0
                if filt==1: s += p1 + ((-p1)>>4)
                elif filt==2: s += (p1<<1) + ((-3*p1)>>5) - p2 + (p2>>4)
                elif filt==3: s += (p1<<1) + ((-13*p1)>>6) - p2 + ((p2*3)>>4)
                s=max(-32768,min(32767,s)); s=((s<<1)&0xffff); s= s-0x10000 if s>=0x8000 else s; s>>=1
                out.append(s); p2=p1; p1=s
        i+=9; n+=1
        if (end and stop_at_end) or (max_blocks and n>=max_blocks): break
    return np.array(out,np.int32), i
def scan(rom, minblocks=150):
    """find runs of plausible BRR blocks ending with an END flag"""
    res=[]; n=len(rom); i=0
    # candidate: block where header has end bit set; walk backwards in 9-byte steps while headers look valid and have no end bit
    ends=[k for k in range(n-9) if (rom[k]&1) and (rom[k]>>4)<=12]
    seen=set()
    for e in ends:
        k=e-9; cnt=1
        while k>=0 and (rom[k]&1)==0 and (rom[k]>>4)<=12 and (rom[k]>>4)>=1: k-=9; cnt+=1
        if cnt>=minblocks:
            s=k+9
            if s in seen: continue
            seen.add(s); res.append((s,e+9,cnt))
    return res
