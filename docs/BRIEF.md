# CANDY CONTROL ROOM — Requirements brief (from AIN, 6 Nov 2026)

Condensed faithfully from AIN's original brief. Where `docs/DECISIONS.md` differs, DECISIONS.md wins (it is newer).

## 0. Purpose
A working operating system for AIN's creative work at Klinik Putrijaya, not a decorative dashboard or a chatbot dressed as an office. AIN directs and trains AI staff. CANDY (female team leader, final internal reviewer) consolidates all staff updates and reports to AIN. AIN is the human owner and final authority except permissions she explicitly delegates. The animated office must reflect real workflow events. Always distinguish real execution, user-reported activity, proposed tools, disconnected integrations, and demo data.

## 1. Business context and daily output
- Name: Klinik Putrijaya (exact). Timezone Asia/Kuala_Lumpur; store precise timestamps consistently.
- Default language ENGLISH ONLY across UI, setup, CANDY briefings, staff chats, notifications, reports, docs, seeds, generated content. Never auto-switch to Malay because of location, names, or Malay sources.
- Onboarding offers English (preselected) and Malay. Settings > Language keeps two separate settings: Interface + Staff Communication, and Default Content Language. Per task/campaign/caption/subtitle/platform-variant override; unset inherits. Real locale resources (en, ms). Persist across refresh/sign-in. BECOME ME and I'M DONE recognisable in both locales. Preserve original wording of sources and history. Switching never rewrites or republishes approved/published assets; translation = new reviewable version. Language never changes the scheduling timezone.
- Brand: white, restrained clinic pink, black/charcoal text, readable, minimalist, professional and approachable.
- Audiences: pregnant mothers, families, parents, baby care, postpartum mothers, general health seekers, weight management. Not every campaign women-only.
- Daily target: at least 3 approved posts on EACH of Facebook, Instagram, TikTok, Threads (12 entries/day), possibly adapted from 3 master concepts. A concept counts per destination only with its own confirmed outcome.
- Google: GBP target configurable independently.
- Candidate slots 12:00, 13:00, 17:00, 20:00 MYT; choose 3+ per platform; compare with real analytics later. No double-posting to fill an elapsed slot without AIN's decision.
- Formats — Facebook: video, text, poster/image, Story. Instagram: Reel, poster/image, carousel, Story. TikTok: video, photo carousel/slides where supported, Story where supported. Threads: text PSA, useful info, trend-led posts, images, video where supported. GBP: supported updates, media, review replies.
- Feed and Stories tracked separately; Stories count only if configured. Never publish unapproved, duplicate, unsupported, or poor content to hit a number.

## 2. Hierarchy (21 AI staff + AIN)
AIN (human) → CANDY (AI Operations Director and Creative Lead) →
- Strategy and Content: Adam (Digital Marketing Strategist), Sara (Content Planner and Researcher), Iman (Copywriter and Scriptwriter)
- Creative Production: Mei (Graphic Designer), Farah (Video Producer and Storyboard Artist), Arjun (Video Editor), Chloe (Motion, Captions, and Audio Specialist)
- Publishing and Community: Daniel (Social Media Manager and Publisher), Kavitha (Community and Review Manager)
- Quality and Performance: Nadia (Brand, Readability, and Content QA), Hakim (Analytics and Performance)
- Systems: Ben (Integration and Workflow Engineer)
- Designer Team (via Alex): Alex (Product/UX Designer and Lead), Aisha (UI and Design System), Ethan (Frontend), Ravi (Backend and AI Workflow), Zoe (3D Character and Environment Artist), Marcus (3D Animation and Interaction), Lina (Quality, Accessibility, Localization), Ryan (DevOps and Release)
12 operational + 8 Designer Team + CANDY = 21. Editable fictional personas; appearance never implies permissions. Rename, restyle, retrain, pause, reassign. CANDY understands all areas but never pretends to inspect assets she cannot access or to have medical expertise.

