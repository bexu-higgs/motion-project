"""UMK3 SNES text LZ codec: [size16][flag8] then tokens read forward, output written backwards.
  0x80-0xFF b1 : copy n=((c>>3)&15)+3 bytes from distance ((c&7)<<8|b1)+1 (ahead of write pos)
  0x40-0x7F    : literal run of (c&0x3f)+1 bytes (stored in forward order)
  0x20-0x3F    : copy 1 byte from distance (c&0x1f)+1
  0x00-0x1F b1 : run of (c+RUNBASE) copies of byte b1
"""
RUNBASE=None
ALLOW_RUNS=False   # the game decoder disagrees with our guess for run tokens; never emit them
def decompress(rom, off, runbase=2, check=None):
    size = rom[off] | rom[off+1] << 8
    i = off + 3
    out = bytearray(size); p = size
    while p > 0:
        c = rom[i]
        if c >= 0x80:
            n = ((c >> 3) & 0xf) + 3; d = (((c & 7) << 8) | rom[i+1]) + 1
            for k in range(n):
                p -= 1; out[p] = out[p + d]
            i += 2
        elif c >= 0x40:
            n = (c & 0x3f) + 1
            p -= n; out[p:p+n] = rom[i+1:i+1+n]; i += 1 + n
        elif c >= 0x20:
            d = (c & 0x1f) + 1; p -= 1; out[p] = out[p + d]; i += 1
        else:
            n = c + runbase
            for k in range(n): p -= 1; out[p] = rom[i+1]
            i += 2
        if check is not None and out[p:] != check[p:]:
            raise ValueError(f'mismatch at token {i:x} p={p}')
    return bytes(out), i

def compress(data, flag=1):
    """Optimal-parse compressor for the backwards LZ format above.
    Output is generated from the END of data towards the start, so we parse the reversed
    view: position p (remaining prefix length) -> tokens cover data[p-n:p]."""
    N = len(data)
    INF = 1 << 30
    # cost[p] = minimal bytes to encode data[0:p]... we decode from p=N down to 0, so do DP over p from 0 upward:
    # best[p] = min cost to produce data[0:p] (the part still to be produced when write pos is p)
    best = [INF] * (N + 1); choice = [None] * (N + 1); best[0] = 0
    # index for back-refs: source starts at p+d-? we copy out[p-1-k] = out[p-1-k+d], i.e. data[p-n:p] == data[p-n+d:p+d]
    # positions > p are already decoded. find matches by scanning candidates via a dict of 3-grams.
    from collections import defaultdict
    grams = defaultdict(list)
    for i in range(N - 2):
        grams[data[i:i+3]].append(i)
    for p in range(1, N + 1):
        # literal runs ending at p
        for n in range(1, min(64, p) + 1):
            c = best[p - n] + 1 + n
            if c < best[p]: best[p] = c; choice[p] = ('lit', n)
        # single byte copy distance 1..32
        for d in range(1, 33):
            if p - 1 + d < N and data[p-1] == data[p-1+d]:
                c = best[p-1] + 1
                if c < best[p]: best[p] = c; choice[p] = ('one', d)
                break
        # run of same byte (RLE): n = c+2, c 0..31 -> n 2..33
        if ALLOW_RUNS and p >= 2:
            b = data[p-1]; n = 1
            while n < 33 and p - n - 1 >= 0 and data[p-n-1] == b: n += 1
            for k in range(2, n + 1):
                c = best[p-k] + 2
                if c < best[p]: best[p] = c; choice[p] = ('run', k)
        # back references: copy n (3..18) bytes, distance 1..2048, source data[p-n+d : p+d]
        if p >= 3:
            maxn = min(18, p)
            # candidate source end positions e = p+d, need data[e-n:e]==data[p-n:p]
            key = data[p-3:p]
            for s in reversed(grams.get(key, [])):
                e = s + 3                      # candidate source block ends at e (exclusive)
                d = e - p
                if d < 1: continue
                if d > 2048: continue
                if e > N: continue
                # extend backwards
                n = 3
                while n < maxn and p - n - 1 >= 0 and e - n - 1 >= 0 and data[p-n-1] == data[e-n-1]: n += 1
                for k in range(3, n + 1):
                    c = best[p-k] + 2
                    if c < best[p]: best[p] = c; choice[p] = ('ref', k, d)
    # reconstruct tokens from p=N downward (decoder order)
    toks = []; p = N
    while p > 0:
        ch = choice[p]; toks.append((ch, p))
        p -= ch[1] if ch[0] != 'one' else 1
    out = bytearray([N & 0xff, N >> 8, flag])
    for ch, p in toks:
        if ch[0] == 'lit':
            n = ch[1]; out.append(0x40 | (n - 1)); out += data[p-n:p]
        elif ch[0] == 'one':
            out.append(0x20 | (ch[1] - 1))
        elif ch[0] == 'run':
            out.append(ch[1] - 2); out.append(data[p-1])
        else:
            _, n, d = ch; dd = d - 1
            out.append(0x80 | ((n - 3) << 3) | (dd >> 8)); out.append(dd & 0xff)
    return bytes(out)
