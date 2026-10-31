// Number pad for entering a dart by hand: pick a bed, then tap the number.
export function buildPad(container, sendDart, modifiers, extras) {
  container.classList.add('pad');
  const defaultBed = modifiers[0][0];
  let selectedBed = defaultBed;

  const button = (text, onClick) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn';
    el.textContent = text;
    el.addEventListener('click', onClick);
    return el;
  };

  const modifierRow = document.createElement('div');
  modifierRow.className = 'pad-row';
  modifierRow.style.gridTemplateColumns = `repeat(${modifiers.length}, minmax(0, 1fr))`;
  const modifierButtons = modifiers.map(([bed, text]) => {
    const el = button(text, () => selectBed(bed));
    el.dataset.bed = bed;
    return el;
  });
  function selectBed(bed) {
    selectedBed = bed;
    for (const el of modifierButtons) {
      const on = el.dataset.bed === bed;
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on);
    }
  }
  modifierRow.append(...modifierButtons);
  // With only one bed, there's nothing to choose.
  modifierRow.hidden = modifiers.length === 1;
  selectBed(defaultBed);

  const numbers = document.createElement('div');
  numbers.className = 'pad-numbers';
  for (let number = 1; number <= 20; number++) {
    numbers.appendChild(button(number, () => {
      sendDart({ bed: selectedBed, number });
      selectBed(defaultBed);
    }));
  }

  const extraRow = document.createElement('div');
  extraRow.className = 'pad-row';
  extraRow.style.gridTemplateColumns = `repeat(${extras.length}, minmax(0, 1fr))`;
  extraRow.append(...extras.map(([bed, text]) => button(text, () => sendDart({ bed }))));

  container.append(modifierRow, numbers, extraRow);
}
