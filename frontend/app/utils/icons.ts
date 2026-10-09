// One consistent line icon set: 20×20 grid, 1.5px stroke, round joins.
export const icons = {
  check: 'M4.5 10.5l3.5 3.5 7.5-8',
  x: 'M5 5l10 10M15 5L5 15',
  alert: 'M10 3l8 14H2zM10 8.5v4M10 14.8v.2',
  info: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM10 9v5M10 6.2v.2',
  'check-circle': 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM6.8 10.2l2.2 2.2 4.2-4.6',
  eye: 'M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10zM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  'eye-off': 'M3 3l14 14M8.2 5a8.6 8.6 0 0 1 1.8-.5c5.2 0 8.2 5.5 8.2 5.5a14 14 0 0 1-2.4 3.1M5.6 6.4C3.1 8 1.8 10 1.8 10s3 5.5 8.2 5.5a8 8 0 0 0 3.7-.9M8.3 8.3a2.5 2.5 0 0 0 3.4 3.4',
  copy: 'M7 7h10v10H7zM13 7V3H3v10h4',
  sun: 'M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6L16 16M4 16l1.4-1.4M14.6 5.4L16 4',
  moon: 'M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9z',
  monitor: 'M2.5 3.5h15v10h-15zM7 17h6M10 13.5V17',
  globe: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM2.5 10h15M10 2.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5z',
  'chevron-end': 'M7.5 4.5L13 10l-5.5 5.5',
  'chevron-down': 'M5 7.5l5 5 5-5',
  'arrow-end': 'M4 10h12M11 5l5 5-5 5',
  key: 'M6.5 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM9 11l7.5-7.5M14 6l2 2M12 8l1.5 1.5',
  mail: 'M2.5 4.5h15v11h-15zM2.5 5l7.5 6 7.5-6',
  inbox: 'M2 11.5l2.5-8h11l2.5 8v5H2zM2 11.5h5l1.2 2h3.6l1.2-2h5',
} as const

export type IconName = keyof typeof icons

// Icons that point "forward" or "backward" and must be mirrored in right-to-left languages.
export const directionalIcons: ReadonlySet<IconName> = new Set(['chevron-end', 'arrow-end'])
