import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { safeJson, type Report, type ReportEntry } from "@/lib/report";
import { makeDocx, makePdf, type ReportImage } from "@/lib/render";

export const runtime = "nodejs";
export const maxDuration = 120;

type EntryImages = { code?: ReportImage; output?: ReportImage };
async function readImage(form: FormData, key: string): Promise<ReportImage | undefined> {
  const value = form.get(key);
  if (!(value instanceof File) || value.size === 0) return undefined;
  if (!["image/png", "image/jpeg"].includes(value.type)) throw new Error(`File ${value.name} harus PNG atau JPG.`);
  if (value.size > 8 * 1024 * 1024) throw new Error(`Ukuran ${value.name} maksimal 8 MB.`);
  return { name: value.name, type: value.type, buffer: Buffer.from(await value.arrayBuffer()) };
}

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY belum diatur di .env.local." }, { status: 503 });
    }
    const form = await request.formData();
    const templateText = String(form.get("templateText") || "");
    const identity = safeJson<Record<string, string>>(form.get("identity"), {});
    const experiments = safeJson<ReportEntry[]>(form.get("experiments"), []);
    const tasks = safeJson<ReportEntry[]>(form.get("tasks"), []);
    const questions = String(form.get("questions") || "");
    const format = String(form.get("format") || "docx");
    if (!templateText.trim()) return NextResponse.json({ error: "Teks template kosong." }, { status: 400 });
    if (!["docx", "pdf", "preview"].includes(format)) return NextResponse.json({ error: "Format output tidak valid." }, { status: 400 });

    const experimentImages: EntryImages[] = [];
    const taskImages: EntryImages[] = [];
    const imageParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    const addEntryImages = async (entries: ReportEntry[], kind: "experiment" | "task", target: EntryImages[]) => {
      for (let i = 0; i < entries.length; i++) {
        const code = await readImage(form, `${kind === "experiment" ? "experimentCode" : "taskCode"}_${i}`);
        const output = await readImage(form, `${kind === "experiment" ? "experimentOutput" : "taskOutput"}_${i}`);
        target[i] = { code, output };
        if (code) {
          imageParts.push({ text: `GAMBAR KODE PROGRAM untuk ${kind} ${i + 1} (${entries[i].title || "tanpa judul"}): baca dan transkripsikan kode dengan teliti.` });
          imageParts.push({ inlineData: { mimeType: code.type, data: code.buffer.toString("base64") } });
        }
        if (output) {
          imageParts.push({ text: `GAMBAR HASIL EKSEKUSI untuk ${kind} ${i + 1} (${entries[i].title || "tanpa judul"}): baca output terminal yang terlihat.` });
          imageParts.push({ inlineData: { mimeType: output.type, data: output.buffer.toString("base64") } });
        }
      }
    };
    await addEntryImages(experiments, "experiment", experimentImages);
    await addEntryImages(tasks, "task", taskImages);

    const prompt = `Anda adalah asisten penyusunan laporan praktikum berbahasa Indonesia. Analisis gambar screenshot yang disertakan bersama pesan ini. Untuk setiap bagian, gambar kode dan gambar hasil sudah diberi label yang menjelaskan pasangannya.

TUGAS WAJIB:
1. Baca kode program dari screenshot kode. Transkripsikan kode sedekat mungkin dengan yang terlihat. Jangan menebak baris yang buram atau terpotong; tandai [tidak terbaca] pada bagian tersebut.
2. Baca hasil kompilasi dan hasil eksekusi dari screenshot terminal. Catat hanya output yang benar-benar terlihat. Jangan membuat hasil pengujian atau angka sendiri.
3. Buat analisis dalam bahasa Indonesia yang mudah dipahami: jelaskan fungsi bagian kode, alur kerja, hubungan kode dengan output, dan apakah output sesuai dengan tujuan program berdasarkan bukti.
4. Jika gambar tidak cukup jelas, sebutkan bagian yang perlu diperiksa pengguna. Jangan menyatakan program berhasil dikompilasi bila bukti tidak ada.
5. Gunakan template sebagai sumber struktur dan pertahankan urutan bab, judul, pertanyaan, dan istilahnya. Jangan menghapus bagian template.
6. Jika informasi tidak tersedia, tulis "[Belum diisi oleh pengguna]". Jangan mengarang teori khusus atau hasil eksperimen.
7. Untuk gambar yang sesuai dengan percobaan/tugas, letakkan transkripsi kode pada field code, ringkasan hasil pada output, dan analisis pada analysis.

Kembalikan JSON valid saja dengan struktur:
{"title":"...","subtitle":"...","introduction":["..."],"theory":["..."],"experiments":[{"title":"...","purpose":"...","code":"...","compile":"...","output":"...","analysis":"..."}],"tasks":[{"title":"...","purpose":"...","code":"...","compile":"...","output":"...","analysis":"..."}],"analysisQuestions":[{"question":"...","answer":"..."}],"conclusion":["..."],"notes":["..."]}

IDENTITAS: ${JSON.stringify(identity)}
TEKS TEMPLATE:
${templateText.slice(0, 45000)}
DATA PERCOBAAN (catatan teks opsional; gunakan juga gambar yang dilabeli di bawah):
${JSON.stringify(experiments)}
DATA TUGAS:
${JSON.stringify(tasks)}
PERTANYAAN ANALISIS:
${questions}`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const result = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
      config: { responseMimeType: "application/json", temperature: 0.2 }
    });
    const content = result.text;
    if (!content) throw new Error("AI tidak mengembalikan konten laporan.");
    const report = JSON.parse(content) as Report;
    if (format === "preview") return NextResponse.json({ report });
    const bufferInput = { report, identity, experimentImages, taskImages };
    if (format === "docx") {
      const buffer = await makeDocx(bufferInput);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": 'attachment; filename="PROLAPRAK.docx"'
        }
      });
    }
    const buffer = await makePdf(bufferInput);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="PROLAPRAK.pdf"'
      }
    });
  } catch (error) {
    console.error("generate:", error);
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat membuat laporan.";
    return NextResponse.json({ error: message.includes("GEMINI") || message.includes("image/") || message.includes("maksimal") ? message : "Gagal membuat laporan. Periksa model Gemini, kuota API, ukuran gambar, dan data yang dimasukkan." }, { status: 500 });
  }
}