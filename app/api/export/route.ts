import { NextResponse } from "next/server";
import { safeJson, type Report, type ReportEntry } from "@/lib/report";
import { makeDocx, makePdf, type ReportImage } from "@/lib/render";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    const form = await request.formData();
    const report = safeJson<Report>(form.get("report"), { title: "Laporan Praktikum" });
    const identity = safeJson<Record<string,string>>(form.get("identity"), {});
    const experiments = safeJson<ReportEntry[]>(form.get("experiments"), []);
    const tasks = safeJson<ReportEntry[]>(form.get("tasks"), []);
    const format = String(form.get("format") || "docx");
    if (!["docx", "pdf"].includes(format)) return NextResponse.json({ error: "Format output tidak valid." }, { status: 400 });

    const readEntries = async (entries: ReportEntry[], prefix: string) => {
      const result: EntryImages[] = [];
      for (let i = 0; i < entries.length; i++) {
        result.push({
          code: await readImage(form, `${prefix}Code_${i}`),
          output: await readImage(form, `${prefix}Output_${i}`)
        });
      }
      return result;
    };
    const experimentImages = await readEntries(experiments, "experiment");
    const taskImages = await readEntries(tasks, "task");
    const input = { report, identity, experimentImages, taskImages };
    const buffer = format === "docx" ? await makeDocx(input) : await makePdf(input);
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": format === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf",
      "Content-Disposition": `attachment; filename="PROLAPRAK.${format}"`
    }});
  } catch (error) {
    console.error("export:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengekspor laporan." }, { status: 500 });
  }
}
