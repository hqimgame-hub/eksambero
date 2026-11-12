# ExamBro Android & Web Dashboard Pengawas Ujian

Ekosistem lengkap aplikasi ujian sekolah berbasis **Flutter Android Client** dan **Web Dashboard Pengawas (Tailwind CSS & Firebase)** untuk menyelenggarakan asesmen sekolah (Google Forms, Quizizz, Moodle, CBT) dengan aman, terkunci, dan terpantau secara langsung (*real-time*).

---

## 🌟 Dua Komponen Utama Ekosistem ExamBro

```text
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     1. WEB DASHBOARD GURU       │           │     2. APLIKASI CLIENT HP       │
│           (Folder: admin/)      │           │    (Folder: lib/ & android/)    │
├─────────────────────────────────┤           ├─────────────────────────────────┤
│ • Input Link Soal Ujian         │  Realtime │ • Kiosk Mode (LockTaskMode)     │
│ • Mode Proyektor QR Raksasa     │ ◄───────► │ • Anti-Screenshot (FLAG_SECURE) │
│ • Live Monitoring Status Siswa  │  Firebase │ • Deteksi Pelanggaran/Keluar    │
│ • Remote Unlock Buka Kunci Siswa│           │ • Pencegah Layar Tidur/Wakelock │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## 🖥️ 1. Web Dashboard Guru (`admin/`)

Dashboard web yang sangat ringan dan responsif, dapat diakses langsung oleh guru melalui browser laptop:

### Fitur Dashboard Guru:
1. **Manajemen Sesi Ujian**:
   - Menentukan mata pelajaran, durasi waktu ujian, dan PIN keluar pengawas (Default: `123`).
   - Memasukkan link Google Forms / LMS sekolah yang langsung terintegrasi ke QR Code.
2. **Mode Proyektor Kelas (Projector Presentation)**:
   - Tampilan layar penuh (*Full Screen*) untuk ditembakkan ke proyektor kelas.
   - Menampilkan QR Code ujian ukuran besar dengan instruksi langkah demi langkah bagi siswa.
   - Menampilkan jumlah siswa yang telah bergabung secara *live*.
3. **Live Student Monitoring**:
   - Memantau siswa secara *real-time*: Nama, Kelas, Status Layar, Persentase Baterai HP, dan Riwayat Pelanggaran.
   - Indikator peringatan merah otomatis menyala jika siswa mencoba meminimalkan aplikasi atau menekan tombol keluar.
   - **Remote Unlock**: Tombol untuk membuka kunci layar siswa secara individu atau sekaligus seluruh siswa setelah waktu ujian usai.
   - **Export CSV**: Mengunduh rekap daftar kehadiran dan log ujian ke Excel / CSV.
4. **Distribusi APK Siswa**:
   - Menyediakan link dan QR Code langsung bagi siswa untuk mengunduh aplikasi `ExamBro.apk`.

### Cara Menjalankan Web Dashboard Guru:
- **Cara Cepat (Lokal):** Buka file `admin/index.html` langsung menggunakan browser Chrome / Edge di laptop Anda.
- **Deploy Gratis ke Vercel:** Hubungkan repo ini ke [Vercel](https://vercel.com) dan atur *Root Directory* ke `admin`.
- **Deploy ke GitHub Pages:** Aktifkan GitHub Pages di menu *Settings* -> *Pages* -> pilih *GitHub Actions*.

---

## 📱 2. Aplikasi Client Siswa (`lib/` & `android/`)

Aplikasi mobile Android yang dipasang pada HP masing-masing siswa:
- **Keamanan OS-Level:** Menggunakan `WindowManager.LayoutParams.FLAG_SECURE` dan Android Native `LockTaskMode` untuk mengunci bilah navigasi dan mematikan fungsi screenshot/perekaman layar.
- **Kamera Scanner Terintegrasi:** Siswa cukup memindai QR Code di layar proyektor kelas untuk langsung memulai ujian.
- **Otomatisasi Kompilasi (CI/CD):** Setiap push ke cabang `main` akan memicu GitHub Actions untuk merakit file `.apk` siap pakai.

---

## 🚀 Cara Mengunduh File APK Siswa dari GitHub

1. Buka repositori: [https://github.com/hqimgame-hub/eksambero](https://github.com/hqimgame-hub/eksambero)
2. Klik tab **Actions** di bagian atas repositori.
3. Klik workflow **Build APK and Deploy Admin Web**.
4. Setelah tanda centang hijau muncul, buka detail riwayat build dan temukan tabel **Artifacts**.
5. Klik **`exambro-release-apk`** untuk mengunduh file APK.
