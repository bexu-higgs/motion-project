"""Build the Kazakh UMK3 ROM.  usage: build.py <in.sfc> <out.sfc>"""
import sys, os, importlib.util
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
import mklz, cyr
from fonts import small, big, enc_small, enc_big

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('kz', os.path.join(HERE, '..', 'text', 'kz_text.py'))
KZ = importlib.util.module_from_spec(spec); spec.loader.exec_module(KZ)

# ---- ROM locations (headerless HiROM file offsets) ----
CMAP_OLD = 0x88d5b; WS_OLD = 0x88db6; WB_OLD = 0x88de8
FONT_LO = 0x88d73; FONT_BANK = 0x88d77
SMALL_OLD = 0x14c5a9; BIG_BASE = 0x14ae29
FREE = 0x3fdc6e            # 0xFF padding up to end of ROM
SMALL_NEW = 0x3fdc80       # $FF:DC80
CMAP_NEW = 0x3ff000        # $FF:F000
WS_NEW = 0x3ff100; WB_NEW = 0x3ff180
BLOB_FREE = 0x3ff200       # free space for relocated text blobs ($FF:F200-$FF:FFFF)
CMAP_REFS = [0x8914d, 0x891bf]                    # operand of LDA long,X
WS_REFS = [(0x89131, 0x89136), (0x891ab, 0x891b0)] # (lo16 imm, bank imm)
WB_REFS = [(0x89125, 0x8912a), (0x8919f, 0x891a4)]
BLOBS = {  # name: (rom offset, [call-site offsets of 'LDA #lo ... LDA #bank'], font, width, maxlines)
    'intro':   (0x3c63fb, [0x3d18b], 'big', 236, 12),
    'bios':    (0x36a318, [0x7f75a], 'small', 137, 19),
    'endings': (0x259b51, [0x1f33e, 0x1f446], 'small', 138, 19),
    'credits': (0x08fd54, [0x7fb1c], 'small', 148, 8),
}
BIG_MAX_IDX = 0x47
BIG_FONT_STRINGS = (0x03b563, 0x03b569, 0x03b571, 0x03b57c, 0x03b587, 0x03b594, 0x03b5a1,
                    0x03d5ed, 0x03d601, 0x03d607, 0x03d610, 0x03d621, 0x03d62a, 0x03d640, 0x03cff5, 0x03c5d3, 0x03c5de, 0x03cd10)

def lo16(off): return off & 0xffff
def hibank(off): return 0xc0 | (off >> 16)

