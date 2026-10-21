/* AURELIA STAY — Hotel Manager portal: static tables shared by every module (page links, room-status chips). */
export const F = { dashboard: 'Dashboard.dc.html', reservations: 'Reservations.dc.html', reservation: 'Reservation%20Details.dc.html', 'check-ins': 'Check-ins.dc.html', 'check-outs': 'Check-outs.dc.html', rooms: 'Rooms.dc.html', room: 'Room%20Details.dc.html', housekeeping: 'Housekeeping.dc.html', maintenance: 'Maintenance.dc.html', guests: 'Guests.dc.html', guest: 'Guest%20Profile.dc.html', calendar: 'Calendar.dc.html', 'walk-in': 'Walk-in%20Booking.dc.html', reports: 'Reports.dc.html', activity: 'Activity.dc.html', notifications: 'Notifications.dc.html', profile: 'Profile.dc.html' };
export const RC = { AVAILABLE: ['Available', '#DCE8E1', '#174C38'], RESERVED: ['Reserved', '#F3E6C8', '#5E400C'], OCCUPIED: ['Occupied', '#4E1617', '#F1D7A5'], CLEANING: ['Cleaning', '#E2E2E2', '#333333'], MAINTENANCE: ['Maintenance', '#EBD9D8', '#8A1F21'], OUT_OF_SERVICE: ['Out of service', '#3A3A3A', '#F2F2F2'] };
export const SHORT = { 1: 'Single', 2: 'Double', 3: 'Deluxe', 4: 'Family' };
export const ROOM_STATES = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE'];
export const rchip = s => { const c = RC[s] || RC.AVAILABLE; return { label: c[0], bg: c[1], fg: c[2] }; };
export const rlabel = s => (RC[s] || RC.AVAILABLE)[0];