Role duties (summary):
- Adam: strategies, audiences, pillars, hooks, CTAs, tests; trends only with current evidence; paid plans proposed, never spend without permission.
- Sara: annual→daily calendars; verified Malaysian occasions/holidays/observances with source URL, verification date, relevance, official vs informal; health education outlines.
- Iman: titles, captions, scripts, CTAs, variants; clear natural English by default; no cringe/jargon/unsupported claims; alternatives and focused questions.
- Mei: layout sketch before final; minimalist posters/carousels; preserve exact approved wording on redesign; editable sources where tools allow.
- Farah: preproduction (script breakdown, storyboard, shot list, checklists); request and track human footage; never claims to record people.
- Arjun: assemble footage, cut fillers/pauses, pacing, reframe, colour correct, preserve real features and skin tone; logo; exports. Logo doesn't prevent copying.
- Chloe: timed captions, translations, motion, audio; legibility checks; music rights; human verification of uncertain medical transcription.
- Daniel: platform adaptation, schedule, destination checks, supported publishing, real results; manual packages when unsupported; never mark Published from a click or queue.
- Kavitha: triage comments/DMs/reviews (connected or imported); warm replies; escalate; no patient details, diagnoses, invented availability, fake reviews; never delete negative feedback or send unapproved replies.
- Nadia: spelling, brand name, prices/dates, readability, CTA, facts, logo, layout, captions, sources, consent, gates; on actual rendered assets; evidence per check; flag unverified.
- Hakim: real counts and metrics; observations vs hypotheses; show missing/stale data; never imaginary graphs.
- Ben: integration configs, health, capability checks, alerts, recovery; suggest connections with cost/permissions; never install, grant, change credentials, or destroy without authorization.
- Alex: journeys, wireframes, specs, priorities; coordinates Designer Team; usability review; recommends, CANDY reviews, AIN approves.
- Aisha: screens, tokens, components, states; EN and MS layout states.
- Ethan: implements screens and live panels; real server actions; localization; accessibility; 2D fallback; panels usable without 3D.
- Ravi: models, APIs, auth, orchestration, memory boundaries, queues, dependencies, events, version-bound approvals, delegation correctness, audit, idempotency, server policy. No unrestricted shell/deploy/secret/DB access.
- Zoe: Malaysian avatars, hijab variants, office assets, provenance records.
- Marcus: rendering, camera, pathfinding, walking/sitting/gestures, event-mapped animation, reduced motion, low-performance mode; never invents activity.
- Lina: tests workflows, approvals, delegation races, permissions, previews, localization, recovery, accessibility, regressions.
- Ryan: environments, CI, deployment, monitoring, backup/restore, rollback, release evidence; prod deploys, destructive migrations, paid infra, credential changes need explicit authorization (BECOME ME never grants them).
Human dependencies: AIN approvals; real humans provide footage, consent, source materials. (Clinical review: see DECISIONS.md.)

## 2A. Designer Studio
Workspace for system-design requests, defects, features, character/office changes. Shows 8-person roster, assignments, dependencies, tools, deliverables, decisions, blockers, questions via Alex and CANDY; wireframe/3D previews, code diffs, test evidence, release previews, before/after. Tools stay "suggested" until connected. Flow: Request → UX/Technical Brief → Wireframe/Design → CANDY Review → AIN Design Approval → Implementation → Testing → CANDY Release Review → AIN Release Approval → Released/Verified. Design approval, implement permission, release permission are distinct. DPR-YYYYMMDD-001 IDs; real repo PRs linked only when they exist. Start with empty backlog and honest Not Briefed/Idle states.

## 3. Training and conversations
Profile per staff: role, deliverables, skills, preferred tools, allowed/prohibited actions, assignments, capacity, reporting route. Brief/Train screen; versioned instructions, approved/rejected examples, corrections, change history; role memory + shared approved brand knowledge (no silent promotion of tentative remarks); propose memory updates for approval; task chat visible to CANDY; acknowledgement + missing info. Brief one, a department, or all. Onboarding: Not Briefed, Learning, Ready, Needs Clarification. CANDY flags conflicts for AIN. Questions include task, why it matters, recommended assumption, answer field; CANDY bundles into digests; answers stored against the task.

