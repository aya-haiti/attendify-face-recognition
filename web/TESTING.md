# Attendify web — face recognition tests

Run on 2026-11-23 in Chromium (WebGL backend), face-api.js 1.7.13 (`@vladmandic/face-api`).

## Calibration (labelled faces)

Public example faces shipped with the face-api.js repository (7 people, 30 usable images), used locally
for testing only; they are not part of this repository or of the deployed site.

| Pairs | n | min | mean | max |
|---|---|---|---|---|
| same person | 51 | 0.317 | 0.432 | 0.590 |
| different people | 384 | 0.639 | 0.837 | 0.991 |

Leave-one-out identification (enroll 4 images per person, probe with the 5th) using `match()`:

| Threshold | Correct | Wrong person | Unknown | Non-enrolled face accepted |
|---|---|---|---|---|
| 0.45 | 24/30 | 0 | 6 | 0/30 |
| **0.50 (chosen)** | **30/30** | **0** | **0** | **0/30** |
| 0.55 | 30/30 | 0 | 0 | 0/30 |

The desktop module uses 0.6. The web version uses 0.5 plus a 0.06 margin over the second candidate,
3 agreeing frames and a mandatory human confirmation. The sample is small: real-world error rates
depend on lighting and camera, so a similarity score is never treated as proof of identity.

## End-to-end UI test (camera replaced by a canvas stream of the sample faces)

| Scenario | Result |
|---|---|
| Create student without email | blocked by validation |
| Create + enroll (5 samples, quality checks) | enrolled, reference stored under the student ID |
| Same face enrolled for another student | refused ("déjà enrôlé pour un autre profil") |
| Blurry / repeated frames | rejected with a message |
| Enrolled student checks in to their course | identity proposed → confirmed → recorded (method "visage") |
| Same student again | "déjà pointé", no duplicate |
| Unknown face | "Visage inconnu", nothing recorded |
| Enrolled student of another course | not compared → "Visage inconnu" |
| Proposal rejected by the operator | nothing recorded |
| Student without face reference | manual roll call works |
| Delete face reference / refuse consent / delete student | reference removed, status updated |
| Fictitious seeded profile | enrollment disabled |

Not covered automatically: a physical webcam (verify manually on the deployed site).
