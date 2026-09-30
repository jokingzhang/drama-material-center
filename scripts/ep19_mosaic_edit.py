"""Local EP19 chest mosaic: reviewed anchors, per-shot optical flow, Jianying draft.

Source remains untouched. Tracking is baked into the new video, not represented
as a native Jianying motion-tracker effect. No cloud upload is used.
"""
import os
import sys
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
skill_root = os.environ.get('JY_SKILL_ROOT', str(ROOT / '.agents/skills/jianying-editor'))
if not Path(skill_root, 'scripts/jy_wrapper.py').exists():
    raise ImportError('jianying-editor scripts missing')
sys.path.insert(0, str(Path(skill_root, 'scripts')))

SRC = Path('/Users/zhangboxuan/Downloads/EP19.mp4')
WORK = Path('/tmp/ep19-review')
OUT = Path('/Users/zhangboxuan/Downloads/EP19-胸前跟踪马赛克-v02.mp4')
# Coordinates are on 216 x 384 review frames. Values: center x/y, width/height.
ANCHORS = {
    2:(184,23,28,26), 6:(100,172,24,22), 7:(108,162,34,30),
    8:(122,190,20,20),9:(141,174,18,18),10:(142,184,16,18),
    11:(149,181,18,20),12:(156,176,22,24),13:(153,230,12,18),
    14:(151,228,12,18),15:(152,231,12,18),16:(144,211,10,12),
    17:(145,210,10,12),18:(122,209,12,14),19:(145,266,30,26),
    20:(147,267,30,28),21:(132,269,30,28),22:(130,271,30,28),
    23:(149,218,14,16),24:(128,198,14,16),26:(40,229,14,16),
    27:(132,239,14,16),28:(132,145,14,16),29:(56,171,14,14),
    30:(126,184,10,12),31:(116,159,14,16),32:(118,184,14,18),
    33:(96,246,20,22),34:(163,229,20,22),35:(82,170,14,16),
    36:(108,179,14,16),41:(75,181,20,18),42:(65,206,28,24),
    43:(55,220,28,24),44:(84,168,14,16),45:(153,176,20,18),
    46:(154,188,20,18),47:(153,184,20,18),48:(152,185,20,18),
    49:(151,181,20,18),50:(154,261,34,28),51:(136,258,34,28),
    52:(129,255,36,30),53:(115,257,38,30),54:(115,258,38,30),
    56:(153,182,20,18),57:(203,188,20,18),60:(165,179,22,20),
    61:(183,180,22,20),66:(113,315,42,32),67:(114,316,42,32),
}
# Refinement after inspecting enlarged coordinate grids.
ANCHORS.update({6:(100,162,24,22),8:(120,177,20,20),9:(140,174,18,18),
  10:(143,182,18,20),11:(149,178,18,20),12:(148,182,22,22),
  13:(147,237,12,18),14:(147,237,12,18),15:(147,238,12,18),
  16:(144,192,12,14),17:(145,191,12,14),18:(122,190,12,14),
  19:(140,269,30,28),20:(146,265,30,28),21:(131,268,30,28),
  23:(140,166,14,18),24:(128,161,14,18),26:(51,165,14,18),
  27:(133,164,16,18),28:(140,173,14,18),29:(56,175,16,18),
  31:(116,171,16,18),32:(92,182,14,18),33:(95,244,20,22),
  34:(180,244,18,22),35:(86,181,14,18),36:(91,178,14,18),
  41:(75,175,22,20),42:(69,177,28,24),43:(53,185,28,24),
  44:(98,177,14,18),45:(151,172,22,20),46:(153,173,22,20),
  47:(153,173,22,20),48:(152,174,22,20),49:(150,173,22,20),
  50:(156,236,34,28),51:(141,238,34,28),52:(129,245,36,30),
  56:(154,177,22,20),57:(202,178,22,20),60:(167,179,24,22),
  61:(183,176,24,22),66:(110,320,44,36),67:(114,322,44,36)})
del ANCHORS[30]
EXTRA = {5.8:(107,98,38,30),6.5:(100,105,38,30),
  15.5:(215,175,18,20),16.0:(164,175,18,20),16.5:(143,176,18,20),
  89.8:(109,190,14,18),90.5:(105,233,14,18)}
DANCE = {
  52.6333:(52,162,14,18),52.75:(68,168,14,18),53.25:(42,155,14,18),
  53.75:(68,167,14,18),54.0:(86,167,14,18),55.0:(130,162,16,18),
  55.25:(150,163,16,18),55.75:(182,157,16,18),56.25:(174,164,16,18),
  56.75:(150,170,16,18),58.05:(83,173,16,18),58.25:(74,175,16,18),
  58.75:(56,175,16,18),59.25:(76,179,16,18),59.75:(53,181,16,18),
  61.05:(116,190,14,18),61.25:(133,187,14,18),61.75:(170,182,14,18),
  62.25:(154,171,14,18),62.75:(129,168,14,18),63.25:(98,182,14,18),
  64.15:(81,195,14,18),64.25:(85,196,14,18),64.75:(93,192,14,18),
  65.25:(105,190,14,18),65.75:(105,196,14,18),66.25:(104,206,16,20),
  66.75:(105,226,20,22),66.966667:(95,244,20,22),
  67.25:(98,246,20,22),67.6:(98,249,20,22)}

