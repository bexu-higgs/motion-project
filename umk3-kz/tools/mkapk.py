"""Repack the original APK with the translated ROM and a raised targetSdkVersion."""
import sys, zipfile, struct, io, os
def patch_target_sdk(axml, new_target=24):
    b = bytearray(axml)
    # string pool chunk at offset 8
    sp_off = 8
    typ, hsz, size = struct.unpack_from('<HHI', b, sp_off)
    nstr, nsty, flags, str_start, sty_start = struct.unpack_from('<IIIII', b, sp_off + 8)
    utf8 = flags & 0x100
    offs = struct.unpack_from('<%dI' % nstr, b, sp_off + hsz)
    def get(i):
        p = sp_off + str_start + offs[i]
        if utf8:
            n = b[p]; p += 1
            if n & 0x80: p += 1
            n2 = b[p]; p += 1
            if n2 & 0x80: n2 = ((n2 & 0x7f) << 8) | b[p]; p += 1
            return bytes(b[p:p+n2]).decode('utf8', 'replace')
        n = struct.unpack_from('<H', b, p)[0]; p += 2
        return bytes(b[p:p+2*n]).decode('utf-16le')
    names = {get(i): i for i in range(nstr)}
    tgt = names['targetSdkVersion']
    # walk chunks, find start-tag 'uses-sdk'
    p = sp_off + size; patched = False
    while p < len(b):
        ctyp, chsz, csz = struct.unpack_from('<HHI', b, p)
        if ctyp == 0x0180: p += csz; continue
        if ctyp == 0x0102:   # START_TAG
            ns, name = struct.unpack_from('<iI', b, p + 16)
            attr_start, attr_size, attr_count = struct.unpack_from('<HHH', b, p + 24)
            a0 = p + 16 + attr_start
            for k in range(attr_count):
                a = a0 + k * attr_size
                ans, aname, araw, vsize, vres0, vtype, vdata = struct.unpack_from('<iIiHBBI', b, a)
                if aname == tgt:
                    struct.pack_into('<I', b, a + 16, new_target); patched = True
        p += csz
    assert patched, 'targetSdkVersion not found'
    return bytes(b)

def make_rom_zip(smc_bytes):
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('umk3.smc', smc_bytes)
    return bio.getvalue()

def repack(src_apk, rom_sfc, out_apk, header):
    smc = header + open(rom_sfc, 'rb').read()
    zin = zipfile.ZipFile(src_apk)
    with zipfile.ZipFile(out_apk, 'w') as zout:
        for info in zin.infolist():
            if info.filename.startswith('META-INF/'): continue
            data = zin.read(info.filename)
            if info.filename == 'assets/rom.zip': data = make_rom_zip(smc)
            if info.filename == 'AndroidManifest.xml': data = patch_target_sdk(data)
            ni = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            ni.compress_type = info.compress_type; ni.external_attr = info.external_attr
            zout.writestr(ni, data)

if __name__ == '__main__':
    src, rom, out, orig_smc = sys.argv[1:5]
    header = open(orig_smc, 'rb').read()[:512]
    repack(src, rom, out, header)
    print('wrote', out, os.path.getsize(out))
