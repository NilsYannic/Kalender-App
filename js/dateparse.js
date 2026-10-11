// Deutsche Datums- und Zeitangaben aus Text lesen
(function () {
  const { ymd, parseYmd, addDays, pad } = window.Store;

  const L = '(?<![\\p{L}\\d])';
  const R = '(?![\\p{L}\\d])';
  const re = (src) => new RegExp(src, 'iu');

  const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const MON_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MON_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

  const WEEKDAYS = { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
  const WD_FULL = 'montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag';
  const WD_ABBR = 'mo|di|mi|do|fr|sa|so';
  const MONTHS = {
    januar: 0, jan: 0, jänner: 0, februar: 1, feb: 1, märz: 2, maerz: 2, mär: 2, april: 3, apr: 3, mai: 4,
    juni: 5, jun: 5, juli: 6, jul: 6, august: 7, aug: 7, september: 8, sept: 8, sep: 8,
    oktober: 9, okt: 9, november: 10, nov: 10, dezember: 11, dez: 11,
  };
  const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

  const NUMS = {
    ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6,
    sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, anderthalb: 1.5, eineinhalb: 1.5,
    fünfzehn: 15, zwanzig: 20, dreissig: 30, dreißig: 30, vierzig: 40, fünfzig: 50, sechzig: 60, neunzig: 90,
  };
  const NUM_ALT = Object.keys(NUMS).sort((a, b) => b.length - a.length).join('|');
  const num = (s) => { s = String(s).toLowerCase().replace(',', '.'); return NUMS[s] ?? parseFloat(s); };

  const cut = (text, m) => text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length);
  const today = (now) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; };
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));

  function validDate(y, m, d) {
    const x = new Date(y, m, d);
    return x.getFullYear() === y && x.getMonth() === m && x.getDate() === d ? x : null;
  }
  // Datum ohne Jahr: liegt es in der Vergangenheit, ist das nächste Jahr gemeint
  function future(y, m, d, t0, explicitYear) {
    let x = validDate(y, m, d);
    if (x && !explicitYear && x < addDays(t0, -1)) x = validDate(y + 1, m, d);
    return x;
  }

  // Einzelnes Datums-Stück in ein Datum umwandeln (für "vom ... bis ...")
  const TOKEN = `\\d{1,2}\\.\\s?\\d{1,2}\\.(?:\\d{4}|\\d{2})?|\\d{1,2}\\.?\\s*(?:${MONTH_ALT})\\.?(?:\\s+\\d{4})?|${WD_FULL}|\\d{1,2}\\.`;

  // ---------- Datum ----------
  function extractDate(text, now = new Date()) {
    const t0 = today(now);
    let m;

    // ISO 2026-10-14
    if ((m = text.match(re(`${L}(\\d{4})-(\\d{2})-(\\d{2})${R}`)))) {
      const d = validDate(+m[1], +m[2] - 1, +m[3]);
      if (d) return { date: ymd(d), text: cut(text, m), found: true };
    }

    // 14.10. / 14.10.2026 / 14.10.26 / 14/10
    if ((m = text.match(re(`${L}(?:am\\s+|den\\s+|vom\\s+|ab\\s+|bis\\s+|auf\\s+)?(\\d{1,2})[./](\\d{1,2})[./](\\d{4}|\\d{2})?${R}`)))) {
      let y = m[3] ? +m[3] : t0.getFullYear();
      if (y < 100) y += 2000;
      const d = future(y, +m[2] - 1, +m[1], t0, !!m[3]);
      if (d) return { date: ymd(d), text: cut(text, m), found: true };
    }
    // 14.10 ohne Schlusspunkt – nur mit "am/den/bis/vom", damit Uhrzeiten wie 14.30 nicht verwechselt werden
    if ((m = text.match(re(`${L}(?:am|den|vom|bis|ab|auf)\\s+(\\d{1,2})[./](\\d{1,2})(?![\\d.:]|\\s*uhr)${R}`)))) {
      const d = +m[2] <= 12 ? future(t0.getFullYear(), +m[2] - 1, +m[1], t0, false) : null;
      if (d) return { date: ymd(d), text: cut(text, m), found: true };
    }

    // 14. Oktober (2026)
    if ((m = text.match(re(`${L}(?:am\\s+|den\\s+|vom\\s+|bis\\s+|auf\\s+)?(\\d{1,2})\\.?\\s*(${MONTH_ALT})\\.?(?:\\s+(\\d{4}))?${R}`)))) {
      const d = future(m[3] ? +m[3] : t0.getFullYear(), MONTHS[m[2].toLowerCase()], +m[1], t0, !!m[3]);
      if (d) return { date: ymd(d), text: cut(text, m), found: true };
    }

    // heute, morgen, übermorgen ...
    if ((m = text.match(re(`${L}(?:am\\s+|auf\\s+|bis\\s+)?(überübermorgen|übermorgen|uebermorgen|vorgestern|gestern|heute|morgen)${R}`)))) {
      const off = { überübermorgen: 3, übermorgen: 2, uebermorgen: 2, vorgestern: -2, gestern: -1, heute: 0, morgen: 1 }[m[1].toLowerCase()];
      return { date: ymd(addDays(t0, off)), text: cut(text, m), found: true };
    }

    // in 3 Tagen / in zwei Wochen / in einem Monat
    if ((m = text.match(re(`${L}in\\s+(\\d+|${NUM_ALT})\\s+(tag(?:en)?|woche(?:n)?|monat(?:en)?|jahr(?:en)?)${R}`)))) {
      const n = Math.round(num(m[1]));
      const u = m[2].toLowerCase();
      let d;
      if (u.startsWith('tag')) d = addDays(t0, n);
      else if (u.startsWith('woche')) d = addDays(t0, n * 7);
      else if (u.startsWith('monat')) d = new Date(t0.getFullYear(), t0.getMonth() + n, t0.getDate());
      else d = new Date(t0.getFullYear() + n, t0.getMonth(), t0.getDate());
      return { date: ymd(d), text: cut(text, m), found: true };
    }

    // Ende/Anfang/Mitte (nächster) Woche
    if ((m = text.match(re(`${L}(anfang|mitte|ende)\\s+(?:der\\s+)?(diese[rn]?|nächste[rn]?|naechste[rn]?|kommende[rn]?)?\\s*woche${R}`)))) {
      const next = m[2] && !/^diese/i.test(m[2]);
      const mo = addDays(mondayOf(t0), next ? 7 : 0);
      const off = { anfang: 0, mitte: 2, ende: 4 }[m[1].toLowerCase()];
      let d = addDays(mo, off);
      if (d < t0) d = t0;
      return { date: ymd(d), text: cut(text, m), found: true };
    }

    // "nächste Woche" (evtl. mit Wochentag)
    let weekBase = null;
    if ((m = text.match(re(`${L}(?:in\\s+der\\s+|die\\s+)?(nächste|naechste|kommende|übernächste|uebernaechste)n?r?\\s+woche${R}`)))) {
      const extra = /über|ueber/i.test(m[1]) ? 14 : 7;
      weekBase = addDays(mondayOf(t0), extra);
      text = cut(text, m);
    }

    // Wochentage: am Montag, nächsten Freitag, jeden Dienstag, montags, am Do
    const wdRe = `${L}(?:(am|diesen|diesem|kommenden|kommendem|nächsten|nächstem|naechsten|übernächsten|uebernaechsten|jeden|immer|auf|bis|ab)\\s+)?(?:(${WD_FULL})(s)?|(${WD_ABBR})\\.)${R}`;
    const wdAbbrRe = `${L}(am|diesen|nächsten|naechsten|jeden|auf|bis|ab)\\s+(${WD_ABBR})${R}`;
    if ((m = text.match(re(wdRe))) || (m = text.match(re(wdAbbrRe)))) {
      const word = (m[2] || m[4] || '').toLowerCase();
      const wd = WEEKDAYS[word];
      const pre = (m[1] || '').toLowerCase();
      const weekly = pre === 'jeden' || pre === 'immer' || !!m[3];
      let d;
      if (weekBase) d = addDays(weekBase, (wd + 6) % 7);
      else {
        let delta = (wd - t0.getDay() + 7) % 7;
        if (delta === 0 && !weekly) delta = 7;
        if (/über|ueber/.test(pre)) delta += 7;
        d = addDays(t0, delta);
      }
      let rest = cut(text, m);
      // "Freitag in einer Woche" / "Freitag in acht Tagen"
      const inWeek = rest.match(re(`${L}in\\s+(?:einer|1|acht|8)\\s+(?:woche|tagen)${R}`));
      if (inWeek && !weekBase) { d = addDays(d, 7); rest = cut(rest, inWeek); }
      return { date: ymd(d), text: rest, found: true, weekly };
    }
    if (weekBase) return { date: ymd(weekBase), text, found: true };

    // "am 20." – nur Tag (diesen oder nächsten Monat)
    if ((m = text.match(re(`${L}(?:am|den|bis|zum|auf)\\s+(\\d{1,2})\\.(?!\\s*\\d)`)))) {
      const day = +m[1];
      let d = validDate(t0.getFullYear(), t0.getMonth(), day);
      if (!d || d < t0) d = validDate(t0.getFullYear(), t0.getMonth() + 1, day) || validDate(t0.getFullYear(), t0.getMonth() + 2, day);
      if (d) return { date: ymd(d), text: cut(text, m), found: true };
    }

    // Wochenende
    if ((m = text.match(re(`${L}(?:am\\s+|dieses\\s+|diesem\\s+|übers\\s+|ueber\\s+das\\s+|nächstes\\s+|naechstes\\s+)?wochenende${R}`)))) {
      const dow = t0.getDay();
      const d = dow === 6 || dow === 0 ? t0 : addDays(t0, 6 - dow);
      return { date: ymd(d), text: cut(text, m), found: true };
    }

    // Ende Monat / nächsten Monat / Anfang nächsten Monat
    if ((m = text.match(re(`${L}(?:am\\s+)?ende\\s+(?:des\\s+|dieses\\s+)?monat(?:s)?${R}`)))) {
      return { date: ymd(new Date(t0.getFullYear(), t0.getMonth() + 1, 0)), text: cut(text, m), found: true };
    }
    if ((m = text.match(re(`${L}(?:anfang\\s+|im\\s+)?(nächsten|naechsten|kommenden)\\s+monat(?:s)?${R}`)))) {
      return { date: ymd(new Date(t0.getFullYear(), t0.getMonth() + 1, 1)), text: cut(text, m), found: true };
    }

    return { date: null, text, found: false };
  }

  // "vom 12. bis 16. Oktober", "12.–16.10.", "von Montag bis Freitag"
  function extractDateRange(text, now = new Date()) {
    let m = text.match(re(`${L}(?:vom|von|ab)?\\s*(${TOKEN})\\s*(?:-|–|bis(?:\\s+(?:zum|am))?)\\s*(${TOKEN})`));
    if (!m) return null;
    const a = m[1].trim(), b = m[2].trim();
    // Mindestens eine Seite muss eindeutig ein Datum sein (nicht nur "12.")
    if (/^\d{1,2}\.$/.test(a) && /^\d{1,2}\.$/.test(b)) return null;
    const second = extractDate(b, now);
    if (!second.found) return null;
    let first;
    if (/^\d{1,2}\.$/.test(a)) {
      const e = parseYmd(second.date);
      const day = +a.slice(0, -1);
      let d = validDate(e.getFullYear(), e.getMonth(), day);
      if (!d || d > e) { // "28. bis 3. Nov." -> 28. Okt.
        const p = new Date(e.getFullYear(), e.getMonth() - 1, day);
        d = p.getDate() === day ? p : null;
      }
      if (!d) return null;
      first = { date: ymd(d) };
    } else {
      first = extractDate(a, now);
      if (!first.found) return null;
    }
    let end = second.date;
    // "vom 3.10. bis 18.10." während der Ferien: Beginn liegt schon zurück, nicht nächstes Jahr
    if (end < first.date && /\d/.test(a) && !/\d{4}|\.\d{2}$/.test(a)) {
      const f = parseYmd(first.date); f.setFullYear(f.getFullYear() - 1);
      if (ymd(f) <= end) first = { date: ymd(f) };
    }
    if (end < first.date) {
      // "von Freitag bis Montag" -> Montag danach
      const e = parseYmd(end);
      end = ymd(addDays(e, 7 * Math.ceil((parseYmd(first.date) - e) / (7 * 86400000))));
    }
    if (end === first.date) return null;
    return { date: first.date, endDate: end, text: cut(text, m) };
  }

  // ---------- Uhrzeit ----------
  const T = '(\\d{1,2})(?:(?:[:.h])(\\d{2}))?';
  function hm(h, mi) {
    h = +h; mi = +(mi || 0);
    if (h > 24 || mi > 59) return null;
    return { h: h === 24 ? 0 : h, m: mi };
  }

  function extractTime(text, now = new Date()) {
    let start = null, end = null, m, daypart = null, exact = false;

    // relative Zeit: "in 30 Minuten", "in 2 Stunden"
    if ((m = text.match(re(`${L}in\\s+(\\d+|${NUM_ALT}|einer\\s+halben|einer\\s+viertel)\\s*(minuten|min|stunden?|std)${R}`)))) {
      const raw = m[1].toLowerCase();
      const n = raw.includes('halb') ? 0.5 : raw.includes('viertel') ? 0.25 : num(raw);
      const mins = Math.round(/^(st)/i.test(m[2]) ? n * 60 : n);
      const t = new Date(now.getTime() + mins * 60000);
      return { start: `${pad(t.getHours())}:${pad(t.getMinutes())}`, end: null, text: cut(text, m), relDate: ymd(t), daypart: null };
    }

    // Situationen: "nach der Schule", "in der Mittagspause" ...
    const SITU = [
      ['vor\\s+der\\s+schule', 7, 0], ['nach\\s+der\\s+schule', 16, 0], ['(?:in\\s+der\\s+)?mittagspause|über\\s+mittag|ueber\\s+mittag', 12, 0],
      ['nach\\s+dem\\s+mittag(?:essen)?', 13, 30], ['nach\\s+dem\\s+abendessen|nach\\s+dem\\s+znacht', 19, 30], ['vor\\s+dem\\s+schlafen(?:gehen)?', 21, 30],
    ];
    let situ = null;
    for (const [src, h, mi] of SITU) {
      if ((m = text.match(re(`${L}(?:${src})${R}`)))) { situ = { h, m: mi }; text = cut(text, m); break; }
    }

    if ((m = text.match(re(`${L}(morgens|frühmorgens|früh|frueh|vormittags|am\\s+vormittag|mittags|am\\s+mittag|nachmittags|am\\s+nachmittag|abends|am\\s+abend|abend|nachts|in\\s+der\\s+nacht|in\\s+der\\s+früh)${R}`)))) {
      const w = m[1].toLowerCase();
      daypart = /nachmittag|abend|nacht/.test(w) ? 'pm' : /mittag/.test(w) ? 'noon' : 'am';
      text = cut(text, m);
    }

    // von 14 bis 16 Uhr / 14-16 Uhr / 14:00–15:30 / zwischen 14 und 16 Uhr / ab 14 Uhr bis 16 Uhr
    m = text.match(re(`${L}(?:zwischen\\s+)${T}\\s*(?:uhr\\s*)?und\\s+${T}\\s*(?:uhr)?${R}`))
      || text.match(re(`${L}(?:von\\s+|ab\\s+)?${T}\\s*(?:uhr\\s*)?(?:bis|-|–)\\s*${T}\\s*(?:uhr)?${R}`));
    if (m && /von|uhr|zwischen|ab|[:h]/i.test(m[0])) {
      start = hm(m[1], m[2]); end = hm(m[3], m[4]);
      if (start && end) { text = cut(text, m); exact = true; } else start = end = null;
    }

    if (!start && (m = text.match(re(`${L}(?:um\\s+)?(?:(viertel)\\s+(nach|vor)|(halb|dreiviertel))\\s+(\\d{1,2}|${NUM_ALT})${R}`)))) {
      const h = Math.round(num(m[4]));
      if (m[1]) start = m[2].toLowerCase() === 'nach' ? { h, m: 15 } : { h: (h + 23) % 24, m: 45 };
      else if (m[3].toLowerCase() === 'halb') start = { h: (h + 23) % 24, m: 30 };
      else start = { h: (h + 23) % 24, m: 45 };
      text = cut(text, m);
    }

    if (!start && (m = text.match(re(`${L}(?:um|ab|gegen|bis|so\\s+um|so\\s+gegen|ca\\.?\\s*um)\\s+${T}\\s*(?:uhr|h)?${R}`)))) {
      start = hm(m[1], m[2]); if (start) { text = cut(text, m); exact = !!m[2]; }
    }
    if (!start && (m = text.match(re(`${L}${T}\\s*(?:uhr|h)${R}`)))) {
      start = hm(m[1], m[2]); if (start) { text = cut(text, m); exact = true; }
    }
    if (!start && (m = text.match(re(`${L}(\\d{1,2})[:h](\\d{2})${R}`)))) {
      start = hm(m[1], m[2]); if (start) { text = cut(text, m); exact = true; }
    }
    // "um acht", "um zwei Uhr"
    if (!start && (m = text.match(re(`${L}(?:um|ab|gegen)\\s+(${NUM_ALT})(?:\\s+uhr)?${R}`)))) {
      const h = num(m[1]);
      if (h >= 1 && h <= 12 && Number.isInteger(h)) { start = { h, m: 0 }; text = cut(text, m); }
    }

    const fix = (t) => {
      if (!t) return t;
      if (daypart === 'pm' && t.h < 12) t.h += 12;
      else if (daypart === 'noon' && t.h < 5) t.h += 12;
      else if (!daypart && t.h >= 1 && t.h <= 6 && !exact) t.h += 12; // "um 3" = 15 Uhr
      return t;
    };
    start = fix(start);
    if (end) {
      if (daypart === 'pm' && end.h < 12) end.h += 12;
      if (start && end.h * 60 + end.m <= start.h * 60 + start.m && end.h < 12) end.h += 12;
    }
    if (!start && situ) start = situ;
    if (!start && daypart === 'noon') start = { h: 12, m: 0 };

    const f = (t) => (t ? `${pad(t.h)}:${pad(t.m)}` : null);
    return { start: f(start), end: f(end), text, daypart };
  }

  function extractDuration(text) {
    let m = text.match(re(`${L}(?:für\\s+|fuer\\s+|dauert\\s+)?(?:eine\\s+)?(halbe|dreiviertel)\\s+stunde${R}`));
    if (m) return { minutes: /halbe/i.test(m[1]) ? 30 : 45, text: cut(text, m) };
    m = text.match(re(`${L}(?:für\\s+|fuer\\s+|dauert\\s+(?:ca\\.?\\s+|etwa\\s+)?)?(\\d+(?:[.,]\\d+)?|${NUM_ALT})\\s*(stunden?|std\\.?|h|minuten|min\\.?)(?:\\s+lang)?${R}`));
    if (!m) return { minutes: null, text };
    const n = num(m[1]);
    const minutes = Math.round(/^(stunde|std|h)/i.test(m[2]) ? n * 60 : n);
    return { minutes, text: cut(text, m) };
  }

  function extractReminder(text) {
    let m = text.match(re(`${L}(?:und\\s+)?(?:erinner\\w*\\s+(?:mich\\s+)?(?:bitte\\s+)?)?(\\d+|${NUM_ALT})\\s*(minuten|min\\.?|stunden?|std\\.?|tage?n?|wochen?)\\s+(?:vorher|davor|früher|zuvor|bevor)(?:\\s+erinnern)?${R}`));
    if (m) {
      const n = num(m[1]); const u = m[2].toLowerCase();
      const minutes = Math.round(u.startsWith('st') ? n * 60 : u.startsWith('w') ? n * 10080 : u.startsWith('t') ? n * 1440 : n);
      return { reminder: minutes, text: cut(text, m) };
    }
    m = text.match(re(`${L}(?:und\\s+)?(?:erinner\\w*\\s+(?:mich\\s+)?)?(?:am\\s+)?(vorabend|abend\\s+davor|abend\\s+vorher|vortag|tag\\s+davor|tag\\s+vorher)(?:\\s+erinnern)?${R}`));
    if (m) return { reminder: /abend/i.test(m[1]) ? 'vorabend' : 1440, text: cut(text, m) };
    m = text.match(re(`${L}(?:mit\\s+erinnerung|erinner\\w*\\s+mich(?:\\s+(?:bitte|daran|dran|an))*(?:\\s+dass)?|erinnerung)${R}`));
    if (m) return { reminder: 'default', text: cut(text, m) };
    return { reminder: null, text };
  }

  function extractRepeat(text, now) {
    let repeat = null, interval = 1, until = null, m;
    const rules = [
      [`${L}(?:jeden\\s+tag|täglich|taeglich|alle\\s+tage)${R}`, 'daily'],
      [`${L}(?:jede\\s+woche|wöchentlich|woechentlich|einmal\\s+pro\\s+woche)${R}`, 'weekly'],
      [`${L}(?:jeden\\s+monat|monatlich|einmal\\s+im\\s+monat)${R}`, 'monthly'],
      [`${L}(?:jedes\\s+jahr|jährlich|jaehrlich)${R}`, 'yearly'],
    ];
    for (const [src, kind] of rules) {
      if ((m = text.match(re(src)))) { repeat = kind; text = cut(text, m); break; }
    }
    if (!repeat && (m = text.match(re(`${L}alle\\s+(\\d+|${NUM_ALT})\\s+(tage|wochen|monate|jahre)${R}`)))) {
      interval = Math.max(1, Math.round(num(m[1])));
      repeat = { t: 'daily', w: 'weekly', m: 'monthly', j: 'yearly' }[m[2][0].toLowerCase()];
      text = cut(text, m);
    }
    // "jeden zweiten Montag" -> alle 2 Wochen (Wochentag bleibt für extractDate stehen)
    if (!repeat && (m = text.match(re(`${L}jeden\\s+(zweiten|2\\.|dritten|3\\.)\\s+(?=${WD_FULL})`)))) {
      interval = /zwei|2/.test(m[1]) ? 2 : 3; repeat = 'weekly'; text = cut(text, m);
    }
    if (repeat && (m = text.match(re(`${L}bis\\s+(?:zum\\s+|am\\s+|ende\\s+)?(${TOKEN}|(?:den\\s+)?(?:sommer|herbst|winter|sport|frühlings)ferien)`)))) {
      const r = extractDate(m[1], now);
      if (r.found) { until = r.date; text = cut(text, m); }
    }
    return { repeat, interval, until, text };
  }

  // Zeitraum für Abfragen ("diese Woche", "morgen", ...)
  function parseRange(text, now = new Date()) {
    const t0 = today(now);
    const s = text.toLowerCase();
    const r = (a, b, label) => ({ from: ymd(a), to: ymd(b), label });
    let m;
    const rng = extractDateRange(text, now);
    if (rng) return { from: rng.date, to: rng.endDate, label: `vom ${formatDate(rng.date)} bis ${formatDate(rng.endDate)}` };
    if ((m = s.match(re(`${L}(?:nächsten|naechsten|kommenden)\\s+(\\d+|${NUM_ALT})\\s+tage${R}`)))) {
      const n = Math.round(num(m[1]));
      return r(t0, addDays(t0, n - 1), `in den nächsten ${n} Tagen`);
    }
    if ((m = s.match(re(`${L}(?:nächsten|naechsten|kommenden)\\s+(\\d+|${NUM_ALT})\\s+wochen${R}`)))) {
      const n = Math.round(num(m[1]));
      return r(t0, addDays(t0, n * 7 - 1), `in den nächsten ${n} Wochen`);
    }
    if (re(`${L}(übernächste|uebernaechste)n?r?\\s+woche${R}`).test(s)) {
      const mo = addDays(mondayOf(t0), 14); return r(mo, addDays(mo, 6), 'übernächste Woche');
    }
    if (re(`${L}(nächste|naechste|kommende)n?r?\\s+woche${R}`).test(s) && !re(`${L}(${WD_FULL})${R}`).test(s)) {
      const mo = addDays(mondayOf(t0), 7); return r(mo, addDays(mo, 6), 'nächste Woche');
    }
    if (re(`${L}(diese|dieser|die|der)\\s+woche${R}`).test(s)) {
      if (t0.getDay() === 0) { const mo = addDays(t0, 1); return r(t0, addDays(mo, 6), 'in der kommenden Woche'); }
      return r(t0, addDays(mondayOf(t0), 6), 'diese Woche');
    }
    if (re(`${L}wochenende${R}`).test(s)) {
      const dow = t0.getDay();
      const sat = dow === 0 ? addDays(t0, -1) : addDays(t0, 6 - dow);
      return r(dow === 0 ? t0 : sat, addDays(sat, 1), 'am Wochenende');
    }
    if (re(`${L}(nächsten|naechsten|kommenden)\\s+monat${R}`).test(s)) {
      return r(new Date(t0.getFullYear(), t0.getMonth() + 1, 1), new Date(t0.getFullYear(), t0.getMonth() + 2, 0), 'nächsten Monat');
    }
    if (re(`${L}(diesen|dieser|diesem|den|im)\\s+monat${R}`).test(s)) {
      return r(t0, new Date(t0.getFullYear(), t0.getMonth() + 1, 0), 'diesen Monat');
    }
    if ((m = s.match(re(`${L}(?:im\\s+)?(${MONTH_ALT})${R}`))) && !/\d/.test(s)) {
      const mon = MONTHS[m[1]];
      let y = t0.getFullYear(); if (mon < t0.getMonth()) y++;
      return r(new Date(y, mon, 1), new Date(y, mon + 1, 0), `im ${MON_LONG[mon]}`);
    }
    if (re(`${L}(demnächst|bald|nächsten\\s+tage|kommenden\\s+tage|anstehend)`).test(s)) return r(t0, addDays(t0, 6), 'in den nächsten Tagen');
    const d = extractDate(text, now);
    if (d.found) {
      const label = relLabel(d.date, now);
      return { from: d.date, to: d.date, label: label ? label.toLowerCase() : `am ${formatDate(d.date)}` };
    }
    return null;
  }

  // ---------- Formatierung ----------
  function formatDate(s, long = false) {
    const d = parseYmd(s);
    const y = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
    return long
      ? `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MON_LONG[d.getMonth()]}${y}`
      : `${WD_SHORT[d.getDay()]}, ${d.getDate()}. ${MON_SHORT[d.getMonth()]}${y}`;
  }
  function relLabel(s, now = new Date()) {
    const diff = window.Store.dayDiff(ymd(today(now)), s);
    return { 0: 'Heute', 1: 'Morgen', 2: 'Übermorgen', '-1': 'Gestern' }[diff] || null;
  }
  function formatTime(ev) {
    let t = !ev.start ? 'Ganztägig' : ev.end ? `${ev.start}–${ev.end}` : ev.start;
    if (ev.endDate) {
      const a = parseYmd(ev.date), b = parseYmd(ev.endDate);
      const span = a.getMonth() === b.getMonth() ? `${a.getDate()}.–${b.getDate()}. ${MON_SHORT[b.getMonth()]}` : `${a.getDate()}. ${MON_SHORT[a.getMonth()]} – ${b.getDate()}. ${MON_SHORT[b.getMonth()]}`;
      t = ev.start ? `${span} · ${t}` : span;
    }
    return t;
  }
  function formatMinutes(min) {
    if (min < 60) return `${min} Min.`;
    if (min % 10080 === 0) return min === 10080 ? '1 Woche' : `${min / 10080} Wochen`;
    if (min % 1440 === 0) return min === 1440 ? '1 Tag' : `${min / 1440} Tage`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
  }

  window.DP = {
    extractDate, extractDateRange, extractTime, extractDuration, extractReminder, extractRepeat, parseRange,
    formatDate, relLabel, formatTime, formatMinutes, WD_LONG, WD_SHORT, MON_LONG, MON_SHORT, mondayOf, L, R,
    WD_FULL, WEEKDAYS, NUM_ALT, num,
  };
})();
