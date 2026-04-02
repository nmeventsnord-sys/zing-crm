#!/usr/bin/env python3
"""
generate_pdf.py — Time to Smile · PDF devis v3
Reads JSON from stdin, writes PDF bytes to stdout.

Input JSON:
{
  "devis_num": "DEV-2026-001",
  "client": {
    "prenom": "Marie", "nom": "Dupont",
    "email": "...", "tel": "...",
    "societe": "...", "adresse": "...", "ville": "...",
    "type_event": "...", "date_event": "...", "lieu": "...",
    "type": "Particulier"
  },
  "lignes": [{"ref": "F200", "designation": "...", "qte": 1, "pu_ttc": 299}],
  "note_livraison": "...",
  "pro": false
}
"""
import sys, json, io, os
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas as pdfcanvas

# ── Palette ──────────────────────────────────────────────────────────
NAVY  = HexColor('#0D1B2A')
BLUE  = HexColor('#1F3864')
GOLD  = HexColor('#C9A84C')
GL    = HexColor('#F4F4F0')
LGREY = HexColor('#E8E8E8')
DARK  = HexColor('#1A1A1A')
GREY  = HexColor('#666666')
WHITE = white

W, H   = A4                  # 595.27 × 841.89 pts
SIDE   = 7  * mm             # sidebar width
HDR_H  = 52 * mm             # header height
MG_L   = SIDE + 8 * mm      # left content margin
MG_R   = 12 * mm             # right content margin
CW     = W - MG_L - MG_R    # content width
FTR_H  = 14 * mm             # footer height

HERE      = os.path.dirname(os.path.abspath(__file__))
LOGO_PATH = os.path.join(HERE, 'logo_0.png')

# ── Helpers ──────────────────────────────────────────────────────────
def fmt(n):
    sign = '-' if n < 0 else ''
    n = abs(n)
    c = round(n * 100)
    euros, cents = divmod(c, 100)
    s = f"{euros:,}".replace(',', '\u202f')
    return f"{sign}{s},{cents:02d}\u00a0\u20ac"

def fdate(d):
    return d.strftime('%d/%m/%Y')

def fr(cv, x, y, w, h, col):
    cv.setFillColor(col)
    cv.rect(x, y, w, h, stroke=0, fill=1)

def frr(cv, x, y, w, h, r, col):
    cv.setFillColor(col)
    cv.roundRect(x, y, w, h, r, stroke=0, fill=1)

def sf(cv, bold=False, italic=False, sz=8):
    n = 'Helvetica'
    if bold and italic: n = 'Helvetica-BoldOblique'
    elif bold:          n = 'Helvetica-Bold'
    elif italic:        n = 'Helvetica-Oblique'
    cv.setFont(n, sz)

def wrap(cv, text, font, sz, max_w):
    words = text.split()
    lines, cur = [], ''
    for word in words:
        t = (cur + ' ' + word).strip()
        if cv.stringWidth(t, font, sz) <= max_w:
            cur = t
        else:
            if cur: lines.append(cur)
            cur = word
    if cur: lines.append(cur)
    return lines

def logo(cv, x, y, w):
    if os.path.exists(LOGO_PATH):
        h = w * (255 / 220)
        cv.drawImage(LOGO_PATH, x, y, w, h, mask='auto', preserveAspectRatio=True)

# ── Sidebar ───────────────────────────────────────────────────────────
def draw_sidebar(cv):
    fr(cv, 0, 0, SIDE, H, NAVY)
    strip_y = H * (1 - 0.65)
    strip_h = H * (0.65 - 0.33)
    fr(cv, 0, strip_y, SIDE, strip_h, GOLD)

