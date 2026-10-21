# AURELIA STAY — Budget Hotel Management & Booking System

> **Projek IT Semester 6 — Universiti Tun Hussein Onn Malaysia (UTHM)**  
> Sistem Pengurusan & Tempahan Hotel Bajet berasaskan Seni Bina Tanpa Server (Serverless Architecture) menggunakan **Cloud Firestore**, **Firebase Realtime Database**, **Firebase Auth**, dan **Static Front-End Client**.

---

## 📋 Gambaran Keseluruhan (Project Overview)

**AURELIA STAY** merupakan sistem pengurusan hotel bajet moden dengan kapasiti **20 bilik** merangkumi **4 jenis bilik** (kadar harga RM80 – RM95/malam):
* **Standard Single** (Bilik 101–106): 1 Tetamu · RM80 / malam
* **Standard Double** (Bilik 201–208): 2 Tetamu · RM85 / malam
* **Deluxe Double** (Bilik 301–304): 2 Tetamu · RM90 / malam
* **Family Room** (Bilik 401–402): 4 Tetamu · RM95 / malam

Sistem ini mempunyai pemisahan peranan (Role Separation) yang ketat melalui **3 Portal Berbeza**:

```
                                 AURELIA STAY
                                      │
                            ┌─────────┴─────────┐
                            │   Authentication  │
                            └─────────┬─────────┘
                                      │
                     ┌────────────────┼────────────────┐
                     │                │                │
                     ▼                ▼                ▼
                CUSTOMER        HOTEL MANAGER        ADMIN
                     │                │                │
                     ▼                ▼                ▼
               Guest Website   Hotel Operations   System Control
```

---

## 👥 3 Peranan & Akses Portal (Role Separation)

| Ciri-ciri / Keupayaan | Customer (Tetamu) | Hotel Manager | Administrator |
|---|:---:|:---:|:---:|
| **Kaedah Log Masuk** | Google Sign-In | Google Sign-In (Dijemput Admin) | Google Sign-In (Emel Pentadbir Sah) |
| **Carian & Semakan Bilik** | ✅ Awam & Bebas | ✅ | ✅ |
| **Tempahan Atas Talian (Online)** | ✅ (Auto-assign bilik) | ❌ | ❌ |
| **Tempahan Walk-In** | ❌ | ✅ | ❌ |
| **Batal Tempahan Sendiri** | ✅ (Sebelum check-in) | ❌ | ❌ |
| **Check-in & Check-out Tetamu** | ❌ | ✅ | ❌ |
| **Pengurusan Housekeeping** | ❌ | ✅ (Dirty → Cleaning → Clean) | ❌ |
| **Laporan & Status Penyelenggaraan** | ❌ | ✅ (Open → In-Progress → Resolved) | ❌ |
| **Pelarasan Harga Bilik (Pricing)** | ❌ | ❌ | ✅ (Direkod dalam Audit Trail) |
| **Konfigurasi Sistem & Yuran** | ❌ | ❌ | ✅ |
| **Pengurusan Pengguna & Jemputan Staf** | ❌ | ❌ | ✅ (Invite & Revoke Manager) |
| **Log Audit Keseluruhan (Append-only)** | ❌ | ❌ | ✅ (Kalis Ubah / Immutable) |
| **Sample Data (Demo Loader/Cleaner)** | ❌ | ❌ | ✅ (Idempotent) |

---

## 🛠️ Seni Bina Teknikal (Technical Architecture)

1. **Front-End**:
   - Berasaskan fail `.dc.html` dan Javascript Modular ES (Vanilla Web Standards tanpa sebarang build tools yang rumit).
   - In-memory reactive mirror: pembacaan data berlaku secara sinkronus daripada cache memori yang dikemaskini secara langsung (real-time listeners).
   - Penukaran dwibahasa (**Bahasa Melayu & English**) terbina dalam (`aurelia-i18n.js`).

2. **Cloud Firestore**:
   - **Double-Booking Protection**: Setiap tempahan mengunci tarikh malam bilik dalam koleksi `roomNights/{roomId}_{date}` dalam satu transaksi ACID (Atomic).
   - **Koleksi Utama**: `bookings`, `users`, `roomTypes`, `rooms`, `housekeeping`, `maintenance`, `auditLogs`, `messages`, `staffInvites`, `counters`.
   - **Kawalan Keselamatan**: Enforced melalui `firestore.rules` (22KB security rules meliputi pengesahan skim dan transaksi selamat).

3. **Firebase Realtime Database (RTDB)**:
   - **Live Presence**: Mengesan staf yang sedang dalam talian (`/presence/{uid}`) dengan pengesanan putus sambungan automatik (`onDisconnect`).
   - **Real-time Notifications**: Pemberitahuan segera kepada tetamu (`/notifications/{uid}`) dan staf (`/notifications/managers`, `/notifications/admins`).
   - **Staff Authorization Cache**: Mirror identiti staf (`/staffEmails/{emailKey}`) untuk kebenaran masa nyata.

---

## 🚀 Panduan Menjalankan Sistem (Getting Started)

### Keperluan Sistem (Prerequisites):
- **Node.js**: v20 atau v22+
- **Java JDK**: JDK 21+ (OpenJDK 25 sedia ada pada sistem di `/home/bos-afiq/.jdks/openjdk-25.0.2`)
- **Firebase CLI**: 15.28+

### 1. Menjalankan Emulator & Pelayan Tempatan (Start Server)
Untuk memulakan keseluruhan perkhidmatan Firebase (Auth, Firestore, Realtime Database, dan Web Hosting):

