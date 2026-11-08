# QA: November 2026 posters (Mei)

QA by **Nadia** (Brand, Readability and Content QA), 8 Nov 2026 (Asia/Kuala_Lumpur), before CANDY's review.
Status: **QA only**. Nothing here is an approval. AIN decides.

Files checked: `assets/posters/nov-{diabetes,prematurity,cervical,childrens-day}-{en,ms}.png`, all 2160×2700, timestamped 8 Nov 14:05.
Checked against:
- the approved copy in `content/2026-11/november-brief.md`, section 3
- branches, hours, palette, logo and QR target in `docs/DECISIONS.md`

## How I checked
- **Text, dates, footer and layout:** I opened every PNG and read it on screen.
- **Logo, palette and QR:** I measured pixels with a small PNG reader I wrote in Node for this check, since Python isn't installed on this PC. The script is in my scratchpad, not in the repo.
  - **Logo:** I compared the bounding box of the hot-pink logo with `assets/logo.png`. The aspect ratio is 3.5226 vs 3.5159 (+0.19%, rounding), so it isn't distorted. The logo box is 807–1352 × 112–266 px on all 8 posters.
  - **Palette:** I counted every colour covering more than 0.3% of the poster. On all 8, the only ones are #ffffff, #fddbec, #000000, #fdcae3 and #f9a6d0. All are palette colours. The only off-palette colour is the logo's hot pink, which is allowed because the logo is used as supplied.
  - **QR:** I took the QR square (223×223 px at x 1776, y 2335) from each November poster. I compared it, as black/white, with the QR on the earlier posters `influenza-en.png` and `haji-umrah-en.png`, which `assets/build.py` builds from `assets/qr.png`. All 8 match them exactly: 0.00% of 40,000 sample points differ. Against `assets/qr.png` itself the difference is the same 10.55% for the old and the new posters, which comes from scaling the image down. **I couldn't decode the QR on this PC** (no QR decoder installed), so the link it opens is **not verified**.
- **Day names:** None of the posters prints a day name; each shows only "DD NOVEMBER 2026". I checked the dates against the calendar: Sat 14, Sun 15, Tue 17 and Fri 20 Nov 2026, which matches the brief.

## Poster 1: World Diabetes Day, 14 Nov

### nov-diabetes-en.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | "Klinik Putrijaya" spelling | passed | Spelled exactly in the logo, the CTA and all 3 branch lines |
| 2 | Copy matches approved copy word for word | passed | Headline "Diabetes can be silent". All 3 lines and the CTA "Visit Klinik Putrijaya · Scan for our branches" match the brief exactly. No prices, promotions or extra claims. The script title "World Diabetes Day" is the official day name from brief section 1 |
| 3 | Date and day | passed | "14 NOVEMBER 2026". No day name printed; 14 Nov 2026 is a Saturday, as in the brief |
| 4 | Branches and hours | passed | Cheras, Sungai Besi and Puchong. Cheras Mon–Sun 8.00 AM–11.00 PM. Sungai Besi & Puchong Mon–Fri 8.00 AM–10.00 PM, Sat–Sun 9.00 AM–10.00 PM |
| 5 | Source line | passed | "Source: WHO" |
| 6 | Nothing cut off or overlapping; readable on a phone | passed | No clipping or overlap. Headline, lines and CTA read clearly at phone size. Footer note below |
| 7 | Palette, black text, logo | passed | Palette colours only (see method). Body text is black. Logo is not distorted (+0.19%) |
| 8 | QR | not verified | Pixels identical to the QR on the earlier posters; not decoded |

### nov-diabetes-ms.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Spelling | passed | Spelled exactly in the logo, the CTA and all 3 branch lines |
| 2 | Copy | passed | "Diabetes boleh senyap". All 3 lines and the CTA "Kunjungi Klinik Putrijaya · Imbas untuk cawangan kami" match the brief exactly. Script title "Hari Diabetes Sedunia" as in the brief's MS caption |
| 3 | Date and day | passed | "14 NOVEMBER 2026"; Saturday; no day name printed |
| 4 | Branches and hours (Malay) | passed | Cheras Isnin–Ahad 8.00 AM–11.00 PM. Sungai Besi & Puchong Isnin–Jumaat 8.00 AM–10.00 PM, Sabtu–Ahad 9.00 AM–10.00 PM. Headings "CAWANGAN" and "WAKTU BEROPERASI" |
| 5 | Source | passed | "Sumber: WHO" |
| 6 | Layout and readability | passed | No clipping or overlap |
| 7 | Palette and logo | passed | Same results as EN |
| 8 | QR | not verified | Pixels identical to the QR on the earlier posters; not decoded |

## Poster 2: World Prematurity Day, 15 Nov

### nov-prematurity-en.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Spelling | passed | Logo, CTA and 3 branch lines |
| 2 | Copy | passed | "A strong start for every baby". The lines "Around 1 in 10 babies is born before 37 weeks." / "WHO advises at least 8 antenatal contacts, starting before 12 weeks." / "Start your pregnancy check-ups early." and the CTA match the brief exactly |
| 3 | Date and day | passed | "15 NOVEMBER 2026"; Sunday; no day name printed |
| 4 | Branches and hours | passed | Same as DECISIONS, exactly |
| 5 | Source | passed | "Source: WHO" |
| 6 | Layout and readability | passed | No clipping or overlap |
| 7 | Palette and logo | passed | As above |
| 8 | QR | not verified | Pixels identical to the QR on the earlier posters; not decoded |