## 4. Main UX
Desktop command-centre; nav: Overview, Team and Training, Work Board, Approval Inbox, Daily Pull Requests, Content Calendar, Asset Library, Community Inbox, Performance, Integrations, Activity and Delegation Log, Designer Studio, Settings (incl. language). Overview: greeting, MYT date/time, Manual/Delegated mode, CANDY briefing, per-platform counters (planned, awaiting review, approved, scheduled, published, failed, shortfall), today's slots, notifications, team/tool panel, persistent 3D side preview with Designer wing. Every button works or explains what's missing; empty/loading/error/retry states; never show disconnected as connected.

## 5. Workflows
Templates: poster, carousel, short video, text/PSA, campaign announcement, review reply, technical change. Flow: Brief → Research → Copy/Script → Sketch/Storyboard → Production → Editing/Design → QA → CANDY Review → Awaiting AIN Approval → Approved → Scheduled → Publishing → Published → Performance Review. Side states: Needs Information, Awaiting Human Footage, Awaiting Clinical Review, Changes Requested, Blocked, Failed, Cancelled, Archived. Task fields: ID, title, objective, campaign, owner, collaborators, platforms, audience, language, deadline, priority, MYT slot, brief, sources, promo terms, CTA, copy, layout, footage, versions, exports, variants, checklist evidence, consent, CANDY recommendation, AIN decision, comments, dependencies, handoffs, blockers, next action, linked daily PR. Staff statuses: Idle, Planning, Drafting, Designing, Recording Awaited, Editing, Coding, Testing, Reviewing, Asking AIN, Waiting Approval, Handoff, Preparing Release, Released/Verified, Blocked, Offline. Tool labels: verified / user-reported / suggested / not connected or stale. Job ID, last update, tool, step, next step, ETA only with basis. Never inspect AIN's computer without authorization; no fake progress.

## 6. Approvals and daily PR list
CPR (creative) and DPR (design/dev) review requests; combined daily list with filters; server-generated IDs; fields: title, staff, platform, time, version, summary, CANDY review, approvals, reviewer, decision, reason, status. Detail view shows actual previews, video, captions, copy, destination, schedule, evidence, diffs. Actions: Approve, Request Changes, Reject, Ask Question, Reschedule. Bulk approval lists exact items/versions. Changes invalidate approvals. CANDY reviews before AIN. No self-approval. Daily summaries from stored records by MYT date; CSV/JSON export; handover report; stable empty state.

## 7. BECOME ME / I'M DONE
MANUAL default; inactivity never grants authority. BECOME ME: button (and exact phrase in authenticated command input only); panel to choose actions, campaigns/platforms, content types, expiry, pending vs new; separate internal approval, scheduling, publishing, replies, spending. Suggested initial scope: internal approval of compliant work with all checks. Record grantor, time, policy version, expiry. DELEGATED: CANDY acts only within scope after all gates; checks immediately before every approval and side effect; escalate out-of-scope, new clinical claims, unverified pricing, patient matters, ad spend, access changes, destructive actions. Audit: "Approved by CANDY under AIN's delegation". Banner, timer, count, Stop Delegation. I'M DONE: revoke atomically vs concurrent jobs; queued delegated-only side effects pause; in-flight reported honestly; separate Pause Publishing; return briefing listing every delegated action, failure, block, pending and in-flight item; acknowledge + follow-ups. Correct across refresh, sign-out, restarts, tabs; no browser-only flags.

## 8. 3D office
Real WebGL/Three.js, isometric, orbit/zoom; accessible 2D fallback. Desks, monitors, chairs, creative corner, storyboard wall, review table, CANDY station, Designer Team wing (8 workstations, review board, preview screen, build/test station). All 21 staff as distinct respectful Malaysian personas (varied skin tones, hair/hijab, clothing; editable). Names and role labels; not colour-only. Events: job start → walk, sit, work; handoff → walk to recipient + gesture (incl. Alex→Aisha, Aisha→Ethan, Zoe→Marcus, Ravi/Ethan→Lina); CANDY review → review table; waiting → indicator; blocked → marker; complete → subtle feedback then idle. Pathfinding avoids furniture/people. Click person → profile/task/status/tool/handoffs/questions; click department → filter. Rebuild from stored state. Pause, reduced motion, camera reset, low-performance mode; mobile Office tab.

