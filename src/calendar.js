// The island calendar: what season it is, whether today is special, and
// where the real-world clock stands. No imports — everything else can
// safely consult this at module load.

export function seasonOf(d = new Date()) {
  const m = d.getMonth(); // 0–11
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export function holidayOf(d = new Date()) {
  const m = d.getMonth() + 1, day = d.getDate();
  if (m === 1 && day === 1) return { id: 'newyear', name: 'New Year’s Day' };
  if (m === 5 && day === 1) return { id: 'mayday', name: 'May Day' };
  if (m === 6 && day === 21) return { id: 'bellday', name: 'Bell Day' };
  if (m === 10 && day === 31) return { id: 'spooky', name: 'Spooky Eve' };
  if (m === 12 && day >= 21 && day <= 26) return { id: 'frost', name: 'the Frost Festival' };
  return null;
}

// Baked at load — the island commits to a season for the whole sitting.
export const SEASON = seasonOf();
export const HOLIDAY = holidayOf();

export function hourNow() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

// 0 at deep night → 1 at high noon, smooth. The sun keeps real hours.
export function dayFactor(h = hourNow()) {
  return Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
}

export function isNight(h = hourNow()) {
  return dayFactor(h) < 0.08;
}

// Lines the villagers share on a holiday, and Pip's one-off gift note.
export const HOLIDAY_LINES = {
  newyear: 'Happy New Year! The island counts years in winters survived and naps taken. We are doing wonderfully on both.',
  mayday: 'Happy May Day! Clover has organized a flower count. The flowers, reportedly, are also counting us.',
  bellday: 'It’s Bell Day. The day the bell went under. We don’t mourn it, exactly — we just listen a little harder today.',
  spooky: 'Spooky Eve! The pumpkins are out. One of them is judging you. We don’t know which. That’s the spooky part.',
  frost: 'Happy Frost Festival! Lights on every branch, so the dark stays cozy instead of just dark.',
};
