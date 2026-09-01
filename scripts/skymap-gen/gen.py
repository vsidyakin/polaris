import csv, json, math

# The saved catalogues, so regenerating needs no network. Same source of truth as
# gen_hero.py; this script used to read a scratch clone that no longer exists.
CAT = "/sessions/peaceful-optimistic-gauss/mnt/Website/Star catalogues"
MAGLIM, DECMIN = 4.8, -50.0
RESCUE_MAG = 6.5
# K is the projection scale: r = K*tan(z/2), so the celestial equator (dec 0) is a
# circle of radius exactly K about the pole. At 55 that circle ran from y=-5 to
# y=105 in a 100-unit box - entirely outside anything the crop showed. At 26 it
# spans 24..76, which fits inside the band a wide window leaves visible, so the
# equator reads as the circle it is. The cost is that every northern figure is now
# less than half the size it was: this is a whole-sky chart rather than a
# circumpolar one, which is also why DECMIN reaches to -50 - at K=26 the corners of
# the box sit at r=70.7, i.e. dec -49.
ROT, K, OFFY = 45.0, 26.0, 0.0
def proj(ra_h, dec):
    z = math.radians(90-dec); r = K*math.tan(z/2)
    t = math.radians(ra_h*15 + ROT)
    return 50 + r*math.cos(t), 50 + OFFY + r*math.sin(t)

rows=[r for r in csv.DictReader(open(CAT+"/hyg/hygdata_v41.csv"))]
lines=json.load(open(CAT+"/d3-celestial/constellations.lines.json"))["features"]
names={f["id"]:f["properties"]["name"] for f in json.load(open(CAT+"/d3-celestial/constellations.json"))["features"]}
FIGS=[]; LABS=[]
for f in lines:
    cid=f["id"]; segs=[]
    allpts=[]
    for seg in f["geometry"]["coordinates"]:
        pts=[]
        for lon,dec in seg:
            ra=(lon%360)/15.0
            x,y=proj(ra,dec)
            pts.append((round(ra,4),round(dec,4)))
            allpts.append((x,y,ra,dec))
        segs.append(pts)
    vis=[p for p in allpts if -8<=p[0]<=108 and -8<=p[1]<=108]
    if len(vis)<max(2,0.55*len(allpts)):    # skip figures mostly off-card
        continue
    FIGS.append({"c":cid,"segs":segs})
    cx=sum(p[2] for p in vis)/len(vis); cy=sum(p[3] for p in vis)/len(vis)
    LABS.append({"c":cid,"t":names.get(cid,cid).upper(),"ra":round(cx,3),"dec":round(cy,3)})
print("figures kept:",len(FIGS),"labels:",len(LABS))

def sep(r1,d1,r2,d2):
    return math.hypot(d1-d2,(r1-r2)*15*math.cos(math.radians((d1+d2)/2)))

# Every vertex of a constellation line is a star, so it gets drawn as one whatever
# its magnitude - otherwise the lines of a figure meet at an empty point. Ursa
# Minor has seven stars and eta UMi, the bottom of the bowl, is magnitude 4.95:
# past this card's 4.8 cut, so the bowl drew with three dots on four corners.
need=set()
for f in FIGS:
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
print("figure stars rescued from past the magnitude cut:",len(need))

stars=[]
for r in rows:
    try:
        dec=float(r["dec"]); mag=float(r["mag"]); ra=float(r["ra"])
    except: continue
    if dec<DECMIN or r["id"]=="0": continue
    if mag>MAGLIM and r["id"] not in need: continue
    x,y=proj(ra,dec)
    # Reserve on every side, not just what the card shows. The sky parallaxes,
    # so stars must exist beyond the crop or scrolling drags empty space into
    # view - which is exactly what it did.
    if not (-28<=x<=128 and -28<=y<=128): continue
    stars.append({"ra":round(ra,4),"dec":round(dec,4),"m":round(mag,2),
                  "n":(r["proper"] or "").strip(),"con":r["con"].strip()})
stars.sort(key=lambda s:s["m"])
print("stars kept:",len(stars))

json.dump({"stars":stars,"figs":FIGS,"labs":LABS},open("out.json","w"))
