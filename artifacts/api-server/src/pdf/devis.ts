import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const MM = 2.8346;
const W  = 595.28;
const H  = 841.89;

const SIDE  = 7  * MM;
const HDR_H = 52 * MM;
const MG_L  = SIDE + 8 * MM;
const MG_R  = 12 * MM;
const CW    = W - MG_L - MG_R;
const FTR_H = 14 * MM;

const NAVY  = "#0D1B2A";
const BLUE  = "#1F3864";
const GOLD  = "#C9A84C";
const GL    = "#F4F4F0";
const DARK  = "#1A1A1A";
const GREY  = "#666666";
const WHITE = "#FFFFFF";

// ── Logo (loaded once at module init) ────────────────────────────────────────
let LOGO_BUF: Buffer | null = null;
try {
  const __dir = path.dirname(fileURLToPath(import.meta.url));
  const logoPath = path.join(__dir, "..", "logo_0.png");
  if (fs.existsSync(logoPath)) LOGO_BUF = fs.readFileSync(logoPath);
} catch (_) { /* logo not available */ }

export interface PdfLigne {
  ref: string;
  designation: string;
  qte: number;
  pu_ttc: number;
}

export interface PdfClient {
  prenom: string;
  nom: string;
  email?: string;
  tel?: string;
  societe?: string;
  adresse?: string;
  ville?: string;
  type_event?: string;
  date_event?: string;
  lieu?: string;
  type: string;
}

export interface PdfPayload {
  devis_num: string;
  client: PdfClient;
  lignes: PdfLigne[];
  note_livraison?: string;
  pro: boolean;
}

function round2(n: number) { return Math.round(n * 100) / 100; }

// Manual thousands formatting — avoids toLocaleString which uses narrow
// no-break space (\u202f) that pdfkit/Helvetica cannot render
function fmt(n: number): string {
  const neg = n < 0;
  n = Math.abs(n);
  const c = Math.round(n * 100);
  const euros = Math.floor(c / 100);
  const cents = c % 100;
  let s: string;
  if (euros >= 1_000_000) {
    const M = Math.floor(euros / 1_000_000);
    const K = Math.floor((euros % 1_000_000) / 1_000);
    const U = euros % 1_000;
    s = `${M} ${K.toString().padStart(3, "0")} ${U.toString().padStart(3, "0")}`;
  } else if (euros >= 1_000) {
    s = `${Math.floor(euros / 1_000)} ${(euros % 1_000).toString().padStart(3, "0")}`;
  } else {
    s = euros.toString();
  }
  return `${neg ? "-" : ""}${s},${cents.toString().padStart(2, "0")} \u20ac`;
}

function fdate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Doc = InstanceType<typeof PDFDocument>;

function fr(doc: Doc, x: number, y: number, w: number, h: number, color: string) {
  doc.rect(x, y, w, h).fill(color);
}

function frr(doc: Doc, x: number, y: number, w: number, h: number, r: number, color: string) {
  doc.roundedRect(x, y, w, h, r).fill(color);
}

function strokeRect(doc: Doc, x: number, y: number, w: number, h: number, color: string, lw = 0.4) {
  doc.lineWidth(lw).rect(x, y, w, h).stroke(color);
}

function sf(doc: Doc, size: number, bold = false, italic = false) {
  let font = "Helvetica";
  if (bold && italic) font = "Helvetica-BoldOblique";
  else if (bold)   font = "Helvetica-Bold";
  else if (italic) font = "Helvetica-Oblique";
  doc.font(font).fontSize(size);
}

function t(
  doc: Doc,
  s: string,
  x: number,
  y: number,
  opts: { w?: number; align?: "left" | "center" | "right" } = {},
) {
  const { w = 0, align = "left" } = opts;
  const o: PDFKit.Mixins.TextOptions = { lineBreak: false };
  if (w) { o.width = w; o.align = align; }
  doc.text(s, x, y, o);
}

function hline(doc: Doc, x1: number, y: number, x2: number, color: string, lw = 0.8) {
  doc.moveTo(x1, y).lineTo(x2, y).lineWidth(lw).stroke(color);
}

