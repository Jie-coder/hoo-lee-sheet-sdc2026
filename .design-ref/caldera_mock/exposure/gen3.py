import math
exec(open('gen.py').read().split('# ---- Scene 1')[0])
def dotsTop(s,x,y,z,w,d,step=16,r=1.8):
  s.ft(x,y,z,''.join('<circle cx="%s" cy="%s" r="%s" fill="%s" opacity=".55"/>'%(i,j,r,W) for i in range(step,int(w)-6,step) for j in range(step,int(d)-6,step)))
def hl(s,x,y,z,w,d,h):  # edge highlight: inset line on top face + seam on faces
  s.ft(x,y,z+h,'<rect x="6" y="6" width="%s" height="%s" rx="4" fill="none" stroke="%s" stroke-width="1.2" opacity=".6"/>'%(w-12,d-12,W))
def B(s,x,y,z,w,d,h,top=None,seams=0,dots=False,inset=True):
  s.box(x,y,z,w,d,h,top=top)
  if inset and not top:hl(s,x,y,z,w,d,h)
  if dots:dotsTop(s,x,y,z+h,w,d)
  for k in range(1,seams+1):
    zz=z+h*k/(seams+1);s.line((x,y+d,zz),(x+w,y+d,zz),1.4);s.line((x+w,y,zz),(x+w,y+d,zz),1.4)
def cable(s,pts):
  P=[s.P(*p) for p in pts];d='M%.1f %.1f C%.1f %.1f %.1f %.1f %.1f %.1f'%(*P[0],*P[1],*P[2],*P[3])
  s.out.append('<path d="%s" fill="none" stroke="%s" stroke-width="11" stroke-linecap="round"/><path d="%s" fill="none" stroke="%s" stroke-width="5" stroke-linecap="round"/>'%(d,W,d,O))
def screw(s,face,*a):pass
def tile(s,x,y,z,w=70,d=70,h=16,mark=None,light=False):
  s.box(x,y,z,w,d,h,top=W if light else O)
  col=O if light else W
  s.ft(x,y,z+h,''.join('<line x1="12" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="3" stroke-linecap="round"/>'%(16+i*12,w-14-i*12,16+i*12,col) for i in range(3))+'<circle cx="%s" cy="%s" r="4" fill="none" stroke="%s" stroke-width="2"/>'%(w-14,d-14,col))
  s.fy(x,y+d,z+h,'<line x1="6" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="1.2" stroke-dasharray="1 5" stroke-linecap="round"/>'%(h/2,w-6,h/2,W))
  if mark:s.flag(x+w/2,y+d/2,z+h,mark)
def dotted(s,a,b):s.line(a,b,2.4,'1 8')

# ===== Scene 1: desk + CV exploding into tiles
s=Sc(410,275,0.92)
# floor rug dotted
s.poly([(-330,-210,-262),(330,-210,-262),(330,230,-262),(-330,230,-262)],fill='none',sw=1.5)
dotsTop(s,-330,-210,-262,660,440,22,1.6)
for lx,ly in [(-250,140),(230,140),(230,-130)]:B(s,lx,ly,-260,20,20,140,inset=False)
B(s,-260,-140,-120,520,300,30,seams=1)
s.fy(-260,160,-90,''.join('<rect x="%s" y="8" width="70" height="12" rx="6" fill="none" stroke="%s" stroke-width="1.8"/>'%(x,W) for x in (40,400)))
# CV with paperclip and page behind
s.box(-140,-90,-90,230,170,4,top=W)
s.box(-150,-80,-86,230,170,6,top=W)
s.ft(-150,-80,-80,'<circle cx="34" cy="34" r="18" fill="%s"/>'%O+''.join('<line x1="66" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="5" stroke-linecap="round"/>'%(26+i*14,200-i*30,26+i*14,O) for i in range(3))+''.join('<line x1="20" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="4" stroke-linecap="round"/>'%(80+i*16,210-(i%2)*50,80+i*16,O) for i in range(5))+'<rect x="180" y="-6" width="14" height="34" rx="7" fill="none" stroke="%s" stroke-width="3"/>'%O)
# pen
s.box(-210,30,-90,16,110,8)
s.ft(-210,30,-82,'<line x1="8" y1="10" x2="8" y2="95" stroke="%s" stroke-width="1.5"/>'%W)
# mug + plant
B(s,120,30,-90,46,46,40,seams=1)
B(s,-230,-120,-90,50,50,36,seams=0)
for a in (0,1,2):s.out.append('')
s.line((-205,-95,-54),(-225,-110,10),3);s.line((-205,-95,-54),(-185,-90,20),3);s.line((-205,-95,-54),(-205,-80,0),3)
pos=[(-180,-120,40),(-60,-140,90),(60,-100,50),(-160,10,140),(-30,-10,190),(90,20,130)]
for x,y,z in pos:dotted(s,(x+35,y+35,-80),(x+35,y+35,z))
for x,y,z in sorted(pos,key=lambda p:p[0]+p[1]+p[2]*0.1):tile(s,x,y,z,mark=None)
open('u1.svg','w').write(s.svg())

