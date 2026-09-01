"""Generate src/data/hero-sky.ts from the locally saved catalogues.

VISIBLE: the box is 100x50 drawn with xMidYMid slice, so on a wide hero the top
and bottom are cropped and only a band about y=13..37 survives at 2544x620. Both
anchors sit inside that band deliberately - at CY=6.5 Polaris and the whole bowl
of Ursa Minor were being cut off the top of every wide screen.


Composition is driven by two anchors rather than by taste:
  * Polaris is the projection centre, so CX/CY place the pole star directly.
  * ROT is solved so Ursa Minor's BOWL lands where we want it relative to
    Polaris - above the hero's device scene, with the pole star up and to its
    left. Everything else follows from the projection.
"""
import csv, json, math
CAT = "/sessions/peaceful-optimistic-gauss/mnt/Website/Star catalogues"
CX, CY = 57.0, 17.0         # Polaris: upper left of the device scene, and inside
                            # the crop - see the note on VISIBLE below
BOWL_TARGET = (73.0, 23.5)  # Ursa Minor's bowl: above the device scene
K, MAGLIM = 100.0, 4.9

rows=[r for r in csv.DictReader(open(CAT+"/hyg/hygdata_v41.csv")) if r["mag"]]
def get(con,bayer=None,proper=None):
    c=[r for r in rows if r["con"]==con]
    if proper: c=[r for r in c if r["proper"]==proper]
    if bayer:  c=[r for r in c if r["bayer"]==bayer or r["bayer"].startswith(bayer+"-")]
    c=[r for r in c if r["comp"] in("1","")]; c.sort(key=lambda r:float(r["mag"]))
    return float(c[0]["ra"]), float(c[0]["dec"])
def P(ra,dec,rot):
    z=math.radians(90-dec); r=K*math.tan(z/2); t=math.radians(ra*15+rot)
    return CX+r*math.cos(t), CY+r*math.sin(t)

# the bowl of the little dipper: Kochab, Pherkad, eta, zeta
BOWL=[get("UMi",b) for b in ("Bet","Gam","Eta","Zet")]
best=None
for rot in [r/2 for r in range(720)]:
    pts=[P(ra,dec,rot) for ra,dec in BOWL]
    cx=sum(p[0] for p in pts)/len(pts); cy=sum(p[1] for p in pts)/len(pts)
    d=math.hypot(cx-BOWL_TARGET[0], cy-BOWL_TARGET[1])
    if best is None or d<best[0]: best=(d,rot,cx,cy)
ROT=best[1]
def proj(ra,dec): return P(ra,dec,ROT)
print("ROT=%.1f  bowl centroid %.1f,%.1f (target %.1f,%.1f, off %.2f)"%(ROT,best[2],best[3],*BOWL_TARGET,best[0]))
pol=get("UMi",proper="Polaris"); print("Polaris -> %.2f,%.2f"%proj(*pol))

lines=json.load(open(CAT+"/d3-celestial/constellations.lines.json"))["features"]
names={f["id"]:f["properties"]["name"] for f in json.load(open(CAT+"/d3-celestial/constellations.json"))["features"]}
figs=[]
for f in lines:
    segs=[]; allp=[]
    for seg in f["geometry"]["coordinates"]:
        pts=[]
        for lon,dec in seg:
            ra=(lon%360)/15.0; x,y=proj(ra,dec)
            pts.append((round(ra,4),round(dec,4))); allp.append((x,y))
        segs.append(pts)
    vis=[p for p in allp if -1<=p[0]<=101 and -1<=p[1]<=51]
    if len(vis)<max(2,0.55*len(allp)): continue
    figs.append({"c":f["id"],"n":names.get(f["id"],f["id"]),"segs":segs})

def sep(r1,d1,r2,d2):
    return math.hypot(d1-d2,(r1-r2)*15*math.cos(math.radians((d1+d2)/2)))

# ---------------------------------------------------------------------------
# Every vertex of a constellation line IS a star, so every vertex gets drawn as
# one whatever its magnitude. Without this the lines of a figure meet at an empty
# point: Ursa Minor has seven stars, and eta UMi - the bottom of the bowl - is
# magnitude 4.95, four hundredths past the cut. The bowl drew as a quadrilateral
# with three dots on it. The rescue is by catalogue row, not by hand, so it fixes
# the same defect anywhere else in the eight figures.
RESCUE_MAG = 6.5   # far enough to catch a figure star, near enough that a bad
                   # match cannot drag in something invisible
need=set()
for f in figs:
    for seg in f["segs"]:
        for ra,dec in seg:
            b,br=1e9,None
            for r in rows:
                try: d2=float(r["dec"]); m2=float(r["mag"]); r2=float(r["ra"])
                except: continue
                if abs(d2-dec)>1.2 or m2>RESCUE_MAG or r["id"]=="0": continue
                sp=sep(r2,d2,ra,dec)
                if sp<b: b,br=sp,r
            if br is not None and b<0.6 and float(br["mag"])>MAGLIM:
                need.add(br["id"])
