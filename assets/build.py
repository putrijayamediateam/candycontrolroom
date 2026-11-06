"""Klinik Putrijaya poster generator — new palette, EN + MS versions.
Palette (approved by AIN): #fddbec #fdcae3 #f9a6d0 #ffffff #000000. Logo kept as supplied.
"""
import base64, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).parent
OUT = pathlib.Path('/mnt/user-data/outputs/posters'); OUT.mkdir(parents=True, exist_ok=True)
def b64(p): return 'data:image/png;base64,' + base64.b64encode((ROOT / p).read_bytes()).decode()
LOGO, QR = b64('assets/logo.png'), b64('assets/qr.png')

P1, P2, P3, W, K = '#fddbec', '#fdcae3', '#f9a6d0', '#ffffff', '#000000'

FD = ROOT / 'node_modules/@fontsource'
def ff(fam, path, w):
    return "@font-face{font-family:'%s';font-weight:%d;src:url(data:font/woff2;base64,%s) format('woff2')}" % (fam, w, base64.b64encode((FD / path).read_bytes()).decode())
FONTS = ''.join(ff('Poppins', f'poppins/files/poppins-latin-{w}-normal.woff2', w) for w in (400, 500, 600, 700, 800, 900)) + ff('Great Vibes', 'great-vibes/files/great-vibes-latin-400-normal.woff2', 400)
CSS = FONTS + f"""
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:1080px;height:1350px;font-family:Poppins,sans-serif;color:{K};background:{W};position:relative;overflow:hidden}}
.blob{{position:absolute;border-radius:50%;z-index:0}}
.wrap{{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;padding:56px 64px 0}}
.logo{{height:78px;display:block;margin:0 auto}}
.pill{{display:inline-block;background:{P3};border-radius:999px;padding:8px 26px;font-weight:700;font-size:24px;letter-spacing:3px}}
.script{{font-family:'Great Vibes',cursive;font-weight:400}}
.card{{background:{W};border:3px solid {P3};border-radius:28px}}
.ico{{width:64px;height:64px;flex:none}}
.foot{{margin:auto -64px 0;background:{P1};border-top:3px solid {P3};padding:26px 64px 30px;display:flex;gap:34px;align-items:center;font-size:19px;line-height:1.45}}
.foot h4{{font-size:19px;font-weight:800;letter-spacing:1px;margin-bottom:4px}}
.foot .col{{flex:1}}
.qr{{background:{W};border-radius:18px;padding:10px;text-align:center;font-weight:700;font-size:17px;border:3px solid {P3}}}
.qr img{{width:118px;height:118px;display:block}}
"""

