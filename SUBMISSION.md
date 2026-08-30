# <Project name> — Submission checklist template

Worth 2 marks on its own ("repo, URL, picks declared, fields correct" —
`brief/scoring-rubric.md` §6) and it gates the other 18 in Demo & documentation.
Copy into each problem repo as `SUBMISSION.md`, fill in, and run this list top
to bottom before the freeze.

## The five required components

`brief/rulebook.md` §8: *"A submission is complete only when all five of these
exist, for each of your two problems."*

| # | Required | Where it is | Status |
|---|---|---|---|
| 1 | Source code submitted through the submission link | this repo, pushed to `main` | ☐ uploaded via the link |
| 2 | A live URL that loads for a judge with no setup steps | <https://your-project.pages.dev> | ☐ |
| 3 | A README — what it does, how to run it, what is mocked, what next | [`README.md`](README.md) | ☐ all four questions answered |
| 4 | A demo video, **max 60 seconds** (see flag below), showing it working | record last | ☐ |
| 5 | `LICENSES.md` listing every dependency, template and asset | [`LICENSES.md`](LICENSES.md) | ☐ |
| 6 | `evaluation-manifest.json` — organizer-supplied template filled in: required declarations, per-member contributions, AI-tool use (29 Aug Discord ruling, `brief/qa-discord-29aug.md`) | repo root | ☐ template collected at 17:00, filled at freeze |

**All six must be inside the final commit pushed before 22:00 — only the
submitted commit SHA is judged; later pushes are ignored (29 Aug ruling).**
Repo name must be lowercase `lsh26-t###-p##`, one repo per problem — for us
(team LSH26-T036): `lsh26-t036-p##`.

## Video length — SETTLED: maximum 60 seconds

Official How-to-Submit doc (28 Aug, stated four times;
`brief/how-to-submit-28aug.md`). Target **50–58 s** — over 60 risks the entire
8-mark video component. `scripts/compress-video.sh` trims at 60 as a backstop.

## Video script — walk the four bullets, in order, on the live URL

Show it working. Do not explain architecture. One take, no editing needed. Fill
in the actions/lines per bullet before you record, and rehearse the click-path
once.

| Time | Do this | Say this |
|---|---|---|
| 0:00–0:08 | Load the live URL, cold. | Name the problem and the app in one sentence. |
| 0:08–0:?? | Bullet 1's action, on screen. | One line naming what just happened. |
| 0:??–0:?? | Bullet 2's action, on screen. | One line naming what just happened. |
| 0:??–0:?? | Bullet 3's action, on screen. | One line naming what just happened. |
| 0:??–0:?? | Bullet 4's action, on screen. | One line naming what just happened. |
| final ~5s | URL back on screen. | One honest "what's next" line. |

<!-- Full beat structure, worked example, and the fill-in pitch template live in
     playbook/02-pitch-60s.md — use that to write the words, use this table to
     block the timing against your actual four bullets. -->

## Before the freeze

- [ ] `npm run preflight` passes (secret scan + build + branding check)
- [ ] No template branding left: `index.html` `<title>`, meta description
- [ ] Live URL opened on a **phone**, on mobile data, core loop completed
- [ ] Any gated/logged-out view checked in a private window — no data leaks that the
      problem's bullets say should stay private
- [ ] Every demo/seed login works on the live URL, if the problem uses one
- [ ] Every `BOARD.md` row is `done-live`, and the row names the live-URL check
      that was actually performed — not just "fixed" or "looks good"
- [ ] README's MVP table matches what the video shows
- [ ] Problem picks declared in the submission form, fields correct

## Deadline mechanics

Rulebook §8: at the deadline, write access is revoked, commit history is
captured, and **every live URL gets an automated HTTP check and a full-page
screenshot**. Judging happens later against that archive — so a host that
sleeps afterwards costs nothing, but a deploy you broke in the last few minutes
is entirely on you.

The early-submission bonus is computed from the **last commit across both
repositories**, not from a form: 1.25 marks per complete 30 minutes remaining,
and **zero unless at least 3 of 4 MVP bullets verify working on each problem.**
So once the board is green, stop committing — every later push costs marks.