# ===== Scene 2: tilted balance
s=Sc(420,262,0.7,bg='#fc5000')
s.poly([(-380,-220,-160),(380,-220,-160),(380,220,-160),(-380,220,-160)],fill='none',sw=1.5)
dotsTop(s,-380,-220,-160,760,440,22,1.6)
B(s,-110,-110,-160,220,220,24,seams=0,dots=False)
B(s,-90,-90,-136,180,180,24,dots=True)
B(s,-22,-22,-112,44,44,280,seams=3)
# tilted beam: left (AI) lower
tl=120
def beamZ(x):return 180+ (x/300)*tl
x0,x1,y0,d,h=-300,300,-12,24,22
pts=lambda yy,zo:[(x0,yy,beamZ(x0)+zo),(x1,yy,beamZ(x1)+zo)]
s.poly([(x0,y0,beamZ(x0)+h),(x1,y0,beamZ(x1)+h),(x1,y0+d,beamZ(x1)+h),(x0,y0+d,beamZ(x0)+h)])
s.poly([(x0,y0+d,beamZ(x0)),(x1,y0+d,beamZ(x1)),(x1,y0+d,beamZ(x1)+h),(x0,y0+d,beamZ(x0)+h)])
s.poly([(x1,y0,beamZ(x1)),(x1,y0+d,beamZ(x1)),(x1,y0+d,beamZ(x1)+h),(x1,y0,beamZ(x1)+h)])
for xx in range(-270,300,30):s.line((xx,y0+d,beamZ(xx)+4),(xx,y0+d,beamZ(xx)+h-4),1.3)
B(s,-36,-36,166,72,72,30)
s.fy(-36,36,196,''.join('<circle cx="%s" cy="15" r="3" fill="%s"/>'%(14+i*11,W) for i in range(5)))
# pointer needle
s.line((0,24,166),(0,24,90),3)
for cx,mk,light,pz in [(-260,'ai',False,-120),(260,'human',True,80)]:
  top=beamZ(cx)
  for dx,dy in [(-70,-70),(70,-70),(-70,70),(70,70)]:s.line((cx,0,top),(cx+dx,dy,pz+20),2)
  s.out.append('')
  B(s,cx-100,-100,pz,200,200,20,seams=0)
  s.ft(cx-100,-100,pz+20,'<rect x="10" y="10" width="180" height="180" rx="10" fill="none" stroke="%s" stroke-width="1.2" stroke-dasharray="1 6" stroke-linecap="round"/>'%W)
  tile(s,cx-80,-70,pz+20,light=light);tile(s,cx+5,-60,pz+20,light=light)
  tile(s,cx-60,10,pz+20,mark=mk,light=light);tile(s,cx-40,-40,pz+36,mark=mk,light=light)
# spare weights / props on floor
B(s,-300,100,-160,50,50,20);B(s,-292,108,-140,34,34,16);B(s,-286,114,-124,22,22,12)