def ico(name, size=64):
    s = {
      'baby':'<circle cx="32" cy="34" r="20"/><circle cx="25" cy="32" r="2" fill="#000"/><circle cx="39" cy="32" r="2" fill="#000"/><path d="M26 41q6 5 12 0"/><path d="M32 14q-4-6 2-8"/>',
      'adult':'<circle cx="32" cy="20" r="10"/><path d="M12 56q2-18 20-18t20 18"/>',
      'senior':'<circle cx="28" cy="16" r="8"/><path d="M28 26v16l-8 14M28 42l8 14M18 32l10-6 8 8"/><path d="M44 36v20"/><path d="M44 36q0-4 4-4"/>',
      'cal':'<rect x="10" y="14" width="44" height="40" rx="6"/><path d="M10 26h44M22 8v10M42 8v10"/><path d="M20 36h6M30 36h6M40 36h4M20 44h6M30 44h6"/>',
      'repeat':'<path d="M14 30a18 18 0 0 1 32-11l4 5"/><path d="M50 14v10H40"/><path d="M50 34a18 18 0 0 1-32 11l-4-5"/><path d="M14 50V40h10"/>',
      'shield':'<path d="M32 6l22 8v16c0 14-10 24-22 28C20 54 10 44 10 30V14z"/><path d="M32 20v20M22 30h20"/>',
      'check':'<circle cx="32" cy="32" r="22"/><path d="M21 33l7 7 15-15"/>',
      'pin':'<path d="M32 58s18-18 18-32a18 18 0 0 0-36 0c0 14 18 32 18 32z"/><circle cx="32" cy="26" r="7"/>',
      'money':'<rect x="6" y="16" width="52" height="32" rx="6"/><circle cx="32" cy="32" r="8"/><path d="M14 24v16M50 24v16"/>',
      'heart':'<path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z"/><path d="M20 30h8l4-6 4 12 4-6h6"/>',
      'book':'<path d="M8 14h18a6 6 0 0 1 6 6v34a5 5 0 0 0-5-5H8zM56 14H38a6 6 0 0 0-6 6v34a5 5 0 0 1 5-5h19z"/>',
      'gift':'<rect x="8" y="24" width="48" height="12" rx="3"/><rect x="12" y="36" width="40" height="20" rx="3"/><path d="M32 24v32M32 24q-14-14-14-4t14 4q14-14 14-4t-14 4"/>',
      'plane':'<path d="M8 36l48-20-14 40-8-16z"/><path d="M34 40l22-24"/>',
      'trend':'<path d="M8 50l16-16 10 10 20-22"/><path d="M42 22h12v12"/>',
      'smile':'<circle cx="32" cy="32" r="22"/><circle cx="24" cy="28" r="2.5" fill="#000"/><circle cx="40" cy="28" r="2.5" fill="#000"/><path d="M22 38q10 10 20 0"/>',
      'clock':'<circle cx="32" cy="32" r="22"/><path d="M32 18v14l10 6"/>',
      'chat':'<path d="M10 14h44v28H28l-12 10V42h-6z"/><path d="M20 26h24M20 33h16"/>',
      'phone':'<path d="M18 8h10l4 12-6 4a32 32 0 0 0 14 14l4-6 12 4v10a6 6 0 0 1-6 6C26 52 12 38 12 14a6 6 0 0 1 6-6z"/>',
      'mail':'<rect x="8" y="14" width="48" height="36" rx="5"/><path d="M8 18l24 18 24-18"/>',
      'scan':'<rect x="10" y="12" width="44" height="34" rx="5"/><path d="M22 54h20M32 46v8"/><path d="M22 30q10-10 20 0q-10 10-20 0z"/>',
      'steth':'<path d="M18 8v16a10 10 0 0 0 20 0V8"/><path d="M28 34v8a12 12 0 0 0 24 0v-6"/><circle cx="52" cy="32" r="5"/>',
      'syringe':'<path d="M44 8l12 12M50 14L22 42l-6-6L44 8M16 36l-8 8 6 6 8-8M30 22l6 6M24 28l6 6"/>',
    }[name]
    return f'<svg class="ico" style="width:{size}px;height:{size}px" viewBox="0 0 64 64" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">{s}</svg>'

T = {  # shared text
 'en': dict(branches='OUR BRANCHES', hours='OPENING HOURS', scan='Scan me',
   br='Klinik Putrijaya Cheras<br>Klinik Putrijaya Sungai Besi<br>Klinik Putrijaya Puchong',
   hr='<b>Cheras</b> · Mon–Sun · 8.00 AM–11.00 PM<br><b>Sungai Besi &amp; Puchong</b><br>Mon–Fri · 8.00 AM–10.00 PM<br>Sat–Sun · 9.00 AM–10.00 PM'),
 'ms': dict(branches='CAWANGAN', hours='WAKTU BEROPERASI', scan='Imbas di sini',
   br='Klinik Putrijaya Cheras<br>Klinik Putrijaya Sungai Besi<br>Klinik Putrijaya Puchong',
   hr='<b>Cheras</b> · Isnin–Ahad · 8.00 AM–11.00 PM<br><b>Sungai Besi &amp; Puchong</b><br>Isnin–Jumaat · 8.00 AM–10.00 PM<br>Sabtu–Ahad · 9.00 AM–10.00 PM'),
}

def footer(l, qr=True, hours=True):
    t = T[l]
    h = f'<div class="col"><h4>{t["hours"]}</h4>{t["hr"]}</div>' if hours else ''
    q = f'<div class="qr"><img src="{QR}">{t["scan"]}</div>' if qr else ''
    return f'<div class="foot"><div class="col" style="flex:.85"><h4>{t["branches"]}</h4>{t["br"]}</div>{h}{q}</div>'

def blobs(*specs):
    return ''.join(f'<div class="blob" style="width:{s}px;height:{s}px;left:{x}px;top:{y}px;background:{c}"></div>' for x, y, s, c in specs)