class Builder:
    def __init__(self, rom):
        self.rom = bytearray(rom); self.orig = bytes(rom)
        self.G = cyr.build(self.orig)
        self.log = []

    # ---------- glyph / encoding ----------
    def plan_glyphs(self):
        big_texts = [p for p in KZ.INTRO] + [b[0] for b in KZ.BIOS if b] + [KZ.STRINGS[o] for o in BIG_FONT_STRINGS if o in KZ.STRINGS]
        used_big = set()
        for t in big_texts:
            for ch in t.upper():
                c = cyr.SAME.get(ch, ch)
                if c in cyr.SMALL: used_big.add(c)
        new = list(cyr.ORDER)
        big_first = [c for c in new if c in used_big]
        rest = [c for c in new if c not in used_big]
        slots = [0x2f] + list(range(0x32, 0x60))
        if len(big_first) > 1 + (BIG_MAX_IDX - 0x32 + 1):
            raise SystemExit(f'too many distinct new letters in big-font texts: {big_first}')
        self.idx = {}
        for c, s in zip(big_first + rest, slots): self.idx[c] = s
        self.max_idx = max(self.idx.values())
        # byte codes for new letters
        self.code = {c: 0x5b + i for i, c in enumerate(new)}
        self.log.append(f'big-font letters: {"".join(big_first)}')

    def encode(self, s, font='small'):
        out = bytearray()
        for ch in s.upper():
            c = cyr.SAME.get(ch, ch)
            if c in self.code:
                if font == 'big' and self.idx[c] > BIG_MAX_IDX:
                    raise ValueError(f'letter {c} not available in big font: {s!r}')
                out.append(self.code[c])
            elif c == '\n': out.append(0)
            elif 0x20 <= ord(c) < 0x5b and c not in '"&*+=@%#$;<>':
                out.append(ord(c))
            else:
                raise ValueError(f'unsupported char {ch!r} in {s!r}')
        return bytes(out)

    def build_fonts(self):
        rom = self.rom; o = self.orig
        n = self.max_idx + 1
        # small font -> new location
        buf = bytearray()
        for i in range(n):
            ch = [c for c, k in self.idx.items() if k == i]
            if ch: buf += enc_small(self.G['small'][ch[0]])
            elif i < 0x32: buf += o[SMALL_OLD + i*64: SMALL_OLD + i*64 + 64]
            else: buf += bytes(64)
        assert SMALL_NEW + len(buf) <= CMAP_NEW, 'small font overflows'
        rom[SMALL_NEW:SMALL_NEW + len(buf)] = buf
        rom[FONT_LO:FONT_LO+2] = lo16(SMALL_NEW).to_bytes(2, 'little')
        rom[FONT_BANK:FONT_BANK+2] = bytes([hibank(SMALL_NEW), 0])
        # big font: new glyphs in the old small-font area (same bank, base unchanged)
        for i in (0x2f, 0x30, 0x31) + tuple(range(0x32, BIG_MAX_IDX + 1)):
            ch = [c for c, k in self.idx.items() if k == i]
            dst = BIG_BASE + i*128
            rom[dst:dst+128] = enc_big(self.G['big'][ch[0]]) if ch else bytes(128)
        # widths
        ws = bytearray(o[WS_OLD:WS_OLD+0x32]) + bytes(max(0, n - 0x32))
        wb = bytearray(o[WB_OLD:WB_OLD+0x32]) + bytes(max(0, n - 0x32))
        for c, k in self.idx.items():
            ws[k] = cyr.width_of(self.G['small'][c], 'small')
            if k <= BIG_MAX_IDX: wb[k] = cyr.width_of(self.G['big'][c], 'big')
        self.ws, self.wb = bytes(ws), bytes(wb)
        rom[WS_NEW:WS_NEW+len(ws)] = ws; rom[WB_NEW:WB_NEW+len(wb)] = wb
        for (lo, bk), tgt in [(r, WS_NEW) for r in WS_REFS] + [(r, WB_NEW) for r in WB_REFS]:
            rom[lo:lo+2] = lo16(tgt).to_bytes(2, 'little'); rom[bk] = hibank(tgt)
        # char map
        cmap = bytearray(o[CMAP_OLD:CMAP_OLD+0x5b]) + b'\xff' * (256 - 0x5b)
        for c, code in self.code.items(): cmap[code] = self.idx[c]
        self.cmap = bytes(cmap)
        rom[CMAP_NEW:CMAP_NEW+256] = cmap
        for r in CMAP_REFS:
            assert self.orig[r-1] == 0xbf
            rom[r:r+3] = bytes([CMAP_NEW & 0xff, (CMAP_NEW >> 8) & 0xff, hibank(CMAP_NEW)])

    # ---------- layout ----------
    def text_width(self, b, font):
        W = self.ws if font == 'small' else self.wb; w = 0
        for x in b:
            g = self.cmap[x]
            w += (6 if font == 'small' else 7) if g == 0xff else W[g] + 1
        return w

    def wrap(self, text, font, maxw):
        words = text.split(' '); lines = []; cur = ''
        for wd in words:
            if not wd: continue
            cand = (cur + ' ' + wd) if cur else wd
            if self.text_width(self.encode(cand, font), font) <= maxw:
                cur = cand; continue
            if cur: lines.append(cur); cur = ''
            # hyphenate very long words
            while self.text_width(self.encode(wd, font), font) > maxw:
                k = len(wd) - 1
                while k > 1 and self.text_width(self.encode(wd[:k] + '-', font), font) > maxw: k -= 1
                lines.append(wd[:k] + '-'); wd = wd[k:]
            cur = wd
        if cur: lines.append(cur)
        return lines

    def page_bytes(self, lines, font):
        return b''.join(self.encode(l, font) + b'\x00' for l in lines)

    def make_blob(self, name):
        off, sites, font, maxw, maxl = BLOBS[name]
        orig, _ = mklz.decompress(self.orig, off)
        opages = orig.split(b'\xff')
        tail = opages[-1]          # bytes after the last 0xFF (usually empty)
        out = bytearray(); report = []
        if name == 'intro':
            pages = [self.wrap(t, font, maxw) if t else None for t in KZ.INTRO]
        elif name == 'bios':
            pages = [None if e is None else [e[0]] + self.wrap(e[1], font, maxw) for e in KZ.BIOS]
        elif name == 'endings':
            pages = [self.wrap(t, font, maxw) if t else None for t in KZ.ENDINGS]
        else:
            pages = []
            for p in opages[:-1]:
                lines = p.split(b'\x00')[:-1] if p.endswith(b'\x00') else p.split(b'\x00')
                pages.append([KZ.CREDITS_HEADINGS.get(l.decode('latin1'), l.decode('latin1')) for l in lines])
        if len(pages) == len(opages) and not pages[-1]: pages = pages[:-1]   # trailing placeholder
        assert len(pages) == len(opages) - 1, (name, len(pages), len(opages))
        for i, (p, op) in enumerate(zip(pages, opages[:-1])):
            if p is None:
                out += op           # keep original (empty) page bytes
            else:
                if len(p) > maxl: report.append(f'{name}[{i}] has {len(p)} lines > {maxl}')
                for l in p:
                    w = self.text_width(self.encode(l, font), font)
                    if w > maxw: report.append(f'{name}[{i}] line too wide {w}: {l}')
                out += self.page_bytes(p, font)
            out += b'\xff'
        out += tail
        return bytes(out), pages, report

    def build_blobs(self):
        free = BLOB_FREE; self.blob_info = {}
        problems = []
        for name, (off, sites, font, maxw, maxl) in BLOBS.items():
            data, pages, rep = self.make_blob(name)
            problems += rep
            comp = mklz.compress(data, self.orig[off+2])
            assert mklz.decompress(comp, 0)[0] == data
            _, oend = mklz.decompress(self.orig, off)
            slot = oend - off
            orig_size = self.orig[off] | self.orig[off+1] << 8
            if len(comp) <= slot:
                dst = off
            else:
                dst = free; free += len(comp)
                assert free <= 0x400000, f'out of free space placing {name}'
            self.rom[dst:dst+len(comp)] = comp
            for s in sites:
                assert self.orig[s] == 0xa9 and self.orig[s+3:s+5] == b'\x85\x7a' and self.orig[s+5] == 0xa9
                self.rom[s+1:s+3] = lo16(dst).to_bytes(2, 'little'); self.rom[s+6] = hibank(dst)
            self.blob_info[name] = dict(size=len(data), orig_size=orig_size, comp=len(comp), slot=slot, at=hex(dst), pages=pages)
            self.log.append(f'{name}: text {len(data)} B (orig {orig_size}), compressed {len(comp)} B (slot {slot}) at {hex(dst)}')
        self.free_left = 0x400000 - free
        if problems: raise SystemExit('LAYOUT PROBLEMS:\n' + '\n'.join(problems))

    def build_strings(self):
        for off, kz in KZ.STRINGS.items():
            n = self.orig.index(b'\x00', off) - off
            font = 'big' if off in BIG_FONT_STRINGS else 'small'
            b = self.encode(kz, font)
            if len(b) > n: raise SystemExit(f'string at {off:06x} too long: {kz!r} {len(b)} > {n}')
            self.rom[off:off+n] = b + b'\x00' * (n - len(b))

    def fix_checksum(self):
        r = self.rom
        r[0xffdc:0xffe0] = b'\xff\xff\x00\x00'
        s = sum(r) & 0xffff
        r[0xffde:0xffe0] = s.to_bytes(2, 'little'); r[0xffdc:0xffde] = (s ^ 0xffff).to_bytes(2, 'little')

    def build(self):
        self.plan_glyphs(); self.build_fonts(); self.build_blobs(); self.build_strings(); self.fix_checksum()
        return bytes(self.rom)

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    b = Builder(open(src, 'rb').read())
    out = b.build()
    open(dst, 'wb').write(out)
    print('\n'.join(b.log)); print('free bytes left at end of ROM:', b.free_left)
