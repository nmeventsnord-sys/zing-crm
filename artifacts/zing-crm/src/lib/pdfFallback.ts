import jsPDF from "jspdf";

interface PdfLigne {
  ref: string;
  designation: string;
  qte: number;
  pu_ttc: number;
}

interface PdfClient {
  prenom: string;
  nom: string;
  email: string;
  tel: string;
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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmt(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

export function generatePdfFallback(payload: PdfPayload): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const navy = [13, 27, 42] as [number, number, number];
  const gold = [201, 168, 76] as [number, number, number];
  const W = 210;
  const M = 15;

  // ── Header background ────────────────────────────────────────────────
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("TIME TO SMILE", M, 15);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("5 rue du Colibri – 59650 Villeneuve d'Ascq", M, 21);
  doc.text("SIRET 85249214900012", M, 26);

  doc.setTextColor(...gold);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("DEVIS", W - M, 18, { align: "right" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(payload.devis_num, W - M, 26, { align: "right" });

  // ── Date ─────────────────────────────────────────────────────────────
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const today = new Date().toLocaleDateString("fr-FR");
  doc.text(`Date : ${today}`, W - M, 44, { align: "right" });

  // ── Client block ─────────────────────────────────────────────────────
  let cy = 42;
  doc.setTextColor(...navy);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENT", M, cy);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  cy += 5;
  const fullName = `${payload.client.prenom} ${payload.client.nom}`.trim();
  if (fullName) { doc.text(fullName, M, cy); cy += 4; }
  if (payload.client.societe) { doc.text(payload.client.societe, M, cy); cy += 4; }
  if (payload.client.email) { doc.text(payload.client.email, M, cy); cy += 4; }
  if (payload.client.tel) { doc.text(payload.client.tel, M, cy); cy += 4; }
  if (payload.client.adresse) { doc.text(payload.client.adresse, M, cy); cy += 4; }
  if (payload.client.ville) { doc.text(payload.client.ville, M, cy); cy += 4; }

  // ── Event block ───────────────────────────────────────────────────────
  if (payload.client.type_event || payload.client.date_event || payload.client.lieu) {
    cy += 2;
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.text("ÉVÉNEMENT", M, cy); cy += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    if (payload.client.type_event) { doc.text(`Type : ${payload.client.type_event}`, M, cy); cy += 4; }
    if (payload.client.date_event) { doc.text(`Date : ${payload.client.date_event}`, M, cy); cy += 4; }
    if (payload.client.lieu) { doc.text(`Lieu : ${payload.client.lieu}`, M, cy); cy += 4; }
  }

  // ── Lines table ──────────────────────────────────────────────────────
  const tableTop = Math.max(cy + 6, 90);
  const colX = [M, 40, 140, 158, 178];
  const colW = [25, 100, 18, 20, 17];
  const headers = ["Réf.", "Désignation", "Qté", "PU TTC", "Total TTC"];

  doc.setFillColor(...navy);
  doc.rect(M, tableTop - 5, W - 2 * M, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  headers.forEach((h, i) => {
    doc.text(h, colX[i], tableTop, { maxWidth: colW[i] });
  });

  let rowY = tableTop + 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(8);

  let totalHT = 0;
  let totalTTC = 0;

  payload.lignes.forEach((l, idx) => {
    const lineTTC = round2(l.qte * l.pu_ttc);
    const lineHT = round2(lineTTC / 1.2);
    totalHT += lineHT;
    totalTTC += lineTTC;

    if (idx % 2 === 1) {
      doc.setFillColor(245, 245, 250);
      doc.rect(M, rowY - 4, W - 2 * M, 6, "F");
    }
    doc.setTextColor(40, 40, 40);
    doc.text(l.ref ?? "", colX[0], rowY, { maxWidth: colW[0] });
    doc.text(l.designation, colX[1], rowY, { maxWidth: colW[1] });
    doc.text(String(l.qte), colX[2], rowY, { maxWidth: colW[2] });
    doc.text(fmt(l.pu_ttc), colX[3], rowY, { maxWidth: colW[3], align: "right" });
    doc.text(fmt(lineTTC), colX[4] + colW[4], rowY, { maxWidth: colW[4], align: "right" });
    rowY += 7;
  });

  totalHT = round2(totalHT);
  const totalTVA = round2(totalHT * 0.2);
  totalTTC = round2(totalHT + totalTVA);

  // ── Totals ────────────────────────────────────────────────────────────
  rowY += 3;
  const totX = 140;
  const valX = W - M;
  doc.setFontSize(8);

  doc.setFont("helvetica", "normal");
  doc.text("Total HT :", totX, rowY); doc.text(fmt(totalHT), valX, rowY, { align: "right" }); rowY += 5;
  doc.text("TVA 20% :", totX, rowY); doc.text(fmt(totalTVA), valX, rowY, { align: "right" }); rowY += 5;

  doc.setFillColor(...navy);
  doc.rect(totX - 3, rowY - 4, valX - totX + 6, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Total TTC :", totX, rowY); doc.text(fmt(totalTTC), valX, rowY, { align: "right" });

  // ── Note livraison ───────────────────────────────────────────────────
  if (payload.note_livraison) {
    rowY += 10;
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.text(payload.note_livraison, M, rowY, { maxWidth: W - 2 * M });
  }

  // ── Payment / footer ──────────────────────────────────────────────────
  const footY = 270;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.line(M, footY, W - M, footY);

  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("IBAN : FR76 1350 7000 1931 9488 0215 975  |  BIC : CCBPFRPPLIL", M, footY + 5);

  if (!payload.pro) {
    doc.setFillColor(...gold);
    doc.roundedRect(M, footY + 9, 75, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Payer par SumUp", M + 37.5, footY + 14, { align: "center" });
  } else {
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Signature client :", M, footY + 14);
    doc.setDrawColor(180, 180, 180);
    doc.rect(M + 35, footY + 9, 60, 12);
  }

  return doc.output("blob");
}