# ── Footer ────────────────────────────────────────────────────────────
def draw_footer(cv, addr2=False):
    fr(cv, 0, 0, W, FTR_H, NAVY)
    cv.setFillColor(WHITE)
    sf(cv, sz=6.5)
    line1 = ('EURL NM EVENTS \u2014 Capital 1\u202f000\u00a0\u20ac \u2014 '
             'SIRET 85249214900012 \u2014 TVA FR67852492149 \u2014 timetosmile.fr')
    if addr2:
        line1 = '38 rue de Lesquin 59790 Ronchin \u2014 ' + line1
    cv.drawCentredString(W / 2, FTR_H - 5.5 * mm, line1)
    cv.setFillColor(GOLD)
    sf(cv, bold=True, sz=7.5)
    cv.drawCentredString(W / 2, 3.5 * mm, 'Merci pour votre confiance  \u2736  Time To Smile')


# ════════════════════════════════════════════════════════════════════
# PAGE 1
# ════════════════════════════════════════════════════════════════════
def draw_page1(cv, data):
    cl      = data.get('client', {})
    lignes  = data.get('lignes', [])
    qnum    = data.get('devis_num', 'DEV-2026-001')
    note    = data.get('note_livraison') or ''
    pro     = data.get('pro', False)
    today   = datetime.now()
    valid   = today + timedelta(days=60)

    # totals — per-line HT rounded first, then summed; TVA via multiplication only
    def line_ht(l):
        pu_ht = round(round(float(l['pu_ttc']), 2) / 1.2, 2)
        return round(pu_ht * int(l['qte']), 2)

    total_ht  = round(sum(line_ht(l) for l in lignes), 2)
    total_tva = round(total_ht * 0.2, 2)
    total_ttc = round(total_ht + total_tva, 2)

    draw_sidebar(cv)

    # ── Header (navy bar) ───────────────────────────────────────
    fr(cv, 0, H - HDR_H, W, HDR_H, NAVY)

    # Logo centered
    lw = 28 * mm
    lh = lw * (255 / 220)
    lx = (W - lw) / 2
    ly = H - HDR_H + (HDR_H - lh) / 2
    logo(cv, lx, ly, lw)

    # Company info — top-left
    cv.setFillColor(WHITE)
    sf(cv, bold=True, sz=9)
    cv.drawString(MG_L, H - 12 * mm, 'TIME TO SMILE')
    sf(cv, sz=7)
    for dy, txt in [
        (18, '5 rue du Colibri \u2014 59650 Villeneuve d\u2019Ascq'),
        (23, '06.85.27.54.65  |  Nicolas@timetosmile.fr'),
        (28, 'timetosmile.fr'),
    ]:
        cv.drawString(MG_L, H - dy * mm, txt)

    # Devis info — top-right
    rx = W - MG_R
    cv.setFillColor(GOLD)
    sf(cv, bold=True, sz=22)
    cv.drawRightString(rx, H - 15 * mm, 'DEVIS')
    cv.setFillColor(WHITE)
    sf(cv, bold=True, sz=11)
    cv.drawRightString(rx, H - 24 * mm, qnum)
    sf(cv, sz=7.5)
    cv.drawRightString(rx, H - 30 * mm, f'\u00c9mis le {fdate(today)}')
    cv.drawRightString(rx, H - 35 * mm, 'Validit\u00e9 : 60 jours')
    cv.setFillColor(GOLD)
    sf(cv, sz=7)
    cv.drawRightString(rx, H - 40 * mm, f'Valable jusqu\u2019au {fdate(valid)}')

    # ── Two cards ───────────────────────────────────────────────
    card_top = H - HDR_H - 4 * mm
    card_h   = 34 * mm
    card_y   = card_top - card_h
    gap      = 4 * mm
    cw2      = (CW - gap) / 2
    lx2, rx2 = MG_L, MG_L + cw2 + gap
    bar_h    = 8 * mm
    full_name = f"{cl.get('prenom','')} {cl.get('nom','')}".strip()

    # LEFT card — DEVIS ÉTABLI POUR (blue header, white body)
    fr(cv, lx2, card_y, cw2, card_h, WHITE)
    cv.setStrokeColor(HexColor('#D0D0D0'))
    cv.setLineWidth(0.4)
    cv.rect(lx2, card_y, cw2, card_h, stroke=1, fill=0)
    fr(cv, lx2, card_y + card_h - bar_h, cw2, bar_h, BLUE)
    cv.setFillColor(WHITE)
    sf(cv, bold=True, sz=7.5)
    cv.drawString(lx2 + 3 * mm, card_y + card_h - bar_h + 2.5 * mm,
                  '\u25a0  DEVIS \u00c9TABLI POUR')

    cy = card_y + card_h - bar_h - 5.5 * mm
    cv.setFillColor(DARK)
    sf(cv, bold=True, sz=10)
    cv.drawString(lx2 + 3 * mm, cy, full_name[:34])
    cy -= 5 * mm
    sf(cv, sz=7.5)
    cv.setFillColor(HexColor('#333333'))
    for fld, prefix in [('email', ''), ('tel', ''), ('date_event', 'Date\u00a0: ')]:
        v = cl.get(fld, '')
        if v:
            cv.drawString(lx2 + 3 * mm, cy, f"{prefix}{v}"[:40])
            cy -= 4 * mm
    if pro and cl.get('societe'):
        cv.drawString(lx2 + 3 * mm, cy, cl['societe'][:38])

    # RIGHT card — ÉVÉNEMENT (gold header, light-gray body)
    fr(cv, rx2, card_y, cw2, card_h, GL)
    cv.setStrokeColor(HexColor('#D0D0D0'))
    cv.rect(rx2, card_y, cw2, card_h, stroke=1, fill=0)
    fr(cv, rx2, card_y + card_h - bar_h, cw2, bar_h, GOLD)
    cv.setFillColor(NAVY)
    sf(cv, bold=True, sz=7.5)
    cv.drawString(rx2 + 3 * mm, card_y + card_h - bar_h + 2.5 * mm,
                  '\u25a0  \u00c9V\u00c9NEMENT')

    ey = card_y + card_h - bar_h - 5.5 * mm
    cv.setFillColor(DARK)
    if cl.get('type_event'):
        sf(cv, bold=True, sz=9)
        cv.drawString(rx2 + 3 * mm, ey, cl['type_event'][:36])
        ey -= 5 * mm
    sf(cv, sz=7.5)
    cv.setFillColor(HexColor('#333333'))
    for fld, prefix in [
        ('date_event', 'Date\u00a0: '), ('lieu', 'Lieu\u00a0: '), ('ville', '')
    ]:
        v = cl.get(fld, '')
        if v:
            cv.drawString(rx2 + 3 * mm, ey, f"{prefix}{v}"[:36])
            ey -= 4 * mm
    if note:
        cv.drawString(rx2 + 3 * mm, ey, note[:36])

    # ── PRESTATIONS section title ────────────────────────────────
    cur_y = card_y - 6 * mm
    cv.setFillColor(NAVY)
    sf(cv, bold=True, sz=10)
    cv.drawString(MG_L, cur_y, 'PRESTATIONS')
    cv.setStrokeColor(GOLD)
    cv.setLineWidth(1.2)
    cv.line(MG_L, cur_y - 1.5 * mm, MG_L + CW, cur_y - 1.5 * mm)
    cur_y -= 5 * mm

    # ── Items table ──────────────────────────────────────────────
    col_w = [15*mm, 74*mm, 12*mm, 26*mm, 24*mm, 22*mm, 15*mm]
    hdrs  = ['R\u00e9f.', 'D\u00e9signation', 'Qt\u00e9',
             'P.U. TTC', 'Total TTC', 'Total HT', 'TVA']
    row_h = 6.5 * mm
    thdr  = 7.5 * mm

    fr(cv, MG_L, cur_y - thdr, CW, thdr, NAVY)
    hx = MG_L + 2 * mm
    for i, (cw_i, hdr) in enumerate(zip(col_w, hdrs)):
        cv.setFillColor(HexColor('#90B4FF') if i == 0 else GOLD)
        sf(cv, bold=True, sz=7)
        if i <= 1:
            cv.drawString(hx, cur_y - thdr + 2.5 * mm, hdr)
        else:
            cv.drawRightString(hx + cw_i - 2 * mm, cur_y - thdr + 2.5 * mm, hdr)
        hx += cw_i
    cur_y -= thdr

    for idx, ln in enumerate(lignes):
        pu_ttc = round(float(ln.get('pu_ttc', 0)), 2)
        qte    = int(ln.get('qte', 1))
        pu_ht  = round(pu_ttc / 1.2, 2)
        ht     = round(pu_ht * qte, 2)
        tva    = round(ht * 0.2, 2)
        ttc    = round(ht + tva, 2)
        ref    = ln.get('ref', '')
        desc   = ln.get('designation', '')

        fr(cv, MG_L, cur_y - row_h, CW, row_h, WHITE if idx % 2 == 0 else GL)

        rx3 = MG_L + 2 * mm
        cv.setFillColor(BLUE)
        sf(cv, bold=True, sz=7.5)
        cv.drawString(rx3, cur_y - row_h + 2 * mm, ref)
        rx3 += col_w[0]

        cv.setFillColor(DARK)
        sf(cv, sz=7.5)
        max_c = 46
        cv.drawString(rx3, cur_y - row_h + 2 * mm,
                      desc[:max_c] + ('\u2026' if len(desc) > max_c else ''))
        rx3 += col_w[1]

        cv.drawRightString(rx3 + col_w[2] - 2 * mm, cur_y - row_h + 2 * mm, str(qte))
        rx3 += col_w[2]
        cv.drawRightString(rx3 + col_w[3] - 2 * mm, cur_y - row_h + 2 * mm, fmt(pu_ttc))
        rx3 += col_w[3]

        sf(cv, bold=True, sz=7.5)
        cv.drawRightString(rx3 + col_w[4] - 2 * mm, cur_y - row_h + 2 * mm, fmt(ttc))
        rx3 += col_w[4]

        cv.setFillColor(GREY)
        sf(cv, sz=7.5)
        cv.drawRightString(rx3 + col_w[5] - 2 * mm, cur_y - row_h + 2 * mm, fmt(ht))
        rx3 += col_w[5]
        cv.drawRightString(rx3 + col_w[6] - 2 * mm, cur_y - row_h + 2 * mm, '20\u00a0%')

        cur_y -= row_h

    cv.setStrokeColor(HexColor('#CCCCCC'))
    cv.setLineWidth(0.3)
    cv.line(MG_L, cur_y, MG_L + CW, cur_y)

    # ── INCLUS PHOTOBOOTH ────────────────────────────────────────
    inclus = [
        'Photos num\u00e9riques illimit\u00e9es',
        'Personnalisation des cadres photo',
        'Filtres NB, S\u00e9pia, Pop Art',
        'Envoi par mail ou SMS en temps r\u00e9el',
        'Assistance t\u00e9l\u00e9phonique incluse',
        'Lien de t\u00e9l\u00e9chargement post-\u00e9v\u00e9nement',
        'Retrait possible dans nos locaux (pas de frais de livraison)',
        '+200 tirages disponibles en cours d\u2019\u00e9v\u00e9nement (+100\u20ac)',
    ]

    n_rows  = 4
    inc_rh  = 5.5 * mm
    inc_h   = n_rows * inc_rh + 2 * mm
    blk_w   = 26 * mm           # navy label block width
    inc_y   = cur_y - 4 * mm

    fr(cv, MG_L, inc_y - inc_h, blk_w, inc_h, NAVY)

    # Rotated "INCLUS PHOTOBOOTH" label
    cv.saveState()
    cv.setFillColor(GOLD)
    sf(cv, bold=True, sz=7)
    cv.translate(MG_L + blk_w / 2, inc_y - inc_h / 2)
    cv.rotate(90)
    cv.drawCentredString(0, -2.5 * mm, 'INCLUS PHOTOBOOTH')
    cv.restoreState()

    half_items = (CW - blk_w) / 2
    ix1 = MG_L + blk_w + 3 * mm
    ix2 = ix1 + half_items

    for i, txt in enumerate(inclus):
        row = i // 2
        col = i % 2
        ix  = ix1 if col == 0 else ix2
        iy  = inc_y - row * inc_rh - inc_rh + 1.8 * mm

        if col == 0:
            bg = WHITE if row % 2 == 0 else GL
            fr(cv, MG_L + blk_w, iy - 1 * mm, CW - blk_w, inc_rh, bg)

        cv.setFillColor(GOLD)
        sf(cv, bold=True, sz=8)
        cv.drawString(ix, iy, '\u2713')
        cv.setFillColor(DARK)
        sf(cv, sz=7)
        max_c = 42
        cv.drawString(ix + 4 * mm, iy,
                      txt[:max_c] + ('\u2026' if len(txt) > max_c else ''))

    cur_y = inc_y - inc_h - 5 * mm

    # ── Totals table (4-col) ─────────────────────────────────────
    tot_tw = CW * 0.55
    col4   = tot_tw / 4
    tot_rh = 6 * mm

    fr(cv, MG_L, cur_y - tot_rh, tot_tw, tot_rh, NAVY)
    for i, lbl in enumerate(['Base HT', 'Taux TVA', 'Montant TVA', 'Total TTC']):
        cv.setFillColor(GOLD)
        sf(cv, bold=True, sz=6.5)
        cv.drawCentredString(MG_L + i * col4 + col4 / 2, cur_y - tot_rh + 2 * mm, lbl)

    fr(cv, MG_L, cur_y - 2 * tot_rh, tot_tw, tot_rh, GL)
    for i, val in enumerate([fmt(total_ht), '20\u00a0%', fmt(total_tva), fmt(total_ttc)]):
        cv.setFillColor(DARK)
        sf(cv, bold=(i == 3), sz=7.5)
        cv.drawCentredString(MG_L + i * col4 + col4 / 2, cur_y - 2 * tot_rh + 2 * mm, val)

    # ── Right summary box ────────────────────────────────────────
    bx  = MG_L + tot_tw + 5 * mm
    bw  = W - MG_R - bx
    brh = 5.5 * mm
    by  = cur_y

    for bg, lbl, val, bld in [
        (GL,    'Sous-total HT', fmt(total_ht),  False),
        (WHITE, 'TVA 20\u00a0%',  fmt(total_tva), False),
        (GL,    'Total TTC',     fmt(total_ttc), True),
    ]:
        fr(cv, bx, by - brh, bw, brh, bg)
        cv.setFillColor(DARK)
        sf(cv, sz=7.5)
        cv.drawString(bx + 3 * mm, by - brh + 1.8 * mm, lbl)
        sf(cv, bold=bld, sz=7.5)
        cv.drawRightString(bx + bw - 3 * mm, by - brh + 1.8 * mm, val)
        by -= brh

    net_h = 9 * mm
    fr(cv, bx, by - net_h, bw, net_h, NAVY)
    cv.setFillColor(GOLD)
    sf(cv, bold=True, sz=7)
    cv.drawString(bx + 3 * mm, by - net_h + 4 * mm, 'NET \u00c0 PAYER')
    cv.setFillColor(WHITE)
    sf(cv, bold=True, sz=10)
    cv.drawRightString(bx + bw - 3 * mm, by - net_h + 2.5 * mm, fmt(total_ttc))
    by -= net_h

    pay_y = min(cur_y - 2 * tot_rh, by) - 8 * mm

    # ── Payment ──────────────────────────────────────────────────
    if not pro:
        btn_w = CW * 0.65
        btn_h = 10 * mm
        btn_x = MG_L + (CW - btn_w) / 2
        frr(cv, btn_x, pay_y - btn_h, btn_w, btn_h, 4, GOLD)
        cv.setFillColor(NAVY)
        sf(cv, bold=True, sz=9)
        cv.drawCentredString(btn_x + btn_w / 2, pay_y - btn_h + 3.5 * mm,
                             '\u2736  R\u00c9SERVEZ ICI \u2014 Acompte 60\u00a0\u20ac  \u2736')
        cv.linkURL('https://pay.sumup.com/b2c/QEVGSUR1',
                   (btn_x, pay_y - btn_h, btn_x + btn_w, pay_y))
        pay_y -= btn_h + 5 * mm
        cv.setFillColor(DARK)
        sf(cv, italic=True, sz=7.5)
        cv.drawCentredString(MG_L + CW / 2, pay_y,
            '(Le solde sera r\u00e9gl\u00e9 \u00e0 la livraison / retrait du mat\u00e9riel.)')
        pay_y -= 4 * mm
        fn = full_name
        cv.drawCentredString(MG_L + CW / 2, pay_y,
            f'Merci d\u2019indiquer le nom figurant sur ce devis : {fn}')
        pay_y -= 6 * mm
    else:
        cv.setFillColor(BLUE)
        sf(cv, bold=True, sz=9)
        cv.drawString(MG_L, pay_y, 'Pour valider ce devis :')
        pay_y -= 5 * mm
        cv.setFillColor(DARK)
        sf(cv, sz=8)
        cv.drawString(MG_L, pay_y,
            'Merci de nous faire un retour bon pour accord par mail '
            'ou de nous renvoyer ce devis sign\u00e9.')
        pay_y -= 10 * mm
        cv.setStrokeColor(NAVY)
        cv.setLineWidth(0.4)
        cv.line(MG_L, pay_y, MG_L + 70 * mm, pay_y)
        cv.setFillColor(GREY)
        sf(cv, italic=True, sz=7)
        cv.drawString(MG_L, pay_y - 3.5 * mm, 'Date et signature \u2014 Bon pour accord')
        pay_y -= 8 * mm

    # ── RÈGLEMENT ────────────────────────────────────────────────
    reg_y = pay_y - 3 * mm
    cv.setFillColor(NAVY)
    sf(cv, bold=True, sz=8)
    cv.drawString(MG_L, reg_y, 'R\u00c8GLEMENT')
    cv.setStrokeColor(GOLD)
    cv.setLineWidth(0.8)
    cv.line(MG_L, reg_y - 1 * mm, MG_L + 28 * mm, reg_y - 1 * mm)
    reg_y -= 5 * mm
    cv.setFillColor(DARK)
    sf(cv, sz=7.5)
    for line in [
        'IBAN\u00a0: FR76 1350 7000 1931 9488 0215 975  |  BIC\u00a0: CCBPFRPPLIL',
        'Code banque\u00a0: 13507  |  Code guichet\u00a0: 00019  '
        '|  N\u00b0 Compte\u00a0: 31948802159  |  Cl\u00e9 RIB\u00a0: 75',
        'R\u00e8glement \u00e0 r\u00e9ception \u2014 Ch\u00e8que / Esp\u00e8ces / Virement bancaire',
    ]:
        cv.drawString(MG_L, reg_y, line)
        reg_y -= 4 * mm

    draw_footer(cv)