open('u2.svg','w').write(s.svg())

# ===== Scene 3: meter + bar tower
s=Sc(400,290,0.7)
B(s,-320,-220,-230,600,400,30,seams=1)
B(s,-300,-200,-200,560,360,20,dots=True)
B(s,-240,-120,-180,300,220,10)
B(s,-240,-120,-170,300,220,330,seams=0)
cx,cy,r=150,150,110
arc=lambda a0,a1,rr:'M %.1f %.1f A %s %s 0 0 1 %.1f %.1f'%(cx+rr*math.cos(a0),cy+rr*math.sin(a0),rr,rr,cx+rr*math.cos(a1),cy+rr*math.sin(a1))
g=screen(300,330,'')
for i in range(3):
  a0=math.pi+i*math.pi/3;g+='<path d="%s" fill="none" stroke="%s" stroke-width="22" opacity="%s"/>'%(arc(a0+.05,a0+math.pi/3-.05,r),W,[.3,.6,1][i])
g+='<path d="%s" fill="none" stroke="%s" stroke-width="1.5"/>'%(arc(math.pi,2*math.pi,r+18),W)
for i in range(31):
  a=math.pi+i*math.pi/30;rr=r-34;g+='<circle cx="%.1f" cy="%.1f" r="%s" fill="%s"/>'%(cx+rr*math.cos(a),cy+rr*math.sin(a),3 if i%5==0 else 1.8,W)
na=math.pi*1.7
g+='<line x1="%s" y1="%s" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="7" stroke-linecap="round"/><circle cx="%s" cy="%s" r="14" fill="%s" stroke="%s" stroke-width="3"/>'%(cx,cy,cx+(r-16)*math.cos(na),cy+(r-16)*math.sin(na),W,cx,cy,O,W)
g+='<rect x="60" y="200" width="180" height="40" rx="20" fill="none" stroke="%s" stroke-width="3"/>'%W+''.join('<circle cx="%s" cy="220" r="3.4" fill="%s"/>'%(84+i*14,W) for i in range(10))
g+=''.join('<circle cx="%s" cy="280" r="9" fill="none" stroke="%s" stroke-width="3"/><line x1="%s" y1="272" x2="%s" y2="280" stroke="%s" stroke-width="2"/>'%(x,W,x,x,W) for x in (110,150,190))
g+=''.join('<circle cx="%s" cy="%s" r="2.5" fill="%s"/>'%(x,y,W) for x in (26,274) for y in (26,304))
s.fy(-240,100,160,g)
s.ft(-240,-120,160,''.join('<rect x="%s" y="30" width="16" height="160" rx="7" fill="none" stroke="%s" stroke-width="2"/>'%(30+i*30,W) for i in range(8)))
s.fx(60,100,160,''.join('<line x1="%s" y1="40" x2="%s" y2="290" stroke="%s" stroke-width="2"/>'%(30+i*32,30+i*32,W) for i in range(6))+'<rect x="40" y="300" width="150" height="16" rx="8" fill="none" stroke="%s" stroke-width="2"/>'%W)
# antenna
s.line((-60,-60,160),(-60,-60,240),3);s.out.append('')
B(s,-70,-70,240,20,20,10)
# bar tower on base slab, bars flush
B(s,100,-170,-180,120,320,10)
for i,h in enumerate([90,170,250]):
  y=-160+i*100
  B(s,110,y,-170,90,80,h,top=W if i==2 else None,inset=i!=2)
  s.fy(110,y+80,-170+h,''.join('<line x1="12" y1="%s" x2="78" y2="%s" stroke="%s" stroke-width="2"/>'%(16+k*18,16+k*18,W) for k in range(int(h/18)-1)))

# little tag on plinth
B(s,-290,120,-180,60,40,24)
s.fy(-290,160,-156,''.join('<circle cx="%s" cy="12" r="2.4" fill="%s"/>'%(12+k*10,W) for k in range(4)))
open('u3.svg','w').write(s.svg())