### nov-prematurity-ms.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Spelling | passed | Logo, CTA and 3 branch lines |
| 2 | Copy | passed | "Permulaan kukuh untuk setiap bayi". All 3 lines and the CTA match the brief exactly. **Note:** the script title "Hari Pramatang Sedunia" is still open question 4 for AIN in the brief, so the term isn't approved yet |
| 3 | Date and day | passed | "15 NOVEMBER 2026"; Sunday |
| 4 | Branches and hours (Malay) | passed | Isnin–Ahad / Isnin–Jumaat / Sabtu–Ahad, hours exact |
| 5 | Source | passed | "Sumber: WHO" |
| 6 | Layout and readability | passed, with a note | Nothing overlaps. The date pill sits only **10 px** below the logo (logo ends at y 266, pill starts at y 277), against 17–87 px on the other posters and 45 px on influenza-en. It looks tight but isn't a fault |
| 7 | Palette and logo | passed | As above |
| 8 | QR | not verified | Pixels identical to the QR on the earlier posters; not decoded |

## Poster 3: World Cervical Cancer Elimination Day, 17 Nov

### nov-cervical-en.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Spelling | passed | Logo, CTA and 3 branch lines |
| 2 | Copy | passed | "Cervical cancer can be prevented". The lines "Almost all cases are caused by HPV." / "HPV vaccine protects; screening finds changes early." / "Found early, it can be cured." and the CTA "Ask your doctor about screening · Visit Klinik Putrijaya" match the brief exactly. No claim that the clinic offers the test or vaccine |
| 3 | Date and day | passed | "17 NOVEMBER 2026"; Tuesday |
| 4 | Branches and hours | passed | Exact |
| 5 | Source | passed | "Source: WHO" |
| 6 | Layout and readability | passed | The long script title fits inside the margins. No overlap |
| 7 | Palette and logo | passed | As above |
| 8 | QR | not verified | Pixels identical to the QR on the earlier posters; not decoded |

### nov-cervical-ms.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Spelling | passed | Logo, CTA and 3 branch lines |
| 2 | Copy | passed | "Kanser serviks boleh dicegah". All 3 lines and the CTA "Tanya doktor tentang saringan · Kunjungi Klinik Putrijaya" match the brief exactly. Script title "Hari Penghapusan Kanser Serviks Sedunia" as in the brief's MS caption |
| 3 | Date and day | passed | "17 NOVEMBER 2026"; Tuesday |
| 4 | Branches and hours (Malay) | passed | Exact |
| 5 | Source | passed | "Sumber: WHO" |
| 6 | Layout and readability | passed | The script title is the widest on any poster (about x 180–1545 of 1725 on screen) but stays inside the margins. Headline fits on 2 lines |
| 7 | Palette and logo | passed | As above |
| 8 | QR | not verified | Pixels identical to the QR on the earlier posters; not decoded |

## Poster 4: World Children's Day, 20 Nov

### nov-childrens-day-en.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Spelling | passed | Logo, CTA and 3 branch lines |
| 2 | Copy | passed | "Every child, every right". The lines "20 November is World Children's Day." / "This year: "My Day. My Rights. My Future."" / "Healthy, happy children start with caring families." and the CTA "Scan for our branches · Klinik Putrijaya" match the brief exactly |
| 3 | Date and day | passed | "20 NOVEMBER 2026"; Friday |
| 4 | Branches and hours | passed | Exact |
| 5 | Source | passed | "Source: UNICEF" |
| 6 | Layout and readability | passed | "right" sits alone on the second headline line. That reads fine and isn't clipped |
| 7 | Palette and logo | passed | As above |
| 8 | QR | not verified | Pixels identical to the QR on the earlier posters; not decoded |

### nov-childrens-day-ms.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Spelling | passed | Logo, CTA and 3 branch lines |
| 2 | Copy | passed | "Setiap kanak-kanak, setiap hak". All 3 lines and the CTA "Imbas untuk cawangan kami · Klinik Putrijaya" match the brief exactly |
| 3 | Date and day | passed | "20 NOVEMBER 2026"; Friday |
| 4 | Branches and hours (Malay) | passed | Exact |
| 5 | Source | passed | "Sumber: UNICEF" |
| 6 | Layout and readability | passed | No clipping or overlap |
| 7 | Palette and logo | passed | As above |
| 8 | QR | not verified | Pixels identical to the QR on the earlier posters; not decoded |

## Notes that apply to all 8
- **Footer at phone size.** On a phone about 390 px wide, the poster shows at roughly 18% of full size. The footer hours and the source line then come out only a few pixels tall: readable when zoomed in, small at a glance. The footer is the same template as the earlier batch, so I haven't failed it. If AIN wants the hours readable without zooming, Mei could enlarge the footer text in the template for every poster.
- **Text colour.** All text is black except the CTA, which is white on a black pill. The earlier batch uses the same CTA style.
- **What I couldn't verify:** the URL the QR opens (not decoded), and whether "Hari Pramatang Sedunia" is the term AIN wants (open question 4 in the brief).

