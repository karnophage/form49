// game.js: rules, state, drawing and input. Words and numbers live in data.js.
(() => {
  "use strict";
  const D = window.F49;
  const $ = (s) => document.querySelector(s);

  const DAY_SECONDS = 180;              // real seconds per working day
  const OPEN = 9 * 60, CLOSE = 17 * 60; // 09:00 to 17:00, in game minutes
  const SAVE_KEY = "form49-save-v1";
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- helpers ----------
  const rand = Math.random;
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const randint = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const chance = (p) => rand() < p;
  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const signed = (n) => (n > 0 ? "+" + n : String(n));
  const courtOf = (cat) => (cat ? D.CATS[cat].court : 3);
  const netOf = (rows) => rows.reduce((a, r) => a + r.v, 0);

  // ---------- state ----------
  const S = {
    phase: "title", day: 1, notes: 0,
    service: { correct: 0, wrong: 0, bribes: 0, sutras: 0, audits: 0, arrears: 0 },
    today: null, clock: OPEN, soulIndex: 0, soul: null, busy: false, stamping: false, closing: false,
    sound: true, pickingCourt: false,
  };
  const dayCfg = () => D.DAYS[S.day - 1];

  // ---------- the rules ----------
  const certValid = (c) => c.shape === D.SEAL.shape && c.ink === D.SEAL.ink && c.code === D.SEAL.code;

  function effectiveRows(s, day) {
    const rows = s.book.deeds.map((d) => ({ ...d, v: day.filialDouble && d.cat === "filial" ? d.v * 2 : d.v }));
    if (day.certs && s.cert && certValid(s.cert)) rows.push({ t: "Temple merit certificate", v: s.cert.value });
    return rows;
  }

  // Positive net merit goes to rebirth; otherwise route by the single worst deed (ties go to the higher court).
  function verdictFromRows(rows) {
    const net = netOf(rows);
    if (net > 0) return { v: "rebirth", net };
    const worst = rows.filter((r) => r.v < 0).sort((a, b) => a.v - b.v || courtOf(b.cat) - courtOf(a.cat))[0];
    return { v: "hell", net, court: courtOf(worst && worst.cat), worst };
  }

  function judge(s, day) {
    if (s.file.name !== s.book.name)
      return { v: "return", why: `The Case File says "${s.file.name}" but the Book says "${s.book.name}".` };
    if (s.file.age !== s.book.lifespan)
      return { v: "return", why: `Died at ${s.file.age}, but the Book allots ${s.book.lifespan} years. Collected early.` };
    const r = verdictFromRows(effectiveRows(s, day));
    if (r.v === "rebirth") r.why = `Net merit was ${signed(r.net)}. Above zero means Rebirth.`;
    else r.why = `Net merit was ${signed(r.net)}. Worst deed: "${r.worst.t}" (${D.CATS[r.worst.cat].label}), so Court ${r.court}.`;
    return r;
  }

  const verdictLabel = (x) => (x.v === "rebirth" ? "Rebirth" : x.v === "hell" ? `Hell, Court ${x.court}` : "Return to sender");
  const sameVerdict = (a, b) => a.v === b.v && (a.v !== "hell" || a.court === b.court);
  const tierFor = (net) => { let t = D.TIERS[0][1]; for (const [min, txt] of D.TIERS) if (net >= min) t = txt; return t; };

  function playerRows() {
    const s = S.service, rows = D.PLAYER_LIFE.map((r) => ({ ...r }));
    if (s.correct) rows.push({ t: `Souls filed correctly ×${s.correct}`, v: s.correct });
    if (s.sutras) rows.push({ t: `Outsourced sutra chanting ×${s.sutras}`, v: s.sutras * D.ECON.sutraMerit });
    if (s.wrong) rows.push({ t: `Clerical errors ×${s.wrong}`, v: -s.wrong, cat: "shirk" });
    if (s.bribes) rows.push({ t: `Bribes accepted ×${s.bribes}`, v: s.bribes * D.ECON.bribeMerit, cat: "fraud" });
    if (s.audits) rows.push({ t: `Caught by the Censorate ×${s.audits}`, v: -2 * s.audits, cat: "fraud" });
    if (s.arrears) rows.push({ t: `Dormitory rent arrears ×${s.arrears}`, v: -s.arrears, cat: "shirk" });
    return rows;
  }

  // ---------- souls ----------
  function deed(d) { return { t: d[0], v: d[1], cat: d[2] }; }

  function randomSoul(day) {
    const sur = pick(D.SURNAMES), giv = pick(D.GIVEN);
    const name = `${sur} ${giv}`;
    const lifespan = randint(19, 96);
    let fileName = name, age = lifespan;
    const roll = rand();
    if (roll < 0.13) fileName = `${sur} ${D.LOOKALIKE[giv]}`;
    else if (roll < 0.25) age = Math.max(12, lifespan - randint(2, 30));

    const wicked = chance(0.5);
    const deeds = shuffle(D.GOOD_DEEDS).slice(0, wicked ? randint(0, 2) : randint(2, 3)).map(deed);
    const nBad = wicked ? randint(2, 3) : randint(0, 2);
    const used = new Set();
    for (let i = 0; i < nBad; i++) {
      const cat = day.filialDouble && i === 0 && chance(0.45) ? "filial" : pick(Object.keys(D.BAD_DEEDS));
      const d = pick(D.BAD_DEEDS[cat]);
      if (used.has(d[0])) continue;
      used.add(d[0]);
      deeds.push({ t: d[0], v: d[1], cat });
    }
    if (!deeds.length) deeds.push(deed(pick(D.GOOD_DEEDS)));

    let cert = null;
    if (day.certs && chance(0.4)) {
      cert = { temple: pick(D.TEMPLES), value: randint(2, 4), ...D.SEAL };
      if (chance(0.5)) { const k = pick(["shape", "ink", "code"]); cert[k] = pick(D.SEAL_FAKES[k]); }
    }

    const s = {
      file: { name: fileName, age, hometown: pick(D.HOMETOWNS), occupation: pick(D.OCCUPATIONS),
        cause: pick(D.CAUSES), collector: chance(0.5) ? "Ox-Head" : "Horse-Face" },
      book: { name, lifespan, deeds: shuffle(deeds) },
      cert, bribe: 0, lines: [["soul", pick(D.GREETINGS)]],
    };
    if (chance(0.25)) s.lines.push(["soul", pick(D.CLAIMS)]);
    const guilty = judge(s, day).v !== "rebirth";
    if ((guilty && chance(0.3)) || chance(0.05)) s.bribe = randint(2, 9);
    return s;
  }

  function buildSpecial(p) {
    return {
      file: { name: p.fileName || p.name, age: p.age, hometown: p.hometown, occupation: p.occupation,
        cause: p.cause, collector: p.collector },
      book: { name: p.name, lifespan: p.lifespan, deeds: p.deeds.map(deed) },
      cert: p.cert ? { ...p.cert } : null, bribe: p.bribe || 0, lines: p.lines.slice(), lookHint: p.look,
    };
  }

  function makeLook(hint = {}) {
    return {
      skin: pick(["#cfe8dc", "#d6e0ea", "#e0dccb", "#c7e0e0"]),
      hair: hint.old ? "#d8d4dc" : pick(["#1f1a22", "#2d2320", "#3b2c24"]),
      style: hint.hair || pick(["bun", "bald", "cap", "long", "topknot"]),
      robe: pick(["#3f6f8f", "#6b4a7a", "#80603a", "#4f7a52", "#7a3b3b", "#556070"]),
      eyes: pick(["dot", "line", "wide"]),
      mouth: pick(["flat", "smile", "frown", "o"]),
      beard: hint.beard ?? chance(0.15),
    };
  }

  function makeSoul(idx) {
    const day = dayCfg();
    const key = day.specials[idx];
    const s = key ? buildSpecial(D.SPECIALS[key]) : randomSoul(day);
    s.caseNo = `49-${S.day}${String(idx + 1).padStart(3, "0")}`;
    s.look = makeLook(s.lookHint);
    if (s.bribe) s.lines.push(["soul", pick(D.BRIBE_LINES)]);
    return s;
  }

  // ---------- rendering: papers ----------
  function sealHTML(c) {
    return `<div class="seal ${c.shape} ${c.ink}" aria-label="${c.shape} ${c.ink} seal reading ${c.code}"><span>${esc(c.code)}</span></div>`;
  }

  function renderFile() {
    const s = S.soul, el = $("#p-file");
    if (!s) { el.innerHTML = `<header class="p-head"><span>Case File</span></header><p class="empty">Window closed. No soul at the counter.</p>`; return; }
    const f = s.file;
    let cert = "";
    if (s.cert) {
      cert = `<div class="cert">
        ${sealHTML(s.cert)}
        <div><div class="cert-t">Certificate of Merit</div>
        <div>${esc(s.cert.temple)} certifies the bearer has earned</div>
        <div class="num">${signed(s.cert.value)} merit</div></div></div>`;
    }
    el.innerHTML = `
      <header class="p-head"><span>Case File</span><span>No. ${s.caseNo}</span></header>
      <dl class="fields">
        <dt>Name</dt><dd class="big">${esc(f.name)}</dd>
        <dt>Age at death</dt><dd class="num">${f.age}</dd>
        <dt>Occupation</dt><dd>${esc(f.occupation)}</dd>
        <dt>Hometown</dt><dd>${esc(f.hometown)}</dd>
        <dt>Cause</dt><dd>${esc(f.cause)}</dd>
        <dt>Collected by</dt><dd>${esc(f.collector)}</dd>
      </dl>${cert}<div id="vstamp" class="vstamp" hidden></div>`;
  }

  function renderBook() {
    const s = S.soul, el = $("#p-book");
    if (!s) { el.innerHTML = `<header class="p-head"><span>Book of Life &amp; Death</span></header><p class="empty">No extract requested.</p>`; return; }
    const rows = s.book.deeds.map((d) => `
      <tr><td>${esc(d.t)}${d.cat ? `<span class="tag">${D.CATS[d.cat].label}</span>` : ""}</td>
      <td class="v ${d.v > 0 ? "pos" : "neg"}">${signed(d.v)}</td></tr>`).join("");
    el.innerHTML = `
      <header class="p-head"><span>Book of Life &amp; Death</span><span>Certified extract</span></header>
      <dl class="fields">
        <dt>Name</dt><dd class="big">${esc(s.book.name)}</dd>
        <dt>Allotted lifespan</dt><dd class="num">${s.book.lifespan}</dd>
      </dl>
      <div class="ledger"><table><tbody>${rows}</tbody></table></div>
      <p class="net">Net merit: ________ <span>(clerk to calculate)</span></p>`;
  }

  function renderRules() {
    const day = dayCfg();
    const rules = [...D.BASE_RULES, ...day.extraRules].map((r) => `<li>${r}</li>`).join("");
    const routing = Object.entries(D.CATS).map(([, c]) =>
      `<tr><td class="num">${c.court}</td><td>${D.COURTS[c.court].king}</td><td><span class="tag">${c.label}</span></td></tr>`).join("");
    const seal = day.certs ? `<div class="seal-month">${sealHTML(D.SEAL)}<div><b>Seal of the month</b><br>Square. Vermilion ink. Code LOTUS-7.<br>Anything else is forged.</div></div>` : "";
    $("#p-rules").innerHTML = `
      <header class="p-head"><span>Rulebook</span><span>${esc(day.title)}</span></header>
      <ol class="rules">${rules}</ol>${seal}
      <h3 class="sub">Hell routing table</h3>
      <table class="routing"><tbody>${routing}</tbody></table>
      <p class="fine">This table supersedes all previous tables, none of which agreed with each other.</p>`;
  }

  function renderSpeech(lines) {
    $("#speech").innerHTML = lines.map(([who, text]) => {
      const ox = who === "ox";
      const name = ox ? "Ox-Head" : S.soul ? S.soul.file.name : "Soul";
      return `<p><span class="who ${ox ? "ox" : ""}">${esc(name)}</span> ${esc(text)}</p>`;
    }).join("");
  }

  function renderHud() {
    $("#hud-day").textContent = S.day;
    $("#hud-filed").textContent = S.today ? S.today.filed : 0;
    $("#hud-merit").textContent = signed(netOf(playerRows()));
    $("#hud-notes").textContent = S.notes + "B";
    updateClock();
    const can = S.phase === "working" && S.soul && !S.busy && !S.closing;
    ["#b-rebirth", "#b-hell", "#b-return"].forEach((id) => ($(id).disabled = !can));
    const b = $("#b-bribe");
    b.hidden = !(can && S.soul.bribe && !S.soul.bribeTaken);
    if (!b.hidden) b.innerHTML = `Take ${S.soul.bribe}B<small>bribe</small>`;
  }

  function updateClock() {
    const m = Math.floor(S.clock), h = Math.floor(m / 60), mm = m % 60;
    $("#hud-clock").textContent = `${String(h).padStart(2, "0")}:${String(mm - (mm % 5)).padStart(2, "0")}`;
  }

  // ---------- overlays & toasts ----------
  function showSheet(html, cls = "") {
    const sh = $("#sheet");
    sh.className = "sheet " + cls;
    sh.innerHTML = html;
    $("#overlay").hidden = false;
    const f = sh.querySelector("button");
    if (f) f.focus();
  }
  function hideSheet() { $("#overlay").hidden = true; S.pickingCourt = false; }

  function toast(kind, title, body) {
    const el = $("#toast");
    el.className = "toast " + kind;
    el.innerHTML = `<strong>${esc(title)}</strong><span>${esc(body)}</span>`;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (el.hidden = true), kind === "bad" ? 6000 : 2400);
  }

  // ---------- sound ----------
  let ac = null;
  function tone(freq, dur, type = "sine", vol = 0.15, when = 0) {
    if (!S.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* no audio, no problem */ }
  }
  const sfx = {
    bell() { tone(1320, 0.6, "sine", 0.07); tone(1980, 0.4, "sine", 0.03, 0.02); },
    stamp() { tone(95, 0.16, "square", 0.14); tone(55, 0.3, "sine", 0.3); },
    good() { tone(660, 0.1, "square", 0.04, 0.12); tone(990, 0.16, "square", 0.04, 0.22); },
    bad() { tone(150, 0.3, "sawtooth", 0.07, 0.1); tone(112, 0.4, "sawtooth", 0.07, 0.3); },
    coins() { [0, 0.07, 0.14].forEach((w, i) => tone(1500 + i * 220, 0.08, "triangle", 0.06, w)); },
  };

  // ---------- flow ----------
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ day: S.day, notes: S.notes, service: S.service })); } catch (e) { /* ignore */ }
  }
  function loadSave() {
    try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); return v && v.day ? v : null; } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  function titleScreen() {
    S.phase = "title";
    const sv = loadSave();
    showSheet(`
      <h1 class="logo">Form 49</h1>
      <p class="tagline">Intake Window 3, First Court of the Underworld</p>
      <p>You died. Your own ledger came up short, so instead of rebirth you've been assigned a desk job.</p>
      <p>Souls arrive with a Case File and an extract from the Book of Life and Death. Check the paperwork, do the sums, and stamp them through to <b>Rebirth</b>, off to one of the <b>Courts of Hell</b>, or back to the living if someone collected the wrong person.</p>
      <p>Each correct filing works off a bit of your own karmic debt. Three days. Don't embarrass Yama.</p>
      <div class="row">
        <button class="btn primary" data-act="new">Start a new shift</button>
        ${sv ? `<button class="btn" data-act="continue">Continue from Day ${sv.day}</button>` : ""}
      </div>
      <p class="fine">Keys: 1 Rebirth · 2 Hell · 3 Return · B take bribe</p>`, "dark");
  }

  function startDay() {
    S.phase = "memo";
    S.today = { filed: 0, correct: 0, wrong: 0, bribes: [], citations: [] };
    S.clock = OPEN; S.soulIndex = 0; S.soul = null; S.busy = false; S.closing = false;
    save();
    renderRules(); renderFile(); renderBook();
    renderSpeech([["ox", "Window opens at nine. Read your memo."]]);
    renderHud();
    const day = dayCfg();
    showSheet(`
      <header class="memo-head"><span>Memorandum</span><span>${esc(day.title)}</span></header>
      <dl class="memo-meta"><dt>From</dt><dd>Yama, King of the Fifth Court<br><small>Acting supervisor, First Court Intake Annex</small></dd>
      <dt>To</dt><dd>Clerk, Window 3</dd></dl>
      ${day.memo.map((p) => `<p>${p}</p>`).join("")}
      <button class="btn primary" data-act="open">Open the window</button>`);
  }

  function openWindow() {
    hideSheet();
    S.phase = "working";
    nextSoul();
  }

  function nextSoul() {
    S.soul = null;
    if (S.clock >= CLOSE) return endDay();
    S.soul = makeSoul(S.soulIndex++);
    anim("enter");
    S.busy = true;
    renderFile(); renderBook(); renderSpeech(S.soul.lines); renderHud();
    sfx.bell();
    setTimeout(() => { S.busy = false; renderHud(); }, REDUCED ? 50 : 600);
  }

  function takeBribe() {
    const s = S.soul;
    if (!s || !s.bribe || s.bribeTaken || S.busy) return;
    s.bribeTaken = true;
    S.notes += s.bribe;
    S.service.bribes++;
    S.today.bribes.push(s.bribe);
    sfx.coins();
    renderSpeech([["soul", "Pleasure doing business."], ["ox", "I didn't see anything. I have a very large head and very small eyes."]]);
    renderHud();
  }

  function stamp(v, court) {
    if (S.phase !== "working" || !S.soul || S.busy || S.closing) return;
    S.busy = true; S.stamping = true;
    hideSheet();
    const s = S.soul, got = { v, court }, want = judge(s, dayCfg());
    const ok = sameVerdict(got, want);
    S.today.filed++;
    if (ok) { S.today.correct++; S.service.correct++; } else {
      S.today.wrong++; S.service.wrong++;
      S.today.citations.push({ name: s.file.name, got: verdictLabel(got), want: verdictLabel(want), why: want.why });
    }

    const st = $("#vstamp");
    st.hidden = false;
    st.className = "vstamp " + v;
    st.textContent = v === "rebirth" ? "Rebirth" : v === "hell" ? `Hell · ${court}` : "Returned";
    sfx.stamp();

    const react = pick(D.REACT[v]).slice();
    if (v === "rebirth") react.push(["ox", `Forwarded to the 10th Court. Likely rebirth: ${tierFor(netOf(effectiveRows(s, dayCfg())))}`]);
    if (v === "hell") react.push(["ox", D.COURTS[court].sentence]);
    renderSpeech(react);

    if (ok) { toast("good", "Filed", "Correct. +1 to your own ledger."); sfx.good(); }
    else { toast("bad", `Citation: should be ${verdictLabel(want)}`, want.why); sfx.bad(); }

    anim(v === "rebirth" ? "up" : v === "hell" ? "down" : "back");
    renderHud();
    setTimeout(() => { S.busy = false; S.stamping = false; nextSoul(); }, REDUCED ? 900 : 1700);
  }

  function closeWindow() {
    if (S.closing) return;
    S.closing = true;
    renderHud();
    if (S.stamping) return; // stamp() will call nextSoul(), which sees the clock and ends the day
    if (S.soul) {
      renderSpeech([["ox", "Window's closed. Come back tomorrow."], ["soul", "But I've been waiting all day!"], ["ox", "You're dead. You've got time."]]);
      anim("back");
    }
    setTimeout(endDay, 1800);
  }

  function endDay() {
    if (S.phase !== "working") return;
    S.phase = "summary";
    S.soul = null;
    const t = S.today, E = D.ECON;
    // The Censorate audits each bribe separately.
    let seized = 0, caught = 0;
    t.bribes.forEach((b) => { if (chance(E.auditChance)) { caught++; seized += b; } });
    S.service.audits += caught;
    const wages = t.correct * E.wage;
    S.notes = S.notes - seized + wages;
    let rentNote = `-${E.dorm}B`;
    if (S.notes >= E.dorm) S.notes -= E.dorm;
    else { rentNote = `couldn't pay. Arrears noted (-1 merit)`; S.service.arrears++; S.notes = 0; }
    t.summary = { seized, caught, wages, rentNote };
    renderFile(); renderBook(); renderHud();
    summarySheet();
  }

  function summarySheet() {
    const t = S.today, sm = t.summary, E = D.ECON;
    const cites = t.citations.slice(0, 6).map((c) =>
      `<li><b>${esc(c.name)}</b>: you stamped ${esc(c.got)}, should be ${esc(c.want)}. <span>${esc(c.why)}</span></li>`).join("");
    const more = t.citations.length > 6 ? `<li>…and ${t.citations.length - 6} more.</li>` : "";
    const last = S.day >= D.DAYS.length;
    showSheet(`
      <header class="memo-head"><span>End of day ${S.day}</span><span>17:00</span></header>
      <table class="tally"><tbody>
        <tr><td>Souls filed correctly</td><td class="num">${t.correct}</td><td class="num pos">${signed(t.correct)}</td></tr>
        <tr><td>Clerical errors</td><td class="num">${t.wrong}</td><td class="num neg">${t.wrong ? -t.wrong : 0}</td></tr>
        <tr><td>Bribes accepted</td><td class="num">${t.bribes.length}</td><td class="num neg">${t.bribes.length * E.bribeMerit || 0}</td></tr>
        ${sm.caught ? `<tr><td>Censorate audit! Seized ${sm.seized}B</td><td class="num">${sm.caught}</td><td class="num neg">${-2 * sm.caught}</td></tr>` : ""}
      </tbody></table>
      ${cites ? `<h3 class="sub">Citations</h3><ul class="cites">${cites}${more}</ul>` : `<p class="clean">No citations. Yama grunted. That's the good grunt.</p>`}
      <h3 class="sub">Wallet (Hell Bank Notes, billions)</h3>
      <table class="tally"><tbody>
        <tr><td>Wages (${E.wage}B per correct filing)</td><td class="num pos">+${sm.wages}B</td></tr>
        <tr><td>Dormitory bunk (shared with three ghosts)</td><td class="num">${esc(sm.rentNote)}</td></tr>
        <tr><td><b>Balance</b></td><td class="num"><b id="bal">${S.notes}B</b></td></tr>
      </tbody></table>
      <div class="shop">
        <div><b>Outsourced sutra chanting</b><br><small>A monk upstairs chants on your behalf. ${E.sutra}B for +${E.sutraMerit} merit. Very efficient. Slightly suspicious.</small></div>
        <button class="btn" data-act="sutra" ${S.notes < E.sutra ? "disabled" : ""}>Buy (${E.sutra}B)</button>
      </div>
      <p class="yours">Your own net merit: <b class="num">${signed(netOf(playerRows()))}</b></p>
      <button class="btn primary" data-act="${last ? "ending" : "nextday"}">${last ? "Submit your own file" : "Clock off"}</button>`);
  }

  function ending() {
    S.phase = "ending";
    clearSave();
    const rows = playerRows(), r = verdictFromRows(rows);
    const table = rows.map((d) => `<tr><td>${esc(d.t)}${d.cat ? `<span class="tag">${D.CATS[d.cat].label}</span>` : ""}</td><td class="v ${d.v > 0 ? "pos" : "neg"}">${signed(d.v)}</td></tr>`).join("");
    const verdict = r.v === "rebirth"
      ? `<div class="big-stamp rebirth">Rebirth</div><p>Net merit ${signed(r.net)}. Forwarded to King Zhuanlun. You will be reborn as <b>${esc(tierFor(r.net))}</b></p><p>Meng Po is waiting at the bridge with the soup. You won't remember any of this. Probably for the best.</p>`
      : `<div class="big-stamp">Hell · Court ${r.court}</div><p>Net merit ${signed(r.net)}. Your worst entry: "${esc(r.worst ? r.worst.t : "Did nothing at all")}". Routed to ${D.COURTS[r.court].king}.</p><p>${esc(D.COURTS[r.court].sentence || "")}</p><p>On the bright side, you know exactly how the paperwork works.</p>`;
    showSheet(`
      <header class="memo-head"><span>Book of Life &amp; Death</span><span>Extract: You</span></header>
      <p>Three days are up. Your own file lands on someone else's desk.</p>
      <div class="ledger"><table><tbody>${table}</tbody></table></div>
      ${verdict}
      <button class="btn primary" data-act="restart">New life, same job</button>`);
  }

  function newGame() {
    S.day = 1; S.notes = 0;
    S.service = { correct: 0, wrong: 0, bribes: 0, sutras: 0, audits: 0, arrears: 0 };
    startDay();
  }

  // ---------- canvas scene ----------
  const cv = $("#scene"), ctx = cv.getContext("2d");
  const W = 200, H = 100;
  let T = 0, last = performance.now();
  let A = { mode: "none", t0: 0 };
  function anim(mode) { A = { mode, t0: T }; }
  function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  function drawSoul(x, y, L, bob) {
    y += bob;
    // robe
    for (let r = 0; r < 16; r++) { const w = Math.min(34, 18 + r * 2); R(x - w / 2, y - 16 + r, w, 1, L.robe); }
    R(x - 1, y - 16, 2, 16, "rgba(0,0,0,.25)");
    R(x - 5, y - 16, 4, 1, "#e9dcb0"); R(x + 1, y - 16, 4, 1, "#e9dcb0");
    // neck and head
    R(x - 3, y - 19, 6, 3, "#9fb9ae");
    R(x - 8, y - 33, 16, 14, L.skin); R(x - 7, y - 34, 14, 1, L.skin); R(x - 7, y - 19, 14, 1, L.skin);
    // hair
    const h = L.hair;
    if (L.style === "bun") { R(x - 8, y - 35, 16, 4, h); R(x - 3, y - 39, 6, 4, h); }
    else if (L.style === "topknot") { R(x - 8, y - 35, 16, 3, h); R(x - 2, y - 38, 4, 3, h); R(x - 1, y - 40, 2, 2, "#c0392b"); }
    else if (L.style === "long") { R(x - 9, y - 35, 18, 4, h); R(x - 9, y - 31, 3, 13, h); R(x + 6, y - 31, 3, 13, h); }
    else if (L.style === "cap") { R(x - 9, y - 37, 18, 5, "#141016"); R(x - 14, y - 35, 5, 2, "#141016"); R(x + 9, y - 35, 5, 2, "#141016"); }
    else { R(x - 4, y - 33, 3, 1, "#ffffff"); }
    // face
    const eye = "#1a1420";
    if (L.eyes === "dot") { R(x - 5, y - 27, 2, 2, eye); R(x + 3, y - 27, 2, 2, eye); }
    else if (L.eyes === "line") { R(x - 6, y - 26, 3, 1, eye); R(x + 3, y - 26, 3, 1, eye); }
    else { R(x - 6, y - 28, 3, 3, "#fff"); R(x + 3, y - 28, 3, 3, "#fff"); R(x - 5, y - 27, 1, 1, eye); R(x + 4, y - 27, 1, 1, eye); }
    const m = "#6a3a3a";
    if (L.mouth === "smile") { R(x - 2, y - 22, 4, 1, m); R(x - 3, y - 23, 1, 1, m); R(x + 2, y - 23, 1, 1, m); }
    else if (L.mouth === "frown") { R(x - 2, y - 23, 4, 1, m); R(x - 3, y - 22, 1, 1, m); R(x + 2, y - 22, 1, 1, m); }
    else if (L.mouth === "o") R(x - 1, y - 23, 2, 2, m);
    else R(x - 2, y - 22, 4, 1, m);
    if (L.beard) { R(x - 4, y - 21, 8, 3, h); R(x - 2, y - 18, 4, 3, h); }
  }

  function draw() {
    const mo = REDUCED ? 0 : 1;
    // wall and floor
    R(0, 0, W, H, "#1d1420");
    for (let x = 8; x < W; x += 16) R(x, 6, 1, 72, "#241a28");
    R(0, 0, W, 6, "#140e17");
    R(0, 78, W, 22, "#150e17");
    // the queue, fading into the gloom
    for (let i = 0; i < 6; i++) {
      const gx = 148 + i * 8, gy = 60 + Math.round(Math.sin(T * 1.6 + i * 1.3) * mo);
      ctx.globalAlpha = 0.3 - i * 0.04;
      R(gx + 1, gy, 5, 5, "#7fd1ae"); R(gx, gy + 5, 7, 13, "#7fd1ae");
      ctx.globalAlpha = 1;
    }
    // pillars
    [4, 188].forEach((px) => { R(px, 0, 8, 80, "#7d1f18"); R(px + 1, 0, 2, 80, "#c0392b"); R(px - 1, 72, 10, 6, "#5a3a22"); });
    // lanterns
    [26, 166].forEach((lx, i) => {
      const fl = mo ? 0.5 + 0.5 * Math.sin(T * 7 + i * 2) * Math.sin(T * 3.1) : 0.5;
      R(lx + 3, 0, 1, 8, "#3a2a2a");
      ctx.globalAlpha = 0.05 + fl * 0.04; R(lx - 3, 5, 14, 17, "#e0a84a"); R(lx - 5, 8, 18, 11, "#e0a84a"); ctx.globalAlpha = 1;
      R(lx, 8, 8, 10, "#c0392b"); R(lx + 1, 9, 2, 8, "#e0574a");
      R(lx, 8, 8, 1, "#e0a84a"); R(lx, 17, 8, 1, "#e0a84a"); R(lx + 3, 18, 2, 4, "#e0a84a");
    });
    // plaque over the window
    R(74, 3, 52, 12, "#2b1d14"); R(74, 3, 52, 1, "#e0a84a"); R(74, 14, 52, 1, "#e0a84a");
    R(74, 3, 1, 12, "#e0a84a"); R(125, 3, 1, 12, "#e0a84a");
    ctx.fillStyle = "#e0a84a"; ctx.font = "bold 8px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("第一殿", 100, 9.5);
    // Ox-Head, on duty
    const blink = mo && T % 4 < 0.12;
    R(22, 52, 22, 28, "#3a2f4a"); R(22, 64, 22, 2, "#c0392b");
    R(26, 38, 14, 13, "#6b4428"); R(28, 45, 10, 7, "#a0714a");
    R(30, 48, 2, 1, "#2b1d14"); R(34, 48, 2, 1, "#2b1d14");
    if (!blink) { R(28, 41, 2, 2, "#e0a84a"); R(36, 41, 2, 2, "#e0a84a"); }
    R(23, 38, 3, 2, "#e9dcb0"); R(22, 35, 2, 3, "#e9dcb0"); R(40, 38, 3, 2, "#e9dcb0"); R(42, 35, 2, 3, "#e9dcb0");
    R(47, 22, 1, 58, "#8a7a6a"); R(45, 16, 5, 7, "#c9c9d2"); R(44, 18, 1, 3, "#c9c9d2");
    // the soul at the window
    if (S.soul || A.mode === "up" || A.mode === "down" || A.mode === "back") drawCurrent(mo);
    // window frame and counter
    R(56, 17, 88, 3, "#5a3a22"); R(56, 17, 3, 63, "#5a3a22"); R(141, 17, 3, 63, "#5a3a22");
    R(0, 80, W, 20, "#4a2f1c"); R(0, 80, W, 2, "#7a5232");
    for (let x = 6; x < W; x += 23) R(x, 86 + (x % 3), 12, 1, "#3d2616");
    R(150, 76, 20, 4, "#e9dcb0"); R(152, 74, 16, 2, "#d8c890");
    R(36, 77, 10, 3, "#222"); R(120, 75, 5, 5, "#e0a84a"); R(121, 74, 3, 1, "#e0a84a");
  }

  let lastSoul = null;
  function drawCurrent(mo) {
    const s = S.soul || lastSoul;
    if (!s) return;
    if (S.soul) lastSoul = S.soul;
    const p = Math.min(1, (T - A.t0) / (A.mode === "enter" ? 0.6 : 1.1));
    let x = 100, y = 82, a = 1;
    if (A.mode === "enter") { x = 150 - 50 * p; a = p; }
    else if (A.mode === "up") {
      y -= 44 * p; a = 1 - p;
      ctx.globalAlpha = 0.35 * (1 - p); R(88, 0, 24, 80, "#f5e3a1"); ctx.globalAlpha = 1;
    } else if (A.mode === "down") {
      y += 40 * p;
      ctx.globalAlpha = 0.5 * Math.sin(p * Math.PI); R(59, 50, 82, 30, "#c0392b"); ctx.globalAlpha = 1;
    } else if (A.mode === "back") { x = 100 + 70 * p; a = 1 - p; }
    if (!S.soul && p >= 1) return;
    ctx.globalAlpha = a * 0.92;
    drawSoul(x, y, s.look, Math.round(Math.sin(T * 2.2) * mo));
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now; T += dt;
    if (S.phase === "working" && $("#overlay").hidden && !S.closing) {
      S.clock += (dt * (CLOSE - OPEN)) / DAY_SECONDS;
      if (S.clock >= CLOSE) { S.clock = CLOSE; closeWindow(); }
      updateClock();
    }
    draw();
    requestAnimationFrame(frame);
  }

  // ---------- input ----------
  function courtPicker() {
    if (S.phase !== "working" || !S.soul || S.busy) return;
    S.pickingCourt = true;
    const btns = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => `
      <button class="court" data-court="${n}"><span class="num">${n}</span><span>${D.COURTS[n].king}</span><small>${D.COURTS[n].dept}</small></button>`).join("");
    showSheet(`<header class="memo-head"><span>Refer to which court?</span><span>Keys 2-9</span></header>
      <div class="courts">${btns}</div>
      <button class="btn" data-act="cancel">Cancel</button>`);
  }

  $("#b-rebirth").addEventListener("click", () => stamp("rebirth"));
  $("#b-hell").addEventListener("click", courtPicker);
  $("#b-return").addEventListener("click", () => stamp("return"));
  $("#b-bribe").addEventListener("click", takeBribe);
  $("#btn-sound").addEventListener("click", () => {
    S.sound = !S.sound;
    $("#btn-sound").textContent = S.sound ? "Sound on" : "Sound off";
    $("#btn-sound").setAttribute("aria-pressed", String(S.sound));
  });

  $("#sheet").addEventListener("click", (e) => {
    const c = e.target.closest("[data-court]");
    if (c) return stamp("hell", Number(c.dataset.court));
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "new") { clearSave(); newGame(); }
    else if (act === "continue") { const sv = loadSave(); S.day = sv.day; S.notes = sv.notes; S.service = sv.service; startDay(); }
    else if (act === "open") openWindow();
    else if (act === "cancel") hideSheet();
    else if (act === "nextday") { S.day++; startDay(); }
    else if (act === "ending") ending();
    else if (act === "restart") { hideSheet(); titleScreen(); }
    else if (act === "sutra" && S.notes >= D.ECON.sutra) {
      S.notes -= D.ECON.sutra; S.service.sutras++;
      tone(220, 1.2, "sine", 0.08); tone(330, 1.2, "sine", 0.05);
      renderHud(); summarySheet();
    }
  });

  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    document.querySelectorAll(".paper").forEach((p) => p.classList.toggle("active", p.id === "p-" + t.dataset.tab));
  }));

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (S.pickingCourt) {
      if (/^[2-9]$/.test(e.key)) stamp("hell", Number(e.key));
      else if (e.key === "Escape") hideSheet();
      return;
    }
    if (!$("#overlay").hidden) return;
    if (e.key === "1") stamp("rebirth");
    else if (e.key === "2") courtPicker();
    else if (e.key === "3") stamp("return");
    else if (e.key === "b" || e.key === "B") takeBribe();
  });

  // ---------- boot ----------
  renderRules(); renderFile(); renderBook();
  renderSpeech([["ox", "Next!"]]);
  renderHud();
  titleScreen();
  requestAnimationFrame(frame);
})();
