import { describe, expect, it } from 'vitest';
import { blocksFor, computeSlots, nearestSlots, pickBarber, slotStartsFor, type AvailabilityInput, type BarberInput } from '../shared/slots';
import { localDate, localTime, zonedToUtc, weekdayOf } from '../shared/time';
import { canTransition, generateBookingCode, normalizePhone, CODE_ALPHABET } from '../shared/booking';

// Senin 19 Oktober 2026, 06.00 WIB (jauh sebelum jam buka)
const NOW = Date.parse('2026-10-18T23:00:00Z');
const DATE = '2026-10-19';

const barber = (id: number, working = [{ start: '10:00', end: '13:00' }, { start: '14:00', end: '21:00' }], extra: Partial<BarberInput> = {}): BarberInput => ({
  id,
  sortOrder: id * 10,
  working,
  timeOff: [],
  busy: new Set(),
  bookingsThatDay: 0,
  ...extra,
});

const base = (o: Partial<AvailabilityInput> = {}): AvailabilityInput => ({
  date: DATE,
  timezone: 'Asia/Jakarta',
  branchHours: { open: '10:00', close: '21:00' },
  branchTimeOff: [],
  barbers: [barber(1)],
  durationMin: 45,
  bufferMin: 10,
  now: NOW,
  leadMin: 60,
  maxDays: 14,
  ...o,
});

const times = (o: Partial<AvailabilityInput> = {}) => computeSlots(base(o)).map((s) => s.time);

describe('waktu & zona waktu', () => {
  it('jam lokal ↔ UTC', () => {
    expect(new Date(zonedToUtc(DATE, 10 * 60, 'Asia/Jakarta')).toISOString()).toBe('2026-10-19T03:00:00.000Z');
    expect(new Date(zonedToUtc(DATE, 10 * 60, 'Asia/Makassar')).toISOString()).toBe('2026-10-19T02:00:00.000Z');
    expect(new Date(zonedToUtc(DATE, 10 * 60, 'Asia/Jayapura')).toISOString()).toBe('2026-10-19T01:00:00.000Z');
    expect(localTime(Date.parse('2026-10-19T03:00:00Z'), 'Asia/Jakarta')).toBe('10:00');
    expect(localDate(Date.parse('2026-10-19T18:00:00Z'), 'Asia/Jayapura')).toBe('2026-10-20');
    expect(weekdayOf(DATE)).toBe(1);
  });
});

