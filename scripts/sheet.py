# Contact sheet: python3 scripts/sheet.py out.png img1.png img2.png ...
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB').resize((432, 768)) for f in files]
sheet = Image.new('RGB', (len(ims) * 440 - 8, 768), (60, 60, 60))
for i, im in enumerate(ims):
    sheet.paste(im, (i * 440, 0))
sheet.save(out)
