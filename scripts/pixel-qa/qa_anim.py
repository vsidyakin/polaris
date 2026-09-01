"""qa_anim.py -- animation checks on every multi-frame sprite.

Sprites are drawn at a fixed top-left (drawSpr snaps with Math.round), so any
movement of the opaque bounding box between frames is movement the player sees.

Checks, per multi-frame sprite:

  A1  FOOT SLIDE  the bottom edge of the opaque bounding box moves between
      frames.  The engine plants actors by their sprite box, so a moving bottom
      edge makes the feet slide / bob against the floor.
  A2  JITTER      the horizontal centre of mass shifts by more than 1.0 px
      between any two frames.  Reads as the sprite twitching sideways.
  A3  CROP ERROR  a frame whose opaque pixel count is more than 40% away from
      the sprite's mean opaque count.  Usually a frame that lost or gained a
      limb, or was pasted at the wrong offset.
  A4  WASTED FRAME  for a sprite with an even frame count, frame 0 and frame 1
      are byte-identical, so half of a two-frame cycle does nothing.
  A5  DUPLICATE FRAME  the same check generalised: any two frames anywhere in
      the cycle that are byte-identical.  A 4-frame walk whose f0 == f2 is
      really a 3-frame walk paying for 4.

Severity: all animation findings are warnings; none of them break rendering.

Usage
-----
    python3 qa_anim.py [repo_root] [--json=out.json] [--quiet]
"""

from __future__ import annotations

import json
import sys

from parse import (TRANSPARENT, bbox, base_name, frame_size, load_all,
                   opaque_cells, opaque_count, repo_root_default)

FOOT_TOL = 0            # px -- any movement of the bottom edge is a slide
COM_TOL = 1.0           # px -- horizontal centre-of-mass shift budget
COUNT_TOL = 0.40        # fraction away from the mean opaque count

CODE_LABEL = {
    "A1": "foot slide (bbox bottom edge moves between frames)",
    "A2": "jitter (horizontal centre of mass shifts > 1px)",
    "A3": "crop error (opaque pixel count > 40% off the sprite mean)",
    "A4": "wasted frame (frame 0 identical to frame 1, even frame count)",
    "A5": "duplicate frame anywhere in the cycle",
}


def centre_of_mass_x(frame):
    xs = [x for x, _, _ in opaque_cells(frame)]
    return sum(xs) / len(xs) if xs else None


def check_sprite(name: str, rec: dict) -> list:
    frames = rec["frames"]
    out = []

    def add(code, detail, **extra):
        f = {"code": code, "severity": "warn", "sprite": name,
             "store": rec["store"], "detail": detail}
        f.update(extra)
        out.append(f)

    if len(frames) < 2:
        return out

    boxes = [bbox(f) for f in frames]
    counts = [opaque_count(f) for f in frames]
    coms = [centre_of_mass_x(f) for f in frames]

    # --- A1 foot slide ------------------------------------------------------
    bottoms = [b[3] if b else None for b in boxes]
    solid = [b for b in bottoms if b is not None]
    if solid and len(set(solid)) > 1:
        add("A1",
            "bbox bottom edge y = %s (spread %d px)"
            % (" ".join("f%d:%s" % (i, "blank" if b is None else b)
                        for i, b in enumerate(bottoms)),
               max(solid) - min(solid)),
            spread=max(solid) - min(solid),
            bottoms=bottoms)

    # --- A2 jitter ----------------------------------------------------------
    real_coms = [c for c in coms if c is not None]
    if len(real_coms) > 1:
        spread = max(real_coms) - min(real_coms)
        if spread > COM_TOL:
            add("A2",
                "horizontal centre of mass = %s (spread %.2f px)"
                % (" ".join("f%d:%.2f" % (i, c)
                            for i, c in enumerate(coms) if c is not None),
                   spread),
                spread=round(spread, 2))

    # --- A3 crop error ------------------------------------------------------
    mean = sum(counts) / len(counts)
    if mean > 0:
        bad = [(i, c, (c - mean) / mean) for i, c in enumerate(counts)
               if abs(c - mean) / mean > COUNT_TOL]
        if bad:
            add("A3",
                "opaque px %s, mean %.1f; off-mean: %s"
                % ("/".join(str(c) for c in counts), mean,
                   ", ".join("f%d=%d (%+.0f%%)" % (i, c, d * 100)
                             for i, c, d in bad)),
                worst=round(max(abs(d) for _, _, d in bad) * 100, 1))

    # --- A4 wasted frame ----------------------------------------------------
    if len(frames) % 2 == 0 and frames[0] == frames[1]:
        add("A4", "frame 0 and frame 1 are identical (%d-frame cycle)"
                  % len(frames))

    # --- A5 duplicate frame anywhere ---------------------------------------
    seen = {}
    dupes = []
    for i, f in enumerate(frames):
        key = tuple(f)
        if key in seen:
            dupes.append((seen[key], i))
        else:
            seen[key] = i
    if dupes:
        add("A5",
            "identical frame pair(s) %s in a %d-frame cycle"
            % (", ".join("f%d==f%d" % p for p in dupes), len(frames)),
            pairs=dupes)
    return out


def run(repo_root: str):
    art, pal = load_all(repo_root)
    findings = []
    multi = 0
    for name in sorted(art):
        if len(art[name]["frames"]) > 1:
            multi += 1
        findings.extend(check_sprite(name, art[name]))
    return art, multi, findings


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    root = args[0] if args else repo_root_default()
    json_out = None
    for a in argv[1:]:
        if a.startswith("--json="):
            json_out = a.split("=", 1)[1]
    quiet = "--quiet" in argv

    art, multi, findings = run(root)


    # --- documented suppressions ------------------------------------------------

    # annotations.json records every case where a check's assumption does not hold for

    # a given sprite, together with the engine line that proves it. It is applied here,

    # before anything is counted, so the summary counts and the detail list can never

    # disagree. A validator that is mostly wrong is worse than no validator.

    try:

        import suppress as _sup

        findings, _muted = _sup.filter_findings(findings, list(art.keys()))

    except Exception as _e:

        _muted = []

        print("annotation filter unavailable (%s) - reporting everything" % _e)
    if not quiet:
        if _muted and not quiet:
            import os as _os
            print("suppressed %d finding(s) by annotation (annotations.json); SHOW_SUPPRESSED=1 to list" % len(_muted))
            if _os.environ.get("SHOW_SUPPRESSED"):
                for _f in _muted:
                    print("   [muted %s] %-26s %s" % (_f.get("code"), _f.get("sprite"), _f.get("suppressed_because", "")[:110]))
            print()
        print("PIXEL QA -- ANIMATION")
        print("repo   : %s" % root)
        print("multi-frame sprites checked: %d of %d" % (multi, len(art)))
        print()
        print("%-4s %-56s %s" % ("CODE", "CHECK", "COUNT"))
        print("-" * 78)
        for code in ("A1", "A2", "A3", "A4", "A5"):
            hits = [f for f in findings if f["code"] == code]
            print("%-4s %-56s %d" % (code, CODE_LABEL[code], len(hits)))
        print("-" * 78)
        print("animation findings: %d across %d sprites"
              % (len(findings), len({f["sprite"] for f in findings})))
        print()
        for f in findings:
            print("[%s] %-28s %s" % (f["code"], f["sprite"], f["detail"]))

    if json_out:
        with open(json_out, "w", encoding="utf-8") as fh:
            json.dump({"findings": findings, "labels": CODE_LABEL,
                       "multi_frame_sprites": multi}, fh, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
