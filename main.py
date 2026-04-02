def main():
    print("Hello from repl-nix-workspace!")


if __name__ == "__main__":
    main()
import io, os
from flask import Flask, request, send_file, jsonify
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import Table, TableStyle, Paragraph, Frame
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER
from pypdf import PdfReader, PdfWriter
from datetime import date, datetime

from flask_cors import CORS
app = Flask(__name__)
CORS(app)

W, H = A4
NAVY     = colors.HexColor("#0D1B2A")
BLUE     = colors.HexColor("#1F3864")
GOLD     = colors.HexColor("#C9A84C")
GL       = colors.HexColor("#F4F4F0")
WHITE    = colors.white
BLACK    = colors.HexColor("#1A1A1A")
GD       = colors.HexColor("#888880")
BORDER_C = colors.HexColor("#CCCCCC")
LIEN_PAI = "https://pay.sumup.com/b2c/QEVGSUR1"

LOGO_PATH = os.path.join(os.path.dirname(__file__), "attached_assets", "logo_0.png")

def fe(v):
    return f"{abs(v):,.2f} €".replace(",", "\u202f")

def make_cgv_page():
    packet = io.BytesIO()
    c = rl_canvas.Canvas(packet, pagesize=A4)
    c.setFillColor(WHITE); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(NAVY); c.rect(0, 0, 7*mm, H, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, H*0.33, 7*mm, H*0.32, fill=1, stroke=0)
    hh = 28*mm
    c.setFillColor(NAVY); c.rect(0, H-hh, W, hh, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, H-hh-1.2*mm, W, 1.2*mm, fill=1, stroke=0)
    if os.path.exists(LOGO_PATH):
        c.drawImage(LOGO_PATH, 10*mm, H-hh+3*mm, width=20*mm, height=20*mm, mask='auto', preserveAspectRatio=True)
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(W/2, H-13*mm, "CONDITIONS GÉNÉRALES DE VENTE")
    c.setFillColor(GOLD); c.setFont("Helvetica", 7.5)
    c.drawCentredString(W/2, H-19*mm, "TIME TO SMILE  —  EURL NM EVENTS  —  SIRET 85249214900012")
    c.setFillColor(GD); c.setFont("Helvetica", 6.5)
    c.drawRightString(W-10*mm, H-10*mm, "Mise à jour : 01/02/2023")
    c.drawRightString(W-10*mm, H-15*mm, "TVA FR67852492149")

    articles = [
        ("Art. 1 — Champ d'application",
         "Les présentes CGV s'appliquent à tous les services Time To Smile : location de borne photo avec tirages instantanés, accessoires, livraison/installation/retrait. Toute commande implique l'acceptation sans réserve des présentes CGV."),
        ("Art. 2 — Commandes & annulation",
         "Devis valable 30 jours. Commande ferme à la signature ou à l'acompte.\n• Annulation >30j : aucun frais, acompte remboursé intégralement.\n• Entre 30j et 72h : 30% du HT dû.\n• Dans les 48h : 100% du HT dû.\n• Report >30j avant : aucun frais si créneau disponible."),
        ("Art. 3 — Conditions tarifaires",
         "Tarifs en euros TTC, fermes à la signature. Toute modification de TVA s'applique immédiatement. Des remises peuvent être accordées selon conditions convenues."),
        ("Art. 4 — Facturation & paiement",
         "Particuliers : acompte 60€ à la signature, solde à réception.\nProfessionnels : paiement à 30 jours date de facture.\nModes : virement, chèque, espèces, CB.\nRetard : pénalités au taux légal + indemnité forfaitaire 40€."),
        ("Art. 5 — Fourniture des services",
         "Le Prestataire fournit le matériel en bon état à la date et au lieu convenus. Le Client assure une prise 220V et un espace min. 2m×2m. À défaut, le Prestataire ne peut être tenu responsable d'un défaut d'exécution."),
        ("Art. 6 — Obligations du client",
         "Le Client s'engage à : fournir des informations exactes, assurer un accès libre et sécurisé, ne pas modifier le matériel, signaler immédiatement toute anomalie et répondre de tout dommage causé par négligence."),
        ("Art. 7 — Force majeure",
         "Tout événement imprévisible, irrésistible et extérieur (catastrophe naturelle, pandémie officielle, décision gouvernementale) suspend les obligations sans indemnité. Si persistance >30 jours : résiliation sans frais avec remboursement intégral."),
        ("Art. 8 — Responsabilité du prestataire",
         "Obligation de moyens. En cas de panne totale >50% de la durée convenue, une remise proportionnelle sera accordée. Responsabilité limitée au montant TTC de la prestation. RC Pro disponible sur demande."),
        ("Art. 9 — Propriété intellectuelle",
         "Le Prestataire conserve tous droits sur ses créations (templates, charte graphique, logos). Droit d'usage personnel et non commercial accordé au Client. Toute reproduction commerciale est interdite sans autorisation écrite."),
        ("Art. 10 — Données personnelles (RGPD)",
         "Responsable : EURL NM Events. Données collectées : nom, prénom, email, téléphone. Finalité : exécution du contrat. Conservation : durée légale. Droits : Nicolas@timetosmile.fr. Photos via photobooth : propriété des participants."),
        ("Art. 11 — Durée & résiliation",
         "CGV conclues pour la durée de la prestation. Résiliation possible en cas de force majeure ou manquement grave non corrigé sous 15 jours après notification écrite."),
        ("Art. 12 — Droit de rétractation",
         "Pour commandes à distance : délai de 14 jours francs à compter de la signature (art. L.221-18 Code Conso). Ne s'applique pas si prestation déjà exécutée avec accord préalable du Client."),
        ("Art. 13 — Conditions techniques",
         "Le Client garantit : accès 45 min avant le début, prise 220V à moins de 5m, espace 2m×2m couvert si usage extérieur. À défaut, le Prestataire n'est pas responsable d'une prestation dégradée."),
        ("Art. 14 — Réclamations",
         "Toute réclamation doit être adressée à Nicolas@timetosmile.fr dans les 5 jours ouvrés suivant l'événement. Passé ce délai, la prestation est réputée acceptée sans réserve."),
        ("Art. 15 — Sous-traitance",
         "Le Prestataire peut faire appel à des sous-traitants tout en restant seul responsable vis-à-vis du Client."),
        ("Art. 16 — Assurance",
         "Le Prestataire est titulaire d'une RC Pro couvrant les dommages causés aux tiers. Attestation disponible sur simple demande."),
        ("Art. 17 — Autonomie & modification",
         "La nullité d'une clause n'entraîne pas la nullité des autres. Le Prestataire peut modifier les CGV à tout moment ; la version applicable est celle en vigueur à la date de signature."),
        ("Art. 18 — Médiation & litiges",
         "Médiation de la consommation disponible gratuitement (art. L.611-1 Code Conso). Tout litige relève du Tribunal de Commerce de Lille. Droit applicable : droit français. Seule la version française fait foi."),
    ]

    col1_x = 10*mm
    col2_x = W/2 + 2*mm
    col_w = W/2 - 14*mm
    title_style = ParagraphStyle('t', fontName='Helvetica-Bold', fontSize=6.8,
                                 textColor=GOLD, leading=9, spaceBefore=0, spaceAfter=1)
    body_style = ParagraphStyle('b', fontName='Helvetica', fontSize=6.2,
                                textColor=BLACK, leading=8, alignment=TA_JUSTIFY, spaceAfter=3)
    content_top = H - hh - 4*mm
    col_y = [content_top, content_top]

    for idx, (title, body) in enumerate(articles):
        col = 0 if idx % 2 == 0 else 1
        x = col1_x if col == 0 else col2_x
        y = col_y[col]
        tp = Paragraph(title, title_style)
        bp = Paragraph(body.replace('\n', '<br/>'), body_style)
        tw_t, th_t = tp.wrap(col_w, 100*mm)
        tw_b, th_b = bp.wrap(col_w, 100*mm)
        block_h = th_t + th_b + 4*mm
        y_pos = y - block_h
        if y_pos < 18*mm:
            continue
        bg_art = colors.HexColor("#F8F8F5") if idx % 4 < 2 else WHITE
        c.setFillColor(bg_art)
        c.rect(x-1.5*mm, y_pos-1.5*mm, col_w+3*mm, block_h+1*mm, fill=1, stroke=0)
        c.setFillColor(GOLD)
        c.rect(x-1.5*mm, y_pos-1.5*mm, 1.5*mm, block_h+1*mm, fill=1, stroke=0)
        tp.drawOn(c, x+2*mm, y_pos + th_b + 1.5*mm)
        bp.drawOn(c, x+2*mm, y_pos)
        col_y[col] = y_pos - 3*mm

    c.setFillColor(NAVY); c.rect(0, 0, W, 14*mm, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, 13.5*mm, W, 0.8*mm, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("Helvetica", 5.5)
    c.drawCentredString(W/2, 8*mm, "EURL NM EVENTS  —  Capital 1 000 €  —  SIRET 85249214900012  —  TVA FR67852492149  —  38 rue de Lesquin 59790 Ronchin")
    c.setFillColor(GOLD); c.setFont("Helvetica-Bold", 6)
    c.drawCentredString(W/2, 3.5*mm, "Merci pour votre confiance ✦ Time To Smile")
    c.save(); packet.seek(0)
    return PdfReader(packet).pages[0]


def make_devis_page(devis_num, client, lignes, note_livraison=None, pro=False):
    packet = io.BytesIO()
    c = rl_canvas.Canvas(packet, pagesize=A4)
    c.setFillColor(WHITE); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(NAVY); c.rect(0, 0, 7*mm, H, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, H*0.33, 7*mm, H*0.32, fill=1, stroke=0)

    hh = 52*mm
    c.setFillColor(NAVY); c.rect(0, H-hh, W, hh, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, H-hh-1.2*mm, W, 1.2*mm, fill=1, stroke=0)

    if os.path.exists(LOGO_PATH):
        c.drawImage(LOGO_PATH, W/2-14*mm, H-hh+4*mm, width=28*mm, height=28*mm, mask='auto', preserveAspectRatio=True)

    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 10)
    c.drawString(12*mm, H-10*mm, "TIME TO SMILE")
    c.setFont("Helvetica", 7); c.setFillColor(GD)
    for i, l in enumerate(["5 rue du Colibri — 59650 Villeneuve d'Ascq",
                            "06.85.27.54.65  |  Nicolas@timetosmile.fr", "timetosmile.fr"]):
        c.drawString(12*mm, H-15.5*mm-i*4.5*mm, l)

    c.setFillColor(GOLD); c.setFont("Helvetica-Bold", 7)
    c.drawRightString(W-10*mm, H-10*mm, "DEVIS")
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 18)
    c.drawRightString(W-10*mm, H-19*mm, f"N° {devis_num}")
    c.setFillColor(GD); c.setFont("Helvetica", 7)
    c.drawRightString(W-10*mm, H-25*mm, f"Émis le {date.today().strftime('%d/%m/%Y')}")
    c.drawRightString(W-10*mm, H-30*mm, "Validité : 60 jours")

    cy = H-hh-1.2*mm-42*mm
    cw = (W-28*mm)/2

    # Carte gauche — client
    c.setFillColor(BLUE); c.rect(12*mm, cy+32*mm, cw, 9*mm, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 7)
    c.drawString(14*mm, cy+35.5*mm, "■  DEVIS ÉTABLI POUR")
    c.setFillColor(WHITE); c.rect(12*mm, cy, cw, 32*mm, fill=1, stroke=0)

    if pro and client.get('societe'):
        c.setFillColor(BLACK); c.setFont("Helvetica-Bold", 11)
        c.drawString(14*mm, cy+28*mm, client['societe'])
        c.setFont("Helvetica", 8); c.setFillColor(colors.HexColor("#444444"))
        infos = [client.get('adresse', ''), client.get('ville', ''),
                 client.get('email', ''), f"{client.get('prenom','')} {client.get('nom','')}"]
        for j, info in enumerate([i for i in infos if i][:4]):
            c.drawString(14*mm, cy+22*mm-j*5*mm, info)
    else:
        c.setFillColor(BLACK); c.setFont("Helvetica-Bold", 11)
        nom_complet = f"{client.get('prenom','')} {client.get('nom','').upper()}"
        c.drawString(14*mm, cy+28*mm, nom_complet)
        c.setFont("Helvetica", 8); c.setFillColor(colors.HexColor("#444444"))
        infos = [client.get('email',''), client.get('tel',''), client.get('date_event','')]
        for j, info in enumerate([i for i in infos if i][:3]):
            c.drawString(14*mm, cy+22*mm-j*5.5*mm, info)

    # Carte droite — événement
    ex = 12*mm+cw+6*mm; ew = cw
    c.setFillColor(GOLD); c.rect(ex, cy+32*mm, ew, 9*mm, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 7)
    c.drawString(ex+2*mm, cy+35.5*mm, "■  ÉVÉNEMENT")
    c.setFillColor(GL); c.rect(ex, cy, ew, 32*mm, fill=1, stroke=0)
    c.setFillColor(BLACK); c.setFont("Helvetica-Bold", 10)
    c.drawString(ex+2*mm, cy+28*mm, client.get('type_event', 'Événement'))
    c.setFont("Helvetica", 8); c.setFillColor(colors.HexColor("#444444"))
    c.drawString(ex+2*mm, cy+22*mm, client.get('date_event', ''))
    c.drawString(ex+2*mm, cy+16.5*mm, client.get('lieu', ''))

    # Titre PRESTATIONS
    py = cy-8*mm
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold", 7.5)
    c.drawString(12*mm, py, "PRESTATIONS")
    c.setStrokeColor(GOLD); c.setLineWidth(1.5)
    c.line(12*mm, py-2*mm, 38*mm, py-2*mm)
    c.setStrokeColor(colors.HexColor("#DDDDDD")); c.setLineWidth(0.4)
    c.line(39*mm, py-2*mm, W-10*mm, py-2*mm)

    # Tableau
    table_top = py-5*mm
    col_w_list = [21*mm, 80*mm, 14*mm, 23*mm, 23*mm, 22*mm, 16*mm]
    hdrs = ["Réf.", "Désignation", "Qté", "P.U TTC", "Total TTC", "Total HT", "TVA"]
    total_ttc = 0
    rows = [hdrs]

    for l in lignes:
        pu = l['pu_ttc']
        ttc = round(pu * l['qte'], 2)
        ht = round(ttc / 1.2, 2)
        tva = round(ttc - ht, 2)
        total_ttc += ttc
        rows.append([l['ref'], l['designation'], str(l['qte']),
                     fe(pu), fe(ttc), fe(ht), fe(tva)])

    # Note livraison
    note_row_idx = None
    retrait_row_idx = None
    if note_livraison:
        rows.append(["■", note_livraison, "", "", "", "", ""])
        note_row_idx = len(rows) - 1

    empty_rows = max(0, 5 - len(lignes) - (1 if note_livraison else 0))
    for _ in range(empty_rows):
        rows.append(["", "", "", "", "", "", ""])

    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7.5),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (2, 1), (2, -1), 'CENTER'),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GL]),
        ('LINEBELOW', (0, 0), (-1, 0), 0.8, GOLD),
        ('LINEBELOW', (0, 1), (-1, -1), 0.3, BORDER_C),
        ('BOX', (0, 0), (-1, -1), 0.3, BORDER_C),
        ('TEXTCOLOR', (0, 1), (0, -1), BLUE),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
    ]

    if note_row_idx is not None:
        style_cmds += [
            ('SPAN', (1, note_row_idx), (6, note_row_idx)),
            ('FONTNAME', (0, note_row_idx), (-1, note_row_idx), 'Helvetica-Oblique'),
            ('FONTSIZE', (0, note_row_idx), (-1, note_row_idx), 7),
            ('TEXTCOLOR', (1, note_row_idx), (6, note_row_idx), colors.HexColor("#555555")),
            ('TEXTCOLOR', (0, note_row_idx), (0, note_row_idx), GOLD),
        ]

    t = Table(rows, colWidths=col_w_list, rowHeights=[8*mm]+[9*mm]*len(rows[1:]))
    t.setStyle(TableStyle(style_cmds))
    tw, th = t.wrap(W-22*mm, 200*mm)
    t.drawOn(c, 12*mm, table_top-th)

    # INCLUS PHOTOBOOTH
    inclus_top = table_top - th - 4*mm
    ih = 44*mm
    iy = inclus_top - ih
    c.setFillColor(NAVY); c.rect(12*mm, iy, 31*mm, ih, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(27.5*mm, iy+ih/2+3*mm, "INCLUS")
    c.setFillColor(GOLD); c.setFont("Helvetica", 7)
    c.drawCentredString(27.5*mm, iy+ih/2-4*mm, "PHOTOBOOTH")

    items_L = ["✓  Photos numériques illimitées",
               "✓  Personnalisation des cadres photo",
               "✓  Filtres NB, Sépia, Pop Art",
               "✓  Envoi par mail ou SMS en temps réel"]
    items_R = ["✓  Assistance téléphonique incluse",
               "✓  Lien de téléchargement post-événement",
               "✓  Retrait possible dans nos locaux (pas de frais de livraison)",
               "✓  +200 tirages disponibles en cours d'événement (+100€)"]
    mid = (W-22*mm)/2
    for j, (lL, lR) in enumerate(zip(items_L, items_R)):
        bg = WHITE if j % 2 == 0 else GL
        y_i = iy+ih-7*mm-j*10*mm
        c.setFillColor(bg)
        c.rect(44*mm, y_i-1*mm, mid-3*mm, 10*mm, fill=1, stroke=0)
        c.rect(44*mm+mid-2*mm, y_i-1*mm, mid-3*mm, 10*mm, fill=1, stroke=0)
        c.setFillColor(BLACK); c.setFont("Helvetica", 7)
        c.drawString(46*mm, y_i+2*mm, lL)
        c.drawString(46*mm+mid-2*mm, y_i+2*mm, lR)

    # Totaux
    tva_total = round(total_ttc / 1.2 * 0.2, 2)
    ht_total = round(total_ttc / 1.2, 2)
    tot_y = iy - 5*mm

    tv_data = [["Base HT", "Taux TVA", "Montant TVA", "Total TTC"],
               [fe(ht_total), "20 %", fe(tva_total), fe(total_ttc)]]
    tv = Table(tv_data, colWidths=[31*mm, 22*mm, 31*mm, 31*mm], rowHeights=[6.5*mm, 7*mm])
    tv.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('BACKGROUND', (0, 1), (-1, 1), GL),
        ('GRID', (0, 0), (-1, -1), 0.3, BORDER_C),
    ]))
    tvw, tvh = tv.wrap(115*mm, 20*mm)
    tv.drawOn(c, 12*mm, tot_y-tvh)

    sx = W-68*mm
    for j, (lbl, val, bg) in enumerate([("Sous-total HT", fe(ht_total), GL),
                                         ("TVA (20 %)", fe(tva_total), WHITE),
                                         ("Total TTC", fe(total_ttc), GL)]):
        y = tot_y - j*6.5*mm - 6.5*mm
        c.setFillColor(GL if bg == GL else WHITE)
        c.rect(sx, y, 56*mm, 6.5*mm, fill=1, stroke=0)
        c.setFillColor(GD); c.setFont("Helvetica", 7)
        c.drawString(sx+2*mm, y+2*mm, lbl)
        c.setFillColor(BLACK); c.drawRightString(sx+54*mm, y+2*mm, val)
        c.setStrokeColor(BORDER_C); c.setLineWidth(0.3)
        c.rect(sx, y, 56*mm, 6.5*mm, fill=0, stroke=1)

    ny = tot_y - 3*6.5*mm - 6.5*mm - 2*mm
    c.setFillColor(NAVY); c.rect(sx, ny, 56*mm, 9*mm, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(sx, ny, 2*mm, 9*mm, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 8)
    c.drawString(sx+4*mm, ny+3*mm, "NET À PAYER")
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(sx+54*mm, ny+2.5*mm, fe(total_ttc))

    # Réservation
    rib_y = tot_y - tvh - 6*mm
    c.setStrokeColor(GOLD); c.setLineWidth(0.8)
    c.line(12*mm, rib_y+1*mm, W-10*mm, rib_y+1*mm)
    btn_x = 12*mm
    btn_y = rib_y - 14*mm

    if pro:
        c.setFillColor(BLUE); c.setFont("Helvetica-Bold", 7.5)
        c.drawString(btn_x, btn_y+5*mm, "Pour valider ce devis :")
        c.setFont("Helvetica", 7.5); c.setFillColor(BLACK)
        c.drawString(btn_x, btn_y+0.5*mm, "Merci de nous faire un retour bon pour accord par mail ou de nous renvoyer ce devis signé.")
    else:
        btn_w = 80*mm; btn_h = 11*mm
        c.setFillColor(colors.HexColor("#A07830"))
        c.roundRect(btn_x+0.8*mm, btn_y-0.8*mm, btn_w, btn_h, 2*mm, fill=1, stroke=0)
        c.setFillColor(GOLD)
        c.roundRect(btn_x, btn_y, btn_w, btn_h, 2*mm, fill=1, stroke=0)
        c.setFillColor(NAVY); c.setFont("Helvetica-Bold", 9.5)
        c.drawCentredString(btn_x+btn_w/2, btn_y+3.5*mm, "✦  RÉSERVEZ ICI  —  Acompte 60 €  ✦")
        c.linkURL(LIEN_PAI, (btn_x, btn_y, btn_x+btn_w, btn_y+btn_h), relative=0)
        c.setFillColor(BLUE); c.setFont("Helvetica", 6)
        c.drawString(btn_x, btn_y-4.5*mm, "(Le solde sera réglé à la livraison / retrait du matériel.)")
        nom_complet = f"{client.get('prenom','')} {client.get('nom','').upper()}"
        texte = "Merci d'indiquer le nom figurant sur ce devis lors du règlement : "
        c.setFillColor(colors.HexColor("#333333")); c.setFont("Helvetica-Oblique", 7)
        largeur_texte = c.stringWidth(texte, "Helvetica-Oblique", 7)
        c.drawString(btn_x, btn_y-9*mm, texte)
        c.setFont("Helvetica-Bold", 7); c.setFillColor(BLUE)
        c.drawString(btn_x+largeur_texte, btn_y-9*mm, nom_complet)

    # RIB
    rib2_y = btn_y - 16*mm
    c.setFillColor(GD); c.setFont("Helvetica-Bold", 6.5)
    c.drawString(12*mm, rib2_y, "RÈGLEMENT")
    c.setFont("Helvetica", 6.5)
    for j, line in enumerate([
        "IBAN : FR76 1350 7000 1931 9488 0215 975   |   BIC : CCBPFRPPLIL",
        "Code banque : 13507  |  Code guichet : 00019  |  N°Compte : 31948802159  |  Clé RIB : 75",
        "Règlement à réception  —  Chèque / Espèces / Virement bancaire"
    ]):
        c.setFillColor(BLACK if j < 2 else GD)
        c.drawString(12*mm, rib2_y-4.5*mm-j*4*mm, line)

    # Footer
    c.setFillColor(NAVY); c.rect(0, 0, W, 14*mm, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, 13.5*mm, W, 0.8*mm, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("Helvetica", 5.5)
    c.drawCentredString(W/2, 8*mm, "EURL NM EVENTS  —  Capital 1 000 €  —  SIRET 85249214900012  —  TVA FR67852492149  —  timetosmile.fr")
    c.setFillColor(GOLD); c.setFont("Helvetica-Bold", 6)
    c.drawCentredString(W/2, 3.5*mm, "Merci pour votre confiance ✦ Time To Smile")

    c.save(); packet.seek(0)
    return PdfReader(packet).pages[0]


def generer_devis(devis_num, client, lignes, note_livraison=None, pro=False):
    p1 = make_devis_page(devis_num, client, lignes, note_livraison, pro=pro)
    p2 = make_cgv_page()
    writer = PdfWriter()
    writer.add_page(p1)
    writer.add_page(p2)
    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return output


@app.route('/api/generate-pdf', methods=['POST'])
def generate_pdf():
    try:
        data = request.get_json()
        devis_num = data.get('devis_num', '0001')
        client = data.get('client', {})
        lignes = data.get('lignes', [])
        note_livraison = data.get('note_livraison')
        pro = data.get('pro', False)
        pdf_output = generer_devis(devis_num, client, lignes, note_livraison, pro)
        filename = f"Devis_{devis_num}_{client.get('nom','client')}.pdf"
        return send_file(pdf_output, mimetype='application/pdf',
                         as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'logo': os.path.exists(LOGO_PATH)})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)
