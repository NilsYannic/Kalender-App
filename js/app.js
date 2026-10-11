// Oberfläche: Kalenderansichten, Chat, Dialoge, Erinnerungen
(function () {
  const S = window.Store;
  const DP = window.DP;
  const $ = (sel, root = document) => root.querySelector(sel);

  // ---------- Icons ----------
  const ICONS = {
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
  const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Escaped zuerst alles, erlaubt danach nur **fett** und Zeilenumbrüche
  const renderText = (s) => escHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

  $('#prevBtn').innerHTML = icon('left');
  $('#nextBtn').innerHTML = icon('right');
  $('#addBtn').innerHTML = icon('plus');
  $('#settingsBtn').innerHTML = icon('settings');
  $('#sendBtn').innerHTML = icon('send');
  $('#micBtn').innerHTML = icon('mic');
  $('#chatClose').innerHTML = icon('x');
  $('#sparkIcon').innerHTML = icon('spark');
  document.querySelectorAll('[data-close]').forEach((b) => { if (b.classList.contains('icon-btn')) b.innerHTML = icon('x'); });

  // ---------- Zustand ----------
  const VKEY = 'kalender.view';
  let view = 'month';
  try { view = localStorage.getItem(VKEY) || 'month'; } catch {}
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  let selected = S.ymd(cursor);
  const today = () => S.ymd(new Date());

  // ---------- Termin-Element ----------
  function evItem(o, { actions = false, onDelete } = {}) {
    const el = document.createElement('div');
    el.className = 'ev' + (o.done ? ' done' : '');
    el.style.setProperty('--cat', S.CATEGORIES[o.category].color);
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    const meta = [];
    meta.push(`<span>${icon('clock')}${escHtml(DP.formatTime(o))}</span>`);
    if (o.location) meta.push(`<span>${icon('pin')}${escHtml(o.location)}</span>`);
    if (o.repeat) meta.push(`<span>${icon('repeat')}</span>`);
    if (o.reminder != null) meta.push(`<span>${icon('bell')}</span>`);
    const showDate = actions;
    const dateLbl = showDate ? `<span>${escHtml(DP.relLabel(o.occDate) || DP.formatDate(o.occDate))}</span>` : '';
    const canCheck = o.category === 'hausaufgabe' && !o.repeat;
    el.innerHTML = `
      ${canCheck ? `<button class="check ${o.done ? 'on' : ''}" aria-label="Erledigt">${o.done ? icon('check') : ''}</button>` : ''}
      <div class="body">
        <div class="ttl">${escHtml(o.title)}</div>
        <div class="meta">${dateLbl}${meta.join('')}</div>
      </div>
      ${actions ? `<div class="ev-actions"><button class="icon-btn edit" aria-label="Bearbeiten">${icon('edit')}</button><button class="icon-btn del" aria-label="Löschen">${icon('trash')}</button></div>` : ''}`;
    el.addEventListener('click', (e) => {
      if (e.target.closest('.check')) { e.stopPropagation(); S.update(o.id, { done: !o.done }); return; }
      if (e.target.closest('.del')) { e.stopPropagation(); onDelete ? onDelete(o) : S.removeOccurrence(o.id, o.occDate); return; }
      openEvent(o.id, o.occDate);
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') openEvent(o.id, o.occDate); });
    return el;
  }

  // ---------- Ansichten ----------
  function render() {
    document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    const v = $('#view'); v.innerHTML = '';
    if (view === 'month') renderMonth(v);
    else if (view === 'week') renderWeek(v);
    else renderList(v);
    renderDayPanel();
  }

  function renderMonth(v) {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    $('#title').textContent = `${DP.MON_LONG[m]} ${y}`;
    const first = new Date(y, m, 1);
    const start = DP.mondayOf(first);
    const weeks = Math.ceil((S.dayDiff(S.ymd(start), S.ymd(new Date(y, m + 1, 0))) + 1) / 7);
    const end = S.addDays(start, weeks * 7 - 1);
    const occ = S.occurrences(S.ymd(start), S.ymd(end));
    const byDay = {};
    occ.forEach((o) => (byDay[o.occDate] ||= []).push(o));

    const wrap = document.createElement('div'); wrap.className = 'month';
    wrap.innerHTML = `<div class="wd-row">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<div>${d}</div>`).join('')}</div>`;
    const grid = document.createElement('div'); grid.className = 'grid';
    for (let i = 0; i < weeks * 7; i++) {
      const d = S.addDays(start, i), key = S.ymd(d);
      const list = byDay[key] || [];
      const cell = document.createElement('button');
      cell.className = 'cell' + (d.getMonth() !== m ? ' other' : '') + (key === today() ? ' today' : '') + (key === selected ? ' selected' : '');
      cell.setAttribute('aria-label', DP.formatDate(key, true) + (list.length ? `, ${list.length} Termine` : ''));
      const pills = list.slice(0, 3).map((o) =>
        `<div class="mini${o.done ? ' done' : ''}" style="--cat:${S.CATEGORIES[o.category].color}">${o.start ? `<span class="t">${o.start}</span>` : ''}<span>${escHtml(o.title)}</span></div>`).join('');
      const more = list.length > 3 ? `<div class="more">+${list.length - 3} weitere</div>` : '';
      const dots = list.slice(0, 4).map((o) => `<i style="--cat:${S.CATEGORIES[o.category].color}"></i>`).join('');
      cell.innerHTML = `<span class="num">${d.getDate()}</span><div class="pills">${pills}${more}</div><div class="dots">${dots}</div>`;
      cell.addEventListener('click', () => {
        selected = key;
        if (d.getMonth() !== m) cursor = new Date(d.getFullYear(), d.getMonth(), 1);
        render();
      });
      cell.addEventListener('dblclick', () => openEvent(null, key));
      grid.appendChild(cell);
    }
    wrap.appendChild(grid); v.appendChild(wrap);
  }

  function renderWeek(v) {
    const mo = DP.mondayOf(cursor), su = S.addDays(mo, 6);
    const sameMonth = mo.getMonth() === su.getMonth();
    $('#title').textContent = sameMonth
      ? `${mo.getDate()}.–${su.getDate()}. ${DP.MON_LONG[su.getMonth()]}`
      : `${mo.getDate()}. ${DP.MON_SHORT[mo.getMonth()]} – ${su.getDate()}. ${DP.MON_SHORT[su.getMonth()]}`;
    const occ = S.occurrences(S.ymd(mo), S.ymd(su));
    const wrap = document.createElement('div'); wrap.className = 'week';
    for (let i = 0; i < 7; i++) {
      const d = S.addDays(mo, i), key = S.ymd(d);
      const col = document.createElement('div');
      col.className = 'wcol' + (key === today() ? ' today' : '');
      col.innerHTML = `<div class="wcol-head"><span>${DP.WD_SHORT[d.getDay()]}</span><b>${d.getDate()}</b></div>`;
      col.querySelector('.wcol-head').addEventListener('click', () => openEvent(null, key));
      const list = occ.filter((o) => o.occDate === key);
      if (!list.length) col.insertAdjacentHTML('beforeend', '<span class="empty-day"></span>');
      for (const o of list) {
        const b = document.createElement('button');
        b.className = 'wev' + (o.done ? ' done' : '');
        b.style.setProperty('--cat', S.CATEGORIES[o.category].color);
        b.innerHTML = `<div class="t">${escHtml(DP.formatTime(o))}</div><div class="n">${escHtml(o.title)}</div>`;
        b.addEventListener('click', () => openEvent(o.id, o.occDate));
        col.appendChild(b);
      }
      wrap.appendChild(col);
    }
    v.appendChild(wrap);
  }

  function renderList(v) {
    const from = S.ymd(cursor), to = S.ymd(S.addDays(cursor, 59));
    $('#title').textContent = `Ab ${DP.formatDate(from)}`;
    const occ = S.occurrences(from, to);
    if (!occ.length) { v.innerHTML = '<div class="empty">In den nächsten 60 Tagen ist nichts eingetragen.<br>Sag dem Assistenten einfach, was ansteht.</div>'; return; }
    const wrap = document.createElement('div'); wrap.className = 'agenda';
    let cur = null, list = null;
    for (const o of occ) {
      if (o.occDate !== cur) {
        cur = o.occDate;
        const day = document.createElement('div'); day.className = 'agenda-day';
        const rel = DP.relLabel(cur);
        day.innerHTML = `<h4>${rel ? `<span class="rel">${rel}</span>` : ''}${escHtml(DP.formatDate(cur, true))}</h4>`;
        list = document.createElement('div'); list.className = 'ev-list';
        day.appendChild(list); wrap.appendChild(day);
      }
      list.appendChild(evItem(o));
    }
    v.appendChild(wrap);
  }

  function renderDayPanel() {
    const p = $('#dayPanel'); p.innerHTML = '';
    if (view !== 'month') return;
    const rel = DP.relLabel(selected);
    const head = document.createElement('div'); head.className = 'day-head';
    head.innerHTML = `<h3>${escHtml(rel || DP.formatDate(selected, true))}${rel ? `<span class="sub">${escHtml(DP.formatDate(selected, true))}</span>` : ''}</h3>
      <button class="add-link">${icon('plus')}Termin</button>`;
    head.querySelector('.add-link').addEventListener('click', () => openEvent(null, selected));
    p.appendChild(head);
    const occ = S.occurrences(selected, selected);
    if (!occ.length) { p.insertAdjacentHTML('beforeend', '<div class="empty">Nichts geplant.</div>'); return; }
    const list = document.createElement('div'); list.className = 'ev-list';
    occ.forEach((o) => list.appendChild(evItem(o)));
    p.appendChild(list);
  }

  function go(dir) {
    if (view === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
    else if (view === 'week') cursor = S.addDays(cursor, dir * 7);
    else cursor = S.addDays(cursor, dir * 30);
    render();
  }
  function goToday() { cursor = new Date(); cursor.setHours(0, 0, 0, 0); selected = today(); render(); }
  function showDate(ymd) {
    selected = ymd;
    const d = S.parseYmd(ymd);
    cursor = view === 'month' ? new Date(d.getFullYear(), d.getMonth(), 1) : d;
    render();
  }

  $('#prevBtn').onclick = () => go(-1);
  $('#nextBtn').onclick = () => go(1);
  $('#todayBtn').onclick = goToday;
  $('#addBtn').onclick = () => openEvent(null, view === 'month' ? selected : today());
  document.querySelectorAll('#viewSeg button').forEach((b) => b.addEventListener('click', () => {
    view = b.dataset.view;
    try { localStorage.setItem(VKEY, view); } catch {}
    if (view === 'month') cursor = new Date(S.parseYmd(selected).getFullYear(), S.parseYmd(selected).getMonth(), 1);
    else if (view === 'week') cursor = S.parseYmd(selected);
    else cursor = S.parseYmd(today());
    render();
  }));

  // Wischen auf dem Handy
  let touchX = null, touchY = null;
  $('#view').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
  $('#view').addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    touchX = null;
  }, { passive: true });

  // ---------- Termin-Dialog ----------
  const dlg = $('#eventDlg'), form = $('#eventForm');
  let editing = null; // { id, occDate }
  let currentCat = 'sonstiges';

  const catPicker = $('#catPicker');
  Object.entries(S.CATEGORIES).forEach(([k, c]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.cat = k; b.textContent = c.label;
    b.style.setProperty('--cat', c.color);
    b.onclick = () => setCat(k);
    catPicker.appendChild(b);
  });
  function setCat(k) {
    currentCat = k;
    catPicker.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.cat === k));
  }
  function syncAllday() {
    const on = form.allday.checked;
    form.querySelector('.times').style.display = on ? 'none' : '';
  }
  form.allday.addEventListener('change', syncAllday);
  form.title.addEventListener('input', () => {
    if (!editing?.id && !editing?.catTouched) setCat(window.Bot.detectCategory(form.title.value));
  });
  catPicker.addEventListener('click', () => { if (editing) editing.catTouched = true; });

  function openEvent(id, date) {
    const ev = id ? S.get(id) : null;
    editing = { id, occDate: date };
    resetFoot();
    $('#eventDlgTitle').textContent = ev ? 'Termin bearbeiten' : 'Neuer Termin';
    form.reset();
    form.title.value = ev?.title || '';
    form.date.value = ev?.date || date || today();
    form.allday.checked = ev ? !ev.start : false;
    form.start.value = ev?.start || (ev ? '' : nextHour());
    form.end.value = ev?.end || '';
    form.location.value = ev?.location || '';
    form.repeat.value = ev?.repeat === 'weekly' && ev.interval === 2 ? 'biweekly' : ev?.repeat || '';
    form.repeatUntil.value = ev?.repeatUntil || '';
    form.reminder.value = ev?.reminder == null ? '' : String(ev.reminder);
    form.notes.value = ev?.notes || '';
    setCat(ev?.category || 'sonstiges');
    syncAllday();
    $('#deleteBtn').style.display = ev ? '' : 'none';
    dlg.showModal();
    if (!ev) setTimeout(() => form.title.focus(), 50);
  }
  function nextHour() { const d = new Date(); return `${S.pad((d.getHours() + 1) % 24)}:00`; }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const allday = form.allday.checked;
    const rep = form.repeat.value;
    const data = {
      title: form.title.value.trim() || 'Termin',
      date: form.date.value,
      start: allday ? null : form.start.value || null,
      end: allday ? null : form.end.value || null,
      category: currentCat,
      location: form.location.value.trim(),
      notes: form.notes.value.trim(),
      repeat: rep === 'biweekly' ? 'weekly' : rep || null,
      interval: rep === 'biweekly' ? 2 : 1,
      repeatUntil: rep ? form.repeatUntil.value || null : null,
      reminder: form.reminder.value === '' ? null : Number(form.reminder.value),
    };
    if (data.start && data.end && data.end <= data.start) data.end = null;
    if (editing.id) { S.update(editing.id, data); toast('Gespeichert'); }
    else { S.add(data); toast('Termin eingetragen'); }
    dlg.close();
    if (data.reminder != null) ensureNotifications();
  });

  const footHtml = form.querySelector('.sheet-foot').innerHTML;
  function resetFoot() {
    form.querySelector('.sheet-foot').innerHTML = footHtml;
    form.querySelectorAll('.sheet-foot [data-close]').forEach((b) => (b.onclick = () => dlg.close()));
    $('#deleteBtn').onclick = onDeleteClick;
  }
  function onDeleteClick() {
    const ev = S.get(editing.id);
    if (!ev) return;
    if (ev.repeat && editing.occDate) {
      confirmChoice(`„${ev.title}“ wiederholt sich.`, [
        { label: 'Nur diesen', run: () => { S.removeOccurrence(ev.id, editing.occDate); dlg.close(); toastUndo('Termin gelöscht'); } },
        { label: 'Ganze Serie', danger: true, run: () => { S.remove(ev.id); dlg.close(); toastUndo('Serie gelöscht'); } },
      ]);
    } else { S.remove(ev.id); dlg.close(); toastUndo('Termin gelöscht'); }
  }

  function confirmChoice(text, options) {
    const foot = form.querySelector('.sheet-foot');
    foot.innerHTML = `<span class="hint grow">${escHtml(text)}</span>`;
    options.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn sm' + (o.danger ? ' danger solid' : '');
      b.textContent = o.label; b.onclick = () => { resetFoot(); o.run(); };
      foot.appendChild(b);
    });
  }
  document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  // ---------- Toast ----------
  let toastTimer;
  function toast(text, action) {
    const t = $('#toast');
    t.innerHTML = escHtml(text) + (action ? ` <button style="color:var(--accent);font-weight:700;margin-left:8px">${escHtml(action.label)}</button>` : '');
    if (action) { t.style.pointerEvents = 'auto'; t.querySelector('button').onclick = () => { action.run(); t.classList.remove('show'); }; }
    else t.style.pointerEvents = 'none';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove('show'); t.style.pointerEvents = 'none'; }, action ? 5000 : 2200);
  }
  const toastUndo = (text) => toast(text, { label: 'Rückgängig', run: () => S.undo() });

  // ---------- Chat ----------
  const msgs = $('#msgs'), input = $('#input'), chat = $('#chat'), backdrop = $('#backdrop');
  const isMobile = () => matchMedia('(max-width: 820px)').matches;

  function openChat() {
    if (!isMobile()) return;
    chat.classList.add('open'); backdrop.classList.add('show');
    msgs.scrollTop = msgs.scrollHeight;
  }
  function closeChat() { chat.classList.remove('open'); backdrop.classList.remove('show'); input.blur(); }
  input.addEventListener('focus', openChat);
  $('#chatClose').onclick = closeChat;
  backdrop.onclick = closeChat;

  function addUser(text) {
    const el = document.createElement('div');
    el.className = 'msg user'; el.textContent = text;
    msgs.appendChild(el); scrollDown();
  }

  function addBot(res) {
    const el = document.createElement('div');
    el.className = 'msg bot' + (res.cards?.length ? ' wide' : '');
    // "Okt.." -> "Okt." (Monatsabkürzung am Satzende)
    el.innerHTML = renderText((res.text || '').replace(/(?<!\.)\.\.(?!\.)/g, '.'));
    if (res.cards?.length) {
      const c = document.createElement('div'); c.className = 'cards';
      res.cards.forEach((o) => {
        const fresh = S.get(o.id);
        const item = fresh ? { ...fresh, occDate: o.occDate || fresh.date } : o;
        const card = evItem(item, {
          actions: true,
          onDelete: (x) => {
            if (!S.get(x.id)) return;
            x.repeat ? S.removeOccurrence(x.id, x.occDate) : S.remove(x.id);
            card.style.opacity = '.4'; card.style.pointerEvents = 'none';
            addBot({ text: `Gelöscht: **${x.title}**${x.repeat ? ' (nur dieses Mal)' : ''}.`, chips: ['Rückgängig'] });
          },
        });
        c.appendChild(card);
      });
      el.appendChild(c);
    }
    if (res.buttons?.length) {
      const b = document.createElement('div'); b.className = 'btns';
      res.buttons.forEach((btn) => {
        const x = document.createElement('button');
        x.className = 'btn sm' + (btn.danger ? ' danger solid' : '');
        x.textContent = btn.label;
        x.onclick = () => { b.remove(); const r = btn.run(); if (r) addBot(r); };
        b.appendChild(x);
      });
      el.appendChild(b);
    }
    msgs.appendChild(el);
    setChips(res.chips || []);
    scrollDown();
    // Kalender zum betroffenen Tag springen lassen
    if (res.cards?.length === 1 && res.cards[0].occDate) showDate(res.cards[0].occDate);
  }

  function setChips(list) {
    const c = $('#chips'); c.innerHTML = '';
    list.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = t; b.type = 'button';
      b.onclick = () => send(t);
      c.appendChild(b);
    });
  }

  function scrollDown() { requestAnimationFrame(() => (msgs.scrollTop = msgs.scrollHeight)); }

  let busy = false;
  async function send(text) {
    text = text.trim();
    if (!text || busy) return;
    openChat();
    addUser(text);
    input.value = ''; updateSend();
    setChips([]);
    const st = S.settings;
    const useAi = st.aiEnabled && st.apiKey && !/^(rückgängig|rueckgaengig|undo)$/i.test(text) && !window.Bot.pending;
    if (!useAi) { addBot(window.Bot.handle(text)); return; }

    busy = true; updateSend();
    const typing = document.createElement('div');
    typing.className = 'msg bot'; typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    msgs.appendChild(typing); scrollDown();
    try {
      const res = await window.AI.handle(text);
      typing.remove(); addBot(res);
    } catch (err) {
      typing.remove();
      console.error(err);
      const why = await window.AI.describeError(err);
      const res = window.Bot.handle(text);
      res.text = `${why}\nIch versuche es mit dem eingebauten Assistenten:\n\n${res.text}`;
      addBot(res);
    } finally { busy = false; updateSend(); }
  }

  function updateSend() { $('#sendBtn').disabled = busy || !input.value.trim(); }
  input.addEventListener('input', updateSend);
  $('#composer').addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });

  function welcome() {
    const n = S.occurrences(today(), today()).length;
    const h = new Date().getHours();
    const hi = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hoi' : 'Guten Abend';
    const first = !S.all.length;
    addBot({
      text: first
        ? `${hi}! 👋 Ich bin dein Kalender-Assistent. Sag mir einfach, was ansteht – z.B. **„Mathe-Prüfung am Freitag um 10 Uhr“**.`
        : `${hi}! 👋 ${n ? `Heute hast du ${n === 1 ? 'einen Termin' : n + ' Termine'}.` : 'Heute ist nichts geplant.'} Was soll ich eintragen?`,
      chips: first ? ['Hilfe', 'Jeden Montag 17 Uhr Training', 'Bio-Test in 2 Wochen'] : ['Was habe ich heute?', 'Diese Woche', 'Welche Prüfungen kommen?', 'Hilfe'],
    });
  }

  // ---------- Spracheingabe ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $('#micBtn');
  if (!SR) mic.style.display = 'none';
  else {
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = (navigator.language || '').startsWith('de') ? navigator.language : 'de-CH';
      rec.interimResults = true;
      rec.continuous = false;
      mic.classList.add('rec');
      let finalText = '';
      rec.onresult = (e) => {
        let t = '';
        for (const r of e.results) t += r[0].transcript;
        input.value = t; updateSend();
        if (e.results[e.results.length - 1].isFinal) finalText = t;
      };
      rec.onerror = (e) => { if (e.error === 'not-allowed') toast('Mikrofon nicht erlaubt'); };
      rec.onend = () => {
        mic.classList.remove('rec'); rec = null;
        if (finalText.trim()) send(finalText);
      };
      try { rec.start(); } catch { mic.classList.remove('rec'); rec = null; }
    });
  }

  // ---------- Erinnerungen ----------
  const FKEY = 'kalender.fired';
  let fired = {};
  try { fired = JSON.parse(localStorage.getItem(FKEY) || '{}'); } catch {}

  async function notify(title, body) {
    toast(`🔔 ${title} – ${body}`);
    if (!S.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: title + body });
      else new Notification(title, { body, icon: 'icons/icon-192.png' });
    } catch { try { new Notification(title, { body }); } catch {} }
  }

  function checkReminders() {
    const now = Date.now();
    const occ = S.occurrences(S.ymd(S.addDays(new Date(), -1)), S.ymd(S.addDays(new Date(), 3)));
    for (const o of occ) {
      if (o.reminder == null) continue;
      const [y, m, d] = o.occDate.split('-').map(Number);
      const [hh, mm] = (o.start || '07:00').split(':').map(Number);
      const startTs = new Date(y, m - 1, d, hh, mm).getTime();
      const at = startTs - o.reminder * 60000;
      const key = `${o.id}@${o.occDate}@${o.reminder}`;
      if (now >= at && now < startTs + 15 * 60000 && !fired[key]) {
        fired[key] = now;
        const rel = (DP.relLabel(o.occDate) || DP.formatDate(o.occDate)).toLowerCase();
        notify(o.title, o.start ? `${rel} um ${o.start}${o.location ? ' · ' + o.location : ''}` : rel);
      }
    }
    // alte Einträge aufräumen
    for (const k in fired) if (now - fired[k] > 7 * 86400000) delete fired[k];
    try { localStorage.setItem(FKEY, JSON.stringify(fired)); } catch {}
  }
  setInterval(checkReminders, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(); render(); } });

  async function ensureNotifications() {
    if (!('Notification' in window) || S.settings.notifications) return;
    if (Notification.permission === 'default') {
      const p = await Notification.requestPermission();
      if (p === 'granted') { S.settings.notifications = true; S.saveSettings(); syncSettingsUi(); }
    } else if (Notification.permission === 'granted') { S.settings.notifications = true; S.saveSettings(); syncSettingsUi(); }
  }

  // ---------- Einstellungen ----------
  const sdlg = $('#settingsDlg');
  function applyTheme() {
    const t = S.settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0b0b0d' : '#f7f7f8'));
  }
  function syncSettingsUi() {
    const st = S.settings;
    document.querySelectorAll('#themeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.themeSet === st.theme));
    $('#notifToggle').checked = st.notifications;
    $('#aiToggle').checked = st.aiEnabled;
    $('#apiKey').value = st.apiKey;
    $('#modelSel').value = st.model;
    $('#aiFields').style.display = st.aiEnabled ? '' : 'none';
    const on = st.aiEnabled && st.apiKey;
    const badge = $('#modeBadge');
    badge.textContent = on ? 'KI' : 'Lokal';
    badge.classList.toggle('ai', !!on);
  }
  $('#settingsBtn').onclick = () => { syncSettingsUi(); sdlg.showModal(); };
  document.querySelectorAll('#themeSeg button').forEach((b) => b.addEventListener('click', () => {
    S.settings.theme = b.dataset.themeSet; S.saveSettings(); applyTheme(); syncSettingsUi();
  }));
  $('#notifToggle').addEventListener('change', async (e) => {
    if (e.target.checked) {
      if (!('Notification' in window)) { toast('Dein Browser unterstützt keine Benachrichtigungen'); e.target.checked = false; return; }
      const p = await Notification.requestPermission();
      S.settings.notifications = p === 'granted';
      if (p !== 'granted') toast('Benachrichtigungen wurden nicht erlaubt');
      else notify('Benachrichtigungen aktiv', 'So sehen deine Erinnerungen aus.');
    } else S.settings.notifications = false;
    S.saveSettings(); syncSettingsUi();
  });
  $('#aiToggle').addEventListener('change', (e) => { S.settings.aiEnabled = e.target.checked; S.saveSettings(); window.AI.reset(); syncSettingsUi(); });
  $('#apiKey').addEventListener('change', (e) => { S.settings.apiKey = e.target.value.trim(); S.saveSettings(); window.AI.reset(); syncSettingsUi(); });
  $('#modelSel').addEventListener('change', (e) => { S.settings.model = e.target.value; S.saveSettings(); window.AI.reset(); });

  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $('#exportJson').onclick = () => {
    download(`kalender-${today()}.json`, JSON.stringify({ app: 'kalender', version: 1, events: S.all }, null, 2), 'application/json');
  };
  $('#importJson').onclick = () => $('#importFile').click();
  $('#importFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : data.events;
      if (!Array.isArray(list)) throw new Error();
      const valid = list.filter((x) => x && typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date));
      S.replaceAll(valid);
      toastUndo(`${valid.length} Termine wiederhergestellt`);
      sdlg.close();
    } catch { toast('Diese Datei konnte nicht gelesen werden'); }
    e.target.value = '';
  });
  $('#exportIcs').onclick = () => download(`kalender-${today()}.ics`, toIcs(), 'text/calendar');
  $('#clearAll').onclick = () => {
    if (!S.all.length) { toast('Es gibt keine Termine'); return; }
    if (confirm(`Wirklich alle ${S.all.length} Termine löschen?`)) { S.clear(); sdlg.close(); toastUndo('Alle Termine gelöscht'); }
  };

  function toIcs() {
    const esc = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const d = (s) => s.replace(/-/g, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kalender-App//DE', 'CALSCALE:GREGORIAN'];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    for (const e of S.all) {
      lines.push('BEGIN:VEVENT', `UID:${e.id}@kalender-app`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(e.title)}`);
      if (e.start) {
        lines.push(`DTSTART:${d(e.date)}T${e.start.replace(':', '')}00`);
        const end = e.end || S.fromMin(Math.min(S.toMin(e.start) + 60, 23 * 60 + 59));
        lines.push(`DTEND:${d(e.date)}T${end.replace(':', '')}00`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${d(e.date)}`, `DTEND;VALUE=DATE:${d(S.ymd(S.addDays(S.parseYmd(e.date), 1)))}`);
      }
      if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
      if (e.notes) lines.push(`DESCRIPTION:${esc(e.notes)}`);
      lines.push(`CATEGORIES:${S.CATEGORIES[e.category].label}`);
      if (e.repeat) {
        let r = `RRULE:FREQ=${e.repeat.toUpperCase()}`;
        if (e.interval > 1) r += `;INTERVAL=${e.interval}`;
        if (e.repeatUntil) r += `;UNTIL=${d(e.repeatUntil)}T235959`;
        lines.push(r);
        if (e.exdates?.length) lines.push(`EXDATE;VALUE=DATE:${e.exdates.map(d).join(',')}`);
      }
      if (e.reminder != null) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${e.reminder}M`, 'END:VALARM');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // ---------- Tastatur ----------
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'n') { e.preventDefault(); $('#addBtn').click(); }
    else if (e.key === 't') goToday();
    else if (e.key === '/') { e.preventDefault(); input.focus(); }
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'm' || e.key === 'w' || e.key === 'l') document.querySelector(`#viewSeg [data-view="${{ m: 'month', w: 'week', l: 'list' }[e.key]}"]`).click();
  });

  // ---------- Start ----------
  S.onChange(render);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  applyTheme();
  syncSettingsUi();
  render();
  updateSend();
  welcome();
  checkReminders();
  // Mitternacht: Ansicht aktualisieren
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); render(); } }, 60000);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