## Fixes for Mei
No check failed, so there are no required fixes. Optional:
1. `nov-prematurity-ms.png`: add space between the logo and the date pill (now 10 px; the others have 17–87 px).
2. If AIN changes the Malay name for World Prematurity Day, update the script title on `nov-prematurity-ms.png`.

## Verdict
| Poster | Verdict |
|---|---|
| nov-diabetes-en | Passed on checks 1–7; QR not verified |
| nov-diabetes-ms | Passed on checks 1–7; QR not verified |
| nov-prematurity-en | Passed on checks 1–7; QR not verified |
| nov-prematurity-ms | Passed on checks 1–7 (tight logo spacing; Malay day name still open with AIN); QR not verified |
| nov-cervical-en | Passed on checks 1–7; QR not verified |
| nov-cervical-ms | Passed on checks 1–7; QR not verified |
| nov-childrens-day-en | Passed on checks 1–7; QR not verified |
| nov-childrens-day-ms | Passed on checks 1–7; QR not verified |

To close the QR check, someone needs to scan one poster with a phone and confirm it opens https://linktr.ee/qr/3cb0d33d-ae3d-4a69-bce6-aff77224d944. AIN can do this.

---

# Deepavali greeting (urgent, for 8 Nov)

QA by **Nadia**, 8 Nov 2026, before CANDY's review. QA only; not an approval.
Files: `assets/posters/nov-deepavali-en.png` and `nov-deepavali-ms.png`, both 2160×2700.
Checked against the "Deepavali greeting" section at the top of `content/2026-11/november-brief.md`.

## How I checked
- **Text, layout and imagery:** I opened both PNGs and read them on screen.
- **Logo:** pink bounding box 807–1352 × 112–266 px on both, aspect ratio 3.5226 vs 3.5159 for `assets/logo.png` (+0.19%, rounding). Not distorted.
- **Palette:** the only colours covering more than 0.3% of the poster are #ffffff, #fddbec, #fdcae3, #000000 and #f9a6d0. Off-palette pixels make up 3.4% (EN) and 3.6% (MS), against 1.9–2.4% on the earlier posters. The extra 1.8% is the soft glow behind the three lamps, which fades from palette pink to white. The rest is anti-aliasing and the logo's hot pink, which is allowed.
- **QR:** On these posters the QR is drawn **smaller**: 160 px square at x 1848, y 2468, against 224 px on the earlier posters. That means a pixel-for-pixel comparison isn't possible. Instead I read the QR's 41×41 module grid (3.9 px per module) and compared it with `assets/qr.png` and with the earlier posters:
  - Outside the centre logo, **1511 of 1512 modules match** `assets/qr.png`. At this small size, one misread module is within what my reading can get wrong.
  - The earlier posters (influenza-en, nov-diabetes-en) match all 1512, so it's the same code.
  - I didn't decode the QR myself.

## nov-deepavali-en.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | "Klinik Putrijaya" spelling | passed | Spelled exactly in the logo and the sign-off |
| 2 | Headline, wish line, sign-off | passed | Script "Happy" plus "DEEPAVALI" = "Happy Deepavali". "May your home be filled with light, joy and togetherness." and "From all of us at Klinik Putrijaya" match exactly. The QR label "Scan for our branches" isn't in the Deepavali copy; it's the standard QR label |
| 3 | No health claims, prices or hours | passed | None. No footer with branches or hours |
| 4 | Nothing cut off or overlapping; readable on a phone | passed, with a note | No clipping or overlap. Headline, wish line and sign-off are large. The QR and its label are smaller than on the other posters (QR 160 px vs 224 px), so the QR will be harder to scan off a phone screen |
| 5 | Palette, black text, logo | passed | All text is black on white or #fddbec. Logo not distorted. The lamp glow is a pink-to-white tint (see method) |
| 6 | QR | passed | Same QR as `assets/qr.png` and the earlier posters: 1511/1512 modules match outside the logo. Not pixel-identical because it's drawn smaller. AIN verified the QR by phone on 8 Nov (per CANDY), but I don't know which poster she scanned. Scanning this poster once would confirm it at the smaller size |
| 7 | Respectful imagery | passed | Three simple oil lamps (diyas), one round kolam-style flower and outline sparkles. No religious figures, deities, symbols or text |

## nov-deepavali-ms.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Spelling | passed | Logo and sign-off |
| 2 | Headline, wish line, sign-off | passed | Script "Selamat Hari" plus "DEEPAVALI" = "Selamat Hari Deepavali". "Semoga rumah anda dipenuhi cahaya, kegembiraan dan kebersamaan." and "Daripada kami semua di Klinik Putrijaya" match exactly. QR label "Imbas untuk cawangan kami" |
| 3 | No health claims, prices or hours | passed | None |
| 4 | Layout and readability | passed, with a note | No clipping or overlap. Same small-QR note as EN |
| 5 | Palette and logo | passed | Same results as EN |
| 6 | QR | passed | Same module result as EN (1511/1512) |
| 7 | Respectful imagery | passed | Same artwork as EN |

## Fixes for Mei
Nothing failed, so there are no required fixes. Optional, only if there's time today: make the QR the same size as on the other posters (about 224 px) so it scans easily from a phone screen.

## Verdict
| Poster | Verdict |
|---|---|
| nov-deepavali-en | Passed on all 7 checks (QR smaller than usual) |
| nov-deepavali-ms | Passed on all 7 checks (QR smaller than usual) |

