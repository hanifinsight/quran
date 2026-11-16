# Murojaah Quest — Starter

Frontend awal HTML, CSS, JavaScript dengan PWA dan koneksi Supabase.

## 1. Konfigurasi Supabase
Buka `config.js`, isi:
- `SUPABASE_URL`: Project URL dari Supabase → Project Settings → API.
- `SUPABASE_ANON_KEY`: anon/public key dari Supabase → Project Settings → API Keys.

Jangan pernah memasukkan `service_role` key ke frontend.

## 2. Struktur database yang dipakai
Aplikasi awal membaca:
- `public.surahs`: `id`, `name_ar`, `name_latin`, `ayah_count`, `revelation_type`
- `public.ayahs`: `surah_id`, `ayah_number`, `juz_number`, `text_uthmani`, dengan kebijakan SELECT untuk `verified = true`.

## 3. Jalankan lokal
Jalankan dengan local web server (misalnya VS Code Live Server). PWA/service worker memerlukan localhost atau HTTPS.

## 4. GitHub Pages
Upload seluruh isi folder ini ke repository GitHub. Aktifkan Settings → Pages → Deploy from a branch → pilih `main` dan folder `/root`.

## Catatan
Ini adalah kerangka UI tahap pertama. Modul login, profil, pencatatan hafalan, jadwal murojaah, XP, permainan, dan halaqah belum diaktifkan.
