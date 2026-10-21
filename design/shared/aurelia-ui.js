/* AURELIA STAY — shared view helpers used by every page (formatting, chips, view-models, guards) */
(function () {
  const S = () => window.AureliaStore;
  const q = () => { const o = {}; new URLSearchParams(location.search).forEach((v, k) => o[k] = v); return o; };
  const TONES = { 1: { bg: '#CBCBCB', stripe: '#BFBFBF', label: 'stone' }, 2: { bg: '#E3E3E3', stripe: '#D6D6D6', label: 'paper' }, 3: { bg: '#174C38', stripe: '#1F5C45', label: 'forest' }, 4: { bg: '#4E1617', stripe: '#5C1F20', label: 'burgundy' } };
  const BOOKING = { CONFIRMED: ['Confirmed', '#DCE8E1', '#174C38'], CHECKED_IN: ['Checked-in', '#174C38', '#F1D7A5'], COMPLETED: ['Completed', '#E2E2E2', '#333333'], CANCELLED: ['Cancelled', '#EBD9D8', '#4E1617'] };
  const ROOM = { AVAILABLE: ['Available', '#DCE8E1', '#174C38'], RESERVED: ['Reserved', '#F3E6C8', '#5E400C'], OCCUPIED: ['Occupied', '#4E1617', '#F1D7A5'], CLEANING: ['Cleaning', '#E2E2E2', '#333333'], MAINTENANCE: ['Maintenance', '#EBD9D8', '#8A1F21'], OUT_OF_SERVICE: ['Out of service', '#3A3A3A', '#F2F2F2'] };
  const chipOf = (map, s) => ({ label: map[s][0], bg: map[s][1], fg: map[s][2] });
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const t12 = t => { const [h, m] = String(t).split(':').map(Number); return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };

  // Budget-hotel photography (Unsplash) — simple, clean rooms; swap for real hotel photos later
  const P = { single: '1522771739844-6a9f6d5f14af', double: '1631049307264-da0ec9d70304', deluxe: '1512918728675-ed5a9ecdebfd', family: '1595576508898-0ad5c879a061', room2: '1595526114035-0d45ed16cfbf', room3: '1609949279531-cf48d64bed89', room4: '1592229505726-ca121723b8ef', bath: '1552321554-5fefe8c9ef14', bath2: '1584622650111-993a426fbf0a', exterior: '1455587734955-081b22074882', exterior2: '1545324418-cc1a3fa10c00', parking: '1506521781263-d8422e82f27a', garage: '1573348722427-f1d6819fdf98', fern: '1518531933037-91b2f5f229cc', leaves: '1470058869958-2a77ade41c02', plant: '1509423350716-97f9360b4e09', repair: '1558618666-fcd25c85cd64' };
  const img = (key, w) => 'https://images.unsplash.com/photo-' + (P[key] || P.double) + '?w=' + (w || 1200) + '&q=70&auto=format&fit=crop';
  const TYPE_IMG = { 1: 'single', 2: 'double', 3: 'deluxe', 4: 'family' };
  const GALLERY = [['Rooms', 'double', 'Standard Double'], ['Hotel', 'exterior', 'Hotel building'], ['Rooms', 'single', 'Standard Single'], ['Facilities', 'bath', 'Private bathroom'], ['Rooms', 'family', 'Family Room'], ['Facilities', 'parking', 'Guest parking'], ['Rooms', 'deluxe', 'Deluxe Double'], ['Hotel', 'exterior2', 'Street view'], ['Rooms', 'room3', 'Fresh linen'], ['Facilities', 'bath2', 'Shower & vanity'], ['Rooms', 'room2', 'Bright window room'], ['Hotel', 'plant', 'Small details'], ['Rooms', 'room4', 'Room with a view'], ['Facilities', 'garage', 'Covered parking']].map(([cat, key, label]) => ({ cat, key, label, src: img(key, 1400), thumb: img(key, 700) }));

  window.AureliaUI = {
    img, IMG_KEYS: P, TYPE_IMG, GALLERY, q, TONES, plural, t12,
    bookingChip: s => chipOf(BOOKING, s), roomChip: s => chipOf(ROOM, s), ROOM_LABEL: s => ROOM[s][0],
    whenReady(cb) { const w = () => window.AureliaStore ? cb(window.AureliaStore) : setTimeout(w, 30); w(); },
    settings() { const s = S().db.settings; return Object.assign({}, s, { checkInLabel: t12(s.checkInTime), checkOutLabel: t12(s.checkOutTime) }); },
    typeVM(t) {
      const db = S().db; const count = db.rooms.filter(r => r.typeId === t.id).length;
      const guests = plural(t.capacity, 'Guest');
      return { id: t.id, img: img(TYPE_IMG[t.id], 900), imgLarge: img(TYPE_IMG[t.id], 1600), name: t.name, lower: t.name.toLowerCase(), price: t.price, priceLabel: S().rm(t.price), capacity: t.capacity, guestsLabel: guests, bed: t.bed, sizeLabel: t.size + ' m²', description: t.description, features: [guests, t.bed].concat(t.amenities), href: 'Room%20Details.dc.html?id=' + t.id, tone: TONES[t.id], count, stockLabel: count + ' rooms in this type' };
    },
    bookingVM(b) {
      const St = S(); const t = St.type(b.typeId) || { name: 'Room' }, r = St.room(b.roomId) || { number: '—' }; const chip = chipOf(BOOKING, b.status);
      return { ref: b.ref, typeName: t.name, roomNo: r.number, ciS: St.fmtShort(b.checkIn), coS: St.fmtShort(b.checkOut), ciL: St.fmtDate(b.checkIn), coL: St.fmtDate(b.checkOut), guests: plural(b.guests, 'Guest'), totalL: St.rm(b.total), subtotalL: St.rm(b.subtotal), feeL: St.rm(b.serviceFee), rateLine: St.rm(b.roomPrice) + ' × ' + plural(b.nights, 'night'), chip, statusLabel: chip.label, payment: b.payment || 'Pay at Hotel', guestName: b.guestName, guestEmail: b.guestEmail || '—', guestPhone: b.guestPhone || '—', source: b.source === 'WALK_IN' ? 'WALK-IN' : 'ONLINE', status: b.status };
    },
    // Customer guard: returns the signed-in customer or sends them to Login with a return URL
    requireCustomer(opts) {
      const u = S().sessionUser('customer');
      if (!u) { location.replace('Login.dc.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)); return null; }
      if (opts && opts.phone && !u.phone) { location.replace('Complete%20Profile.dc.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)); return null; }
      return u;
    },
    requireStaff(role) {
      const u = S().sessionUser(role);
      if (u && !u.expired && window.AureliaStore) window.AureliaStore.touch(role);
      if (!u || u.expired) { location.replace('Login.dc.html?' + (u && u.expired ? 'expired=1&' : '') + 'next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)); return null; }
      return u;
    },
    // Re-check on every store change (sign-out in another tab, disabled account, idle timeout): sends the user back to Login. Returns a stop function.
    watchSession(role) {
      let gone = false;
      const check = () => {
        if (gone || window.__aureliaSigningOut || !window.AureliaStore) return;
        const u = S().sessionUser(role);
        if (u && !u.expired) return;
        gone = true; location.replace('Login.dc.html?' + (u && u.expired ? 'expired=1&' : '') + 'next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
      };
      const off = S().subscribe(check);
      const iv = role === 'customer' ? 0 : setInterval(check, 30000);
      return () => { off(); if (iv) clearInterval(iv); };
    },
    greeting(name) { const h = new Date().getHours(); return (h < 12 ? 'Good morning, ' : h < 18 ? 'Good afternoon, ' : 'Good evening, ') + name.split(' ')[0]; },
    flash(msg) { try { sessionStorage.setItem('aurelia-flash', msg); } catch (e) { } },
    takeFlash() { try { const m = sessionStorage.getItem('aurelia-flash'); sessionStorage.removeItem('aurelia-flash'); return m || ''; } catch (e) { return ''; } }
  };
})();