# ════════════════════════════════════════════════════════════════════
# PAGE 2 — CGV
# ════════════════════════════════════════════════════════════════════
CGV = [
    ('Art. 1 \u2014 Champ d\u2019application',
     'Les pr\u00e9sentes CGV r\u00e9gissent l\u2019ensemble des prestations propos\u00e9es '
     'par Time to Smile (EURL NM EVENTS, SIRET 85249214900012). Toute commande implique '
     'l\u2019acceptation pleine et enti\u00e8re de ces conditions.'),
    ('Art. 2 \u2014 Commandes & annulation',
     'R\u00e9servation d\u00e9finitive \u00e0 r\u00e9ception de l\u2019acompte de 60\u00a0\u20ac. '
     '\u2022 > 30j\u00a0: remboursement hors acompte. '
     '\u2022 15\u201330j\u00a0: aucun remboursement. '
     '\u2022 < 15j ou jour J\u00a0: facturation int\u00e9grale.'),
    ('Art. 3 \u2014 Conditions tarifaires',
     'Tarifs TTC pour particuliers, HT pour professionnels. Prix indiqu\u00e9s dans le devis valid\u00e9. '
     'Toute prestation suppl\u00e9mentaire non pr\u00e9vue fera l\u2019objet d\u2019un avenant.'),
    ('Art. 4 \u2014 Facturation & paiement',
     'Solde exigible le jour de la prestation, avant d\u00e9but d\u2019\u00e9v\u00e9nement. '
     'Modes\u00a0: esp\u00e8ces, virement, SumUp. '
     'IBAN\u00a0: FR76 1350 7000 1931 9488 0215 975.'),
    ('Art. 5 \u2014 Fourniture des services',
     'Time to Smile s\u2019engage \u00e0 fournir la borne photo avec technicien qualifi\u00e9. '
     'En cas d\u2019empêchement technique, une solution alternative ou un remboursement sera propos\u00e9.'),
    ('Art. 6 \u2014 Obligations du client',
     'Le client fournit un espace plan de 2m\u00d72m minimum, acc\u00e8s 220V s\u00e9curis\u00e9, '
     'et pr\u00e9vient Time to Smile de tout changement au moins 48h \u00e0 l\u2019avance.'),
    ('Art. 7 \u2014 Force majeure',
     'Time to Smile n\u2019est pas responsable d\u2019une inexécution caus\u00e9e par un \u00e9v\u00e9nement '
     'de force majeure. Un report ou remboursement int\u00e9gral sera propos\u00e9.'),
    ('Art. 8 \u2014 Responsabilit\u00e9 du prestataire',
     'La responsabilit\u00e9 de Time to Smile est limit\u00e9e au montant de la prestation. '
     'Couverture RC professionnelle. Toute d\u00e9gradation du mat\u00e9riel sera factur\u00e9e.'),
    ('Art. 9 \u2014 Propri\u00e9t\u00e9 intellectuelle',
     'Templates, designs et logiciels de la borne restent la propri\u00e9t\u00e9 de Time to Smile. '
     'Toute reproduction commerciale sans accord \u00e9crit est interdite.'),
    ('Art. 10 \u2014 Donn\u00e9es personnelles RGPD',
     'Donn\u00e9es utilis\u00e9es uniquement dans le cadre de la relation commerciale. '
     'Conform\u00e9ment au RGPD, le client dispose d\u2019un droit d\u2019acc\u00e8s, de '
     'rectification et de suppression de ses donn\u00e9es.'),
    ('Art. 11 \u2014 Dur\u00e9e & r\u00e9siliation',
     'Le contrat prend fin \u00e0 l\u2019issue de la prestation. En cas de manquement grave, '
     'r\u00e9siliation possible avec pr\u00e9avis \u00e9crit de 48h et paiement des services effectu\u00e9s.'),
    ('Art. 12 \u2014 Droit de r\u00e9tractation',
     'Conform\u00e9ment \u00e0 l\u2019art. L221-28 du Code de la consommation, le droit de '
     'r\u00e9tractation ne s\u2019applique pas aux prestations de loisirs \u00e0 date d\u00e9termin\u00e9e.'),
    ('Art. 13 \u2014 Conditions techniques',
     'Prise 220V \u00e0 moins de 5m, espace plan et sec de 2m\u00d72m requis. '
     'Si conditions inadapt\u00e9es, Time to Smile peut refuser la prestation sans remboursement.'),
    ('Art. 14 \u2014 R\u00e9clamations',
     'R\u00e9clamation par \u00e9crit sous 48h apr\u00e8s la prestation. '
     'Pass\u00e9 ce d\u00e9lai, aucune r\u00e9clamation ne sera recevable. '
     'Contact\u00a0: Nicolas@timetosmile.fr'),
    ('Art. 15 \u2014 Sous-traitance',
     'Time to Smile peut faire appel \u00e0 des sous-traitants sous sa responsabilit\u00e9. '
     'Le client en sera inform\u00e9 pr\u00e9alablement si cela impacte la prestation.'),
    ('Art. 16 \u2014 Modification des CGV',
     'Time to Smile se r\u00e9serve le droit de modifier les CGV \u00e0 tout moment. '
     'Les conditions applicables sont celles en vigueur au jour de la commande.'),
    ('Art. 17 \u2014 Nullit\u00e9 partielle',
     'Si une clause est d\u00e9clar\u00e9e nulle ou inapplicable, les autres clauses restent '
     'pleinement en vigueur et conservent leur effet juridique.'),
    ('Art. 18 \u2014 Acceptation',
     'La signature du devis ou le r\u00e8glement de l\u2019acompte vaut acceptation pleine et '
     'enti\u00e8re des pr\u00e9sentes CGV. Le client reconna\u00eet en avoir pris connaissance.'),
]


