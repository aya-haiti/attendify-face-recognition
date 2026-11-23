/* Attendify — web version.
 * Data: fictitious demo data stored in the browser (localStorage). Nothing is sent to a server.
 * Face recognition: same approach as the original dlib_face_recognition.py
 *   (128-d face descriptor, Euclidean distance, tolerance 0.6, confidence = (1 - distance) * 100)
 *   computed on the visitor's device with face-api.js. Descriptors only, never photos; opt-in consent.
 */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "attendify-demo-v1", FACE_KEY = "attendify-face-profiles-v1";
  const STATUSES = ["Présent", "Retard", "Absent"];
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
  const today = () => new Date().toISOString().slice(0, 10);
  const nowTime = () => new Date().toTimeString().slice(0, 5);

  // ------------------------------------------------------------------ demo data (deterministic, fictitious)
  function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }
  function seed() {
    const r = rng(2025);
    const first = ["Adam", "Salma", "Yassine", "Imane", "Omar", "Hiba", "Mehdi", "Nour", "Hamza", "Sara", "Ilyas", "Meryem", "Anas", "Lina", "Ayoub", "Rania", "Karim", "Zineb", "Reda", "Houda", "Bilal", "Yasmine", "Nabil", "Khadija", "Soufiane", "Aya", "Amine", "Fatima", "Ilham", "Othmane", "Malak", "Walid", "Chaimae", "Hicham", "Asmae", "Taha"];
    const last = ["Alaoui", "Bennani", "Chraibi", "Daoudi", "El Amrani", "Fassi", "Ghali", "Hajji", "Idrissi", "Jabri", "Kettani", "Lahlou", "Mansouri", "Naciri", "Ouazzani", "Rami", "Saidi", "Tazi"];
    const deps = [["GI", "Génie Informatique"], ["DS", "Data Science & IA"], ["GC", "Génie Civil"]];
    const students = [];
    first.forEach((f, i) => {
      const d = deps[i % 3], l = last[Math.floor(r() * last.length)];
      students.push({ id: "ST" + String(25001 + i), name: `${f} ${l}`, gender: i % 2 ? "F" : "M", dep: d[0], year: (i % 2) + 1, semester: "Semestre-1", division: "A",
        email: `${f.toLowerCase()}.${l.toLowerCase().replace(/\s/g, "")}@etu.example.edu`, assiduity: 0.75 + r() * 0.24 });
    });
    const courses = [
      ["C1", "Bases de données", "GI", 1, "Pr. Hajji"], ["C2", "Programmation Java", "GI", 2, "Pr. Tazi"],
      ["C3", "Machine Learning", "DS", 1, "Pr. Naciri"], ["C4", "Deep Learning", "DS", 2, "Pr. Saidi"],
      ["C5", "Résistance des matériaux", "GC", 1, "Pr. Rami"], ["C6", "BIM & CAO", "GC", 2, "Pr. Ghali"]
    ].map(([id, name, dep, year, teacher]) => ({ id, name, dep, year, teacher }));
    const sessions = [], attendance = [];
    const start = new Date(); start.setDate(start.getDate() - 21);
    let sid = 1;
    for (let k = 0; k < 21; k++) {
      const day = new Date(start); day.setDate(start.getDate() + k);
      if ([0, 6].includes(day.getDay())) continue;
      const date = day.toISOString().slice(0, 10);
      courses.forEach((c, ci) => {
        if ((k + ci) % 3 !== 0) return;
        const s = { id: "S" + sid++, courseId: c.id, date, start: ["08:30", "10:30", "14:00"][ci % 3], status: "closed" };
        sessions.push(s);
        roster(students, c).forEach((st) => {
          const x = r(), status = x < st.assiduity ? "Présent" : x < st.assiduity + 0.06 ? "Retard" : "Absent";
          attendance.push({ sessionId: s.id, studentId: st.id, status, time: status === "Absent" ? "" : s.start, method: "manuel" });
        });
      });
    }
    // one open session today for live marking
    sessions.push({ id: "S" + sid++, courseId: "C3", date: today(), start: "10:30", status: "open" });
    students.forEach((s) => delete s.assiduity);
    return { students, courses, sessions, attendance };
  }
  const roster = (students, course) => students.filter((s) => s.dep === course.dep && Number(s.year) === Number(course.year));

  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* private mode */ } };
  save();

  const course = (id) => db.courses.find((c) => c.id === id);
  const student = (id) => db.students.find((s) => s.id === id);
  const depName = { GI: "Génie Informatique", DS: "Data Science & IA", GC: "Génie Civil" };
  const colour = (id) => `hsl(${[...id].reduce((a, c) => a + c.charCodeAt(0), 0) * 47 % 360} 55% 45%)`;
  const initials = (n) => n.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const avatar = (s) => `<span class="avatar" style="background:${colour(s.id)}" aria-hidden="true">${esc(initials(s.name))}</span>`;
  function rateOf(records) {
    if (!records.length) return null;
    return records.filter((a) => a.status !== "Absent").length / records.length;
  }
  const pct = (x) => (x == null ? "—" : Math.round(x * 100) + " %");

  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600); }
  function mark(sessionId, studentId, status, method = "manuel") {
    let rec = db.attendance.find((a) => a.sessionId === sessionId && a.studentId === studentId);
    if (!rec) { rec = { sessionId, studentId }; db.attendance.push(rec); }
    rec.status = status; rec.time = status === "Absent" ? "" : nowTime(); rec.method = method;
    save();
  }

  // ------------------------------------------------------------------ views
  const views = {
    dashboard() {
      const closed = db.sessions.filter((s) => s.status === "closed");
      const recs = db.attendance.filter((a) => closed.some((s) => s.id === a.sessionId));
      const last7 = new Date(); last7.setDate(last7.getDate() - 7);
      const recent = recs.filter((a) => db.sessions.find((s) => s.id === a.sessionId).date >= last7.toISOString().slice(0, 10));
      const open = db.sessions.filter((s) => s.status === "open");
      const byCourse = db.courses.map((c) => ({ c, rate: rateOf(recs.filter((a) => db.sessions.find((s) => s.id === a.sessionId).courseId === c.id)) }));
      const atRisk = db.students.map((s) => ({ s, rate: rateOf(recs.filter((a) => a.studentId === s.id)) })).filter((x) => x.rate != null && x.rate < 0.8).sort((a, b) => a.rate - b.rate).slice(0, 6);
      return `
      <div class="head"><div><h1>Tableau de bord</h1><p class="sub">Vue d'ensemble des présences (données de démonstration).</p></div>
        <a class="btn" href="#/sessions">+ Nouvelle séance</a></div>
      <div class="kpis">
        <div class="kpi"><b>${db.students.length}</b><span>étudiants</span></div>
        <div class="kpi"><b>${closed.length}</b><span>séances clôturées</span></div>
        <div class="kpi"><b>${pct(rateOf(recs))}</b><span>taux de présence global</span></div>
        <div class="kpi"><b>${pct(rateOf(recent))}</b><span>présence sur 7 jours</span></div>
      </div>
      ${open.length ? `<div class="card"><h2>Séances ouvertes</h2><ul class="list">${open.map((s) => `<li><span><b>${esc(course(s.courseId).name)}</b> · ${fmtDate(s.date)} ${s.start}</span><a class="btn sm" href="#/session/${s.id}">Faire l'appel</a></li>`).join("")}</ul></div>` : ""}
      <div class="grid2">
        <div class="card"><h2>Présence par cours</h2><div class="bars">${byCourse.map(({ c, rate }) => `<div class="bar"><span>${esc(c.name)}</span><div class="track"><div class="fill ${rate != null && rate < 0.8 ? "low" : ""}" style="width:${(rate || 0) * 100}%"></div></div><span>${pct(rate)}</span></div>`).join("")}</div></div>
        <div class="card"><h2>Étudiants à suivre (&lt; 80 %)</h2>${atRisk.length ? `<ul class="list">${atRisk.map(({ s, rate }) => `<li><span>${avatar(s)}${esc(s.name)} <span class="sub">· ${s.dep} ${s.year}A</span></span><b style="color:var(--bad)">${pct(rate)}</b></li>`).join("")}</ul>` : '<p class="empty">Aucun étudiant sous le seuil.</p>'}</div>
      </div>`;
    },

    sessions() {
      const list = [...db.sessions].sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
      return `
      <div class="head"><div><h1>Séances</h1><p class="sub">Créez une séance, puis faites l'appel manuellement ou par reconnaissance faciale.</p></div>
        <button class="btn" id="new-session">+ Nouvelle séance</button></div>
      <div class="card"><div class="tablewrap"><table><thead><tr><th>Date</th><th>Heure</th><th>Cours</th><th>Filière</th><th>Présence</th><th>État</th><th></th></tr></thead><tbody>
      ${list.map((s) => { const c = course(s.courseId), recs = db.attendance.filter((a) => a.sessionId === s.id);
        return `<tr><td>${fmtDate(s.date)}</td><td>${s.start}</td><td><b>${esc(c.name)}</b></td><td>${c.dep} · ${c.year}A</td><td>${recs.length ? pct(rateOf(recs)) : "—"}</td><td><span class="badge ${s.status}">${s.status === "open" ? "ouverte" : "clôturée"}</span></td><td><a class="btn sm ghost" href="#/session/${s.id}">${s.status === "open" ? "Faire l'appel" : "Voir"}</a></td></tr>`; }).join("")}
      </tbody></table></div></div>`;
    },

    session(id) {
      const s = db.sessions.find((x) => x.id === id);
      if (!s) return `<p class="empty">Séance introuvable.</p>`;
      const c = course(s.courseId), list = roster(db.students, c);
      const recOf = (st) => db.attendance.find((a) => a.sessionId === s.id && a.studentId === st.id);
      const marked = list.filter((st) => recOf(st)).length;
      const editable = s.status === "open";
      return `
      <div class="head"><div><h1>${esc(c.name)}</h1><p class="sub">${fmtDate(s.date)} · ${s.start} · ${depName[c.dep]} ${c.year}ᵉ année · ${esc(c.teacher)}</p></div>
        <div class="toolbar" style="margin:0">${editable ? `<button class="btn ghost" id="all-present">Tous présents</button><a class="btn ghost" href="#/face?session=${s.id}">🙂 Pointage par visage</a><button class="btn" id="close-session">Clôturer la séance</button>` : `<button class="btn ghost" id="reopen">Rouvrir</button>`}</div></div>
      <div class="notice info">${marked} / ${list.length} étudiants pointés · taux actuel ${pct(rateOf(db.attendance.filter((a) => a.sessionId === s.id)))}</div>
      <div class="card"><div class="toolbar"><input type="search" id="q" placeholder="Rechercher un étudiant" aria-label="Rechercher un étudiant"></div>
      <div class="tablewrap"><table><thead><tr><th>Étudiant</th><th>ID</th><th>Statut</th><th>Heure</th><th>Méthode</th></tr></thead><tbody id="roster">
      ${list.map((st) => { const r = recOf(st);
        return `<tr data-name="${esc(st.name.toLowerCase())} ${st.id.toLowerCase()}"><td>${avatar(st)}${esc(st.name)}</td><td>${st.id}</td><td>${editable
          ? `<div class="seg" role="group" aria-label="Statut de ${esc(st.name)}">${STATUSES.map((x) => `<button type="button" data-s="${x}" data-st="${st.id}" aria-pressed="${r?.status === x}">${x}</button>`).join("")}</div>`
          : r ? `<span class="badge ${r.status}">${r.status}</span>` : "—"}</td><td>${r?.time || "—"}</td><td>${r ? (r.method === "visage" ? "🙂 visage" : "manuel") : "—"}</td></tr>`; }).join("")}
      </tbody></table></div></div>`;
    },

    students() {
      return `
      <div class="head"><div><h1>Étudiants</h1><p class="sub">Profils fictifs — aucune photo n'est stockée.</p></div><button class="btn" id="add-student">+ Ajouter</button></div>
      <div class="card"><div class="toolbar">
        <input type="search" id="q" placeholder="Nom, ID ou e-mail" aria-label="Rechercher">
        <select id="f-dep" aria-label="Filière"><option value="">Toutes les filières</option>${Object.entries(depName).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <select id="f-year" aria-label="Année"><option value="">Toutes les années</option><option value="1">1ʳᵉ année</option><option value="2">2ᵉ année</option></select>
      </div><div class="tablewrap"><table><thead><tr><th>Étudiant</th><th>ID</th><th>Filière</th><th>Année</th><th>E-mail</th><th class="n">Présence</th><th></th></tr></thead><tbody id="tbody"></tbody></table></div><p class="sub" id="count"></p></div>`;
    },

    history() {
      return `
      <div class="head"><div><h1>Historique des présences</h1><p class="sub">Toutes les séances, filtrables et exportables en CSV (même format que l'application d'origine).</p></div><button class="btn ghost" id="export">⬇ Export CSV</button></div>
      <div class="card"><div class="toolbar">
        <input type="search" id="q" placeholder="Étudiant ou ID" aria-label="Rechercher">
        <select id="f-course" aria-label="Cours"><option value="">Tous les cours</option>${db.courses.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
        <select id="f-status" aria-label="Statut"><option value="">Tous les statuts</option>${STATUSES.map((s) => `<option>${s}</option>`).join("")}</select>
        <input type="date" id="f-from" aria-label="Depuis"><input type="date" id="f-to" aria-label="Jusqu'au">
      </div><div class="tablewrap"><table><thead><tr><th>Date</th><th>Cours</th><th>Étudiant</th><th>ID</th><th>Statut</th><th>Heure</th><th>Méthode</th></tr></thead><tbody id="tbody"></tbody></table></div><p class="sub" id="count"></p></div>`;
    },

    reports() {
      const closed = new Set(db.sessions.filter((s) => s.status === "closed").map((s) => s.id));
      const recs = db.attendance.filter((a) => closed.has(a.sessionId));
      const perStudent = db.students.map((s) => { const r = recs.filter((a) => a.studentId === s.id);
        return { s, n: r.length, p: r.filter((a) => a.status === "Présent").length, l: r.filter((a) => a.status === "Retard").length, a: r.filter((a) => a.status === "Absent").length, rate: rateOf(r) }; }).sort((x, y) => (x.rate ?? 1) - (y.rate ?? 1));
      const byDep = Object.keys(depName).map((d) => ({ d, rate: rateOf(recs.filter((a) => student(a.studentId)?.dep === d)) }));
      const totals = STATUSES.map((st) => ({ st, n: recs.filter((a) => a.status === st).length }));
      return `
      <div class="head"><div><h1>Rapports</h1><p class="sub">Calculés à partir des séances clôturées.</p></div></div>
      <div class="kpis">${totals.map((t) => `<div class="kpi"><b>${t.n}</b><span>${t.st.toLowerCase()}s</span></div>`).join("")}<div class="kpi"><b>${perStudent.filter((x) => x.rate != null && x.rate < 0.8).length}</b><span>étudiants &lt; 80 %</span></div></div>
      <div class="grid2"><div class="card"><h2>Assiduité par étudiant</h2><div class="tablewrap"><table><thead><tr><th>Étudiant</th><th class="n">Séances</th><th class="n">Présent</th><th class="n">Retard</th><th class="n">Absent</th><th class="n">Taux</th></tr></thead><tbody>
        ${perStudent.map((x) => `<tr><td>${esc(x.s.name)}</td><td class="n">${x.n}</td><td class="n">${x.p}</td><td class="n">${x.l}</td><td class="n">${x.a}</td><td class="n" style="${x.rate != null && x.rate < 0.8 ? "color:var(--bad);font-weight:700" : ""}">${pct(x.rate)}</td></tr>`).join("")}
      </tbody></table></div></div>
      <div class="card"><h2>Présence par filière</h2><div class="bars">${byDep.map(({ d, rate }) => `<div class="bar"><span>${depName[d]}</span><div class="track"><div class="fill" style="width:${(rate || 0) * 100}%"></div></div><span>${pct(rate)}</span></div>`).join("")}</div>
        <p class="sub" style="margin-top:14px">Un retard compte comme une présence dans le taux, comme dans l'application d'origine (statut « Present » à l'enregistrement).</p></div></div>`;
    },

    face(params) {
      const sessionId = params.get("session");
      const s = sessionId && db.sessions.find((x) => x.id === sessionId && x.status === "open");
      return `
      <div class="head"><div><h1>Reconnaissance faciale</h1><p class="sub">${s ? `Pointage pour <b>${esc(course(s.courseId).name)}</b> — ${fmtDate(s.date)} ${s.start}` : "Enregistrez votre visage sur un profil de démonstration, puis testez la reconnaissance."}</p></div>${s ? `<a class="btn ghost" href="#/session/${s.id}">← Retour à l'appel</a>` : ""}</div>
      <div class="notice info"><b>Comment ça marche.</b> Comme le module <code>dlib_face_recognition.py</code> de l'application d'origine, chaque visage est converti en une signature de 128 nombres, comparée par distance euclidienne (tolérance 0,6 ; confiance = (1 − distance) × 100). Ici le calcul est fait <b>sur votre appareil</b> par face-api.js : aucune image ni signature n'est envoyée à un serveur. Les étudiants de la démo sont fictifs et n'ont pas de visage enregistré : seul le vôtre peut l'être, avec votre accord.</div>
      <div class="grid2">
        <div class="card">
          <div class="cam" id="cam"><video id="video" playsinline muted></video><canvas id="overlay"></canvas></div>
          <p class="sub" id="cam-status" role="status">Caméra arrêtée.</p>
          <div class="toolbar" style="margin-top:8px"><button class="btn" id="start-cam">Activer la caméra</button><button class="btn ghost" id="stop-cam" disabled>Arrêter</button></div>
        </div>
        <div>
          <div class="card" id="consent-card">
            <h2>1. Consentement</h2>
            <label class="checkbox"><input type="checkbox" id="consent"> J'accepte que mon visage soit analysé localement dans ce navigateur pour créer une signature biométrique temporaire. Je peux la supprimer à tout moment.</label>
            <label class="checkbox"><input type="checkbox" id="remember"> Conserver la signature sur cet appareil (sinon elle est effacée à la fermeture de l'onglet).</label>
          </div>
          <div class="card"><h2>2. Enregistrer mon visage</h2>
            <label for="enroll-student">Profil de démonstration</label>
            <select id="enroll-student">${db.students.map((st) => `<option value="${st.id}">${esc(st.name)} (${st.id})</option>`).join("")}</select>
            <div class="toolbar" style="margin-top:10px"><button class="btn" id="enroll" disabled>Capturer 3 échantillons</button></div>
            <ul class="list" id="profiles"></ul>
          </div>
          <div class="card"><h2>3. ${s ? "Pointer la présence" : "Tester la reconnaissance"}</h2>
            <button class="btn" id="recognize" disabled>${s ? "Reconnaître et pointer" : "Reconnaître"}</button>
            <div id="result" style="margin-top:10px" aria-live="polite"></div>
          </div>
        </div>
      </div>`;
    }
  };

  // ------------------------------------------------------------------ behaviours per view
  const after = {
    sessions() {
      $("#new-session").onclick = () => dialog(`
        <h2>Nouvelle séance</h2>
        <label for="d-course">Cours</label><select id="d-course" required>${db.courses.map((c) => `<option value="${c.id}">${esc(c.name)} — ${c.dep} ${c.year}A</option>`).join("")}</select>
        <div class="form-grid"><div><label for="d-date">Date</label><input type="date" id="d-date" value="${today()}" required></div><div><label for="d-start">Heure</label><input type="time" id="d-start" value="${nowTime()}" required></div></div>`,
        () => { const s = { id: "S" + Date.now(), courseId: $("#d-course").value, date: $("#d-date").value, start: $("#d-start").value, status: "open" };
          db.sessions.push(s); save(); location.hash = "#/session/" + s.id; toast("Séance créée."); });
    },
    session(id) {
      const s = db.sessions.find((x) => x.id === id); if (!s) return;
      $$("[data-s]").forEach((b) => b.onclick = () => { mark(s.id, b.dataset.st, b.dataset.s); render(); });
      $("#q")?.addEventListener("input", (e) => { const q = e.target.value.toLowerCase(); $$("#roster tr").forEach((tr) => tr.hidden = !tr.dataset.name.includes(q)); });
      $("#all-present")?.addEventListener("click", () => { roster(db.students, course(s.courseId)).forEach((st) => { if (!db.attendance.find((a) => a.sessionId === s.id && a.studentId === st.id)) mark(s.id, st.id, "Présent"); }); render(); toast("Étudiants non pointés marqués présents."); });
      $("#close-session")?.addEventListener("click", () => {
        roster(db.students, course(s.courseId)).forEach((st) => { if (!db.attendance.find((a) => a.sessionId === s.id && a.studentId === st.id)) mark(s.id, st.id, "Absent"); });
        s.status = "closed"; save(); render(); toast("Séance clôturée : les non-pointés sont marqués absents.");
      });
      $("#reopen")?.addEventListener("click", () => { s.status = "open"; save(); render(); });
    },
    students() {
      const draw = () => {
        const q = $("#q").value.toLowerCase(), dep = $("#f-dep").value, year = $("#f-year").value;
        const list = db.students.filter((s) => (s.name + s.id + s.email).toLowerCase().includes(q) && (!dep || s.dep === dep) && (!year || String(s.year) === year));
        $("#tbody").innerHTML = list.map((s) => `<tr><td>${avatar(s)}${esc(s.name)}</td><td>${s.id}</td><td>${depName[s.dep]}</td><td>${s.year}ᵉ</td><td>${esc(s.email)}</td><td class="n">${pct(rateOf(db.attendance.filter((a) => a.studentId === s.id)))}</td>
          <td><button class="btn sm ghost" data-edit="${s.id}">Modifier</button> <button class="btn sm ghost" data-del="${s.id}" aria-label="Supprimer ${esc(s.name)}">Supprimer</button></td></tr>`).join("") || `<tr><td colspan="7" class="empty">Aucun étudiant ne correspond.</td></tr>`;
        $("#count").textContent = `${list.length} étudiant(s)`;
        $$("[data-edit]").forEach((b) => b.onclick = () => studentForm(student(b.dataset.edit)));
        $$("[data-del]").forEach((b) => b.onclick = () => { if (!confirm("Supprimer cet étudiant fictif et ses présences ?")) return;
          db.students = db.students.filter((s) => s.id !== b.dataset.del); db.attendance = db.attendance.filter((a) => a.studentId !== b.dataset.del); save(); draw(); toast("Étudiant supprimé."); });
      };
      ["#q", "#f-dep", "#f-year"].forEach((s) => $(s).addEventListener("input", draw));
      $("#add-student").onclick = () => studentForm(null);
      draw();
    },
    history() {
      const rows = () => {
        const q = $("#q").value.toLowerCase(), c = $("#f-course").value, st = $("#f-status").value, from = $("#f-from").value, to = $("#f-to").value;
        return db.attendance.map((a) => ({ a, s: db.sessions.find((x) => x.id === a.sessionId), p: student(a.studentId) }))
          .filter(({ a, s, p }) => s && p && (!c || s.courseId === c) && (!st || a.status === st) && (!from || s.date >= from) && (!to || s.date <= to) && (p.name + p.id).toLowerCase().includes(q))
          .sort((x, y) => (y.s.date + y.s.start).localeCompare(x.s.date + x.s.start));
      };
      const draw = () => { const r = rows();
        $("#tbody").innerHTML = r.slice(0, 300).map(({ a, s, p }) => `<tr><td>${fmtDate(s.date)}</td><td>${esc(course(s.courseId).name)}</td><td>${esc(p.name)}</td><td>${p.id}</td><td><span class="badge ${a.status}">${a.status}</span></td><td>${a.time || "—"}</td><td>${a.method === "visage" ? "🙂 visage" : "manuel"}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">Aucun enregistrement.</td></tr>`;
        $("#count").textContent = `${r.length} enregistrement(s)${r.length > 300 ? " — 300 premiers affichés, l'export contient tout" : ""}`; };
      ["#q", "#f-course", "#f-status", "#f-from", "#f-to"].forEach((s) => $(s).addEventListener("input", draw));
      $("#export").onclick = () => {
        // Same columns as attendmodify.py: id, gender, name, dep, course, year, time, date, status
        const csv = ["Student_id,Gender,Name,Departement,Course,Year,Time,Date,AttendanceStatus"].concat(rows().map(({ a, s, p }) =>
          [p.id, p.gender, p.name, p.dep, course(s.courseId).name, p.year, a.time, s.date, a.status].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))).join("\n");
        const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
        const link = Object.assign(document.createElement("a"), { href: url, download: `attendance_${today()}.csv` }); link.click(); URL.revokeObjectURL(url);
        toast("Export CSV téléchargé.");
      };
      draw();
    },
    face(params) { Face.mount(params.get("session")); }
  };

  function studentForm(s) {
    const isNew = !s; s = s || { id: "", name: "", gender: "F", dep: "GI", year: 1, semester: "Semestre-1", division: "A", email: "" };
    dialog(`<h2>${isNew ? "Ajouter un étudiant" : "Modifier l'étudiant"}</h2>
      <div class="form-grid">
        <div><label for="d-id">ID étudiant</label><input id="d-id" value="${esc(s.id)}" ${isNew ? "" : "readonly"} required pattern="[A-Za-z0-9]{3,12}"></div>
        <div><label for="d-name">Nom complet</label><input id="d-name" value="${esc(s.name)}" required></div>
        <div><label for="d-dep">Filière</label><select id="d-dep">${Object.entries(depName).map(([k, v]) => `<option value="${k}" ${s.dep === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div><label for="d-year">Année</label><select id="d-year"><option value="1" ${s.year == 1 ? "selected" : ""}>1ʳᵉ année</option><option value="2" ${s.year == 2 ? "selected" : ""}>2ᵉ année</option></select></div>
        <div><label for="d-gender">Genre</label><select id="d-gender"><option ${s.gender === "F" ? "selected" : ""}>F</option><option ${s.gender === "M" ? "selected" : ""}>M</option></select></div>
        <div><label for="d-email">E-mail (fictif)</label><input id="d-email" type="email" value="${esc(s.email)}"></div>
      </div>`, () => {
      const id = $("#d-id").value.trim(), name = $("#d-name").value.trim();
      if (!/^[A-Za-z0-9]{3,12}$/.test(id) || !name) { toast("ID (3 à 12 caractères alphanumériques) et nom obligatoires."); return false; }
      if (isNew && student(id)) { toast("Cet ID existe déjà."); return false; }
      Object.assign(s, { id, name, dep: $("#d-dep").value, year: Number($("#d-year").value), gender: $("#d-gender").value, email: $("#d-email").value.trim() });
      if (isNew) db.students.push(s);
      save(); render(); toast(isNew ? "Étudiant ajouté." : "Étudiant modifié.");
    });
  }

  function dialog(html, onOk) {
    const d = $("#dlg"), f = $("#dlg-form");
    f.innerHTML = html + `<div class="dlg-actions"><button class="btn ghost" value="cancel" formnovalidate>Annuler</button><button class="btn" value="ok">Enregistrer</button></div>`;
    f.onsubmit = (e) => { if (e.submitter?.value === "ok") { if (!f.checkValidity()) { e.preventDefault(); f.reportValidity(); return; } if (onOk() === false) e.preventDefault(); } };
    d.showModal();
  }

  // ------------------------------------------------------------------ face recognition (on-device)
  const Face = (() => {
    const LIB = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.js";
    const MODELS = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model";
    const TOLERANCE = 0.6;                       // same as recognize_faces(tolerance=0.6)
    let ready = null, stream = null, loop = null, sessionId = null;
    let profiles = loadProfiles();                // [{studentId, descriptors:[[128]]}]

    function loadProfiles() { try { return JSON.parse(localStorage.getItem(FACE_KEY) || sessionStorage.getItem(FACE_KEY)) || []; } catch { return []; } }
    function storeProfiles() {
      const data = JSON.stringify(profiles);
      try { if ($("#remember")?.checked) { localStorage.setItem(FACE_KEY, data); sessionStorage.removeItem(FACE_KEY); } else { sessionStorage.setItem(FACE_KEY, data); localStorage.removeItem(FACE_KEY); } } catch { /* storage unavailable: memory only */ }
    }
    function loadLib() {
      if (ready) return ready;
      ready = new Promise((res, rej) => { const s = document.createElement("script"); s.src = LIB; s.crossOrigin = "anonymous"; s.onload = res; s.onerror = () => rej(new Error("Impossible de charger face-api.js")); document.head.appendChild(s); })
        .then(() => Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(MODELS), faceapi.nets.faceLandmark68Net.loadFromUri(MODELS), faceapi.nets.faceRecognitionNet.loadFromUri(MODELS)]));
      ready.catch(() => { ready = null; });
      return ready;
    }
    const status = (t) => { const el = $("#cam-status"); if (el) el.textContent = t; };
    const opts = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    async function detect() {
      const v = $("#video");
      return faceapi.detectSingleFace(v, opts()).withFaceLandmarks().withFaceDescriptor();
    }
    function bestMatch(descriptor) {
      let best = { studentId: null, distance: Infinity };
      for (const p of profiles) for (const d of p.descriptors) {
        const dist = faceapi.euclideanDistance(descriptor, d);
        if (dist < best.distance) best = { studentId: p.studentId, distance: dist };
      }
      const confidence = Math.max(0, Math.min(100, Math.round((1 - best.distance) * 100)));
      return { ...best, confidence, match: best.distance <= TOLERANCE };
    }
    async function start() {
      if (!$("#consent").checked) { toast("Cochez d'abord la case de consentement."); $("#consent").focus(); return; }
      if (!navigator.mediaDevices?.getUserMedia) { status("Caméra non disponible dans ce navigateur."); return; }
      try {
        status("Chargement des modèles (≈ 7 Mo, une seule fois)…");
        await loadLib();
        status("Demande d'accès à la caméra…");
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
        const v = $("#video"); v.srcObject = stream; await v.play();
        status("Caméra active — placez votre visage face à l'écran.");
        $("#start-cam").disabled = true; $("#stop-cam").disabled = false; $("#enroll").disabled = false; $("#recognize").disabled = !profiles.length;
        overlayLoop();
      } catch (e) { status(e.name === "NotAllowedError" ? "Accès à la caméra refusé." : "Erreur : " + e.message); stop(); }
    }
    function overlayLoop() {
      const v = $("#video"), c = $("#overlay"); if (!v || !c) return;
      clearInterval(loop);
      loop = setInterval(async () => {
        if (!stream || v.readyState < 2) return;
        const det = await faceapi.detectSingleFace(v, opts());
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext("2d"); ctx.clearRect(0, 0, c.width, c.height);
        if (det) { const b = det.box; ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 3; ctx.strokeRect(b.x, b.y, b.width, b.height); }
      }, 300);
    }
    function stop() {
      clearInterval(loop); loop = null;
      stream?.getTracks().forEach((t) => t.stop()); stream = null;
      const v = $("#video"); if (v) v.srcObject = null;
      if ($("#start-cam")) { $("#start-cam").disabled = false; $("#stop-cam").disabled = true; $("#enroll").disabled = true; $("#recognize").disabled = true; status("Caméra arrêtée."); }
    }
    async function enroll() {
      const id = $("#enroll-student").value, samples = [];
      $("#enroll").disabled = true;
      for (let i = 1; i <= 3; i++) {
        status(`Échantillon ${i}/3 — bougez légèrement la tête…`);
        await new Promise((r) => setTimeout(r, 700));
        const res = await detect();
        if (!res) { status("Aucun visage détecté. Réessayez avec plus de lumière."); $("#enroll").disabled = false; return; }
        samples.push(Array.from(res.descriptor));
      }
      profiles = profiles.filter((p) => p.studentId !== id).concat({ studentId: id, descriptors: samples, created: new Date().toISOString() });
      storeProfiles(); drawProfiles();
      status("Visage enregistré : 3 signatures de 128 valeurs (aucune image conservée).");
      $("#enroll").disabled = false; $("#recognize").disabled = false;
      toast("Signature faciale enregistrée localement.");
    }
    async function recognize() {
      const res = await detect();
      const out = $("#result");
      if (!res) { out.innerHTML = '<div class="notice warn">Aucun visage détecté.</div>'; return; }
      const m = bestMatch(res.descriptor), st = m.studentId && student(m.studentId);
      if (!m.match || !st) { out.innerHTML = `<div class="notice warn">Visage inconnu (distance ${isFinite(m.distance) ? m.distance.toFixed(2) : "—"} &gt; ${TOLERANCE}). Aucune présence enregistrée.</div>`; return; }
      let extra = "";
      if (sessionId) {
        const s = db.sessions.find((x) => x.id === sessionId);
        const inRoster = s && roster(db.students, course(s.courseId)).some((x) => x.id === st.id);
        if (!inRoster) extra = `<br>⚠ ${esc(st.name)} n'est pas inscrit(e) à ce cours : présence non enregistrée.`;
        else {
          const [h, mi] = s.start.split(":").map(Number), late = (new Date().getHours() * 60 + new Date().getMinutes()) > h * 60 + mi + 15 && s.date === today();
          mark(s.id, st.id, late ? "Retard" : "Présent", "visage");
          extra = `<br>✅ Présence enregistrée : <b>${late ? "Retard" : "Présent"}</b> à ${nowTime()}.`;
        }
      }
      out.innerHTML = `<div class="notice ok">${avatar(st)}<b>${esc(st.name)}</b> (${st.id}) — confiance ${m.confidence} % · distance ${m.distance.toFixed(2)} ≤ ${TOLERANCE}${extra}</div>`;
    }
    function drawProfiles() {
      const ul = $("#profiles"); if (!ul) return;
      ul.innerHTML = profiles.length ? profiles.map((p) => `<li><span>🙂 ${esc(student(p.studentId)?.name || p.studentId)} · ${p.descriptors.length} signatures</span><button class="btn sm ghost" data-forget="${p.studentId}">Supprimer</button></li>`).join("")
        + `<li><span class="sub">Stockage : ${localStorage.getItem(FACE_KEY) ? "cet appareil" : "cet onglet uniquement"}</span><button class="btn sm danger" id="forget-all">Tout supprimer</button></li>` : '<li><span class="sub">Aucune signature enregistrée.</span></li>';
      $$("[data-forget]").forEach((b) => b.onclick = () => { profiles = profiles.filter((p) => p.studentId !== b.dataset.forget); storeProfiles(); drawProfiles(); toast("Signature supprimée."); });
      $("#forget-all")?.addEventListener("click", () => { profiles = []; try { localStorage.removeItem(FACE_KEY); sessionStorage.removeItem(FACE_KEY); } catch { } drawProfiles(); $("#recognize").disabled = true; toast("Toutes les signatures ont été supprimées."); });
    }
    function mount(sid) {
      sessionId = sid;
      $("#remember").checked = !!localStorage.getItem(FACE_KEY);
      $("#start-cam").onclick = start; $("#stop-cam").onclick = stop; $("#enroll").onclick = enroll; $("#recognize").onclick = recognize;
      $("#remember").onchange = storeProfiles;
      drawProfiles();
    }
    return { mount, stop, bestMatchForTest: (d, p) => { const save = profiles; profiles = p; const r = bestMatch(d); profiles = save; return r; } };
  })();
  window.__attendifyFace = Face; // exposed for automated tests

  // ------------------------------------------------------------------ router
  function render() {
    Face.stop();
    const [path, query] = (location.hash.slice(2) || "dashboard").split("?");
    const [route, arg] = path.split("/");
    const params = new URLSearchParams(query || "");
    const view = views[route] ? route : "dashboard";
    $$("nav a").forEach((a) => a.setAttribute("aria-current", a.dataset.route === (view === "session" ? "sessions" : view) ? "page" : "false"));
    $("#view").innerHTML = views[view](view === "face" ? params : arg);
    (after[view] || (() => {}))(view === "face" ? params : arg);
    document.title = `Attendify · ${({ dashboard: "Tableau de bord", sessions: "Séances", session: "Appel", students: "Étudiants", history: "Historique", reports: "Rapports", face: "Reconnaissance" })[view]}`;
  }
  window.addEventListener("hashchange", () => { render(); $("#view").focus({ preventScroll: true }); window.scrollTo(0, 0); });
  $("#reset").onclick = () => { if (confirm("Réinitialiser toutes les données de démonstration ?")) { db = seed(); save(); render(); toast("Démo réinitialisée."); } };
  render();
})();