function drawSidebar(doc: Doc) {
  fr(doc, 0, 0, SIDE, H, NAVY);
  const stripY = H * 0.33;
  const stripH = H * 0.32;
  fr(doc, 0, stripY, SIDE, stripH, GOLD);
}

function drawFooter(doc: Doc) {
  fr(doc, 0, H - FTR_H, W, FTR_H, NAVY);
  doc.fillColor(WHITE);
  sf(doc, 6.5);
  t(doc,
    "EURL NM EVENTS -- Capital 1 000 \u20ac -- " +
    "SIRET 85249214900012 -- TVA FR67852492149 -- timetosmile.fr",
    0, H - FTR_H + 4 * MM,
    { w: W, align: "center" },
  );
  doc.fillColor(GOLD);
  sf(doc, 7.5, true);
  t(doc,
    "Merci pour votre confiance  ***  Time To Smile",
    0, H - 5.5 * MM,
    { w: W, align: "center" },
  );
}

function drawPage1(doc: Doc, data: PdfPayload) {
  const cl       = data.client;
  const lignes   = data.lignes;
  const qnum     = data.devis_num || "DEV-2026-001";
  const note     = data.note_livraison || "";
  const pro      = data.pro || false;
  const today    = new Date();
  const valid    = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const fullName = `${cl.prenom ?? ""} ${cl.nom ?? ""}`.trim();

  function lineHT(l: PdfLigne) {
    const puHT = round2(round2(Number(l.pu_ttc)) / 1.2);
    return round2(puHT * Number(l.qte));
  }
  const totalHT  = round2(lignes.reduce((s, l) => s + lineHT(l), 0));
  const totalTVA = round2(totalHT * 0.2);
  const totalTTC = round2(totalHT + totalTVA);

  drawSidebar(doc);

  // ── Header (navy bar) ────────────────────────────────────────────────────
  fr(doc, 0, 0, W, HDR_H, NAVY);

  // Logo centred in header
  if (LOGO_BUF) {
    const logoH = HDR_H - 8 * MM;          // fills header minus top/bottom padding
    const logoW = logoH * (220 / 255);      // maintain 220x255 aspect ratio
    const logoX = (W - logoW) / 2;
    const logoY = 4 * MM;
    doc.image(LOGO_BUF, logoX, logoY, { width: logoW, height: logoH });
  }

  // Company info — left side
  doc.fillColor(WHITE);
  sf(doc, 9, true);
  t(doc, "TIME TO SMILE", MG_L, 10 * MM);
  sf(doc, 6.5);
  t(doc, "5 rue du Colibri -- 59650 Villeneuve d'Ascq", MG_L, 16 * MM);
  t(doc, "06.85.27.54.65  |  Nicolas@timetosmile.fr",   MG_L, 20.5 * MM);
  t(doc, "timetosmile.fr",                               MG_L, 25 * MM);

  // Quote info — right side
  const rx = W - MG_R;
  doc.fillColor(GOLD);
  sf(doc, 22, true);
  t(doc, "DEVIS", rx - 72, 10 * MM, { w: 72, align: "right" });

  doc.fillColor(WHITE);
  sf(doc, 11, true);
  t(doc, qnum, rx - 90, 20 * MM, { w: 90, align: "right" });
  sf(doc, 7);
  t(doc, "Emis le " + fdate(today),        rx - 90, 27 * MM, { w: 90, align: "right" });
  t(doc, "Validite : 60 jours",             rx - 90, 31 * MM, { w: 90, align: "right" });
  doc.fillColor(GOLD);
  sf(doc, 7);
  t(doc, "Valable jusqu'au " + fdate(valid), rx - 100, 36.5 * MM, { w: 100, align: "right" });

  // ── Gold accent line below header ────────────────────────────────────────
  doc.rect(SIDE, HDR_H, W - SIDE, 1.2).fill(GOLD);

  // ── Two cards ────────────────────────────────────────────────────────────
  const cardY = HDR_H + 5 * MM;
  const cardH = 34 * MM;
  const barH  = 8  * MM;
  const gap   = 4  * MM;
  const cw2   = (CW - gap) / 2;
  const lx2   = MG_L;
  const rx2   = MG_L + cw2 + gap;

  // LEFT card — DEVIS ETABLI POUR (blue header)
  fr(doc, lx2, cardY, cw2, cardH, WHITE);
  strokeRect(doc, lx2, cardY, cw2, cardH, "#D0D0D0", 0.4);
  fr(doc, lx2, cardY, cw2, barH, BLUE);
  doc.fillColor(WHITE);
  sf(doc, 7.5, true);
  t(doc, "DEVIS ETABLI POUR", lx2 + 3 * MM, cardY + 2.5 * MM);

  let cy = cardY + barH + 5.5 * MM;
  doc.fillColor(DARK);
  sf(doc, 10, true);
  t(doc, fullName.slice(0, 36), lx2 + 3 * MM, cy);
  cy += 5 * MM;
  sf(doc, 7.5);
  doc.fillColor("#333333");
  for (const [v, prefix] of [
    [cl.email || "", ""],
    [cl.tel   || "", ""],
    [cl.date_event || "", "Date : "],
  ] as [string, string][]) {
    if (v) {
      t(doc, `${prefix}${v}`.slice(0, 42), lx2 + 3 * MM, cy);
      cy += 4 * MM;
    }
  }
  if (pro && cl.societe) {
    t(doc, cl.societe.slice(0, 40), lx2 + 3 * MM, cy);
  }

  // RIGHT card — EVENEMENT (gold header)
  fr(doc, rx2, cardY, cw2, cardH, GL);
  strokeRect(doc, rx2, cardY, cw2, cardH, "#D0D0D0", 0.4);
  fr(doc, rx2, cardY, cw2, barH, GOLD);
  doc.fillColor(NAVY);
  sf(doc, 7.5, true);
  t(doc, "EVENEMENT", rx2 + 3 * MM, cardY + 2.5 * MM);

  let ey = cardY + barH + 5.5 * MM;
  doc.fillColor(DARK);
  if (cl.type_event) {
    sf(doc, 9, true);
    t(doc, cl.type_event.slice(0, 38), rx2 + 3 * MM, ey);
    ey += 5 * MM;
  }
  sf(doc, 7.5);
  doc.fillColor("#333333");
  for (const [v, prefix] of [
    [cl.date_event || "", "Date : "],
    [cl.lieu      || "", "Lieu : "],
    [cl.ville     || "", ""],
  ] as [string, string][]) {
    if (v) {
      t(doc, `${prefix}${v}`.slice(0, 38), rx2 + 3 * MM, ey);
      ey += 4 * MM;
    }
  }
  if (note) t(doc, note.slice(0, 38), rx2 + 3 * MM, ey);

  // ── PRESTATIONS section header ───────────────────────────────────────────
  let curY = cardY + cardH + 6 * MM;
  doc.fillColor(NAVY);
  sf(doc, 10, true);
  t(doc, "PRESTATIONS", MG_L, curY);
  hline(doc, MG_L, curY + 4.5 * MM, MG_L + CW, GOLD, 1.2);
  curY += 7 * MM;

  // ── Items table ──────────────────────────────────────────────────────────
  // Columns: Ref | Designation | Qte | PU TTC | Total TTC | Total HT | TVA
  // Total must fit CW (~183mm). Widths in mm: 13+82+10+22+22+20+14 = 183mm
  const colW = [13*MM, 82*MM, 10*MM, 22*MM, 22*MM, 20*MM, 14*MM];
  const hdrs = ["Ref.", "Designation", "Qte", "P.U. TTC", "Total TTC", "Total HT", "TVA"];
  const rowH = 6.5 * MM;
  const tHdr = 7.5 * MM;

  fr(doc, MG_L, curY, CW, tHdr, NAVY);
  let hx = MG_L + 2 * MM;
  for (let i = 0; i < hdrs.length; i++) {
    doc.fillColor(i === 0 ? "#90B4FF" : GOLD);
    sf(doc, 7, true);
    if (i <= 1) {
      t(doc, hdrs[i], hx, curY + 2.5 * MM);
    } else {
      t(doc, hdrs[i], hx, curY + 2.5 * MM, { w: colW[i] - 4*MM, align: "right" });
    }
    hx += colW[i];
  }
  curY += tHdr;

  for (let idx = 0; idx < lignes.length; idx++) {
    const ln    = lignes[idx];
    const puTTC = round2(Number(ln.pu_ttc));
    const qte   = Math.round(Number(ln.qte));
    const puHT  = round2(puTTC / 1.2);
    const ht    = round2(puHT * qte);
    const tva   = round2(ht * 0.2);
    const ttc   = round2(ht + tva);
    const ref   = String(ln.ref   ?? "");
    const desc  = String(ln.designation ?? "");

    fr(doc, MG_L, curY, CW, rowH, idx % 2 === 0 ? WHITE : GL);

    let rx3 = MG_L + 2 * MM;

    // Ref
    doc.fillColor(BLUE);
    sf(doc, 7.5, true);
    t(doc, ref.slice(0, 12), rx3, curY + 2 * MM);
    rx3 += colW[0];

    // Designation — no truncation, reduce font if very long
    doc.fillColor(DARK);
    const maxDescChars = 55;
    const dispDesc = desc.length > maxDescChars
      ? desc.slice(0, maxDescChars - 1) + "."
      : desc;
    sf(doc, desc.length > 48 ? 6.5 : 7.5);
    t(doc, dispDesc, rx3, curY + (desc.length > 48 ? 2.5 : 2) * MM);
    rx3 += colW[1];

    // Numeric columns (right-aligned)
    doc.fillColor(DARK);
    sf(doc, 7.5);
    t(doc, String(qte),  rx3, curY + 2*MM, { w: colW[2]-4*MM, align:"right" }); rx3 += colW[2];
    t(doc, fmt(puTTC),   rx3, curY + 2*MM, { w: colW[3]-4*MM, align:"right" }); rx3 += colW[3];
    sf(doc, 7.5, true);
    t(doc, fmt(ttc),     rx3, curY + 2*MM, { w: colW[4]-4*MM, align:"right" }); rx3 += colW[4];
    doc.fillColor(GREY);
    sf(doc, 7.5);
    t(doc, fmt(ht),      rx3, curY + 2*MM, { w: colW[5]-4*MM, align:"right" }); rx3 += colW[5];
    t(doc, "20 %",       rx3, curY + 2*MM, { w: colW[6]-4*MM, align:"right" });

    curY += rowH;
  }

  hline(doc, MG_L, curY, MG_L + CW, "#CCCCCC", 0.3);

  // ── INCLUS PHOTOBOOTH ────────────────────────────────────────────────────
  const inclus = [
    "+ Photos numeriques illimitees",
    "+ Personnalisation des cadres photo",
    "+ Filtres NB, Sepia, Pop Art",
    "+ Envoi par mail ou SMS en temps reel",
    "+ Assistance telephonique incluse",
    "+ Lien de telechargement post-evenement",
    "+ Retrait possible dans nos locaux (pas de frais de livraison)",
    "+ +200 tirages disponibles en cours d'evenement (+100 euros)",
  ];

  const nRows  = inclus.length;        // 8 rows, single column
  const incRH  = 5.5 * MM;
  const incH   = nRows * incRH + 3 * MM;
  const blkW   = 30 * MM;             // left navy block width
  const incY   = curY + 4 * MM;
  const itemX  = MG_L + blkW + 3 * MM;
  const itemW  = CW - blkW - 3 * MM;

  // Navy left block
  fr(doc, MG_L, incY, blkW, incH, NAVY);

  // "INCLUS PHOTOBOOTH" rotated 90° — centred in the navy block
  doc.save();
  const bCX = MG_L + blkW / 2;
  const bCY = incY + incH / 2;
  doc.translate(bCX, bCY).rotate(-90, { origin: [0, 0] });
  doc.fillColor(GOLD);
  sf(doc, 8, true);
  doc.text("INCLUS PHOTOBOOTH", -(incH / 2), -5, {
    width: incH,
    align: "center",
    lineBreak: false,
  });
  doc.restore();

  // Items — single column, no truncation
  for (let i = 0; i < inclus.length; i++) {
    const iy = incY + i * incRH;
    fr(doc, MG_L + blkW, iy, CW - blkW, incRH, i % 2 === 0 ? WHITE : GL);

    doc.fillColor(DARK);
    sf(doc, 7);
    t(doc, inclus[i], itemX, iy + 1.8 * MM, { w: itemW, align: "left" });
  }

  curY = incY + incH + 5 * MM;

  // ── Totals (4-col summary table) ─────────────────────────────────────────
  const totTW = CW * 0.55;
  const col4  = totTW / 4;
  const totRH = 6 * MM;

  fr(doc, MG_L, curY, totTW, totRH, NAVY);
  for (let i = 0; i < 4; i++) {
    doc.fillColor(GOLD);
    sf(doc, 6.5, true);
    t(doc, ["Base HT","Taux TVA","Montant TVA","Total TTC"][i],
      MG_L + i * col4, curY + 2 * MM, { w: col4, align: "center" });
  }

  fr(doc, MG_L, curY + totRH, totTW, totRH, GL);
  for (let i = 0; i < 4; i++) {
    doc.fillColor(DARK);
    sf(doc, 7.5, i === 3);
    t(doc, [fmt(totalHT), "20 %", fmt(totalTVA), fmt(totalTTC)][i],
      MG_L + i * col4, curY + totRH + 2 * MM, { w: col4, align: "center" });
  }

  // ── Right summary box ────────────────────────────────────────────────────
  const bx  = MG_L + totTW + 5 * MM;
  const bw  = W - MG_R - bx;
  const brh = 5.5 * MM;
  let   by  = curY;

  for (const [bg, lbl, val, bld] of [
    [GL,    "Sous-total HT", fmt(totalHT),  false],
    [WHITE, "TVA 20 %",      fmt(totalTVA), false],
    [GL,    "Total TTC",     fmt(totalTTC), true ],
  ] as [string, string, string, boolean][]) {
    fr(doc, bx, by, bw, brh, bg);
    doc.fillColor(DARK);
    sf(doc, 7.5, bld);
    t(doc, lbl, bx + 3*MM, by + 1.8*MM);
    t(doc, val, bx,        by + 1.8*MM, { w: bw - 3*MM, align: "right" });
    by += brh;
  }

  const netH = 9 * MM;
  fr(doc, bx, by, bw, netH, NAVY);
  doc.fillColor(GOLD);
  sf(doc, 7, true);
  t(doc, "NET A PAYER", bx + 3*MM, by + 3.5*MM);
  doc.fillColor(WHITE);
  sf(doc, 10, true);
  t(doc, fmt(totalTTC), bx, by + 2.5*MM, { w: bw - 3*MM, align: "right" });
  by += netH;

  let payY = Math.min(curY + 2 * totRH, by) + 8 * MM;

  // ── Payment ──────────────────────────────────────────────────────────────
  if (!pro) {
    // Button LEFT aligned at MG_L, width ~80mm
    const btnW = 80 * MM;
    const btnH = 10 * MM;
    const btnX = MG_L;
    frr(doc, btnX, payY, btnW, btnH, 4, GOLD);
    doc.fillColor(NAVY);
    sf(doc, 8.5, true);
    t(doc, "RESERVEZ ICI -- Acompte 60 \u20ac",
      btnX + 3*MM, payY + 3.5 * MM);
    payY += btnH + 5 * MM;

    doc.fillColor(DARK);
    sf(doc, 7.5, false, true);
    t(doc, "(Le solde sera regle a la livraison / retrait du materiel.)",
      MG_L, payY, { w: CW, align: "center" });
    payY += 4 * MM;
    t(doc, `Merci d'indiquer le nom figurant sur ce devis : ${fullName}`,
      MG_L, payY, { w: CW, align: "center" });
    payY += 6 * MM;
  } else {
    doc.fillColor(BLUE);
    sf(doc, 9, true);
    t(doc, "Pour valider ce devis :", MG_L, payY);
    payY += 5 * MM;
    doc.fillColor(DARK);
    sf(doc, 8);
    t(doc,
      "Merci de nous faire un retour bon pour accord par mail " +
      "ou de nous renvoyer ce devis signe.",
      MG_L, payY, { w: CW });
    payY += 10 * MM;
    hline(doc, MG_L, payY, MG_L + 70*MM, NAVY, 0.4);
    doc.fillColor(GREY);
    sf(doc, 7, false, true);
    t(doc, "Date et signature -- Bon pour accord", MG_L, payY + 3.5*MM);
    payY += 8 * MM;
  }

  // ── REGLEMENT ────────────────────────────────────────────────────────────
  const regY = payY + 3 * MM;
  doc.fillColor(NAVY);
  sf(doc, 8, true);
  t(doc, "REGLEMENT", MG_L, regY);
  hline(doc, MG_L, regY + 3.5*MM, MG_L + 28*MM, GOLD, 0.8);

  let regLineY = regY + 7 * MM;
  doc.fillColor(DARK);
  sf(doc, 7.5);
  for (const ln of [
    "IBAN : FR76 1350 7000 1931 9488 0215 975  |  BIC : CCBPFRPPLIL",
    "Code banque : 13507  |  Code guichet : 00019  " +
    "|  N Compte : 31948802159  |  Cle RIB : 75",
    "Reglement a reception -- Cheque / Especes / Virement bancaire",
  ]) {
    t(doc, ln, MG_L, regLineY);
    regLineY += 4 * MM;
  }

  drawFooter(doc);
}

