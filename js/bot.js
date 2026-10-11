// Lokaler Kalender-Assistent: versteht deutsche Sätze ohne Internet
(function () {
  const S = window.Store;
  const DP = window.DP;
  const { L, R } = DP;
  const w = (src, flags = 'iu') => new RegExp(`${L}(?:${src})${R}`, flags);

  const CAT_WORDS = {
    pruefung: 'prüfung|pruefung|prüfungen|test|tests|klausur|probe|schularbeit|vortrag|präsentation|praesentation|referat|quiz|lernkontrolle|lk|matur|\\p{L}*prüfung|\\p{L}*test|\\p{L}*vortrag',
    hausaufgabe: 'hausaufgabe|hausaufgaben|hausi|hausis|ha|aufgabe|aufgaben|abgabe|abgeben|lernen|üben|ueben|lesen|arbeitsblatt|lernzeit|\\p{L}*aufgaben?',
    sport: 'training|trainieren|fussball|fußball|sport|turnen|schwimmen|tennis|handball|unihockey|volleyball|basketball|joggen|laufen|gym|fitness|tanzen|tanz|reiten|ski|snowboard|match|klettern|velo|biken|judo|karate|\\p{L}*training|\\p{L}*turnier',
    freizeit: 'kino|party|geburtstag|treffen|ausflug|konzert|essen|chillen|gamen|feier|ferien|urlaub|shoppen|film|abmachen|übernachten|freunde?|freundin|date|grillieren|brunch|zmittag|znacht|festival',
    termin: 'arzt\\p{L}*|\\p{L}*termin|ärztin|zahnarzt|zahnärztin|kieferorthopäde|kieferorthopäd\\p{L}*|kfo|coiffeur|friseur|frisör|termin|optiker|physio|therapie|besprechung|vorstellungsgespräch|schnupperlehre|schnuppern|bewerbung|impfung|kontrolle|dentalhygiene',
    schule: 'schule|unterricht|lektion|elternabend|schulreise|exkursion|nachhilfe|klassenlager|lager|sporttag|projektwoche|schulfest|stundenplan|wahlfach|freifach|musikunterricht|klavier\\p{L}*|gitarre\\p{L}*|chor|orchester',
  };
  // Schulfächer: Schreibweise für Titel
  const SUBJECTS = {
    mathe: 'Mathe', mathematik: 'Mathematik', deutsch: 'Deutsch', englisch: 'Englisch', english: 'Englisch', franz: 'Franz',
    französisch: 'Französisch', franzoesisch: 'Französisch', bio: 'Bio', biologie: 'Biologie', chemie: 'Chemie', physik: 'Physik',
    geschichte: 'Geschichte', geo: 'Geo', geografie: 'Geografie', geographie: 'Geografie', informatik: 'Informatik', musik: 'Musik',
    bg: 'BG', wirtschaft: 'Wirtschaft', wr: 'WR', latein: 'Latein', italienisch: 'Italienisch', italiano: 'Italienisch', spanisch: 'Spanisch',
    religion: 'Religion', philosophie: 'Philosophie', ethik: 'Ethik', nt: 'NT', mint: 'MINT', ef: 'EF', sf: 'SF', psychologie: 'Psychologie',
    pädagogik: 'Pädagogik', griechisch: 'Griechisch', rus: 'Russisch', russisch: 'Russisch', chinesisch: 'Chinesisch', ttg: 'TTG', werken: 'Werken',
  };
  const TYPES = {
    prüfung: 'Prüfung', pruefung: 'Prüfung', test: 'Test', probe: 'Probe', klausur: 'Klausur', vortrag: 'Vortrag', präsentation: 'Präsentation',
    referat: 'Referat', quiz: 'Quiz', lernkontrolle: 'Lernkontrolle', hausaufgabe: 'Hausaufgabe', hausaufgaben: 'Hausaufgaben', aufgaben: 'Aufgaben',
    hausi: 'Hausaufgabe', hausis: 'Hausaufgaben', ha: 'Hausaufgabe', abgabe: 'Abgabe', lektion: 'Lektion', unterricht: 'Unterricht', nachhilfe: 'Nachhilfe',
    lernen: 'lernen', üben: 'üben', ueben: 'üben', arbeitsblatt: 'Arbeitsblatt', dossier: 'Dossier',
  };
  // Orte, die auch kleingeschrieben erkannt werden
  const PLACES = 'aula|turnhalle|sporthalle|halle|mensa|bibliothek|bibli|mediothek|zimmer|raum|hallenbad|schwimmbad|freibad|kino|stadion|schule|gymnasium|schulhaus|kirche|bahnhof|café|cafe|restaurant|park|praxis|spital|zentrum|eishalle|labor|musikschule|saal|klasse|klassenzimmer|pausenhalle|sportplatz|fussballplatz|platz|büro|stadt|innenstadt|migros|coop|mall|einkaufszentrum';

  const norm = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  function detectCategory(text) {
    for (const [cat, words] of Object.entries(CAT_WORDS)) if (w(words).test(text)) return cat;
    if (Object.keys(SUBJECTS).some((s) => w(s).test(text))) return 'schule';
    return 'sonstiges';
  }

  // Ort: "im Zimmer 204", "in der Aula", "bei Lisa", "Ort: Thun", "@Migros"
  function extractLocation(text) {
    let m = text.match(/(?:^|\s)(?:ort|wo|treffpunkt)\s*:\s*([^,;.]+)/iu);
    if (m) return { location: cap(m[1].trim()), text: text.replace(m[0], ' ') };
    m = text.match(/(?:^|\s)@\s*([\p{L}\d][\p{L}\d -]*?)(?=$|[,;.]|\s(?:um|am|ab|von|bis)\s)/iu);
    if (m) return { location: cap(m[1].trim()), text: text.replace(m[0], ' ') };
    m = text.match(/(?:^|\s)bei\s+(mir|uns)(?:\s+(?:zu\s*hause|zuhause|daheim))?(?=$|[\s,.;])/iu)
      || text.match(/(?:^|\s)(zu\s*hause|zuhause|daheim)(?=$|[\s,.;])/iu);
    if (m) return { location: /^(mir|uns)$/i.test(m[1]) ? `bei ${m[1].toLowerCase()}` : 'Zuhause', text: text.replace(m[0], ' ') };

    const pre = '(?:im|in der|in dem|in|beim|bei der|bei dem|auf dem|auf der|vor der|vor dem|vorm|am)';
    // "bei nico" (klein geschrieben) -> "bei Nico"
    m = text.match(/(^|\s)bei\s+([a-zäöü][\p{L}-]{2,})(?=$|[\s,.;!?])/u);
    if (m && !/^(der|die|das|dem|den|einem|einer|regen|schönem|schlechtem|bedarf|gelegenheit|mir|uns|euch|ihm|ihr|ihnen)$/i.test(m[2])) {
      return { location: 'bei ' + cap(m[2]), text: text.slice(0, m.index) + m[1] + text.slice(m.index + m[0].length) };
    }
    // bekannte Orte (auch klein geschrieben) + optionale Nummer/Name
    m = text.match(new RegExp(`(^|\\s)(${pre})\\s+((?:${PLACES})\\p{L}*)((?:\\s+(?:\\d+[\\p{L}]?|[A-ZÄÖÜ][\\p{L}\\d-]*))?)(?=$|[\\s,.;!?])`, 'iu'));
    if (m) return { location: cap(m[3]) + m[4], text: text.slice(0, m.index) + m[1] + text.slice(m.index + m[0].length) };
    // gross geschriebene Namen: "in Thun", "bei Lisa", "im Hallenbad Spiez"
    m = text.match(new RegExp(`(^|\\s)(${pre}|bei|Im|In|Bei|Beim)\\s+([A-ZÄÖÜ][\\p{L}\\d-]*|\\d+[a-z]?)((?:\\s+(?:\\d+[\\p{L}]?|[A-ZÄÖÜ]\\d+[\\p{L}\\d]*|[A-ZÄÖÜ][\\p{L}-]+(?=$|[\\s,.;!?]))){0,3})`, 'u'));
    if (m) {
      const word = m[3];
      const lw = word.toLowerCase();
      if (SUBJECTS[lw] || DP.WEEKDAYS[lw] !== undefined || /^(kalender|der|die|das|ferien|pause|mittag|abend|morgen|nacht)$/i.test(lw)) return { location: '', text };
      // "am" nur vor Orten (am See, am Bahnhof) – nicht "am Freitag"
      if (/^am$/i.test(m[2])) return { location: '', text };
      let loc = word + m[4];
      if (/^bei(?!m)/i.test(m[2])) loc = 'bei ' + loc;
      return { location: loc, text: text.slice(0, m.index) + m[1] + text.slice(m.index + m[0].length) };
    }
    return { location: '', text };
  }

  // Zusatzinfos -> Notizen
  function extractNotes(text) {
    const notes = [];
    let m;
    if ((m = text.match(/(?:^|\s)(?:notiz|notizen|info|infos|details?|beschreibung|hinweis|bemerkung|beachte)\s*:\s*(.+)$/iu))) {
      notes.push(m[1].trim()); text = text.slice(0, m.index);
    }
    while ((m = text.match(/\(([^)]{2,})\)/u))) { notes.push(m[1].trim()); text = text.replace(m[0], ' '); }
    if ((m = text.match(/(?:^|[\s,])(?:und\s+)?(?:mitnehmen|mitbringen|nicht vergessen)\s*:\s*([^;.]+)/iu))) {
      notes.push('Mitnehmen: ' + m[1].trim()); text = text.replace(m[0], ' ');
    }
    if ((m = text.match(/(?:^|[\s,])(?:und\s+)?(?:bring|bringe|nimm|nehme)\s+(.+?)\s+mit(?=$|[\s,.;!])/iu))) {
      notes.push('Mitnehmen: ' + m[1].trim()); text = text.replace(m[0], ' ');
    }
    if ((m = text.match(/(?:^|[\s,])(?:über|ueber|zum thema|thema|stoff|themen)\s*:?\s+(?!(?:mittag|das wochenende|nacht)\b)([^,;.]+?)(?=$|[,;.!?]|\s(?:um|am|ab|von|bis|im|in der|und erinner)\s)/iu))) {
      notes.push('Thema: ' + cap(m[1].trim())); text = text.replace(m[0], ' ');
    }
    // Seiten/Aufgaben: "S. 45 Nr. 3 und 4", "Seite 12-14", "Kapitel 3"
    const refRe = /(?:^|\s)((?:s\.|seite|seiten|nr\.?|nummer|nummern|aufgabe|aufgaben|kapitel|kap\.|übung|uebung|ex\.?|lektion|unit|lesson)\s*\d+[a-z]?(?:\s*(?:[-–,/]|und|bis)\s*\d+[a-z]?)*)/iu;
    const refs = [];
    while ((m = text.match(refRe))) { refs.push(m[1].trim().replace(/^s\./i, 'S.')); text = text.replace(m[0], ' '); }
    if (refs.length) notes.push(refs.join(', '));
    return { notes: notes.join('\n'), text };
  }

  function cleanTitle(text) {
    let t = ' ' + text + ' ';
    const kill = [
      'bitte|hey|hallo|hoi|sali|ok|okay|kannst du|könntest du|würdest du|du|mal|doch|kurz|einfach|noch|dann|halt|eben|ungefähr|ungefaehr|circa|ca\\.?|etwa|lang|wichtig|dringend',
      '(?:trag|trage|schreib|schreibe|füg|füge|fueg|fuege|setz|setze|mach|mache|erstell|erstelle|plan|plane|notier|notiere|speicher|speichere|merk|merke|leg|lege)(?:\\s+(?:mir|uns|mal|doch|bitte))*',
      'in (?:den|meinen|meinem|unseren) kalender|im kalender|in den plan|in meinen plan|zum kalender',
      'eintragen|hinzufügen|hinzufuegen|notieren|speichern|erstellen|einplanen|merken|anlegen|vormerken',
      'ich habe|ich hab|hab ich|habe ich|ich muss|muss ich|ich gehe|ich geh|wir haben|wir gehen|ich bin|ich will|ich möchte|ich moechte|es gibt|es ist|da ist|ich treffe|treffe ich|ich hätte|ich habe da|da habe ich|ich schreibe|wir schreiben|schreiben wir|ich darf|ich soll',
      '(?:einen|ein|eine|neuen|neuer|neues)\\s+(?:termin|eintrag|event)\\s*:?|termin\\s*:',
      'dass|daran|dran|mich|stattfinden|findet statt|statt',
    ];
    for (const k of kill) t = t.replace(w(k, 'giu'), ' ');
    t = t.replace(/[!?,;:]+/g, ' ').replace(/(^|\s)\.+|\.+(\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    const lead = /^(an|ans|ums|zum|zur|für|fuer|wegen|mit dem|der|die|das|den|dem|ein|eine|einen|einem|einer|meine|meinen|mein|meinem|meiner|und|am|um|auf|ist|so|also|wir|ich|-)\s+/i;
    const trail = /\s+(ist|sind|habe|hab|muss|gehe|haben|hat|ein|an|hinzu|auf|machen|gehen|und|am|um|bis|ab|so|vor|in|im|mit|-)$/i;
    let prev;
    do { prev = t; t = t.replace(lead, '').replace(trail, '').trim(); } while (t !== prev);
    if (/^(ein|hinzu|an|auf|termin|eintrag|so|und)$/i.test(t)) t = '';
    return smartTitle(t);
  }

  // "prüfung in mathe" -> "Mathe-Prüfung", "lernen für bio" -> "Bio lernen"
  function smartTitle(t) {
    if (!t) return '';
    let words = t.split(' ');
    const si = words.findIndex((x) => SUBJECTS[x.toLowerCase().replace(/-.*/, '')]);
    const ti = words.findIndex((x) => TYPES[x.toLowerCase()]);
    if (si >= 0 && ti >= 0 && si !== ti) {
      const subj = SUBJECTS[words[si].toLowerCase()] || cap(words[si]);
      const type = TYPES[words[ti].toLowerCase()];
      const compound = /^[a-zü]/.test(type) ? `${subj} ${type}` : `${subj}-${type}`;
      const drop = new Set([si, ti]);
      // Verbindungswörter zwischen Fach und Typ entfernen
      for (let k = Math.min(si, ti) + 1; k < Math.max(si, ti); k++) if (/^(in|im|für|fuer|vom|von|zu|zum|zur)$/i.test(words[k])) drop.add(k);
      const rest = words.filter((_, k) => !drop.has(k));
      words = [compound, ...rest];
    } else if (si >= 0 && si + 1 < words.length && /(test|prüfung|pruefung|vortrag|probe|referat|aufgabe|aufgaben)$/i.test(words[si + 1])) {
      // "Englisch Vokabeltest" -> "Englisch-Vokabeltest"
      const subj = SUBJECTS[words[si].toLowerCase()] || cap(words[si]);
      words.splice(si, 2, `${subj}-${cap(words[si + 1])}`);
    } else {
      words = words.map((x) => SUBJECTS[x.toLowerCase()] || (TYPES[x.toLowerCase()] && /^[A-ZÄÖÜ]/.test(TYPES[x.toLowerCase()]) ? TYPES[x.toLowerCase()] : x));
    }
    return cap(words.join(' ').replace(/\s+/g, ' ').trim());
  }

  // Satz -> Termin-Felder
  function parseEvent(text, now = new Date()) {
    let t = ' ' + text + ' ';
    const nts = extractNotes(t); t = nts.text;
    const rep = DP.extractRepeat(t, now); t = rep.text;
    const rem = DP.extractReminder(t); t = rem.text;
    const rng = DP.extractDateRange(t, now);
    let dat;
    if (rng) { dat = { date: rng.date, found: true }; t = rng.text; }
    else { dat = DP.extractDate(t, now); t = dat.text; }
    const tim = DP.extractTime(t, now); t = tim.text;
    if (tim.relDate && !dat.found) dat = { date: tim.relDate, found: true };
    const dur = DP.extractDuration(t); t = dur.text;
    const loc = extractLocation(t); t = loc.text;
    let end = tim.end;
    if (!end && tim.start && dur.minutes) end = S.fromMin(Math.min(S.toMin(tim.start) + dur.minutes, 23 * 60 + 59));
    let repeat = rep.repeat;
    if (!repeat && dat.weekly) repeat = 'weekly';
    let reminder = null;
    if (rem.reminder === 'default') reminder = /erinner/i.test(text) ? 0 : (tim.start ? 30 : 0);
    else if (rem.reminder === 'vorabend') {
      // Vorabend 18:00: Minuten bis zum Beginn (ganztägig: 07:00)
      reminder = (S.toMin(tim.start || '07:00') + 24 * 60) - 18 * 60;
    } else if (rem.reminder != null) reminder = rem.reminder;
    const title = cleanTitle(t);
    return {
      ev: {
        title, date: dat.date, endDate: rng ? rng.endDate : null, start: tim.start, end,
        category: detectCategory(text), location: loc.location, notes: nts.notes,
        repeat, interval: rep.interval, repeatUntil: rep.until, reminder,
      },
      hasDate: dat.found,
      hasTime: !!tim.start,
      found: {
        date: dat.found, time: !!tim.start, location: !!loc.location, notes: !!nts.notes,
        reminder: reminder != null, repeat: !!repeat, duration: !!dur.minutes,
      },
    };
  }

  // ---------- Suche ----------
  const STOP = new Set(('loesch loesche loeschen entfern entferne entfernen streich streiche den die das dem der des termin termine '
    + 'bitte mir mein meine meinen meinem von vom am um ich habe hab ein eine einen einer auf nach zu zum zur verschieb verschiebe verschieben '
    + 'verleg verlege alle alles mal kannst du ist sind wann wie lange noch bis erledigt abhaken hake als markier markiere mit und in im '
    + 'absagen sag ab faellt aus naechste naechsten naechster eintrag kalender weg wieder tage tag zeig zeige finde such suche gemacht fertig '
    + 'gibt es es viele dauert diese dieser wir uns was welche welcher hab hast wo bin frei zeit diesen dann doch nicht kein keine').split(' '));

  function tokens(text) {
    return norm(text).split(' ').filter((x) => x.length >= 2 && !STOP.has(x) && !/^\d+$/.test(x));
  }

  function matchOcc(occ, toks, catHint) {
    if (!toks.length) return catHint ? (occ.category === catHint ? 1 : 0) : 1;
    const hay = norm(occ.title + ' ' + occ.location + ' ' + S.CATEGORIES[occ.category].label);
    const compact = hay.replace(/ /g, '');
    let score = 0;
    for (const tk of toks) {
      if (compact.includes(tk) || (tk.length > 4 && tk.includes(compact))) score += 2;
      else if (catHint && occ.category === catHint && w(CAT_WORDS[catHint]).test(tk)) score += 1;
    }
    return score;
  }

  function find(text, from, to) {
    const toks = tokens(text);
    const catHint = categoryHint(text);
    const occs = S.occurrences(from, to);
    let best = 0; const scored = [];
    for (const o of occs) {
      const sc = matchOcc(o, toks, catHint);
      if (sc > 0) { scored.push([sc, o]); best = Math.max(best, sc); }
    }
    return scored.filter(([sc]) => sc === best).map(([, o]) => o);
  }

  function categoryHint(text) {
    if (w('prüfung\\p{L}*|pruefung\\p{L}*|tests?|klausur\\p{L}*|probe').test(text)) return 'pruefung';
    if (w('hausaufgabe\\p{L}*|hausis?|aufgaben').test(text)) return 'hausaufgabe';
    if (w('training\\p{L}*|sport').test(text)) return 'sport';
    if (w('arzttermin\\p{L}*|arzt').test(text)) return 'termin';
    return null;
  }

  // ---------- Hilfen ----------
  const todayStr = () => S.ymd(new Date());
  const inDays = (n) => S.ymd(S.addDays(new Date(), n));
  const when = (o) => `${((DP.relLabel(o.occDate || o.date) || '').toLowerCase() || 'am ' + DP.formatDate(o.occDate || o.date))}${o.start ? ' um ' + o.start : ''}`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  // Bot-Antworten sind Klartext; app.js (renderText) escaped jede Nachricht vor dem Anzeigen.
  const esc = (s) => String(s);

  function conflicts(ev) {
    if (!ev.start) return [];
    const s = S.toMin(ev.start), e = ev.end ? S.toMin(ev.end) : s + 60;
    return S.occurrences(ev.date, ev.date).filter((o) => {
      if (o.id === ev.id || !o.start) return false;
      const os = S.toMin(o.start), oe = o.end ? S.toMin(o.end) : os + 60;
      return os < e && s < oe;
    });
  }

  function freeSlots(date, minMin = 30, dayStart = 7 * 60, dayEnd = 22 * 60) {
    let from = dayStart;
    if (date === todayStr()) {
      const n = new Date(); from = Math.max(from, Math.ceil((n.getHours() * 60 + n.getMinutes()) / 15) * 15);
    }
    const busy = S.occurrences(date, date).filter((o) => o.start).map((o) => {
      const s = S.toMin(o.start); return [s, o.end ? S.toMin(o.end) : s + 60];
    }).sort((a, b) => a[0] - b[0]);
    const slots = []; let cur = from;
    for (const [s, e] of busy) {
      if (s - cur >= minMin) slots.push([cur, s]);
      cur = Math.max(cur, e);
    }
    if (dayEnd - cur >= minMin) slots.push([cur, dayEnd]);
    return slots;
  }

  const HELP = {
    text: 'Ich bin dein Kalender-Assistent. Sag mir einfach, was ansteht – zum Beispiel:\n'
      + '• **„Mathe-Prüfung am Freitag um 10 Uhr im Zimmer 204“**\n'
      + '• **„Jeden Dienstag von 18 bis 19:30 Unihockey-Training“**\n'
      + '• **„Erinnere mich morgen um 7 an die Turnsachen“**\n'
      + '• **„Was habe ich diese Woche?“** · **„Welche Prüfungen kommen?“**\n'
      + '• **„Verschiebe Zahnarzt auf Donnerstag 15 Uhr“** · **„Lösche das Training morgen“**\n'
      + '• **„Wann habe ich morgen Zeit?“** · **„Wie lange noch bis zu den Ferien?“**\n'
      + '• **„Klassenlager vom 19. bis 23. Oktober“** · **„Montag und Mittwoch 17 Uhr Klavier“**\n'
      + '• **„Bio-Test am 24.10. über Zellen, S. 40–52, erinnere mich am Vorabend“**\n'
      + '• Danach nachbessern: **„nein, um 10 Uhr“** · **„im Zimmer 12“** · **„heisst Mathe-Probe“**\n'
      + '• **„Erstelle einen Lernplan für die Bio-Prüfung“** · **„Französisch-Hausaufgabe erledigt“**\n'
      + '• **„Rückgängig“** macht die letzte Änderung ungeschehen.',
    chips: ['Was habe ich heute?', 'Diese Woche', 'Welche Prüfungen kommen?', 'Wann habe ich morgen Zeit?'],
  };

  // ---------- Intents ----------
  function addEvents(text) {
    const now = new Date();

    // Mehrere Wochentage: "jeden Montag und Mittwoch Training", "Di, Do 18 Uhr Unihockey"
    const WD = DP.WD_FULL;
    const listRe = new RegExp(`${L}(jeden\\s+|immer\\s+|am\\s+)?((?:${WD})s?(?:\\s*(?:,|und|&|\\+)\\s*(?:${WD})s?)+)${R}`, 'iu');
    const lm = text.match(listRe);
    if (lm) {
      const days = lm[2].toLowerCase().match(new RegExp(WD, 'giu'));
      const weekly = /jeden|immer/i.test(lm[1] || '') || /s(?=\s*(?:,|und|&|\+|$))/i.test(lm[2]);
      const rest = text.replace(lm[0], ' ');
      const base = parseEvent(rest, now);
      const made = [];
      const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      days.forEach((d, i) => {
        const wd = DP.WEEKDAYS[d];
        let delta = (wd - t0.getDay() + 7) % 7;
        if (delta === 0 && !weekly) delta = 7;
        const ev = { ...base.ev, date: S.ymd(S.addDays(t0, delta)), endDate: null };
        if (weekly && !ev.repeat) ev.repeat = 'weekly';
        if (!ev.title) ev.title = defaultTitle(ev);
        made.push(finalizeAdd(ev, i > 0));
      });
      remember(made);
      return {
        text: `Alles klar – ${plural(made.length, 'Termin', 'Termine')}${weekly ? ', jede Woche' : ''}:\n` + made.map((e) => `• ${summary(e)}`).join('\n'),
        cards: made.map((e) => ({ ...e, occDate: e.date })), chips: ['Rückgängig'],
      };
    }

    // Mehrere Termine in einem Satz: "Montag Mathe-Test und Mittwoch Bio-Test"
    const parts = text.split(/\s+und\s+(?=\S)|;|\n|,\s+(?=(?:am\s+|nächsten\s+)?(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen|\d{1,2}\.))/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1 && parts.every((p) => DP.extractDate(p, now).found || DP.extractDateRange(p, now))) {
      const made = parts.map((p, i) => {
        const ev = parseEvent(p, now).ev;
        if (!ev.title) ev.title = defaultTitle(ev);
        return finalizeAdd(ev, i > 0);
      });
      remember(made);
      return {
        text: `Alles klar, ${plural(made.length, 'Termin', 'Termine')} eingetragen:\n` + made.map((e) => `• ${summary(e)}`).join('\n'),
        cards: made.map((e) => ({ ...e, occDate: e.date })), chips: ['Rückgängig'],
      };
    }

    const p = parseEvent(text, now);
    if (!p.hasDate) {
      if (p.hasTime) p.ev.date = (p.ev.start > S.fromMin(now.getHours() * 60 + now.getMinutes())) ? todayStr() : inDays(1);
      else {
        if (!p.ev.title) p.ev.title = defaultTitle(p.ev);
        Bot.pending = { type: 'date', ev: p.ev };
        return { text: `Für wann soll ich **${esc(p.ev.title)}** eintragen?`, chips: ['Heute', 'Morgen', 'Übermorgen', 'Abbrechen'] };
      }
    }
    if (!p.ev.title) {
      Bot.pending = { type: 'title', ev: p.ev };
      return { text: `Gern! Wie soll der Termin ${when({ ...p.ev, occDate: p.ev.date })} heissen?`, chips: ['Abbrechen'] };
    }
    const e = finalizeAdd(p.ev);
    remember([e]);
    return confirmAdd(e);
  }

  function defaultTitle(ev) {
    return ev.category !== 'sonstiges' ? S.CATEGORIES[ev.category].label : 'Termin';
  }

  function finalizeAdd(ev, silent = false) {
    if (!ev.title) ev.title = 'Termin';
    if (ev.reminder === 'default') ev.reminder = 0;
    return S.add(ev, { silent });
  }

  // Zuletzt eingetragene Termine merken, damit "um 10 Uhr" oder "nein, Freitag" sie korrigieren kann
  function remember(list) { Bot.last = { ids: list.map((e) => e.id), at: Date.now() }; }

  const REPEAT_NAMES = (e) => ({ daily: 'täglich', weekly: e.interval > 1 ? `alle ${e.interval} Wochen` : 'jede Woche', monthly: 'jeden Monat', yearly: 'jedes Jahr' }[e.repeat]);

  // Kurze Zusammenfassung aller erkannten Angaben
  function summary(e) {
    const bits = [`**${esc(e.title)}**`];
    if (e.endDate) bits.push(`${DP.formatDate(e.date)} – ${DP.formatDate(e.endDate)}`);
    else bits.push(DP.relLabel(e.date) ? `${DP.relLabel(e.date)} (${DP.formatDate(e.date)})` : DP.formatDate(e.date));
    if (e.start) bits.push(e.end ? `${e.start}–${e.end}` : e.start);
    if (e.location) bits.push(`📍 ${esc(e.location)}`);
    return bits.join(' · ');
  }

  function confirmAdd(e, verb = 'Eingetragen') {
    const lines = [`${verb}: ${summary(e)}`];
    if (e.repeat) lines.push(`🔁 Wiederholt sich ${REPEAT_NAMES(e)}${e.repeatUntil ? ' bis ' + DP.formatDate(e.repeatUntil) : ''}`);
    if (e.reminder != null) {
      const [h, mi] = (e.start || '07:00').split(':').map(Number);
      const at = new Date(S.parseYmd(e.date).getTime() + (h * 60 + mi - e.reminder) * 60000);
      const atTxt = `${(DP.relLabel(S.ymd(at)) || DP.formatDate(S.ymd(at))).replace(/^(Heute|Morgen|Übermorgen)$/, (x) => x.toLowerCase())} um ${S.pad(at.getHours())}:${S.pad(at.getMinutes())}`;
      lines.push(`🔔 Erinnerung ${e.reminder === 0 ? (e.start ? 'pünktlich' : 'am Morgen um 07:00') : atTxt}`);
    }
    if (e.notes) lines.push(`📝 ${esc(e.notes).replace(/\n/g, ' · ')}`);
    lines.push(`🏷️ ${S.CATEGORIES[e.category].label}`);
    const c = conflicts(e);
    if (c.length) lines.push(`⚠️ Überschneidet sich mit **${esc(c[0].title)}** (${DP.formatTime(c[0])}).`);
    const chips = ['Rückgängig'];
    if (e.category === 'pruefung' && e.date > todayStr()) chips.unshift(`Lernplan für ${e.title}`);
    if (!e.start && !e.endDate) chips.push('Um 14 Uhr');
    if (e.reminder == null) chips.push('Erinnere mich 1 Tag vorher');
    return { text: lines.join('\n'), cards: [{ ...e, occDate: e.date }], chips };
  }

  // Nachtrag/Korrektur zum zuletzt eingetragenen Termin
  function refineLast(text, force) {
    if (!Bot.last || Date.now() - Bot.last.at > 15 * 60000) return null;
    const ids = Bot.last.ids.filter((id) => S.get(id));
    if (!ids.length) return null;
    const correction = /^(nein|doch|lieber|eigentlich|sorry|korrektur|oh|ups|achso|ach so|stimmt nicht|falsch|ändere?|aendere?|und|noch|ausserdem|zusätzlich|plus)\b[\s,!.:]*/i;
    const stripped = text.replace(correction, '').replace(/^(nicht\s+\S+\s*,?\s*sondern|sondern)\s+/i, '').trim();
    const isCorrection = correction.test(text) || force || /^(heisst|heißt|nenn|titel)/i.test(stripped);
    const p = parseEvent(stripped);
    // Titel-Rest, der kein echter Inhalt ist
    const titleLeft = p.ev.title && !/^(es|das|der|die|den|termin|ist|wäre|waere|lieber|bitte|erinnerung|kategorie)$/i.test(p.ev.title);
    const catMatch = stripped.match(w('(?:kategorie\\s*:?\\s*|als\\s+)(schule|prüfung|pruefung|hausaufgabe|sport|freizeit|termin|sonstiges)'));
    if (titleLeft && !isCorrection && !catMatch) return null;
    const patch = {};
    if (p.found.date) { patch.date = p.ev.date; if (p.ev.endDate) patch.endDate = p.ev.endDate; }
    if (p.found.time) { patch.start = p.ev.start; patch.end = p.ev.end; }
    else if (p.found.duration && p.ev.end) patch.end = p.ev.end;
    if (p.found.location) patch.location = p.ev.location;
    if (p.found.reminder) patch.reminder = p.ev.reminder;
    if (p.found.repeat) { patch.repeat = p.ev.repeat; patch.interval = p.ev.interval; if (p.ev.repeatUntil) patch.repeatUntil = p.ev.repeatUntil; }
    if (catMatch) {
      const k = catMatch[1].toLowerCase().replace('ü', 'ue');
      patch.category = { schule: 'schule', pruefung: 'pruefung', hausaufgabe: 'hausaufgabe', sport: 'sport', freizeit: 'freizeit', termin: 'termin', sonstiges: 'sonstiges' }[k];
    }
    if (/^(ganztägig|ganztaegig|den ganzen tag|ohne uhrzeit)$/i.test(stripped)) { patch.start = null; patch.end = null; }
    if (/^(keine erinnerung|ohne erinnerung)$/i.test(stripped)) patch.reminder = null;
    if (/(heisst|heißt|nenn\w*|titel)\s*:?\s*/i.test(stripped)) {
      const nm = stripped.replace(/^.*?(heisst|heißt|nenn\w*(\s+es|\s+ihn)?|titel)\s*:?\s*/i, '').trim();
      if (nm) patch.title = cap(nm.replace(/[."']+$/g, ''));
    }
    const ev0 = S.get(ids[0]);
    if (p.found.notes) patch.notes = [ev0.notes, p.ev.notes].filter(Boolean).join('\n');
    if (!Object.keys(patch).length) return null;
    let last;
    ids.forEach((id) => { last = S.update(id, patch); });
    Bot.last.at = Date.now();
    return confirmAdd(last, 'Aktualisiert');
  }

  function listEvents(text) {
    const range = DP.parseRange(text) || { from: todayStr(), to: inDays(6), label: 'in den nächsten 7 Tagen' };
    let cat = categoryHint(text);
    let occs = S.occurrences(range.from, range.to);
    if (cat) occs = occs.filter((o) => o.category === cat);
    if (cat === 'hausaufgabe' && w('offen|noch').test(text)) occs = occs.filter((o) => !o.done);
    // Prüfungen/Hausaufgaben ohne Zeitraum: weiter in die Zukunft schauen
    if (cat && !DP.parseRange(text)) {
      occs = S.occurrences(todayStr(), inDays(cat === 'pruefung' ? 60 : 21)).filter((o) => o.category === cat);
      range.label = cat === 'pruefung' ? 'in den nächsten 2 Monaten' : 'in den nächsten 3 Wochen';
    }
    const what = cat ? S.CATEGORIES[cat].label + (cat === 'pruefung' ? 'en' : cat === 'hausaufgabe' ? 'n' : '') : 'Termine';
    if (!occs.length) return { text: `Du hast ${range.label} keine ${what}. 🎉`, chips: ['Was habe ich nächste Woche?'] };
    const shown = occs.slice(0, 12);
    const one = cat === 'pruefung' || cat === 'hausaufgabe' ? S.CATEGORIES[cat].label : 'Termin';
    let msg = `Du hast ${range.label} ${occs.length} ${occs.length === 1 ? one : what}:`;
    if (occs.length > shown.length) msg += ` (die ersten ${shown.length})`;
    return { text: msg, cards: shown };
  }

  function deleteEvents(text) {
    const now = new Date();
    const dat = DP.extractDate(text, now);
    const range = DP.parseRange(text);
    const from = range ? range.from : S.ymd(S.addDays(now, -30));
    const to = range ? range.to : inDays(365);
    const rest = dat.found ? dat.text : text;
    const toks = tokens(rest);
    const all = w('alle|alles|sämtliche').test(text);

    if (!toks.length && !categoryHint(text)) {
      if (!range && all) {
        return {
          text: `Willst du wirklich **alle ${S.all.length} Termine** löschen?`,
          buttons: [{ label: 'Ja, alles löschen', danger: true, run: () => { S.clear(); return { text: 'Alle Termine wurden gelöscht.', chips: ['Rückgängig'] }; } }],
        };
      }
      if (range) {
        const occs = S.occurrences(range.from, range.to);
        if (!occs.length) return { text: `Du hast ${range.label} gar keine Termine.` };
        return {
          text: all ? `Soll ich alle ${plural(occs.length, 'Termin', 'Termine')} ${range.label} löschen?` : `Welchen Termin ${range.label} soll ich löschen?`,
          cards: occs, cardMode: 'delete',
          buttons: [{ label: `Alle ${occs.length} löschen`, danger: true, run: () => { occs.forEach((o) => S.removeOccurrence(o.id, o.occDate)); return { text: `${plural(occs.length, 'Termin', 'Termine')} gelöscht.`, chips: ['Rückgängig'] }; } }],
        };
      }
      return { text: 'Welchen Termin soll ich löschen? Sag mir z.B. den Namen oder das Datum.' };
    }

    let hits = find(rest, from, to);
    if (!range) {
      // Gleicher Termin mehrfach (Serie): nur einmal pro id
      const seen = new Set(); hits = hits.filter((o) => (seen.has(o.id) ? false : seen.add(o.id)));
      const upcoming = hits.filter((o) => o.occDate >= todayStr());
      if (upcoming.length) hits = upcoming;
    }
    if (!hits.length) return { text: 'Dazu habe ich keinen Termin gefunden. 🤔' };
    if (hits.length === 1 || all) {
      hits.forEach((o) => (range && o.repeat ? S.removeOccurrence(o.id, o.occDate) : S.remove(o.id)));
      const o = hits[0];
      const series = o.repeat && !range ? ' (ganze Serie)' : '';
      return {
        text: hits.length === 1 ? `Gelöscht: **${esc(o.title)}** ${when(o)}${series}.` : `${plural(hits.length, 'Termin', 'Termine')} gelöscht.`,
        chips: ['Rückgängig'],
      };
    }
    return { text: 'Ich habe mehrere passende Termine gefunden. Welchen meinst du?', cards: hits.slice(0, 8), cardMode: 'delete' };
  }

  function moveEvent(text) {
    const now = new Date();
    // relative Verschiebung: "um eine Stunde nach hinten"
    const shift = text.match(w('(?:um\\s+)?(\\d+|eine|einen|zwei|drei|eine halbe)\\s*(stunden?|std|minuten|min|tage?n?)\\s+(später|spaeter|nach hinten|früher|frueher|nach vorne|vor)'));
    const m = text.match(/^(.*?)\s+(?:auf|nach|zum|zur|zu|in|am|um)\s+(?!.*\s(?:auf|nach)\s)(.+)$/i);
    let left = text, right = '';
    if (shift) left = text.replace(shift[0], ' ');
    else if (m) { left = m[1]; right = m[2]; }
    const ld = DP.extractDate(left, now);
    const range = ld.found ? { from: ld.date, to: ld.date } : { from: todayStr(), to: inDays(365) };
    let hits = find(ld.found ? ld.text : left, range.from, range.to);
    const seen = new Set(); hits = hits.filter((o) => (seen.has(o.id) ? false : seen.add(o.id)));
    if (!hits.length) return { text: 'Welchen Termin soll ich verschieben? Ich habe nichts Passendes gefunden.' };
    if (hits.length > 1) return { text: 'Welchen Termin meinst du genau?', cards: hits.slice(0, 6) };
    const o = hits[0];
    const patch = {};
    if (shift) {
      const n = /halbe/.test(shift[1]) ? 0.5 : Math.round(parseFloat(shift[1]) || 1) || 1;
      const unit = shift[2].toLowerCase();
      const sign = /später|spaeter|hinten/i.test(shift[3]) ? 1 : -1;
      if (unit.startsWith('t')) patch.date = S.ymd(S.addDays(S.parseYmd(o.date), sign * n));
      else {
        if (!o.start) return { text: `**${esc(o.title)}** hat keine Uhrzeit – sag mir lieber die neue Zeit.` };
        const d = sign * Math.round(unit.startsWith('st') ? n * 60 : n);
        patch.start = S.fromMin(S.toMin(o.start) + d);
        if (o.end) patch.end = S.fromMin(S.toMin(o.end) + d);
      }
    } else {
      const rd = DP.extractDate(right, now);
      const rt = DP.extractTime(rd.text || right);
      if (rd.found) patch.date = rd.date;
      if (rt.start) {
        patch.start = rt.start;
        if (rt.end) patch.end = rt.end;
        else if (o.start && o.end) patch.end = S.fromMin(S.toMin(rt.start) + S.toMin(o.end) - S.toMin(o.start));
      }
      if (!rd.found && !rt.start) return { text: `Wohin soll ich **${esc(o.title)}** verschieben? Sag mir z.B. „auf Donnerstag um 15 Uhr“.` };
    }
    const u = S.update(o.id, patch);
    const c = conflicts(u);
    let msg = `Verschoben: **${esc(u.title)}** ist jetzt ${when({ ...u, occDate: u.date })}.`;
    if (o.repeat) msg += ' (Die ganze Serie wurde verschoben.)';
    if (c.length) msg += `\n⚠️ Überschneidet sich mit **${esc(c[0].title)}**.`;
    return { text: msg, cards: [{ ...u, occDate: u.date }], chips: ['Rückgängig'] };
  }

  function markDone(text) {
    const hits = find(text, S.ymd(S.addDays(new Date(), -14)), inDays(60)).filter((o) => !o.repeat && !o.done);
    if (!hits.length) return { text: 'Ich habe keine offene Aufgabe dazu gefunden.' };
    if (hits.length > 1) return { text: 'Welche Aufgabe meinst du?', cards: hits.slice(0, 6) };
    S.update(hits[0].id, { done: true });
    const open = S.occurrences(todayStr(), inDays(21)).filter((o) => o.category === 'hausaufgabe' && !o.done).length;
    return { text: `Super, **${esc(hits[0].title)}** ist erledigt! ✅${open ? ` Noch ${open} offen.` : ' Keine offenen Hausaufgaben mehr. 🎉'}`, chips: ['Rückgängig'] };
  }

  function freeTime(text) {
    const now = new Date();
    let range = DP.parseRange(text);
    if (!range) range = now.getHours() >= 20 ? { from: inDays(1), to: inDays(1), label: 'morgen' } : { from: todayStr(), to: todayStr(), label: 'heute' };
    const dur = DP.extractDuration(text).minutes || 30;
    let [ds, de] = [7 * 60, 22 * 60];
    if (w('nachmittag\\p{L}*').test(text)) [ds, de] = [12 * 60, 18 * 60];
    else if (w('abend\\p{L}*').test(text)) [ds, de] = [17 * 60, 22 * 60];
    else if (w('morgen[s]?\\s+früh|vormittag\\p{L}*').test(text)) [ds, de] = [7 * 60, 12 * 60];
    const lines = [];
    let d = S.parseYmd(range.from);
    for (let i = 0; i < 14 && S.ymd(d) <= range.to; i++, d = S.addDays(d, 1)) {
      const day = S.ymd(d);
      const slots = freeSlots(day, dur, ds, de);
      const label = DP.relLabel(day) || DP.formatDate(day);
      lines.push(`**${label}:** ${slots.length ? slots.map(([a, b]) => `${S.fromMin(a)}–${S.fromMin(b)}`).join(', ') : 'leider nichts frei'}`);
    }
    return { text: `Hier hast du ${range.label} Zeit${dur > 30 ? ` (mind. ${DP.formatMinutes(dur)})` : ''}:\n` + lines.join('\n') };
  }

  function countdown(text) {
    const cat = categoryHint(text);
    let hits = find(text, todayStr(), inDays(400));
    if (!tokens(text).length && !cat) return { text: 'Bis zu welchem Termin? Sag z.B. „Wie lange noch bis zur Mathe-Prüfung?“' };
    if (!hits.length) return { text: 'Dazu habe ich keinen kommenden Termin gefunden.' };
    const o = hits[0];
    const days = S.dayDiff(todayStr(), o.occDate);
    const when2 = days === 0 ? 'ist **heute**' : days === 1 ? 'ist **morgen**' : `ist in **${days} Tagen**`;
    let extra = '';
    if (days >= 14) extra = ` (das sind ${Math.floor(days / 7)} Wochen${days % 7 ? ` und ${plural(days % 7, 'Tag', 'Tage')}` : ''})`;
    return { text: `**${esc(o.title)}** ${when2}${extra} – ${DP.formatDate(o.occDate, true)}${o.start ? ' um ' + o.start : ''}.`, cards: [o] };
  }

  function studyPlan(text) {
    const cleaned = text.replace(w('lernplan|lernzeiten|lernzeit|lernsessions?|lernen|erstell\\p{L}*|mach\\p{L}*|plan\\p{L}*|für|fuer'), ' ');
    let exams = S.occurrences(inDays(1), inDays(90)).filter((o) => o.category === 'pruefung');
    const toks = tokens(cleaned).filter((t) => !/^(pruefung|test|probe)$/.test(t));
    if (toks.length) exams = exams.filter((o) => matchOcc(o, toks, null) > 0);
    if (!exams.length) return { text: 'Ich finde keine passende Prüfung. Trag sie zuerst ein, z.B. „Bio-Prüfung am 24.10.“' };
    const ex = exams[0];
    const made = [];
    for (const k of [3, 2, 1]) {
      const day = S.ymd(S.addDays(S.parseYmd(ex.occDate), -k));
      if (day < todayStr()) continue;
      const slot = freeSlots(day, 60, 16 * 60, 21 * 60)[0];
      const start = slot ? slot[0] : 17 * 60;
      made.push(S.add({ title: `Lernen: ${ex.title}`, date: day, start: S.fromMin(start), end: S.fromMin(start + 60), category: 'hausaufgabe', reminder: 15 }, { silent: made.length > 0 }));
    }
    if (!made.length) return { text: `**${esc(ex.title)}** ist schon morgen – da bleibt nur noch heute Abend zum Lernen. Viel Erfolg! 💪` };
    return { text: `Lernplan für **${esc(ex.title)}** (${DP.formatDate(ex.occDate)}) steht – ${plural(made.length, 'Lerneinheit', 'Lerneinheiten')} à 1 Std.:`, cards: made.map((e) => ({ ...e, occDate: e.date })), chips: ['Rückgängig'] };
  }

  function search(text) {
    const q = text.replace(/^\s*(such|find)\p{L}*\s*(nach\s+)?/iu, '');
    const hits = find(q, S.ymd(S.addDays(new Date(), -90)), inDays(365));
    if (!hits.length) return { text: `Zu „${esc(q)}“ habe ich nichts gefunden.` };
    return { text: `${plural(hits.length, 'Treffer', 'Treffer')} für „${esc(q)}“:`, cards: hits.slice(0, 10) };
  }

  // ---------- Hauptlogik ----------
  const Bot = {
    pending: null,
    parseEvent, detectCategory, freeSlots, conflicts, find,

    handle(raw) {
      const text = raw.trim();
      const t = text.toLowerCase();
      if (!text) return { text: 'Schreib mir einfach, was ich eintragen soll. 🙂' };

      if (this.pending) {
        const p = this.pending; this.pending = null;
        if (/^(abbrechen|stopp?|nein|egal|vergiss es)/i.test(t)) return { text: 'Okay, abgebrochen.' };
        if (p.type === 'date') {
          const pe = parseEvent(text);
          if (pe.hasDate || pe.hasTime) {
            // Alle neu genannten Angaben übernehmen
            const ev = { ...p.ev };
            for (const [k, v] of Object.entries(pe.ev)) if (v != null && v !== '' && k !== 'title' && k !== 'category' && k !== 'interval') ev[k] = v;
            if (!ev.date) ev.date = todayStr();
            if (pe.ev.repeat) ev.interval = pe.ev.interval;
            const e = finalizeAdd(ev); remember([e]);
            return confirmAdd(e);
          }
        }
        if (p.type === 'title') {
          const title = cleanTitle(text) || cap(text);
          const ev = { ...p.ev, title, category: p.ev.category === 'sonstiges' ? detectCategory(text) : p.ev.category };
          const e = finalizeAdd(ev); remember([e]);
          return confirmAdd(e);
        }
      }

      if (w('hilfe|help|was kannst du|wie funktioniert|befehle').test(t) || t === '?') return HELP;
      if (w('rückgängig|rueckgaengig|undo|zurück|mach das rückgängig').test(t)) {
        const label = S.undo();
        return { text: label ? `Rückgängig gemacht (${label}). ↩️` : 'Es gibt nichts zum Rückgängigmachen.' };
      }
      if (/^(hallo|hi|hey|hoi|sali|grüezi|gruezi|guten (morgen|tag|abend)|moin|servus|yo)\b/i.test(t) && t.split(/\s+/).length <= 3) {
        const n = S.occurrences(todayStr(), todayStr()).length;
        return { text: `Hoi! 👋 ${n ? `Du hast heute ${plural(n, 'Termin', 'Termine')}.` : 'Heute ist dein Kalender leer.'} Was soll ich eintragen?`, chips: ['Was habe ich heute?', 'Hilfe'] };
      }
      if (/^(danke|merci|thx|thanks|super|cool|nice|top|perfekt)\b/i.test(t)) return { text: 'Gern geschehen! 😊' };

      if (/^(um 14 uhr|erinnere mich 1 tag vorher)$/i.test(t)) { const r = refineLast(text, true); if (r) return r; }
      const isQuestion = /\?\s*$/.test(t) || /^(was|wann|wie|welche\w*|zeig\w*|liste|übersicht|habe ich|hab ich|bin ich|gibt es|steht|muss ich|wo)\b/i.test(t);

      if (w('lernplan|lernzeiten|lernsessions?').test(t)) return studyPlan(text);
      if (/(lösch|loesch|entfern|streich|absag|stornier|cancel)/i.test(t) || /fällt .*aus|faellt .*aus/i.test(t)) return deleteEvents(text);
      if (/(verschieb|verleg)/i.test(t)) return moveEvent(text);
      if (w('erledigt|abhaken|abgehakt|hake\\s.*\\sab|als fertig|ist fertig|bin fertig mit|hab(?:e)? ich gemacht').test(t)) return markDone(text);
      if (/(wann (habe|hab) ich (\w+ )?zeit|freie? zeit|bin ich .*frei|(habe|hab) ich .*zeit|wann .*frei|zeitfenster|lücken?)/i.test(t)) return freeTime(text);
      if (/(wie lange (noch |dauert es )?(bis|geht es bis)|wie viele tage (noch |sind es )?(bis)|countdown|wann ist|wann (habe|hab) ich (wieder|die|den|das|meine?n?|nächste|naechste)|wann findet|wann kommt)/i.test(t)) return countdown(text);
      if (/^(such|find)\p{L}*\s+/iu.test(t)) return search(text);
      // Nachtrag zum letzten Termin: "um 10 Uhr", "nein, am Freitag", "im Zimmer 12", "und erinnere mich vorher"
      if (!isQuestion && !/^(heute|morgen|übermorgen|diese woche|nächste woche)\s*$/i.test(t)) {
        const r = refineLast(text);
        if (r) return r;
      }
      if (isQuestion || /^(heute|morgen|übermorgen|diese woche|nächste woche|wochenübersicht|übersicht|termine|prüfungen|hausaufgaben)\s*$/i.test(t) || /was (habe|hab|steht|ist|läuft|mache|gibt|kommt)/i.test(t)) {
        if (!/(trag|füg|fueg|erstell|notier|speicher|merk)/i.test(t)) return listEvents(text);
      }
      return addEvents(text);
    },
  };

  window.Bot = Bot;
})();
