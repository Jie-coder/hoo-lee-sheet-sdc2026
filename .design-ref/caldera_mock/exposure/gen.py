import math
C,S=math.cos(math.pi/6),0.5
W='#f7f6f2';O='#121212'
class Sc:
  def __init__(s,ox,oy,k=1.0,bg='#524ae9'):s.ox,s.oy,s.k,s.out,s.bg=ox,oy,k,[],bg
  def P(s,x,y,z):return (s.ox+(x-y)*C*s.k, s.oy+((x+y)*S-z)*s.k)
  def poly(s,pts,fill=O,sw=3):
    s.out.append('<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>'%(' '.join('%.1f,%.1f'%s.P(*p) for p in pts),fill,W,sw))
  def line(s,a,b,sw=2,dash=None):
    p,q=s.P(*a),s.P(*b);d=' stroke-dasharray="%s" stroke-linecap="round"'%dash if dash else ' stroke-linecap="round"'
    s.out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%s"%s/>'%(*p,*q,W,sw,d))
  def box(s,x,y,z,w,d,h,fill=O,top=None):
    s.poly([(x,y,z+h),(x+w,y,z+h),(x+w,y+d,z+h),(x,y+d,z+h)],top or fill)
    s.poly([(x,y+d,z),(x+w,y+d,z),(x+w,y+d,z+h),(x,y+d,z+h)],fill)
    s.poly([(x+w,y,z),(x+w,y+d,z),(x+w,y+d,z+h),(x+w,y,z+h)],fill)
  # plane transforms: content in local (u right, v down) coords
  def fy(s,x0,Y,ztop,inner):  # +y face, u along x
    ex,ey=s.P(x0,Y,ztop);k=s.k
    s.out.append('<g transform="matrix(%.4f %.4f 0 %.4f %.1f %.1f)">%s</g>'%(C*k,S*k,k,ex,ey,inner))
  def fx(s,X,y0,ztop,inner):  # +x face, u along -y starting at y0 (far->near... ) 
    ex,ey=s.P(X,y0,ztop);k=s.k
    s.out.append('<g transform="matrix(%.4f %.4f 0 %.4f %.1f %.1f)">%s</g>'%(C*k,-S*k,k,ex,ey,inner))
  def ft(s,x0,y0,Z,inner):   # top face, u along x, v along y
    ex,ey=s.P(x0,y0,Z);k=s.k
    s.out.append('<g transform="matrix(%.4f %.4f %.4f %.4f %.1f %.1f)">%s</g>'%(C*k,S*k,-C*k,S*k,ex,ey,inner))
  def conveyor(s,x0,x1,y,d=110,z=0,h=26):
    s.box(x0,y,z,x1-x0,d,h)
    for x in range(int(x0)+30,int(x1),30):s.line((x,y,z+h),(x,y+d,z+h),1.6)
    s.line((x0,y+14,z+h),(x1,y+14,z+h),1.6);s.line((x0,y+d-14,z+h),(x1,y+d-14,z+h),1.6)
    for x in range(int(x0)+20,int(x1),40):
      s.fy(x,y+d,z+h,'<circle cx="0" cy="13" r="6" fill="none" stroke="%s" stroke-width="2"/>'%W)
  def ticket(s,x,y,z,w=96,d=60,h=9,mark=None,mono=False):
    s.box(x,y,z,w,d,h,top=W if mono else O)
    col=O if mono else W
    inner='<circle cx="%s" cy="0" r="9" fill="%s" stroke="%s" stroke-width="2"/><circle cx="%s" cy="%s" r="9" fill="%s" stroke="%s" stroke-width="2"/>'%(w*0.68,s.bg,W,w*0.68,d,s.bg,W)
    inner+='<line x1="%s" y1="11" x2="%s" y2="%s" stroke="%s" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>'%(w*.68,w*.68,d-11,col)
    inner+=''.join('<line x1="12" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="3" stroke-linecap="round"/>'%(14+i*12,w*.52-i*10,14+i*12,col) for i in range(3))
    s.ft(x,y,z+h,inner)
    if mark:s.flag(x+w*0.35,y+d*0.5,z+h,mark)
  def flag(s,x,y,z,kind):
    # upright badge on a post, facing viewer (+y plane)
    s.line((x,y,z),(x,y,z+40),3)
    if kind=='ai':
      g='<rect x="-24" y="-24" width="48" height="48" rx="12" fill="%s" stroke="%s" stroke-width="3"/>'%(O,W)
      g+=''.join('<circle cx="%s" cy="%s" r="2.6" fill="%s"/>'%(cx,cy,W) for cx,cy in [(0,-14),(0,-8),(0,-2),(0,4),(0,10),(0,16),(-12,1),(-6,1),(6,1),(12,1)][0:0])
      pts=[(0,-15),(0,-9),(0,9),(0,15),(-15,0),(-9,0),(9,0),(15,0),(0,-3),(0,3),(-3,0),(3,0),(0,0)]
      g+=''.join('<circle cx="%s" cy="%s" r="2.6" fill="%s"/>'%(a,b,W) for a,b in pts)
    else:
      g='<rect x="-24" y="-24" width="48" height="48" rx="12" fill="%s" stroke="%s" stroke-width="3"/>'%(W,O)
      g+='<circle cx="0" cy="-7" r="7" fill="%s"/><path d="M-13 16 C-13 3 13 3 13 16 Z" fill="%s"/>'%(O,O)
    ex,ey=s.P(x,y,z+64)
    s.out.append('<g transform="translate(%.1f %.1f)">%s</g>'%(ex,ey,g))
  def svg(s,w=820,h=520):
    return '<svg viewBox="0 0 %d %d" width="100%%" height="100%%" xmlns="http://www.w3.org/2000/svg"><rect width="%d" height="%d" fill="%s"/>%s</svg>'%(w,h,w,h,s.bg,''.join(s.out))

