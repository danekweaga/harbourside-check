"""Turn Harbourside's practice files into the records the demo page can check."""
import csv, json, re
from pathlib import Path

DOWNLOADS = Path(r"C:\Users\danie\Downloads")
OUT = Path(__file__).resolve().parent / "records.js"

HAND = """
Alex Chen, CNC
Dana Novak, router
Celine Langille, CNC
Ben Wournell, laser
Darius Slaunwhite, LC
Jonah Hiltz, laser
Iris Silva, Laser
Bryce MacIsaac, Printer
Alex Chen, TS
Emeka E., Table saw
Fiona Silva, Table saw
Iris Silva, saw
Emeka Ernst, CNC router
Chloe Fraser, CNC
Felix Lohnes, CNC
Malik Zinck, big laser
Grace Haines, big laser
Farah Haines, big laser
Rafael Santos, Laser cutter
Chloe Fraser, Table saw
Chloe Ernst, TS
Alicia MacIsaac, table saw
Megan Fraser, table saw
Ben Nguyen, printers
Hamid Pottie, CNC
Paige MacIsaac, CNC
Caleb R., CNC router
Sadie Ibrahim, printers
Hamid Pottie, big laser
Dana Slaunwhite, LC
Kara Conrad, Laser
Sadie Hatt, laser cutter
Moira Keddy, saw
Brandon Patel, Table saw
Tessa Singh, table saw
C. LeBlanc, table saw
Ahmed Gaudet, router
Joel Nguyen, CNC router
Ben Langille, router
""".strip().splitlines()

def norm(s):
    return re.sub(r"[^a-z ]", "", (s or "").lower()).replace("  ", " ").strip()

def family(machine):
    x = norm(machine)
    if "print" in x or x in ("3dp", "dp"):
        return "printer"
    if "cnc" in x or "router" in x:
        return "cnc"
    if "saw" in x or x == "ts":
        return "saw"
    if "laser" in x or x == "lc":
        return "laser"
    return ""

def score(member, raw):
    text = raw or ""
    if "," in text:
        last, first = [norm(p) for p in text.split(",", 1)]
        tokens = [t for t in (first + " " + last).split() if t]
    else:
        tokens = [t for t in norm(text).split() if t]
    first, last = norm(member["first"]), norm(member["last"])
    if tokens == [first, last] or tokens == [last, first]:
        return 100
    if first in tokens and last in tokens:
        return 95
    if len(tokens) == 2 and tokens[0] == first and len(tokens[1]) == 1 and last.startswith(tokens[1]):
        return 80
    if len(tokens) == 2 and len(tokens[0]) == 1 and tokens[1] == last and first.startswith(tokens[0]):
        return 80
    if len(tokens) == 1 and tokens[0] == last:
        return 40
    if len(tokens) == 1 and tokens[0] == first:
        return 30
    return 0

def best(members, raw, floor):
    ranked = sorted(((score(m, raw), m) for m in members), key=lambda pair: -pair[0])
    if not ranked or ranked[0][0] < floor:
        return []
    top = ranked[0][0]
    return [m for s, m in ranked if s == top]

def attach(members, raw, floor):
    hits = best(members, raw, floor)
    if len(hits) == 1:
        return hits[0]
    return None

members = []
with (DOWNLOADS / "member-list.csv").open(newline="", encoding="utf-8") as handle:
    for row in csv.DictReader(handle):
        members.append({
            "id": row["member_no"],
            "first": row["first_name"],
            "last": row["last_name"],
            "email": row["email"].lower(),
            "membership": row["membership"],
            "status": row["status"],
            "youth": row["membership"] == "youth",
            "machines": [],
        })

signoffs = []
with (DOWNLOADS / "signoff-binder-typed.csv").open(newline="", encoding="utf-8") as handle:
    for row in csv.DictReader(handle):
        if row.get("name"):
            signoffs.append((row["name"], row["machine"]))
for line in HAND:
    name, machine = [part.strip() for part in line.split(",", 1)]
    signoffs.append((name, machine))

unmatched = []
for name, machine in signoffs:
    kind = family(machine)
    person = attach(members, name, 80)
    if person and kind:
        if kind not in person["machines"]:
            person["machines"].append(kind)
    else:
        unmatched.append(f"{name} / {machine}")

