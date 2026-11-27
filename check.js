(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Harbour = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MACHINE = {
    laser: "the laser",
    printer: "the 3D printers",
    cnc: "the CNC router",
    saw: "the table saw",
  };

  function hourLabel(hour) {
    const suffix = hour >= 12 ? "PM" : "AM";
    const shown = hour % 12 === 0 ? 12 : hour % 12;
    return shown + ":00 " + suffix;
  }

  function ymd(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function find(query, members) {
    const text = (query || "").trim();
    if (!text) return [];
    if (text.includes("@")) {
      const email = text.toLowerCase();
      return members.filter((member) => member.email === email);
    }
    if (/^\d[\d\s-]*$/.test(text)) {
      const number = text.replace(/\D/g, "");
      return members.filter((member) => member.id === number);
    }
    const tokens = text.toLowerCase().replace(/[^a-z ]/g, " ").trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const full = tokens.join(" ");
    const exact = members.filter((member) => {
      const first = member.first.toLowerCase();
      const last = member.last.toLowerCase();
      return full === first + " " + last || full === last + " " + first;
    });
    if (exact.length) return exact;
    if (tokens.length === 2 && tokens[1].length === 1) {
      const initial = members.filter((member) => member.first.toLowerCase() === tokens[0] && member.last.toLowerCase().startsWith(tokens[1]));
      if (initial.length) return initial;
    }
    if (tokens.length === 1) {
      const firsts = members.filter((member) => member.first.toLowerCase() === tokens[0]);
      if (firsts.length) return firsts;
      return members.filter((member) => member.last.toLowerCase() === tokens[0]);
    }
    return members.filter((member) => tokens.includes(member.first.toLowerCase()) && tokens.includes(member.last.toLowerCase()));
  }

  function hasLaser(person) {
    return (person.machines || []).includes("laser");
  }

  function explain(member, bookings, members, now) {
    const byId = {};
    members.forEach((person) => { byId[person.id] = person; });
    const today = ymd(now);
    const open = [2, 3, 4, 6].includes(now.getDay());
    const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
    const machines = member.machines || [];
    const cards = bookings.filter((booking) => booking.people.includes(member.id)).map((booking) => {
      const problems = [];
      if (member.status === "lapsed") problems.push("Your membership has lapsed, so you can't use this machine.");
      if (booking.machine === "laser" && !hasLaser(member) && machines.includes("biglaser")) {
        problems.push("You are signed off on the big laser only. Walt has not confirmed that is the laser on the board.");
      } else if (!machines.includes(booking.machine)) {
        problems.push("You are not signed off on " + MACHINE[booking.machine] + ".");
      }
      if (booking.hours > 2) problems.push("This is " + booking.hours + " hours. The limit is 2 hours a day on one machine.");
      if (booking.machine === "laser" && booking.start >= 18) {
        const buddy = booking.people.some((id) => id !== member.id && hasLaser(byId[id]));
        if (!buddy) problems.push("After 6:00 PM the laser needs a second person who is signed off, at the machine.");
      }
      let when = "today";
      if (booking.date < today) when = "past";
      if (booking.date > today) when = "next";
      const rules = ["15 minutes late and this slot is free."];
      if (booking.machine === "laser") rules.push("No PVC or vinyl. Don't leave it running.");
      return {
        when,
        day: booking.day,
        label: booking.label,
        text: booking.text,
        note: booking.note,
        start: hourLabel(booking.start),
        end: hourLabel(booking.end),
        problems,
        rules,
      };
    });

    const leadCard = cards.find((card) => card.when === "next" && card.problems.length)
      || cards.find((card) => card.when === "next")
      || cards.find((card) => card.when === "today")
      || cards[cards.length - 1];
    let lead = member.first + " " + member.last + ". You are not on this week's whiteboard.";
    let leadOk = false;
    if (leadCard) {
      const verdict = leadCard.problems.length ? leadCard.problems[0] : "That booking fits the rules.";
      const passed = leadCard.when === "past" ? " That slot has passed." : "";
      lead = member.first + " " + member.last + ". " + leadCard.day + " " + leadCard.start + "–" + leadCard.end + ", " + leadCard.label + ". The board says " + leadCard.text + ". " + verdict + passed;
      leadOk = leadCard.problems.length === 0;
    }

    const sentences = [];
    if (member.status === "lapsed") sentences.push("Your membership has lapsed. You can't book or use a machine.");
    if (!open) sentences.push("The shop is closed on " + dayName + ". You can't use a machine right now.");
    else if (member.status !== "lapsed") sentences.push("The shop is open now.");
    if (member.youth) {
      const named = member.parent ? " The membership lists " + member.parent + "." : "";
      sentences.push("You are a youth member. A parent has to be with you." + named);
    }
    if (machines.includes("biglaser") && !hasLaser(member)) {
      sentences.push("The binder says big laser, not the laser on the board. Walt has not confirmed those are the same machine.");
    }
    (member.waitlist || []).filter((row) => !machines.includes(row.machine)).forEach((row) => {
      const [year, month, day] = row.since.split("-").map(Number);
      const since = new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric" });
      sentences.push("You are not signed off on " + MACHINE[row.machine] + " yet. You have been on the training list since " + since + ".");
    });

    const unmatched = bookings.filter((booking) => booking.people.length === 0).map((booking) =>
      booking.day + " " + hourLabel(booking.start) + "–" + hourLabel(booking.end) + " " + booking.label + ", board says " + booking.text + ". That name is not a member, so the booking is not confirmed."
    );

    return {
      name: member.first + " " + member.last,
      lead,
      leadOk,
      sentences,
      signed: ["laser", "printer", "cnc", "saw"].map((key) => ({
        key,
        label: { laser: "Laser", printer: "3D printers", cnc: "CNC router", saw: "Table saw" }[key],
        yes: key === "laser" ? hasLaser(member) : machines.includes(key),
        note: key === "laser" && machines.includes("biglaser") && !hasLaser(member) ? "Big laser only" : "",
      })),
      cards,
      unmatched,
    };
  }

  function normName(value) {
    return String(value || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  }

  function nameScore(member, raw) {
    let tokens;
    if (String(raw).includes(",")) {
      const parts = String(raw).split(",");
      tokens = normName(parts[1] + " " + parts[0]).split(" ").filter(Boolean);
    } else {
      tokens = normName(raw).split(" ").filter(Boolean);
    }
    const first = member.first.toLowerCase();
    const last = member.last.toLowerCase();
    if (tokens.length === 2 && ((tokens[0] === first && tokens[1] === last) || (tokens[0] === last && tokens[1] === first))) return 100;
    if (tokens.includes(first) && tokens.includes(last)) return 95;
    if (tokens.length === 2 && tokens[0] === first && tokens[1].length === 1 && last.startsWith(tokens[1])) return 80;
    if (tokens.length === 2 && tokens[0].length === 1 && tokens[1] === last && first.startsWith(tokens[0])) return 80;
    return 0;
  }

  function linkText(text, members) {
    const ids = [];
    String(text || "").split(/\s*\+\s*/).forEach((part) => {
      linkName(part.trim(), members).forEach((id) => {
        if (id && !ids.includes(id)) ids.push(id);
      });
    });
    return ids;
  }

  function linkName(raw, members) {
    let best = 0;
    members.forEach((member) => { best = Math.max(best, nameScore(member, raw)); });
    if (best >= 80) {
      const hits = members.filter((member) => nameScore(member, raw) === best);
      if (hits.length === 1) return [hits[0].id];
    }
    const tokens = normName(raw).split(" ").filter(Boolean);
    if (tokens.length === 1) {
      const firsts = members.filter((member) => member.first.toLowerCase() === tokens[0]);
      return firsts.map((member) => member.id);
    }
    return [];
  }

  function linkText(text, members) {
    const ids = [];
    String(text || "").split(/\s*\+\s*/).forEach((part) => {
      linkName(part.trim(), members).forEach((id) => {
        if (id && !ids.includes(id)) ids.push(id);
      });
    });
    return ids;
  }

  function family(machine) {
    const text = String(machine || "").toLowerCase();
    if (text.includes("big laser")) return "biglaser";
    if (text.includes("print") || text.trim() === "3dp") return "printer";
    if (text.includes("cnc") || text.includes("router")) return "cnc";
    if (text.includes("saw") || text.trim() === "ts") return "saw";
    if (text.includes("laser") || text.trim() === "lc") return "laser";
    return "";
  }

  function parseHour(value) {
    const text = String(value || "").trim();
    if (/^\d{1,2}$/.test(text)) return Number(text);
    const match = text.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const suffix = (match[4] || "").toLowerCase();
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    return hour;
  }

  function weekdayFromDate(iso) {
    const parts = String(iso || "").split("-").map(Number);
    if (parts.length < 3 || !parts[0]) return "";
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString("en-US", { weekday: "long" });
  }

  function cell(row, name) {
    return row[name] == null ? "" : String(row[name]).trim();
  }

  function buildFromTables(memberRows, cardRows, boardRows) {
    const members = memberRows.map((row) => ({
      id: cell(row, "membernumber").replace(/\D/g, ""),
      first: cell(row, "first"),
      last: cell(row, "last"),
      email: cell(row, "email").toLowerCase(),
      status: (cell(row, "status") || "active").toLowerCase(),
      youth: /^(y|yes|true|youth)$/i.test(cell(row, "youth")),
      parent: cell(row, "parent"),
      machines: [],
      waitlist: [],
    })).filter((member) => member.id || member.first);

    cardRows.forEach((row) => {
      const kind = family(cell(row, "machine"));
      if (!kind) return;
      const number = cell(row, "membernumber").replace(/\D/g, "");
      let person = number ? members.find((member) => member.id === number) : null;
      if (!person && cell(row, "name")) {
        const ids = linkName(cell(row, "name"), members);
        if (ids.length === 1) person = members.find((member) => member.id === ids[0]);
      }
      if (!person) return;
      if (/^wait/i.test(cell(row, "type"))) {
        if (!person.waitlist.some((item) => item.machine === kind)) {
          person.waitlist.push({ machine: kind, since: cell(row, "since"), note: cell(row, "note") });
        }
      } else if (!person.machines.includes(kind)) {
        person.machines.push(kind);
      }
    });

    const labels = { laser: "Laser", printer: "3D printers", cnc: "CNC router", saw: "Table saw" };
    const bookings = boardRows.map((row) => {
      const named = cell(row, "nameonboard") || cell(row, "name");
      const kind = family(cell(row, "machine"));
      const machine = kind === "biglaser" ? "laser" : kind;
      const start = parseHour(cell(row, "start"));
      const end = parseHour(cell(row, "end"));
      if (!machine || start == null || end == null || !named) return null;
      return {
        date: cell(row, "date"),
        day: cell(row, "weekday") || cell(row, "day") || weekdayFromDate(cell(row, "date")),
        machine,
        label: labels[machine] || cell(row, "machine"),
        start,
        end,
        hours: end - start,
        text: named,
        note: cell(row, "note"),
        people: linkText(named, members),
      };
    }).filter(Boolean);

    return { members, bookings };
  }

  return { find, explain, buildFromTables, linkName };
});
