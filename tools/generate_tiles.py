#!/usr/bin/env python3
"""Generate the static multiresolution cubemap pyramid used by the VR viewer.

Usage from the repository root:
  python tools/generate_tiles.py --faces assets/faces --out assets/pano

Input files must be named ROOMSTEM_f.jpg, _l.jpg, _b.jpg, _r.jpg, _u.jpg, _d.jpg
and must currently be 2048x2048. Requires Pillow.
"""
from pathlib import Path
from PIL import Image
from concurrent.futures import ProcessPoolExecutor, as_completed
import argparse, json, os

def generate_one(path_str, out_str):
    path=Path(path_str); out=Path(out_str)
    roomstem,face=path.stem.rsplit('_',1)
    roomdir=out/roomstem
    (roomdir/'base').mkdir(parents=True,exist_ok=True)
    (roomdir/'l1'/face).mkdir(parents=True,exist_ok=True)
    (roomdir/'l2'/face).mkdir(parents=True,exist_ok=True)
    with Image.open(path) as src:
        im=src.convert('RGB')
        if im.size!=(2048,2048):
            raise ValueError(f'{path}: expected 2048x2048, got {im.size}')
        im.resize((512,512),Image.Resampling.LANCZOS).save(roomdir/'base'/f'{face}.jpg','JPEG',quality=90,subsampling=2,optimize=True)
        med=im.resize((1024,1024),Image.Resampling.LANCZOS)
        for row in range(2):
            for col in range(2):
                med.crop((col*512,row*512,(col+1)*512,(row+1)*512)).save(roomdir/'l1'/face/f'{row}_{col}.jpg','JPEG',quality=94,subsampling=2,optimize=True)
        for row in range(4):
            for col in range(4):
                im.crop((col*512,row*512,(col+1)*512,(row+1)*512)).save(roomdir/'l2'/face/f'{row}_{col}.jpg','JPEG',quality=95,subsampling=2,optimize=True)
    return path.name

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--faces',default='assets/faces',type=Path)
    ap.add_argument('--out',default='assets/pano',type=Path)
    ap.add_argument('--workers',type=int,default=min(6,max(2,(os.cpu_count() or 4)//2)))
    args=ap.parse_args()
    files=sorted(args.faces.glob('*.jpg'))
    if not files: raise SystemExit(f'No JPG faces found in {args.faces}')
    args.out.mkdir(parents=True,exist_ok=True)
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        futures=[ex.submit(generate_one,str(p),str(args.out)) for p in files]
        for n,f in enumerate(as_completed(futures),1):
            f.result()
            if n%6==0 or n==len(futures): print(f'{n}/{len(futures)} faces complete',flush=True)
    manifest={'schema':1,'faceSize':2048,'tileSize':512,'levels':[{'id':'base','faceSize':512,'tilesPerFace':1},{'id':'l1','faceSize':1024,'tilesPerFace':2},{'id':'l2','faceSize':2048,'tilesPerFace':4}],'faces':['f','l','b','r','u','d']}
    (args.out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__': main()
