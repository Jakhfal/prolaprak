"use client";

import { useMemo, useState } from "react";
import type { Report, ReportEntry } from "@/lib/report";

type Entry = ReportEntry & { codeImage: File | null; outputImage: File | null };
const emptyEntry = (title = ""): Entry => ({ title, code: "", compile: "", output: "", analysis: "", codeImage: null, outputImage: null });
const initialReport: Report = { title: "Laporan Praktikum", introduction: [], theory: [], experiments: [], tasks: [], analysisQuestions: [], conclusion: [], notes: [] };

export default function Home() {
  const [template, setTemplate] = useState<File | null>(null);
  const [templateText, setTemplateText] = useState("");
  const [templateStatus, setTemplateStatus] = useState("");
  const [identity, setIdentity] = useState({ name: "", nim: "", className: "", studyProgram: "", course: "Pemrograman", date: "", lecturer: "" });
  const [experiments, setExperiments] = useState<Entry[]>([emptyEntry("Percobaan 1")]);
  const [tasks, setTasks] = useState<Entry[]>([]);
  const [questions, setQuestions] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [activeEdit, setActiveEdit] = useState("intro");

  async function readTemplate(file: File) {
    setTemplate(file); setTemplateStatus("Sedang membaca template…"); setError("");
    const fd = new FormData(); fd.append("template", file);
    try {
      const res = await fetch("/api/analyze-template", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Template gagal dibaca.");
      setTemplateText(data.text); setTemplateStatus(`Template terbaca · ${data.text.length.toLocaleString("id-ID")} karakter`);
    } catch (e) { setTemplateStatus(""); setError(e instanceof Error ? e.message : "Gagal membaca template."); }
  }

  function updateEntry(kind: "experiments" | "tasks", index: number, key: keyof Entry, value: string | File | null) {
    const setter = kind === "experiments" ? setExperiments : setTasks;
    setter(old => old.map((item, i) => i === index ? { ...item, [key]: value } : item));
  }

  function appendUploads(fd: FormData) {
    experiments.forEach((entry, i) => {
      if (entry.codeImage) fd.append(`experimentCode_${i}`, entry.codeImage);
      if (entry.outputImage) fd.append(`experimentOutput_${i}`, entry.outputImage);
    });
    tasks.forEach((entry, i) => {
      if (entry.codeImage) fd.append(`taskCode_${i}`, entry.codeImage);
      if (entry.outputImage) fd.append(`taskOutput_${i}`, entry.outputImage);
    });
  }
  function cleanEntries(items: Entry[]) {
    return items.map(({ codeImage, outputImage, ...rest }) => rest);
  }

  async function createPreview() {
    setError(""); setStatus("");
    if (!template || !templateText) return setError("Unggah template Word atau PDF terlebih dahulu.");
    if (!identity.name.trim()) return setError("Isi nama mahasiswa terlebih dahulu.");
    const all = [...experiments, ...tasks];
    if (!all.length || all.some(e => !e.codeImage || !e.outputImage)) return setError("Setiap percobaan dan tugas yang digunakan wajib memiliki screenshot kode dan hasil eksekusi.");
    setBusy(true); setStatus("Gemini sedang membaca screenshot dan menyusun draf…");
    try {
      const fd = new FormData();
      fd.append("templateText", templateText);
      fd.append("templateName", template.name);
      fd.append("identity", JSON.stringify(identity));
      fd.append("experiments", JSON.stringify(cleanEntries(experiments)));
      fd.append("tasks", JSON.stringify(cleanEntries(tasks)));
      fd.append("questions", questions);
      fd.append("format", "preview");
      appendUploads(fd);
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat draf.");
      setReport(data.report as Report);
      setStatus("Draf selesai. Periksa dan sunting isi laporan sebelum mengunduh.");
      setActiveEdit("intro");
      setTimeout(() => document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) { setError(e instanceof Error ? e.message : "Terjadi kesalahan."); setStatus(""); }
    finally { setBusy(false); }
  }

  async function exportReport(format: "docx" | "pdf") {
    if (!report) return;
    setError(""); setBusy(true); setStatus(`Menyiapkan dokumen ${format.toUpperCase()}…`);
    try {
      const fd = new FormData();
      fd.append("report", JSON.stringify(report));
      fd.append("identity", JSON.stringify(identity));
      fd.append("experiments", JSON.stringify(cleanEntries(experiments)));
      fd.append("tasks", JSON.stringify(cleanEntries(tasks)));
      fd.append("format", format);
      appendUploads(fd);
      const res = await fetch("/api/export", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ekspor gagal.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `PROLAPRAK-${identity.name.trim().replace(/\s+/g, "-")}.${format}`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setStatus(`Dokumen ${format.toUpperCase()} berhasil diunduh.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Ekspor gagal."); setStatus(""); }
    finally { setBusy(false); }
  }

  function updateReport<K extends keyof Report>(key: K, value: Report[K]) {
    setReport(old => old ? { ...old, [key]: value } : old);
  }
  function updateReportEntry(kind: "experiments" | "tasks", index: number, key: keyof ReportEntry, value: string) {
    setReport(old => old ? {
      ...old,
      [kind]: (old[kind] || []).map((item, i) => i === index ? { ...item, [key]: value } : item)
    } : old);
  }
  function updateList(key: "introduction" | "theory" | "conclusion" | "notes", index: number, value: string) {
    setReport(old => old ? { ...old, [key]: (old[key] || []).map((item, i) => i === index ? value : item) } : old);
  }

  const imageInput = (file: File | null, setFile: (file: File | null) => void, label: string) => (
    <label className="upload-tile">
      <span className="upload-mark">{file ? "✓" : "+"}</span>
      <span className="min-w-0"><strong>{label}</strong><small>{file ? file.name : "Pilih PNG atau JPG"}</small></span>
      <input type="file" accept="image/png,image/jpeg" onChange={e => setFile(e.target.files?.[0] || null)} />
    </label>
  );

  const field = (label: string, value: string, onChange: (value: string) => void, placeholder = "") => (
    <label className="block"><span className="field-label">{label}</span><input className="input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>
  );

  const editorTabs = [
    ["intro", "Pendahuluan"], ["experiments", "Percobaan"], ["tasks", "Tugas"],
    ["questions", "Pertanyaan"], ["conclusion", "Kesimpulan"]
  ];
  const pageCount = useMemo(() => report ? Math.max(1, 1 + (report.experiments?.length || 0) + (report.tasks?.length || 0)) : 0, [report]);

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#242522]">
      <header className="topbar">
        <a href="#" className="brand"><span className="brand-symbol">P</span><span>PROLAPRAK<small>Jakhfal Juna</small></span></a>
        <div className="topbar-right"><span className="status-dot" /> PRAKTIKUM PEMROGRAMAN <span className="topbar-year">2026</span></div>
      </header>

      <section className="intro-band">
        <div className="intro-inner">
          <div className="eyebrow">PRACTICAL REPORT GENERATOR</div>
          <h1>Susun laporan Pemrograman.<br /><em>Tinggal up code.</em></h1>
          <p>Unggah template dan bukti praktikum. PROLAPRAK membantu membaca kode, memahami hasil eksekusi, lalu menyusun draf yang bisa kamu periksa dan edit.</p>
          <div className="intro-meta"><span>01 / TEMPLATE</span><span>02 / SCREENSHOTS</span><span>03 / REVIEW</span><span>04 / EXPORT</span></div>
        </div>
      </section>

      <div className="workspace">
        <section className="form-column">
          <div className="section-heading"><span className="section-no">01</span><div><h2>Data laporan</h2><p>Mulai dari template dan identitas praktikum.</p></div></div>
          <div className="form-block">
            <label className="field-label">Template laporan <span className="muted">DOCX / PDF · maks. 15 MB</span></label>
            <label className="template-drop">
              <span className="template-icon">↥</span>
              <span><strong>{template ? template.name : "Pilih dokumen template"}</strong><small>{templateStatus || "Template digunakan sebagai acuan susunan laporan."}</small></span>
              <span className="choose-link">Browse</span>
              <input type="file" accept=".docx,.pdf" onChange={e => e.target.files?.[0] && readTemplate(e.target.files[0])} />
            </label>
            <div className="identity-grid">
              {field("Nama mahasiswa", identity.name, v => setIdentity(s => ({ ...s, name: v })), "Nama lengkap")}
              {field("NIM", identity.nim, v => setIdentity(s => ({ ...s, nim: v })), "Nomor induk")}
              {field("Kelas", identity.className, v => setIdentity(s => ({ ...s, className: v })), "Contoh: 1 D4 TK A")}
              {field("Program studi", identity.studyProgram, v => setIdentity(s => ({ ...s, studyProgram: v })), "Program studi")}
              {field("Mata kuliah", identity.course, v => setIdentity(s => ({ ...s, course: v })), "Nama mata kuliah")}
              {field("Dosen pengampu", identity.lecturer, v => setIdentity(s => ({ ...s, lecturer: v })), "Nama dosen")}
              {field("Tanggal praktikum", identity.date, v => setIdentity(s => ({ ...s, date: v })), "Tanggal")}
            </div>
          </div>

          <div className="section-heading section-spaced"><span className="section-no">02</span><div><h2>Bukti praktikum</h2><p>Pasangkan screenshot kode dengan hasil eksekusinya.</p></div></div>
          <div className="form-block">
            <div className="note-line"><span className="note-index">i</span><p>Unggah gambar yang tajam dan tidak terpotong. Setiap percobaan perlu dua screenshot agar AI dapat membandingkan kode dengan output.</p></div>
            {experiments.map((entry, i) => (
              <div className="experiment-card" key={`exp-${i}`}>
                <div className="entry-head"><div><span className="entry-kicker">EXPERIMENT {String(i + 1).padStart(2, "0")}</span><input className="entry-title-input" value={entry.title} onChange={e => updateEntry("experiments", i, "title", e.target.value)} /></div><button className="remove-button" onClick={() => setExperiments(v => v.filter((_, n) => n !== i))}>Hapus</button></div>
                <div className="upload-grid">
                  {imageInput(entry.codeImage, f => updateEntry("experiments", i, "codeImage", f), "Kode program")}
                  {imageInput(entry.outputImage, f => updateEntry("experiments", i, "outputImage", f), "Hasil eksekusi")}
                </div>
                <details className="optional-details"><summary>Tambahkan catatan (opsional)</summary><div className="optional-fields">
                  <label><span className="field-label">Catatan kode</span><textarea className="textarea mono" value={entry.code} onChange={e => updateEntry("experiments", i, "code", e.target.value)} /></label>
                  <label><span className="field-label">Catatan hasil</span><textarea className="textarea" value={entry.output} onChange={e => updateEntry("experiments", i, "output", e.target.value)} /></label>
                </div></details>
              </div>
            ))}
            <button className="add-button" onClick={() => setExperiments(v => [...v, emptyEntry(`Percobaan ${v.length + 1}`)])}>＋ Tambah percobaan</button>
          </div>

          <div className="form-block secondary-block">
            <div className="subsection-head"><div><span className="entry-kicker">OPTIONAL SECTION</span><h3>Tugas praktikum</h3><p>Tambahkan screenshot tugas jika ada di template.</p></div></div>
            {tasks.map((entry, i) => (
              <div className="experiment-card" key={`task-${i}`}>
                <div className="entry-head"><div><span className="entry-kicker">TASK {String(i + 1).padStart(2, "0")}</span><input className="entry-title-input" value={entry.title} onChange={e => updateEntry("tasks", i, "title", e.target.value)} /></div><button className="remove-button" onClick={() => setTasks(v => v.filter((_, n) => n !== i))}>Hapus</button></div>
                <div className="upload-grid">
                  {imageInput(entry.codeImage, f => updateEntry("tasks", i, "codeImage", f), "Kode program")}
                  {imageInput(entry.outputImage, f => updateEntry("tasks", i, "outputImage", f), "Hasil eksekusi")}
                </div>
              </div>
            ))}
            <button className="add-button" onClick={() => setTasks(v => [...v, emptyEntry(`Tugas ${v.length + 1}`)])}>＋ Tambah tugas</button>
            <label className="block mt-5"><span className="field-label">Pertanyaan analisis dari modul</span><textarea className="textarea" value={questions} onChange={e => setQuestions(e.target.value)} placeholder="Satu pertanyaan per baris…" /></label>
          </div>

          <div className="generate-panel">
            <div><span className="entry-kicker">03 / GENERATE DRAFT</span><h3>Siap untuk ditinjau?</h3><p>AI akan membaca screenshot, membuat transkripsi, dan menyusun analisis. Periksa lagi sebelum ekspor.</p></div>
            <button className="generate-button" disabled={busy} onClick={createPreview}>{busy ? "Sedang memproses…" : "Buat draf laporan  ↗"}</button>
          </div>
          {error && <div className="alert error">{error}</div>}
          {status && <div className="alert success">{status}</div>}
        </section>

        <aside className="side-column">
          <div className="side-sticky">
            <div className="side-label">DOCUMENT SETTINGS <span>FIXED</span></div>
            <div className="spec-list">
              <div><span>Paper size</span><strong>A4 · 210 × 297 mm</strong></div>
              <div><span>Typeface</span><strong>Times New Roman</strong></div>
              <div><span>Body size</span><strong>12 pt</strong></div>
              <div><span>Line spacing</span><strong>1.5</strong></div>
              <div><span>Margins</span><strong>3 cm all sides</strong></div>
            </div>
            <div className="side-rule" />
            <div className="side-label">PROCESS</div>
            <ol className="process-list">
              <li className="done"><span>01</span><div><strong>Template</strong><small>Ambil struktur laporan</small></div></li>
              <li><span>02</span><div><strong>Evidence</strong><small>Screenshot kode & output</small></div></li>
              <li><span>03</span><div><strong>Review</strong><small>Edit draf hasil AI</small></div></li>
              <li><span>04</span><div><strong>Export</strong><small>Word atau PDF</small></div></li>
            </ol>
            <div className="privacy-note">Catatan: screenshot dan hasil analisis dapat memuat informasi pribadi. Gunakan data praktikum yang aman untuk diunggah.</div>
          </div>
        </aside>
      </div>

      {report && <section id="editor" className="review-section">
        <div className="review-top">
          <div><div className="eyebrow">04 — REVIEW & EDIT</div><h2>Ruang penyuntingan<span>.</span></h2><p>Ubah isi di panel kiri. Pratinjau dokumen di kanan mengikuti perubahan.</p></div>
          <div className="export-actions"><button disabled={busy} className="export-word" onClick={() => exportReport("docx")}>Unduh Word ↓</button><button disabled={busy} className="export-pdf" onClick={() => exportReport("pdf")}>Unduh PDF ↓</button></div>
        </div>
        <div className="editor-layout">
          <div className="edit-panel">
            <div className="edit-panel-head"><span>EDIT CONTENT</span><span>CHANGES AUTO-SAVED IN PREVIEW</span></div>
            <label className="field-label">Judul laporan</label>
            <input className="input mb-4" value={report.title || ""} onChange={e => updateReport("title", e.target.value)} />
            <nav className="edit-tabs">{editorTabs.map(([key, label]) => <button key={key} className={activeEdit === key ? "active" : ""} onClick={() => setActiveEdit(key)}>{label}</button>)}</nav>
            {activeEdit === "intro" && <div className="edit-content">
              <h3>Pendahuluan</h3>
              {(report.introduction || []).map((v, i) => <label key={i}><span className="field-label">Paragraf {i + 1}</span><textarea className="textarea" value={v} onChange={e => updateList("introduction", i, e.target.value)} /></label>)}
              {!report.introduction?.length && <p className="empty-note">AI belum menghasilkan paragraf pendahuluan. Kamu dapat menambahkannya secara manual.</p>}
              <button className="add-button" onClick={() => updateReport("introduction", [...(report.introduction || []), ""])}>＋ Tambah paragraf</button>
              <h3 className="mt-6">Dasar teori</h3>
              {(report.theory || []).map((v, i) => <label key={i}><span className="field-label">Poin {i + 1}</span><textarea className="textarea" value={v} onChange={e => updateList("theory", i, e.target.value)} /></label>)}
              <button className="add-button" onClick={() => updateReport("theory", [...(report.theory || []), ""])}>＋ Tambah poin teori</button>
            </div>}
            {activeEdit === "experiments" && <div className="edit-content"><h3>Analisis percobaan</h3>
              {(report.experiments || []).map((e, i) => <div className="edit-entry" key={i}><strong>{e.title || `Percobaan ${i + 1}`}</strong>
                {(["code", "compile", "output", "analysis"] as const).map(k => <label key={k}><span className="field-label">{({ code: "Transkripsi kode", compile: "Kompilasi", output: "Hasil eksekusi", analysis: "Analisis" })[k]}</span><textarea className={`textarea ${k === "code" ? "mono" : ""}`} value={e[k] || ""} onChange={ev => updateReportEntry("experiments", i, k, ev.target.value)} /></label>)}
              </div>)}
            </div>}
            {activeEdit === "tasks" && <div className="edit-content"><h3>Analisis tugas</h3>
              {(report.tasks || []).map((e, i) => <div className="edit-entry" key={i}><strong>{e.title || `Tugas ${i + 1}`}</strong>
                {(["code", "compile", "output", "analysis"] as const).map(k => <label key={k}><span className="field-label">{k}</span><textarea className="textarea" value={e[k] || ""} onChange={ev => updateReportEntry("tasks", i, k, ev.target.value)} /></label>)}
              </div>)}
              {!report.tasks?.length && <p className="empty-note">Tidak ada tugas tambahan.</p>}
            </div>}
            {activeEdit === "questions" && <div className="edit-content"><h3>Pertanyaan analisis</h3>
              {(report.analysisQuestions || []).map((q, i) => <div className="edit-entry" key={i}><label><span className="field-label">Pertanyaan {i + 1}</span><textarea className="textarea" value={q.question} onChange={e => updateReport("analysisQuestions", report.analysisQuestions!.map((x, n) => n === i ? { ...x, question: e.target.value } : x))} /></label><label><span className="field-label">Jawaban</span><textarea className="textarea" value={q.answer} onChange={e => updateReport("analysisQuestions", report.analysisQuestions!.map((x, n) => n === i ? { ...x, answer: e.target.value } : x))} /></label></div>)}
              {!report.analysisQuestions?.length && <p className="empty-note">Belum ada pertanyaan dari template.</p>}
            </div>}
            {activeEdit === "conclusion" && <div className="edit-content"><h3>Kesimpulan</h3>
              {(report.conclusion || []).map((v, i) => <label key={i}><span className="field-label">Poin {i + 1}</span><textarea className="textarea" value={v} onChange={e => updateList("conclusion", i, e.target.value)} /></label>)}
              <button className="add-button" onClick={() => updateReport("conclusion", [...(report.conclusion || []), ""])}>＋ Tambah kesimpulan</button>
              <h3 className="mt-6">Catatan verifikasi</h3>
              {(report.notes || []).map((v, i) => <label key={i}><span className="field-label">Catatan {i + 1}</span><textarea className="textarea" value={v} onChange={e => updateList("notes", i, e.target.value)} /></label>)}
            </div>}
          </div>

          <div className="preview-column">
            <div className="preview-toolbar"><span>LIVE DOCUMENT PREVIEW</span><span>A4 · {pageCount} SECTION GROUPS</span></div>
            <article className="paper-preview">
              <div className="paper-kicker">LAPORAN PRAKTIKUM</div>
              <h1>{report.title || "Judul laporan"}</h1>
              <div className="paper-identity">
                {["name", "nim", "className", "studyProgram", "course", "lecturer", "date"].map(k => <div key={k}><span>{({ name: "Nama", nim: "NIM", className: "Kelas", studyProgram: "Program Studi", course: "Mata Kuliah", lecturer: "Dosen", date: "Tanggal" } as Record<string, string>)[k]}</span><b>{identity[k as keyof typeof identity] || "—"}</b></div>)}
              </div>
              <div className="paper-separator" />
              <h2>BAB I · PENDAHULUAN</h2>
              {(report.introduction || []).map((p, i) => <p key={i}>{p}</p>)}
              {!!report.theory?.length && <><h3>Dasar Teori</h3>{report.theory.map((p, i) => <p key={i}>{p}</p>)}</>}
              <h2>BAB II · HASIL PERCOBAAN</h2>
              {(report.experiments || []).map((e, i) => <div key={i} className="paper-entry"><h3>{e.title || `Percobaan ${i + 1}`}</h3><h4>Kode Program</h4><pre>{e.code || "[Transkripsi kode belum tersedia]"}</pre><h4>Hasil Eksekusi</h4><p>{e.output || "[Hasil belum tersedia]"}</p><h4>Analisis</h4><p>{e.analysis || "[Analisis belum tersedia]"}</p></div>)}
              {!!report.tasks?.length && <><h2>BAB III · TUGAS</h2>{report.tasks.map((e, i) => <div key={i} className="paper-entry"><h3>{e.title || `Tugas ${i + 1}`}</h3><pre>{e.code}</pre><p>{e.output}</p><p>{e.analysis}</p></div>)}</>}
              {!!report.analysisQuestions?.length && <><h2>PERTANYAAN ANALISIS</h2>{report.analysisQuestions.map((q, i) => <div key={i}><p><b>{i + 1}. {q.question}</b></p><p>{q.answer}</p></div>)}</>}
              <h2>KESIMPULAN</h2>
              {(report.conclusion || []).map((p, i) => <p key={i}>{i + 1}. {p}</p>)}
              <div className="paper-footer">PROLAPRAK · DRAF UNTUK DITINJAU</div>
            </article>
            <p className="preview-caption">Pratinjau ringkas untuk pemeriksaan isi. Tata letak akhir mengikuti pembagian halaman otomatis pada file Word/PDF.</p>
          </div>
        </div>
      </section>}

      <footer className="footer"><span>PROLAPRAK / PRACTICAL REPORT WORKSPACE</span><span>BUILT FOR BETTER LAB REPORTS · 2026</span></footer>
    </main>
  );
}
