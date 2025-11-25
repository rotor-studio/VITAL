const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;
const markersLayer = document.getElementById('markers');
const totalCountEl = document.getElementById('totalCount');
const characterStackEl = document.getElementById('characterStack');
const genderPalette = { man: '#4f9cff', woman: '#ff557d', nonbinary: '#f4f1d0', no_answer: '#bbbbbb' };
let backgroundHidden = false;
let characterScoreTimer;
let currentCharacterSnapshot = '';

async function fetchPoints() {
  try {
    const res = await fetch('/api/visual/points', { cache: 'no-store' });
    if (!res.ok) throw new Error('Network');
    const data = await res.json();
    renderPoints(data.points || []);
    renderCharacters(data.characters || []);
  } catch (err) {
    console.error('Error cargando puntos', err);
    totalCountEl.textContent = 'No se pudieron cargar los datos.';
    renderCharacters([]);
  }
}

function renderPoints(points) {
  markersLayer.innerHTML = '';
  if (!points.length) {
    totalCountEl.textContent = 'Sin respuestas mapeadas';
    return;
  }
  const counts = points.map(p => p.count || 0);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const minSize = 50;
  const maxSize = 160;
  let total = 0;
  points.forEach(point => {
    total += point.count || 0;
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.dataset.postal = point.codigo_postal;
    marker.style.left = `${(point.x / BASE_WIDTH) * 100}%`;
    marker.style.top = `${(point.y / BASE_HEIGHT) * 100}%`;
    const size = scaleSize(point.count || 1, minCount, maxCount, minSize, maxSize);

    const core = document.createElement('div');
    core.className = 'core';
    core.style.width = `${size}px`;
    core.style.height = `${size}px`;
    core.style.background = 'rgba(34, 197, 94, 0.7)';
    core.style.boxShadow = '0 0 25px rgba(34,197,94,0.5)';
    core.textContent = `${point.label}
(${point.count})`;
    marker.appendChild(core);

    const coreRadius = size / 2;
    core.dataset.radius = coreRadius;
    renderGenderNodes(marker, point, coreRadius);

    markersLayer.appendChild(marker);
  });
  totalCountEl.textContent = `${total} respuestas mapeadas (${points.length} códigos postales)`;
}

function renderCharacters(characters = []) {
  if (!characterStackEl) return;
  const snapshot = JSON.stringify(characters);
  const hasChanged = snapshot !== currentCharacterSnapshot;
  const isFirstRender = currentCharacterSnapshot === '';
  currentCharacterSnapshot = snapshot;
  const renderContent = () => {
    characterStackEl.innerHTML = '';
    if (characterScoreTimer) {
      clearInterval(characterScoreTimer);
      characterScoreTimer = null;
    }
    if (!characters.length) {
      const empty = document.createElement('p');
      empty.className = 'character-stack__empty';
      empty.textContent = 'Sin menciones registradas.';
      characterStackEl.appendChild(empty);
      characterStackEl.classList.remove('stack-folding');
      return;
    }
    buildCharacterCards(characters);
    cycleCharacterScores();
    characterStackEl.classList.remove('stack-folding');
  };
  if (!hasChanged || isFirstRender) {
    renderContent();
    return;
  }
  collapseCharacterStack().then(() => {
    renderContent();
    requestAnimationFrame(() => {
      characterStackEl.classList.remove('stack-folding');
    });
  });
}

function buildCharacterCards(characters) {
  const counts = characters.map((c) => c.count || 0);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  const stackHeight = characterStackEl.clientHeight || 420;
  const cardHeight = 280;
  const raiseRange = Math.max(stackHeight - cardHeight - 10, 30);

  characters.forEach((character, index) => {
    const card = document.createElement('div');
    card.className = 'character-card';
    const prominence =
      maxCount === minCount ? 0.5 : (character.count - minCount) / (maxCount - minCount);
    let bottomPos = prominence * raiseRange + index * 8;
    bottomPos = clamp(bottomPos, 0, raiseRange + 40);
    const xShift = Math.max(-10, Math.min(index * -2.5, 0));
    const rotation = (index - characters.length / 2) * 0.6;

    card.style.bottom = `${bottomPos}px`;
    card.style.setProperty('--deck-x', `${xShift}px`);
    card.style.setProperty('--deck-rot', `${rotation}deg`);
    card.style.setProperty('--deck-z', characters.length - index);

    if (character.image) {
      const img = document.createElement('img');
      img.src = character.image;
      img.alt = character.label;
      img.loading = 'lazy';
      card.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'character-placeholder';
      placeholder.textContent = characterInitials(character.label);
      card.appendChild(placeholder);
    }

    const name = document.createElement('div');
    name.className = 'character-name';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'character-label';
    labelSpan.textContent = character.label;
    const countSpan = document.createElement('span');
    countSpan.className = 'character-count';
    const countText = `${character.count} ${character.count === 1 ? 'voto' : 'votos'}`;
    countSpan.textContent = countText;
    name.appendChild(labelSpan);
    name.appendChild(countSpan);
    card.appendChild(name);

    const score = document.createElement('div');
    score.className = 'character-score';
    score.textContent = 'Destacado';
    card.appendChild(score);
    characterStackEl.appendChild(card);
  });
}

