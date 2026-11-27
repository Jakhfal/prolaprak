import { NextResponse } from "next/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("template");
    if (!(file instanceof File)) return NextResponse.json({ error: "File template tidak ditemukan." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Ukuran template maksimal 15 MB." }, { status: 413 });
    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";
    let pages: number | undefined;
    if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (name.endsWith(".pdf")) {
      const result = await pdfParse(buffer);
      text = result.text;
      pages = result.numpages;
    } else {
      return NextResponse.json({ error: "Format file harus DOCX atau PDF." }, { status: 400 });
    }
    if (!text.trim()) return NextResponse.json({ error: "Teks tidak ditemukan. Pastikan PDF bukan hasil scan gambar atau gunakan DOCX." }, { status: 422 });
    return NextResponse.json({ text: text.slice(0, 100000), pages });
  } catch (error) {
    console.error("analyze-template:", error);
    return NextResponse.json({ error: "Gagal membaca dokumen. Periksa file lalu coba kembali." }, { status: 500 });
  }
}