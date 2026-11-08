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
