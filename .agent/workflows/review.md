---
description: Checklist review sebelum commit apapun. Jalankan ini setelah selesai build fitur untuk memastikan tidak ada yang melanggar constraints.
---

Review Sebelum Commit
Cek setiap item berikut dan jawab ya/tidak:
Constraints

Apakah ada dependency baru yang berbayar? (Sectors.app, OpenAI, Mapbox, dll)
Apakah ada DB, Supabase, Redis, atau external storage yang ditambahkan?
Apakah ada komponen existing yang di-rebuild dari nol (bukan di-extend)?
Apakah ada backend terpisah atau microservice yang dibuat?

Design System

Apakah semua nilai IDR menggunakan formatIDR() dengan warna text-[#D97706]?
Apakah badge pills mengikuti warna standar di AGENTS.md?
Apakah section headers menggunakan left border teal bg-[#0D9488]?
Apakah background halaman/hover menggunakan #F5F2EC (bukan pure white)?
Apakah tabel rows menggunakan hover:bg-[#F5F2EC] dan border #E8E4DC?
Apakah ticker symbols menggunakan font-bold text-[#0D9488]?
Apakah IMMINENT MTO badge menggunakan animate-pulse?
Apakah return positif text-[#10B981] dan negatif text-[#EF4444]?

Disclaimer

Apakah Performance Since Disclosure punya disclaimer yang selalu visible?
Apakah Coordinated Bloc / Shadow Accumulation punya disclaimer?
Apakah Custodian Opacity punya disclaimer?
Apakah footer semua halaman punya "Bukan rekomendasi investasi"?

Summary
Tampilkan:

File yang dimodifikasi: [list]
File baru yang ditambahkan: [list]
Fungsi baru yang dibuat: [list]
Komponen baru yang dibuat: [list]