def prepare():
    import cv2
    import numpy as np
    from PIL import Image, ImageDraw
    cv2.setNumThreads(2)
    cap=cv2.VideoCapture(str(SRC)); samples=[]
    for n in range(81):
        cap.set(cv2.CAP_PROP_POS_FRAMES, 29+60*n)
        ok, f=cap.read()
        if not ok: break
        f=cv2.resize(f,(216,384))
        if n in ANCHORS:
            x,y,w,h=ANCHORS[n]
            cv2.rectangle(f,(int(x-w/2),int(y-h/2)),(int(x+w/2),int(y+h/2)),(0,255,0),1)
        im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB))
        d=ImageDraw.Draw(im);d.rectangle((0,0,112,20),fill='black');d.text((3,3),f'{n}: {(29+60*n)/30:.2f}s',fill='white')
        samples.append(im)
    for k in range(3):
        sheet=Image.new('RGB',(216*7,384*4))
        for j,im in enumerate(samples[k*28:(k+1)*28]):sheet.paste(im,((j%7)*216,(j//7)*384))
        sheet.save(WORK/f'anchors-{k}.jpg')

def track():
    import cv2
    import numpy as np
    cv2.setNumThreads(2)
    cap=cv2.VideoCapture(str(SRC)); total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cuts=[0,68,116,168,208,292,327,450,780,1132,1393,1512,1579,
          2029,2118,2329,2427,2449,2656,2719,3008,3286,3368,3477,
          3578,3698,3970,4081,4378,4625,4793,4862,total]
    cuts=sorted(set(cuts))
    seeds={29+60*n:np.array(r,dtype=float)*2.5 for n,r in ANCHORS.items()}
    seeds.update({round(t*30):np.array(r,dtype=float)*2.5 for t,r in EXTRA.items()})
    boxes=[None]*total

    def step(g1,g2,b):
        x,y,w,h=b
        mask=np.zeros(g1.shape,np.uint8)
        # Include the dress texture around the cleavage; exclude face/background.
        x0=max(0,int(x-w*1.15));x1=min(540,int(x+w*1.15))
        y0=max(0,int(y-h*.75));y1=min(960,int(y+h*1.5))
        mask[y0:y1,x0:x1]=255
        pts=cv2.goodFeaturesToTrack(g1,90,.015,4,mask=mask)
        if pts is None or len(pts)<5:return b.copy()
        nxt,status,_=cv2.calcOpticalFlowPyrLK(g1,g2,pts,None,winSize=(25,25),maxLevel=3)
        rev,rs,_=cv2.calcOpticalFlowPyrLK(g2,g1,nxt,None,winSize=(25,25),maxLevel=3)
        good=(status[:,0]>0)&(rs[:,0]>0)&(np.linalg.norm(rev[:,0]-pts[:,0],axis=1)<1.7)
        if good.sum()<5:return b.copy()
        a=pts[good,0];z=nxt[good,0]
        M,inliers=cv2.estimateAffinePartial2D(a,z,method=cv2.RANSAC,ransacReprojThreshold=2.5)
        if M is None:return b.copy()
        scale=np.clip(np.hypot(M[0,0],M[0,1]),.97,1.03)
        c=M[:,:2]@np.array([x,y])+M[:,2]
        if np.linalg.norm(c-[x,y])>35:return b.copy()
        return np.array([c[0],c[1],w*scale,h*scale])

    for start,end in zip(cuts,cuts[1:]):
        aa=sorted(i for i in seeds if start<=i<end)
        if not aa:
            print(f'Skip {start/30:.2f}-{end/30:.2f}',flush=True)
            continue
        cap.set(cv2.CAP_PROP_POS_FRAMES,start); gray=[]
        for i in range(start,end):
            ok,f=cap.read()
            if not ok:raise RuntimeError(f'Decode failed at {i}')
            gray.append(cv2.cvtColor(cv2.resize(f,(540,960)),cv2.COLOR_BGR2GRAY))
        # Two-sided optical flow between reviewed anchors avoids accumulated drift.
        for ia,ib in zip(aa,aa[1:]):
            forward=[seeds[ia].copy()]
            for i in range(ia,ib):forward.append(step(gray[i-start],gray[i+1-start],forward[-1]))
            backward=[seeds[ib].copy()]
            for i in range(ib,ia,-1):backward.append(step(gray[i-start],gray[i-1-start],backward[-1]))
            backward.reverse()
            for j,i in enumerate(range(ia,ib+1)):
                u=j/(ib-ia);boxes[i]=((1-u)*forward[j]+u*backward[j]).tolist()
        for direction,anchor,limit in [(-1,aa[0],start),(1,aa[-1],end-1)]:
            b=seeds[anchor].copy();boxes[anchor]=b.tolist()
            for i in range(anchor+direction,limit+direction,direction):
                b=step(gray[i-direction-start],gray[i-start],b);boxes[i]=b.tolist()
        # In the dancing take the neckline faces away for this window.
        for lo,hi in [(3.866667,4.6),(5.25,5.6),(15,15.4),
                       (44.8,46.433333),(50.4,52.633333),(67.633333,70.6),
                       (73.9,77.633333)]:
            for i in range(max(start,round(lo*30)),min(end,round(hi*30))):boxes[i]=None
        print(f'Tracked {start/30:.2f}-{end/30:.2f}: {len(aa)} anchors',flush=True)
    # Fast turns/occlusions require closely reviewed tracking keyframes. Blend
    # these dense observations instead of allowing the tracker to follow hands.
    tt=np.array(sorted(DANCE)); rr=np.array([DANCE[t] for t in tt])*2.5
    for i in range(1579,2029):
        t=i/30
        boxes[i]=[float(np.interp(t,tt,rr[:,j])) for j in range(4)]
        if any(lo<=t<hi for lo,hi in [(54.05,54.95),(56.95,58.05),(60.0,61.05),(63.55,64.15)]):boxes[i]=None
    (WORK/'tracking.json').write_text(json.dumps({'fps':30,'width':540,'height':960,'source':str(SRC),'boxes':boxes}))

def review():
    import cv2
    import numpy as np
    from PIL import Image, ImageDraw
    data=json.loads((WORK/'tracking.json').read_text())['boxes']
    cap=cv2.VideoCapture(str(SRC)); samples=[]
    for sec in range(163):
        idx=min(len(data)-1,sec*30+15);cap.set(1,idx);ok,f=cap.read()
        if not ok:break
        f=cv2.resize(f,(216,384));b=data[idx]
        if b is not None:
            x,y,w,h=np.array(b)/2.5
            cv2.ellipse(f,(round(x),round(y)),(max(1,round(w/2)),max(1,round(h/2))),0,0,360,(0,255,0),1)
        im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));d=ImageDraw.Draw(im);d.rectangle((0,0,70,20),fill='black');d.text((2,2),f'{idx/30:.2f}s',fill='white');samples.append(im)
    for k in range((len(samples)+27)//28):
        sheet=Image.new('RGB',(1512,1536))
        for j,im in enumerate(samples[k*28:(k+1)*28]):sheet.paste(im,((j%7)*216,(j//7)*384))
        sheet.save(WORK/f'review-{k}.jpg')

def render():
    import cv2
    import numpy as np
    cv2.setNumThreads(2)
    boxes=json.loads((WORK/'tracking.json').read_text())['boxes']
    cap=cv2.VideoCapture(str(SRC))
    if OUT.exists():raise FileExistsError(OUT)
    enc=subprocess.Popen(['ffmpeg','-v','error','-f','rawvideo','-pix_fmt','bgr24','-s','1080x1920','-r','30','-i','pipe:0','-i',str(SRC),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',str(OUT)],stdin=subprocess.PIPE)
    for i,b in enumerate(boxes):
        ok,f=cap.read()
        if not ok:raise RuntimeError(f'Decode failed {i}')
        if b is not None:
            x,y,w,h=np.array(b)*2
            x0=max(0,round(x-w/2));x1=min(1080,round(x+w/2))
            y0=max(0,round(y-h/2));y1=min(1920,round(y+h/2))
            if x1>x0 and y1>y0:
                roi=f[y0:y1,x0:x1]; hh,ww=roi.shape[:2]
                pix=cv2.resize(cv2.resize(roi,(max(2,ww//19),max(2,hh//19)),interpolation=cv2.INTER_AREA),(ww,hh),interpolation=cv2.INTER_NEAREST)
                mask=np.zeros((hh,ww),np.uint8)
                cv2.ellipse(mask,(ww//2,hh//2),(max(1,ww//2-1),max(1,hh//2-1)),0,0,360,255,-1)
                a=cv2.GaussianBlur(mask,(5,5),0).astype(float)[:,:,None]/255
                # Existing burnt-in caption lies just above the neckline in this
                # close-up. Preserve its complete original pixel band.
                if 3970<=i<4081:
                    for yy in range(max(y0,1460),min(y1,1530)):
                        a[yy-y0,:,:]=0
                roi[:]=(roi*(1-a)+pix*a).astype(np.uint8)
        enc.stdin.write(f.tobytes())
        if i%300==0:print(f'Render {i/30:.1f}s',flush=True)
    enc.stdin.close()
    if enc.wait()!=0:raise RuntimeError('ffmpeg render failed')
    print(str(OUT),flush=True)

def draft():
    from jy_wrapper import JyProject
    p=JyProject('EP19-胸前跟踪马赛克-v02',width=1080,height=1920,overwrite=False)
    segment=p.add_media_safe(str(OUT),'0s',track_name='胸前局部跟踪合成')
    if segment is None:raise RuntimeError('Failed to add video')
    result=p.save()
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':
    {'prepare':prepare,'track':track,'review':review,'render':render,'draft':draft}[sys.argv[1]]()