# ---------------- 1. Influenza ----------------
def influenza(l):
    x = {
     'en': dict(pill='PROMOTION', a='Influenza', b='Vaccine', tag='Protect yourself and your family from the flu',
        only='only', save='SAVE', valid='Promotion valid until', date='31 December 2026', suit='SUITABLE FOR',
        g=[('baby','Children','6 months and above'),('adult','Adults','18 years and above'),('senior','Seniors','Older adults')],
        yearly='Recommended <b>once every year</b>'),
     'ms': dict(pill='PROMOSI', a='Vaksin', b='Influenza', tag='Lindungi diri &amp; keluarga daripada influenza',
        only='sahaja', save='JIMAT', valid='Promosi sah sehingga', date='31 Disember 2026', suit='SESUAI UNTUK',
        g=[('baby','Kanak-kanak','6 bulan ke atas'),('adult','Dewasa','18 tahun ke atas'),('senior','Warga emas','Golongan berusia')],
        yearly='Disyorkan <b>setahun sekali</b>'),
    }[l]
    big_script = l == 'ms'  # keep the script accent on the same word as the original
    title = (f'<div class="script" style="font-size:112px;line-height:1.1;margin-top:8px;margin-bottom:2px">{x["a"]}</div><div style="font-weight:900;font-size:106px;line-height:1;letter-spacing:2px">{x["b"].upper()}</div>'
             if big_script else
             f'<div style="font-weight:900;font-size:106px;line-height:1;letter-spacing:2px">{x["a"].upper()}</div><div class="script" style="font-size:120px;line-height:1;margin-top:14px">{x["b"]}</div>')
    cards = ''.join(f'<div class="card" style="flex:1;padding:12px 14px;text-align:center;border-radius:24px">{ico(i,52)}<div style="font-weight:800;font-size:25px;margin-top:6px">{a}</div><div style="font-size:19px">{b}</div></div>' for i, a, b in x['g'])
    return blobs((640, -260, 720, P1), (-260, 760, 520, P2), (820, 560, 380, P1)) + f"""
<div class="wrap">
 <img class="logo" src="{LOGO}">
 <div style="text-align:center;margin-top:22px"><span class="pill">{x['pill']}</span></div>
 <div style="text-align:center;margin-top:8px">{title}</div>
 <div style="text-align:center;font-size:29px;font-weight:500;margin-top:6px">{x['tag']}</div>
 <div style="display:flex;justify-content:center;align-items:center;gap:26px;margin-top:20px">
   <div class="card" style="padding:12px 52px 16px;text-align:center;background:{W};border-width:5px">
     <div style="font-weight:900;font-size:132px;line-height:1">RM60</div>
     <div style="font-weight:700;font-size:32px;letter-spacing:6px;background:{P2};border-radius:12px;margin-top:6px">{x['only'].upper()}</div>
   </div>
   <div style="width:190px;height:190px;border-radius:50%;background:{P3};display:flex;flex-direction:column;align-items:center;justify-content:center;border:5px solid {W};box-shadow:0 0 0 3px {P3}">
     <div style="font-weight:700;font-size:28px;letter-spacing:2px">{x['save']}</div><div style="font-weight:900;font-size:56px;line-height:1">RM10</div>
   </div>
 </div>
 <div style="display:flex;justify-content:center;margin-top:18px"><div style="display:flex;align-items:center;gap:14px;background:{P1};border-radius:999px;padding:10px 30px 10px 18px">{ico('cal',44)}<div style="font-size:22px;line-height:1.2">{x['valid']}<br><b style="font-size:27px">{x['date']}</b></div></div></div>
 <div style="text-align:center;font-weight:800;font-size:22px;letter-spacing:4px;margin-top:18px">{x['suit']}</div>
 <div style="display:flex;gap:18px;margin-top:12px">{cards}</div>
 <div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:10px;margin-bottom:4px;font-size:23px">{ico('repeat',34)} {x['yearly']}</div>
 {footer(l)}
</div>"""

