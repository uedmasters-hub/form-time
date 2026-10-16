export const theme = {
  colors: {
    background: '#F4F0E7',
    paper: '#FBF9F3',
    ink: '#282823',
    muted: '#77746C',
    line: '#DCD6CA',

    red: '#D9362B',
    yellow: '#F2C94C',
    blue: '#2859A6',
    white: '#FFFFFF',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 20,
    pill: 999,
  },

  typography: {
    fontFamily: 'Inter',
    sizes: {
      xs: 11,
      sm: 13,
      md: 16,
      lg: 20,
      xl: 32,
      display: 58,
    },
  },
} as const;
