/* Attendify — on-device face recognition engine.
 *
 * Same method as the desktop module dlib_face_recognition.py:
 *   face -> 128-d descriptor (ResNet, dlib-style) -> Euclidean distance -> threshold,
 *   confidence shown as (1 - distance) * 100.
 * Differences, chosen to be conservative for a public demo:
 *   - match threshold 0.5 instead of 0.6 (calibrated on labelled faces: 0 false match, see TESTING.md);
 *   - the best candidate must beat the second-best student by a margin;
 *   - several consecutive frames must agree before a proposal is shown;
 *   - a human confirmation is always required before attendance is recorded.
 * Nothing leaves the browser: frames and descriptors are never uploaded.
 */
window.AttendifyFace = (() => {
  "use strict";
  const LIB = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.js";
  const MODELS = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model";
  const STORE = "attendify-face-refs-v2";

  const CONFIG = {
    matchThreshold: 0.5,      // max distance for a candidate match (desktop app: 0.6)
    minMargin: 0.06,          // best must be closer than the 2nd-best *other* student by this much
    framesToAgree: 3,         // consecutive frames that must propose the same student
    duplicateThreshold: 0.5,  // enrollment refused if the face is this close to another student's reference
    samples: 5,               // samples captured at enrollment
    minScore: 0.6,            // detector confidence for a usable sample
    minFacePx: 90,            // minimum face width in pixels
    maxSpread: 0.4            // max distance between a sample and the samples' centroid
  };

  let loading = null;
  function load() {
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      if (window.faceapi) return res();
      const s = document.createElement("script");
      s.src = LIB; s.crossOrigin = "anonymous"; s.onload = res; s.onerror = () => rej(new Error("Impossible de charger la bibliothèque de reconnaissance."));
      document.head.appendChild(s);
    }).then(() => Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS)
    ]));
    loading.catch(() => { loading = null; });
    return loading;
  }

  const detectorOptions = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });

  /** Analyse one frame (video, image or canvas). Returns {ok, reason, descriptor, box, score}. */
  async function analyse(source) {
    const all = await faceapi.detectAllFaces(source, detectorOptions()).withFaceLandmarks().withFaceDescriptors();
    if (!all.length) return { ok: false, reason: "Aucun visage détecté." };
    if (all.length > 1) return { ok: false, reason: "Plusieurs visages détectés : une seule personne doit être face à la caméra." };
    const d = all[0], box = d.detection.box, score = d.detection.score;
    if (score < CONFIG.minScore) return { ok: false, reason: "Visage peu net : améliorez l'éclairage.", box, score };
    if (box.width < CONFIG.minFacePx) return { ok: false, reason: "Visage trop petit : rapprochez-vous de la caméra.", box, score };
    return { ok: true, descriptor: Array.from(d.descriptor), box, score };
  }

  const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const x = a[i] - b[i]; s += x * x; } return Math.sqrt(s); };
  const centroid = (list) => list[0].map((_, i) => list.reduce((acc, v) => acc + v[i], 0) / list.length);
  const confidence = (d) => Math.max(0, Math.min(100, Math.round((1 - d) * 100)));

  // ------------------------------------------------------------------ storage (device-local, per student ID)
  function readAll() {
    const out = {};
    for (const st of [sessionStorage, localStorage]) {
      try { Object.assign(out, JSON.parse(st.getItem(STORE) || "{}")); } catch { /* unavailable */ }
    }
    return out;
  }
  function writeAll(refs) {
    const dev = {}, tab = {};
    for (const [id, r] of Object.entries(refs)) (r.storage === "device" ? dev : tab)[id] = r;
    try { localStorage.setItem(STORE, JSON.stringify(dev)); sessionStorage.setItem(STORE, JSON.stringify(tab)); } catch { /* memory only */ }
  }
  const get = (studentId) => readAll()[studentId] || null;
  function remove(studentId) { const refs = readAll(); delete refs[studentId]; writeAll(refs); }
  function removeAll() { try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch { } }

  /** Validates samples and stores the reference for a student. Throws with a user-facing message. */
  function enroll(studentId, samples, storage, { allowReplace = false } = {}) {
    if (samples.length < CONFIG.samples) throw new Error(`Il faut ${CONFIG.samples} échantillons valides.`);
    const c = centroid(samples);
    const spread = Math.max(...samples.map((s) => dist(s, c)));
    if (spread > CONFIG.maxSpread) throw new Error("Les échantillons ne semblent pas provenir de la même personne. Recommencez sans changer de personne.");
    const refs = readAll();
    if (refs[studentId] && !allowReplace) throw new Error("Ce profil a déjà une référence faciale. Utilisez « Mettre à jour ».");
    for (const [otherId, r] of Object.entries(refs)) {
      if (otherId === studentId) continue;
      const d = Math.min(...r.descriptors.map((x) => dist(x, c)));
      if (d < CONFIG.duplicateThreshold) {
        const e = new Error("Ce visage est déjà enrôlé pour un autre profil. Un même visage ne peut pas être associé à deux étudiants.");
        e.duplicateOf = otherId; throw e;
      }
    }
    refs[studentId] = { descriptors: samples, createdAt: new Date().toISOString(), storage, spread: +spread.toFixed(3) };
    writeAll(refs);
    return refs[studentId];
  }

  /** Compares a descriptor with the references of the eligible students only. */
  function match(descriptor, eligibleIds) {
    const refs = readAll();
    const scored = eligibleIds.filter((id) => refs[id]).map((id) => ({ id, distance: Math.min(...refs[id].descriptors.map((x) => dist(x, descriptor))) }))
      .sort((a, b) => a.distance - b.distance);
    if (!scored.length) return { status: "no-references" };
    const best = scored[0], second = scored[1];
    const margin = second ? second.distance - best.distance : Infinity;
    const base = { candidate: best.id, distance: best.distance, confidence: confidence(best.distance), margin, compared: scored.length };
    if (best.distance > CONFIG.matchThreshold) return { status: "unknown", ...base };
    if (margin < CONFIG.minMargin) return { status: "ambiguous", ...base };
    return { status: "match", ...base };
  }

  return { CONFIG, load, analyse, enroll, match, get, remove, removeAll, readAll, dist, centroid, confidence };
})();
