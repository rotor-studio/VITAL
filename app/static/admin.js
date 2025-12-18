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
const copyById = new Map();

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeValue(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function shouldSkipKey(key) {
  return key === '__labels' || key === '__lang';
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
  copyById.clear();
  for (const r of data) {
    copyById.set(String(r.id), buildCopyText(r));
    const li = document.createElement('li');
    li.className = 'moderation-card';
    li.innerHTML = `
      <div class="card-head">
        <strong>#${r.id}</strong>
        <span>${new Date(r.created_at).toLocaleString()}</span>
        <span>${r.payload?.__lang ? `Lang: ${escapeHtml(r.payload.__lang)}` : ''}</span>
        <span class="actions">
          <button data-id="${r.id}" data-a="approve">✔ Aprobar</button>
          <button data-id="${r.id}" data-a="reject">✖ Rechazar</button>
          <button data-id="${r.id}" data-a="copy">📋 Copiar</button>
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
    if (shouldSkipKey(key)) return;
    if (payload[key] === undefined) return;
    used.add(key);
    pieces.push(renderField(key, payload[key]));
  });
  Object.keys(payload).forEach(key => {
    if (shouldSkipKey(key)) return;
    if (used.has(key)) return;
    pieces.push(renderField(key, payload[key]));
  });
  return pieces.join('');
}

function renderField(key, value) {
  const label = escapeHtml(fieldLabels[key] || key);
  const display = normalizeValue(value);
  const safeDisplay = display ? escapeHtml(display) : '—';
  return `<div><strong>${label}:</strong> <span class="field-value">${safeDisplay}</span></div>`;
}

function buildCopyText(row) {
  const lines = [];
  lines.push(`ID: ${row.id}`);
  if (row.created_at) lines.push(`Fecha: ${new Date(row.created_at).toLocaleString()}`);
  if (row.payload?.__lang) lines.push(`Lang: ${row.payload.__lang}`);
  lines.push('');

  const payload = row.payload || {};
  const used = new Set();
  const keys = fieldOrder.length ? fieldOrder.slice() : Object.keys(payload);
  keys.forEach((key) => {
    if (shouldSkipKey(key)) return;
    if (payload[key] === undefined) return;
    used.add(key);
    const label = fieldLabels[key] || key;
    lines.push(`${label}: ${normalizeValue(payload[key]) || '—'}`);
  });
  Object.keys(payload).forEach((key) => {
    if (shouldSkipKey(key)) return;
    if (used.has(key)) return;
    const label = fieldLabels[key] || key;
    lines.push(`${label}: ${normalizeValue(payload[key]) || '—'}`);
  });

  return lines.join('\n');
}

async function copyToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'true');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (_) {
      return false;
    }
  }
}

ul.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const id = btn.dataset.id;
  const a = btn.dataset.a;

  if (a === 'copy') {
    const ok = await copyToClipboard(copyById.get(String(id)) || '');
    const prevText = btn.textContent;
    btn.textContent = ok ? '✓ Copiado' : '⚠ No se pudo copiar';
    setTimeout(() => { btn.textContent = prevText; }, 900);
    return;
  }

  await fetch(`/api/admin/moderate/${id}?action=${a}`, { method: 'PATCH' });
  fetchPending();
  fetchCounts();
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
