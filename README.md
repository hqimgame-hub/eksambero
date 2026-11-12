# ExamBro Android - Kiosk Client Ujian Anti-Curang

Aplikasi peramban ujian berbasis **Flutter** dan **Android Native (Kotlin)** yang dirancang dengan standar keamanan tinggi untuk pelaksanaan asesmen sekolah (Google Forms, CBT, Quizizz, Moodle, LMS, dll.) tanpa kecurangan.

Aplikasi ini dilengkapi alur otomatisasi **CI/CD GitHub Actions** sehingga Anda dapat mengunduh file `.apk` siap pakai langsung dari GitHub tanpa perlu menginstal SDK atau Android Studio di komputer lokal.

---

## 🛡️ Fitur Keamanan & Arsitektur Sistem

| Fitur | Implementasi Teknis | Dampak Keamanan |
| :--- | :--- | :--- |
| **Anti-Screenshot & Recording** | `WindowManager.LayoutParams.FLAG_SECURE` | Layar menjadi hitam saat ditangkap/direkam; pratinjau disembunyikan di menu *Recent Apps*. |
| **Kiosk Mode (App Pinning)** | `startLockTask()` / `stopLockTask()` Native Android | Mengunci bilah navigasi dan status bar sistem agar siswa tidak bisa berpindah aplikasi. |
| **Pencegahan Layar Mati** | `wakelock_plus` | Layar tetap menyala aktif selama ujian tanpa terganggu waktu sleep perangkat. |
| **Proteksi Tombol Kembali** | `PopScope(canPop: false)` | Tombol navigasi 'Back' dicegat dan memicu dialog otentikasi PIN Pengawas. |
| **Otentikasi Guru/Pengawas** | Supervisor PIN Gate | Siswa hanya dapat keluar dari mode ujian jika pengawas memasukkan PIN yang valid (Default: `123`). |

---

## 🎨 Keunggulan UI/UX (User Experience)

1. **Desain Material 3 Bersih & Terarah**:
   - Meminimalkan distraksi visual agar siswa fokus pada materi ujian.
   - Penataan kartu input URL dengan tombol hapus cepat (`Clear`) dan auto-formatting protokol `https://`.
2. **Scanner QR Terintegrasi**:
   - Dilengkapi *viewfinder frame* untuk kemudahan pembidikan kamera.
   - Tombol toggle lampu senter (*flash*) dan tombol beralih kamera (*flip camera*) untuk kondisi ruangan kelas dengan pencahayaan minim.
   - Proteksi debouncing deteksi barcode untuk mencegah glitch/multiple trigger.
3. **Layar Ujian Responsif**:
   - Indikator progres pemuatan halaman (*Linear Progress Indicator*) di atas WebView memberikan kepastian visual saat halaman form/LMS dimuat.
   - Tombol *Reload* cepat di AppBar jika terjadi kendala jaringan sementara.
   - Modal dialog PIN Pengawas dengan tombol intip/sembunyikan PIN (*obscure toggle*).

---

## 📂 Struktur Proyek

```text
├── .github/
│   └── workflows/
│       └── build-apk.yml           # CI/CD otomatis untuk merakit APK di GitHub Actions
├── android/
│   ├── app/
│   │   ├── build.gradle            # Konfigurasi build Gradle aplikasi Android
│   │   └── src/
│   │       └── main/
│   │           ├── AndroidManifest.xml # Izin akses (Internet, Kamera, Wakelock)
│   │           ├── kotlin/com/exambro/app/MainActivity.kt # Handler FLAG_SECURE & Kiosk Mode
│   │           └── res/            # Tema & icon launcher adaptive
│   ├── build.gradle
│   ├── gradle.properties
│   └── settings.gradle
├── lib/
│   └── main.dart                   # Antarmuka Flutter (Home, Scanner, WebView Kiosk)
├── pubspec.yaml                    # Manajemen paket dependensi Flutter
└── README.md
```

---

## 🚀 Cara Mengunduh File APK dari GitHub

1. Buka repositori ini di GitHub: [https://github.com/hqimgame-hub/eksambero](https://github.com/hqimgame-hub/eksambero)
2. Klik tab **Actions** pada menu di bagian atas.
3. Klik workflow **Build Android APK** (alur build berjalan otomatis saat setiap push/commit).
4. Tunggu beberapa menit hingga proses bertanda centang hijau (**Success**).
5. Klik pada riwayat build tersebut, lalu gulir ke bawah ke bagian **Artifacts**.
6. Klik **exambro-release-apk** untuk mengunduh arsip zip yang berisi file `app-release.apk`.
7. Ekstrak dan pasang (install) di perangkat Android siswa.

---

## 🔑 Informasi Pengawas

- **Default PIN Pengawas**: `123`
- Untuk mengubah PIN pengawas, sesuaikan variabel `_adminPassword` pada file `lib/main.dart`:
  ```dart
  final String _adminPassword = "PIN_BARU_ANDA";
  ```

---

## 🛠️ Menjalankan Secara Lokal (Opsional)

Jika Anda ingin menjalankan atau mengembangkan aplikasi di komputer lokal:

```bash
# 1. Unduh dependensi
flutter pub get

# 2. Jalankan aplikasi pada perangkat yang terhubung
flutter run

# 3. Merakit APK release secara manual
flutter build apk --release
```
