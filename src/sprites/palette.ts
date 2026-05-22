// Shared color palette for all pixel-art pet sprites. Single-character keys
// keep each row of a sprite legible at a glance. Use lowercase for the base
// shade and uppercase for the darker shade of the same color family.
export const PALETTE: Record<string, string> = {
  '.': 'transparent',
  k: '#1a1a1a', // outline black
  K: '#3d2c1f', // very dark brown
  w: '#ffffff',
  g: '#9aa0a8', // gray
  G: '#5f6670', // dark gray
  S: '#dcdfe4', // silver / light gray
  b: '#a06641', // brown
  B: '#6e3f23', // dark brown
  t: '#d6ad7a', // tan
  T: '#a3784a', // dark tan
  o: '#ff9636', // orange
  O: '#c95d18', // dark orange
  y: '#ffd24d', // yellow
  Y: '#caa028', // dark yellow / gold
  r: '#e3433d', // red
  R: '#8c2222', // dark red
  p: '#ffa2c4', // pink
  P: '#a05dd6', // purple
  Q: '#6f3aa8', // dark purple
  l: '#8de07c', // green
  L: '#4a8a3a', // dark green
  c: '#7fc6ff', // cyan
  C: '#2a72c9', // dark blue
  N: '#1c4682', // navy
  s: '#f0c7a4', // skin
  H: '#b88860', // dark skin
  E: '#ff6688', // hot pink (mermaid hair)
};
