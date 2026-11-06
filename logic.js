export function hitTest(target, x, y) {
  return (
    ((x - target.x) / target.rx) ** 2 + ((y - target.y) / target.ry) ** 2 <= 1
  );
}
export function remainingSeconds(deadline, now) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function shuffled(length, random = Math.random) {
  const a = Array.from({ length }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
