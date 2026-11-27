import {
  AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun
} from "docx";
import PDFDocument from "pdfkit";
import type { Report } from "./report";

export type ReportImage = { name: string; type: string; buffer: Buffer };
type EntryImages = { code?: ReportImage; output?: ReportImage };
type Input = {
  report: Report;
  identity: Record<string,string>;
  experimentImages: EntryImages[];
  taskImages: EntryImages[];
};

const FONT = "Times New Roman";
const DOCX_MARGIN = 1701; // sekitar 3 cm
const BODY_SIZE = 24; // 12 pt dalam half-points

function paragraph(text: string, opts: { bold?: boolean; mono?: boolean; center?: boolean; pageBreakBefore?: boolean } = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    pageBreakBefore: opts.pageBreakBefore,
    spacing: { after: 120, line: 360 },
    children: [new TextRun({
      text: text || "[Belum diisi]",
      bold: opts.bold,
      font: FONT,
      size: BODY_SIZE
    })]
  });
}
function heading(text: string, pageBreakBefore = false) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    pageBreakBefore,
    spacing: { before: 240, after: 120, line: 360 },
    children: [new TextRun({ text, bold: true, font: FONT, size: BODY_SIZE })]
  });
}
function imageParagraph(image?: ReportImage) {
  if (!image) return paragraph("[Screenshot belum diberikan]");
  try {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160, line: 360 },
      children: [new ImageRun({
        data: image.buffer,
        transformation: { width: 440, height: 300 },
        type: image.type === "image/png" ? "png" : "jpg"
      })]
    });
  } catch {
    return paragraph(`[Gambar ${image.name} tidak dapat disisipkan]`);
  }
}
function addEntryDocx(entry: any, images: EntryImages | undefined, label: string, children: Paragraph[]) {
  children.push(heading(entry.title || label));
  if (entry.purpose) children.push(paragraph(`Tujuan: ${entry.purpose}`));
  children.push(heading("A. Kode Program"));
  children.push(imageParagraph(images?.code));
  children.push(paragraph(entry.code || "[Transkripsi kode belum tersedia]", { mono: true }));
  children.push(heading("B. Hasil Kompilasi"));
  children.push(paragraph(entry.compile || "[Informasi kompilasi belum tersedia]"));
  children.push(heading("C. Hasil Eksekusi"));
  children.push(imageParagraph(images?.output));
  children.push(paragraph(entry.output || "[Hasil eksekusi belum terbaca]"));
  children.push(heading("D. Analisis"));
  children.push(paragraph(entry.analysis || "[Analisis belum tersedia]"));
}
export async function makeDocx(input: Input): Promise<Buffer> {
  const { report, identity, experimentImages, taskImages } = input;
  const labels: Record<string,string> = {
    course:"Mata Kuliah", studyProgram:"Program Studi", name:"Nama",
    nim:"NIM", className:"Kelas", date:"Tanggal Praktikum", lecturer:"Dosen Pengampu"
  };
  const children: Paragraph[] = [
    paragraph("LAPORAN PRAKTIKUM", { bold: true, center: true }),
    paragraph(report.title || "LAPORAN PRAKTIKUM", { bold: true, center: true }),
    ...Object.entries(labels).map(([key,label]) => paragraph(`${label}: ${identity[key] || "................................"}`, { center: true })),
    heading("BAB I. PENDAHULUAN", true)
  ];
  (report.introduction || ["[Pendahuluan belum tersedia]"]).forEach((p,i) => children.push(paragraph(`${i+1}. ${p}`)));
  if (report.theory?.length) {
    children.push(heading("1.2 Dasar Teori"));
    report.theory.forEach((p,i) => children.push(paragraph(`${i+1}. ${p}`)));
  }
  children.push(heading("BAB II. LANGKAH KERJA DAN HASIL PERCOBAAN", true));
  (report.experiments || []).forEach((e,i) => addEntryDocx(e, experimentImages[i], `Percobaan ${i+1}`, children));
  if (report.tasks?.length) {
    children.push(heading("BAB III. TUGAS PRAKTIKUM", true));
    report.tasks.forEach((e,i) => addEntryDocx(e, taskImages[i], `Tugas ${i+1}`, children));
  }
  if (report.analysisQuestions?.length) {
    children.push(heading("BAB IV. PERTANYAAN ANALISIS", true));
    report.analysisQuestions.forEach((q,i) => {
      children.push(paragraph(`${i+1}. ${q.question}`, { bold: true }));
      children.push(paragraph(q.answer));
    });
  }
  children.push(heading("BAB V. KESIMPULAN", true));
  (report.conclusion || ["[Kesimpulan perlu ditinjau dan dilengkapi pengguna.]"]).forEach((p,i) => children.push(paragraph(`${i+1}. ${p}`)));
  if (report.notes?.length) {
    children.push(heading("CATATAN / BAGIAN YANG PERLU DILENGKAPI", true));
    report.notes.forEach(n => children.push(paragraph(`• ${n}`)));
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_SIZE }, paragraph: { spacing: { line: 360, after: 120 } } }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: DOCX_MARGIN, right: DOCX_MARGIN, bottom: DOCX_MARGIN, left: DOCX_MARGIN }
        }
      },
      children
    }]
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

