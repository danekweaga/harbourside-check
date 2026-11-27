"""Write the three sheets Theo can type into."""
import csv, json
from pathlib import Path

root = Path(__file__).resolve().parent
text = (root / "records.js").read_text(encoding="utf-8")
data = json.loads(text.split("=", 1)[1].rsplit(";", 1)[0])
labels = {"laser": "Laser", "biglaser": "Big laser", "printer": "3D printers", "cnc": "CNC router", "saw": "Table saw"}

def hour(value):
    suffix = "PM" if value >= 12 else "AM"
    shown = 12 if value % 12 == 0 else value % 12
    return f"{shown}:00 {suffix}"

members = data["members"]
with (root / "members.csv").open("w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle)
    writer.writerow(["Member number", "First", "Last", "Email", "Status", "Youth", "Parent"])
    for person in members:
        writer.writerow([
            person["id"], person["first"], person["last"], person["email"],
            person["status"], "yes" if person["youth"] else "", person.get("parent") or "",
        ])

with (root / "board.csv").open("w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle)
    writer.writerow(["Date", "Weekday", "Machine", "Start", "End", "Name on board", "Note"])
    for booking in data["bookings"]:
        writer.writerow([
            booking["date"], booking["day"], booking["label"],
            hour(booking["start"]), hour(booking["end"]), booking["text"], booking.get("note") or "",
        ])

with (root / "cards.csv").open("w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle)
    writer.writerow(["Type", "Name", "Member number", "Machine", "Since", "Note"])
    for person in members:
        name = person["first"] + " " + person["last"]
        for machine in person["machines"]:
            writer.writerow(["signoff", name, person["id"], labels.get(machine, machine), "", ""])
        for item in person["waitlist"]:
            writer.writerow(["waiting", name, person["id"], labels.get(item["machine"], item["machine"]), item["since"], item.get("note") or ""])

print("wrote csvs")
