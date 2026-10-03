#!/usr/bin/env python3
"""Verify that the static VR build is complete and tile geometry is correct. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageChops
import argparse, math, re, sys
FACES='flbrud'

def mse_images(a,b):
    diff=ImageChops.difference(a,b)
    hist=diff.histogram(); channels=3; pixels=a.width*a.height*channels
    total=0
    for i,count in enumerate(hist): total+=(i%256)**2*count
    return total/pixels

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--root',default='.',type=Path);args=ap.parse_args();root=args.root
    face_files=sorted((root/'assets/faces').glob('*.jpg'))
    stems=sorted({p.stem.rsplit('_',1)[0] for p in face_files})
    errors=[]
    for stem in stems:
        for face in FACES:
            src=root/'assets/faces'/f'{stem}_{face}.jpg'
            if not src.exists(): errors.append(f'missing {src}');continue
            with Image.open(src) as im:
                if im.size!=(2048,2048): errors.append(f'bad source size {src}: {im.size}')
            base=root/'assets/pano'/stem/'base'/f'{face}.jpg'
            if not base.exists(): errors.append(f'missing {base}')
            for n,lev in ((2,'l1'),(4,'l2')):
                for row in range(n):
                    for col in range(n):
                        tile=root/'assets/pano'/stem/lev/face/f'{row}_{col}.jpg'
                        if not tile.exists(): errors.append(f'missing {tile}');continue
                        with Image.open(tile) as im:
                            if im.size!=(512,512): errors.append(f'bad tile size {tile}: {im.size}')
    # Reconstruct the front face for every room to catch row/column mistakes and quality regressions.
    ps=[]
    for stem in stems:
        src=Image.open(root/'assets/faces'/f'{stem}_f.jpg').convert('RGB')
        out=Image.new('RGB',(2048,2048))
        for r in range(4):
            for c in range(4):
                with Image.open(root/'assets/pano'/stem/'l2'/'f'/f'{r}_{c}.jpg') as tile: out.paste(tile.convert('RGB'),(c*512,r*512))
        mse=mse_images(src,out);psnr=99 if mse==0 else 20*math.log10(255/math.sqrt(mse));ps.append(psnr)
        if psnr<38: errors.append(f'low reconstructed PSNR {stem}: {psnr:.2f} dB')
    js=(root/'assets/app.js').read_text('utf-8')
    if 'http://' in js or 'https://' in js: errors.append('app.js unexpectedly depends on an external URL')
    if 'maxHigh=this.mobile?32:64' not in js: errors.append('bounded high-resolution cache setting missing')
    print(f'rooms: {len(stems)}, source faces: {len(face_files)}, PSNR min/mean/max: {min(ps):.2f}/{sum(ps)/len(ps):.2f}/{max(ps):.2f} dB')
    if errors:
        for e in errors: print('ERROR:',e)
        return 1
    print('Build verified OK')
    return 0
if __name__=='__main__': sys.exit(main())
