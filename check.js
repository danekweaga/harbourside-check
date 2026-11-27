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

  return { find, explain };
});
