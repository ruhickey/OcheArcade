// Stand-in for the Autodarts Board Manager, for developing without throwing darts.
//   node sim/board.js          manual: GET /throw?bed=Triple&n=20, /throw?bed=InnerBull, /clear
//                              add &r=0.3 to set the distance from the bull (1 is the edge of the doubles)
//   node sim/board.js --auto   throws a random dart every couple of seconds
import { createServer } from 'node:http';

const PORT = Number(process.env.SIM_PORT ?? 3181);
const BEDS = ['SingleOuter', 'SingleOuter', 'SingleInner', 'Triple', 'Double', 'OuterBull', 'InnerBull', 'Miss'];
const RADIUS = { InnerBull: 0.02, OuterBull: 0.065, SingleInner: 0.3, Triple: 0.6, SingleOuter: 0.8, Double: 0.98, Miss: 1.2 };
let throws = [];
let running = true;
let status = 'throw';

function makeThrow(bed, number = 1 + Math.floor(Math.random() * 20), radius = RADIUS[bed] ?? 0.8) {
  const angle = Math.random() * Math.PI * 2;
  const base = { bouncer: false, failed: false, method: 'Simulator', coordsX: Math.cos(angle) * radius, coordsY: Math.sin(angle) * radius };
  if (bed === 'InnerBull') return { ...base, bed: 'Double', multiplier: 2, segmentName: 'Bull', segmentNumber: 25 };
  if (bed === 'OuterBull') return { ...base, bed: 'SingleOuter', multiplier: 1, segmentName: '25', segmentNumber: 25 };
  if (bed === 'Miss') return { ...base, bed: 'Outside', multiplier: 0, segmentName: `M${number}`, segmentNumber: number };
  const multiplier = bed === 'Triple' ? 3 : bed === 'Double' ? 2 : 1;
  const prefix = bed === 'Triple' ? 'T' : bed === 'Double' ? 'D' : 'S';
  return { ...base, bed, multiplier, segmentName: `${prefix}${number}`, segmentNumber: number };
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // The same commands and verbs as the real Board Manager.
  const command = `${req.method} ${url.pathname}`;
  if (command === 'PUT /api/start') {
    running = true;
    status = 'throw';
  } else if (command === 'PUT /api/stop') {
    running = false;
    status = 'stopped';
  } else if (command === 'POST /api/reset') {
    throws = [];
  } else if (url.pathname.match(/^\/api\/(start|stop|reset)$/)) {
    res.writeHead(404).end();
    return;
  }
  if (url.pathname === '/throw') {
    const n = url.searchParams.get('n');
    const r = url.searchParams.get('r');
    throws.push(makeThrow(url.searchParams.get('bed') ?? 'SingleOuter', n ? Number(n) : undefined, r ? Number(r) : undefined));
  } else if (url.pathname === '/clear') {
    throws = [];
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ connected: true, running, status: status === 'throw' && throws.length >= 3 ? 'takeout' : status, throws }));
}).listen(PORT, () => console.log(`Simulated board on port ${PORT}`));

if (process.argv.includes('--auto')) {
  setInterval(() => {
    if (throws.length >= 3) throws = [];
    else throws.push(makeThrow(BEDS[Math.floor(Math.random() * BEDS.length)]));
  }, 2000);
}
