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

  // ---------- tooltip markup ----------
  const tagHTML = (cat, doubled) => `<span class="tag" tabindex="0" data-tip="cat:${cat}">${D.CATS[cat].label}${doubled ? " ×2" : ""}</span>`;
  const TERM_RE = new RegExp(`(${D.GLOSSARY.map((g) => g.re).join("|")})`, "gi");
  const termIndex = (word) => D.GLOSSARY.findIndex((g) => new RegExp(`^(?:${g.re})$`, "i").test(word));
  // Underline glossary terms in already-escaped HTML, skipping anything inside tags.
  function linkTerms(html) {
    return html.split(/(<[^>]+>)/).map((part) => part.startsWith("<") ? part
      : part.replace(TERM_RE, (m) => `<span class="term" tabindex="0" data-tip="g:${termIndex(m)}">${m}</span>`)).join("");
  }

  // ---------- state ----------
  const S = {
    phase: "title", mode: "normal", day: 1, notes: 0,
    service: { correct: 0, wrong: 0, bribes: 0, sutras: 0, audits: 0, arrears: 0, contrib: 0 },
    whispers: 0, today: null, clock: OPEN, soulIndex: 0, soul: null, busy: false, stamping: false, closing: false,
    sound: true, pickingCourt: false, paused: false,
  };
  const dayCfg = () => D.DAYS[S.day - 1];
  const modeCfg = () => D.MODES[S.mode] || D.MODES.normal;
  // Bumped whenever a day starts or is abandoned; delayed callbacks from an older run are ignored.
  let run = 0;
  function later(fn, ms) { const r = run; return setTimeout(() => { if (r === run) fn(); }, ms); }

  // ---------- the rules ----------
  const certValid = (c) => c.shape === D.SEAL.shape && c.ink === D.SEAL.ink && c.code === D.SEAL.code;

  function effectiveRows(s, day) {
    const rows = s.book.deeds.map((d) => ({ ...d, v: day.filialDouble && d.cat === "filial" ? d.v * 2 : d.v }));
    if (day.certs && s.cert && certValid(s.cert)) rows.push({ t: "Temple merit certificate", v: s.cert.value });
    return rows;
  }

  // The abacus clerk only reads the Book. Certificates, names and ages are still your job.
  const abacusSum = (s, day) => s.book.deeds.reduce((a, d) => a + (day.filialDouble && d.cat === "filial" ? d.v * 2 : d.v), 0);

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
    else r.why = `Net merit was ${signed(r.net)}. Worst deed: "${r.worst.t}" (${signed(r.worst.v)}, ${D.CATS[r.worst.cat].label}), so Court ${r.court}.`;
    return r;
  }

  const verdictLabel = (x) => (x.v === "rebirth" ? "Rebirth" : x.v === "hell" ? `Hell, Court ${x.court}` : "Return to sender");
  const sameVerdict = (a, b) => a.v === b.v && (a.v !== "hell" || a.court === b.court);
  const tierFor = (net) => { let t = D.TIERS[0][1]; for (const [min, txt] of D.TIERS) if (net >= min) t = txt; return t; };

  function playerRows() {
    const s = S.service, rows = D.PLAYER_LIFE.map((r) => ({ ...r }));
    if (s.correct) rows.push({ t: `Souls filed correctly ×${s.correct}`, v: s.correct });
    if (s.contrib) rows.push({ t: `Administrative adjustment ×${s.contrib}`, v: s.contrib });
    if (s.sutras) rows.push({ t: `Outsourced sutra chanting ×${s.sutras}`, v: s.sutras * D.ECON.sutraMerit });
    if (s.wrong) rows.push({ t: `Clerical errors ×${s.wrong}`, v: -s.wrong, cat: "shirk" });
    if (s.bribes) rows.push({ t: `Bribes accepted ×${s.bribes}`, v: s.bribes * D.ECON.bribeMerit, cat: "fraud" });
    if (s.audits) rows.push({ t: `Caught by the Censorate ×${s.audits}`, v: s.audits * D.ECON.auditMerit, cat: "fraud" });
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
    if ((guilty && chance(0.3)) || chance(0.05)) s.bribe = randint(D.ECON.bribeMin, D.ECON.bribeMax);
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
    if (s.bribe) {
      s.lines.push(["soul", pick(D.BRIBE_LINES)]);
      if (!S.service.bribes && S.whispers < D.BRIBE_WHISPERS.length) s.lines.push(["ox", D.BRIBE_WHISPERS[S.whispers++]]);
    }
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
        <div>${linkTerms(esc(s.cert.temple))} certifies the bearer has earned</div>
        <div class="num">${signed(s.cert.value)} merit</div></div></div>`;
    }
    el.innerHTML = `
      <header class="p-head"><span>Case File</span><span>No. ${s.caseNo}</span></header>
      <dl class="fields">
        <dt>Name</dt><dd class="big">${esc(f.name)}</dd>
        <dt>Age at death</dt><dd class="num">${f.age}</dd>
        <dt>Occupation</dt><dd>${linkTerms(esc(f.occupation))}</dd>
        <dt>Hometown</dt><dd>${linkTerms(esc(f.hometown))}</dd>
        <dt>Cause</dt><dd>${linkTerms(esc(f.cause))}</dd>
        <dt>Collected by</dt><dd>${linkTerms(esc(f.collector))}</dd>
      </dl>${cert}<div id="vstamp" class="vstamp" hidden></div>`;
    dropStaleTip();
  }

  function renderBook() {
    const s = S.soul, el = $("#p-book");
    if (!s) { el.innerHTML = `<header class="p-head"><span>Book of Life &amp; Death</span></header><p class="empty">No extract requested.</p>`; return; }
    // Show the value that actually counts, so "worst deed" can be read straight off the page.
    const dbl = dayCfg().filialDouble;
    const rows = s.book.deeds.map((d) => {
      const doubled = dbl && d.cat === "filial", v = doubled ? d.v * 2 : d.v;
      return `
      <tr><td>${linkTerms(esc(d.t))}${d.cat ? tagHTML(d.cat, doubled) : ""}</td>
      <td class="v ${v > 0 ? "pos" : "neg"}">${signed(v)}</td></tr>`;
    }).join("");
    el.innerHTML = `
      <header class="p-head"><span>Book of Life &amp; Death</span><span>Certified extract</span></header>
      <dl class="fields">
        <dt>Name</dt><dd class="big">${esc(s.book.name)}</dd>
        <dt>Allotted lifespan</dt><dd class="num">${s.book.lifespan}</dd>
      </dl>
      <div class="ledger"><table><tbody>${rows}</tbody></table></div>
      ${netLine(s)}`;
    dropStaleTip();
  }

  function dropStaleTip() { if (tipFor && !tipFor.isConnected) hideTip(); }

  function netLine(s) {
    const cost = D.ECON.abacus;
    if (s.abacus === undefined) return `<div class="net"><span>Net merit: ________ <span class="hint">(clerk to calculate)</span></span>
      <button class="abacus" data-abacus>Abacus clerk: sum it for ${cost}B</button></div>`;
    if (s.abacus === null) return `<div class="net"><span>Net merit: <span class="hint">clack, clack, clack…</span></span></div>`;
    const dbl = dayCfg().filialDouble && s.book.deeds.some((d) => d.cat === "filial") ? " Unfilial ×2 applied." : "";
    return `<div class="net summed"><span>Net merit: <b class="num ${s.abacus > 0 ? "pos" : "neg"}">${signed(s.abacus)}</b></span>
      <span class="hint">Abacus clerk: Book entries only.${dbl} Names, ages and certificates are your problem.</span></div>`;
  }

  function renderRules() {
    const day = dayCfg();
    const rules = [...D.BASE_RULES, ...day.extraRules].map((r) => `<li>${linkTerms(r)}</li>`).join("");
    const routing = Object.entries(D.CATS).map(([cat, c]) =>
      `<tr class="route" tabindex="0" data-tip="court:${c.court}"><td class="num">${c.court}</td><td>${D.COURTS[c.court].king}</td><td>${tagHTML(cat)}</td></tr>`).join("");
    const seal = day.certs ? `<div class="seal-month">${sealHTML(D.SEAL)}<div><b>Seal of the month</b><br>Square. Vermilion ink. Code LOTUS-7.<br>Anything else is forged.</div></div>` : "";
    $("#p-rules").innerHTML = `
      <header class="p-head"><span>Rulebook</span><span>${esc(day.title)}</span></header>
      <ol class="rules">${rules}</ol>${seal}
      <h3 class="sub">Hell routing table</h3>
      <table class="routing"><tbody>${routing}</tbody></table>
      <p class="fine">Hover or tap a row or tag for details. This table supersedes all previous tables, none of which agreed with each other.</p>`;
  }

  // ---------- speech (typed out, like every good RPG) ----------
  let typing = null;
  function renderSpeech(lines) {
    const el = $("#speech");
    el.innerHTML = lines.map(([who]) => {
      const ox = who === "ox";
      const name = ox ? "Ox-Head" : S.soul ? S.soul.file.name : "Soul";
      return `<p><span class="who ${ox ? "ox" : ""}">${esc(name)}</span> <span class="said"></span></p>`;
    }).join("");
    $("#sr-speech").textContent = lines.map((l) => l[1]).join(" ");
    typing = { spans: [...el.querySelectorAll(".said")], texts: lines.map((l) => l[1]), who: lines.map((l) => l[0]), i: 0, n: 0, acc: 0 };
    if (REDUCED) finishTyping();
  }
  function finishTyping() {
    if (!typing) return;
    typing.spans.forEach((s, i) => (s.textContent = typing.texts[i]));
    typing = null;
  }
  function stepTyping(dt) {
    if (!typing) return;
    typing.acc += dt * 70;
    while (typing && typing.acc >= 1) {
      typing.acc -= 1;
      const txt = typing.texts[typing.i];
      typing.n++;
      typing.spans[typing.i].textContent = txt.slice(0, typing.n);
      if (typing.n % 4 === 0 && txt[typing.n - 1] !== " ") tone(typing.who[typing.i] === "ox" ? 190 : 480, 0.03, "triangle", 0.03);
      if (typing.n >= txt.length) { typing.i++; typing.n = 0; if (typing.i >= typing.texts.length) typing = null; }
    }
  }

  // ---------- HUD ----------
  const hudPrev = {};
  function setHud(id, num, text) {
    const el = $(id), prev = hudPrev[id];
    if (prev !== undefined && prev !== num && !REDUCED) {
      const color = num > prev ? "#7fd1ae" : "#ff6b5b";
      el.animate([{ transform: "scale(1.5)", color }, { transform: "scale(1)" }], { duration: 450, easing: "steps(4)" });
    }
    hudPrev[id] = num;
    el.textContent = text;
  }

  function renderHud() {
    const merit = netOf(playerRows()), filed = S.today ? S.today.filed : 0;
    setHud("#hud-day", S.day, S.day);
    setHud("#hud-filed", filed, filed);
    setHud("#hud-merit", merit, signed(merit));
    setHud("#hud-notes", S.notes, S.notes + "B");
    updateClock();
    const can = S.phase === "working" && S.soul && !S.busy && !S.closing;
    ["#b-rebirth", "#b-hell", "#b-return"].forEach((id) => ($(id).disabled = !can));
    $("#btn-pause").disabled = !canPause();
    const b = $("#b-bribe");
    b.hidden = !(can && S.soul.bribe && !S.soul.bribeTaken);
    if (!b.hidden) b.innerHTML = `Take ${S.soul.bribe}B<small>bribe</small>`;
  }

  function updateClock() {
    const M = modeCfg();
    if (!M.timed) {
      $("#hud-clock-k").textContent = "Souls";
      $("#hud-clock").textContent = `${S.today ? S.today.filed : 0}/${M.soulsPerDay}`;
      $("#hud-clock").parentElement.classList.remove("urgent");
      return;
    }
    $("#hud-clock-k").textContent = "Clock";
    const m = Math.floor(S.clock), h = Math.floor(m / 60), mm = m % 60;
    $("#hud-clock").textContent = `${String(h).padStart(2, "0")}:${String(mm - (mm % 5)).padStart(2, "0")}`;
    $("#hud-clock").parentElement.classList.toggle("urgent", S.phase === "working" && S.clock >= CLOSE - 60 && S.clock < CLOSE);
  }

  // ---------- overlays & toasts ----------
  function showSheet(html, cls = "") {
    const sh = $("#sheet");
    S.pickingCourt = false;
    hideTip();
    sh.className = "sheet " + cls;
    sh.innerHTML = html;
    $("#overlay").hidden = false;
    const f = sh.querySelector("button");
    if (f) f.focus();
  }
  function hideSheet() { $("#overlay").hidden = true; S.pickingCourt = false; }

  function toast(kind, title, body) {
    const el = $("#toast");
    el.hidden = true; void el.offsetWidth; // restart the drop-in animation
    el.className = "toast " + kind;
    el.innerHTML = `<strong>${esc(title)}</strong><span>${esc(body)}</span>`;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (el.hidden = true), kind === "bad" ? 6000 : 2400);
  }

  // ---------- DOM juice ----------
  const deskPapers = () => [$("#p-file"), $("#p-book")];
  function dealPapers() {
    if (REDUCED) return;
    deskPapers().forEach((el, i) => {
      el.getAnimations().forEach((a) => a.cancel());
      el.animate([
        { transform: "translateY(40px) rotate(-3deg)", opacity: 0 },
        { transform: "translateY(-4px) rotate(.5deg)", opacity: 1, offset: 0.7 },
        { transform: "none", opacity: 1 },
      ], { duration: 420, delay: i * 90, easing: "ease-out", fill: "backwards" });
    });
  }
  function fileAway() {
    if (REDUCED) return;
    deskPapers().forEach((el, i) => el.animate(
      [{ transform: "none", opacity: 1 }, { transform: "translateX(-70px) rotate(-6deg)", opacity: 0 }],
      { duration: 300, delay: i * 60, easing: "ease-in", fill: "forwards" }));
  }
  function jiggle(el) {
    if (REDUCED) return;
    el.animate([{ transform: "translate(0,0)" }, { transform: "translate(-3px,2px)" }, { transform: "translate(3px,-1px)" }, { transform: "translate(0,0)" }],
      { duration: 160, easing: "steps(3)" });
  }
  function flyNotes(n) {
    if (REDUCED) return;
    const from = $("#b-bribe").getBoundingClientRect(), to = $("#hud-notes").getBoundingClientRect();
    const fx = from.left + from.width / 2, fy = from.top;
    const dx = to.left + to.width / 2 - fx, dy = to.top - fy;
    for (let i = 0; i < Math.min(n, 7); i++) {
      const d = document.createElement("div");
      d.className = "flynote"; d.textContent = "冥";
      d.style.left = fx + "px"; d.style.top = fy + "px";
      document.body.appendChild(d);
      const spread = (i - 3) * 16;
      d.animate([
        { transform: "translate(-50%, 0) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.4 + spread}px), ${dy * 0.4 - 70}px) rotate(${spread}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), ${dy}px) rotate(0deg) scale(.5)`, opacity: 0.3 },
      ], { duration: 750 + i * 50, delay: i * 45, easing: "ease-in-out", fill: "both" }).onfinish = () => d.remove();
    }
  }

  // ---------- sound ----------
  let ac = null;
  function tone(freq, dur, type = "sine", vol = 0.15, when = 0) {
    if (!S.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume(); // Chrome suspends audio created before the first click
      const t = ac.currentTime + when, o = ac.createOscillator(), gn = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* no audio, no problem */ }
  }
  const sfx = {
    bell() { tone(1320, 0.6, "sine", 0.07); tone(1980, 0.4, "sine", 0.03, 0.02); },
    stamp() { tone(95, 0.16, "square", 0.14); tone(55, 0.3, "sine", 0.3); },
    good() { tone(660, 0.1, "square", 0.04, 0.12); tone(990, 0.16, "square", 0.04, 0.22); },
    bad() { tone(150, 0.3, "sawtooth", 0.07, 0.1); tone(112, 0.4, "sawtooth", 0.07, 0.3); },
    coins() { [0, 0.07, 0.14, 0.21].forEach((w, i) => tone(1500 + i * 220, 0.08, "triangle", 0.06, w)); },
    gong() { tone(98, 3, "sine", 0.35); tone(196, 2.2, "sine", 0.12); tone(294, 1.6, "triangle", 0.05); tone(415, 1.2, "sine", 0.04); },
    thud() { tone(70, 0.3, "square", 0.14); tone(42, 0.5, "sine", 0.35); },
    rattle() { for (let i = 0; i < 7; i++) tone(160 + rand() * 60, 0.04, "square", 0.05, i * 0.09); },
    whoosh() { tone(300, 0.5, "sine", 0.06); tone(600, 0.6, "sine", 0.04, 0.1); tone(900, 0.5, "sine", 0.03, 0.2); },
    abacus() { for (let i = 0; i < 9; i++) tone(1800 + rand() * 900, 0.025, "square", 0.03, i * 0.07); },
    rumble() { tone(55, 0.9, "sawtooth", 0.08); tone(40, 1, "sine", 0.2); },
  };

  // ---------- day transitions ----------
  const waiters = new Set();
  let skipping = false, curtainBusy = false;
  function wait(ms) {
    return new Promise((res) => {
      if (skipping) return res();
      const done = () => { clearTimeout(t); waiters.delete(done); res(); };
      const t = setTimeout(done, ms);
      waiters.add(done);
    });
  }
  function skipTransition() { if (curtainBusy) { skipping = true; [...waiters].forEach((f) => f()); } }
  function fade(el, from, to, ms) {
    el.getAnimations().forEach((a) => a.cancel());
    el.style.opacity = to;
    if (skipping || REDUCED) return Promise.resolve();
    return el.animate([{ opacity: from }, { opacity: to }], { duration: ms }).finished.catch(() => {});
  }

  // Full-screen interlude: optional night in the dorm, then a gong and a title card.
  async function transition({ night, title, sub, then }) {
    if (curtainBusy) return;
    curtainBusy = true; skipping = false;
    const c = $("#curtain"), nw = $("#night-wrap"), card = $("#card");
    nw.hidden = true; card.hidden = true; card.classList.remove("slam");
    c.hidden = false;
    await fade(c, 0, 1, 350);
    hideSheet();
    if (night) {
      nightT0 = T; nightOn = true; nw.hidden = false;
      $("#night-cap").innerHTML = `<span class="when">${esc(night.when)}</span>${esc(night.text)}`;
      await wait(4600);
      nightOn = false; nw.hidden = true;
    }
    $("#card-day").textContent = title;
    $("#card-day").classList.toggle("long", title.length > 6);
    $("#card-sub").textContent = sub;
    card.hidden = false;
    void card.offsetWidth; card.classList.add("slam");
    c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash");
    sfx.gong();
    await wait(2000);
    then();
    await fade(c, 1, 0, 400);
    c.hidden = true; c.classList.remove("flash");
    curtainBusy = false; skipping = false;
    const f = $("#sheet button");
    if (f && !$("#overlay").hidden) f.focus();
  }

  function nightCaption() {
    const t = S.today || { citations: [], bribes: [], wrong: 0, summary: {} };
    const n = S.day;
    let text;
    if (t.citations.length >= 3) text = "You dream of Yama. He's holding a clipboard. Your name is at the top.";
    else if (t.summary && t.summary.caught) text = "The Censorate took your money. You sleep in the dent where it used to be.";
    else if (t.bribes.length) text = "You sleep on a pillow of hell money. It crinkles every time you roll over.";
    else if (!t.wrong) text = "A clean day. Your bunkmates have started to find you suspicious.";
    else text = pick([
      "Your bunkmates snore, which is impressive, given that none of them breathe.",
      "Somewhere below, Court 4 is weighing someone. You can hear the scales creak.",
      "The ghost on the floor mat is on year 212 of a 300-year sentence for queue-jumping.",
    ]);
    return { when: `Night ${n}. The clerks' dormitory.`, text };
  }

  // ---------- flow ----------
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ mode: S.mode, day: S.day, notes: S.notes, service: S.service })); } catch (e) { /* ignore */ }
  }
  function loadSave() {
    try {
      const v = JSON.parse(localStorage.getItem(SAVE_KEY));
      const ok = v && Number.isInteger(v.day) && v.day >= 1 && v.day <= D.DAYS.length && Number.isFinite(v.notes) && v.service && typeof v.service === "object";
      if (ok && v.mode === "kid") v.mode = "trainee"; // renamed
      if (ok && !D.MODES[v.mode]) v.mode = "normal"; // saves from before modes existed
      return ok ? v : null;
    } catch (e) { return null; }
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
      ${sv ? `<button class="btn primary" data-act="continue">Continue: Day ${sv.day}, ${esc(D.MODES[sv.mode].label)}</button>` : ""}
      <h2 class="menu-h">${sv ? "Or start over" : "Choose your shift"}</h2>
      <div class="modes">
        ${Object.entries(D.MODES).map(([key, m]) => `
          <button class="mode" data-act="new" data-mode="${key}">
            <span class="mode-name">${esc(m.label)}</span>
            <span class="mode-blurb">${esc(m.blurb)}</span>
          </button>`).join("")}
      </div>
      <p class="fine">Keys: 1 Rebirth · 2 Hell · 3 Return · B take bribe · A abacus · P pause</p>`, "dark");
  }

  const daySub = () => dayCfg().title.split(": ")[1] || "";
  function beginDay(night) { transition({ night, title: `Day ${S.day}`, sub: daySub(), then: startDay }); }

  function startDay() {
    run++;
    S.phase = "memo";
    S.today = { filed: 0, correct: 0, wrong: 0, bribes: [], citations: [], abacus: 0, abacusSpent: 0 };
    S.clock = OPEN; S.soulIndex = 0; S.soul = null; S.busy = false; S.stamping = false; S.closing = false;
    lastSoul = null; A = { mode: "none", t0: T }; parts.length = 0;
    SH = { pos: 1, from: 1, to: 1, t0: T, dur: 0.001 };
    save();
    renderRules(); renderFile(); renderBook();
    renderSpeech([["ox", "Window opens at nine. Read your memo."]]);
    renderHud();
    const day = dayCfg();
    showSheet(`
      <header class="memo-head"><span>Memorandum</span><span>${esc(day.title)}</span></header>
      <dl class="memo-meta"><dt>From</dt><dd>Yama, King of the Fifth Court<br><small>Acting supervisor, First Court Intake Annex</small></dd>
      <dt>To</dt><dd>Clerk, Window 3</dd></dl>
      ${day.memo.map((p) => `<p>${linkTerms(p)}</p>`).join("")}
      ${modeCfg().memo && S.day === 1 ? `<p><b>${esc(modeCfg().memo)}</b></p>` : ""}
      <button class="btn primary" data-act="open">Open the window</button>`);
  }

  function openWindow() {
    if (S.phase !== "memo") return;
    hideSheet();
    S.phase = "opening";
    shutter(0, 0.7);
    sfx.rattle();
    later(() => { S.phase = "working"; nextSoul(); }, REDUCED ? 50 : 750);
  }

  function nextSoul() {
    S.soul = null;
    const M = modeCfg();
    if (M.timed ? S.clock >= CLOSE : S.today.filed >= M.soulsPerDay) return shutDown();
    S.soul = makeSoul(S.soulIndex++);
    hideTip();
    anim("enter");
    S.busy = true;
    renderFile(); renderBook(); dealPapers(); renderSpeech(S.soul.lines); renderHud();
    sfx.bell();
    later(() => { S.busy = false; renderHud(); }, REDUCED ? 50 : 600);
  }

  function takeBribe() {
    const s = S.soul;
    if (!s || !s.bribe || s.bribeTaken || S.busy || S.paused) return;
    flyNotes(s.bribe);
    s.bribeTaken = true;
    S.notes += s.bribe;
    S.service.bribes++;
    S.today.bribes.push(s.bribe);
    sfx.coins();
    ox("away");
    renderSpeech([["soul", "Pleasure doing business."], ["ox", "I didn't see anything. I have a very large head and very small eyes."]]);
    renderHud();
  }

  function stamp(v, court) {
    if (S.phase !== "working" || !S.soul || S.busy || S.closing || S.paused) return;
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
    shake(2);
    jiggle($("#p-file"));

    const react = pick(D.REACT[v]).slice();
    if (v === "rebirth") react.push(["ox", `Forwarded to the 10th Court. Likely rebirth: ${tierFor(netOf(effectiveRows(s, dayCfg())))}`]);
    if (v === "hell") react.push(["ox", D.COURTS[court].sentence]);
    renderSpeech(react);

    if (ok) { toast("good", "Filed", "Correct. +1 to your own ledger."); sfx.good(); ox("nod"); }
    else { toast("bad", `Citation: should be ${verdictLabel(want)}`, want.why); sfx.bad(); ox("shake"); }

    anim(v === "rebirth" ? "up" : v === "hell" ? "down" : "back");
    if (v === "rebirth") sfx.whoosh();
    if (v === "hell") sfx.rumble();
    renderHud();
    const hold = REDUCED ? 900 : 2200;
    later(fileAway, hold - 400);
    later(() => { S.busy = false; S.stamping = false; nextSoul(); }, hold);
  }

  // ---------- abacus clerk ----------
  function useAbacus() {
    const s = S.soul, cost = D.ECON.abacus;
    if (S.phase !== "working" || !s || S.busy || S.closing || S.paused || s.abacus !== undefined) return;
    if (S.notes < cost) {
      renderSpeech([["ox", `The abacus clerk charges ${cost}B and doesn't do credit. Nobody down here does.`]]);
      tone(150, 0.2, "sawtooth", 0.05);
      return;
    }
    S.notes -= cost; S.today.abacus++; S.today.abacusSpent += cost;
    s.abacus = null;
    renderBook(); renderHud();
    sfx.abacus();
    later(() => { if (S.soul === s) { s.abacus = abacusSum(s, dayCfg()); renderBook(); } }, REDUCED ? 0 : 700);
  }

  // ---------- pause ----------
  // The papers and dialogue are hidden while paused, so stopping the clock can't be used to study a case.
  const canPause = () => S.phase === "working" && !S.closing && !S.paused && !curtainBusy;
  function pause() {
    if (!canPause()) return;
    if (S.pickingCourt) hideSheet();
    S.paused = true;
    finishTyping(); hideTip();
    $("#app").classList.add("paused");
    $("#toast").hidden = true;
    showSheet(`
      <header class="memo-head"><span>On break</span><span>${esc($("#hud-clock").textContent)}</span></header>
      <p>The clock has stopped and the papers are face down. The dead can wait. They're very good at it.</p>
      <div class="row">
        <button class="btn primary" data-act="resume">Back to work</button>
        <button class="btn" data-act="quit">Quit to title</button>
      </div>
      <p class="fine">P or Esc also resumes.</p>`, "dark");
    renderHud();
  }
  function resume() {
    if (!S.paused) return;
    hideSheet();
    S.paused = false;
    $("#app").classList.remove("paused");
    renderHud();
  }
  function confirmQuit() {
    showSheet(`
      <header class="memo-head"><span>Quit to title?</span></header>
      <p>You'll lose today's progress and restart Day ${S.day} next time. Anything from earlier days is kept.</p>
      <div class="row">
        <button class="btn" data-act="resume">Keep working</button>
        <button class="btn primary" data-act="quit-yes">Yes, quit</button>
      </div>`, "dark");
  }
  function quitToTitle() {
    run++;
    S.paused = false;
    $("#app").classList.remove("paused");
    S.phase = "title"; S.soul = null; S.busy = false; S.closing = false; S.today = null;
    lastSoul = null; A = { mode: "none", t0: T }; parts.length = 0;
    SH = { pos: 1, from: 1, to: 1, t0: T, dur: 0.001 };
    renderFile(); renderBook(); renderSpeech([["ox", "Next!"]]); renderHud();
    titleScreen();
  }

  function closeWindow() {
    if (S.closing) return;
    S.closing = true;
    if (S.pickingCourt) hideSheet();
    renderHud();
    if (S.stamping) return; // stamp() will call nextSoul(), which sees the clock and shuts the window
    if (S.soul) {
      renderSpeech([["ox", "Window's closed. Come back tomorrow."], ["soul", "But I've been waiting all day!"], ["ox", "You're dead. You've got time."]]);
      anim("back");
      fileAway();
      later(shutDown, 1600);
    } else shutDown();
  }

  // Slam the shutter, then tally up the day.
  function shutDown() {
    S.closing = true;
    shutter(1, 0.45);
    later(() => { shake(3); sfx.thud(); }, REDUCED ? 0 : 450);
    later(endDay, REDUCED ? 300 : 1400);
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
    let arrears = false;
    if (S.notes >= E.dorm) S.notes -= E.dorm;
    else { arrears = true; S.service.arrears++; S.notes = 0; }
    t.summary = { seized, caught, wages, arrears };
    renderFile(); renderBook(); dealPapers(); renderHud();
    renderSpeech([["ox", "Another day, another pile of souls. Go get some sleep. Or whatever it is we do."]]);
    summarySheet();
  }

  function summarySheet() {
    const t = S.today, sm = t.summary, E = D.ECON;
    const cites = t.citations.slice(0, 6).map((c) =>
      `<li><b>${esc(c.name)}</b>: you stamped ${esc(c.got)}, should be ${esc(c.want)}. <span>${esc(c.why)}</span></li>`).join("");
    const more = t.citations.length > 6 ? `<li>…and ${t.citations.length - 6} more.</li>` : "";
    const last = S.day >= D.DAYS.length;
    showSheet(`
      <header class="memo-head"><span>End of day ${S.day}</span><span>${modeCfg().timed ? "17:00" : `${t.filed} souls filed`}</span></header>
      <table class="tally"><tbody>
        <tr><td>Souls filed correctly</td><td class="num">${t.correct}</td><td class="num pos">${signed(t.correct)}</td></tr>
        <tr><td>Clerical errors</td><td class="num">${t.wrong}</td><td class="num neg">${t.wrong ? -t.wrong : 0}</td></tr>
        <tr><td>Bribes accepted</td><td class="num">${t.bribes.length}</td><td class="num neg">${t.bribes.length * E.bribeMerit || 0}</td></tr>
        ${sm.caught ? `<tr><td>Censorate audit! Seized ${sm.seized}B</td><td class="num">${sm.caught}</td><td class="num neg">${sm.caught * E.auditMerit}</td></tr>` : ""}
      </tbody></table>
      ${cites ? `<h3 class="sub">Citations</h3><ul class="cites">${cites}${more}</ul>` : `<p class="clean">No citations. Yama grunted. That's the good grunt.</p>`}
      <h3 class="sub">Wallet (Hell Bank Notes, billions)</h3>
      <table class="tally"><tbody>
        <tr><td>Wages (${E.wage}B per correct filing)</td><td class="num pos">+${sm.wages}B</td></tr>
        ${t.abacus ? `<tr><td>Abacus clerk fees (×${t.abacus})</td><td class="num neg">-${t.abacusSpent}B</td></tr>` : ""}
        <tr><td>Dormitory bunk (shared with three ghosts)${sm.arrears ? `<br><small class="neg">Couldn't pay. Arrears noted, -1 merit.</small>` : ""}</td><td class="num neg">${sm.arrears ? "0B" : `-${E.dorm}B`}</td></tr>
        <tr><td><b>Balance</b></td><td class="num"><b id="bal">${S.notes}B</b></td></tr>
      </tbody></table>
      <div class="shop">
        <div><b>Outsourced sutra chanting</b><br><small>A monk upstairs chants on your behalf. ${E.sutra}B for +${E.sutraMerit} merit. The honest way to buy merit. Also the expensive way.</small></div>
        <button class="btn" data-act="sutra" ${S.notes < E.sutra ? "disabled" : ""}>Buy (${E.sutra}B)</button>
      </div>
      <p class="fine">Rumour in the dormitory: when your own file comes up after Day ${D.DAYS.length}, the Tenth Court's clerks accept "contributions" at ${E.contribRate}B a point.</p>
      <p class="yours">Your own net merit: <b class="num">${signed(netOf(playerRows()))}</b></p>
      <button class="btn primary" data-act="${last ? "ending" : "nextday"}">${last ? "Submit your own file" : "Clock off"}</button>`);
  }

  function ending() {
    S.phase = "ending";
    clearSave();
    const rate = D.ECON.contribRate, k = Math.floor(S.notes / rate);
    if (!k) return verdictSheet();
    showSheet(`
      <header class="memo-head"><span>Your file</span><span>Before judgement</span></header>
      <p>Your file is on a clerk's desk in the Tenth Court. He hasn't opened it yet. He's looking at your wallet.</p>
      <p>"Administrative adjustments" are ${rate}B per point of merit. You have <b>${S.notes}B</b>, enough for <b>+${k} merit</b>.</p>
      <div class="row">
        <button class="btn primary" data-act="contrib-all">Contribute ${k * rate}B (+${k})</button>
        <button class="btn" data-act="contrib-none">Keep my conscience</button>
      </div>
      <p class="fine">Nobody audits the Tenth Court. That's the Tenth Court's position, anyway.</p>`);
  }

  function verdictSheet() {
    const rows = playerRows(), r = verdictFromRows(rows);
    const table = rows.map((d) => `<tr><td>${esc(d.t)}${d.cat ? tagHTML(d.cat) : ""}</td><td class="v ${d.v > 0 ? "pos" : "neg"}">${signed(d.v)}</td></tr>`).join("");
    const verdict = r.v === "rebirth"
      ? `<div class="big-stamp rebirth">Rebirth</div><p>Net merit ${signed(r.net)}. Forwarded to King Zhuanlun. You will be reborn as <b>${esc(tierFor(r.net))}</b></p><p>Meng Po is waiting at the bridge with the soup. You won't remember any of this. Probably for the best.</p>`
      : `<div class="big-stamp">Hell · Court ${r.court}</div><p>Net merit ${signed(r.net)}. Your worst entry: "${esc(r.worst ? r.worst.t : "Did nothing at all")}". Routed to ${D.COURTS[r.court].king}.</p><p>${esc(D.COURTS[r.court].sentence || "")}</p><p>On the bright side, you know exactly how the paperwork works.</p>`;
    const paid = S.service.contrib ? `<p class="fine">The Tenth Court thanks you for your contribution. It has been noted. Nowhere official.</p>` : "";
    showSheet(`
      <header class="memo-head"><span>Book of Life &amp; Death</span><span>Extract: You</span></header>
      <p>Three days are up. Your own file lands on someone else's desk.</p>
      <div class="ledger"><table><tbody>${table}</tbody></table></div>
      ${verdict}${paid}
      <button class="btn primary" data-act="restart">New life, same job</button>`);
  }

  function resetGame() {
    S.day = 1; S.notes = 0; S.today = null;
    S.service = { correct: 0, wrong: 0, bribes: 0, sutras: 0, audits: 0, arrears: 0, contrib: 0 };
    S.whispers = 0;
  }

  // ---------- canvas scene ----------
  const cv = $("#scene"), ctx = cv.getContext("2d");
  const ncv = $("#night"), nctx = ncv.getContext("2d");
  const W = 200, H = 100;
  let g = ctx; // the context R() draws into
  let T = 0, last = performance.now();
  let A = { mode: "none", t0: 0 };          // the soul's current move
  let OX = { mode: "idle", t0: 0 };         // Ox-Head's current reaction
  let SH = { pos: 1, from: 1, to: 1, t0: 0, dur: 0.001 }; // shutter: 0 open, 1 shut
  let shakeAmt = 0, lastSoul = null, nightOn = false, nightT0 = 0;
  const parts = [];

  function anim(mode) { A = { mode, t0: T }; }
  function ox(mode) { OX = { mode, t0: T }; }
  function shutter(to, dur) { SH = { pos: SH.pos, from: SH.pos, to, t0: T, dur: REDUCED ? 0.001 : dur }; }
  function shake(a) { if (!REDUCED) shakeAmt = Math.max(shakeAmt, a); }
  function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
  function spawn(p) { if (!REDUCED && parts.length < 300) { p.max = p.life; parts.push(p); } }

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

  function drawOx(mo) {
    const p = T - OX.t0;
    let dx = 0, dy = 0, look = 0;
    if (OX.mode === "nod" && p < 0.9) dy = Math.sin(p * Math.PI * 4) > 0 ? 2 : 0;
    else if (OX.mode === "shake" && p < 0.9) dx = Math.round(Math.sin(p * Math.PI * 6) * 2);
    else if (OX.mode === "away" && p < 2.6) look = -2;
    const blink = mo && T % 4 < 0.12;
    R(22, 52, 22, 28, "#3a2f4a"); R(22, 64, 22, 2, "#c0392b");
    R(26 + dx, 38 + dy, 14, 13, "#6b4428"); R(28 + dx, 45 + dy, 10, 7, "#a0714a");
    R(30 + dx, 48 + dy, 2, 1, "#2b1d14"); R(34 + dx, 48 + dy, 2, 1, "#2b1d14");
    if (!blink) { R(28 + dx + look, 41 + dy, 2, 2, "#e0a84a"); R(36 + dx + look, 41 + dy, 2, 2, "#e0a84a"); }
    R(23 + dx, 38 + dy, 3, 2, "#e9dcb0"); R(22 + dx, 35 + dy, 2, 3, "#e9dcb0");
    R(40 + dx, 38 + dy, 3, 2, "#e9dcb0"); R(42 + dx, 35 + dy, 2, 3, "#e9dcb0");
    R(47, 22, 1, 58, "#8a7a6a"); R(45, 16, 5, 7, "#c9c9d2"); R(44, 18, 1, 3, "#c9c9d2");
  }

  function drawShutter() {
    const h = Math.round(60 * SH.pos);
    if (h <= 0) return;
    const top = 20, bot = top + h;
    R(59, top, 82, h, "#6b4428");
    for (let y = bot - 7; y > top; y -= 7) R(59, y, 82, 1, "#4a2f1c");
    R(59, bot - 3, 82, 3, "#3d2616");
    if (SH.pos > 0.55) {
      const sy = bot - 30;
      R(88, top, 1, sy - top, "#8a7a6a"); R(111, top, 1, sy - top, "#8a7a6a");
      R(84, sy, 32, 12, "#c0392b"); R(84, sy, 32, 1, "#e0a84a"); R(84, sy + 11, 32, 1, "#e0a84a");
      g.fillStyle = "#f3e9c4"; g.font = "bold 7px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("CLOSED", 100, sy + 6.5);
    }
  }

  // A pixel "?" for confused souls.
  function drawQuestion(x, y) {
    const c = "#e0a84a";
    R(x, y, 4, 1, c); R(x + 3, y + 1, 1, 2, c); R(x + 1, y + 3, 2, 1, c); R(x + 1, y + 4, 1, 1, c); R(x + 1, y + 6, 1, 1, c);
  }

  function drawCurrent(mo) {
    const s = S.soul || lastSoul;
    if (!s) return;
    if (S.soul) lastSoul = S.soul;
    const e = T - A.t0, p = Math.min(1, e / (A.mode === "enter" ? 0.6 : A.mode === "back" ? 1.6 : 1.2));
    let x = 100, y = 82, a = 1, bob = Math.round(Math.sin(T * 2.2) * mo);
    if (A.mode === "enter") {
      const k = 1 - (1 - p) * (1 - p);
      x = 150 - 50 * k; a = Math.min(1, p * 2);
      bob = -Math.round(Math.abs(Math.sin(p * Math.PI * 3)) * 2 * mo);
    } else if (A.mode === "up") {
      const k = p * p;
      y -= 50 * k; a = 1 - k;
      g.globalAlpha = 0.4 * Math.sin(Math.min(1, e / 1.2) * Math.PI); R(86, 0, 28, 80, "#f5e3a1"); R(92, 0, 16, 80, "#fff8dc"); g.globalAlpha = 1;
    } else if (A.mode === "down") {
      const k = p * p;
      y += 44 * k;
      const glow = Math.sin(Math.min(1, e / 1.2) * Math.PI);
      g.globalAlpha = 0.45 * glow; R(59, 40, 82, 40, "#c0392b"); g.globalAlpha = 1;
      if (mo) for (let fx = 60; fx < 140; fx += 3) {
        const fh = Math.round((2 + Math.abs(Math.sin(fx * 1.7 + T * 13)) * 9) * glow);
        R(fx, 80 - fh, 2, fh, fh > 7 ? "#e0a84a" : "#e0574a");
      }
    } else if (A.mode === "back") {
      x = 100 + 70 * p; a = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
      bob = -Math.round(Math.abs(Math.sin(e * Math.PI * 3)) * 2 * mo);
    }
    if (!S.soul && p >= 1) return;
    g.globalAlpha = a * 0.92;
    drawSoul(x, y, s.look, bob);
    if (A.mode === "back" && p < 0.7) drawQuestion(x - 2, y - 50 + bob);
    g.globalAlpha = 1;
  }

  function draw() {
    g = ctx;
    const mo = REDUCED ? 0 : 1;
    const sx = shakeAmt ? Math.round((rand() * 2 - 1) * shakeAmt) : 0, sy = shakeAmt ? Math.round((rand() * 2 - 1) * shakeAmt) : 0;
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    // wall and floor
    R(-4, -4, W + 8, H + 8, "#1d1420");
    for (let x = 8; x < W; x += 16) R(x, 6, 1, 72, "#241a28");
    R(-4, -4, W + 8, 10, "#140e17");
    R(-4, 78, W + 8, 26, "#150e17");
    // the queue, shuffling forward when someone new steps up
    const qp = A.mode === "enter" ? Math.min(1, (T - A.t0) / 0.6) : 1;
    const qs = 8 * (1 - qp);
    for (let i = 0; i < 6; i++) {
      const gx = 148 + i * 8 + qs, gy = 60 + Math.round(Math.sin(T * 1.6 + i * 1.3) * mo);
      g.globalAlpha = 0.3 - i * 0.04;
      R(gx + 1, gy, 5, 5, "#7fd1ae"); R(gx, gy + 5, 7, 13, "#7fd1ae");
      g.globalAlpha = 1;
    }
    // pillars
    [4, 188].forEach((px) => { R(px, 0, 8, 80, "#7d1f18"); R(px + 1, 0, 2, 80, "#c0392b"); R(px - 1, 72, 10, 6, "#5a3a22"); });
    // lanterns, jittering nervously in the last hour
    const late = S.phase === "working" && S.clock >= CLOSE - 60 ? 2.5 : 1;
    [26, 166].forEach((lx, i) => {
      const fl = mo ? 0.5 + 0.5 * Math.sin(T * 7 * late + i * 2) * Math.sin(T * 3.1 * late) : 0.5;
      const sway = mo ? Math.round(Math.sin(T * 1.3 + i) * 0.6) : 0;
      R(lx + 3, 0, 1, 8, "#3a2a2a");
      g.globalAlpha = 0.05 + fl * 0.04; R(lx - 3 + sway, 5, 14, 17, "#e0a84a"); R(lx - 5 + sway, 8, 18, 11, "#e0a84a"); g.globalAlpha = 1;
      R(lx + sway, 8, 8, 10, "#c0392b"); R(lx + 1 + sway, 9, 2, 8, "#e0574a");
      R(lx + sway, 8, 8, 1, "#e0a84a"); R(lx + sway, 17, 8, 1, "#e0a84a"); R(lx + 3 + sway, 18, 2, 4, "#e0a84a");
    });
    // plaque over the window
    R(74, 3, 52, 12, "#2b1d14"); R(74, 3, 52, 1, "#e0a84a"); R(74, 14, 52, 1, "#e0a84a");
    R(74, 3, 1, 12, "#e0a84a"); R(125, 3, 1, 12, "#e0a84a");
    g.fillStyle = "#e0a84a"; g.font = "bold 8px serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("第一殿", 100, 9.5);
    drawOx(mo);
    // the soul, its sparkles or embers, then the shutter
    if (S.soul || A.mode === "up" || A.mode === "down" || A.mode === "back") drawCurrent(mo);
    for (const p of parts) { g.globalAlpha = Math.min(1, (p.life / p.max) * 1.6); R(p.x, p.y, p.s, p.s, p.c); }
    g.globalAlpha = 1;
    drawShutter();
    // window frame and counter
    R(56, 17, 88, 3, "#5a3a22"); R(56, 17, 3, 63, "#5a3a22"); R(141, 17, 3, 63, "#5a3a22");
    R(-4, 80, W + 8, 24, "#4a2f1c"); R(-4, 80, W + 8, 2, "#7a5232");
    for (let x = 6; x < W; x += 23) R(x, 86 + (x % 3), 12, 1, "#3d2616");
    R(150, 76, 20, 4, "#e9dcb0"); R(152, 74, 16, 2, "#d8c890");
    R(36, 77, 10, 3, "#222"); R(120, 75, 5, 5, "#e0a84a"); R(121, 74, 3, 1, "#e0a84a");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------- the dormitory, at night ----------
  function Z(x, y, c) { R(x, y, 4, 1, c); R(x + 2, y + 1, 1, 1, c); R(x + 1, y + 2, 1, 1, c); R(x, y + 3, 4, 1, c); }
  function sleeper(x, y, skin, blanket, len) {
    R(x, y - 6, 7, 6, skin); R(x + 1, y - 3, 2, 1, "#1a1420"); R(x + 4, y - 3, 2, 1, "#1a1420");
    R(x + 7, y - 5, len, 5, blanket); R(x + 7, y - 5, len, 1, "rgba(255,255,255,.15)");
  }
  function drawNight() {
    g = nctx;
    const t = T - nightT0, mo = REDUCED ? 0 : 1;
    R(0, 0, W, H, "#141022"); R(0, 76, W, 24, "#0d0a14");
    for (let x = 10; x < W; x += 20) R(x, 0, 1, 76, "#1a1530");
    // window, stars, and the moon crossing it
    R(128, 12, 46, 32, "#1c2748");
    [[132, 16], [150, 20], [166, 15], [140, 34], [170, 30], [158, 38]].forEach(([x, y], i) => {
      if (!mo || Math.sin(T * 3 + i * 2) > -0.6) R(x, y, 1, 1, "#e8e4ff");
    });
    const mx = 122 + Math.min(1, t / 4.6) * 56;
    nctx.save(); nctx.beginPath(); nctx.rect(128, 12, 46, 32); nctx.clip();
    R(mx, 20, 8, 6, "#f3ecc8"); R(mx + 1, 19, 6, 8, "#f3ecc8"); R(mx + 2, 21, 2, 2, "#d8d0a8");
    nctx.restore();
    ["#3a2a3a"].forEach((c) => { R(126, 10, 50, 2, c); R(126, 44, 50, 2, c); R(126, 10, 2, 36, c); R(174, 10, 2, 36, c); R(150, 12, 1, 32, c); R(128, 27, 46, 1, c); });
    nctx.globalAlpha = 0.03; R(118, 46, 56, 30, "#f3ecc8"); nctx.globalAlpha = 1;
    // bunk bed and sleepers
    R(18, 18, 3, 60, "#5a3a22"); R(98, 18, 3, 60, "#5a3a22");
    R(18, 20, 83, 2, "#5a3a22"); R(18, 44, 83, 3, "#6b4428"); R(18, 70, 83, 3, "#6b4428");
    sleeper(24, 44, "#cfe8dc", "#556070", 30);
    sleeper(62, 44, "#d6e0ea", "#6b4a7a", 30);
    sleeper(24, 70, "#e0dccb", "#c0392b", 66); // you
    sleeper(122, 81, "#c7e0e0", "#4f7a52", 44); // floor-mat roommate
    // an arrow, in case you forgot which one is you
    const by = Math.round(Math.abs(Math.sin(T * 3)) * 2 * mo);
    R(25, 53 - by, 5, 2, "#e0a84a"); R(26, 55 - by, 3, 1, "#e0a84a"); R(27, 56 - by, 1, 1, "#e0a84a");
    // your hell money, stuffed under the bunk
    for (let i = 0; i < Math.min(6, Math.ceil(S.notes / 2)); i++) R(34 + i * 8, 74, 6, 2, i % 2 ? "#c9a646" : "#b8894a");
    // candle on a stool, burning down
    R(106, 66, 10, 10, "#3d2616"); R(109, 60, 3, 6, "#e9dcb0");
    const dim = Math.max(0.3, 1 - t / 6), fl = mo ? Math.sin(T * 9) * 0.5 + 0.5 : 0.5;
    R(110, 57 - Math.round(fl), 1, 3, "#ffd27a");
    nctx.globalAlpha = (0.1 + fl * 0.05) * dim; R(100, 50, 22, 20, "#e0a84a"); nctx.globalAlpha = 1;
    // snoring
    [[30, 34], [68, 34], [128, 70]].forEach(([zx, zy], i) => {
      for (let k = 0; k < (mo ? 2 : 1); k++) {
        const ph = mo ? (T * 0.5 + k * 0.5 + i * 0.33) % 1 : 0.3;
        nctx.globalAlpha = 1 - ph;
        Z(zx + ph * 12, zy - ph * 16, "#7fd1ae");
      }
      nctx.globalAlpha = 1;
    });
    nctx.globalAlpha = Math.min(0.35, t / 12); R(0, 0, W, H, "#000"); nctx.globalAlpha = 1;
    g = ctx;
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now; T += dt;
    if (modeCfg().timed && S.phase === "working" && !S.closing && !S.paused && ($("#overlay").hidden || S.pickingCourt)) {
      S.clock += (dt * (CLOSE - OPEN)) / DAY_SECONDS;
      if (S.clock >= CLOSE) { S.clock = CLOSE; closeWindow(); }
      updateClock();
    }
    stepTyping(dt);
    // shutter easing: gravity on the way down, eased on the way up
    const sp = Math.min(1, (T - SH.t0) / SH.dur);
    SH.pos = SH.from + (SH.to - SH.from) * (SH.to > SH.from ? sp * sp : 1 - (1 - sp) * (1 - sp));
    shakeAmt = Math.max(0, shakeAmt - dt * 10);
    // particles
    const e = T - A.t0;
    if (A.mode === "down" && e < 1) for (let i = 0; i < 2; i++) spawn({ x: 62 + rand() * 76, y: 80, vx: (rand() - 0.5) * 10, vy: -20 - rand() * 35, life: 0.5 + rand() * 0.6, s: rand() < 0.3 ? 2 : 1, c: pick(["#ff6b3d", "#e0a84a", "#c0392b", "#ffd27a"]) });
    if (A.mode === "up" && e < 0.9) spawn({ x: 100 + (rand() - 0.5) * 26, y: 70 - rand() * 30 - e * 40, vx: (rand() - 0.5) * 8, vy: -12 - rand() * 18, life: 0.7 + rand() * 0.4, s: 1, c: pick(["#fff4c2", "#e0a84a", "#ffffff"]) });
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    draw();
    if (nightOn) drawNight();
    requestAnimationFrame(frame);
  }

  // ---------- tooltips: hover on desktop, tap on touch, focus for keyboards ----------
  let tipFor = null, tipPinned = false;
  function tipContent(key) {
    const [kind, id] = key.split(":");
    if (kind === "cat") {
      const c = D.CATS[id], court = D.COURTS[c.court];
      return `<strong>${c.label} → Court ${c.court}</strong><span>${esc(D.CAT_INFO[id])}</span><small>${esc(court.king)}, ${esc(court.dept)}${id === "filial" && dayCfg().filialDouble ? ". Counts double this week." : ""}</small>`;
    }
    if (kind === "court") {
      const court = D.COURTS[id], note = D.KING_NOTES[id];
      return `<strong>Court ${id}: ${esc(court.king)}</strong><span>${esc(court.dept)}.${court.sentence ? " Sentence: " + esc(court.sentence) : ""}</span>${note ? `<small>From the tradition: ${esc(note)}</small>` : ""}`;
    }
    const g = D.GLOSSARY[Number(id)];
    return g ? `<strong>${esc(g.title)}</strong><span>${esc(g.text)}</span>` : "";
  }
  function showTip(el, pinned) {
    const html = tipContent(el.dataset.tip);
    if (!html) return;
    const tip = $("#tip");
    if (tipFor) tipFor.removeAttribute("aria-describedby");
    tip.innerHTML = html; tip.hidden = false;
    tipFor = el; tipPinned = pinned;
    el.setAttribute("aria-describedby", "tip");
    placeTip();
  }
  // Keep the tip on its target; close it only once the target has scrolled out of view.
  function placeTip() {
    if (!tipFor) return;
    const tip = $("#tip"), r = tipFor.getBoundingClientRect(), t = tip.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || (!r.width && !r.height)) return hideTip();
    const left = Math.max(8, Math.min(window.innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2));
    const above = r.top - t.height - 8;
    tip.style.left = left + "px";
    tip.style.top = (above > 8 ? above : r.bottom + 8) + "px";
  }
  function hideTip() {
    if (tipFor) tipFor.removeAttribute("aria-describedby");
    $("#tip").hidden = true; tipFor = null; tipPinned = false;
  }
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse" || tipPinned) return;
    const el = e.target.closest("[data-tip]");
    if (el && el !== tipFor) showTip(el, false);
  });
  document.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse" || tipPinned || !tipFor) return;
    if (!tipFor.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el) {
      if (e.detail) el.blur(); // a mouse or touch click shouldn't leave keyboard focus parked on the term
      if (tipFor === el && tipPinned) hideTip(); else showTip(el, true);
    }
    else if (tipFor) hideTip();
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest && e.target.closest("[data-tip]");
    if (el) showTip(el, false); else if (tipFor && !tipPinned) hideTip();
  });
  window.addEventListener("scroll", placeTip, true);
  window.addEventListener("resize", placeTip);

  // ---------- input ----------
  function courtPicker() {
    if (S.phase !== "working" || !S.soul || S.busy || S.closing) return;
    const btns = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => `
      <button class="court" data-court="${n}"><span class="num">${n}</span><span>${D.COURTS[n].king}</span><small>${D.COURTS[n].dept}</small></button>`).join("");
    showSheet(`<header class="memo-head"><span>Refer to which court?</span><span>Keys 2-9</span></header>
      <div class="courts">${btns}</div>
      <button class="btn" data-act="cancel">Cancel</button>`);
    S.pickingCourt = true;
  }

  $("#b-rebirth").addEventListener("click", () => stamp("rebirth"));
  $("#b-hell").addEventListener("click", courtPicker);
  $("#b-return").addEventListener("click", () => stamp("return"));
  $("#b-bribe").addEventListener("click", takeBribe);
  $("#speech").addEventListener("click", finishTyping);
  $("#btn-pause").addEventListener("click", pause);
  $("#p-book").addEventListener("click", (e) => { if (e.target.closest("[data-abacus]")) useAbacus(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  $("#curtain").addEventListener("click", skipTransition);
  $("#btn-sound").addEventListener("click", () => {
    S.sound = !S.sound;
    $("#btn-sound").textContent = S.sound ? "Sound on" : "Sound off";
    $("#btn-sound").setAttribute("aria-pressed", String(S.sound));
  });

  $("#sheet").addEventListener("click", (e) => {
    const c = e.target.closest("[data-court]");
    if (c) return stamp("hell", Number(c.dataset.court));
    const b = e.target.closest("[data-act]");
    if (!b || curtainBusy) return;
    const act = b.dataset.act;
    if (act === "new") { clearSave(); resetGame(); S.mode = D.MODES[b.dataset.mode] ? b.dataset.mode : "normal"; beginDay(null); }
    else if (act === "continue") {
      const sv = loadSave();
      if (!sv) return titleScreen();
      resetGame(); S.mode = sv.mode; S.day = sv.day; S.notes = sv.notes; S.service = sv.service;
      beginDay(null);
    }
    else if (act === "open") openWindow();
    else if (act === "resume") resume();
    else if (act === "quit") confirmQuit();
    else if (act === "quit-yes") quitToTitle();
    else if (act === "cancel") hideSheet();
    else if (act === "nextday") { const night = nightCaption(); S.day++; beginDay(night); }
    else if (act === "contrib-all") {
      const k = Math.floor(S.notes / D.ECON.contribRate);
      S.service.contrib = (S.service.contrib || 0) + k; S.notes -= k * D.ECON.contribRate;
      sfx.coins(); renderHud(); verdictSheet();
    }
    else if (act === "contrib-none") verdictSheet();
    else if (act === "ending") transition({ night: nightCaption(), title: "Judgement", sub: "Your own file, on someone else's desk", then: ending });
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
    if (curtainBusy) { skipTransition(); e.preventDefault(); return; }
    if (e.key === "Escape" && tipPinned) { hideTip(); e.preventDefault(); return; }
    if (e.key === "Enter" && e.target.closest && e.target.closest("[data-tip]")) {
      showTip(e.target.closest("[data-tip]"), true); e.preventDefault(); return;
    }
    if (S.paused) {
      if (e.key === "p" || e.key === "P" || e.key === "Escape") { resume(); e.preventDefault(); }
      return;
    }
    if (S.pickingCourt) {
      if (/^[2-9]$/.test(e.key)) stamp("hell", Number(e.key));
      else if (e.key === "Escape") hideSheet();
      return;
    }
    if (!$("#overlay").hidden) return;
    if (e.key === "p" || e.key === "P" || e.key === "Escape") pause();
    else if (e.key === "a" || e.key === "A") useAbacus();
    else if (e.key === "1") stamp("rebirth");
    else if (e.key === "2") courtPicker();
    else if (e.key === "3") stamp("return");
    else if (e.key === "b" || e.key === "B") takeBribe();
    else if (e.key === " " && typing) { finishTyping(); e.preventDefault(); }
  });

  // ---------- boot ----------
  renderRules(); renderFile(); renderBook();
  renderSpeech([["ox", "Next!"]]);
  renderHud();
  titleScreen();
  requestAnimationFrame(frame);
})();