print("figure stars rescued from past the magnitude cut:", len(need))

stars=[]
for r in rows:
    try: dec=float(r["dec"]); mag=float(r["mag"]); ra=float(r["ra"])
    except: continue
    if r["id"]=="0" or (mag>MAGLIM and r["id"] not in need): continue
    x,y=proj(ra,dec)
    # Generous margin on every side, not just what the box shows. The sky
    # parallaxes, so stars have to exist beyond the crop or scrolling drags empty
    # space into view - which is exactly what it did.
    if not(-26<=x<=126 and -26<=y<=76): continue
    stars.append({"ra":round(ra,4),"dec":round(dec,4),"m":round(mag,2),"n":(r["proper"] or "").strip()})
stars.sort(key=lambda s:s["m"])

member=[False]*len(stars); matched=0
for f in figs:
    for seg in f["segs"]:
        for ra,dec in seg:
            b,bi=1e9,-1
            for i,s in enumerate(stars):
                if abs(s["dec"]-dec)>1.2: continue
                sp=sep(s["ra"],s["dec"],ra,dec)
                if sp<b: b,bi=sp,i
            if bi>=0 and b<0.6:
                if not member[bi]: matched+=1
                member[bi]=True
ip=next(i for i,s in enumerate(stars) if s["n"]=="Polaris")
print("stars=%d | on a line=%d | figures=%d"%(len(stars),matched,len(figs)))
print("figures:", ", ".join(f["n"] for f in figs))

poly=[]
for f in figs:
    for seg in f["segs"]:
        poly.append("[" + ", ".join("[%s, %s]"%(ra,dec) for ra,dec in seg) + "]")

body = '''/* The home hero sky - generated, not hand-placed.
 *
 * Source: HYG database v4.1 (astronexus/HYG-Database), a merge of Hipparcos,
 * the Yale Bright Star catalogue and Gliese. Constellation figures are the
 * IAU-derived line set from d3-celestial. Both are attributed on the
 * open-source page and saved locally under "Star catalogues", which is why
 * regenerating this file needs no network.
 *
 * One rigid stereographic projection about the north celestial pole:
 *     r = K x tan(z/2),  z = 90 - dec       theta = RA + ROT
 *
 * Composition comes from two anchors, not from nudging stars. Polaris IS the
 * projection centre, so CX/CY place the pole star exactly - upper left of the
 * hero's device scene, and the easter-egg trigger with it. ROT is then solved so
 * Ursa Minor's BOWL lands above the device scene, down and to the right of
 * Polaris. Every other figure follows from the projection; nothing is placed by
 * hand, which is the only way the shapes stay real.
 *
 * The box is 100x50, drawn with preserveAspectRatio="xMidYMid slice". The
 * previous hero used percentages inside an SVG set to "none", so the axes
 * stretched independently with the viewport and every figure distorted - the
 * Northern Cross rendered as an X with a star in the middle. Slice crops rather
 * than stretches, so shapes hold at any window size.
 */

const CX = %(cx)s;
const CY = %(cy)s;
const K = %(k)s;
const ROT = %(rot)s;

export interface HeroStar {
  /** right ascension, hours (J2000) */
  ra: number;
  /** declination, degrees (J2000) */
  dec: number;
  /** visual magnitude - lower is brighter */
  m: number;
  /** proper name where the catalogue carries one */
  n?: string;
  /** 1 when a constellation line runs through this star */
  f?: 1;
}

/** %(ns)d stars to magnitude %(mag)s, brightest first. */
export const HERO_STARS: HeroStar[] = [
  %(starlist)s,
];

/** %(np)d constellation polylines as [ra, dec] runs: %(fignames)s. */
export const HERO_FIGURES: [number, number][][] = [
  %(polylist)s,
];

export function heroProject(ra: number, dec: number): { x: number; y: number } {
  const z = ((90 - dec) * Math.PI) / 180;
  const r = K * Math.tan(z / 2);
  const t = ((ra * 15 + ROT) * Math.PI) / 180;
  return { x: CX + r * Math.cos(t), y: CY + r * Math.sin(t) };
}

/** Polaris: the projection centre, and the easter-egg trigger. */
export const HERO_POLE = { ra: %(pra)s, dec: %(pdec)s };
''' % {
 "cx":CX,"cy":CY,"k":K,"rot":ROT,"ns":len(stars),"mag":MAGLIM,
 "starlist":",\n  ".join('{ ra: %s, dec: %s, m: %s%s%s }'%(
     s["ra"],s["dec"],s["m"],', n: "%s"'%s["n"] if s["n"] else "", ", f: 1" if member[i] else "")
     for i,s in enumerate(stars)),
 "np":len(poly),"fignames":", ".join(f["n"] for f in figs),
 "polylist":",\n  ".join(poly),
 "pra":stars[ip]["ra"],"pdec":stars[ip]["dec"]}
out="/sessions/peaceful-optimistic-gauss/mnt/Website/git website/polaris-website/src/data/hero-sky.ts"
open(out,"w",newline="").write(body)
print("wrote hero-sky.ts", len(body), "chars")
