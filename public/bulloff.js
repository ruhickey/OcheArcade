const $ = (id) => document.getElementById(id);
// The feed's unit distance is the edge of the doubles, 170 mm from the bull.
const MM_PER_UNIT = 170;

function describe(distance) {
  return distance === null ? 'No distance' : `${Math.round(distance * MM_PER_UNIT)} mm`;
}

// After a tie, show the dart that is deciding it.
const latest = (entrant) => (entrant.throws.length ? entrant.throws.at(-1) : undefined);

function entrantRow(entrant, index, rank, isCurrent) {
  const row = document.createElement('li');
  row.className = isCurrent ? 'score current' : 'score';
  const swatch = document.createElement('span');
  swatch.className = `swatch swatch-${index}`;
  const name = document.createElement('span');
  name.className = 'score-name';
  name.textContent = rank ? `${rank}. ${entrant.name}` : entrant.name;
  const value = document.createElement('span');
  value.className = 'score-pos';
  const distance = latest(entrant);
  value.textContent = distance === undefined ? '–' : describe(distance);
  row.append(swatch, name, value);
  return row;
}

function sideLabel(players, side, label) {
  const names = players.filter((p) => p.side === side).map((p) => p.name).join(' & ');
  const box = document.createElement('div');
  box.className = 'bull-team';
  const heading = document.createElement('span');
  heading.className = 'eyebrow';
  heading.textContent = label;
  box.append(heading, names);
  return box;
}

export function renderBullOff(setup, canUndo, sendDart) {
  const { bullOff, preview } = setup;
  const done = bullOff.phase === 'done';
  const currentIndex = done ? null : bullOff.queue[bullOff.position];
  const current = done ? null : bullOff.entrants[currentIndex];
  const tieBreak = bullOff.round > 1;

  $('bull-eyebrow').textContent = tieBreak && !done ? 'Tie: throw again' : 'Throw for the bull';
  $('bull-title').textContent = done ? `${preview[0].name} goes first` : current.name;

  if (done) $('bull-message').textContent = 'Closest to the bull throws first.';
  else if (bullOff.phase === 'takeout') $('bull-message').textContent = `${describe(bullOff.last.distance)} from the bull. Take your dart out.`;
  else $('bull-message').textContent = 'One dart. Closest to the bull goes first.';

  const rows = done
    ? bullOff.ranking.map((i, rank) => entrantRow(bullOff.entrants[i], i, rank + 1, false))
    : bullOff.entrants.map((entrant, i) => entrantRow(entrant, i, null, i === currentIndex));
  $('bull-entrants').replaceChildren(...rows);

  const teams = $('bull-teams');
  const hasSides = done && preview[0].side;
  teams.hidden = !hasSides;
  if (hasSides) {
    teams.replaceChildren(sideLabel(preview, 'left', 'Left side'), sideLabel(preview, 'right', 'Right side'));
  }

  const hand = $('bull-hand');
  hand.hidden = done;
  if (!done && !hand.childElementCount) {
    const heading = document.createElement('p');
    heading.className = 'eyebrow';
    heading.textContent = 'Tap to enter a dart by hand';
    hand.appendChild(heading);
    for (const [bed, label] of [['InnerBull', 'Inner Bull'], ['OuterBull', 'Outer Bull'], ['Miss', 'Off the bull']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = label;
      button.addEventListener('click', () => sendDart({ bed }));
      hand.appendChild(button);
    }
  }
  hand.querySelectorAll('button').forEach((button) => {
    button.disabled = bullOff.phase !== 'throwing';
  });

  $('bull-start').hidden = !done;
  $('bull-next').hidden = done;
  $('bull-next').disabled = bullOff.phase !== 'takeout';
  $('bull-undo').disabled = !canUndo;
}
