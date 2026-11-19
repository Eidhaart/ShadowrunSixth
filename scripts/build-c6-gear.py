# Usage: python3 scripts/build-c6-gear.py src/data/c6-gear.json [Commlink6 core data dir] [core.properties]
"""Build a compact gear catalog from Commlink 6's core data (item templates, slots, accessories, ratings).
Names and page numbers come from Commlink 6's English strings; its book descriptions are not copied."""
import xml.etree.ElementTree as ET, glob, json, re, sys

ROOT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/c6/SR6_Data/src/main/resources/de/rpgframework/shadowrun6/data/core"
CORE_I18N = sys.argv[3] if len(sys.argv) > 3 else "/tmp/c6/SR6_Core/src/main/resources/de/rpgframework/shadowrun6/i18n/core.properties"

def props(path):
    out = {}
    try:
        for line in open(path, encoding="latin-1"):
            line = line.rstrip("\n")
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return out

# the properties files are UTF-8 in practice; re-read with replacement for odd bytes
def props8(path):
    out = {}
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.rstrip("\n")
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out

names = {}
for p in ["i18n/core.properties", "i18n/core_seattle.properties"]:
    names.update(props8(f"{ROOT}/{p}"))
labels = props8(CORE_I18N)

def lab(prefix, key):
    return labels.get(f"{prefix}.{key.lower()}", key.replace("_", " ").title())

def num(v):
    if v is None or v == "":
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except ValueError:
        return v  # a formula such as $RATING*500

def tval(el, v):
    """A value with a rating table (table="1000,4000,...") becomes {"tab": [...]}, indexed like the rating options."""
    tab = el.get("table") if el is not None else None
    if tab:
        return {"tab": [num(x.strip()) for x in tab.split(",")]}
    return num(v)

def avail(v):
    """'2L' -> (2, 'L'); '$RATING/3 L' -> ('$RATING/3', 'L')."""
    if v is None:
        return None, None
    v = v.strip()
    m = re.match(r"^(.*?)[ ]?([LI])$", v)
    legal = None
    if m and not v.endswith("$RATING"):
        v, legal = m.group(1).strip(), m.group(2)
    return num(v), legal

