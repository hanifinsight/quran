# QuranKu — Prototype Tahap 1

Prototype frontend statis untuk GitHub Pages.

## Isi
- `index.html` — struktur halaman
- `style.css` — tampilan responsif
- `app.js` — daftar surah contoh, navigasi, bookmark, ukuran font, dan bacaan terakhir

## Menjalankan lokal
Buka `index.html` di browser. Untuk pengujian yang lebih konsisten, jalankan server statis lokal.

## Deploy ke GitHub Pages
1. Buat repository GitHub, misalnya `quranku`.
2. Unggah ketiga file (`index.html`, `style.css`, `app.js`) ke root repository.
3. Buka Settings → Pages.
4. Pilih Deploy from a branch, branch `main`, folder `/ (root)`, lalu Save.

## Batasan penting
Ini baru prototype antarmuka. Data yang disertakan hanya Al-Fatihah dan lima ayat awal Al-Baqarah untuk demonstrasi. Belum tersedia 114 surah lengkap, audio, terjemahan, autentikasi, Supabase, maupun offline PWA. Jangan jadikan contoh data ini sebagai sumber mushaf untuk penggunaan ibadah. Sebelum rilis, integrasikan dataset Al-Qur'an yang tepercaya, cek lisensi, dan verifikasi teks Arab/rasm/tanda waqaf terhadap mushaf standar.