function characterInitials(label = '') {
  if (!label) return '??';
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function cycleCharacterScores() {
  const cards = Array.from(characterStackEl.querySelectorAll('.character-card'));
  if (!cards.length) {
    return;
  }
  let activeIndex = 0;
  const highlight = () => {
    cards.forEach((card) => card.classList.remove('show-score'));
    cards[activeIndex].classList.add('show-score');
    activeIndex = (activeIndex + 1) % cards.length;
  };
  highlight();
  characterScoreTimer = setInterval(highlight, 3500);
}

function renderGenderNodes(marker, point, coreRadius) {
  const genders = point.genders || [];
  if (!genders.length) return;
  const baseGap = 30;
  const step = (Math.PI * 2) / genders.length;
  genders.forEach((gender, index) => {
    const angle = index * step;
    const quantity = getGenderCount(point, gender);
    const nodeSize = Math.max(24, Math.min(60, quantity * 12));
    const nodeRadius = nodeSize / 2;
    const orbit = coreRadius + nodeRadius + baseGap;
    const offsetX = Math.cos(angle) * orbit;
    const offsetY = Math.sin(angle) * orbit;

    const node = document.createElement('div');
    node.className = 'gender-node';
    node.textContent = genderLabel(gender, quantity);
    node.style.width = `${nodeSize}px`;
    node.style.height = `${nodeSize}px`;
    node.style.background = genderPalette[gender] || '#cccccc';
    node.style.left = '50%';
    node.style.top = '50%';
    node.style.setProperty('--tx', `${offsetX}px`);
    node.style.setProperty('--ty', `${offsetY}px`);
    node.dataset.angle = angle;
    node.dataset.orbit = orbit;
    node.dataset.nodeRadius = nodeRadius;
    marker.appendChild(node);

    const connector = document.createElement('div');
    connector.className = 'connector';
    connector.dataset.angle = angle;
    connector.dataset.core = coreRadius;
    connector.dataset.orbit = orbit;
    connector.dataset.nodeRadius = nodeRadius;
    const initialLength = Math.max(orbit - coreRadius - nodeRadius, 0);
    connector.style.left = '50%';
    connector.style.top = '50%';
    connector.style.height = `${initialLength}px`;
    connector.style.transform = `translate(-50%, -50%) rotate(${angle}rad) translateY(${coreRadius}px)`;
    marker.appendChild(connector);
  });
}

function genderLabel(gender, count) {
  const map = { man: 'Hombres', woman: 'Mujeres', nonbinary: 'No binario', no_answer: 'Sin datos' };
  return `${map[gender] || gender} (${count})`;
}

function getGenderCount(point, gender) {
  if (point.gender_counts && typeof point.gender_counts[gender] === 'number') {
    return point.gender_counts[gender];
  }
  return (point.responses || []).filter(r => r.payload?.genero === gender).length;
}

fetchPoints();
setInterval(fetchPoints, 15000);


let animationFrame;
function animateGenders() {
  const time = Date.now() * 0.001;
  const nodes = document.querySelectorAll('.gender-node');
  nodes.forEach(node => {
    const angle = parseFloat(node.dataset.angle || 0);
    const orbit = parseFloat(node.dataset.orbit || 0);
    const wobble = Math.sin(time + angle * 3) * 6;
    const tx = Math.cos(angle) * (orbit + wobble);
    const ty = Math.sin(angle) * (orbit + wobble);
    node.style.setProperty('--tx', `${tx}px`);
    node.style.setProperty('--ty', `${ty}px`);
  });
  const connectors = document.querySelectorAll('.connector');
  connectors.forEach(connector => {
    const angle = parseFloat(connector.dataset.angle || 0);
    const core = parseFloat(connector.dataset.core || 0);
    const orbit = parseFloat(connector.dataset.orbit || 0);
    const nodeRadius = parseFloat(connector.dataset.nodeRadius || 0);
    const wobble = Math.sin(time + angle * 3) * 6;
    const animatedOrbit = orbit + wobble;
    const length = Math.max(animatedOrbit - core - nodeRadius, 0);
    connector.style.height = `${length}px`;
    connector.style.left = '50%';
    connector.style.top = '50%';
    connector.style.transform = `translate(-50%, -50%) rotate(${angle}rad) translateY(${core}px)`;
  });
  animationFrame = requestAnimationFrame(animateGenders);
}
animateGenders();

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm') {
    backgroundHidden = !backgroundHidden;
    document.body.classList.toggle('map-hidden', backgroundHidden);
  }
});


function scaleSize(count, minCount, maxCount, minSize, maxSize) {
  if (maxCount === minCount) return (minSize + maxSize) / 2;
  const ratio = (count - minCount) / (maxCount - minCount);
  return minSize + ratio * (maxSize - minSize);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function collapseCharacterStack() {
  return new Promise((resolve) => {
    characterStackEl.classList.add('stack-folding');
    setTimeout(resolve, 500);
  });
}
