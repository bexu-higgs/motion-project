"""Insert new voice recordings.  usage: apply_voice.py in.sfc out.sfc <dir with NN.wav/mp3/...> [catalog.json]
File names must start with the clip number from the catalog (e.g. 52.wav or 52_finish_him.mp3)."""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(__file__))
import voice
src, dst, d = sys.argv[1:4]
cat_path = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(__file__), '..', 'voice_catalog.json')
cat = {c['id']: c for c in json.load(open(cat_path))}
rom = open(src, 'rb').read()
for fn in sorted(os.listdir(d)):
    m = re.match(r'(\d+)', fn)
    if not m or fn.endswith('.tmp.wav'): continue
    sid = int(m.group(1))
    if sid not in cat: print('skip (unknown id):', fn); continue
    rom = voice.replace(rom, cat[sid], os.path.join(d, fn))
    print(f'clip {sid:02d} <- {fn}  (max {cat[sid]["seconds"]} s)')
open(dst, 'wb').write(rom)
