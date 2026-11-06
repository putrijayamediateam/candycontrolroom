# Decisions log (AIN)

| Date | Decision |
| --- | --- |
| 2026-11-06 | Blueprint approved (Claude Doc: https://claude.ai/artifact/XZo9miZKV4YLSM3MZx448h). |
| 2026-11-06 | Stack: TypeScript + PostgreSQL, standalone app, separate from KPOne. |
| 2026-11-06 | Build locally first; hosting decided later. |
| 2026-11-06 | Google scope: Business Profile, Drive, Calendar, YouTube/Analytics. GBP daily target configured separately (default 0). |
| 2026-11-06 | Stories are tracked separately and do NOT count toward the 3 daily feed posts per platform (Facebook, Instagram, TikTok, Threads). |
| 2026-11-06 | No separate AI API key. Staff work runs on AIN's Claude usage (Claude Code / Cowork sessions, or scheduled tasks). Consequence: work only runs while a session or scheduled task is running; the app must show this honestly. Design: the app queues `tool_jobs`; a Claude session picks them up, does the work, writes results and evidence back. |
| 2026-11-06 | AIN is the only human reviewer. No clinician on staff: health claims must carry an official online source (KKM/MOH, Tabung Haji, WHO, national immunisation handbooks), then AIN approves. Record as "source-verified, approved by AIN" — never as a doctor's sign-off. |
| 2026-11-06 | Brand palette: #fddbec, #fdcae3, #f9a6d0, #ffffff, #000000. Text black. Logo used as supplied (hot pink, `assets/logo.png`). Fonts: Poppins + Great Vibes accent (from npm @fontsource; Google Fonts is blocked in some sandboxes). |
| 2026-11-06 | Opening hours (per branch): Cheras Mon–Sun 8.00 AM–11.00 PM. Sungai Besi & Puchong Mon–Fri 8.00 AM–10.00 PM, Sat–Sun 9.00 AM–10.00 PM. |
| 2026-11-06 | Branches: Klinik Putrijaya Cheras, Sungai Besi, Puchong. |
| 2026-11-06 | Poster QR target (all posters): https://linktr.ee/qr/3cb0d33d-ae3d-4a69-bce6-aff77224d944 |
| 2026-11-06 | Posters made in both English and Malay. October Breast Ultrasound poster kept as a template, not for posting now. |
| 2026-11-06 | Candidate posting slots: 12:00, 13:00, 17:00, 20:00 MYT (preferences, not proven best times). |

## Creative batch 1 — awaiting AIN approval
CPR-20261106-001..008 (EN + MS each): Influenza (RM60, save RM10, until 31 Dec 2026), Hajj & Umrah (Basic RM85, Premium RM169, Combos A–D RM165/220/265/425), Clinic Assistant hiring (WhatsApp 019-932 4588 HR, putrijaya.jobcareer@gmail.com), October Breast Ultrasound template (RM110 / RM190).
Open: AIN to confirm prices/dates still current; Tabung Haji logo permission; consent before reusing staff photos.

## Implementation status
| Area | Status |
| --- | --- |
| Core schema, gates, approvals, delegation, CPR/DPR, publishing safety, audit | Working and verified (24 tests) |
| Poster generator + 8 posters | Working; awaiting AIN approval (CPR-20261106-001..008 loaded in AIN's local DB) |
| Auth (Argon2, hashed DB sessions, throttling, CSRF header), REST API, SSE stream with replay | Working and verified (22 API tests + local smoke test on AIN's PC, 6 Nov 2026) |
| Local run on AIN's Windows PC (Node 22, PostgreSQL 16 service, port 5433) | Working |
| Web UI: 13 screens, sign-in, first-run language step, BECOME ME panel / I'M DONE briefing, live updates, en + ms | Working and verified (8 locale/serving tests; browser walkthrough on a test copy, desktop + phone width) |
| 2D office view (accessible fallback) | Working (list built from stored staff state) |
| 3D office | Built on branch `claude/designer-team-a9dd45` (R3F, lazy chunk, 2D fallback, unit-tested mapping and pathfinding); waiting for CANDY release review and AIN release approval |
| Staff training uploads (image / video / zip, private storage/) | Working and verified (6 tests + browser check on a test copy) |
| CANDY head chat (main entry), 21 staff sub-chats, team monitor, decisions log, side panel with quick orders | Working and verified (9 tests + end-to-end browser check on a test copy) |
| Answering chats as CANDY/staff from a Claude session (`pnpm worker`, scoped WORKER_TOKEN) | Working — runs only while a Claude session is open and asked to check messages |
| Deliverable asset uploads, task blocker clearing | Planned |
| Staff execution via Claude sessions | Planned |
| Meta / TikTok / GBP publishing | Requires connection + platform app review |
| Analytics | Requires connections |
| Permanent hosting | Not decided |
| GitHub repo | Requires connection (sandbox token was invalid) |
