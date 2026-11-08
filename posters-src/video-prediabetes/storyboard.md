# Prediabetes awareness video — storyboard (Farah)

Klinik Putrijaya · 8 Nov 2026 · Status: **draft for CANDY QA and AIN's review**. Nothing is approved or published.

- Format: 1080×1920 vertical (Reels / TikTok / Stories), 48.1 s total, 42.6 s of speech.
- Script: Iman's "Prediabetes video" section in `content/2026-11/november-brief.md`, word for word. Facts: US CDC (Sara).
- Talent: the original mascot (working name **Ceria**, pending AIN's approval), drawn in SVG (`mascot.svg`). It's all animation, with no filmed or recorded people.
- Voice: the main version uses the built-in Windows voice "Microsoft Zira Desktop" at rate -1, made per beat with System.Speech (`audio/beat1–8.wav`, joined into `audio/voice.wav`). A captions-only copy has no audio. AIN still chooses which one to use. Beat timings below are measured from the voice clips, with a 0.45 s gap between beats.
- Build: one timeline in `build.mjs` produces both `video.html` (animation) and `captions.vtt`, so captions and picture stay in sync.

## Layout (every beat)

| Zone | y (px) | Content |
|---|---|---|
| Background | full | 12 rows of huge Poppins 900 text (150 px) repeating the beat's moving text, alternating left/right, in #f9a6d0 / white / #fdcae3 on #fddbec. Rows fade in over 0.5 s when the beat changes. |
| Logo | 70–200 | Klinik Putrijaya logo as supplied, on a white pill |
| Keyword chip | 300–410 | The beat's moving text, white on black, pops in (scale 0.85 → 1 over 0.35 s) |
| Mascot | 620–1390 | Ceria, gently bobbing (±12 px), slight squash while talking |
| Captions | 1500–1750 | White box, pink border, Poppins 600 52 px, max 2 lines |
| Credit | bottom | "Source: US CDC" |

Mouth: driven by the voice. For each 1/30 s frame, the loudness of `voice.wav` picks closed (quiet), half or open, so the lips move with the audio and rest in the closed smile between lines. Eyes blink for 0.13 s every 3.4 s.

## Beats

| # | Time (s) | Mascot says (caption cues) | Moving text / chip | Mascot pose |
|---|---|---|---|---|
| 1 Hook | 0.50–4.40 | "Did you know your blood sugar can be high…" / "without you feeling it?" | High sugar, no signs? | Waves (left arm) for the first 3 s, talking |
| 2 | 4.85–12.21 | "That's called prediabetes." / "Your blood sugar is higher than normal, but not yet type 2 diabetes." | What is prediabetes? | Talking, bobbing |
| 3 | 12.66–15.94 | "You can have it for years, with no clear symptoms." | Often no symptoms | Talking |
| 4 | 16.39–23.24 | "Your risk is higher if you're overweight, 45 or older," / "or have family with type 2 diabetes." | Know your risk | Talking |
| 5 | 23.69–29.48 | "The good news?" / "Healthy changes can cut your risk of type 2 diabetes in half." | Healthy changes help | Talking |
| 6 | 29.93–37.85 | "Try about 150 minutes of brisk walking a week." / "Losing just 5 to 7 percent of your weight helps too." | Move 150 min a week | Talking |
| 7 | 38.30–41.63 | "And a simple blood sugar test can tell you where you stand." | One simple test | Talking |
| 8 CTA + end card | 42.08–48.14 | "Get your blood sugar checked at Klinik Putrijaya." / "See you soon!" (speech ends 46.84; captions end 47.09) | Get your blood sugar checked at Klinik Putrijaya | Shrinks to the bottom-right corner (captions move left) over 0.7 s, waves, talks, then smiles |

## End card (42.08–48.14, about 6.1 s with the QR on screen)

White card with a pink border, sliding up over 0.7 s: logo → "Get your blood sugar checked at Klinik Putrijaya" → "Scan for our branches" → QR (`assets/qr.png`, the DECISIONS.md target) → "Source: US CDC". Behind it, the background text keeps moving.

Note: CANDY's order said "Source: WHO/KKM", but the brief's facts all come from **US CDC**. Sara found no plain-language WHO, KKM or MyHealth page on prediabetes. So the credit says "Source: US CDC", as Iman's production notes ask. AIN or CANDY can change it if an official WHO or KKM page is added.

## Export (when ffmpeg is allowed)

`video.html?t=<seconds>` renders any single frame. `render.mjs` drives one headless Chrome over the DevTools protocol and saves all 1,444 frames (30 fps). ffmpeg 9.0.2 (installed with AIN's approval) then muxes H.264 + AAC, yuv420p, faststart, to `assets/video/prediabetes-en.mp4`, plus `prediabetes-en-captions-only.mp4` with no audio.

Sample frames for review: `frames/hook.png` (t = 2.0), `frames/middle.png` (t = 25.0), `frames/endcard.png` (t = 45.0).
