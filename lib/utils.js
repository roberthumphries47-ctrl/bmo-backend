export const todayDate = (d = new Date()) => d.toISOString().slice(0,10);
export const clampDay = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : todayDate());
