# Hafizh Qur'an — Prototype 0.1

Prototype pembaca Al-Qur'an berbasis HTML, CSS, JavaScript, dan Bootstrap 5.

## Fitur versi 0.1
- Daftar 114 surat dari AlQuran Cloud API.
- Navigasi 30 juz.
- Navigasi halaman 1–604 berdasarkan metadata halaman API.
- Teks Arab Utsmani.
- Terjemahan Bahasa Indonesia (jika edisi tersedia).
- Bookmark halaman tersimpan di `localStorage` browser.
- Pengaturan ukuran teks Arab.
- Tampilan responsif untuk laptop dan HP.

## Catatan penting tentang mushaf
Versi ini menampilkan **teks digital per halaman berdasarkan pemetaan halaman API**, bukan gambar/faksimile halaman mushaf cetak. Jangan menganggap tampilan ini sudah identik dengan layout 15 baris atau edisi mushaf Indonesia tertentu. Sebelum digunakan sebagai standar hafalan, tentukan edisi mushaf yang menjadi rujukan dan lakukan verifikasi teks serta pemetaan halaman.

## Menjalankan secara lokal
Cara paling sederhana:
1. Ekstrak folder.
2. Buka folder di VS Code.
3. Jalankan dengan ekstensi Live Server, atau gunakan server lokal.
4. Buka `index.html` melalui alamat localhost.

Karena data diambil dari API publik, perangkat membutuhkan koneksi internet.

## Deploy ke GitHub Pages
1. Buat repository GitHub bernama `hafizh-quran`.
2. Upload seluruh isi folder ini ke root repository (file `index.html` harus berada di root).
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`.
6. Klik **Save** dan tunggu proses deployment.
7. Buka URL GitHub Pages yang diberikan GitHub.

## API
- Daftar surat: `https://api.alquran.cloud/v1/surah`
- Halaman Arab: `https://api.alquran.cloud/v1/page/{page}/quran-uthmani`
- Halaman terjemahan: `https://api.alquran.cloud/v1/page/{page}/id.indonesian`
- Surat: `https://api.alquran.cloud/v1/surah/{number}/quran-uthmani`
- Juz: `https://api.alquran.cloud/v1/juz/{number}/quran-uthmani`

Dokumentasi: https://alquran.cloud/api

## Batasan versi 0.1
- Belum ada login dan sinkronisasi lintas perangkat.
- Bookmark tersimpan di browser/perangkat yang digunakan.
- Belum ada gambar mushaf asli.
- Belum ada audio murottal, latihan hafalan, setoran, atau integrasi Google Drive.
- Belum terhubung ke Supabase. Integrasi akun dan sinkronisasi direncanakan pada versi berikutnya.

## Struktur
```text
hafizh-quran/
├── index.html
├── README.md
└── assets/
    ├── css/style.css
    └── js/app.js
```
