const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTRE = 500;
// Real dartboard proportions, in mm from the centre.
const SCALE = 430 / 170;
const RINGS = {
  SingleInner: [15.9, 99],
  Triple: [99, 107],
  SingleOuter: [107, 162],
  Double: [162, 170],
};
const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const SEGMENT_DEGREES = 18;
const NUMBER_RADIUS = 466;

export const BOARD_RADIUS_SHARE = 430 / 500;

export function svgEl(name, attrs = {}, parent) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  parent?.appendChild(el);
  return el;
}

function polar(radius, degrees) {
  const radians = (degrees - 90) * (Math.PI / 180);
  return [CENTRE + radius * Math.cos(radians), CENTRE + radius * Math.sin(radians)];
}

function segmentPath(inner, outer, start, end) {
  const [ax, ay] = polar(outer, start);
  const [bx, by] = polar(outer, end);
  const [cx, cy] = polar(inner, end);
  const [dx, dy] = polar(inner, start);
  return `M${ax} ${ay} A${outer} ${outer} 0 0 1 ${bx} ${by} L${cx} ${cy} A${inner} ${inner} 0 0 0 ${dx} ${dy} Z`;
}

// The middle of a zone in SVG units, from a zone id such as "Triple-20".
export function zoneCentre(zone) {
  if (zone === 'InnerBull') return [CENTRE, CENTRE];
  if (zone === 'OuterBull') return polar(11 * SCALE, 0);
  const [bed, number] = zone.split('-');
  const [inner, outer] = RINGS[bed];
  return polar(((inner + outer) / 2) * SCALE, NUMBERS.indexOf(Number(number)) * SEGMENT_DEGREES);
}

// Draws the board. Classes are named from `prefix`, so each game can style its own.
export function buildDartboard(prefix, label, { medallions = false } = {}) {
  const svg = svgEl('svg', { viewBox: '0 0 1000 1000', role: 'img', 'aria-label': label });
  svgEl('circle', { class: `${prefix}-backing`, cx: CENTRE, cy: CENTRE, r: 498 }, svg);
  const zones = {};

  NUMBERS.forEach((number, index) => {
    const start = index * SEGMENT_DEGREES - SEGMENT_DEGREES / 2;
    const end = start + SEGMENT_DEGREES;
    for (const [bed, [inner, outer]] of Object.entries(RINGS)) {
      const isSingle = bed === 'SingleInner' || bed === 'SingleOuter';
      const shade = (index % 2 === 0) === isSingle ? 'dark' : 'light';
      const kind = isSingle ? 'single' : 'ring';
      zones[`${bed}-${number}`] = svgEl('path', {
        class: `${prefix}-zone ${prefix}-${shade} ${prefix}-${kind}`,
        d: segmentPath(inner * SCALE, outer * SCALE, start, end),
      }, svg);
    }
    const [x, y] = polar(NUMBER_RADIUS, index * SEGMENT_DEGREES);
    if (medallions) svgEl('circle', { class: `${prefix}-medallion`, cx: x, cy: y, r: 27 }, svg);
    const text = svgEl('text', { class: `${prefix}-number`, x, y }, svg);
    text.textContent = number;
  });

  zones.OuterBull = svgEl('circle', { class: `${prefix}-zone ${prefix}-light ${prefix}-ring`, cx: CENTRE, cy: CENTRE, r: 15.9 * SCALE }, svg);
  zones.InnerBull = svgEl('circle', { class: `${prefix}-zone ${prefix}-dark ${prefix}-ring`, cx: CENTRE, cy: CENTRE, r: 6.35 * SCALE }, svg);
  return { svg, zones };
}