def screen(w,h,body):
  return '<rect x="14" y="14" width="%s" height="%s" rx="14" fill="%s" stroke="%s" stroke-width="3"/>%s'%(w-28,h-28,O,W,body)

# ---- Scene 1: CV -> scanner -> task tickets
s=Sc(330,200,0.88)
s.conveyor(-260,640,0)
# CV sheet going in
s.box(-200,15,26,110,80,8,top=W)
s.ft(-200,15,34,''.join('<line x1="14" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="4" stroke-linecap="round"/>'%(16+i*13,96-(i%3)*22,16+i*13,O) for i in range(5)))
# scanner
s.box(-20,-30,0,200,170,190)
s.ft(-20,-30,190,''.join('<rect x="%s" y="20" width="12" height="40" rx="4" fill="none" stroke="%s" stroke-width="2"/>'%(20+i*20,W) for i in range(4))+'<circle cx="160" cy="40" r="8" fill="none" stroke="%s" stroke-width="2"/>'%W)
# tunnel opening on +x face
s.fx(180,-30+170,190,'')
dots=''
rows=[7,4,9,5,6]
for r,n in enumerate(rows):
  dots+=''.join('<circle cx="%s" cy="%s" r="3.2" fill="%s"/>'%(46+i*12,52+r*16,W) for i in range(n))
s.fy(-20,140,190,screen(200,150,dots+'<rect x="40" y="134" width="120" height="6" rx="3" fill="none" stroke="%s" stroke-width="2"/><rect x="40" y="134" width="70" height="6" rx="3" fill="%s"/>'%(W,W)))
s.fy(-20,140,190,'<circle cx="40" cy="168" r="7" fill="none" stroke="%s" stroke-width="2"/><circle cx="62" cy="168" r="7" fill="none" stroke="%s" stroke-width="2"/>'%(W,W))
# exit opening
s.fx(180,140,150,'<rect x="20" y="0" width="130" height="64" rx="10" fill="%s" stroke="%s" stroke-width="3"/>'%(O,W))
for i,x in enumerate([220,350,480]):
  s.ticket(x,25,26)
open('s1.svg','w').write(s.svg())

# ---- Scene 2: tickets each get a mark under a checking gate
s=Sc(270,170,0.9,bg='#fc5000')
s.conveyor(-200,700,0)
marks=['ai','human','ai','human']
xs=[-150,60,270,480]
# gate arch
gx=150
s.box(gx,-40,0,40,30,170);
for i,x in enumerate(xs[:2]):s.ticket(x,25,26,mark=marks[i])
s.box(gx,-40,150,40,190,30)
s.fy(gx,150,180,'')
s.box(gx,120,0,40,30,170)
s.fy(gx,150,150,''.join('<circle cx="20" cy="%s" r="3" fill="%s"/>'%(20+i*14,W) for i in range(8)))
for i,x in enumerate(xs[2:]):s.ticket(x,25,26,mark=marks[i+2])
open('s2.svg','w').write(s.svg())

# ---- Scene 3: tickets feed a gauge machine
s=Sc(300,170,0.92)
s.conveyor(-320,120,40)
for x in [-280,-150]:s.ticket(x,65,26,mark='ai' if x<-200 else 'human')
s.box(60,-40,0,280,220,230)
# dial on +y face
cx,cy,r=140,120,90
arc=lambda a0,a1,rr:'M %.1f %.1f A %s %s 0 0 1 %.1f %.1f'%(cx+rr*math.cos(a0),cy+rr*math.sin(a0),rr,rr,cx+rr*math.cos(a1),cy+rr*math.sin(a1))
g=screen(280,230,'')
segs=[(math.pi,math.pi*4/3,'#f7f6f2'),(math.pi*4/3,math.pi*5/3,'#f7f6f2'),(math.pi*5/3,2*math.pi,'#f7f6f2')]
for i,(a0,a1,c) in enumerate(segs):
  g+='<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="butt" %s/>'%(arc(a0+.04,a1-.04,r),c,18,'opacity="%s"'%[.35,.65,1][i])
for i in range(25):
  a=math.pi+i*math.pi/24;g+='<circle cx="%.1f" cy="%.1f" r="2.4" fill="%s"/>'%(cx+(r-34)*math.cos(a),cy+(r-34)*math.sin(a),W)
na=math.pi*1.62
g+='<line x1="%s" y1="%s" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="6" stroke-linecap="round"/><circle cx="%s" cy="%s" r="12" fill="%s" stroke="%s" stroke-width="3"/>'%(cx,cy,cx+(r-14)*math.cos(na),cy+(r-14)*math.sin(na),W,cx,cy,O,W)
g+='<rect x="70" y="160" width="140" height="34" rx="17" fill="none" stroke="%s" stroke-width="3"/>'%W
g+=''.join('<circle cx="%s" cy="177" r="3.2" fill="%s"/>'%(92+i*12,W) for i in range(9))
s.fy(60,180,230,g)
s.ft(60,-40,230,''.join('<rect x="%s" y="30" width="14" height="150" rx="6" fill="none" stroke="%s" stroke-width="2"/>'%(30+i*26,W) for i in range(8)))
s.fx(340,180,230,''.join('<line x1="%s" y1="30" x2="%s" y2="200" stroke="%s" stroke-width="2"/>'%(40+i*30,40+i*30,W) for i in range(5)))
# output ticket
s.conveyor(340,560,40,d=110,z=0)
s.ticket(400,65,26,mono=True)
open('s3.svg','w').write(s.svg())
