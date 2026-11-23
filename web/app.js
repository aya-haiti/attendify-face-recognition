/* Attendify — web version (UI). Face engine: face.js (on-device, same method as dlib_face_recognition.py).
 * Demo data is fictitious and stored only in this browser. Biometric references are stored per student ID,
 * on this device only, after explicit consent; seeded fictitious students never have a face reference.
 */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const F = window.AttendifyFace;
  const KEY = "attendify-demo-v2";
  const STATUSES = ["Présent", "Retard", "Absent"];
  const depName = { GI: "Génie Informatique", DS: "Data Science & IA", GC: "Génie Civil" };
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
  const today = () => new Date().toISOString().slice(0, 10);
  const nowTime = () => new Date().toTimeString().slice(0, 5);

  // ------------------------------------------------------------------ demo data
  function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }
  function seed() {
    const r = rng(2025);
    const first = ["Adam", "Salma", "Yassine", "Imane", "Omar", "Hiba", "Mehdi", "Nour", "Hamza", "Sara", "Ilyas", "Meryem", "Anas", "Lina", "Ayoub", "Rania", "Karim", "Zineb", "Reda", "Houda", "Bilal", "Yasmine", "Nabil", "Khadija", "Soufiane", "Aya", "Amine", "Fatima", "Ilham", "Othmane", "Malak", "Walid", "Chaimae", "Hicham", "Asmae", "Taha"];
    const last = ["Alaoui", "Bennani", "Chraibi", "Daoudi", "El Amrani", "Fassi", "Ghali", "Hajji", "Idrissi", "Jabri", "Kettani", "Lahlou", "Mansouri", "Naciri", "Ouazzani", "Rami", "Saidi", "Tazi"];
    const deps = ["GI", "DS", "GC"];
    const students = first.map((f, i) => {
      const l = last[Math.floor(r() * last.length)];
      return { id: "ST" + (25001 + i), name: `${f} ${l}`, dep: deps[i % 3], year: (i % 2) + 1,
        email: `${f.toLowerCase()}.${l.toLowerCase().replace(/\s/g, "")}@etu.example.edu`, demo: true, assiduity: 0.75 + r() * 0.24 };
    });
    const courses = [["C1", "Bases de données", "GI", 1, "Pr. Hajji"], ["C2", "Programmation Java", "GI", 2, "Pr. Tazi"],
      ["C3", "Machine Learning", "DS", 1, "Pr. Naciri"], ["C4", "Deep Learning", "DS", 2, "Pr. Saidi"],
      ["C5", "Résistance des matériaux", "GC", 1, "Pr. Rami"], ["C6", "BIM & CAO", "GC", 2, "Pr. Ghali"]]
      .map(([id, name, dep, year, teacher]) => ({ id, name, dep, year, teacher }));
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
    sessions.push({ id: "S" + sid++, courseId: "C3", date: today(), start: "10:30", status: "open" });
    students.forEach((s) => delete s.assiduity);
    return { students, courses, sessions, attendance };
  }
  const roster = (students, c) => students.filter((s) => s.dep === c.dep && Number(s.year) === Number(c.year));

  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { } };
  save();
  const course = (id) => db.courses.find((c) => c.id === id);
  const student = (id) => db.students.find((s) => s.id === id);
  const colour = (id) => `hsl(${[...id].reduce((a, c) => a + c.charCodeAt(0), 0) * 47 % 360} 55% 45%)`;
  const avatar = (s) => `<span class="avatar" style="background:${colour(s.id)}" aria-hidden="true">${esc(s.name.split(" ").map((p) => p[0]).slice(0, 2).join(""))}</span>`;
  const rateOf = (recs) => (recs.length ? recs.filter((a) => a.status !== "Absent").length / recs.length : null);
  const pct = (x) => (x == null ? "—" : Math.round(x * 100) + " %");
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3000); }
  const recordOf = (sid, stid) => db.attendance.find((a) => a.sessionId === sid && a.studentId === stid);
  function mark(sessionId, studentId, status, method = "manuel", extra = {}) {
    let rec = recordOf(sessionId, studentId);
    if (!rec) { rec = { sessionId, studentId }; db.attendance.push(rec); }
    Object.assign(rec, { status, time: status === "Absent" ? "" : nowTime(), method }, extra);
    save();
  }

  // ------------------------------------------------------------------ biometric status
  function faceStatus(s) {
    if (F.get(s.id)) return { key: "enrolled", label: "Enrôlé", cls: "ok" };
    if (s.faceConsent === false) return { key: "refused", label: "Consentement refusé", cls: "bad" };
    return { key: "none", label: "Non enrôlé", cls: "neutral" };
  }
  const faceBadge = (s) => { const f = faceStatus(s); return `<span class="badge face-${f.cls}">${f.key === "enrolled" ? "🙂 " : ""}${f.label}</span>`; };
  function deleteFace(s, why = "Référence faciale supprimée.") { F.remove(s.id); toast(why); }

  // ------------------------------------------------------------------ camera helper
  const Camera = {
    stream: null, timer: null,
    async start(video, statusEl) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Caméra non disponible dans ce navigateur.");
      statusEl.textContent = "Chargement des modèles de reconnaissance (≈ 7 Mo, une seule fois)…";
      await F.load();
      statusEl.textContent = "Demande d'autorisation de la caméra…";
      try { this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false }); }
      catch (e) { throw new Error(e.name === "NotAllowedError" ? "Accès à la caméra refusé. Autorisez-le dans le navigateur ou utilisez l'appel manuel." : "Impossible d'ouvrir la caméra : " + e.message); }
      video.srcObject = this.stream; await video.play();
    },
    drawBox(video, canvas, box, ok) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (box) { ctx.strokeStyle = ok ? "#22c55e" : "#f59e0b"; ctx.lineWidth = 4; ctx.strokeRect(box.x, box.y, box.width, box.height); }
    },
    stop() { clearInterval(this.timer); this.timer = null; this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null; }
  };

  // ------------------------------------------------------------------ views
  const V = {};

  V.dashboard = () => {
    const closedIds = new Set(db.sessions.filter((s) => s.status === "closed").map((s) => s.id));
    const recs = db.attendance.filter((a) => closedIds.has(a.sessionId));
    const since = new Date(); since.setDate(since.getDate() - 7); const sinceStr = since.toISOString().slice(0, 10);
    const recent = recs.filter((a) => db.sessions.find((s) => s.id === a.sessionId).date >= sinceStr);
    const open = db.sessions.filter((s) => s.status === "open");
    const enrolled = db.students.filter((s) => F.get(s.id)).length;
    const byCourse = db.courses.map((c) => ({ c, rate: rateOf(recs.filter((a) => db.sessions.find((s) => s.id === a.sessionId).courseId === c.id)) }));
    const atRisk = db.students.map((s) => ({ s, rate: rateOf(recs.filter((a) => a.studentId === s.id)) })).filter((x) => x.rate != null && x.rate < 0.8).sort((a, b) => a.rate - b.rate).slice(0, 6);
    return `<div class="head"><div><h1>Tableau de bord</h1><p class="sub">Données de démonstration fictives, stockées dans ce navigateur.</p></div><a class="btn" href="#/sessions">Démarrer un appel</a></div>
      <div class="kpis">
        <div class="kpi"><b>${db.students.length}</b><span>étudiants</span></div>
        <div class="kpi"><b>${pct(rateOf(recs))}</b><span>présence globale</span></div>
        <div class="kpi"><b>${pct(rateOf(recent))}</b><span>présence sur 7 jours</span></div>
        <div class="kpi"><b>${enrolled}</b><span>visages enrôlés sur cet appareil</span></div>
      </div>
      ${open.length ? `<div class="card"><h2>Séances ouvertes</h2><ul class="list">${open.map((s) => `<li><span><b>${esc(course(s.courseId).name)}</b> · ${fmtDate(s.date)} ${s.start}</span><a class="btn sm" href="#/session/${s.id}">Faire l'appel</a></li>`).join("")}</ul></div>` : ""}
      <div class="grid2">
        <div class="card"><h2>Présence par cours</h2><div class="bars">${byCourse.map(({ c, rate }) => `<div class="bar"><span>${esc(c.name)}</span><div class="track"><div class="fill ${rate != null && rate < 0.8 ? "low" : ""}" style="width:${(rate || 0) * 100}%"></div></div><span>${pct(rate)}</span></div>`).join("")}</div></div>
        <div class="card"><h2>Étudiants à suivre (&lt; 80 %)</h2>${atRisk.length ? `<ul class="list">${atRisk.map(({ s, rate }) => `<li><a href="#/student/${s.id}" class="plain">${avatar(s)}${esc(s.name)}</a><b style="color:var(--bad)">${pct(rate)}</b></li>`).join("")}</ul>` : '<p class="empty">Aucun étudiant sous le seuil.</p>'}</div>
      </div>
      ${enrolled === 0 ? `<div class="notice info"><b>Essayer la reconnaissance faciale :</b> les étudiants fictifs n'ont pas de visage enregistré. <a href="#/students?new=1">Ajoutez votre propre profil</a> en « Data Science & IA », 1ʳᵉ année, enrôlez votre visage, puis ouvrez la séance <i>Machine Learning</i> du jour.</div>` : ""}`;
  };

  V.sessions = () => {
    const list = [...db.sessions].sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
    return `<div class="head"><div><h1>Séances</h1><p class="sub">Choisissez une séance, puis pointez par reconnaissance faciale ou manuellement.</p></div><button class="btn" id="new-session">+ Nouvelle séance</button></div>
      <div class="card"><div class="tablewrap"><table><thead><tr><th>Date</th><th>Heure</th><th>Cours</th><th>Groupe</th><th>Présence</th><th>État</th><th></th></tr></thead><tbody>
      ${list.map((s) => { const c = course(s.courseId), recs = db.attendance.filter((a) => a.sessionId === s.id);
        return `<tr><td>${fmtDate(s.date)}</td><td>${s.start}</td><td><b>${esc(c.name)}</b></td><td>${c.dep} · ${c.year}A</td><td>${recs.length ? pct(rateOf(recs)) : "—"}</td><td><span class="badge ${s.status}">${s.status === "open" ? "ouverte" : "clôturée"}</span></td><td><a class="btn sm ${s.status === "open" ? "" : "ghost"}" href="#/session/${s.id}">${s.status === "open" ? "Faire l'appel" : "Voir"}</a></td></tr>`; }).join("")}
      </tbody></table></div></div>`;
  };

  V.session = (id) => {
    const s = db.sessions.find((x) => x.id === id); if (!s) return '<p class="empty">Séance introuvable.</p>';
    const c = course(s.courseId), list = roster(db.students, c), editable = s.status === "open";
    const eligible = list.filter((st) => F.get(st.id) && st.faceConsent !== false);
    const marked = list.filter((st) => recordOf(s.id, st.id)).length;
    return `<p class="crumbs"><a href="#/sessions">Séances</a> › ${esc(c.name)}</p>
      <div class="head"><div><h1>${esc(c.name)}</h1><p class="sub">${fmtDate(s.date)} · ${s.start} · ${depName[c.dep]} ${c.year}ᵉ année · ${esc(c.teacher)}</p></div>
      ${editable ? `<button class="btn" id="close-session">Clôturer la séance</button>` : `<button class="btn ghost" id="reopen">Rouvrir</button>`}</div>
      ${editable ? `<div class="modes">
        <a class="mode" href="#/checkin/${s.id}"><span class="mi">🙂</span><b>Pointage par visage</b><span>${eligible.length} étudiant(s) de ce groupe avec une référence faciale sur cet appareil</span></a>
        <a class="mode" href="#roll"><span class="mi">✍️</span><b>Appel manuel</b><span>Pour tous les étudiants, avec ou sans enrôlement facial</span></a>
      </div>` : ""}
      <div class="notice info">${marked} / ${list.length} étudiants pointés · présence ${pct(rateOf(db.attendance.filter((a) => a.sessionId === s.id)))}</div>
      <div class="card" id="roll"><div class="toolbar"><h2 style="margin:0;flex:1">Appel</h2>${editable ? `<button class="btn sm ghost" id="all-present">Marquer présents les non-pointés</button>` : ""}<input type="search" id="q" placeholder="Rechercher" aria-label="Rechercher un étudiant" style="max-width:220px"></div>
      <div class="tablewrap"><table><thead><tr><th>Étudiant</th><th>Visage</th><th>Statut</th><th>Heure</th><th>Méthode</th></tr></thead><tbody id="roster">
      ${list.map((st) => { const r = recordOf(s.id, st.id);
        return `<tr data-name="${esc((st.name + " " + st.id).toLowerCase())}"><td><a class="plain" href="#/student/${st.id}">${avatar(st)}${esc(st.name)}</a> <span class="sub">${st.id}</span></td><td>${faceBadge(st)}</td>
        <td>${editable ? `<div class="seg" role="group" aria-label="Statut de ${esc(st.name)}">${STATUSES.map((x) => `<button type="button" data-s="${x}" data-st="${st.id}" aria-pressed="${r?.status === x}">${x}</button>`).join("")}</div>` : r ? `<span class="badge ${r.status}">${r.status}</span>` : "—"}</td>
        <td>${r?.time || "—"}</td><td>${r ? (r.method === "visage" ? "🙂 visage (confirmé)" : "manuel") : "—"}</td></tr>`; }).join("")}
      </tbody></table></div></div>`;
  };

  V.students = (params) => `<div class="head"><div><h1>Étudiants</h1><p class="sub">Les profils fictifs n'ont pas de visage. L'enrôlement facial est possible pour les profils que vous créez.</p></div><button class="btn" id="add-student">+ Ajouter un étudiant</button></div>
      <div class="card"><div class="toolbar">
        <input type="search" id="q" placeholder="Nom, ID ou e-mail" aria-label="Rechercher">
        <select id="f-dep" aria-label="Filière"><option value="">Toutes les filières</option>${Object.entries(depName).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <select id="f-year" aria-label="Année"><option value="">Toutes les années</option><option value="1">1ʳᵉ année</option><option value="2">2ᵉ année</option></select>
        <select id="f-face" aria-label="Statut facial"><option value="">Tous les statuts faciaux</option><option value="enrolled">Enrôlé</option><option value="none">Non enrôlé</option><option value="refused">Consentement refusé</option></select>
      </div><div class="tablewrap"><table><thead><tr><th>Étudiant</th><th>Groupe</th><th>Visage</th><th class="n">Présence</th><th><span class="sr">Actions</span></th></tr></thead><tbody id="tbody"></tbody></table></div><p class="sub" id="count"></p></div>`;

  V.student = (id) => {
    const s = student(id); if (!s) return '<p class="empty">Étudiant introuvable.</p>';
    const recs = db.attendance.filter((a) => a.studentId === s.id).map((a) => ({ a, se: db.sessions.find((x) => x.id === a.sessionId) })).filter((x) => x.se).sort((x, y) => y.se.date.localeCompare(x.se.date));
    const f = faceStatus(s), ref = F.get(s.id);
    return `<p class="crumbs"><a href="#/students">Étudiants</a> › ${esc(s.name)}</p>
      <div class="head"><div style="display:flex;align-items:center;gap:12px">${avatar(s).replace('class="avatar"', 'class="avatar lg"')}<div><h1>${esc(s.name)}</h1><p class="sub">${s.id} · ${depName[s.dep]} · ${s.year}ᵉ année · ${esc(s.email)}${s.demo ? ' · <span class="badge face-neutral">profil fictif</span>' : ""}</p></div></div>
      <button class="btn ghost" id="edit">Modifier</button></div>
      <div class="grid2">
        <div class="card"><h2>Présences (${pct(rateOf(recs.map((x) => x.a)))})</h2>${recs.length ? `<ul class="list">${recs.slice(0, 12).map(({ a, se }) => `<li><span>${fmtDate(se.date)} · ${esc(course(se.courseId).name)}</span><span class="badge ${a.status}">${a.status}</span></li>`).join("")}</ul>` : '<p class="empty">Aucune présence enregistrée.</p>'}</div>
        <div class="card"><h2>Enrôlement facial <span class="badge face-${f.cls}">${f.label}</span></h2>
          ${s.demo ? `<p class="sub">Profil fictif : aucun visage réel n'y est associé et l'enrôlement est désactivé pour ne jamais lier un visiteur à une identité inventée. Créez votre propre profil pour tester.</p>`
          : ref ? `<p>Référence créée le ${new Date(ref.createdAt).toLocaleString("fr-FR")} · ${ref.descriptors.length} signatures de 128 valeurs · stockée <b>${ref.storage === "device" ? "sur cet appareil" : "dans cet onglet uniquement"}</b>.</p>
              <p class="sub">Aucune image n'est conservée. Effacer les données du navigateur supprime aussi cette référence.</p>
              <div class="toolbar"><a class="btn ghost" href="#/enroll/${s.id}">Mettre à jour</a><button class="btn danger" id="del-face">Supprimer la référence faciale</button></div>`
          : f.key === "refused" ? `<p class="sub">Le consentement biométrique a été refusé : l'appel se fait manuellement.</p><div class="toolbar"><a class="btn ghost" href="#/enroll/${s.id}">Revoir le consentement</a></div>`
          : `<p class="sub">Optionnel. Sans enrôlement, l'étudiant est pointé par l'appel manuel.</p><div class="toolbar"><a class="btn" href="#/enroll/${s.id}">Enrôler le visage</a></div>`}
        </div>
      </div>
      <div class="card danger-zone"><h2>Zone sensible</h2><button class="btn ghost" id="del-student">Supprimer l'étudiant et ses présences</button></div>`;
  };

  V.enroll = (id) => {
    const s = student(id); if (!s) return '<p class="empty">Étudiant introuvable.</p>';
    if (s.demo) return `<p class="crumbs"><a href="#/students">Étudiants</a> › <a href="#/student/${s.id}">${esc(s.name)}</a> › Enrôlement</p><div class="notice warn">Profil fictif : l'enrôlement facial est réservé aux profils que vous créez.</div><a class="btn" href="#/students?new=1">Créer mon profil</a>`;
    const existing = F.get(s.id);
    return `<p class="crumbs"><a href="#/students">Étudiants</a> › <a href="#/student/${s.id}">${esc(s.name)}</a> › Enrôlement facial</p>
      <div class="head"><div><h1>Enrôlement facial</h1><p class="sub">${esc(s.name)} · ${s.id}${existing ? " · mise à jour d'une référence existante" : ""}</p></div></div>
      <ol class="stepper"><li data-step="1" class="on">Consentement</li><li data-step="2">Capture</li><li data-step="3">Terminé</li></ol>
      <section class="card" id="step1">
        <h2>1. Consentement biométrique</h2>
        <p>Pour pointer ${esc(s.name)} par reconnaissance faciale, Attendify calcule à partir de la caméra une <b>signature de 128 nombres</b> (même méthode que le module dlib de l'application de bureau). Le calcul se fait <b>uniquement dans ce navigateur</b> : aucune image ni signature n'est envoyée à un serveur, aucune photo n'est conservée.</p>
        <fieldset class="fs"><legend>Durée de conservation</legend>
          <label class="checkbox"><input type="radio" name="storage" value="tab" checked> Cet onglet uniquement — effacée à sa fermeture</label>
          <label class="checkbox"><input type="radio" name="storage" value="device"> Cet appareil — conservée dans le stockage local du navigateur jusqu'à suppression (perdue si les données du navigateur sont effacées ; non synchronisée avec d'autres appareils)</label>
        </fieldset>
        <label class="checkbox"><input type="checkbox" id="consent"> Je consens explicitement au traitement local de mon visage pour créer cette référence, et je sais que je peux la supprimer à tout moment depuis le profil ou la page Confidentialité.</label>
        <div class="toolbar" style="margin-top:14px"><button class="btn" id="go-capture" disabled>Continuer</button><button class="btn ghost" id="refuse">Je refuse — utiliser l'appel manuel</button></div>
      </section>
      <section class="card" id="step2" hidden>
        <h2>2. Capture de ${F.CONFIG.samples} échantillons</h2>
        <div class="grid2"><div><div class="cam"><video id="video" playsinline muted></video><canvas id="overlay"></canvas></div><p class="sub" id="cam-status" role="status">Caméra arrêtée.</p></div>
          <div><ul class="tips"><li>Une seule personne face à la caméra, visage dégagé.</li><li>Bonne lumière, de face.</li><li>Tournez légèrement la tête entre les captures.</li></ul>
          <div class="progress" aria-label="Progression"><div id="prog" style="width:0%"></div></div><p id="prog-txt" class="sub">0 / ${F.CONFIG.samples} échantillon valide</p>
          <div class="toolbar"><button class="btn" id="cam-start">Activer la caméra</button><button class="btn" id="capture" disabled>Capturer</button><button class="btn ghost" id="cancel">Annuler</button></div>
          <div id="enroll-msg" aria-live="polite"></div></div></div>
      </section>
      <section class="card" id="step3" hidden></section>`;
  };

  V.checkin = (id) => {
    const s = db.sessions.find((x) => x.id === id && x.status === "open");
    if (!s) return '<div class="notice warn">Cette séance n\'est pas ouverte.</div><a class="btn" href="#/sessions">Voir les séances</a>';
    const c = course(s.courseId), list = roster(db.students, c);
    const eligible = list.filter((st) => F.get(st.id) && st.faceConsent !== false);
    return `<p class="crumbs"><a href="#/sessions">Séances</a> › <a href="#/session/${s.id}">${esc(c.name)}</a> › Pointage par visage</p>
      <div class="head"><div><h1>Pointage par visage</h1><p class="sub">${esc(c.name)} · ${fmtDate(s.date)} ${s.start}</p></div><a class="btn ghost" href="#/session/${s.id}">Appel manuel</a></div>
      ${eligible.length ? "" : `<div class="notice warn"><b>Aucun étudiant de ce groupe n'a de référence faciale sur cet appareil.</b> La reconnaissance ne peut identifier personne : utilisez l'appel manuel, ou créez un profil ${depName[c.dep]} ${c.year}ᵉ année et enrôlez son visage.</div>`}
      <div class="grid2">
        <div><div class="cam"><video id="video" playsinline muted></video><canvas id="overlay"></canvas></div><p class="sub" id="cam-status" role="status">Caméra arrêtée.</p>
          <div class="toolbar"><button class="btn" id="cam-start" ${eligible.length ? "" : "disabled"}>Démarrer la reconnaissance</button><button class="btn ghost" id="cam-stop" disabled>Arrêter</button></div></div>
        <div>
          <div class="card"><h2>Références comparées</h2><p class="sub">Seuls les ${eligible.length} étudiant(s) inscrits à ce cours, enrôlés et consentants sur cet appareil sont comparés (sur ${list.length} inscrits).</p>
            <p class="sub">Règle : distance ≤ ${F.CONFIG.matchThreshold} (application de bureau : 0,6), écart ≥ ${F.CONFIG.minMargin} avec le 2ᵉ candidat, ${F.CONFIG.framesToAgree} images consécutives concordantes, puis <b>confirmation humaine</b>. Un score de similarité n'est pas une preuve d'identité.</p></div>
          <div id="proposal" aria-live="polite"></div>
        </div>
      </div>`;
  };

  V.history = () => `<div class="head"><div><h1>Historique</h1><p class="sub">Toutes les présences, filtrables et exportables (colonnes de l'export de l'application de bureau).</p></div><button class="btn ghost" id="export">⬇ Export CSV</button></div>
      <div class="card"><div class="toolbar">
        <input type="search" id="q" placeholder="Étudiant ou ID" aria-label="Rechercher">
        <select id="f-course" aria-label="Cours"><option value="">Tous les cours</option>${db.courses.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
        <select id="f-status" aria-label="Statut"><option value="">Tous les statuts</option>${STATUSES.map((s) => `<option>${s}</option>`).join("")}</select>
        <select id="f-method" aria-label="Méthode"><option value="">Toutes les méthodes</option><option value="manuel">Manuel</option><option value="visage">Visage</option></select>
        <input type="date" id="f-from" aria-label="Depuis"><input type="date" id="f-to" aria-label="Jusqu'au">
      </div><div class="tablewrap"><table><thead><tr><th>Date</th><th>Cours</th><th>Étudiant</th><th>Statut</th><th>Heure</th><th>Méthode</th></tr></thead><tbody id="tbody"></tbody></table></div><p class="sub" id="count"></p></div>`;

  V.reports = () => {
    const closedIds = new Set(db.sessions.filter((s) => s.status === "closed").map((s) => s.id));
    const recs = db.attendance.filter((a) => closedIds.has(a.sessionId));
    const per = db.students.map((s) => { const r = recs.filter((a) => a.studentId === s.id);
      return { s, n: r.length, p: r.filter((a) => a.status === "Présent").length, l: r.filter((a) => a.status === "Retard").length, a: r.filter((a) => a.status === "Absent").length, rate: rateOf(r) }; }).sort((x, y) => (x.rate ?? 1) - (y.rate ?? 1));
    const byDep = Object.keys(depName).map((d) => ({ d, rate: rateOf(recs.filter((a) => student(a.studentId)?.dep === d)) }));
    const face = db.attendance.filter((a) => a.method === "visage").length;
    return `<div class="head"><div><h1>Rapports</h1><p class="sub">Calculés à partir des séances clôturées.</p></div></div>
      <div class="kpis">${STATUSES.map((st) => `<div class="kpi"><b>${recs.filter((a) => a.status === st).length}</b><span>${st.toLowerCase()}s</span></div>`).join("")}<div class="kpi"><b>${face}</b><span>pointages par visage</span></div></div>
      <div class="grid2"><div class="card"><h2>Assiduité par étudiant</h2><div class="tablewrap"><table><thead><tr><th>Étudiant</th><th class="n">Séances</th><th class="n">Présent</th><th class="n">Retard</th><th class="n">Absent</th><th class="n">Taux</th></tr></thead><tbody>
        ${per.map((x) => `<tr><td><a class="plain" href="#/student/${x.s.id}">${esc(x.s.name)}</a></td><td class="n">${x.n}</td><td class="n">${x.p}</td><td class="n">${x.l}</td><td class="n">${x.a}</td><td class="n" style="${x.rate != null && x.rate < 0.8 ? "color:var(--bad);font-weight:700" : ""}">${pct(x.rate)}</td></tr>`).join("")}
      </tbody></table></div></div>
      <div class="card"><h2>Présence par filière</h2><div class="bars">${byDep.map(({ d, rate }) => `<div class="bar"><span>${depName[d]}</span><div class="track"><div class="fill" style="width:${(rate || 0) * 100}%"></div></div><span>${pct(rate)}</span></div>`).join("")}</div>
      <p class="sub" style="margin-top:14px">Un retard compte comme une présence dans le taux.</p></div></div>`;
  };

  V.privacy = () => {
    const refs = F.readAll();
    return `<div class="head"><div><h1>Confidentialité & biométrie</h1><p class="sub">Ce qui est stocké, où, et comment le supprimer.</p></div></div>
      <div class="grid2"><div class="card"><h2>Fonctionnement</h2><ul class="tips">
        <li>Reconnaissance <b>réelle</b> : détection du visage, signature de 128 nombres (réseau ResNet de type dlib, comme <code>dlib_face_recognition.py</code>), comparaison par distance euclidienne.</li>
        <li>Calcul <b>local</b> (face-api.js, WebGL). Les images de la caméra et les signatures ne sont jamais envoyées à un serveur.</li>
        <li>Seuil prudent (0,5 au lieu de 0,6), marge avec le 2ᵉ candidat, plusieurs images concordantes et <b>confirmation humaine</b> avant tout enregistrement.</li>
        <li>Les 36 étudiants fictifs n'ont aucun visage enregistré ; l'enrôlement n'est possible que pour les profils créés par vous.</li>
        <li>Le stockage du navigateur est propre à cet appareil et à ce navigateur ; il peut être perdu si les données de navigation sont effacées.</li>
      </ul></div>
      <div class="card"><h2>Références faciales sur cet appareil (${Object.keys(refs).length})</h2>
        ${Object.keys(refs).length ? `<ul class="list">${Object.entries(refs).map(([id, r]) => `<li><span>${esc(student(id)?.name || id)} · ${r.storage === "device" ? "appareil" : "onglet"} · ${new Date(r.createdAt).toLocaleDateString("fr-FR")}</span><button class="btn sm ghost" data-forget="${esc(id)}">Supprimer</button></li>`).join("")}</ul>
        <div class="toolbar" style="margin-top:12px"><button class="btn danger" id="forget-all">Supprimer toutes les références</button></div>` : '<p class="empty">Aucune référence faciale stockée.</p>'}
      </div></div>`;
  };

  // ------------------------------------------------------------------ behaviours
  const A = {};
  A.sessions = () => {
    $("#new-session").onclick = () => dialog(`<h2>Nouvelle séance</h2>
      <label for="d-course">Cours</label><select id="d-course">${db.courses.map((c) => `<option value="${c.id}">${esc(c.name)} — ${c.dep} ${c.year}A</option>`).join("")}</select>
      <div class="form-grid"><div><label for="d-date">Date</label><input type="date" id="d-date" value="${today()}" required></div><div><label for="d-start">Heure</label><input type="time" id="d-start" value="${nowTime()}" required></div></div>`,
      () => { const s = { id: "S" + Date.now(), courseId: $("#d-course").value, date: $("#d-date").value, start: $("#d-start").value, status: "open" }; db.sessions.push(s); save(); location.hash = "#/session/" + s.id; toast("Séance créée."); });
  };
  A.session = (id) => {
    const s = db.sessions.find((x) => x.id === id); if (!s) return;
    const list = roster(db.students, course(s.courseId));
    $$("[data-s]").forEach((b) => b.onclick = () => { mark(s.id, b.dataset.st, b.dataset.s); render(); });
    $("#q")?.addEventListener("input", (e) => { const q = e.target.value.toLowerCase(); $$("#roster tr").forEach((tr) => tr.hidden = !tr.dataset.name.includes(q)); });
    $("#all-present")?.addEventListener("click", () => { list.forEach((st) => { if (!recordOf(s.id, st.id)) mark(s.id, st.id, "Présent"); }); render(); toast("Non-pointés marqués présents."); });
    $("#close-session")?.addEventListener("click", () => { list.forEach((st) => { if (!recordOf(s.id, st.id)) mark(s.id, st.id, "Absent"); }); s.status = "closed"; save(); render(); toast("Séance clôturée : les non-pointés sont absents."); });
    $("#reopen")?.addEventListener("click", () => { s.status = "open"; save(); render(); });
    $$('a[href="#roll"]').forEach((a) => a.onclick = (e) => { e.preventDefault(); $("#roll").scrollIntoView({ behavior: "smooth" }); $("#q").focus(); });
  };
  A.students = (params) => {
    const draw = () => {
      const q = $("#q").value.toLowerCase(), dep = $("#f-dep").value, year = $("#f-year").value, fs = $("#f-face").value;
      const list = db.students.filter((s) => (s.name + s.id + s.email).toLowerCase().includes(q) && (!dep || s.dep === dep) && (!year || String(s.year) === year) && (!fs || faceStatus(s).key === fs))
        .sort((a, b) => (a.demo === b.demo ? a.name.localeCompare(b.name) : a.demo ? 1 : -1));
      $("#tbody").innerHTML = list.map((s) => { const fk = faceStatus(s).key;
        return `<tr><td><a class="plain" href="#/student/${s.id}">${avatar(s)}${esc(s.name)}</a> <span class="sub">${s.id}</span>${s.demo ? "" : ' <span class="badge open">créé par vous</span>'}</td><td>${s.dep} · ${s.year}A</td><td>${faceBadge(s)}</td><td class="n">${pct(rateOf(db.attendance.filter((a) => a.studentId === s.id)))}</td>
        <td class="n"><details class="menu"><summary aria-label="Actions pour ${esc(s.name)}">⋯</summary><div class="menu-list">
          <a href="#/student/${s.id}">Voir le profil</a><button data-edit="${s.id}">Modifier</button>
          ${s.demo ? `<span class="disabled" title="Profil fictif">Enrôlement indisponible (fictif)</span>` : `<a href="#/enroll/${s.id}">${fk === "enrolled" ? "Mettre à jour le visage" : "Enrôler le visage"}</a>`}
          ${fk === "enrolled" ? `<button data-delface="${s.id}">Supprimer la référence faciale</button>` : ""}
          <button class="danger-txt" data-del="${s.id}">Supprimer l'étudiant</button></div></details></td></tr>`; }).join("") || `<tr><td colspan="5" class="empty">Aucun étudiant ne correspond.</td></tr>`;
      $("#count").textContent = `${list.length} étudiant(s)`;
      $$("[data-edit]").forEach((b) => b.onclick = () => studentForm(student(b.dataset.edit)));
      $$("[data-delface]").forEach((b) => b.onclick = () => { if (confirm("Supprimer définitivement la référence faciale de cet étudiant ?")) { deleteFace(student(b.dataset.delface)); draw(); } });
      $$("[data-del]").forEach((b) => b.onclick = () => removeStudent(student(b.dataset.del), draw));
    };
    ["#q", "#f-dep", "#f-year", "#f-face"].forEach((s) => $(s).addEventListener("input", draw));
    $("#add-student").onclick = () => studentForm(null);
    document.addEventListener("click", (e) => { $$("details.menu[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
    // action menus use fixed positioning so the scrolling table never clips them
    $("#tbody").addEventListener("toggle", (e) => {
      const d = e.target; if (!d.open) return;
      $$("details.menu[open]").forEach((o) => { if (o !== d) o.open = false; });
      const r = $("summary", d).getBoundingClientRect(), m = $(".menu-list", d);
      const h = m.offsetHeight, w = m.offsetWidth;
      m.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + "px";
      m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + "px";
    }, true);
    window.addEventListener("scroll", () => $$("details.menu[open]").forEach((d) => { d.open = false; }), { passive: true });
    draw();
    if (params.get("new")) studentForm(null, { dep: "DS", year: 1 });
  };
  A.student = (id) => {
    const s = student(id); if (!s) return;
    $("#edit").onclick = () => studentForm(s);
    $("#del-face")?.addEventListener("click", () => { if (confirm("Supprimer définitivement la référence faciale ?")) { deleteFace(s); render(); } });
    $("#del-student").onclick = () => removeStudent(s, () => { location.hash = "#/students"; });
  };
  A.enroll = (id) => {
    const s = student(id); if (!s || s.demo) return;
    const consent = $("#consent"), go = $("#go-capture");
    consent.onchange = () => go.disabled = !consent.checked;
    $("#refuse").onclick = () => { s.faceConsent = false; F.remove(s.id); save(); toast("Consentement refusé : appel manuel pour cet étudiant."); location.hash = "#/student/" + s.id; };
    const step = (n) => { ["#step1", "#step2", "#step3"].forEach((x, i) => $(x).hidden = i + 1 !== n); $$(".stepper li").forEach((li) => li.classList.toggle("on", Number(li.dataset.step) <= n)); };
    let samples = [];
    const storage = () => $('input[name="storage"]:checked').value;
    go.onclick = () => step(2);
    const video = $("#video"), overlay = $("#overlay"), status = $("#cam-status"), msg = $("#enroll-msg");
    const progress = () => { $("#prog").style.width = (samples.length / F.CONFIG.samples * 100) + "%"; $("#prog-txt").textContent = `${samples.length} / ${F.CONFIG.samples} échantillon(s) valide(s)`; };
    $("#cam-start").onclick = async () => {
      try {
        await Camera.start(video, status);
        status.textContent = "Caméra active. Placez votre visage dans le cadre puis cliquez sur « Capturer ».";
        $("#cam-start").disabled = true; $("#capture").disabled = false;
        Camera.timer = setInterval(async () => { if (video.readyState < 2) return; const a = await F.analyse(video); Camera.drawBox(video, overlay, a.box, a.ok); }, 400);
      } catch (e) { status.textContent = e.message; }
    };
    $("#capture").onclick = async () => {
      $("#capture").disabled = true;
      const a = await F.analyse(video);
      if (!a.ok) { msg.innerHTML = `<div class="notice warn">${esc(a.reason)}</div>`; $("#capture").disabled = false; return; }
      if (samples.length && Math.min(...samples.map((x) => F.dist(x, a.descriptor))) < 0.02) { msg.innerHTML = '<div class="notice warn">Image identique à la précédente : bougez légèrement la tête.</div>'; $("#capture").disabled = false; return; }
      samples.push(a.descriptor); progress(); msg.innerHTML = `<div class="notice ok">Échantillon ${samples.length} validé (qualité ${Math.round(a.score * 100)} %).</div>`;
      if (samples.length < F.CONFIG.samples) { $("#capture").disabled = false; return; }
      try {
        const ref = F.enroll(s.id, samples, storage(), { allowReplace: !!F.get(s.id) });
        s.faceConsent = true; s.consentAt = new Date().toISOString(); save(); Camera.stop();
        step(3);
        $("#step3").innerHTML = `<h2>3. Enrôlement réussi</h2><div class="notice ok">Référence faciale associée à <b>${esc(s.name)}</b> (${s.id}) : ${ref.descriptors.length} signatures, cohérence ${(1 - ref.spread).toFixed(2)}, stockée ${ref.storage === "device" ? "sur cet appareil" : "dans cet onglet"}.</div>
          <div class="toolbar"><a class="btn" href="#/sessions">Aller aux séances</a><a class="btn ghost" href="#/student/${s.id}">Voir le profil</a></div>`;
        toast("Visage enrôlé.");
      } catch (e) {
        samples = []; progress();
        msg.innerHTML = `<div class="notice warn">${esc(e.message)}${e.duplicateOf ? ` (profil : ${esc(student(e.duplicateOf)?.name || e.duplicateOf)})` : ""}</div>`;
        $("#capture").disabled = false;
      }
    };
    $("#cancel").onclick = () => { Camera.stop(); location.hash = "#/student/" + s.id; };
  };
  A.checkin = (id) => {
    const s = db.sessions.find((x) => x.id === id && x.status === "open"); if (!s) return;
    const list = roster(db.students, course(s.courseId));
    const eligibleIds = list.filter((st) => F.get(st.id) && st.faceConsent !== false).map((st) => st.id);
    const video = $("#video"), overlay = $("#overlay"), status = $("#cam-status"), box = $("#proposal");
    let streak = { id: null, n: 0 }, paused = false;
    const resume = () => { paused = false; streak = { id: null, n: 0 }; box.innerHTML = ""; status.textContent = "Analyse en cours…"; };
    function propose(m) {
      paused = true;
      const st = student(m.candidate), rec = recordOf(s.id, st.id);
      if (rec && rec.status !== "Absent") {
        box.innerHTML = `<div class="notice info">${avatar(st)}<b>${esc(st.name)}</b> est déjà pointé(e) (${rec.status} à ${rec.time}). Aucun doublon n'est créé.</div><button class="btn ghost" id="next">Personne suivante</button>`;
      } else {
        box.innerHTML = `<div class="card proposal"><h2>Identité proposée</h2><p>${avatar(st)}<b>${esc(st.name)}</b> · ${st.id}</p>
          <ul class="list"><li><span>Distance</span><b>${m.distance.toFixed(3)} ≤ ${F.CONFIG.matchThreshold}</b></li><li><span>Similarité (1 − distance)</span><b>${m.confidence} %</b></li><li><span>Écart avec le 2ᵉ candidat</span><b>${isFinite(m.margin) ? m.margin.toFixed(3) : "seul candidat"}</b></li><li><span>Images concordantes</span><b>${F.CONFIG.framesToAgree}</b></li></ul>
          <p class="sub">Vérifiez visuellement : un score n'est pas une preuve d'identité.</p>
          <div class="toolbar"><button class="btn" id="confirm">Confirmer la présence</button><button class="btn ghost" id="reject">Ce n'est pas cette personne</button></div></div>`;
        $("#confirm").onclick = () => {
          const [h, mi] = s.start.split(":").map(Number), t = new Date();
          const late = s.date === today() && t.getHours() * 60 + t.getMinutes() > h * 60 + mi + 15;
          mark(s.id, st.id, late ? "Retard" : "Présent", "visage", { distance: +m.distance.toFixed(3) });
          box.innerHTML = `<div class="notice ok">✅ ${esc(st.name)} : <b>${late ? "Retard" : "Présent"}</b> enregistré à ${nowTime()}.</div><button class="btn ghost" id="next">Personne suivante</button>`;
          $("#next").onclick = resume;
        };
        $("#reject").onclick = () => { box.innerHTML = '<div class="notice warn">Proposition rejetée : aucune présence enregistrée.</div><button class="btn ghost" id="next">Réessayer</button>'; $("#next").onclick = resume; };
      }
      $("#next") && ($("#next").onclick = resume);
    }
    $("#cam-start")?.addEventListener("click", async () => {
      try {
        await Camera.start(video, status);
        $("#cam-start").disabled = true; $("#cam-stop").disabled = false; status.textContent = "Analyse en cours…";
        Camera.timer = setInterval(async () => {
          if (paused || video.readyState < 2) return;
          const a = await F.analyse(video);
          Camera.drawBox(video, overlay, a.box, a.ok);
          if (!a.ok) { status.textContent = a.reason; streak = { id: null, n: 0 }; return; }
          const m = F.match(a.descriptor, eligibleIds);
          if (m.status === "match") {
            streak = streak.id === m.candidate ? { id: m.candidate, n: streak.n + 1 } : { id: m.candidate, n: 1 };
            status.textContent = `Correspondance possible… (${streak.n}/${F.CONFIG.framesToAgree})`;
            if (streak.n >= F.CONFIG.framesToAgree) propose(m);
          } else {
            streak = { id: null, n: 0 };
            status.textContent = m.status === "ambiguous" ? "Correspondance ambiguë entre deux étudiants : aucune proposition." : "Visage inconnu : aucune présence enregistrée.";
          }
        }, 500);
      } catch (e) { status.textContent = e.message; }
    });
    $("#cam-stop").onclick = () => { Camera.stop(); $("#cam-start").disabled = false; $("#cam-stop").disabled = true; status.textContent = "Caméra arrêtée."; };
  };
  A.history = () => {
    const rows = () => {
      const q = $("#q").value.toLowerCase(), c = $("#f-course").value, st = $("#f-status").value, me = $("#f-method").value, from = $("#f-from").value, to = $("#f-to").value;
      return db.attendance.map((a) => ({ a, s: db.sessions.find((x) => x.id === a.sessionId), p: student(a.studentId) }))
        .filter(({ a, s, p }) => s && p && (!c || s.courseId === c) && (!st || a.status === st) && (!me || a.method === me) && (!from || s.date >= from) && (!to || s.date <= to) && (p.name + p.id).toLowerCase().includes(q))
        .sort((x, y) => (y.s.date + y.s.start).localeCompare(x.s.date + x.s.start));
    };
    const draw = () => { const r = rows();
      $("#tbody").innerHTML = r.slice(0, 300).map(({ a, s, p }) => `<tr><td>${fmtDate(s.date)}</td><td>${esc(course(s.courseId).name)}</td><td><a class="plain" href="#/student/${p.id}">${esc(p.name)}</a></td><td><span class="badge ${a.status}">${a.status}</span></td><td>${a.time || "—"}</td><td>${a.method === "visage" ? "🙂 visage" : "manuel"}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">Aucun enregistrement.</td></tr>`;
      $("#count").textContent = `${r.length} enregistrement(s)${r.length > 300 ? " — 300 affichés, l'export contient tout" : ""}`; };
    ["#q", "#f-course", "#f-status", "#f-method", "#f-from", "#f-to"].forEach((s) => $(s).addEventListener("input", draw));
    $("#export").onclick = () => {
      const csv = ["Student_id,Name,Departement,Course,Year,Time,Date,AttendanceStatus,Method"].concat(rows().map(({ a, s, p }) =>
        [p.id, p.name, p.dep, course(s.courseId).name, p.year, a.time, s.date, a.status, a.method].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))).join("\n");
      const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
      Object.assign(document.createElement("a"), { href: url, download: `attendance_${today()}.csv` }).click(); URL.revokeObjectURL(url); toast("Export CSV téléchargé.");
    };
    draw();
  };
  A.privacy = () => {
    $$("[data-forget]").forEach((b) => b.onclick = () => { F.remove(b.dataset.forget); render(); toast("Référence supprimée."); });
    $("#forget-all")?.addEventListener("click", () => { if (confirm("Supprimer toutes les références faciales de cet appareil ?")) { F.removeAll(); render(); toast("Toutes les références ont été supprimées."); } });
  };

  function removeStudent(s, then) {
    if (!confirm(`Supprimer ${s.name}, ses présences et sa référence faciale ?`)) return;
    F.remove(s.id); db.students = db.students.filter((x) => x.id !== s.id); db.attendance = db.attendance.filter((a) => a.studentId !== s.id); save(); toast("Étudiant supprimé."); then();
  }

  function studentForm(s, defaults = {}) {
    const isNew = !s; const v = s || { id: "", name: "", dep: defaults.dep || "GI", year: defaults.year || 1, email: "" };
    const f = s ? faceStatus(s) : null;
    dialog(`<h2>${isNew ? "Ajouter un étudiant" : "Modifier l'étudiant"}</h2>
      <fieldset class="fs"><legend>Informations (obligatoires)</legend><div class="form-grid">
        <div><label for="d-id">ID étudiant</label><input id="d-id" value="${esc(v.id)}" ${isNew ? "" : "readonly"} required pattern="[A-Za-z0-9]{3,12}" title="3 à 12 lettres ou chiffres"></div>
        <div><label for="d-name">Nom complet</label><input id="d-name" value="${esc(v.name)}" required minlength="2"></div>
        <div><label for="d-dep">Filière</label><select id="d-dep">${Object.entries(depName).map(([k, n]) => `<option value="${k}" ${v.dep === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div><label for="d-year">Année</label><select id="d-year"><option value="1" ${v.year == 1 ? "selected" : ""}>1ʳᵉ année</option><option value="2" ${v.year == 2 ? "selected" : ""}>2ᵉ année</option></select></div>
        <div style="grid-column:1/-1"><label for="d-email">E-mail</label><input id="d-email" type="email" value="${esc(v.email)}" required></div>
      </div></fieldset>
      <fieldset class="fs"><legend>Enrôlement facial (optionnel)</legend>
        ${isNew ? `<p class="sub">Non requis pour créer l'étudiant. Choisissez « Enregistrer et enrôler » pour ouvrir l'enrôlement par caméra (consentement demandé).</p>`
        : s.demo ? `<p class="sub">Profil fictif : enrôlement désactivé.</p>` : `<p>Statut : <span class="badge face-${f.cls}">${f.label}</span></p>`}
      </fieldset>`, (action) => {
      const id = $("#d-id").value.trim(), name = $("#d-name").value.trim(), email = $("#d-email").value.trim();
      if (isNew && student(id)) { toast("Cet ID existe déjà."); return false; }
      const target = s || { id, demo: false };
      Object.assign(target, { name, email, dep: $("#d-dep").value, year: Number($("#d-year").value) });
      if (isNew) db.students.push(target);
      save(); toast(isNew ? "Étudiant ajouté." : "Étudiant modifié.");
      if (action === "enroll") location.hash = "#/enroll/" + target.id; else render();
    }, isNew || (s && !s.demo) ? (isNew ? "Enregistrer et enrôler le visage" : (faceStatus(s).key === "enrolled" ? "Enregistrer et mettre à jour le visage" : "Enregistrer et enrôler le visage")) : null);
  }

  function dialog(html, onOk, enrollLabel) {
    const d = $("#dlg"), f = $("#dlg-form");
    f.innerHTML = html + `<div class="dlg-actions"><button class="btn ghost" value="cancel" formnovalidate>Annuler</button>${enrollLabel ? `<button class="btn ghost" value="enroll">${enrollLabel}</button>` : ""}<button class="btn" value="ok">Enregistrer</button></div>`;
    f.onsubmit = (e) => {
      const v = e.submitter?.value; if (v === "cancel") return;
      if (!f.checkValidity()) { e.preventDefault(); f.reportValidity(); return; }
      if (onOk(v) === false) e.preventDefault();
    };
    d.showModal(); $("input:not([readonly]),select", f)?.focus();
  }

  // ------------------------------------------------------------------ router
  const titles = { dashboard: "Tableau de bord", sessions: "Séances", session: "Appel", checkin: "Pointage par visage", students: "Étudiants", student: "Profil", enroll: "Enrôlement facial", history: "Historique", reports: "Rapports", privacy: "Confidentialité" };
  const navOf = { session: "sessions", checkin: "sessions", student: "students", enroll: "students" };
  function render() {
    Camera.stop();
    const [path, query] = (location.hash.slice(2) || "dashboard").split("?");
    const [route, arg] = path.split("/");
    const view = V[route] ? route : "dashboard", params = new URLSearchParams(query || "");
    $$("nav a").forEach((a) => a.setAttribute("aria-current", a.dataset.route === (navOf[view] || view) ? "page" : "false"));
    $("#view").innerHTML = V[view](arg ?? params);
    (A[view] || (() => {}))(arg ?? params);
    document.title = "Attendify · " + titles[view];
  }
  window.addEventListener("hashchange", () => { render(); $("#view").focus({ preventScroll: true }); window.scrollTo(0, 0); });
  $("#reset").onclick = () => { if (confirm("Réinitialiser les données de démonstration et supprimer les références faciales ?")) { F.removeAll(); db = seed(); save(); render(); toast("Démo réinitialisée."); } };
  window.__attendify = { db: () => db, render, mark, recordOf, roster, student, course }; // for automated tests
  render();
})();