## 9. Content quality
Approved clinic facts stored separately from drafts. Never guess prices, hours, phones, promos, medical claims. Authoritative sources with provenance and freshness. Never invent patient stories, before/after, consent, testimonials, guarantees, slots. Consent/rights records for identifiable images and third-party assets. Sensitive patient messages out of general memory. Final review: mobile readability, hierarchy, spelling, exact copy, logo, captions, audio, aspect ratio, platform, CTA, dates, records.

## 10. Integrations
Connect one at a time; optional ones skippable with manual workflows. Categories: AI execution (see DECISIONS.md), brand files/footage (uploads or Drive), creative tools (Canva, image gen, transcription, FFmpeg), publishing (Meta, TikTok, Threads, GBP or a verified scheduler), planning (Calendar, Sheets, analytics), notifications, Designer tools (design, 3D, GitHub, tests, hosting). Each: use case, operations, account type, permissions, costs, data shared, setup, status, last check, revoke. Verify official docs before provider code; capability matrix per account; unsupported → manual handoff, no browser automation. Never ask for passwords in chat; OAuth; encrypted secret store; ask before paid commitments.

## 11. Technical foundations
Real auth and server-side authorization; AI personas are not logins. Durable records for everything listed (staff, instructions, language prefs, campaigns, tasks, dependencies, conversations, questions, sources, assets/versions, QA, CPR/DPR, approvals, delegation, posts, connections, jobs, notifications, append-only audit, design specs, test runs, release candidates, repo PR links). Private storage, signed URLs, upload validation, backups, retention. Workers: agent jobs, rendering, scheduled publishing, capability sync, daily summaries. Orchestration: role-scoped prompts/context/tools, validated outputs, handoffs, dependencies, stops for human input. Bounded retries, idempotency, cost/rate limits, cancellation, heartbeats, backlog. Real-time events with reconnection. Scheduler safety and reconciliation. Prompt-injection resistance. Least privilege; no compliance promises without assessment. Demo vs Connected modes clearly separated.

## 12. Deliverables
Source, migrations, .env example, setup/deploy + worker docs, synthetic demo data, capability matrix, AIN user guide, sample tasks (poster, video, carousel/PSA, reply, Designer Team improvement with wireframe, implementation evidence, QA, CANDY review, AIN decision), visible status table (Working and verified / Manual available / Requires connection / Blocked / Planned).

## 13. Acceptance checks (25)
1 brief, assign, train, versioned instructions persist · 2 question → CANDY summary → answer resumes task · 3 templates follow workflows and dependencies · 4 CANDY can't pass incomplete work; blockers visible · 5 inspect, approve, request changes, re-review; edits invalidate · 6 daily PR list from stored records, MYT dates, export · 7 Manual requires AIN; inactivity never delegates · 8 BECOME ME explicit scoped; out-of-scope blocked · 9 delegated actions attributed with reason and version · 10 I'M DONE and expiry stop delegation across tabs/workers; queued and concurrent cases · 11 return briefing complete · 12 per-platform 3/day targets; GBP and Story configurable · 13 confirmed results only; no double publish · 14 disconnected/unsupported → real capability + manual fallback · 15 tool labels honest · 16 all 21 in 3D office, events drive animation, clicks open profiles · 17 reduced motion, mobile, keyboard, contrast, 2D fallback · 18 reopen reconstructs state; jobs run only with workers · 19 unauthorized, injected, missing gates, expired credentials, provider failures handled safely · 20 docs state what works, costs, pause/recovery · 21 fresh account all English · 22 EN/MS in onboarding and settings; independent; persistent; no rewriting history · 23 Designer Team profiles editable, report via Alex · 24 DPR flow end to end with real links only · 25 content delegation grants no deploy/migration/spend/credential power.
