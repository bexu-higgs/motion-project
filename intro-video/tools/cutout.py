#!/usr/bin/env python3
"""Cut the portrait out of its background, offline (rembg + BiRefNet-portrait).

Usage: python3 tools/cutout.py <photo.jpg> [scene/assets/portrait-cutout.png]
Model: https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-portrait-epoch_150.onnx
       saved as ~/.u2net/birefnet-portrait.onnx
"""
import sys

import numpy as np
from PIL import Image
from rembg import new_session, remove

src = sys.argv[1]
dst = sys.argv[2] if len(sys.argv) > 2 else "scene/assets/portrait-cutout.png"
out = remove(Image.open(src).convert("RGB"), session=new_session("birefnet-portrait"), post_process_mask=False)
a = np.asarray(out.convert("RGBA")).copy()
alpha = a[..., 3].astype(np.float32)
a[..., 3] = np.clip((alpha - 14) * (255 / 241), 0, 255).astype(np.uint8)  # drop faint haze
Image.fromarray(a).save(dst, optimize=True)
print("wrote", dst)
