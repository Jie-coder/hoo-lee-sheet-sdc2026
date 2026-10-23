import math
exec(open('gen.py').read().split('# ---- Scene 1')[0])
def tile(s,x,y,z,w=70,d=70,h=16,mark=None,light=False):
  s.box(x,y,z,w,d,h,top=W if light else O)
  col=O if light else W
  s.ft(x,y,z+h,''.join('<line x1="12" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="3" stroke-linecap="round"/>'%(16+i*12,w-14-i*12,16+i*12,col) for i in range(3)))
  if mark:s.flag(x+w/2,y+d/2,z+h,mark)
def dotted(s,a,b):s.line(a,b,2.4,'1 8')

# Scene 1: desk + CV exploding into floating task tiles
s=Sc(410,275,0.92)
s.box(-260,-140,-120,520,300,30)            # desk top
for lx,ly in [(-250,140),(230,140),(230,-130)]:s.box(lx,ly,-260,20,20,140)
s.box(-150,-80,-90,230,170,6,top=W)          # CV sheet
s.ft(-150,-80,-84,'<circle cx="34" cy="34" r="18" fill="%s"/>'%O+''.join('<line x1="66" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="5" stroke-linecap="round"/>'%(26+i*14,200-i*30,26+i*14,O) for i in range(3))+''.join('<line x1="20" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="4" stroke-linecap="round"/>'%(80+i*16,210-(i%2)*50,80+i*16,O) for i in range(5)))
s.box(120,-60,-90,60,40,30)                   # mug
s.fy(120,-20,-60,'<rect x="10" y="8" width="40" height="6" rx="3" fill="%s"/>'%W)
pos=[(-180,-120,40),(-60,-140,90),(60,-100,50),(-160,10,140),(-30,-10,190),(90,20,130)]
for x,y,z in pos:dotted(s,(x+35,y+35,-84),(x+35,y+35,z))
for x,y,z in sorted(pos,key=lambda p:p[0]+p[1]+p[2]*0.1):tile(s,x,y,z)
open('t1.svg','w').write(s.svg())

# Scene 2: balance scale
s=Sc(420,290,0.76,bg='#fc5000')
s.box(-90,-90,-160,180,180,40)
s.box(-20,-20,-120,40,40,300)
s.box(-300,-12,180,600,24,24)
s.box(-36,-36,204,72,72,24)
s.fy(-36,36,228,''.join('<circle cx="%s" cy="12" r="3" fill="%s"/>'%(14+i*11,W) for i in range(5)))
for cx,mk,light in [(-260,'ai',False),(260,'human',True)]:
  for dx,dy in [(-70,-70),(70,-70),(-70,70),(70,70)]:s.line((cx,0,180),(cx+dx,dy,20),2)
  s.box(cx-100,-100,0,200,200,20)
  tile(s,cx-80,-70,20,mark=None,light=light);tile(s,cx+5,-60,20,light=light)
  tile(s,cx-60,10,20,mark=mk,light=light);tile(s,cx-40,-40,36,mark=mk,light=light)
open('t2.svg','w').write(s.svg())

# Scene 3: gauge housing + bar tower
s=Sc(400,290,0.7)
s.box(-300,-200,-200,560,360,30)             # plinth
s.box(-240,-120,-170,300,220,330)
cx,cy,r=150,150,110
arc=lambda a0,a1,rr:'M %.1f %.1f A %s %s 0 0 1 %.1f %.1f'%(cx+rr*math.cos(a0),cy+rr*math.sin(a0),rr,rr,cx+rr*math.cos(a1),cy+rr*math.sin(a1))
g=screen(300,330,'')
for i in range(3):
  a0=math.pi+i*math.pi/3;g+='<path d="%s" fill="none" stroke="%s" stroke-width="22" opacity="%s"/>'%(arc(a0+.05,a0+math.pi/3-.05,r),W,[.3,.6,1][i])
for i in range(31):
  a=math.pi+i*math.pi/30;rr=r-34;g+='<circle cx="%.1f" cy="%.1f" r="%s" fill="%s"/>'%(cx+rr*math.cos(a),cy+rr*math.sin(a),3 if i%5==0 else 1.8,W)
na=math.pi*1.7
g+='<line x1="%s" y1="%s" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="7" stroke-linecap="round"/><circle cx="%s" cy="%s" r="14" fill="%s" stroke="%s" stroke-width="3"/>'%(cx,cy,cx+(r-16)*math.cos(na),cy+(r-16)*math.sin(na),W,cx,cy,O,W)
g+='<rect x="60" y="200" width="180" height="40" rx="20" fill="none" stroke="%s" stroke-width="3"/>'%W+''.join('<circle cx="%s" cy="220" r="3.4" fill="%s"/>'%(84+i*14,W) for i in range(10))
g+=''.join('<circle cx="%s" cy="280" r="9" fill="none" stroke="%s" stroke-width="3"/>'%(x,W) for x in (110,150,190))
s.fy(-240,100,160,g)
s.ft(-240,-120,160,''.join('<rect x="%s" y="30" width="16" height="160" rx="7" fill="none" stroke="%s" stroke-width="2"/>'%(30+i*30,W) for i in range(8)))
s.fx(60,100,160,''.join('<line x1="%s" y1="40" x2="%s" y2="290" stroke="%s" stroke-width="2"/>'%(30+i*32,30+i*32,W) for i in range(6)))
for i,h in enumerate([90,170,250]):
  x=110+i*0;y=-150+i*95
  s.box(110,y,-170,90,70,h,top=W if i==2 else O)
  s.fy(110,y+70,-170+h,''.join('<line x1="12" y1="%s" x2="78" y2="%s" stroke="%s" stroke-width="2"/>'%(16+k*18,16+k*18,W) for k in range(int(h/18)-1)))
open('t3.svg','w').write(s.svg())
