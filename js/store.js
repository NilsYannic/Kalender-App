// Datenhaltung: Termine, Wiederholungen, Einstellungen, Rückgängig
(function () {
  const KEY = 'kalender.events.v1';
  const SKEY = 'kalender.settings.v1';

  const CATEGORIES = {
    schule:      { label: 'Schule',      color: 'var(--c-schule)' },
    pruefung:    { label: 'Prüfung',     color: 'var(--c-pruefung)' },
    hausaufgabe: { label: 'Hausaufgabe', color: 'var(--c-hausaufgabe)' },
    sport:       { label: 'Sport',       color: 'var(--c-sport)' },
    freizeit:    { label: 'Freizeit',    color: 'var(--c-freizeit)' },
    termin:      { label: 'Termin',      color: 'var(--c-termin)' },
    sonstiges:   { label: 'Sonstiges',   color: 'var(--c-sonstiges)' },
  };

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const toMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const dayDiff = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function safeGet(k, fallback) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function safeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

  const listeners = new Set();
  let events = safeGet(KEY, []);
  let undoStack = [];

  const settings = Object.assign({
    theme: 'auto',
    aiEnabled: false,
    apiKey: '',
    model: 'claude-opus-5-5',
    notifications: false,
  }, safeGet(SKEY, {}));

  function persist() { safeSet(KEY, events); listeners.forEach((fn) => fn()); }
  function snapshot(label) {
    undoStack.push({ label, data: JSON.stringify(events) });
    if (undoStack.length > 30) undoStack.shift();
  }

  function normalize(ev) {
    return {
      id: ev.id || uid(),
      title: (ev.title || 'Termin').trim(),
      date: ev.date,
      endDate: ev.endDate && ev.endDate > ev.date && !ev.repeat ? ev.endDate : null, // mehrtägig (inklusive)
      start: ev.start || null,
      end: ev.end || null,
      category: CATEGORIES[ev.category] ? ev.category : 'sonstiges',
      location: ev.location || '',
      notes: ev.notes || '',
      repeat: ev.repeat || null,          // daily | weekly | monthly | yearly
      interval: Math.max(1, Number(ev.interval) || 1),
      repeatUntil: ev.repeatUntil || null,
      exdates: ev.exdates || [],
      reminder: ev.reminder == null || ev.reminder === '' ? null : Number(ev.reminder),
      done: !!ev.done,
      created: ev.created || Date.now(),
    };
  }

  // Alle Vorkommen (inkl. Wiederholungen) zwischen from und to (inklusive), sortiert
  function occurrences(from, to) {
    const out = [];
    for (const ev of events) {
      if (!ev.repeat) {
        if (ev.endDate) {
          // mehrtägig: ein Vorkommen pro Tag
          let d = ev.date < from ? from : ev.date;
          const last = ev.endDate < to ? ev.endDate : to;
          for (let i = 0; d <= last && i < 400; i++) {
            out.push({ ...ev, occDate: d, multi: { first: d === ev.date, last: d === ev.endDate } });
            d = ymd(addDays(parseYmd(d), 1));
          }
        } else if (ev.date >= from && ev.date <= to) out.push({ ...ev, occDate: ev.date });
        continue;
      }
      const last = ev.repeatUntil && ev.repeatUntil < to ? ev.repeatUntil : to;
      if (ev.date > last) continue;
      const base = parseYmd(ev.date);
      const iv = ev.interval || 1;
      if (ev.repeat === 'daily' || ev.repeat === 'weekly') {
        const step = (ev.repeat === 'daily' ? 1 : 7) * iv;
        let k = 0;
        const diff = dayDiff(ev.date, from);
        if (diff > 0) k = Math.ceil(diff / step);
        for (let i = 0; i < 1000; i++, k++) {
          const d = ymd(addDays(base, k * step));
          if (d > last) break;
          if (d >= from && !ev.exdates.includes(d)) out.push({ ...ev, occDate: d });
        }
      } else {
        const months = ev.repeat === 'monthly' ? iv : 12 * iv;
        for (let k = 0; k < 600; k++) {
          const d0 = new Date(base.getFullYear(), base.getMonth() + k * months, base.getDate());
          if (d0.getDate() !== base.getDate()) continue; // z.B. 31. existiert nicht
          const d = ymd(d0);
          if (d > last) break;
          if (d >= from && !ev.exdates.includes(d)) out.push({ ...ev, occDate: d });
        }
      }
    }
    return out.sort((a, b) =>
      a.occDate.localeCompare(b.occDate) || (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title));
  }

  const Store = {
    CATEGORIES, settings, ymd, parseYmd, addDays, toMin, fromMin, dayDiff, pad,
    get all() { return events; },
    get(id) { return events.find((e) => e.id === id); },
    add(ev, { silent } = {}) {
      if (!silent) snapshot('Hinzufügen');
      const n = normalize(ev);
      events.push(n); persist(); return n;
    },
    update(id, patch) {
      const i = events.findIndex((e) => e.id === id);
      if (i < 0) return null;
      snapshot('Ändern');
      events[i] = normalize({ ...events[i], ...patch, id });
      persist(); return events[i];
    },
    remove(id) {
      const ev = this.get(id);
      if (!ev) return null;
      snapshot('Löschen');
      events = events.filter((e) => e.id !== id); persist(); return ev;
    },
    // Nur ein Vorkommen einer Serie entfernen
    removeOccurrence(id, date) {
      const ev = this.get(id);
      if (!ev) return null;
      if (!ev.repeat) return this.remove(id);
      snapshot('Löschen');
      ev.exdates = [...(ev.exdates || []), date]; persist(); return ev;
    },
    clear() { snapshot('Alles löschen'); events = []; persist(); },
    replaceAll(list) { snapshot('Import'); events = list.map(normalize); persist(); },
    undo() {
      const s = undoStack.pop();
      if (!s) return null;
      events = JSON.parse(s.data); persist(); return s.label;
    },
    canUndo() { return undoStack.length > 0; },
    occurrences,
    onChange(fn) { listeners.add(fn); },
    saveSettings() { safeSet(SKEY, settings); },
    uid,
  };

  window.Store = Store;
})();
