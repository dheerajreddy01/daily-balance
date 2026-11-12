export const tiltFor = (net: number): number => Math.max(-11, Math.min(11, net * 0.7));

// Heavier weights are taller and a little wider, but always fit inside one peg gap.
export const weightSize = (w: number) => ({ h: 20 + w * 3.4, top: 11 + w * 0.9, base: 17 + w * 1.15 });