// ── Page 2 — CGV ─────────────────────────────────────────────────────────────

const CGV: [string, string][] = [
  ["Art. 1 - Champ d'application",
   "Les presentes CGV regissent l'ensemble des prestations proposees " +
   "par Time to Smile (EURL NM EVENTS, SIRET 85249214900012). Toute commande implique " +
   "l'acceptation pleine et entiere de ces conditions."],
  ["Art. 2 - Commandes & annulation",
   "Reservation definitive a reception de l'acompte de 60 \u20ac. " +
   "* Plus de 30 j : remboursement hors acompte. " +
   "* 15 a 30 j : aucun remboursement. " +
   "* Moins de 15 j ou jour J : facturation integrale."],
  ["Art. 3 - Conditions tarifaires",
   "Tarifs TTC pour particuliers, HT pour professionnels. Prix indiques dans le devis valide. " +
   "Toute prestation supplementaire non prevue fera l'objet d'un avenant."],
  ["Art. 4 - Facturation & paiement",
   "Solde exigible le jour de la prestation, avant debut d'evenement. " +
   "Modes : especes, virement, SumUp. " +
   "IBAN : FR76 1350 7000 1931 9488 0215 975."],
  ["Art. 5 - Fourniture des services",
   "Time to Smile s'engage a fournir la borne photo avec technicien qualifie. " +
   "En cas d'empechement technique, une solution alternative ou un remboursement sera propose."],
  ["Art. 6 - Obligations du client",
   "Le client fournit un espace plan de 2m x 2m minimum, acces 220V securise, " +
   "et previent Time to Smile de tout changement au moins 48h a l'avance."],
  ["Art. 7 - Force majeure",
   "Time to Smile n'est pas responsable d'une inexecution causee par un evenement " +
   "de force majeure. Un report ou remboursement integral sera propose."],
  ["Art. 8 - Responsabilite du prestataire",
   "La responsabilite de Time to Smile est limitee au montant de la prestation. " +
   "Couverture RC professionnelle. Toute degradation du materiel sera facturee."],
  ["Art. 9 - Propriete intellectuelle",
   "Templates, designs et logiciels de la borne restent la propriete de Time to Smile. " +
   "Toute reproduction commerciale sans accord ecrit est interdite."],
  ["Art. 10 - Donnees personnelles RGPD",
   "Donnees utilisees uniquement dans le cadre de la relation commerciale. " +
   "Conformement au RGPD, le client dispose d'un droit d'acces, de " +
   "rectification et de suppression de ses donnees."],
  ["Art. 11 - Duree & resiliation",
   "Le contrat prend fin a l'issue de la prestation. En cas de manquement grave, " +
   "resiliation possible avec preavis ecrit de 48h et paiement des services effectues."],
  ["Art. 12 - Droit de retractation",
   "Conformement a l'art. L221-28 du Code de la consommation, le droit de " +
   "retractation ne s'applique pas aux prestations de loisirs a date determinee."],
  ["Art. 13 - Conditions techniques",
   "Prise 220V a moins de 5m, espace plan et sec de 2m x 2m requis. " +
   "Si conditions inadaptees, Time to Smile peut refuser la prestation sans remboursement."],
  ["Art. 14 - Reclamations",
   "Reclamation par ecrit sous 48h apres la prestation. " +
   "Passe ce delai, aucune reclamation ne sera recevable. " +
   "Contact : Nicolas@timetosmile.fr"],
  ["Art. 15 - Sous-traitance",
   "Time to Smile peut faire appel a des sous-traitants sous sa responsabilite. " +
   "Le client en sera informe prealablement si cela impacte la prestation."],
  ["Art. 16 - Modification des CGV",
   "Time to Smile se reserve le droit de modifier les CGV a tout moment. " +
   "Les conditions applicables sont celles en vigueur au jour de la commande."],
  ["Art. 17 - Nullite partielle",
   "Si une clause est declaree nulle ou inapplicable, les autres clauses restent " +
   "pleinement en vigueur et conservent leur effet juridique."],
  ["Art. 18 - Acceptation",
   "La signature du devis ou le reglement de l'acompte vaut acceptation pleine et " +
   "entiere des presentes CGV par le client."],
];

