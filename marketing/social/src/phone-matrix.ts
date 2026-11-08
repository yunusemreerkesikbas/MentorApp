// The 3D phone render has a transparent screen. The coded screen (378×822, radius 48) is
// mapped onto it with this matrix3d, fitted by art-source.local/social/tools/screen_fit.py
// for the phone drawn 470 px wide.
export const PHONE = { width: 470, height: 922, screenWidth: 378, screenHeight: 822, radius: 48 } as const;

export const BASE_MATRIX = [
  0.926732, -0.132632, 0, -0.000239064,
  -0.00727675, 0.991384, 0, 2.01634e-5,
  0, 0, 1, 0,
  31.403, 65.0484, 0, 1,
];

// Scaling the phone by k scales the x/y output rows (entries 0,1,4,5,12,13); perspective stays.
const SCALED = new Set([0, 1, 4, 5, 12, 13]);

export const screenMatrix = (phoneWidth: number): string => {
  const k = phoneWidth / PHONE.width;
  return `matrix3d(${BASE_MATRIX.map((v, i) => (SCALED.has(i) ? v * k : v)).join(", ")})`;
};
