/* AURELIA STAY — BM/EN switch for the customer website.
   Translates rendered text in place (dictionary + patterns) and keeps up with live re-renders.
   Mark anything that must stay untouched with data-no-i18n. */
(function () {
  if (window.AureliaI18n) return;
  const KEY = 'aurelia-lang';
  const D = {
    // navigation & common
    'Home': 'Utama', 'Rooms': 'Bilik', 'Facilities': 'Kemudahan', 'Gallery': 'Galeri', 'About': 'Tentang Kami', 'Contact': 'Hubungi',
    'Sign in': 'Log Masuk', 'Book Now': 'Tempah Sekarang', 'Dashboard': 'Papan Pemuka', 'My Bookings': 'Tempahan Saya', 'Profile': 'Profil',
    'Notifications': 'Notifikasi', 'Logout': 'Log Keluar', 'Explore': 'Terokai', 'Support': 'Bantuan', 'Booking Help': 'Bantuan Tempahan',
    'Terms': 'Terma', 'Privacy': 'Privasi', 'Terms of Stay': 'Terma Penginapan', 'Privacy Policy': 'Dasar Privasi', 'Cancellation Policy': 'Polisi Pembatalan',
    'Manager portal': 'Portal Pengurus', 'Admin portal': 'Portal Admin', 'Hotel staff?': 'Kakitangan hotel?',
    'Simple Stay. Better Value.': 'Penginapan Ringkas. Nilai Lebih Baik.', 'Simple Stay.': 'Penginapan Ringkas.', 'Better Value.': 'Nilai Lebih Baik.', 'Simple': 'Penginapan', 'Stay.': 'Ringkas.',
    '20 rooms · RM80–RM95 per night': '20 bilik · RM80–RM95 semalam', '© 2026 AURELIA STAY · George Town, Penang': '© 2026 AURELIA STAY · George Town, Pulau Pinang',
    'Room': 'Bilik', '· Room': '· Bilik', 'Guest': 'Tetamu', 'Guests': 'Tetamu', 'Total': 'Jumlah', 'TOTAL': 'JUMLAH', 'Total ·': 'Jumlah ·', 'Dates': 'Tarikh',
    'Email': 'E-mel', 'Phone': 'Telefon', 'Name': 'Nama', 'Address': 'Alamat', 'Subject': 'Perkara', 'Message': 'Mesej', 'Payment': 'Bayaran',
    'Check-in': 'Daftar Masuk', 'Check-out': 'Daftar Keluar', 'Close': 'Tutup', '← Prev': '← Sebelum', 'Next →': 'Seterusnya →', 'Clear': 'Kosongkan',
    'Search': 'Cari', 'Cancel': 'Batal', 'Continue': 'Teruskan', 'From': 'Dari', 'from': 'dari', 'by': 'sebelum', 'and': 'dan', 'for': 'untuk', 'steps': 'langkah', 'Free': 'Percuma',
    '/ night': '/ malam', '/night': '/malam', 'Private': 'Peribadi', 'Bed': 'Katil', 'Keep it': 'Kekalkan', 'Yes, cancel': 'Ya, batalkan', 'No, keep it': 'Tidak, kekalkan',
    'Yes, cancel booking': 'Ya, batalkan tempahan', 'Are you sure?': 'Anda pasti?', 'Cancel booking': 'Batalkan tempahan', 'Cancel Booking': 'Batalkan Tempahan',
    'View Details': 'Lihat Butiran', 'View Room →': 'Lihat Bilik →', 'Select Room': 'Pilih Bilik', 'Save Changes': 'Simpan Perubahan', 'Contact Us': 'Hubungi Kami', 'Contact us': 'hubungi kami',
    // home
    'Budget hotel · George Town, Penang': 'Hotel bajet · George Town, Pulau Pinang', 'Explore Rooms': 'Terokai Bilik', 'Explore Rooms →': 'Terokai Bilik →', 'Book a Room': 'Tempah Bilik',
    'Comfortable rooms at a price that makes sense. Twenty rooms, four types, one clear price.': 'Bilik selesa pada harga yang munasabah. Dua puluh bilik, empat jenis, satu harga yang jelas.',
    'Find Your Room': 'Cari Bilik Anda', 'No sign-in needed to search': 'Tidak perlu log masuk untuk mencari', 'Search Availability': 'Semak Kekosongan',
    'A small hotel with': 'Hotel kecil dengan', 'honest prices': 'harga yang jujur', ", clean rooms and a front desk that's always there.": ', bilik yang bersih dan kaunter hadapan yang sentiasa ada.',
    'Rooms — small & comfortable': 'Bilik — kecil & selesa', 'Starting rate per night': 'Harga permulaan semalam', 'Wi-Fi in every room': 'Wi-Fi di setiap bilik', 'Support for hotel guests': 'Bantuan untuk tetamu hotel',
    '01 — Rooms': '01 — Bilik', 'Our Rooms': 'Bilik Kami', 'See all 4 room types →': 'Lihat kesemua 4 jenis bilik →', '02 — The feel': '02 — Suasana', 'Quiet colours, natural textures.': 'Warna tenang, tekstur semula jadi.',
    '03 — Facilities': '03 — Kemudahan', 'Everything a short stay needs.': 'Semua yang diperlukan untuk penginapan singkat.', 'All facilities →': 'Semua kemudahan →',
    '04 — Gallery': '04 — Galeri', 'A Look Inside': 'Tinjauan Ke Dalam', 'View Full Gallery': 'Lihat Galeri Penuh', '05 — Location': '05 — Lokasi', 'Find Us': 'Cari Kami', 'Get Directions ↗': 'Dapatkan Arah ↗',
    'Free Wi-Fi': 'Wi-Fi Percuma', 'Available throughout the hotel.': 'Tersedia di seluruh hotel.', 'Parking': 'Tempat Letak Kereta', 'On-site, for hotel guests.': 'Di premis, untuk tetamu hotel.',
    'Air Conditioning': 'Penghawa Dingin', 'In every room.': 'Di setiap bilik.', 'Reception': 'Kaunter Penyambut Tetamu', 'Front desk assistance.': 'Bantuan kaunter hadapan.', 'CCTV': 'CCTV',
    'Covering common areas.': 'Meliputi kawasan awam.', '24/7 Support': 'Bantuan 24/7', 'Guest assistance, day and night.': 'Bantuan tetamu, siang dan malam.',
    'On-site parking': 'Parkir di premis', 'Air conditioning': 'Penghawa dingin', 'Private bathroom': 'Bilik air peribadi', '24/7 reception': 'Kaunter 24/7', 'CCTV in common areas': 'CCTV di kawasan awam',
    'clean white bathroom': 'bilik air putih yang bersih', 'fresh white linen': 'cadar putih yang segar', 'fern leaves': 'daun pakis', 'green leaves': 'daun hijau',
    // room types & amenities
    'Private Bathroom': 'Bilik Air Peribadi', 'Work Desk': 'Meja Kerja', 'Single Bed': 'Katil Bujang', 'Double Bed': 'Katil Kelamin', 'Queen Bed': 'Katil Queen', '1 Queen + 2 Single': '1 Queen + 2 Bujang',
    '· Wi-Fi · Air Conditioning': '· Wi-Fi · Penghawa Dingin', 'Wi-Fi · Air Conditioning': 'Wi-Fi · Penghawa Dingin',
    'A compact, quiet room for solo travellers and short business stays.': 'Bilik kompak dan tenang untuk pengembara solo dan urusan kerja singkat.',
    'A simple and comfortable room designed for short stays, business trips and couples.': 'Bilik ringkas dan selesa untuk penginapan singkat, urusan kerja dan pasangan.',
    'A little more space to unwind, with a queen bed and a small work desk.': 'Ruang lebih sedikit untuk berehat, dengan katil queen dan meja kerja kecil.',
    'Room for up to four guests — practical for small families travelling together.': 'Muat sehingga empat tetamu — praktikal untuk keluarga kecil yang melancong bersama.',
    // rooms / room details
    'Rooms · 4 types · 20 rooms': 'Bilik · 4 jenis · 20 bilik', 'Find a room that fits your stay.': 'Cari bilik yang sesuai dengan penginapan anda.', 'Room Type': 'Jenis Bilik', 'All types': 'Semua jenis',
    'Max Price': 'Harga Maksimum', 'Any price': 'Semua harga', 'Up to RM80': 'Sehingga RM80', 'Up to RM85': 'Sehingga RM85', 'Up to RM90': 'Sehingga RM90', 'Checking availability…': 'Menyemak kekosongan…',
    'No rooms available': 'Tiada bilik kosong', 'No rooms available for your selected dates. Try different dates or fewer guests.': 'Tiada bilik kosong untuk tarikh pilihan anda. Cuba tarikh lain atau kurangkan tetamu.',
    'Fully booked': 'Penuh', 'About this room': 'Tentang bilik ini', 'Room Information': 'Maklumat Bilik', 'Room size': 'Saiz bilik', 'Capacity': 'Kapasiti', 'Bathroom': 'Bilik Air', 'Amenities': 'Kemudahan Bilik',
    'Check Availability': 'Semak Kekosongan', 'Check-in from': 'Daftar masuk dari', '· Check-out by': '· Daftar keluar sebelum', 'service fee per booking': 'yuran perkhidmatan setiap tempahan',
    'Room not found.': 'Bilik tidak dijumpai.', "We couldn't find the room you're looking for. It may have been removed.": 'Kami tidak dapat mencari bilik yang anda cari. Ia mungkin telah dikeluarkan.', 'Browse Rooms': 'Lihat Bilik',
    // facilities
    "What's included.": 'Apa yang disediakan.', "Everything a short stay needs — nothing we don't actually have. All facilities are included in your room rate.": 'Semua yang diperlukan untuk penginapan singkat — tiada yang kami tidak sediakan. Semua kemudahan termasuk dalam harga bilik.',
    'Free wireless internet available throughout the hotel — rooms, corridors and reception.': 'Internet tanpa wayar percuma di seluruh hotel — bilik, koridor dan kaunter.',
    'On-site parking for hotel guests, first come first served. No extra charge.': 'Tempat letak kereta di premis untuk tetamu hotel, siapa cepat dia dapat. Tiada caj tambahan.',
    'Every room has its own air conditioning with an easy remote, so you can set the room the way you like.': 'Setiap bilik mempunyai penghawa dingin sendiri dengan alat kawalan mudah, jadi anda boleh laraskan mengikut keselesaan.',
    'Each room has its own clean bathroom with hot shower, towels and basic toiletries.': 'Setiap bilik mempunyai bilik air bersih sendiri dengan pancuran air panas, tuala dan kelengkapan mandian asas.',
    'Front desk assistance for check-in, check-out, directions and anything you need during your stay.': 'Bantuan kaunter hadapan untuk daftar masuk, daftar keluar, arah jalan dan apa sahaja keperluan semasa penginapan.',
    'CCTV & 24/7 Support': 'CCTV & Bantuan 24/7', 'CCTV covers common areas and our team is available around the clock for hotel guests.': 'CCTV meliputi kawasan awam dan pasukan kami sedia membantu tetamu 24 jam.',
    // gallery
    'All': 'Semua', 'Hotel': 'Hotel', 'Hotel building': 'Bangunan hotel', 'Guest parking': 'Parkir tetamu', 'Street view': 'Pemandangan jalan', 'Fresh linen': 'Cadar segar', 'Shower & vanity': 'Pancuran & sinki',
    'Bright window room': 'Bilik bertingkap cerah', 'Small details': 'Butiran kecil', 'Room with a view': 'Bilik berpemandangan', 'Covered parking': 'Parkir berbumbung',
    // about
    'AURELIA STAY is a small budget hotel focused on providing a': 'AURELIA STAY ialah hotel bajet kecil yang memberi tumpuan kepada penginapan yang', 'clean, comfortable': 'bersih, selesa', 'and straightforward stay.': 'dan mudah.',
    'Our Story': 'Kisah Kami', "Twenty rooms, one front desk and a simple idea: a good night's rest shouldn't need a big budget. We keep the hotel small so every room gets the same care.": 'Dua puluh bilik, satu kaunter hadapan dan satu idea mudah: tidur yang lena tidak sepatutnya memerlukan bajet besar. Kami kekalkan hotel ini kecil supaya setiap bilik mendapat penjagaan yang sama.',
    'Our Approach': 'Pendekatan Kami', 'Clear prices, no surprises. You pick a room type, we assign the best available room and keep everything else straightforward — from booking to check-out.': 'Harga jelas, tiada kejutan. Anda pilih jenis bilik, kami tetapkan bilik terbaik yang ada dan pastikan semuanya mudah — dari tempahan hingga daftar keluar.',
    'What Guests Can Expect': 'Apa Yang Tetamu Boleh Jangka', 'Rooms across four floors': 'Bilik di empat tingkat', 'Affordable rates per night': 'Harga semalam yang berpatutan', 'Simple booking with Google sign-in': 'Tempahan mudah dengan log masuk Google',
    'Guest support, day and night': 'Bantuan tetamu, siang dan malam', 'Policies, simply put.': 'Polisi, secara ringkas.', 'Service fee': 'Yuran perkhidmatan', 'per booking': 'setiap tempahan', 'Cancellation': 'Pembatalan',
    'Free, before check-in date': 'Percuma, sebelum tarikh daftar masuk', 'Read the full Terms of Stay →': 'Baca Terma Penginapan penuh →',
    // contact
    'Contact AURELIA STAY': 'Hubungi AURELIA STAY', 'Send us a message': 'Hantar mesej kepada kami', 'Send Message': 'Hantar Mesej', '✓ Message sent successfully.': '✓ Mesej berjaya dihantar.',
    'Name is required': 'Nama diperlukan', 'Email is required': 'E-mel diperlukan', 'Enter a valid email address': 'Masukkan alamat e-mel yang sah', 'Subject is required': 'Perkara diperlukan', 'Message is required': 'Mesej diperlukan',
    // login & profile
    'Sign in to continue': 'Log masuk untuk teruskan', 'Continue with Google': 'Teruskan dengan Google', 'By continuing, you agree to our': 'Dengan meneruskan, anda bersetuju dengan',
    '. Guests sign in with Google only — no passwords.': '. Tetamu log masuk dengan Google sahaja — tiada kata laluan.', 'Manage your bookings in one place.': 'Urus tempahan anda di satu tempat.',
    'Please sign in to view this page.': 'Sila log masuk untuk melihat halaman ini.', 'Sign in with Google to continue your booking.': 'Log masuk dengan Google untuk meneruskan tempahan anda.',
    'Choose an account': 'Pilih akaun', 'to continue to AURELIA STAY': 'untuk teruskan ke AURELIA STAY', 'Use another account': 'Guna akaun lain', 'Full name': 'Nama penuh', 'Google email': 'E-mel Google',
    'Welcome to AURELIA STAY': 'Selamat datang ke AURELIA STAY', 'One more step — we need a phone number before you can book.': 'Satu langkah lagi — kami perlukan nombor telefon sebelum anda boleh menempah.',
    'Step 1 of 1': 'Langkah 1 daripada 1', 'Phone Number': 'Nombor Telefon', 'Complete Profile': 'Lengkapkan Profil', 'My Profile': 'Profil Saya', 'SIGNED IN WITH GOOGLE': 'LOG MASUK DENGAN GOOGLE',
    "Name and email are managed by your Google account and can't be edited here.": 'Nama dan e-mel diurus oleh akaun Google anda dan tidak boleh diubah di sini.', 'Account created:': 'Akaun dicipta:',
    '✓ Changes saved.': '✓ Perubahan disimpan.', 'Please enter a valid Malaysian phone number (e.g. 012-345 6789).': 'Sila masukkan nombor telefon Malaysia yang sah (cth. 012-345 6789).',
    'Staff accounts must sign in with email and password.': 'Akaun kakitangan perlu log masuk dengan e-mel dan kata laluan.', 'This account has been disabled. Please contact the hotel.': 'Akaun ini telah dinyahaktifkan. Sila hubungi hotel.',
    'Please enter a valid Google email address.': 'Sila masukkan alamat e-mel Google yang sah.', 'Please enter your name.': 'Sila masukkan nama anda.', 'You have been signed out.': 'Anda telah log keluar.', 'Profile completed': 'Profil dilengkapkan',
    // booking
    '1 · Select Room': '1 · Pilih Bilik', '2 · Guest Details': '2 · Butiran Tetamu', '3 · Summary & Confirm': '3 · Ringkasan & Pengesahan', 'Guest Details': 'Butiran Tetamu', 'Booking Summary': 'Ringkasan Tempahan',
    'Check-in · from': 'Daftar masuk · dari', 'Check-out · by': 'Daftar keluar · sebelum', 'Full Name': 'Nama Penuh', 'Name and email come from your Google account.': 'Nama dan e-mel diambil daripada akaun Google anda.',
    'Update phone in profile': 'Kemas kini telefon dalam profil', 'Pay at Hotel': 'Bayar di Hotel', 'Settle at check-in': 'Bayar semasa daftar masuk', 'Demo Payment': 'Bayaran Demo', 'Simulated — no charge': 'Simulasi — tiada caj',
    'Review Your Booking': 'Semak Tempahan Anda', 'Service Fee': 'Yuran Perkhidmatan', 'Continue to Summary': 'Teruskan ke Ringkasan', 'Confirm Booking': 'Sahkan Tempahan', 'Confirming…': 'Mengesahkan…', 'Back to details': 'Kembali ke butiran',
    'A room of this type is assigned automatically when you confirm. Prices are locked at booking time. Free cancellation before your check-in date —': 'Bilik jenis ini ditetapkan secara automatik apabila anda mengesahkan. Harga dikunci semasa tempahan. Pembatalan percuma sebelum tarikh daftar masuk —',
    'cancellation policy': 'polisi pembatalan', 'Invalid booking': 'Tempahan tidak sah', 'Room unavailable': 'Bilik tidak tersedia', 'Choose another room': 'Pilih bilik lain',
    'The selected booking information is no longer valid.': 'Maklumat tempahan yang dipilih tidak lagi sah.', 'This room is no longer available. Please select another room.': 'Bilik ini tidak lagi tersedia. Sila pilih bilik lain.',
    'Please select your check-in date': 'Sila pilih tarikh daftar masuk', 'Please select your check-out date': 'Sila pilih tarikh daftar keluar', 'Check-in date cannot be in the past': 'Tarikh daftar masuk tidak boleh pada masa lalu',
    'Check-out date must be after check-in': 'Tarikh daftar keluar mesti selepas daftar masuk', 'Stays are limited to 14 nights': 'Penginapan terhad kepada 14 malam', 'Please enter at least 1 guest': 'Sila masukkan sekurang-kurangnya 1 tetamu',
    'Your session has expired. Please sign in again.': 'Sesi anda telah tamat. Sila log masuk semula.', 'Booking Confirmed': 'Tempahan Disahkan', 'Thank you for choosing AURELIA STAY.': 'Terima kasih kerana memilih AURELIA STAY.',
    'Booking Reference': 'Rujukan Tempahan', 'View My Booking': 'Lihat Tempahan Saya', 'Back to Home': 'Kembali ke Utama', 'Booking not found.': 'Tempahan tidak dijumpai.',
    "You don't have access to this booking.": 'Anda tiada akses kepada tempahan ini.', 'Bookings can only be viewed by the guest who made them.': 'Tempahan hanya boleh dilihat oleh tetamu yang membuatnya.',
    // dashboard / bookings / notifications
    'Your next stay ·': 'Penginapan seterusnya ·', 'View Booking →': 'Lihat Tempahan →', 'No upcoming stays yet.': 'Belum ada penginapan akan datang.', 'Quick Actions': 'Tindakan Pantas',
    'today': 'hari ini', 'tomorrow': 'esok', 'in-house now': 'sedang menginap', 'GOOGLE ACCOUNT': 'AKAUN GOOGLE', 'FROM RM80': 'DARI RM80',
    'No upcoming bookings.': 'Tiada tempahan akan datang.', 'No past stays yet.': 'Belum ada penginapan lepas.', 'No cancelled bookings.': 'Tiada tempahan dibatalkan.', '← My Bookings': '← Tempahan Saya', 'Go to My Bookings': 'Ke Tempahan Saya',
    'Booking Details': 'Butiran Tempahan', 'Confirmed': 'Disahkan', 'Checked-in': 'Telah Daftar Masuk', 'Completed': 'Selesai', 'Cancelled': 'Dibatalkan',
    'This booking can no longer be cancelled online. Please contact the hotel.': 'Tempahan ini tidak lagi boleh dibatalkan dalam talian. Sila hubungi hotel.', "Are you sure? This can't be undone.": 'Anda pasti? Tindakan ini tidak boleh dibatalkan.',
    "? This can't be undone.": '? Tindakan ini tidak boleh dibatalkan.', 'Mark all as read': 'Tandakan semua sudah dibaca', "You're all caught up.": 'Tiada notifikasi baharu.', 'just now': 'baru sahaja',
    'Stay completed': 'Penginapan selesai', 'Your booking has been cancelled.': 'Tempahan anda telah dibatalkan.', 'Your account is ready. Add your phone number to start booking.': 'Akaun anda sudah sedia. Tambah nombor telefon untuk mula menempah.',
    // 404
    'Page not found.': 'Halaman tidak dijumpai.', "The page you're looking for doesn't exist.": 'Halaman yang anda cari tidak wujud.', 'Return Home': 'Kembali ke Utama',
    // policies (shared)
    'On this page': 'Dalam halaman ini', 'LAST UPDATED 30 SEP 2026': 'KEMAS KINI TERAKHIR 30 SEP 2026', 'Still have a question?': 'Masih ada soalan?',
    'Our front desk in George Town is here to help, day and night.': 'Kaunter hadapan kami di George Town sedia membantu, siang dan malam.',
    'Policies · Terms': 'Polisi · Terma', 'Policies · Privacy': 'Polisi · Privasi', 'Policies · Cancellation': 'Polisi · Pembatalan',
    // terms
    'The simple rules for booking and staying at AURELIA STAY, George Town, Penang.': 'Peraturan mudah untuk menempah dan menginap di AURELIA STAY, George Town, Pulau Pinang.',
    'About these terms': 'Tentang terma ini', 'These terms apply to every booking with AURELIA STAY, whether made on this website or at our front desk. By confirming a booking, you agree to them.': 'Terma ini terpakai untuk setiap tempahan dengan AURELIA STAY, sama ada dibuat di laman web ini atau di kaunter hadapan. Dengan mengesahkan tempahan, anda bersetuju dengannya.',
    'Making a booking': 'Membuat tempahan', 'Online bookings require signing in with a Google account and adding a phone number.': 'Tempahan dalam talian memerlukan log masuk dengan akaun Google dan menambah nombor telefon.',
    'You book a': 'Anda menempah', 'room type': 'jenis bilik', '. A specific room of that type is assigned automatically when you confirm.': '. Bilik tertentu bagi jenis tersebut ditetapkan secara automatik apabila anda mengesahkan.',
    'Your booking is confirmed once you receive a booking reference (for example': 'Tempahan anda disahkan sebaik sahaja anda menerima rujukan tempahan (contohnya',
    'The hotel may move you to another room of the same type before check-in, for example due to maintenance.': 'Hotel boleh memindahkan anda ke bilik lain yang sama jenis sebelum daftar masuk, contohnya kerana penyelenggaraan.',
    'Prices & payment': 'Harga & bayaran', 'All prices are in Malaysian Ringgit (RM), per room, per night.': 'Semua harga dalam Ringgit Malaysia (RM), setiap bilik, setiap malam.',
    'A service fee of RM10 is added once per booking.': 'Yuran perkhidmatan RM10 dikenakan sekali bagi setiap tempahan.', 'The price shown when you confirm is locked in — later price changes do not affect your booking.': 'Harga yang dipaparkan semasa pengesahan adalah muktamad — perubahan harga kemudian tidak menjejaskan tempahan anda.',
    'Payment is settled at the front desk on arrival.': 'Bayaran dibuat di kaunter hadapan semasa ketibaan.', 'Check-in & check-out': 'Daftar masuk & daftar keluar',
    'Check-in from 2:00 PM. Check-out by 12:00 PM.': 'Daftar masuk dari 2:00 PTG. Daftar keluar sebelum 12:00 TGH.', 'Please bring valid photo ID (MyKad or passport) for check-in.': 'Sila bawa dokumen pengenalan bergambar yang sah (MyKad atau pasport) untuk daftar masuk.',
    'Early check-in and late check-out depend on availability — ask the front desk.': 'Daftar masuk awal dan daftar keluar lewat bergantung pada kekosongan — tanya kaunter hadapan.',
    'Room capacity': 'Kapasiti bilik', 'Each room type has a maximum number of guests, including children: Standard Single 1, Standard Double 2, Deluxe Double 2, Family Room 4. A single booking can be up to 14 nights.': 'Setiap jenis bilik mempunyai had tetamu, termasuk kanak-kanak: Standard Single 1, Standard Double 2, Deluxe Double 2, Family Room 4. Satu tempahan boleh sehingga 14 malam.',
    'House rules': 'Peraturan rumah', 'No smoking inside rooms.': 'Dilarang merokok di dalam bilik.', 'Please keep noise low between 11:00 PM and 7:00 AM.': 'Sila kurangkan bunyi bising antara 11:00 malam hingga 7:00 pagi.',
    'Guests are responsible for damage to the room caused during their stay.': 'Tetamu bertanggungjawab atas kerosakan bilik semasa penginapan.', 'Please keep valuables with you. The hotel is not responsible for loss, except where caused by our negligence.': 'Sila simpan barang berharga bersama anda. Hotel tidak bertanggungjawab atas kehilangan, kecuali akibat kecuaian kami.',
    'Changes to these terms': 'Perubahan terma', 'We may update these terms from time to time. The version shown when you confirm your booking applies to that booking. Questions?': 'Kami boleh mengemas kini terma ini dari semasa ke semasa. Versi yang dipaparkan semasa anda mengesahkan tempahan terpakai untuk tempahan tersebut. Ada soalan?',
    // privacy
    'What personal data we collect, why we need it, and your rights under the Personal Data Protection Act 2010 (PDPA).': 'Data peribadi yang kami kumpul, sebab kami memerlukannya, dan hak anda di bawah Akta Perlindungan Data Peribadi 2010 (PDPA).',
    'Data we collect': 'Data yang kami kumpul', 'From your Google account:': 'Daripada akaun Google anda:', 'your name, email address and profile photo.': 'nama, alamat e-mel dan gambar profil anda.', 'From you:': 'Daripada anda:',
    'your phone number.': 'nombor telefon anda.', 'From your bookings:': 'Daripada tempahan anda:', 'dates, room type, number of guests and booking history.': 'tarikh, jenis bilik, bilangan tetamu dan sejarah tempahan.',
    'Walk-in guests:': 'Tetamu walk-in:', 'name, phone number and, optionally, email.': 'nama, nombor telefon dan, jika mahu, e-mel.', 'Security records:': 'Rekod keselamatan:', 'sign-in times and key account actions.': 'masa log masuk dan tindakan penting akaun.',
    'How we use it': 'Cara kami menggunakannya', 'To create and manage your bookings.': 'Untuk membuat dan mengurus tempahan anda.', 'To contact you about your stay.': 'Untuk menghubungi anda tentang penginapan.',
    'To verify your identity at check-in.': 'Untuk mengesahkan identiti anda semasa daftar masuk.', 'To keep the system secure and keep a record of changes.': 'Untuk memastikan sistem selamat dan merekod perubahan.', 'To meet legal and accounting requirements.': 'Untuk memenuhi keperluan undang-undang dan perakaunan.',
    'Who can see it': 'Siapa boleh melihatnya', 'Your data is only visible to hotel staff who need it to look after your stay. We do not sell your data. We share it only with Google (for sign-in) and with authorities when required by Malaysian law.': 'Data anda hanya boleh dilihat oleh kakitangan hotel yang memerlukannya untuk menguruskan penginapan anda. Kami tidak menjual data anda. Kami hanya berkongsi dengan Google (untuk log masuk) dan pihak berkuasa apabila dikehendaki oleh undang-undang Malaysia.',
    'How long we keep it': 'Tempoh simpanan', 'Booking records are kept for as long as needed for accounting and legal purposes. You can ask us to close your account at any time — past booking records may still be kept where the law requires it.': 'Rekod tempahan disimpan selama yang diperlukan untuk tujuan perakaunan dan undang-undang. Anda boleh meminta kami menutup akaun anda pada bila-bila masa — rekod tempahan lepas mungkin masih disimpan jika dikehendaki undang-undang.',
    'How we protect it': 'Cara kami melindunginya', 'Guests sign in with Google — we never store your password.': 'Tetamu log masuk dengan Google — kami tidak pernah menyimpan kata laluan anda.', 'Staff accounts are locked after repeated failed sign-ins.': 'Akaun kakitangan dikunci selepas beberapa kali gagal log masuk.',
    'Every sensitive change is recorded in an audit log.': 'Setiap perubahan sensitif direkod dalam log audit.', 'Your rights': 'Hak anda',
    'Under the PDPA you can ask to see the personal data we hold about you, correct it, or withdraw your consent. Email': 'Di bawah PDPA, anda boleh meminta untuk melihat data peribadi yang kami simpan, membetulkannya, atau menarik balik persetujuan. E-mel',
    'and we will reply within 21 days.': 'dan kami akan membalas dalam tempoh 21 hari.', 'Cookies & storage': 'Kuki & storan',
    'We only use the storage needed to keep you signed in and remember your booking progress. We do not use advertising trackers.': 'Kami hanya menggunakan storan yang diperlukan untuk kekal log masuk dan mengingati kemajuan tempahan anda. Kami tidak menggunakan penjejak iklan.',
    // cancellation
    'Plans change. Cancel free of charge any time before your check-in date.': 'Rancangan boleh berubah. Batalkan secara percuma pada bila-bila masa sebelum tarikh daftar masuk.',
    'Before check-in date': 'Sebelum tarikh daftar masuk', 'Free cancellation': 'Pembatalan percuma', 'Cancel online in My Bookings. No fee.': 'Batalkan dalam talian di Tempahan Saya. Tiada caj.',
    'On check-in date': 'Pada tarikh daftar masuk', 'Call the hotel': 'Telefon hotel', 'Online cancellation is closed. Phone the front desk.': 'Pembatalan dalam talian ditutup. Telefon kaunter hadapan.',
    'After check-in': 'Selepas daftar masuk', 'Not cancellable': 'Tidak boleh dibatalkan', 'Speak to the front desk about early departure.': 'Berbincang dengan kaunter hadapan untuk keluar awal.',
    'How to cancel': 'Cara membatalkan', 'Sign in and open': 'Log masuk dan buka', 'Choose the booking and select': 'Pilih tempahan dan tekan',
    'Confirm. You will receive a notification and the booking moves to your Cancelled tab.': 'Sahkan. Anda akan menerima notifikasi dan tempahan akan berpindah ke tab Dibatalkan.',
    'On or after your check-in date': 'Pada atau selepas tarikh daftar masuk', 'Online cancellation closes at the start of your check-in date. If you can no longer make it, please call the front desk on +60 4-261 8890 so we can release your room.': 'Pembatalan dalam talian ditutup pada awal tarikh daftar masuk anda. Jika anda tidak dapat hadir, sila telefon kaunter hadapan di +60 4-261 8890 supaya kami boleh melepaskan bilik anda.',
    'Fees & refunds': 'Caj & bayaran balik', 'Because payment is settled at the front desk, nothing is charged when you cancel in time — there is no cancellation fee and nothing to refund.': 'Oleh kerana bayaran dibuat di kaunter hadapan, tiada caj dikenakan jika anda membatalkan dalam tempoh — tiada caj pembatalan dan tiada bayaran balik diperlukan.',
    'Changing your dates': 'Menukar tarikh', 'To change your dates or room type, cancel your booking (before the check-in date) and make a new one. Prices for the new booking follow the current rates.': 'Untuk menukar tarikh atau jenis bilik, batalkan tempahan anda (sebelum tarikh daftar masuk) dan buat tempahan baharu. Harga tempahan baharu mengikut kadar semasa.',
    'If the hotel cancels': 'Jika hotel membatalkan', 'In rare cases — such as an unexpected maintenance issue or a duplicate booking — the hotel may cancel a booking. We will notify you straight away with the reason and help you find another room of the same type where one is available.': 'Dalam kes jarang berlaku — seperti masalah penyelenggaraan tidak dijangka atau tempahan berganda — hotel boleh membatalkan tempahan. Kami akan memaklumkan anda dengan segera beserta sebabnya dan membantu mencari bilik lain yang sama jenis jika ada.',
    'Once you have checked in, the booking cannot be cancelled. If you need to leave early, please speak to the front desk.': 'Selepas daftar masuk, tempahan tidak boleh dibatalkan. Jika anda perlu keluar awal, sila berbincang dengan kaunter hadapan.',
    // busy button labels (Firebase-backed pages)
    'Opening Google…': 'Membuka Google…', 'Saving…': 'Menyimpan…', 'Sending…': 'Menghantar…', 'Cancelling…': 'Membatalkan…',
    // privacy (updated for Firebase)
    'Your data is only visible to hotel staff who need it to look after your stay. We do not sell your data. We share it only with Google (for sign-in and for the secure Firebase cloud service that stores it) and with authorities when required by Malaysian law.': 'Data anda hanya boleh dilihat oleh kakitangan hotel yang memerlukannya untuk menguruskan penginapan anda. Kami tidak menjual data anda. Kami hanya berkongsi dengan Google (untuk log masuk dan untuk perkhidmatan awan Firebase yang selamat yang menyimpannya) dan pihak berkuasa apabila dikehendaki oleh undang-undang Malaysia.',
    'Staff also sign in with Google, and their access is controlled by an administrator.': 'Kakitangan juga log masuk dengan Google, dan akses mereka dikawal oleh pentadbir.',
    'Your data is stored in Google Firebase (Cloud Firestore and Realtime Database) and protected by access rules, so a guest can only see their own bookings.': 'Data anda disimpan dalam Google Firebase (Cloud Firestore dan Realtime Database) dan dilindungi oleh peraturan akses, jadi tetamu hanya boleh melihat tempahan mereka sendiri.',
    'We only use the browser storage needed to keep you signed in and to remember your language choice. We do not use advertising trackers.': 'Kami hanya menggunakan storan pelayar yang diperlukan untuk kekal log masuk dan mengingati pilihan bahasa anda. Kami tidak menggunakan penjejak iklan.',
    'From the contact form:': 'Daripada borang hubungi:', 'your name, email address and message.': 'nama, alamat e-mel dan mesej anda.',
    // sign-in & account errors (core/errors.js, core/auth-profile.js)
    'Your browser blocked the Google sign-in window. Please allow pop-ups for this site and try again.': 'Pelayar anda menyekat tetingkap log masuk Google. Sila benarkan pop timbul untuk laman ini dan cuba lagi.',
    'Sign-in was cancelled.': 'Log masuk dibatalkan.',
    'This Google account is a staff account. Please use the Manager or Admin portal.': 'Akaun Google ini ialah akaun kakitangan. Sila gunakan portal Pengurus atau Admin.',
    'Your Google email address is not verified. Please verify it with Google and try again.': 'Alamat e-mel Google anda belum disahkan. Sila sahkan dengan Google dan cuba lagi.',
    'This website address is not authorised for Google sign-in yet.': 'Alamat laman web ini belum dibenarkan untuk log masuk Google.',
    'Network problem. Please check your connection and try again.': 'Masalah rangkaian. Sila semak sambungan anda dan cuba lagi.',
    'The system is busy. Please try again in a moment.': 'Sistem sibuk. Sila cuba lagi sebentar nanti.',
    'Something went wrong.': 'Sesuatu tidak kena.', 'Forbidden.': 'Tidak dibenarkan.', 'Authentication required.': 'Log masuk diperlukan.',
    // contact form validation (services/contact.js)
    'Please fix the highlighted fields.': 'Sila betulkan ruangan yang ditanda.', 'Name must be 100 characters or fewer': 'Nama mesti 100 aksara atau kurang',
    'Subject must be 150 characters or fewer': 'Perkara mesti 150 aksara atau kurang', 'Message must be 2000 characters or fewer': 'Mesej mesti 2000 aksara atau kurang',
    // booking & cancellation errors (services/booking-create.js, booking-cancel.js, availability.js)
    'Please add your phone number before booking.': 'Sila tambah nombor telefon anda sebelum menempah.',
    'Only customers can create online bookings.': 'Hanya pelanggan boleh membuat tempahan dalam talian.',
    'Online booking is currently disabled.': 'Tempahan dalam talian dimatikan buat masa ini.', 'Room type not found.': 'Jenis bilik tidak dijumpai.',
    'Please enter a valid check-in date': 'Sila masukkan tarikh daftar masuk yang sah', 'Please enter a valid check-out date': 'Sila masukkan tarikh daftar keluar yang sah',
    'You do not have access to this booking.': 'Anda tiada akses kepada tempahan ini.',
    'Online cancellation is currently disabled. Please contact the hotel.': 'Pembatalan dalam talian dimatikan buat masa ini. Sila hubungi hotel.',
    'This booking has already been cancelled.': 'Tempahan ini telah dibatalkan.', 'Bookings can only be cancelled before the check-in date.': 'Tempahan hanya boleh dibatalkan sebelum tarikh daftar masuk.',
    // Google-only sign-in fallbacks & generic greeting (Dashboard, core/auth*.js)
    'Welcome': 'Selamat datang', 'Invalid booking source.': 'Sumber tempahan tidak sah.', 'Walk-in booking is currently disabled.': 'Tempahan walk-in dimatikan buat masa ini.',
    'This account is disabled. Contact the system administrator.': 'Akaun ini dinyahaktifkan. Sila hubungi pentadbir sistem.'
  };
  // 12-hour clock labels from settings (e.g. '2:00 PM') -> BM abbreviations used elsewhere in this file (PG / TGH / PTG / MLM)
  const T12 = (h, m, ap) => h + ':' + m + ' ' + (ap === 'AM' ? 'PG' : +h === 12 ? 'TGH' : +h < 7 ? 'PTG' : 'MLM');
  const STATUS = { 'checked-in': 'telah daftar masuk', 'completed': 'selesai', 'cancelled': 'dibatalkan', 'confirmed': 'disahkan' };
  const R = [
    // dynamic text built from live settings / catalogue
    // wrapper first, so the inner error text (matched by the later rules) gets translated too
    [/^We couldn't complete your booking\. (.+)$/, (x, e) => 'Kami tidak dapat melengkapkan tempahan anda. ' + (tr(e) || e)],
    [/^Rooms · (\d+) types? · (\d+) rooms?$/, 'Bilik · $1 jenis · $2 bilik'], [/^See all (\d+) room types? →$/, 'Lihat kesemua $1 jenis bilik →'],
    [/^Up to (RM[\d.,]+)$/, 'Sehingga $1'], [/^FROM (RM[\d.,]+)$/, 'DARI $1'],
    [/^(\d+) rooms? · (RM[\d.,]+(?:–RM[\d.,]+)?) per night$/, '$1 bilik · $2 semalam'], [/^(\d+) rooms?$/, '$1 bilik'],
    [/^A service fee of (RM[\d.,]+) is added once per booking\.$/, 'Yuran perkhidmatan $1 dikenakan sekali bagi setiap tempahan.'],
    [/^Check-in from (\d{1,2}):(\d{2}) (AM|PM)\. Check-out by (\d{1,2}):(\d{2}) (AM|PM)\.$/, (x, h1, m1, a1, h2, m2, a2) => 'Daftar masuk dari ' + T12(h1, m1, a1) + '. Daftar keluar sebelum ' + T12(h2, m2, a2) + '.'],
    [/^(\d{1,2}):(\d{2}) (AM|PM)$/, (x, h, m, a) => T12(h, m, a)],
    [/^Online cancellation closes at the start of your check-in date\. If you can no longer make it, please call the front desk on (.+) so we can release your room\.$/, 'Pembatalan dalam talian ditutup pada awal tarikh daftar masuk anda. Jika anda tidak dapat hadir, sila telefon kaunter hadapan di $1 supaya kami boleh melepaskan bilik anda.'],
    [/^Only confirmed bookings can be cancelled\. This booking is (.+)\.$/, (x, st) => 'Hanya tempahan yang disahkan boleh dibatalkan. Tempahan ini ' + (STATUS[st] || st) + '.'],
    [/^(\d+) Guests?$/, '$1 Tetamu'], [/^(\d+) guests?$/, '$1 tetamu'], [/^(\d+) nights?$/, '$1 malam'], [/^(\d+) steps$/, '$1 langkah'],
    [/^(\d+) rooms in this type$/, '$1 bilik jenis ini'], [/^(\d+) rooms · (\d+) available$/, '$1 bilik · $2 tersedia'],
    [/^(\d+) room types? available · (\d+) nights?$/, '$1 jenis bilik tersedia · $2 malam'], [/^Fits up to (\d+) guests?$/, 'Muat sehingga $1 tetamu'],
    [/^(\d+) rooms? available for your dates$/, '$1 bilik tersedia untuk tarikh anda'],
    [/^(RM[\d.,]+) × (\d+) nights? \+ (RM[\d.,]+) service fee = (RM[\d.,]+)$/, '$1 × $2 malam + yuran perkhidmatan $3 = $4'], [/^(RM[\d.,]+) × (\d+) nights?$/, '$1 × $2 malam'],
    [/^Good morning, (.+)$/, 'Selamat pagi, $1'], [/^Good afternoon, (.+)$/, 'Selamat petang, $1'], [/^Good evening, (.+)$/, 'Selamat malam, $1'],
    [/^Room (\d+) \(assigned on confirm\)$/, 'Bilik $1 (ditetapkan semasa pengesahan)'], [/^Room (\d+)$/, 'Bilik $1'], [/^Room (\d+) · (.+)$/, 'Bilik $1 · $2'],
    [/^Upcoming \((\d+)\)$/, 'Akan Datang ($1)'], [/^Past \((\d+)\)$/, 'Lepas ($1)'], [/^Cancelled \((\d+)\)$/, 'Dibatalkan ($1)'], [/^in (\d+) days$/, 'dalam $1 hari'],
    [/^(\d+) TOTAL$/, '$1 JUMLAH'], [/^(\d+) UNREAD$/, '$1 BELUM DIBACA'], [/^(\d+) new$/, '$1 baharu'],
    [/^(\d+) min ago$/, '$1 minit lalu'], [/^(\d+) hours? ago$/, '$1 jam lalu'], [/^(\d+) days? ago$/, '$1 hari lalu'],
    [/^Booking (AUR-\d{4}-\d+) confirmed$/, 'Tempahan $1 disahkan'], [/^Booking (AUR-\d{4}-\d+) cancelled\.?$/, 'Tempahan $1 dibatalkan'], [/^Checked in — Room (\d+)$/, 'Telah daftar masuk — Bilik $1'],
    [/^Room (\d+) is reserved for (.+)\.$/, 'Bilik $1 ditempah untuk $2.'], [/^Thanks for staying with us\. Booking (\S+) is complete\.$/, 'Terima kasih kerana menginap bersama kami. Tempahan $1 telah selesai.'],
    [/^Your booking (\S+) has been checked in\. Enjoy your stay\.$/, 'Tempahan $1 telah didaftar masuk. Selamat menginap.'], [/^Your booking was cancelled by the hotel\. Reason: (.+)$/, 'Tempahan anda dibatalkan oleh hotel. Sebab: $1'],
    [/^Cancelled on (.+) · Cancelled by customer$/, 'Dibatalkan pada $1 · Dibatalkan oleh pelanggan'], [/^Cancelled on (.+) · (.+)$/, 'Dibatalkan pada $1 · $2'],
    [/^Signed in as (.+)$/, 'Log masuk sebagai $1'], [/^There is no booking with reference (.+)\.$/, 'Tiada tempahan dengan rujukan $1.'],
    [/^No rooms available for (\d+) guests\.$/, 'Tiada bilik untuk $1 tetamu.'], [/^(.+) fits up to (\d+) guests?\.( Try a larger room type\.)?$/, (m, a, b, c) => a + ' muat sehingga ' + b + ' tetamu.' + (c ? ' Cuba jenis bilik yang lebih besar.' : '')],
    [/^Showing availability for (.+) → (.+) · (\d+) guests?$/, 'Kekosongan untuk $1 → $2 · $3 tetamu'], [/^(.+) → (.+) · (\d+) guests?$/, '$1 → $2 · $3 tetamu']
  ];
  const MON = { Mar: 'Mac', May: 'Mei', Aug: 'Ogo', Oct: 'Okt', Dec: 'Dis' };
  let lang = 'en'; try { lang = localStorage.getItem(KEY) === 'ms' ? 'ms' : 'en'; } catch (e) { }
  let done = new WeakMap(); const orig = new WeakMap(); const touched = new Set(); const touchedAttr = new Set();
  const norm = s => s.replace(/\s+/g, ' ').trim().replace(/&amp;/g, '&');
  function tr(s) {
    const k = norm(s); if (!k || !/[A-Za-z]/.test(k)) return null;
    let out = D[k];
    if (out === undefined) for (const [re, rep] of R) { if (re.test(k)) { const r2 = k.replace(re, rep); out = (r2 === k ? undefined : r2); if (out !== undefined) out = tr2(out); break; } }
    const base = out !== undefined ? out : k;
    const m = base.replace(/\b(\d{1,2}) (Mar|May|Aug|Oct|Dec)\b/g, (x, d, mo) => d + ' ' + MON[mo]);
    if (out === undefined && m === k) return null;
    return s.match(/^\s*/)[0] + m + s.match(/\s*$/)[0];
  }
  const tr2 = s => s.replace(/\b(Confirmed|Cancelled by customer|Completed)\b/g, w => ({ 'Confirmed': 'Disahkan', 'Cancelled by customer': 'Dibatalkan oleh pelanggan', 'Completed': 'Selesai' }[w]));
  const skip = n => { const p = n.parentElement; return !p || !!p.closest('[data-no-i18n],script,style,textarea,title,noscript'); };
  function doNode(n) {
    if (skip(n)) return; const cur = n.nodeValue; if (done.get(n) === cur) return;
    const t = tr(cur); orig.set(n, cur);
    if (t !== null && t !== cur) { done.set(n, t); touched.add(n); n.nodeValue = t; } else done.set(n, cur);
  }
  function doAttr(el) {
    const v = el.getAttribute('placeholder'); if (!v || el.__i18nT === v) return;
    const t = tr(v); if (t) { el.__i18nO = v; el.__i18nT = t; el.setAttribute('placeholder', t); touchedAttr.add(el); }
  }
  function walk(root) {
    if (lang !== 'ms' || !root) return;
    if (root.nodeType === 3) return doNode(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) doNode(n);
    if (root.querySelectorAll) { if (root.hasAttribute && root.hasAttribute('placeholder')) doAttr(root); root.querySelectorAll('[placeholder]').forEach(doAttr); }
  }
  function restore() {
    touched.forEach(n => { if (n.isConnected && n.nodeValue === done.get(n)) n.nodeValue = orig.get(n); }); touched.clear();
    touchedAttr.forEach(el => { if (el.getAttribute('placeholder') === el.__i18nT) el.setAttribute('placeholder', el.__i18nO); el.__i18nT = null; }); touchedAttr.clear();
    done = new WeakMap();
  }
  const mo = new MutationObserver(ms => {
    if (lang !== 'ms') return;
    ms.forEach(m => { if (m.type === 'characterData') doNode(m.target); else if (m.type === 'attributes') doAttr(m.target); else m.addedNodes.forEach(walk); });
  });
  function start() { document.documentElement.lang = lang === 'ms' ? 'ms' : 'en'; walk(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder'] }); }
  window.AureliaI18n = {
    get lang() { return lang; },
    set(l) {
      lang = l === 'ms' ? 'ms' : 'en'; try { localStorage.setItem(KEY, lang); } catch (e) { }
      document.documentElement.lang = lang;
      if (lang === 'ms') walk(document.body); else restore();
      window.dispatchEvent(new CustomEvent('aurelia-lang', { detail: lang }));
    },
    toggle() { this.set(lang === 'ms' ? 'en' : 'ms'); }
  };
  window.addEventListener('storage', e => { if (e.key === KEY && e.newValue && e.newValue !== lang) window.AureliaI18n.set(e.newValue); });
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
