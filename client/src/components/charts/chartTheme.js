/** Shared chart tokens so every visualisation uses the product palette. */
export const CHART = {
  jade: '#2FA37A',
  jadeSoft: '#43BE92',
  coral: '#E8663C',
  gold: '#C9A227',
  ivory: '#F3EFE6',
  mist: '#66707C',
  grid: 'rgba(255,255,255,0.06)',
  axis: '#8A94A0',
};

export const AXIS_PROPS = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 11, fontFamily: '"DM Sans", sans-serif' },
  tickLine: false,
  axisLine: false,
};

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#141922',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 14,
    fontSize: 12,
    fontFamily: '"DM Sans", sans-serif',
    boxShadow: '0 18px 40px -24px rgba(0,0,0,0.9)',
  },
  labelStyle: { color: '#A8A294', marginBottom: 4 },
  itemStyle: { color: '#F3EFE6' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};