```bash
npm start
# atau
npm run emulators
```

Setelah pelayan dimulakan:
* **Demo Portal Utama**: [http://localhost:5000/](http://localhost:5000/) *(autoredirect ke Demo Portal)*
* **Laman Web Pelawat & Tetamu**: [http://localhost:5000/website/Home.dc.html](http://localhost:5000/website/Home.dc.html)
* **Portal Hotel Manager**: [http://localhost:5000/manager/Login.dc.html](http://localhost:5000/manager/Login.dc.html)
* **Portal Pentadbir (Admin)**: [http://localhost:5000/admin/Login.dc.html](http://localhost:5000/admin/Login.dc.html)  
  *(Emel Admin Utama: `admin@aureliastay.local`)*
* **Papan Pemuka Firebase Emulator UI**: [http://localhost:4001/](http://localhost:4001/)
* **Suite Ujian Browser**: [http://localhost:5000/tests/store-tests.html?emulator=1](http://localhost:5000/tests/store-tests.html?emulator=1)

---

## 🧪 Pengujian Sistem Automatik (Automated Test Suites)

Sistem ini dilengkapi dengan **340 ujian automatik** (100% Lulus) merangkumi kedua-dua lapisan keselamatan pangkalan data dan API klien:

### A. Ujian Keselamatan Peraturan Firestore & RTDB (299 Ujian)
Menguji kawalan akses RBAC, pencegahan eksploitasi data, integriti transaksi penguncian bilik, dan pengesahan medan:
```bash
npm test
# atau
npm run test:rules
```

### B. Ujian Pelayar Klien (Store Browser Tests - 41 Ujian)
Menguji API awam `AureliaStore`, kitaran penuh tempahan tetamu, operasi harian pengurus, pengurusan pentadbir, dan pencegahan double-booking dalam persekitaran pelayar Chromium sebenar:
```bash
npm run test:store
```

### C. Menjalankan Keseluruhan Ujian Sekaligus (340 Ujian)
```bash
npm run test:all
```

---

## 📁 Struktur Direktori Projek

```
Aurelia/
├── .gitignore
├── database.rules.json         # Peraturan keselamatan Realtime Database
├── firestore.rules             # Peraturan keselamatan Cloud Firestore
├── firebase.json               # Konfigurasi perkhidmatan dan port emulator
├── package.json                # Pengurusan skrip dan dependensi projek
├── docs/
│   ├── FIREBASE_ARCHITECTURE.md # Dokumen spesifikasi seni bina rasmi
│   └── legacy-aurelia-store.js.txt
├── rules-tests/                # Suite ujian unit peraturan pangkalan data (299 ujian)
│   ├── bookings.test.js
│   ├── counters.test.js
│   ├── public-catalog.test.js
│   ├── roomnights.test.js
│   ├── rtdb-notifications.test.js
│   ├── rtdb-presence-staff.test.js
│   ├── staff-ops.test.js
│   └── users.test.js
├── scripts/
│   ├── start-emulators.js      # Pelari emulator pintar dengan pengesanan Java automatik
│   ├── run-rules-tests.js      # Pelari pintar ujian peraturan (auto-detect port)
│   └── run-store-tests.js      # Pelari ujian pelayar menggunakan headless Chromium
└── design/                     # Direktori awam front-end
    ├── index.html              # Titik masuk utama (Universal redirect)
    ├── Demo Portal.dc.html     # Portal pemilihan peranan AURELIA STAY
    ├── support.js              # Enjin rendering halaman komponen
    ├── website/                # Portal Tetamu & Laman Web Awam (21 halaman)
    ├── manager/                # Portal Operasi Pengurus Hotel (19 halaman)
    ├── admin/                  # Portal Kawalan Pentadbir Sistem (16 halaman)
    ├── shared/                 # Modul teras stor, UI, gerakan, & terjemahan
    │   ├── aurelia-store.js    # Titik masuk bootstrap stor
    │   ├── aurelia-ui.js       # Pembantu UI & pengesahan sesi
    │   ├── aurelia-motion.js   # Animasi antara muka
    │   ├── aurelia-i18n.js     # Sistem bahasa BM/EN
    │   └── core/               # Modul teras perkhidmatan Firebase
    └── tests/                  # Halaman & suite ujian pelayar (41 ujian)
        ├── store-tests.html
        ├── runner.js
        └── suites/
```

---

## 🌟 Ciri-Ciri Khas Projek

1. **Jaminan Sifar Pertindihan Bilik (Zero Double-Booking Guarantee)**:
   Menggunakan penguncian peringkat tarikh unik atomik (`roomNights`) dalam transaksi Firestore.
2. **Kalis Ubah Suai Sejarah (Audit Trail Immutability)**:
   Semua tindakan pentadbiran dan operasi hotel direkodkan secara kekal tanpa kebenaran padam atau kemaskini.
3. **Penyelarasan Masa Nyata (Real-time Mirroring)**:
   Sebarang pertukaran status bilik, housekeeping, atau tempahan baharu dipaparkan serta-merta tanpa perlu muat semula halaman (*no page reload*).
4. **Data Sampel Idempoten (Sample Data Management)**:
   Pentadbir boleh menjana sejarah tempahan simulasi dan memadamkannya semula dengan satu klik untuk demonstrasi langsung.

---
*Dibangunkan untuk Projek IT Semester 6 UTHM.*