describe('mesin slot', () => {
  it('langkah 15 menit, istirahat siang tidak tersedia, layanan selesai sebelum jam kerja berakhir', () => {
    const t = times();
    expect(t[0]).toBe('10:00');
    expect(t).toContain('12:15'); // 12:15 + 45 = 13:00 tepat
    expect(t).not.toContain('12:30'); // selesai 13:15 → melewati istirahat
    expect(t).not.toContain('13:00');
    expect(t).toContain('14:00');
    expect(t[t.length - 1]).toBe('20:15'); // 20:15 + 45 = 21:00
    expect(t).not.toContain('20:30');
    expect(t.every((x) => Number(x.slice(3)) % 15 === 0)).toBe(true);
  });

  it('layanan lebih panjang dari sisa jam kerja tidak ditawarkan', () => {
    const t = times({ durationMin: 180 }); // Highlight/Bleaching
    expect(t).toEqual(['10:00', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45', '18:00']);
    // Pagi 10.00–13.00 hanya 180 menit: muat tepat
    expect(times({ durationMin: 180, barbers: [barber(1, [{ start: '10:00', end: '13:00' }])] })).toEqual(['10:00']);
    expect(times({ durationMin: 181 / 1, barbers: [barber(1, [{ start: '10:00', end: '13:00' }])] })).toEqual([]);
  });

  it('jam kerja barber dipotong jam buka cabang', () => {
    const t = times({ branchHours: { open: '13:00', close: '21:00' } }); // Jumat
    expect(t[0]).toBe('14:00');
    expect(times({ branchHours: null })).toEqual([]);
  });

  it('libur cabang (time off cabang) menutup seluruh hari', () => {
    const [start, end] = [zonedToUtc(DATE, 0, 'Asia/Jakarta'), zonedToUtc('2026-10-20', 0, 'Asia/Jakarta')];
    expect(times({ branchTimeOff: [{ start, end }] })).toEqual([]);
  });

  it('time off barber (mis. sakit 15.00–17.00) termasuk buffer', () => {
    const off = { start: zonedToUtc(DATE, 15 * 60, 'Asia/Jakarta'), end: zonedToUtc(DATE, 17 * 60, 'Asia/Jakarta') };
    const t = times({ barbers: [barber(1, undefined, { timeOff: [off] })] });
    expect(t).toContain('14:00'); // 14:00–14:55 (+buffer) selesai sebelum 15:00
    expect(t).not.toContain('14:15'); // buffer sampai 15:10 → bentrok
    expect(t).not.toContain('16:00');
    expect(t).toContain('17:00');
  });

  it('timezone non-WIB (WIT): jam lokal tetap sama, UTC berbeda', () => {
    const s = computeSlots(base({ timezone: 'Asia/Jayapura' }));
    expect(s[0].time).toBe('10:00');
    expect(s[0].startAt).toBe('2026-10-19T01:00:00.000Z');
  });

  it('batas lead time (≥ 60 menit dari sekarang)', () => {
    const now = zonedToUtc(DATE, 15 * 60 + 5, 'Asia/Jakarta'); // 15.05 WIB
    const t = times({ now });
    expect(t[0]).toBe('16:15'); // 15.05 + 60 = 16.05 → kelipatan 15 berikutnya
  });

  it('batas jumlah hari ke depan & tanggal lampau', () => {
    expect(times({ date: '2026-11-02' })).not.toEqual([]); // +14 hari
    expect(times({ date: '2026-11-03' })).toEqual([]); // +15 hari
    expect(times({ date: '2026-10-18' })).toEqual([]); // kemarin
  });

  it('booking aktif (blok 15 menit) menutup jam yang beririsan', () => {
    const busyStart = zonedToUtc(DATE, 15 * 60, 'Asia/Jakarta');
    const busy = new Set([0, 1, 2, 3].map((k) => busyStart + k * 15 * 60_000)); // 15:00–16:00
    const t = times({ barbers: [barber(1, undefined, { busy })] });
    expect(t).toContain('14:00');
    expect(t).not.toContain('14:15'); // 14:15–15:10 butuh blok 15:00
    expect(t).not.toContain('15:45');
    expect(t).toContain('16:00');
  });

  it('"Siapa saja" = gabungan semua barber; pilih yang paling sedikit booking, seri → urutan', () => {
    const s = computeSlots(base({ barbers: [barber(1, [{ start: '10:00', end: '12:00' }]), barber(2, [{ start: '11:00', end: '13:00' }])] }));
    expect(s.find((x) => x.time === '10:00')?.barberIds).toEqual([1]);
    expect(s.find((x) => x.time === '11:00')?.barberIds).toEqual([1, 2]);
    expect(s.find((x) => x.time === '12:00')?.barberIds).toEqual([2]);
    const roster = [
      { id: 1, sortOrder: 10, bookingsThatDay: 3 },
      { id: 2, sortOrder: 20, bookingsThatDay: 1 },
      { id: 3, sortOrder: 5, bookingsThatDay: 1 },
    ];
    expect(pickBarber([1, 2, 3], roster)).toBe(3);
    expect(pickBarber([1, 2], roster)).toBe(2);
  });

  it('blok slot yang dikunci = durasi + buffer dibulatkan ke 15 menit', () => {
    expect(blocksFor(45, 10)).toBe(4);
    expect(blocksFor(20, 10)).toBe(2);
    expect(slotStartsFor(Date.parse('2026-10-19T03:00:00Z'), 45, 10)).toEqual([
      '2026-10-19T03:00:00.000Z',
      '2026-10-19T03:15:00.000Z',
      '2026-10-19T03:30:00.000Z',
      '2026-10-19T03:45:00.000Z',
    ]);
  });

  it('3 slot terdekat', () => {
    const s = computeSlots(base());
    const near = nearestSlots(s, '2026-10-19T08:00:00.000Z').map((x) => x.time); // 15.00 WIB
    expect(near).toEqual(['14:45', '15:00', '15:15']);
  });
});

describe('aturan booking', () => {
  it('transisi status', () => {
    expect(canTransition('pending', 'confirmed', 'admin')).toBe(true);
    expect(canTransition('pending', 'confirmed', 'customer')).toBe(false);
    expect(canTransition('confirmed', 'cancelled', 'customer')).toBe(true);
    expect(canTransition('confirmed', 'no_show', 'barber')).toBe(true);
    expect(canTransition('cancelled', 'confirmed', 'admin')).toBe(false);
    expect(canTransition('completed', 'cancelled', 'admin')).toBe(false);
    expect(canTransition('pending', 'cancelled', 'system')).toBe(true);
  });

  it('kode booking 8 karakter tanpa O/0/I/1', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateBookingCode();
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
      expect(code).not.toMatch(/[O0I1L]/);
      expect([...code].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true);
    }
  });

  it('normalisasi nomor WhatsApp', () => {
    expect(normalizePhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizePhone('+62 812 3456 7890')).toBe('6281234567890');
    expect(normalizePhone('6281234567890')).toBe('6281234567890');
    expect(normalizePhone('812345678')).toBe('62812345678');
    expect(normalizePhone('021-555-1234')).toBeNull(); // bukan seluler
    expect(normalizePhone('0812')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});