items, types, subtypes, hooks = [], {}, {}, {}
for f in sorted(glob.glob(f"{ROOT}/data/gear_*.xml")):
    for it in ET.parse(f).getroot().findall("item"):
        iid = it.get("id")
        t, s = it.get("type"), it.get("subtype")
        name = names.get(f"item.{iid}")
        if not name:
            continue
        types[t] = lab("itemtype", t)
        subtypes[s] = lab("itemsubtype", s)
        o = {"id": iid, "n": name, "t": t, "s": s}
        pg = names.get(f"item.{iid}.page")
        if pg and pg.isdigit():
            o["p"] = int(pg)
        o["price"] = num(it.get("price"))
        o["avail"], legal = avail(it.get("avail"))
        if legal:
            o["legal"] = legal
        if it.get("count"):
            o["count"] = True
        for u in it.findall("usage"):
            if u.get("mode") == "IMPLANTED" and u.get("value") and "ess" not in o:
                o["ess"] = num(u.get("value"))
        for a in it.findall("attrdef"):
            k, v = a.get("id"), a.get("value")
            if k == "PRICE": o["price"] = tval(a, v)
            elif k == "AVAILABILITY":
                if a.get("table"):
                    o["avail"] = tval(a, v); legal = None
                else:
                    o["avail"], legal = avail(v)
                if legal: o["legal"] = legal
            elif k == "ESSENCECOST": o["ess"] = tval(a, v)
            elif k == "DEVICE_RATING": o.setdefault("m", {})["dr"] = num(v)
            elif k == "DAMAGE": o.setdefault("w", {})["dv"] = v
        for c in it.iter("choice"):
            if c.get("type") == "ITEM_ATTRIBUTE" and c.get("ref") == "RATING":
                opts = [int(x) for x in (c.get("options") or "").split(",") if x.strip().isdigit()]
                o["ratings"] = opts or list(range(1, 7))
                break
        w = it.find("weapon")
        if w is not None:
            ar = (w.get("attack") or "").split(",")
            ar = (ar + [""] * 5)[:5]
            o["w"] = {**o.get("w", {}), "dv": w.get("dmg") or o.get("w", {}).get("dv"), "ar": [int(x) if x.strip().isdigit() else None for x in ar],
                      "modes": w.get("mode"), "ammo": w.get("ammo"), "skill": w.get("skill"), "spec": (w.get("spec") or "").split("/")[-1] or None}
        a = it.find("armor")
        if a is not None:
            o["a"] = {"def": num(a.get("rating")), "soc": num(a.get("social"))}
        m = it.find("matrix")
        if m is not None:
            mm = o.setdefault("m", {})
            for k, kk in [("devrat", "dr"), ("a", "a"), ("s", "s"), ("d", "d"), ("f", "f"), ("programs", "prog")]:
                if m.get(k) is not None: mm[kk] = num(m.get(k))
        # slots this item offers: fixed mounts (itemmod HOOK) and capacity slots (valmod HOOK value)
        hk = []
        mods = it.find("modifications")
        inc = []
        if mods is not None:
            for x in mods:
                if x.tag == "itemmod" and x.get("type") == "HOOK":
                    hk.append([x.get("ref"), None])
                elif x.tag == "valmod" and x.get("type") == "HOOK" and x.get("ref") not in ("SOFTWARE",):
                    hk.append([x.get("ref"), tval(x, x.get("value"))])
                elif x.tag == "embed" and x.get("type") == "GEAR" and x.get("included") == "true":
                    inc.append([x.get("ref"), x.get("intoRef"), x.get("variant")])
        # Commlink 6 adds an external accessory slot to every firearm, exotic, ranged and melee weapon
        ext = {"WEAPON_FIREARMS": "FIREARMS_EXTERNAL", "WEAPON_SPECIAL": "FIREARMS_EXTERNAL", "WEAPON_CLOSE_COMBAT": "MELEE_EXTERNAL", "WEAPON_RANGED": "RANGED_EXTERNAL"}.get(t)
        if ext and not any(h[0] == ext for h in hk):
            hk.append([ext, 99])
        if any(i[1] == "INTERNAL" for i in inc) and not any(h[0] == "INTERNAL" for h in hk):
            hk.append(["INTERNAL", None])
        if hk: o["hooks"] = hk
        if inc: o["inc"] = inc
        req = it.find("requires")
        if req is not None:
            rg = [x.get("ref") for x in req.iter("datareq") if x.get("type") == "GEAR" and x.get("apply") == "DATA_ITEM"]
            rs = [x.get("ref") for x in req.iter("datareq") if x.get("type") == "ITEMSUBTYPE"] + [x.get("value") for x in req.iter("valuereq") if x.get("type") == "ITEM_ATTRIBUTE" and x.get("ref") == "ITEMSUBTYPE"]
            rt = [x.get("value") for x in req.iter("valuereq") if x.get("type") == "ITEM_ATTRIBUTE" and x.get("ref") == "ITEMTYPE"]
            r = {k: v for k, v in (("g", rg), ("s", rs), ("t", rt)) if v}
            if r: o["req"] = r
        use = [[u.get("slot"), num(u.get("value"))] for u in it.findall("usage") if u.get("mode") == "EMBEDDED" and u.get("slot")]
        if use: o["use"] = use
        vs = []
        for v in it.findall("variant"):
            vo = {"id": v.get("id")}
            vu = [[u.get("slot"), num(u.get("value"))] for u in v.findall("usage") if u.get("mode") == "EMBEDDED" and u.get("slot")]
            if vu: vo["use"] = vu
            if any(u.get("mode") == "IMPLANTED" for u in v.findall("usage")): vo["implant"] = True
            for a in v.findall("attrdef"):
                k, val = a.get("id"), a.get("value")
                if k == "PRICE": vo["price"] = num(val)
                elif k == "AVAILABILITY":
                    vo["avail"], lg = avail(val)
                    if lg: vo["legal"] = lg
                elif k == "ESSENCECOST": vo["ess"] = num(val)
                elif k == "ITEMTYPE": vo["t"] = val
            vn = names.get(f"item.{iid}.variant.{v.get('id', '').lower()}")
            if vn: vo["n"] = vn
            vs.append(vo)
        if vs: o["var"] = vs
        items.append(o)

for h in sorted({h[0] for i in items for h in i.get("hooks", [])} | {u[0] for i in items for u in i.get("use", [])} | {u[0] for i in items for v in i.get("var", []) for u in v.get("use", [])}):
    hooks[h] = lab("itemhook", h)
hooks.update({"TOP": "Top mount", "UNDER": "Underbarrel mount", "BARREL": "Barrel mount", "STOCK": "Stock", "INTERNAL": "Internal", "FIREARMS_EXTERNAL": "External", "MELEE_EXTERNAL": "External", "RANGED_EXTERNAL": "External", "ARMOR": "Armor modifications"})

out = {"source": "Commlink 6 core data (taranion/Commlink6), names and pages only", "types": types, "subtypes": subtypes, "hooks": hooks, "items": items}
json.dump(out, open(sys.argv[1], "w"), separators=(",", ":"), ensure_ascii=False)
print(len(items), "items", len(json.dumps(out)), "bytes")