function drawCGV(doc: Doc) {
  drawSidebar(doc);

  fr(doc, 0, 0, W, 28 * MM, NAVY);
  // Gold accent line at bottom of CGV header
  doc.rect(SIDE, 28 * MM, W - SIDE, 1.2).fill(GOLD);

  doc.fillColor(GOLD);
  sf(doc, 15, true);
  t(doc, "CONDITIONS GENERALES DE VENTE", MG_L, 8 * MM);
  doc.fillColor(WHITE);
  sf(doc, 7);
  t(doc, "Time to Smile (EURL NM EVENTS) -- SIRET 85249214900012", MG_L, 20 * MM);

  const colW2  = (CW - 4 * MM) / 2;
  const col2X  = [MG_L, MG_L + colW2 + 4 * MM];
  const artH   = 24 * MM;
  const startY = 33 * MM;
  const perCol = 9;

  for (let i = 0; i < CGV.length; i++) {
    const col   = i < perCol ? 0 : 1;
    const row   = col === 0 ? i : i - perCol;
    const x     = col2X[col];
    const artY  = startY + row * artH;
    const isOdd = i % 2 === 1;

    fr(doc, x, artY, colW2, artH, isOdd ? GL : WHITE);
    strokeRect(doc, x, artY, colW2, artH, "#D8D8D8", 0.3);

    fr(doc, x, artY, colW2, 7 * MM, isOdd ? BLUE : NAVY);
    doc.fillColor(WHITE);
    sf(doc, 7, true);
    t(doc, CGV[i][0], x + 3 * MM, artY + 2 * MM);

    doc.fillColor(DARK);
    sf(doc, 6.5);
    doc.text(CGV[i][1], x + 3 * MM, artY + 9 * MM, {
      width: colW2 - 6 * MM,
      lineBreak: true,
      height: artH - 11 * MM,
    });
  }

  drawFooter(doc);
}

export function generateDevis(payload: PdfPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      drawPage1(doc, payload);
      doc.addPage({ size: "A4", margin: 0 });
      drawCGV(doc);
    } catch (e) {
      reject(e);
      return;
    }

    doc.end();
  });
}