function pdfText(doc: PDFKit.PDFDocument, text: string, opts: { bold?: boolean; mono?: boolean; center?: boolean } = {}) {
  doc.font(opts.bold ? "Times-Bold" : "Times-Roman")
    .fontSize(12).fillColor("#111827")
    .text(text || "[Belum diisi]", { align: opts.center ? "center" : "justify", lineGap: 6, paragraphGap: 5 });
  doc.moveDown(0.35);
}
function pdfHeading(doc: PDFKit.PDFDocument, text: string, pageBreak = false) {
  if (pageBreak) doc.addPage();
  doc.moveDown(0.4);
  doc.font("Times-Bold").fontSize(12).fillColor("#111827").text(text, { lineGap: 6 });
  doc.moveDown(0.25);
}
function pdfImage(doc: PDFKit.PDFDocument, image?: ReportImage) {
  if (!image) { pdfText(doc, "[Screenshot belum diberikan]"); return; }
  try {
    doc.image(image.buffer, { fit: [440, 360], align: "center" });
    doc.moveDown(0.5);
  } catch {
    pdfText(doc, `[Gambar ${image.name} tidak dapat ditampilkan]`);
  }
}
export async function makePdf(input: Input): Promise<Buffer> {
  return new Promise((resolve,reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 85, bottom: 85, left: 85, right: 85 },
      bufferPages: true,
      autoFirstPage: true
    });
    const chunks: Buffer[] = [];
    doc.on("data", c => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const { report, identity, experimentImages, taskImages } = input;
    doc.font("Times-Roman").fontSize(12);
    doc.moveDown(3);
    pdfText(doc, "LAPORAN PRAKTIKUM", { bold: true, center: true });
    pdfText(doc, report.title || "LAPORAN PRAKTIKUM", { bold: true, center: true });
    const labels: Record<string,string> = {
      course:"Mata Kuliah", studyProgram:"Program Studi", name:"Nama",
      nim:"NIM", className:"Kelas", date:"Tanggal Praktikum", lecturer:"Dosen Pengampu"
    };
    for (const [key,label] of Object.entries(labels)) pdfText(doc, `${label}: ${identity[key] || "................................"}`, { center: true });

    pdfHeading(doc, "BAB I. PENDAHULUAN", true);
    (report.introduction || ["[Pendahuluan belum tersedia]"]).forEach((p,i) => pdfText(doc, `${i+1}. ${p}`));
    if (report.theory?.length) {
      pdfHeading(doc, "1.2 Dasar Teori");
      report.theory.forEach((p,i) => pdfText(doc, `${i+1}. ${p}`));
    }
    pdfHeading(doc, "BAB II. LANGKAH KERJA DAN HASIL PERCOBAAN", true);
    const entry = (e: any, imgs: EntryImages | undefined, i: number, label: string) => {
      pdfHeading(doc, e.title || `${label} ${i+1}`);
      if (e.purpose) pdfText(doc, `Tujuan: ${e.purpose}`);
      pdfHeading(doc, "A. Kode Program"); pdfImage(doc, imgs?.code);
      pdfText(doc, e.code || "[Transkripsi kode belum tersedia]", { mono: true });
      pdfHeading(doc, "B. Hasil Kompilasi"); pdfText(doc, e.compile || "[Informasi kompilasi belum tersedia]");
      pdfHeading(doc, "C. Hasil Eksekusi"); pdfImage(doc, imgs?.output);
      pdfText(doc, e.output || "[Hasil eksekusi belum terbaca]");
      pdfHeading(doc, "D. Analisis"); pdfText(doc, e.analysis || "[Analisis belum tersedia]");
    };
    (report.experiments || []).forEach((e,i) => entry(e, experimentImages[i], i, "Percobaan"));
    if (report.tasks?.length) {
      pdfHeading(doc, "BAB III. TUGAS PRAKTIKUM", true);
      report.tasks.forEach((e,i) => entry(e, taskImages[i], i, "Tugas"));
    }
    if (report.analysisQuestions?.length) {
      pdfHeading(doc, "BAB IV. PERTANYAAN ANALISIS", true);
      report.analysisQuestions.forEach((q,i) => { pdfText(doc, `${i+1}. ${q.question}`, { bold: true }); pdfText(doc, q.answer); });
    }
    pdfHeading(doc, "BAB V. KESIMPULAN", true);
    (report.conclusion || ["[Kesimpulan perlu ditinjau dan dilengkapi pengguna.]"]).forEach((p,i) => pdfText(doc, `${i+1}. ${p}`));
    if (report.notes?.length) {
      pdfHeading(doc, "CATATAN / BAGIAN YANG PERLU DILENGKAPI", true);
      report.notes.forEach(n => pdfText(doc, `• ${n}`));
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font("Times-Roman").fontSize(12).fillColor("#64748b")
        .text(`${i+1}`, 0, doc.page.height - 45, { align: "center" });
    }
    doc.end();
  });
}