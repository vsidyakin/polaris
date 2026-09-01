# skymap-gen

Regenerates `src/data/skymap404.ts` from published catalogues, so the 404 star
chart is sourced rather than remembered.

## Sources

| what | where | licence |
| :--- | :---- | :------ |
| stars | [astronexus/HYG-Database](https://github.com/astronexus/HYG-Database) `hyg/CURRENT/hygdata_v41.csv` — Hipparcos + Yale Bright Star + Gliese | CC BY-SA 4.0 |
| constellation figures | [ofrohn/d3-celestial](https://github.com/ofrohn/d3-celestial) `data/constellations.lines.json` — IAU-derived line set | BSD-3-Clause |

Both are attributed in the generated file's header. If the licence terms matter
for launch, they belong in the open-source page (F8) alongside the firmware
notices.

## Running it

The sandbox proxy blocks `raw.githubusercontent.com`, so fetch by clone:

```sh
git clone --depth 1 https://github.com/astronexus/HYG-Database.git hyg
git clone --depth 1 https://github.com/ofrohn/d3-celestial.git cel
python3 gen.py     # filters the catalogue -> out.json
python3 emit.py    # writes src/data/skymap404.ts
```

`gen.py` holds the two knobs worth touching: `MAGLIM` (visual magnitude cut,
4.8 gives ~680 stars) and `DECMIN` (how far south to reach, -20° fills the
card's corners). `emit.py` runs the label collision pass — labels are placed by
walking outward from each figure's centroid until they clear stars, lines and
each other, then baked into the data file as chart coordinates.
