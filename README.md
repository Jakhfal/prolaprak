# PROLAPRAK

Aplikasi Next.js + Tailwind CSS + Node.js untuk membuat draf laporan praktikum dari template DOCX/PDF dan screenshot kode/hasil eksekusi menggunakan Gemini API.

## Instalasi
```bash
npm install
```

Buat `.env.local`:
```env
GEMINI_API_KEY=isi_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Jalankan:
```bash
npm run dev
```
Buka http://localhost:3000

## Input praktikum
Untuk setiap percobaan/tugas, unggah:
- Screenshot kode program (PNG/JPG)
- Screenshot hasil eksekusi terminal (PNG/JPG)

AI membaca gambar menggunakan kemampuan multimodal Gemini, mentranskripsikan kode, membaca output, lalu menyusun analisis. Periksa transkripsi terutama karakter yang mirip seperti 0/O, 1/l, tanda kurung, dan titik koma.

## Format output
- Kertas A4 (210 × 297 mm)
- Times New Roman 12 pt untuk teks utama
- Spasi 1,5
- Margin 3 cm pada semua sisi
- Screenshot kode dan hasil disisipkan ke bagian terkait

## Catatan
- PDF/DOCX dibuat ulang berdasarkan struktur teks template; layout visual template asli tidak disalin identik.
- PDF hasil scan yang tidak memiliki text layer memerlukan OCR dan belum didukung oleh analyzer template.
- Maksimal screenshot 8 MB per gambar, PNG/JPG.
- Free tier Gemini memiliki batas penggunaan dan kebijakan data sendiri. Jangan mengunggah data sensitif.

## Review editor
Setelah AI membuat draf, halaman menampilkan panel edit dan live preview bergaya kertas A4. Perubahan isi pada editor digunakan saat ekspor Word/PDF. Preview merupakan pemeriksaan isi, bukan simulasi pagination 1:1 dari file hasil ekspor.
