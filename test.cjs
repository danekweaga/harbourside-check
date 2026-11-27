const fs = require("fs");
const vm = require("vm");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync("records.js", "utf8"), sandbox);
const records = sandbox.window.RECORDS;
const Harbour = require("./check.js");
const friday = new Date(2026, 10, 27, 14, 0, 0);

function member(query) {
  const hits = Harbour.find(query, records.members);
  if (hits.length !== 1) throw new Error(query + " matched " + hits.length);
  return hits[0];
}

function text(query) {
  return Harbour.explain(member(query), records.bookings, records.members, friday).sentences.join(" | ");
}

const jenReport = Harbour.explain(member("1088"), records.bookings, records.members, friday);
const jen = jenReport.sentences.join(" | ");
if (!jen.includes("closed on Friday")) throw new Error("Jen Friday: " + jen);
if (!jenReport.lead.startsWith("Jen Akerley")) throw new Error("Jen lead name: " + jenReport.lead);
if (!jenReport.lead.includes("Jen A + Marcus")) throw new Error("Jen lead board: " + jenReport.lead);
if (!jenReport.lead.includes("fits the rules")) throw new Error("Jen lead fit: " + jenReport.lead);
const jenLaser = jenReport.cards.find((card) => card.text.includes("Marcus"));
if (!jenLaser || jenLaser.problems.length) throw new Error("Jen buddy booking: " + JSON.stringify(jenLaser));

const moiraReport = Harbour.explain(member("Moira Keddy"), records.bookings, records.members, friday);
const moira = moiraReport.sentences.join(" | ");
if (!moiraReport.lead.includes("not signed off on the laser")) throw new Error("Moira: " + moiraReport.lead);

const hiro = text("1026");
if (!hiro.includes("lapsed")) throw new Error("Hiro: " + hiro);

const kofiReport = Harbour.explain(member("Kofi Crowell"), records.bookings, records.members, friday);
const kofi = kofiReport.sentences.join(" | ");
if (!kofi.includes("training list")) throw new Error("Kofi list: " + kofi);
const kofiCnc = kofiReport.cards.find((card) => card.label === "CNC router");
if (!kofiCnc || !kofiCnc.problems.some((line) => line.includes("CNC"))) throw new Error("Kofi cnc: " + JSON.stringify(kofiReport.cards));
if (kofiReport.signed.find((row) => row.key === "cnc").yes) throw new Error("Kofi should not be signed off on CNC");

const sadie = Harbour.find("Sadie", records.members);
if (sadie.length !== 3) throw new Error("Sadie count " + sadie.length);
const youthReport = Harbour.explain(member("1143"), records.bookings, records.members, friday);
const youth = youthReport.sentences.join(" | ");
if (!youth.includes("parent")) throw new Error("Youth: " + youth);
const longPrint = youthReport.cards.find((card) => card.problems.some((line) => line.includes("3 hours")));
if (!longPrint) throw new Error("Sadie hours: " + JSON.stringify(youthReport.cards));

const hamidReport = Harbour.explain(member("1001"), records.bookings, records.members, friday);
const hamid = hamidReport.sentences.join(" | ");
if (!hamid.includes("training list")) throw new Error("Hamid should stay on the laser list: " + hamid);
if (!hamid.includes("big laser")) throw new Error("Hamid big laser: " + hamid);
const hamidSigned = hamidReport.signed.find((row) => row.key === "laser");
if (hamidSigned.yes || hamidSigned.note !== "Big laser only") throw new Error("Hamid laser chip: " + JSON.stringify(hamidSigned));

const raj = Harbour.explain(member("Raj Chen"), records.bookings, records.members, friday);
if (raj.cards.some((card) => card.label === "Laser" && card.problems.length === 0)) throw new Error("Raj got a clean laser booking");
const owen = Harbour.explain(member("Owen Wournell"), records.bookings, records.members, friday);
if (owen.cards.some((card) => card.text === "Owen H")) throw new Error("Owen H was attached");
const loose = jenReport.unmatched.join(" | ");
if (!loose.includes("Liam Paige") || !loose.includes("Wes") || !loose.includes("Raj P") || !loose.includes("Owen H")) {
  throw new Error("Unmatched board: " + loose);
}

if (Harbour.find("Wes", records.members).length !== 0) throw new Error("Wes should not match");
const built = Harbour.buildFromTables(
  [{ membernumber: "1088", first: "Jen", last: "Akerley", email: "jen.akerley21@example.com", status: "active", youth: "", parent: "" },
   { membernumber: "1033", first: "Marcus", last: "Bell", email: "marcus.bell63@example.com", status: "active", youth: "", parent: "" }],
  [{ type: "signoff", name: "Jen Akerley", membernumber: "1088", machine: "Laser", since: "", note: "" },
   { type: "signoff", name: "Marcus Bell", membernumber: "1033", machine: "Laser", since: "", note: "" }],
  [{ date: "2026-11-25", weekday: "Wednesday", machine: "Laser", start: "6:00 PM", end: "8:00 PM", nameonboard: "Jen A + Marcus", note: "" }]
);
const builtJen = Harbour.explain(built.members[0], built.bookings, built.members, friday);
if (!builtJen.lead.includes("fits the rules")) throw new Error("Sheet rebuild: " + builtJen.lead);
console.log("ok");
console.log("JEN", jen);
console.log("MOIRA", moira);
console.log("KOFI", kofi);
console.log("SADIE", youth);
