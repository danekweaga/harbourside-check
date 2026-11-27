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

const jen = text("1088");
if (!jen.includes("closed on Friday")) throw new Error("Jen Friday: " + jen);
if (!jen.includes("can't use a machine right now")) throw new Error("Jen now: " + jen);
const jenReport = Harbour.explain(member("jen.akerley21@example.com"), records.bookings, records.members, friday);
const jenLaser = jenReport.cards.find((card) => card.text.includes("Marcus"));
if (!jenLaser || jenLaser.problems.length) throw new Error("Jen buddy booking: " + JSON.stringify(jenLaser));

const moira = text("Moira Keddy");
if (!moira.includes("not signed off on the laser")) throw new Error("Moira: " + moira);

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

const hamid = text("Hamid Pottie");
if (hamid.includes("training list")) throw new Error("Hamid stale list blocked him: " + hamid);
const hamidSigned = Harbour.explain(member("1001"), records.bookings, records.members, friday).signed.find((row) => row.key === "laser");
if (!hamidSigned.yes) throw new Error("Hamid laser");

if (Harbour.find("Wes", records.members).length !== 0) throw new Error("Wes should not match");
console.log("ok");
console.log("JEN", jen);
console.log("MOIRA", moira);
console.log("KOFI", kofi);
console.log("SADIE", youth);