# ---------------- 2. Haji & Umrah ----------------
def haji(l):
    x = {
     'en': dict(pre='HEALTH SCREENING PACKAGES', t='Hajj &amp; Umrah', scr='HEALTH SCREENING', vac='VACCINE PACKAGES',
        basic='For pilgrims with no health problems', prem='For pilgrims aged 40+ or with health problems',
        bi=['Doctor consultation','Physical examination','Full Blood Count (FBC)','Fasting Blood Sugar (FBS)'],
        plus='Everything in Basic, plus:', pi=['ECG (heart)','HbA1c (diabetes)','Renal profile (kidney)','Lipid profile (cholesterol)'],
        req='<b>Required for Hajj:</b> Meningococcal ACYW-135 vaccine, at least 14 days before departure.', src='Source: Tabung Haji',
        rec='Best value'),
     'ms': dict(pre='PAKEJ PEMERIKSAAN KESIHATAN', t='Haji &amp; Umrah', scr='PEMERIKSAAN KESIHATAN', vac='PAKEJ VAKSIN',
        basic='Sesuai untuk jemaah yang tiada masalah kesihatan', prem='Sesuai untuk jemaah berumur 40 tahun ke atas / ada masalah kesihatan',
        bi=['Konsultasi doktor','Pemeriksaan fizikal','Ujian Darah Penuh (FBC)','FBS (Fasting Blood Sugar)'],
        plus='Semua dalam Basic, tambah:', pi=['ECG (Electrocardiogram)','HbA1c (Kencing Manis)','Renal Profile (Buah Pinggang)','Lipid Profile (Kolestrol)'],
        req='<b>Wajib untuk Haji:</b> Vaksin Meningococcal ACYW-135, sekurang-kurangnya 14 hari sebelum berlepas.', src='Sumber: Tabung Haji',
        rec='Paling berbaloi'),
    }[l]
    li = lambda items, mark='✓': ''.join(f'<div style="display:flex;gap:10px;font-size:22px;line-height:1.35;margin-top:6px"><span style="font-weight:800">{mark}</span><span>{i}</span></div>' for i in items)
    combos = [('A', ['Meningococcal'], 'RM165'), ('B', ['Meningococcal', 'Influenza'], 'RM220'),
              ('C', ['Pneumococcal', 'Influenza'], 'RM265'), ('D', ['Meningococcal', 'Pneumococcal', 'Influenza'], 'RM425')]
    cv = ''.join(f"""<div class="card" style="display:flex;align-items:stretch;overflow:hidden;margin-top:18px;border-radius:22px;min-height:96px">
       <div style="background:{P2};width:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;font-size:44px;line-height:1"><span style="font-size:15px;font-weight:700;letter-spacing:2px">COMBO</span>{c}</div>
       <div style="flex:1;padding:12px 16px;font-weight:600;font-size:17px;line-height:1.3;white-space:nowrap;display:flex;flex-direction:column;justify-content:center">{'<br>'.join(('+ ' if i else '') + v.upper() for i, v in enumerate(vs))}</div>
       <div style="padding:0 18px;display:flex;align-items:center;font-weight:900;font-size:38px">{p}</div></div>""" for c, vs, p in combos)
    return blobs((700, -300, 680, P1), (-300, 980, 560, P1)) + f"""
<div class="wrap" style="padding-top:44px">
 <img class="logo" src="{LOGO}" style="height:66px">
 <div style="text-align:center;margin-top:20px;font-weight:800;font-size:30px;letter-spacing:3px">{x['pre']}</div>
 <div style="text-align:center;font-weight:900;font-size:104px;line-height:1.02;background:{P3};border-radius:26px;margin:8px 30px 0;padding:6px 0 10px">{x['t'].upper()}</div>
 <div style="display:flex;gap:26px;margin-top:26px">
  <div style="flex:1">
   <div style="font-weight:800;font-size:22px;letter-spacing:3px;display:flex;gap:10px;align-items:center">{ico('steth',36)}{x['scr']}</div>
   <div class="card" style="padding:20px 22px;margin-top:12px;border-radius:22px">
     <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:900;font-size:32px">BASIC</span><span style="font-weight:900;font-size:40px">RM85</span></div>
     <div style="font-size:18px;font-style:italic;margin-bottom:6px">{x['basic']}</div>{li(x['bi'])}
   </div>
   <div class="card" style="padding:20px 22px;margin-top:18px;border-radius:22px;background:{P1};border-width:4px;position:relative">
     <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:900;font-size:32px">PREMIUM</span><span style="font-weight:900;font-size:40px">RM169</span></div>
     <div style="font-size:18px;font-style:italic;margin-bottom:6px">{x['prem']}</div>
     <div style="font-size:18px;font-weight:700;margin-top:4px">{x['plus']}</div>{li(x['pi'], '+')}
   </div>
  </div>
  <div style="flex:1.08">
   <div style="font-weight:800;font-size:22px;letter-spacing:3px;display:flex;gap:10px;align-items:center">{ico('syringe',36)}{x['vac']}</div>
   {cv}
   <div style="display:flex;gap:14px;align-items:flex-start;background:{P1};border:2px dashed {K};border-radius:18px;padding:18px 18px;margin-top:22px;font-size:20px;line-height:1.4">{ico('shield',44)}<div>{x['req']}<div style="font-size:15px;margin-top:4px">{x['src']}</div></div></div>
  </div>
 </div>
 {footer(l)}
</div>"""