def draw_page2(cv, data):
    draw_sidebar(cv)

    hdr_h2 = 30 * mm
    fr(cv, 0, H - hdr_h2, W, hdr_h2, NAVY)

    # Logo left
    lw = 22 * mm
    lh = lw * (255 / 220)
    logo(cv, MG_L, H - hdr_h2 + (hdr_h2 - lh) / 2, lw)

    # CGV title centered
    cv.setFillColor(WHITE)
    sf(cv, bold=True, sz=11)
    cv.drawCentredString(W / 2, H - 11 * mm, 'CONDITIONS G\u00c9N\u00c9RALES DE VENTE')

    # Gold subtitle
    cv.setFillColor(GOLD)
    sf(cv, sz=7.5)
    cv.drawCentredString(W / 2, H - 19 * mm,
                         'TIME TO SMILE \u2014 EURL NM EVENTS \u2014 SIRET 85249214900012')

    # Top-right metadata
    cv.setFillColor(WHITE)
    sf(cv, sz=6.5)
    cv.drawRightString(W - MG_R, H - 10 * mm, 'Mise \u00e0 jour\u00a0: 01/02/2023')
    cv.drawRightString(W - MG_R, H - 16 * mm, 'TVA FR67852492149')

    cv.setStrokeColor(GOLD)
    cv.setLineWidth(1)
    cv.line(0, H - hdr_h2, W, H - hdr_h2)

    # Two columns
    col_gap = 5 * mm
    col_w2  = (CW - col_gap) / 2
    col1_x  = MG_L
    col2_x  = MG_L + col_w2 + col_gap
    art_y   = H - hdr_h2 - 6 * mm

    def draw_col(articles, sx, sy):
        y = sy
        for ai, (title, body) in enumerate(articles):
            lines = wrap(cv, body, 'Helvetica', 6.2, col_w2 - 8 * mm)
            art_h = 5 * mm + len(lines) * 3.2 * mm + 2.5 * mm
            bg = WHITE if ai % 2 == 0 else GL
            fr(cv, sx, y - art_h, col_w2, art_h, bg)
            # Gold left border
            cv.setStrokeColor(GOLD)
            cv.setLineWidth(2)
            cv.line(sx, y - art_h, sx, y)
            # Title
            cv.setFillColor(GOLD)
            sf(cv, bold=True, sz=7.5)
            cv.drawString(sx + 3 * mm, y - 4.5 * mm, title)
            # Body
            cv.setFillColor(DARK)
            sf(cv, sz=6.2)
            ty = y - 4.5 * mm - 3.5 * mm
            for line in lines:
                cv.drawString(sx + 3 * mm, ty, line)
                ty -= 3.2 * mm
            y -= art_h
        return y

    draw_col(CGV[:9],  col1_x, art_y)
    draw_col(CGV[9:],  col2_x, art_y)

    draw_footer(cv, addr2=True)


# ════════════════════════════════════════════════════════════════════
def generate(data):
    buf = io.BytesIO()
    cv  = pdfcanvas.Canvas(buf, pagesize=A4)
    cv.setTitle(f"Devis {data.get('devis_num', '')}")
    cv.setAuthor('Time to Smile')
    draw_page1(cv, data)
    cv.showPage()
    draw_page2(cv, data)
    cv.save()
    return buf.getvalue()


if __name__ == '__main__':
    raw  = sys.stdin.buffer.read()
    data = json.loads(raw.decode('utf-8'))
    sys.stdout.buffer.write(generate(data))