waitlist = []
with (DOWNLOADS / "training-waitlist.csv").open(newline="", encoding="utf-8") as handle:
    for row in csv.DictReader(handle):
        person = None
        if row["member_no"]:
            person = next((m for m in members if m["id"] == row["member_no"]), None)
        if person is None:
            person = attach(members, row["name"], 80)
        kind = family(row["machine"])
        if person and kind:
            person.setdefault("waitlist", [])
            person["waitlist"].append({
                "machine": kind,
                "since": row["date_added"],
                "note": row["notes"],
            })

for person in members:
    person.setdefault("waitlist", [])
    person["machines"] = sorted(person["machines"])

def link_name(raw):
    hits = best(members, raw, 80)
    if len(hits) == 1:
        return [hits[0]["id"]]
    tokens = [t for t in norm(raw).split() if t]
    if len(tokens) >= 1:
        firsts = [m for m in members if norm(m["first"]) == tokens[0]]
        initial = len(tokens) == 2 and len(tokens[1]) == 1
        if len(firsts) == 1 and (len(tokens) == 1 or initial):
            return [firsts[0]["id"]]
        if len(tokens) == 1 and len(firsts) > 1:
            return [m["id"] for m in firsts]
    return []

# Week of Nov 24. Weekday hours are evening. Saturday hours are daytime.
BOARD = [
    ("2026-11-24", "Tuesday", "laser", "Laser", 17, 18, "Raj P", ""),
    ("2026-11-24", "Tuesday", "printer", "3D printers", 18, 21, "Sadie", ""),
    ("2026-11-24", "Tuesday", "saw", "Table saw", 19, 20, "Owen H", ""),
    ("2026-11-25", "Wednesday", "laser", "Laser", 18, 20, "Jen A + Marcus", ""),
    ("2026-11-25", "Wednesday", "cnc", "CNC router", 17, 19, "Kofi", ""),
    ("2026-11-25", "Wednesday", "printer", "3D printers", 17, 21, "Tessa", "long print"),
    ("2026-11-26", "Thursday", "laser", "Laser", 19, 21, "Liam Paige", ""),
    ("2026-11-26", "Thursday", "printer", "3D printers", 17, 18, "Nico", ""),
    ("2026-11-26", "Thursday", "saw", "Table saw", 18, 20, "Gavin", ""),
    ("2026-11-28", "Saturday", "laser", "Laser", 10, 12, "Moira", ""),
    ("2026-11-28", "Saturday", "laser", "Laser", 13, 15, "Hiro", ""),
    ("2026-11-28", "Saturday", "printer", "3D printers", 12, 14, "Iris", ""),
    ("2026-11-28", "Saturday", "cnc", "CNC router", 11, 13, "Dmitri", ""),
    ("2026-11-28", "Saturday", "saw", "Table saw", 14, 16, "Wes", ""),
]

bookings = []
for date, day, kind, label, start, end, text, note in BOARD:
    ids = []
    for piece in re.split(r"\s*\+\s*", text):
        ids.extend(link_name(piece.strip()))
    # unique, keep order
    seen = []
    for item in ids:
        if item not in seen:
            seen.append(item)
    bookings.append({
        "date": date,
        "day": day,
        "machine": kind,
        "label": label,
        "start": start,
        "end": end,
        "hours": end - start,
        "text": text,
        "note": note,
        "people": seen,
    })

payload = {
    "members": [{
        "id": m["id"],
        "first": m["first"],
        "last": m["last"],
        "email": m["email"],
        "status": m["status"],
        "youth": m["youth"],
        "machines": m["machines"],
        "waitlist": m["waitlist"],
    } for m in members],
    "bookings": bookings,
}

OUT.write_text("window.RECORDS = " + json.dumps(payload, separators=(",", ":")) + ";\n", encoding="utf-8")
print("members", len(members))
print("unmatched signoffs", len(unmatched))
for line in unmatched:
    print(" ", line)
print("bookings")
for booking in bookings:
    names = []
    for pid in booking["people"]:
        person = next(m for m in members if m["id"] == pid)
        names.append(person["first"] + " " + person["last"])
    print(f"  {booking['day']} {booking['label']} {booking['text']} -> {', '.join(names) or 'NO MATCH'}")
