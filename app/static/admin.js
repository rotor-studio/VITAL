const ul = document.getElementById('pending');

const cTotal = document.getElementById('c-total');
const cApproved = document.getElementById('c-approved');
const cPending = document.getElementById('c-pending');
const cRejected = document.getElementById('c-rejected');
const lastEl = document.getElementById('last');

const btnExport = document.getElementById('btn-export');
const btnReset = document.getElementById('btn-reset');
let fieldOrder = [];
let fieldLabels = {};

// ---- Helpers ----
function minsAgo(iso) {
  if (!iso) return "—";
  const last = new Date(iso);
  const now = new Date();
  const diffMs = now - last;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "hace <1 min";
  if (mins === 1) return "hace 1 min";
  return `hace ${mins} min`;
}

async function fetchCounts() {
  const res = await fetch('/api/admin/counts', { cache: 'no-store' });
  const data = await res.json();
  cTotal.textContent = data.total;
  cApproved.textContent = data.approved;
  cPending.textContent = data.pending;
  cRejected.textContent = data.rejected;
  lastEl.textContent = `Última aprobación: ${minsAgo(data.last_approved_at)}`;
}

async function fetchPending() {
  const res = await fetch('/api/admin/pending', { cache: 'no-store' });
  const data = await res.json();
  ul.innerHTML = '';
  for (const r of data) {
    const li = document.createElement('li');
    li.className = 'moderation-card';
    li.innerHTML = `
      <div class="card-head">
        <strong>#${r.id}</strong>
        <span>${new Date(r.created_at).toLocaleString()}</span>
        <span>${r.payload?.__lang ? `Lang: ${r.payload.__lang}` : ''}</span>
        <span class="actions">
          <button data-id="${r.id}" data-a="approve">✔ Aprobar</button>
          <button data-id="${r.id}" data-a="reject">✖ Rechazar</button>
        </span>
      </div>
      <div class="card-body">
        ${renderPayload(r.payload)}
      </div>
    `;
    ul.appendChild(li);
  }
}

function renderPayload(payload = {}) {
  const pieces = [];
  const used = new Set();
  const keys = fieldOrder.length ? fieldOrder.slice() : Object.keys(payload);
  keys.forEach(key => {
    if (payload[key] === undefined) return;
    used.add(key);
    pieces.push(renderField(key, payload[key]));
  });
  Object.keys(payload).forEach(key => {
    if (used.has(key)) return;
    pieces.push(renderField(key, payload[key]));
  });
  return pieces.join('');
}

function renderField(key, value) {
  const label = fieldLabels[key] || key;
  let display = value;
  if (Array.isArray(value)) {
    display = value.join(', ');
  } else if (typeof value === 'object' && value !== null) {
    display = JSON.stringify(value);
  }
  return `<div><strong>${label}:</strong> <span>${display || '—'}</span></div>`;
}

ul.addEventListener('click', async (e) => {
  if (e.target.tagName === 'BUTTON') {
    const id = e.target.dataset.id;
    const a = e.target.dataset.a;
    await fetch(`/api/admin/moderate/${id}?action=${a}`, { method: 'PATCH' });
    fetchPending();
    fetchCounts();
  }
});

btnExport.addEventListener('click', () => {
  // abre descarga
  window.location.href = '/api/admin/export.csv';
});

btnReset.addEventListener('click', async () => {
  if (!confirm('Esto borrará TODAS las respuestas. ¿Continuar?')) return;
  const res = await fetch('/api/admin/reset', { method: 'DELETE' });
  if (res.ok) {
    alert('Base reiniciada');
    fetchPending();
    fetchCounts();
  }
});

// arranque
async function initFields() {
  try {
    const res = await fetch('/api/admin/fields', { cache: 'no-store' });
    const data = await res.json();
    fieldOrder = data.order || [];
    fieldLabels = data.labels || {};
  } catch (err) {
    console.warn('No se pudieron cargar los campos', err);
  }
}

(async function init(){
  await initFields();
  fetchCounts();
  fetchPending();
  setInterval(fetchCounts, 5000);
  setInterval(fetchPending, 2000);
})();
