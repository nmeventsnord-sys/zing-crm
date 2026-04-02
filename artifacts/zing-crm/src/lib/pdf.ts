import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ContactType } from "./supabase";

export interface PDFItem {
  description: string;
  quantity: number;
  unit_price: number;
  tva_rate: number;
}

export interface PDFQuoteData {
  quoteNumber: string;
  title: string;
  items: PDFItem[];
  notes?: string | null;
  contact: {
    full_name: string;
    type: ContactType | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    address?: string | null;
  };
}

const N: [number, number, number] = [13, 27, 42];
const G: [number, number, number] = [201, 168, 76];
const W: [number, number, number] = [255, 255, 255];
const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const dateStr = (d: Date) => new Intl.DateTimeFormat("fr-FR").format(d);
const today = () => dateStr(new Date());
const validity = () => {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return dateStr(d);
};

export function generateQuotePDF(data: PDFQuoteData): void {
  const isPro = data.contact.type === "Professionnel";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W_PAGE = 210;
  const mg = 14;
  const cw = W_PAGE - 2 * mg;
  const [nR, nG, nB] = N;
  const [gR, gG, gB] = G;

  const totals = data.items.reduce(
    (acc, item) => {
      const ht = item.quantity * item.unit_price;
      const tva = ht * (item.tva_rate / 100);
      return { ht: acc.ht + ht, tva: acc.tva + tva, ttc: acc.ttc + ht + tva };
    },
    { ht: 0, tva: 0, ttc: 0 }
  );

  // ── HEADER ──────────────────────────────────────────────────
  doc.setFillColor(nR, nG, nB);
  doc.rect(0, 0, W_PAGE, 38, "F");
  doc.setFillColor(gR, gG, gB);
  doc.rect(0, 38, W_PAGE, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(gR, gG, gB);
  doc.text("TIME TO SMILE", mg, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...W);
  doc.text("5 rue du Colibri, 59650 Villeneuve d'Ascq", mg, 20);
  doc.text("06.85.27.54.65  •  Nicolas@timetosmile.fr", mg, 26);
  doc.text("SIRET 85249214900012", mg, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(gR, gG, gB);
  doc.text("DEVIS", W_PAGE - mg, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...W);
  doc.text(`N\u00b0 ${data.quoteNumber}`, W_PAGE - mg, 24, { align: "right" });
  doc.text(`Date : ${today()}`, W_PAGE - mg, 30, { align: "right" });
  doc.text(`Valable jusqu'au ${validity()}`, W_PAGE - mg, 36, { align: "right" });

  // ── CLIENT / OBJET ───────────────────────────────────────────
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(gR, gG, gB);
  doc.text("DESTINATAIRE", mg, y);
  doc.setDrawColor(gR, gG, gB);
  doc.setLineWidth(0.4);
  doc.line(mg, y + 1, mg + 34, y + 1);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(nR, nG, nB);
  doc.text(data.contact.full_name, mg, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  if (data.contact.company) { doc.text(data.contact.company, mg, y); y += 4.5; }
  if (data.contact.email) { doc.text(data.contact.email, mg, y); y += 4.5; }
  if (data.contact.phone) { doc.text(data.contact.phone, mg, y); y += 4.5; }
  if (data.contact.address) {
    const lines = doc.splitTextToSize(data.contact.address, 85) as string[];
    doc.text(lines, mg, y);
    y += lines.length * 4.5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(gR, gG, gB);
  doc.text("OBJET", W_PAGE / 2 + 4, 48);
  doc.setDrawColor(gR, gG, gB);
  doc.line(W_PAGE / 2 + 4, 49, W_PAGE / 2 + 22, 49);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(nR, nG, nB);
  const titleLines = doc.splitTextToSize(data.title, 82) as string[];
  doc.text(titleLines, W_PAGE / 2 + 4, 55);

  y = Math.max(y + 6, 74);
  doc.setFillColor(nR, nG, nB);
  doc.rect(mg, y, cw, 0.5, "F");
  y += 5;

  // ── ITEMS TABLE ──────────────────────────────────────────────
  const head = isPro
    ? [["Description", "Qté", "P.U. HT", "TVA %", "Total HT"]]
    : [["Description", "Qté", "P.U. TTC", "Total TTC"]];

  const body = data.items.map((item) => {
    const ht = item.quantity * item.unit_price;
    const tva = ht * (item.tva_rate / 100);
    const ttc = ht + tva;
    const unitTTC = item.unit_price * (1 + item.tva_rate / 100);
    return isPro
      ? [item.description, String(item.quantity), fmtEur(item.unit_price), `${item.tva_rate}%`, fmtEur(ht)]
      : [item.description, String(item.quantity), fmtEur(unitTTC), fmtEur(ttc)];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
    headStyles: { fillColor: [nR, nG, nB], textColor: [gR, gG, gB], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [244, 246, 250] },
    columnStyles: isPro
      ? {
          0: { cellWidth: "auto" },
          1: { cellWidth: 14, halign: "center" },
          2: { cellWidth: 26, halign: "right" },
          3: { cellWidth: 14, halign: "center" },
          4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
        }
      : {
          0: { cellWidth: "auto" },
          1: { cellWidth: 16, halign: "center" },
          2: { cellWidth: 30, halign: "right" },
          3: { cellWidth: 30, halign: "right", fontStyle: "bold" },
        },
    margin: { left: mg, right: mg },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  if (y + 55 > 265) {
    doc.addPage();
    y = 20;
  }

  // ── TOTALS ───────────────────────────────────────────────────
  const totW = 85;
  const totX = W_PAGE - mg - totW;

  if (isPro) {
    doc.setFillColor(242, 244, 248);
    doc.rect(totX, y, totW, 8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text("Total HT", totX + 4, y + 5.5);
    doc.setFont("helvetica", "bold");
    doc.text(fmtEur(totals.ht), totX + totW - 4, y + 5.5, { align: "right" });
    y += 9;

    doc.setFillColor(232, 235, 242);
    doc.rect(totX, y, totW, 8, "F");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("TVA 20 %", totX + 4, y + 5.5);
    doc.setFont("helvetica", "bold");
    doc.text(fmtEur(totals.tva), totX + totW - 4, y + 5.5, { align: "right" });
    y += 9;

    doc.setFillColor(nR, nG, nB);
    doc.rect(totX, y, totW, 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(gR, gG, gB);
    doc.text("TOTAL TTC", totX + 4, y + 7.5);
    doc.text(fmtEur(totals.ttc), totX + totW - 4, y + 7.5, { align: "right" });
    y += 15;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(nR, nG, nB);
    doc.text("Bon pour accord — Date et signature :", mg, y);
    y += 14;
    doc.setDrawColor(nR, nG, nB);
    doc.setLineWidth(0.3);
    doc.line(mg, y, mg + 85, y);
    y += 2;
  } else {
    doc.setFillColor(nR, nG, nB);
    doc.rect(totX, y, totW, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(gR, gG, gB);
    doc.text("NET \u00c0 PAYER", totX + 4, y + 6);
    doc.setFontSize(12);
    doc.setTextColor(...W);
    doc.text(fmtEur(totals.ttc), totX + totW - 4, y + 11.5, { align: "right" });
    y += 18;

    doc.setFillColor(gR, gG, gB);
    doc.rect(mg, y, cw, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(nR, nG, nB);
    doc.text("R\u00c9SERVEZ ICI \u2014 Acompte 60 \u20ac", mg + 5, y + 6.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("https://pay.sumup.com/b2c/QEVGSUR1", mg + 5, y + 12);
    y += 20;
  }

  // ── IBAN + NOTES ─────────────────────────────────────────────
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("IBAN : FR76 1350 7000 1931 9488 0215 975", mg, y);
  y += 5;
  doc.text(`Devis valable 60 jours \u2014 jusqu'au ${validity()}`, mg, y);

  if (data.notes) {
    y += 5;
    doc.setFont("helvetica", "italic");
    doc.setTextColor(110, 110, 110);
    const noteLines = doc.splitTextToSize("Notes : " + data.notes, cw) as string[];
    doc.text(noteLines, mg, y);
  }

  // ── PAGE 2: CGV ──────────────────────────────────────────────
  doc.addPage();

  doc.setFillColor(nR, nG, nB);
  doc.rect(0, 0, W_PAGE, 18, "F");
  doc.setFillColor(gR, gG, gB);
  doc.rect(0, 18, W_PAGE, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(gR, gG, gB);
  doc.text("TIME TO SMILE", mg, 12);
  doc.setFontSize(9.5);
  doc.text("CONDITIONS G\u00c9N\u00c9RALES DE VENTE", W_PAGE - mg, 12, { align: "right" });

  let cy = 27;
  const cgv = (title: string, body: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(nR, nG, nB);
    doc.text(title, mg, cy);
    cy += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(45, 45, 45);
    const lines = doc.splitTextToSize(body, cw) as string[];
    doc.text(lines, mg, cy);
    cy += lines.length * 4.2 + 4;
  };

  cgv("Article 1 \u2014 Objet",
    "Les pr\u00e9sentes CGV r\u00e9gissent toutes les prestations de location de borne photo propos\u00e9es par Time to Smile, 5 rue du Colibri 59650 Villeneuve d'Ascq, SIRET 85249214900012.");
  cgv("Article 2 \u2014 R\u00e9servation et acompte",
    "Toute r\u00e9servation n'est d\u00e9finitive qu'\u00e0 r\u00e9ception d'un acompte de 60 \u20ac (non remboursable) r\u00e9gl\u00e9 via SumUp ou virement bancaire. La date est bloqu\u00e9e d\u00e8s r\u00e9ception du paiement.");
  cgv("Article 3 \u2014 Prestations",
    "Le forfait comprend la mise \u00e0 disposition de la borne photo pour la dur\u00e9e choisie, la pr\u00e9sence d'un technicien, les accessoires inclus dans la formule, et l'acc\u00e8s aux photos en ligne apr\u00e8s l'\u00e9v\u00e9nement.");
  cgv("Article 4 \u2014 Annulation",
    "Annulation > 30 jours : remboursement hors acompte. Annulation entre 15 et 30 jours : aucun remboursement. Annulation < 15 jours ou le jour J : facturation int\u00e9grale du montant.");
  cgv("Article 5 \u2014 Responsabilit\u00e9 du client",
    "Le client s'engage \u00e0 fournir un espace adapt\u00e9 (2m \u00d7 2m minimum, acc\u00e8s 220V). Toute d\u00e9gradation du mat\u00e9riel imputable au client ou \u00e0 ses invit\u00e9s sera factur\u00e9e au tarif en vigueur.");
  cgv("Article 6 \u2014 Paiement",
    "Le solde est \u00e0 r\u00e9gler le jour de la prestation, avant le d\u00e9but de l'\u00e9v\u00e9nement, par virement ou SumUp. IBAN : FR76 1350 7000 1931 9488 0215 975. Les ch\u00e8ques ne sont pas accept\u00e9s.");
  cgv("Article 7 \u2014 Donn\u00e9es personnelles",
    "Les photos g\u00e9n\u00e9r\u00e9es restent la propri\u00e9t\u00e9 des utilisateurs. Time to Smile peut utiliser quelques clich\u00e9s \u00e0 titre promotionnel sauf opposition du client. Donn\u00e9es trait\u00e9es conform\u00e9ment au RGPD.");
  cgv("Article 8 \u2014 Force majeure",
    "Time to Smile ne saurait \u00eatre responsable d'une inexecution due \u00e0 un \u00e9v\u00e9nement de force majeure. Un report ou remboursement int\u00e9gral sera propos\u00e9.");
  cgv("Article 9 \u2014 Litiges",
    "En cas de diff\u00e9rend, une solution amiable sera recherch\u00e9e. \u00c0 d\u00e9faut, les tribunaux de Lille (59) seront comp\u00e9tents. Droit applicable : droit fran\u00e7ais.");

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Time to Smile \u2014 5 rue du Colibri 59650 Villeneuve d'Ascq \u2014 SIRET 85249214900012 \u2014 Nicolas@timetosmile.fr",
    W_PAGE / 2, 290, { align: "center" }
  );

  doc.save(`${data.quoteNumber}.pdf`);
}