# ---------------- 3. Hiring ----------------
def hiring(l):
    x = {
     'en': dict(a="We're hiring!", b='CLINIC ASSISTANT', c='Immediate vacancy', loc='LOCATION', ben='BENEFITS', req='REQUIREMENTS',
        bens=[('money','Basic salary + allowances + overtime'),('shield','EPF &amp; SOCSO contributions'),('book','Additional training if needed'),('heart','Annual medical coverage'),
              ('gift','Annual bonus'),('plane','Annual leave'),('trend','Annual increment'),('smile','Positive working environment')],
        reqs=['Able to work in shifts, disciplined','Good communication skills','Working experience is an advantage'],
        apply='APPLY NOW', wa='Apply on WhatsApp', em='Send your resume to'),
     'ms': dict(a='Jawatan kosong!', b='PEMBANTU KLINIK', c='Kekosongan segera', loc='LOKASI', ben='FAEDAH', req='SYARAT',
        bens=[('money','Gaji pokok + elaun + kerja lebih masa'),('shield','Caruman KWSP &amp; PERKESO'),('book','Latihan tambahan jika perlu'),('heart','Perlindungan perubatan tahunan'),
              ('gift','Bonus tahunan'),('plane','Cuti tahunan'),('trend','Kenaikan gaji tahunan'),('smile','Persekitaran kerja yang positif')],
        reqs=['Boleh bekerja mengikut syif, berdisiplin','Kemahiran komunikasi yang baik','Pengalaman bekerja adalah kelebihan'],
        apply='MOHON SEKARANG', wa='Mohon melalui WhatsApp', em='Hantar resume ke'),
    }[l]
    bens = ''.join(f'<div style="display:flex;gap:12px;align-items:center;background:{W};border:2px solid {P3};border-radius:18px;padding:11px 14px">{ico(i,44)}<span style="font-size:21px;font-weight:600;line-height:1.25">{t}</span></div>' for i, t in x['bens'])
    reqs = ''.join(f'<div style="display:flex;gap:12px;align-items:center;font-size:24px;margin-top:8px">{ico("check",36)}<span>{r}</span></div>' for r in x['reqs'])
    locs = ''.join(f'<div style="display:flex;gap:8px;align-items:center;background:{W};border:2px solid {P3};border-radius:999px;padding:8px 16px 8px 10px;font-weight:700;font-size:20px">{ico("pin",30)}{b}</div>' for b in ['Cheras', 'Sungai Besi', 'Puchong'])
    return blobs((660, -320, 720, P1), (-240, 900, 480, P2)) + f"""
<div class="wrap" style="padding-top:46px">
 <img class="logo" src="{LOGO}" style="height:66px">
 <div style="text-align:center;margin-top:18px"><div class="script" style="font-size:100px;line-height:1.15;margin-bottom:4px">{x['a']}</div>
   <div style="font-weight:900;font-size:92px;line-height:1;letter-spacing:1px">{x['b']}</div>
   <div style="display:inline-block;margin-top:12px;background:{P3};border-radius:999px;padding:6px 26px;font-weight:800;font-size:26px;letter-spacing:3px">{x['c'].upper()}</div></div>
 <div style="font-weight:800;font-size:22px;letter-spacing:3px;margin-top:16px">{x['loc']}</div>
 <div style="display:flex;gap:14px;margin-top:10px">{locs}</div>
 <div style="font-weight:800;font-size:22px;letter-spacing:3px;margin-top:22px">{x['ben']}</div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;background:{P1};padding:16px;border-radius:24px">{bens}</div>
 <div style="font-weight:800;font-size:22px;letter-spacing:3px;margin-top:22px">{x['req']}</div>
 {reqs}
 <div style="height:20px"></div>
 <div class="foot" style="gap:26px">
   <div style="background:{K};color:{W};font-weight:800;font-size:28px;padding:14px 26px;border-radius:999px;letter-spacing:2px;white-space:nowrap">{x['apply']} →</div>
   <div class="col" style="display:flex;flex-direction:column;gap:6px">
     <div style="display:flex;gap:10px;align-items:center">{ico('phone',34)}<div>{x['wa']}<br><b style="font-size:24px">019-932 4588 (HR)</b></div></div>
     <div style="display:flex;gap:10px;align-items:center">{ico('mail',34)}<div>{x['em']}<br><b style="font-size:21px">putrijaya.jobcareer@gmail.com</b></div></div>
   </div>
   <div class="qr"><img src="{QR}">{T[l]['scan']}</div>
 </div>
</div>"""

