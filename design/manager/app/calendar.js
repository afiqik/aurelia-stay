/* AURELIA STAY — Hotel Manager portal: month calendar of arrivals/departures with a day detail list. */
export function calendarVals(v, x) {
  const { S, c, st, db, T, bVM } = x;
  const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth() + st.calOff, 1);
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); const lead = (first.getDay() + 6) % 7;
  const sel = st.calSel || T; const cells = []; const live = db.bookings.filter(b => b.status !== 'CANCELLED');
  for (let i = 0; i < lead; i++) cells.push({ blank: true, vis: 'hidden', day: '', mark: '', border: 'transparent', bg: 'transparent', fg: '#4E1617', weight: 400 });
  for (let d = 1; d <= daysIn; d++) {
    const iso = S.isoOf(new Date(first.getFullYear(), first.getMonth(), d));
    const ins = live.filter(b => b.checkIn === iso).length, outs = live.filter(b => b.checkOut === iso).length;
    const isSel = iso === sel, isT = iso === T;
    cells.push({ day: d, mark: ins || outs ? ins + '↓ ' + outs + '↑' : '', aria: S.fmtDate(iso) + ': ' + ins + ' check-ins, ' + outs + ' check-outs', vis: 'visible', blank: false, border: isT ? '#174C38' : 'rgba(78,22,23,.12)', bg: isSel ? '#174C38' : '#FFFFFF', fg: isSel ? '#F1D7A5' : '#4E1617', weight: isT ? 700 : 500, onClick: () => c.setState({ calSel: iso }) });
  }
  const dIn = live.filter(b => b.checkIn === sel), dOut = live.filter(b => b.checkOut === sel), stays = live.filter(b => b.checkIn <= sel && b.checkOut > sel);
  v.cal = { title: first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), dow: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], cells, selTitle: S.fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' }), ins: dIn.length, outs: dOut.length, stays: stays.length, list: dIn.map(b => ({ kind: 'Check-in', ...bVM(b) })).concat(dOut.map(b => ({ kind: 'Check-out', ...bVM(b) }))) };
  v.calEmpty = !v.cal.list.length;
  v.calPrev = () => c.setState(s => ({ calOff: s.calOff - 1 })); v.calNext = () => c.setState(s => ({ calOff: s.calOff + 1 }));
}
