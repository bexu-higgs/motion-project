#!/usr/bin/env python3
"""aapt2 шығарған APK-ға classes.dex қосып, сақталған (STORED) файлдарды 4 байтқа туралайды.

usage: package_apk.py <aapt2-out.apk> <classes.dex> <out.apk>
"""
import sys
import zipfile

# WebView бұларды тікелей оқиды, ал resources.arsc міндетті түрде қысылмаған болуы керек.
STORE_EXT = ('.arsc', '.png', '.jpg', '.ogg', '.mp3', '.webp')


def main():
    src, dex, out = sys.argv[1:4]
    with zipfile.ZipFile(src) as zin, open(out, 'wb') as raw:
        zout = zipfile.ZipFile(raw, 'w')
        items = [(i, zin.read(i.filename)) for i in zin.infolist()]
        with open(dex, 'rb') as f:
            items.append((zipfile.ZipInfo('classes.dex', (2008, 1, 1, 0, 0, 0)), f.read()))
        for info, data in items:
            name = info.filename
            stored = name.endswith(STORE_EXT) or name == 'resources.arsc'
            zi = zipfile.ZipInfo(name, (2008, 1, 1, 0, 0, 0))
            zi.external_attr = 0o644 << 16
            zi.create_system = 0
            if stored:
                zi.compress_type = zipfile.ZIP_STORED
                # Жергілікті тақырып: 30 байт + аты + extra. Деректер 4-ке бөлінетін адресте басталуы тиіс.
                offset = raw.tell()
                hdr = 30 + len(name.encode('utf-8'))
                pad = (-(offset + hdr)) % 4
                zi.extra = b'\x00' * pad
            else:
                zi.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(zi, data, compress_type=zi.compress_type, compresslevel=9 if not stored else None)
        zout.close()

    # Тексеру
    with zipfile.ZipFile(out) as z, open(out, 'rb') as f:
        for i in z.infolist():
            if i.compress_type == zipfile.ZIP_STORED:
                f.seek(i.header_offset + 26)
                n = int.from_bytes(f.read(2), 'little')
                e = int.from_bytes(f.read(2), 'little')
                data_off = i.header_offset + 30 + n + e
                if data_off % 4:
                    raise SystemExit('not aligned: ' + i.filename)
    print('packaged', out)


if __name__ == '__main__':
    main()