# ---------------- 4. October breast awareness (template) ----------------
RIBBON = f'<svg viewBox="0 0 120 180" width="{{w}}" fill="none" stroke="{K}" stroke-width="5" stroke-linejoin="round"><path d="M60 70C40 40 36 18 60 10s20 30 0 60L22 170l-16-12L48 84M60 70l38 100 16-12-42-74" fill="{P3}"/></svg>'
def october(l):
    x = {
     'en': dict(a='October', b='Breast Cancer Awareness Month', k='KNOW  •  CHECK  •  ACT EARLY', svc='BREAST ULTRASOUND',
        one='One side', both='Both sides', inc='Price includes consultation', quote='Early awareness starts with a check-up.'),
     'ms': dict(a='Oktober', b='Bulan Kesedaran Kanser Payudara', k='KENALI  •  PERIKSA  •  BERTINDAK AWAL', svc='BREAST ULTRASOUND',
        one='Satu bahagian', both='Kedua-dua bahagian', inc='Harga termasuk konsultasi', quote='Kesedaran awal bermula dengan pemeriksaan.'),
    }[l]
    price = lambda p, s: f'<div class="card" style="flex:1;text-align:center;padding:14px 10px 16px;border-width:4px"><div style="font-weight:900;font-size:104px;line-height:1">{p}</div><div style="font-weight:700;font-size:30px;margin-top:4px">{s}</div><div style="font-size:19px;margin-top:6px;background:{P1};border-radius:10px;padding:4px 10px;display:inline-block">{x["inc"]}</div></div>'
    return blobs((620, -280, 720, P1), (-280, 820, 560, P2)) + f"""
<div class="wrap">
 <img class="logo" src="{LOGO}">
 <div style="display:flex;align-items:center;gap:20px;margin-top:18px">
   <div style="flex:1">
     <div class="script" style="font-size:168px;line-height:.9">{x['a']}</div>
     <div style="font-weight:900;font-size:58px;line-height:1.08;margin-top:6px">{x['b']}</div>
   </div>
   <div style="width:210px">{RIBBON.format(w=210)}</div>
 </div>
 <div style="margin-top:22px;background:{K};color:{W};text-align:center;font-weight:700;font-size:28px;letter-spacing:2px;border-radius:999px;padding:12px 0">{x['k']}</div>
 <div style="display:flex;align-items:center;gap:16px;margin-top:24px;background:{P2};border-radius:26px;padding:14px 24px">{ico('scan',64)}<div style="font-weight:900;font-size:52px;letter-spacing:1px">{x['svc']}</div></div>
 <div style="display:flex;gap:22px;margin-top:22px">{price('RM110', x['one'])}{price('RM190', x['both'])}</div>
 <div class="script" style="text-align:center;font-size:66px;margin:16px 0 18px;line-height:1.05">{x['quote']}</div>
 {footer(l)}
</div>"""

POSTERS = {'influenza': influenza, 'haji-umrah': haji, 'hiring': hiring, 'october-breast-ultrasound-TEMPLATE': october}

def render(names=None):
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1080, 'height': 1350}, device_scale_factor=2)
        for name, fn in POSTERS.items():
            if names and name not in names: continue
            for l in ('en', 'ms'):
                html = f'<!doctype html><html lang="{l}"><head><meta charset="utf-8"><style>{CSS}</style></head><body>{fn(l)}</body></html>'
                (ROOT / 'html').mkdir(exist_ok=True); (ROOT / 'html' / f'{name}-{l}.html').write_text(html)
                pg.set_content(html, wait_until='networkidle')
                ok = pg.evaluate('''async () => { await document.fonts.load('40px "Great Vibes"'); await document.fonts.load('900 40px Poppins'); await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + f.weight); }''')
                assert any('Great Vibes' in f for f in ok) and any('Poppins900' in f.replace('"', '') for f in ok), ok
                pg.wait_for_timeout(300)
                over = pg.evaluate('document.querySelector(".wrap").scrollHeight')
                pg.screenshot(path=str(OUT / f'{name}-{l}.png'))
                print(name, l, 'content height', over)
        b.close()

if __name__ == '__main__':
    render(sys.argv[1:] or None)
