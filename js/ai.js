// Optionaler KI-Modus: Claude steuert den Kalender über Tools
(function () {
  const S = window.Store;
  const DP = window.DP;

  let sdkPromise = null;
  const loadSdk = () => (sdkPromise ||= import('./vendor/anthropic-sdk.mjs').then((m) => m.default));

  const CATS = Object.keys(S.CATEGORIES);
  const str = (description) => ({ type: 'string', description });

  const TOOLS = [
    {
      name: 'create_event',
      description: 'Trägt einen neuen Termin ein. Für ganztägige Termine start/end weglassen.',
      input_schema: {
        type: 'object',
        properties: {
          title: str('Kurzer Titel, z.B. "Mathe-Prüfung"'),
          date: str('Datum YYYY-MM-DD'),
          end_date: str('Letzter Tag bei mehrtägigen Terminen YYYY-MM-DD, optional'),
          start: str('Startzeit HH:MM (24h), optional'),
          end: str('Endzeit HH:MM, optional'),
          category: { type: 'string', enum: CATS },
          location: str('Ort, optional'),
          notes: str('Alle weiteren Details: Thema, Seiten/Aufgaben, was mitnehmen, mit wem usw. Optional'),
          repeat: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'], description: 'Wiederholung, optional' },
          interval: { type: 'integer', description: 'Wiederholungsintervall, z.B. 2 = alle 2 Wochen' },
          repeat_until: str('Letztes Datum der Serie YYYY-MM-DD, optional'),
          reminder_minutes: { type: 'integer', description: 'Erinnerung X Minuten vor Beginn (ganztägig: vor 07:00), optional' },
        },
        required: ['title', 'date', 'category'],
      },
    },
    {
      name: 'list_events',
      description: 'Listet Termine (inkl. Wiederholungen) in einem Zeitraum. Optional nach Text oder Kategorie filtern. Liefert die id für Änderungen.',
      input_schema: {
        type: 'object',
        properties: {
          from: str('Startdatum YYYY-MM-DD'),
          to: str('Enddatum YYYY-MM-DD (inklusive)'),
          query: str('Suchtext im Titel/Ort, optional'),
          category: { type: 'string', enum: CATS },
        },
        required: ['from', 'to'],
      },
    },
    {
      name: 'update_event',
      description: 'Ändert einen bestehenden Termin (bei Serien die ganze Serie). Nur die zu ändernden Felder angeben. Leerer String entfernt start/end.',
      input_schema: {
        type: 'object',
        properties: {
          id: str('id des Termins'),
          title: { type: 'string' }, date: { type: 'string' }, end_date: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' },
          category: { type: 'string', enum: CATS }, location: { type: 'string' }, notes: { type: 'string' },
          repeat: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] },
          reminder_minutes: { type: 'integer' }, done: { type: 'boolean', description: 'Aufgabe erledigt' },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_event',
      description: 'Löscht einen Termin. Mit occurrence_date wird bei Serien nur dieses eine Vorkommen gelöscht.',
      input_schema: {
        type: 'object',
        properties: { id: { type: 'string' }, occurrence_date: str('YYYY-MM-DD, optional') },
        required: ['id'],
      },
    },
    {
      name: 'find_free_time',
      description: 'Findet freie Zeitfenster pro Tag.',
      input_schema: {
        type: 'object',
        properties: {
          from: str('YYYY-MM-DD'), to: str('YYYY-MM-DD'),
          min_minutes: { type: 'integer', description: 'Mindestlänge, Standard 30' },
          day_start: str('HH:MM, Standard 07:00'), day_end: str('HH:MM, Standard 22:00'),
        },
        required: ['from', 'to'],
      },
    },
    {
      name: 'show_events',
      description: 'Zeigt dem Nutzer Termine als Karten im Chat an. Nutze das nach list_events, wenn du Termine aufzählst.',
      input_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' }, date: { type: 'string' } }, required: ['id', 'date'] },
          },
        },
        required: ['items'],
      },
    },
  ];

  const brief = (o) => ({
    id: o.id, title: o.title, date: o.occDate || o.date, end_date: o.endDate || undefined, start: o.start, end: o.end, category: o.category,
    location: o.location || undefined, repeat: o.repeat || undefined, done: o.done || undefined, notes: o.notes || undefined,
  });

  function runTool(name, input, turn) {
    switch (name) {
      case 'create_event': {
        const e = S.add({
          title: input.title, date: input.date, endDate: input.end_date, start: input.start || null, end: input.end || null,
          category: input.category, location: input.location, notes: input.notes, repeat: input.repeat || null,
          interval: input.interval, repeatUntil: input.repeat_until, reminder: input.reminder_minutes,
        });
        turn.changed = true; turn.cards.push({ ...e, occDate: e.date });
        const c = window.Bot.conflicts(e);
        return { ok: true, event: brief(e), conflicts: c.map(brief) };
      }
      case 'list_events': {
        let occ = S.occurrences(input.from, input.to);
        if (input.category) occ = occ.filter((o) => o.category === input.category);
        if (input.query) {
          const q = input.query.toLowerCase();
          occ = occ.filter((o) => (o.title + ' ' + o.location + ' ' + o.notes).toLowerCase().includes(q));
        }
        return { count: occ.length, events: occ.slice(0, 60).map(brief) };
      }
      case 'update_event': {
        const patch = {};
        for (const k of ['title', 'date', 'start', 'end', 'category', 'location', 'notes', 'done']) if (input[k] !== undefined) patch[k] = input[k] === '' ? null : input[k];
        if (input.end_date !== undefined) patch.endDate = input.end_date || null;
        if (input.repeat) patch.repeat = input.repeat === 'none' ? null : input.repeat;
        if (input.reminder_minutes !== undefined) patch.reminder = input.reminder_minutes;
        const u = S.update(input.id, patch);
        if (!u) return { ok: false, error: 'Termin nicht gefunden' };
        turn.changed = true; turn.cards.push({ ...u, occDate: u.date });
        return { ok: true, event: brief(u), conflicts: window.Bot.conflicts(u).map(brief) };
      }
      case 'delete_event': {
        const r = input.occurrence_date ? S.removeOccurrence(input.id, input.occurrence_date) : S.remove(input.id);
        if (!r) return { ok: false, error: 'Termin nicht gefunden' };
        turn.changed = true;
        return { ok: true };
      }
      case 'find_free_time': {
        const out = [];
        let d = S.parseYmd(input.from);
        for (let i = 0; i < 31 && S.ymd(d) <= input.to; i++, d = S.addDays(d, 1)) {
          const day = S.ymd(d);
          const slots = window.Bot.freeSlots(day, input.min_minutes || 30,
            S.toMin(input.day_start || '07:00'), S.toMin(input.day_end || '22:00'));
          out.push({ date: day, free: slots.map(([a, b]) => `${S.fromMin(a)}-${S.fromMin(b)}`) });
        }
        return out;
      }
      case 'show_events': {
        for (const it of input.items || []) {
          const occ = S.occurrences(it.date, it.date).find((o) => o.id === it.id);
          if (occ) turn.cards.push(occ);
        }
        return { ok: true };
      }
      default:
        return { error: 'Unbekanntes Tool' };
    }
  }

  function systemPrompt() {
    const now = new Date();
    return `Du bist der Assistent einer Kalender-App für eine Schülerin bzw. einen Schüler am Gymnasium in der Schweiz.
Heute ist ${DP.WD_LONG[now.getDay()]}, ${S.ymd(now)}, es ist ${S.pad(now.getHours())}:${S.pad(now.getMinutes())} Uhr. Wochen beginnen am Montag.
Verwalte den Kalender mit den Tools: eintragen, suchen, ändern, verschieben, löschen, freie Zeit finden, Lernpläne vor Prüfungen erstellen (mehrere Lerneinheiten in freien Zeitfenstern vor der Prüfung).
Regeln:
- Antworte kurz, freundlich und locker auf Deutsch (Schweizer Rechtschreibung: "ss" statt "ß").
- Lies jede Nachricht genau und übernimm ALLE Angaben: Titel (kurz und sauber, z.B. "Mathe-Prüfung"), Datum, Uhrzeit, Dauer/Ende, Ort, Wiederholung, Erinnerung, mehrtägige Zeiträume (end_date) und alles Weitere (Thema, Seiten, Mitnehmen, Personen) in notes.
- Mehrere Termine in einer Nachricht = mehrere create_event-Aufrufe.
- Bezieht sich eine Nachricht offensichtlich auf den eben eingetragenen Termin ("nein, um 10", "im Zimmer 12"), ändere diesen mit update_event statt einen neuen anzulegen.
- Handle direkt, ohne unnötige Rückfragen. Frag nur nach, wenn das Datum wirklich unklar ist.
- Vor Ändern oder Löschen zuerst mit list_events die id finden.
- Kategorien: schule, pruefung (Tests, Vorträge), hausaufgabe (auch Lernen), sport, freizeit, termin (Arzt usw.), sonstiges.
- Wenn du Termine aufzählst, rufe show_events auf, statt sie lang im Text zu wiederholen.
- Weise auf Überschneidungen (conflicts) hin.
- Formatierung: nur **fett** und Zeilenumbrüche, keine Tabellen oder Überschriften.`;
  }

  const AI = {
    messages: [],

    reset() { this.messages = []; },

    async handle(text) {
      const Anthropic = await loadSdk();
      const st = S.settings;
      const client = new Anthropic({ apiKey: st.apiKey, dangerouslyAllowBrowser: true });
      // Lange Unterhaltungen neu beginnen, statt alte Nachrichten zu bearbeiten
      if (this.messages.length > 40) this.messages = [];
      this.messages.push({ role: 'user', content: text });

      const turn = { cards: [], changed: false };
      const useFallbacks = /^claude-(opus|sonnet|fable)/.test(st.model);
      let finalText = '';

      for (let i = 0; i < 8; i++) {
        const params = {
          model: st.model,
          max_tokens: 4096,
          system: systemPrompt(),
          tools: TOOLS,
          messages: this.messages,
          output_config: { effort: 'low' },
        };
        let res;
        try {
          res = useFallbacks
            ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
            : await client.messages.create(params);
        } catch (err) {
          this.messages.pop();
          throw err;
        }
        this.messages.push({ role: 'assistant', content: res.content });

        if (res.stop_reason === 'refusal') {
          this.messages = [];
          return { text: 'Dabei kann ich leider nicht helfen. Frag mich gern etwas zu deinem Kalender!' };
        }
        const texts = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        if (texts) finalText = texts;

        const uses = res.content.filter((b) => b.type === 'tool_use');
        if (res.stop_reason !== 'tool_use' || !uses.length) break;

        const results = uses.map((u) => {
          try {
            return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(runTool(u.name, u.input || {}, turn)) };
          } catch (e) {
            return { type: 'tool_result', tool_use_id: u.id, content: String(e.message || e), is_error: true };
          }
        });
        this.messages.push({ role: 'user', content: results });
      }

      // Doppelte Karten entfernen
      const seen = new Set();
      const cards = turn.cards.filter((c) => { const k = c.id + c.occDate; return seen.has(k) ? false : seen.add(k); });
      return { text: finalText || 'Erledigt.', cards, chips: turn.changed ? ['Rückgängig'] : [], ai: true };
    },

    async describeError(err) {
      const Anthropic = await loadSdk().catch(() => null);
      if (Anthropic) {
        if (err instanceof Anthropic.AuthenticationError) return 'Der API-Schlüssel ist ungültig. Prüfe ihn in den Einstellungen.';
        if (err instanceof Anthropic.PermissionDeniedError) return 'Dieser API-Schlüssel hat keinen Zugriff auf das gewählte Modell.';
        if (err instanceof Anthropic.NotFoundError) return 'Das gewählte Modell wurde nicht gefunden.';
        if (err instanceof Anthropic.RateLimitError) return 'Zu viele Anfragen oder kein Guthaben mehr. Versuch es später nochmal.';
        if (err instanceof Anthropic.APIConnectionError) return 'Keine Verbindung zur KI. Bist du online?';
        if (err instanceof Anthropic.APIError) return `KI-Fehler (${err.status || '?'}): ${err.message}`;
      }
      return 'Die KI ist gerade nicht erreichbar.';
    },
  };

  window.AI = AI;
})();
