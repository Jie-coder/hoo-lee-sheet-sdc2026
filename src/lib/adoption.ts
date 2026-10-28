// The AI adoption speed slider. Its value is passed as the `adoption`
// argument of rankScore in src/lib/scoring.ts:
//   rankScore(fit, momentum, adoption) =
//     fit × (1 + trendBeta · tanh(adoption × roleMomentum))
// It is NOT applied to skill-level momentum, so nothing is counted twice.
// A value of 1 reproduces the default output. This is an estimate, not a
// forecast.
export const ADOPTION_SPEED = { min: 0.5, max: 2, default: 1, step: 0.25 } as const;

export function clampAdoptionSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return ADOPTION_SPEED.default;
  return Math.min(ADOPTION_SPEED.max, Math.max(ADOPTION_SPEED.min, speed));
}
