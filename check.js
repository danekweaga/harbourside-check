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

  function explain(member, bookings, members, now) {
    const byId = {};
    members.forEach((person) => { byId[person.id] = person; });
    const today = ymd(now);
    const open = [2, 3, 4, 6].includes(now.getDay());
    const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
    const cards = bookings.filter((booking) => booking.people.includes(member.id)).map((booking) => {
      const problems = [];
      if (member.status === "lapsed") problems.push("Your membership has lapsed, so you can't use this machine.");
      if (!(member.machines || []).includes(booking.machine)) problems.push("You are not signed off on " + MACHINE[booking.machine] + ".");
      if (booking.hours > 2) problems.push("This is " + booking.hours + " hours. The limit is 2 hours a day on one machine.");
      if (booking.machine === "laser" && booking.start >= 18) {
        const buddy = booking.people.some((id) => id !== member.id && (byId[id].machines || []).includes("laser"));
        if (!buddy) problems.push("After 6:00 PM the laser needs a second person who is signed off, at the machine.");
      }
      let when = "today";
      if (booking.date < today) when = "past";
      if (booking.date > today) when = "next";
      return {
        when,
        day: booking.day,
        label: booking.label,
        text: booking.text,
        note: booking.note,
        start: hourLabel(booking.start),
        end: hourLabel(booking.end),
        problems,
      };
    });

    const sentences = [];
    if (member.status === "lapsed") sentences.push("Your membership has lapsed. You can't book or use a machine.");
    if (!open) sentences.push("The shop is closed on " + dayName + ". You can't use a machine right now.");
    else if (member.status !== "lapsed") sentences.push("The shop is open. You can use a machine you are signed off on, inside the rules.");
    const nextProblem = cards.find((card) => card.when === "next" && card.problems.length);
    if (nextProblem) {
      sentences.push(nextProblem.day + " the board has you on the " + nextProblem.label.toLowerCase() + " from " + nextProblem.start + " to " + nextProblem.end + ". " + nextProblem.problems[0]);
    }
    if (member.youth) sentences.push("You are a youth member. A parent has to be with you.");
    (member.waitlist || []).filter((row) => !(member.machines || []).includes(row.machine)).forEach((row) => {
      const [year, month, day] = row.since.split("-").map(Number);
      const since = new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric" });
      sentences.push("You are not signed off on " + MACHINE[row.machine] + " yet. You have been on the training list since " + since + ".");
    });

    return {
      name: member.first + " " + member.last,
      sentences,
      signed: ["laser", "printer", "cnc", "saw"].map((key) => ({
        key,
        label: { laser: "Laser", printer: "3D printers", cnc: "CNC router", saw: "Table saw" }[key],
        yes: (member.machines || []).includes(key),
      })),
      cards,
    };
  }

  return { find, explain };
});