---

# Prediabetes video (Arjun)

QA by **Nadia**, 8 Nov 2026, before CANDY's review. QA only; not an approval.

Files:
- `assets/video/prediabetes-en.mp4`
- `assets/video/prediabetes-en-captions-only.mp4`
- `assets/video/prediabetes-en-cover.png`

Checked against:
- the "Prediabetes video (40–50s)" script in `content/2026-11/november-brief.md`
- `posters-src/video-prediabetes/captions.vtt` and `audio/beats.txt`
- the CDC page "Prediabetes: Your Chance to Prevent Type 2 Diabetes" (https://www.cdc.gov/diabetes/prevention-type-2/prediabetes-prevent-type-2.html), which I fetched myself on 8 Nov 2026 to compare quotes

## How I checked
- **Streams (ffprobe):**
  - Main file: H.264 1080×1920 at 30 fps, plus AAC 48 kHz mono audio, 48.13 s.
  - Captions-only file: H.264 1080×1920, 48.13 s, **video stream only**.
  - Cover: 1080×1920 PNG.
- **Frames:** I pulled 16 frames with ffmpeg: 0.2 s, one per caption cue, and the end card at 43.7, 46.2 and 47.9 s. I drew red guide lines at y = 220 and y = 1540, the edges of the top 220 px and bottom 380 px platform-UI zones, and read every frame. I also looked at the captions-only file at 20 s and at the cover.
- **Audio:** I can't listen, so I measured it.
  - ffmpeg `silencedetect` (−35 dB, 0.15 s minimum) finds 18 speech segments between 0.54 s and 46.80 s. Mean level is −20.4 dB, peak −2.5 dB.
  - I compared each segment with the cue times in `captions.vtt`. All 18 fall inside a cue, and no speech falls outside the cues. Each cue starts within 0.05 s of its speech, except cues that follow straight after the previous cue (for example cue 9, which shows during the half-second pause after "The good news?").
  - The pause between beats is about 1 s.
- **QR:** I read the end-card QR's module grid (41×41 modules, 8.2 px each, at x 372–707, y 865–1200) and compared it with `assets/qr.png`: **1512 of 1512 modules match** outside the centre logo, on frames at 46.2 and 47.9 s. The QR appears at about 42.1–42.3 s and stays to the end, so it's on screen for roughly 5.8 s.
- **Logo:** the pink logo's aspect ratio is within 1% of `assets/logo.png` (3.5159) on the top logo (−0.78%), the end-card logo (+0.99%) and the cover logo (−0.45%). At these small sizes that's pixel rounding and compression, so it isn't distorted.

## prediabetes-en.mp4 (voice + captions)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Mascot lines and on-screen text match the script word for word, in order | passed | The 14 caption cues together match beats 1–8 of the script word for word (each beat is split over 1–2 cues; "high…" keeps its ellipsis). The on-screen pills follow the script in order: "High sugar, no signs?" → "What is prediabetes?" → "Often no symptoms" → "Know your risk" → "Healthy changes help" → "Move 150 min a week" → "One simple test" → end card "Get your blood sugar checked at Klinik Putrijaya" + "Scan for our branches" |
| 2 | Every health line matches the CDC source; "Source: US CDC" visible; no prices, promises or patient stories | **failed (2 wording lines)** | Matches CDC: "higher than normal, but not yet type 2 diabetes" (CDC definition), "for years, with no clear symptoms", "overweight, 45 or older", "cut your risk of type 2 diabetes in half", "5 to 7 percent of your weight", "a simple blood sugar test". **Doesn't match:** (a) cue 7 "or have family with type 2 diabetes" is broader than CDC's "having a parent, brother, or sister with type 2 diabetes"; (b) cue 10 "Try **about** 150 minutes of brisk walking a week" softens CDC's "**at least** 150 minutes a week". Both lines are word for word from the suggested script, so this is a script issue, not a production error. "Source: US CDC" is visible on every frame and on the end card. No prices, promised results or patient stories |
| 3 | "Klinik Putrijaya" spelling, logo, palette | passed | Spelled exactly in the logo, caption 13 and the end card. Logo within 1% (see method). Backgrounds and mascot use the palette pinks with black text and white caption boxes; the logo's hot pink is as supplied. Exact hex values can't be measured in compressed video, so I judged this on screen |
| 4 | Nothing cut off; key text outside the top ~220 px and bottom ~380 px; captions readable | **failed** | Nothing is cut off, and the 3-line captions fit inside their box (I checked a clean crop at 9.8 s). But **the captions sit in the bottom UI zone**: the caption box runs from about y 1500–1535 to y 1715–1745, almost all below y 1540, where Instagram/TikTok put the caption, username and buttons. "Source: US CDC" at about y 1840 is also in that zone. The logo pill at about y 70–200 is in the top 220 px zone. The on-screen pills (y 300–410), the mascot and the end-card QR/CTA (card y 200–1440) are in the safe area. Captions are large (about 50 px type) and readable |
| 5 | End card: CTA, QR and "Scan for our branches" | passed | CTA "Get your blood sugar checked at Klinik Putrijaya", "Scan for our branches", QR matches 1512/1512 modules, "Source: US CDC". On screen from about 42.2 s to 48.1 s |
| 6 | 40–50 s; caption timing matches the voice beats | passed (timing) / **not verified** (spoken words) | 48.13 s. Timing matches (see method). Whether the voice says exactly the caption words, and how it sounds, needs listening: **not verified**. The VTT header says the voice is Microsoft Zira (a synthetic text-to-speech voice) |
| 7 | Mascot original and respectful | passed, with a note | A simple pink blood-drop character with a nurse cap, a pink cross, a smile and waving arms, built from `posters-src/video-prediabetes/mascot.svg`. I didn't recognise it as any known brand character, but I can't search every existing mascot. Friendly and respectful. **Note:** the nurse cap makes the mascot look like clinical staff, and there's no clinician on staff. The lines are sourced to CDC and don't claim a clinician's advice, so I've left this to AIN |

## prediabetes-en-captions-only.mp4
| # | Check | Result | Evidence |
|---|---|---|---|
| 1–5, 7 | Same visuals as the main file | same results as above (2 and 4 **failed**) | The frame at 20 s shows the same layout, pill "Know your risk" and cue 6 caption as the main file |
| 6 | Duration; no audio stream | passed | 48.13 s; ffprobe lists only stream 0 (h264 video), no audio stream |

## prediabetes-en-cover.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Text matches | passed | Pill "High sugar, no signs?" and caption "Did you know your blood sugar can be high…", both from beat 1 |
| 2 | Source, no claims | passed | "Source: US CDC". No prices or promises |
| 3 | Spelling, logo, palette | passed | Logo within 0.45%; palette pinks, black text |
| 4 | Safe zones | **failed** | Same layout as the video: caption box at y 1535–1715 and source at about y 1840 are in the bottom zone; logo at y 75–195 is in the top zone. In a 4:5 grid crop (y 285–1635) the caption box gets cut through the middle |
| 5 | QR | n/a | The cover has no QR, and the brief doesn't ask for one |
| 7 | Mascot | passed | As above |

## Fixes for Arjun
1. **Safe zones (video, captions-only video and cover):**
   - Move the caption box up so its bottom edge is at or above y 1540. For example, place it at about y 1330–1520 and make the mascot a little smaller or raise it.
   - Move "Source: US CDC" above y 1540 too, for example just under the caption box or under the top pill.
   - Move the logo pill down so its top is below y 220, for example y 230–350, and shift the top text pill down to match.
2. **Health wording (needs Iman and AIN first, because it changes the suggested script):**
   - Cue 7 / beat 4: "or have family with type 2 diabetes" → "or have a parent, brother or sister with type 2 diabetes".
   - Cue 10 / beat 6: "Try about 150 minutes of brisk walking a week." → "Try at least 150 minutes of brisk walking a week."
   - Then re-voice beats 4 and 6, update `captions.vtt` and the matching on-screen text, and re-render both videos.
   - If AIN accepts the current wording instead, only fix 1 is needed.
3. After the re-render, ask me to re-check the timing and safe zones. Someone should also listen to the voice once, because I can't verify the audio by ear.

## Verdict
| File | Verdict |
|---|---|
| prediabetes-en.mp4 | **Failed** on check 4 (captions, source line and logo in the platform-UI zones) and check 2 (two lines softer or broader than CDC). Checks 1, 3, 5 and 7 passed; check 6 passed on timing and duration, spoken words not verified |
| prediabetes-en-captions-only.mp4 | **Failed** on checks 2 and 4 (same visuals). No audio stream, as required |
| prediabetes-en-cover.png | **Failed** on check 4 (safe zones). Text, source, spelling, logo and mascot passed |

---

# Prediabetes video — re-check (Arjun's re-export)

Re-check by **Nadia**, 8 Nov 2026, of the re-exported files at the same paths (MP4s 16:33–16:34, cover 16:34), with the same method as the first QA. QA only; not an approval.
Checked against:
- the updated `captions.vtt`
- the brief's script with the CANDY correction note (beats 4 and 6)
- the CDC page I fetched earlier today

## How I checked
- **Streams:** both MP4s are 49.77 s, H.264 1080×1920 at 30 fps. The main file has AAC 48 kHz mono audio (mean −20.4 dB, peak −2.1 dB). The captions-only file has **no audio stream**. ffmpeg `psnr` between the two videos is **infinite** on every frame, so the pictures are pixel-identical and the only difference is the audio.
- **Frames:** 16 frames: 0.2 s, one per caption cue (1.8, 3.8, 6.0, 9.8, 14.4, 18.4, 22.7, 25.8, 28.8, 33.5, 37.7, 41.7, 45.4 s) and the end card at 47.9 and 49.6 s. I drew red guide lines at y 220 and y 1540 and read every frame. I also checked the cover, and its 4:5 grid crop (y 285–1635).
- **Edges, measured on the clean frames:**
  - The topmost logo or black pixel is at **y 258** (y 262 on the end card).
  - The lowest black pixel is at **y 1518** on every frame and the cover. That is the bottom of "Source: US CDC"; the caption boxes end higher, at about y 1475.
  - The end-card mascot ends at about y 1470.
  - The only things outside y 220–1540 are the moving background words and the thin border of the end-card panel at about y 200, which are decoration.
- **Audio vs captions:** `silencedetect` (−35 dB, 0.15 s) finds 20 speech segments between 0.54 s and 48.41 s.
  - All 20 fall inside a cue of the new `captions.vtt`, and no speech falls outside the cues.
  - Cue 7 (20.506–24.896 s) contains three speech segments, 20.73–24.61 s, for the longer "parent, brother or sister" line.
  - Cue 10 (31.336–35.636 s) contains speech 31.38–35.15 s.
  - Each cue starts within 0.05 s of its speech, except cues that follow straight after the previous cue.
- **QR:** the end-card QR's module grid (41×41 modules, 7.0 px each, at x 396–683, y 790–1077) matches `assets/qr.png` on **1512 of 1512** modules outside the centre logo, at 45.4, 47.9 and 49.6 s. It appears at about 43.8–44.0 s, so it's on screen for about the last 5.8–6 s.
- **Logo:** aspect ratio vs `assets/logo.png`: top logo −0.83%, end-card logo +1.13%, cover logo −0.45%. That's pixel rounding at these sizes, so it isn't distorted.

## prediabetes-en.mp4
| # | Check | Result | Evidence |
|---|---|---|---|
| 2 | Health lines match CDC; "Source: US CDC"; no prices, promises or stories | **passed** | Cue 7 now reads "or have a parent, brother or sister with type 2 diabetes.", matching CDC's "Having a parent, brother, or sister with type 2 diabetes". Cue 10 now reads "Try at least 150 minutes of brisk walking a week.", matching CDC's "at least 150 minutes a week of brisk walking". The other health lines are unchanged and match CDC (see first QA). "Source: US CDC" is visible on every frame and the end card. No prices, promises or patient stories |
| 4 | Key text between y 220 and y 1540; nothing cut off; captions readable | **passed** | Measured: topmost key pixel y 258, lowest y 1518, on all 16 frames. Logo pill, top text pill (about y 390–500), mascot, caption box (about y 1240–1475), source line (about y 1500–1518) and end card are all inside the safe area. Nothing is clipped; 3-line captions fit their box. Captions are large and readable |
| 6 | 40–50 s; caption timing matches the voice beats | **passed** (duration and timing) / **not verified** (spoken words) | 49.77 s. 20 of 20 speech segments fall inside their cues (see method). Whether the voice says exactly the new caption words, and how it sounds, is **not verified**; AIN will listen |
| 1 | Spot-check: text matches script, in order | passed | All 14 cues match the corrected script, word for word and in order. The on-screen pills are unchanged and in order ("High sugar, no signs?" → … → "One simple test"). The end card reads "Get your blood sugar checked at Klinik Putrijaya" + "Scan for our branches" |
| 3 | Spot-check: spelling, logo, palette | passed | Spelled exactly; logo within about 1%; same palette pinks with black text |
| 5 | Spot-check: end card | passed | CTA, "Scan for our branches", QR 1512/1512 modules, "Source: US CDC". About 6 s on screen |
| 7 | Spot-check: mascot | passed, with the same note | Same mascot, slightly smaller. The note about the nurse cap reading as clinical staff still stands for AIN |

## prediabetes-en-captions-only.mp4
| # | Check | Result | Evidence |
|---|---|---|---|
| 1–5, 7 | Same visuals | passed (same as main file) | Video pixel-identical to the main file (PSNR infinite on every frame); cue 7 crop at 22.7 s identical |
| 6 | Duration; no audio stream | passed | 49.77 s; ffprobe lists only stream 0 (h264) |

## prediabetes-en-cover.png
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Text | passed | "High sugar, no signs?" + "Did you know your blood sugar can be high…" |
| 2 | Source, no claims | passed | "Source: US CDC" |
| 3 | Spelling, logo, palette | passed | Logo −0.45% |
| 4 | Safe zones, including the 4:5 crop | **passed, with a note** | In the 9:16 cover, key content spans y 258–1518. In the 4:5 grid crop (y 285–1635), the top pill, mascot, caption and source line are all whole. The logo pill (about y 236–356) is cut at the top edge of the crop, so only its lower half shows in a 4:5 grid tile. The full logo shows when the cover opens. This is cosmetic, not a failure |
| 7 | Mascot | passed | As above |

## Fixes for Arjun
None required. Optional: if AIN wants the full logo visible in the 4:5 profile-grid tile, move the cover's logo pill down to about y 300 or lower. That affects the cover only.

## Verdict
| File | Verdict |
|---|---|
| prediabetes-en.mp4 | **Passed** on checks 1–5 and 7, and on check 6 for duration and timing. Spoken words not verified (AIN will listen) |
| prediabetes-en-captions-only.mp4 | **Passed** on all checks; no audio stream, as required |
| prediabetes-en-cover.png | **Passed** (the logo is cut in the 4:5 grid crop; optional fix) |

---

# November posters v2 (Mei)

QA by **Nadia**, 8 Nov 2026, before CANDY's review. QA only; not an approval.
Files: `assets/posters/nov-{diabetes,prematurity,cervical,childrens-day}-{en,ms}-v2.png`, all 2160×2700, timestamped 8 Nov 16:40. The originals without -v2 (already in AIN's inbox) were not re-checked.
Checked against:
- section 3 of `content/2026-11/november-brief.md`, with the updated CTAs for posters 1–3 and poster 4 unchanged
- the "Hari Bayi Pramatang Sedunia" recommendation in the brief
- `docs/DECISIONS.md`

## How I checked
- **Text, dates, footer and layout:** I opened all 8 PNGs and read them on screen.
- **Pixels (same Node PNG reader as before):**
  - **QR:** the 223×223 px QR at x 1776, y 2335 is identical in black and white to the earlier posters (influenza-en, which is built from `assets/qr.png`): **0.00%** of 40,000 sample points differ on all 8. That's the same QR AIN verified by phone on 8 Nov (per CANDY).
  - **Logo:** bounding box 807–1352 × 112–266 px on all 8, aspect ratio +0.19% vs `assets/logo.png`. Not distorted.
  - **Palette:** the colours covering more than 0.3% of each poster are only #ffffff, #fddbec, #000000, #fdcae3 and #f9a6d0. Off-palette pixels make up 2.3–2.7% (anti-aliasing and the logo's hot pink), against 2.4% on v1.
  - **New illustration band:** the illustration sits at y ≈ 350–600. It's 84–135 px below the logo and **23–34 px above the date pill**. Nothing overlaps.
- **Illustration source:** `posters-src/november/gen.mjs` draws the four illustrations (`meter`, `baby`, `vial`, `balloons`) as hand-written inline SVG shapes (circles, paths) in the palette with black outlines. The code comment says "Original vector illustrations (Mei), palette only, black outlines. No photos, no real people." I found no imported images or stock files for them; the only images loaded are the logo and the QR.
- **Day names:** none printed (only "DD NOVEMBER 2026"). Sat 14, Sun 15, Tue 17 and Fri 20 Nov 2026, as in the brief.

## Results per poster
Checks: (1) spelling, (2) copy word for word, (3) date, (4) branches and hours, (5) source line, (6) nothing cut off / readable, (7) palette and logo, (8) QR, (9) illustration.

### nov-diabetes-en-v2.png
| # | Result | Evidence |
|---|---|---|
| 1 | passed | "Klinik Putrijaya" spelled exactly in the logo, the CTA and the 3 branch lines |
| 2 | passed | Headline "Diabetes can be silent" and all 3 lines match the brief. **New CTA "Get your blood sugar checked at Klinik Putrijaya · Scan for our branches"** matches word for word. No prices or promotions |
| 3 | passed | "14 NOVEMBER 2026" (Saturday) |
| 4 | passed | Cheras Mon–Sun 8.00 AM–11.00 PM; Sungai Besi & Puchong Mon–Fri 8.00 AM–10.00 PM, Sat–Sun 9.00 AM–10.00 PM |
| 5 | passed | "Source: WHO" |
| 6 | passed, with a note | Nothing cut off or overlapping; the headline now fits on one line. The CTA wraps onto 2 lines and splits "Scan for / our branches" mid-phrase, which reads awkwardly (optional fix below) |
| 7 | passed | Palette only; logo +0.19% |
| 8 | passed | QR identical to the verified QR (0.00%) |
| 9 | passed | A glucose meter with a drop of blood, a pink drop and sparkles. Original line art, no people. It fits the "get your blood sugar checked" CTA and claims no result, since AIN confirmed that most branches offer glucose checks |

### nov-diabetes-ms-v2.png
| # | Result | Evidence |
|---|---|---|
| 1 | passed | Logo, CTA, 3 branch lines |
| 2 | passed | "Diabetes boleh senyap" and all 3 lines match. **New CTA "Periksa paras gula darah di Klinik Putrijaya · Imbas untuk cawangan kami"** matches word for word |
| 3 | passed | "14 NOVEMBER 2026" |
| 4 | passed | Isnin–Ahad / Isnin–Jumaat / Sabtu–Ahad; hours exact; "CAWANGAN" and "WAKTU BEROPERASI" |
| 5 | passed | "Sumber: WHO" |
| 6 | passed, with a note | Nothing cut off. The CTA wraps as "Imbas untuk / cawangan kami", splitting the phrase (optional fix below) |
| 7 | passed | As above |
| 8 | passed | 0.00% |
| 9 | passed | Same illustration as EN |

### nov-prematurity-en-v2.png
| # | Result | Evidence |
|---|---|---|
| 1 | passed | Logo, CTA, 3 branch lines |
| 2 | passed | "A strong start for every baby" and all 3 lines match. **New CTA "Start your antenatal check-ups at Klinik Putrijaya"** matches word for word |
| 3 | passed | "15 NOVEMBER 2026" (Sunday) |
| 4 | passed | Exact |
| 5 | passed | "Source: WHO" |
| 6 | passed | Nothing cut off. The headline wraps with "baby" alone on line 2, which reads fine. The CTA fits on 1 line |
| 7 | passed | As above |
| 8 | passed | 0.00% |
| 9 | passed | A sleeping cartoon baby swaddled in pink, with a heart and sparkles. Drawn, not a photo of a real person. Gentle and respectful; no medical claim (no incubator or clinical equipment) |

### nov-prematurity-ms-v2.png
| # | Result | Evidence |
|---|---|---|
| 1 | passed | Logo, CTA, 3 branch lines |
| 2 | passed | "Permulaan kukuh untuk setiap bayi" and all 3 lines match. **New CTA "Mulakan pemeriksaan antenatal di Klinik Putrijaya"** matches word for word. **The script title reads "Hari Bayi Pramatang Sedunia"**, as recommended in the brief. AIN still approves the final name |
| 3 | passed | "15 NOVEMBER 2026" |
| 4 | passed | Malay day names and hours exact |
| 5 | passed | "Sumber: WHO" |
| 6 | passed | The script title fits, with margins of 339 px left and 330 px right of 2160. The logo-to-date-pill spacing that was tight on v1 (10 px) is fixed: the illustration now sits between them, 135 px below the logo and 34 px above the pill |
| 7 | passed | As above |
| 8 | passed | 0.00% |
| 9 | passed | Same illustration as EN |

### nov-cervical-en-v2.png
| # | Result | Evidence |
|---|---|---|
| 1 | passed | Logo, CTA, 3 branch lines |
| 2 | passed | "Cervical cancer can be prevented" and all 3 lines match. **New CTA "Ask about cervical screening and the HPV vaccine at Klinik Putrijaya"** matches word for word (2 lines, wrapped at "at / Klinik Putrijaya") |
| 3 | passed | "17 NOVEMBER 2026" (Tuesday) |
| 4 | passed | Exact |
| 5 | passed | "Source: WHO" |
| 6 | passed | The long script title fits (margins 191 px and 311 px; the "y" in "Day" reaches furthest right). The second line of the HPV text now fits on one line |
| 7 | passed | As above |
| 8 | passed | 0.00% |
| 9 | passed, with a note | A vaccine vial with a plus sign, and a pink shield with a check mark. Original line art, no people. The shield with a tick sits next to the vial, which visually echoes the approved WHO line "HPV vaccine protects". It doesn't add a claim beyond the copy, but it can read as "the vaccine guarantees protection". I've left that for AIN to judge |

### nov-cervical-ms-v2.png
| # | Result | Evidence |
|---|---|---|
| 1 | passed | Logo, CTA, 3 branch lines |
| 2 | passed | "Kanser serviks boleh dicegah" and all 3 lines match. **New CTA "Tanya tentang saringan serviks dan vaksin HPV di Klinik Putrijaya"** matches word for word |
| 3 | passed | "17 NOVEMBER 2026" |
| 4 | passed | Malay day names and hours exact |
| 5 | passed | "Sumber: WHO" |
| 6 | passed | Script title margins 231 px and 284 px |
| 7 | passed | As above |
| 8 | passed | 0.00% |
| 9 | passed, with the same note | Same illustration as EN |

### nov-childrens-day-en-v2.png
| # | Result | Evidence |
|---|---|---|
| 1 | passed | Logo, CTA, 3 branch lines |
| 2 | passed (**unchanged from v1**) | "Every child, every right", the 3 lines and the CTA "Scan for our branches · Klinik Putrijaya" are word for word the same as v1 and the brief |
| 3 | passed | "20 NOVEMBER 2026" (Friday) |
| 4 | passed | Exact |
| 5 | passed | "Source: UNICEF" |
| 6 | passed | Nothing cut off |
| 7 | passed | As above |
| 8 | passed | 0.00% |
| 9 | passed | Three pink and white balloons tied together, with sparkles. Festive, no people, no medical content |

### nov-childrens-day-ms-v2.png
| # | Result | Evidence |
|---|---|---|
| 1 | passed | Logo, CTA, 3 branch lines |
| 2 | passed (**unchanged from v1**) | "Setiap kanak-kanak, setiap hak", the 3 lines and the CTA "Imbas untuk cawangan kami · Klinik Putrijaya" are the same as v1 and the brief |
| 3 | passed | "20 NOVEMBER 2026" |
| 4 | passed | Malay day names and hours exact |
| 5 | passed | "Sumber: UNICEF" |
| 6 | passed | Nothing cut off |
| 7 | passed | As above |
| 8 | passed | 0.00% |
| 9 | passed | Same illustration as EN |

## Fixes for Mei
Nothing failed, so no fixes are required. Optional:
1. `nov-diabetes-en-v2` and `nov-diabetes-ms-v2`: break the CTA at the "·" so each phrase stays whole: "Get your blood sugar checked at Klinik Putrijaya / Scan for our branches" and "Periksa paras gula darah di Klinik Putrijaya / Imbas untuk cawangan kami".
2. The gap between the illustration and the date pill is 23–34 px on all 8. It doesn't overlap, but a little more space would look less crowded.

The footer note from the v1 QA still applies: the hours are small at phone size, as on every poster in this template.

## Verdict
| File | Verdict |
|---|---|
| nov-diabetes-en-v2 | Passed on all 9 checks (CTA line break is an optional fix) |
| nov-diabetes-ms-v2 | Passed on all 9 checks (CTA line break is an optional fix) |
| nov-prematurity-en-v2 | Passed on all 9 checks |
| nov-prematurity-ms-v2 | Passed on all 9 checks; "Hari Bayi Pramatang Sedunia" fits; final name for AIN |
| nov-cervical-en-v2 | Passed on all 9 checks (shield-and-vial note for AIN) |
| nov-cervical-ms-v2 | Passed on all 9 checks (shield-and-vial note for AIN) |
| nov-childrens-day-en-v2 | Passed on all 9 checks; wording unchanged from v1 |
| nov-childrens-day-ms-v2 | Passed on all 9 checks; wording unchanged from v1 |
