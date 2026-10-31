// Painted sprites live in public/art, and anything that only appears mid-game is loaded up front.
export const art = (name) => `/art/${name}.webp`;

export function preload(...names) {
  for (const name of names) new Image().src = art(name);
}

export function sprite(name, className) {
  const img = document.createElement('img');
  img.src = art(name);
  img.className = className;
  img.alt = '';
  img.draggable = false;
  return img;
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
