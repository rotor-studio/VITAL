// --- Utilidades ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const stopwords = new Set([
  "de","la","el","y","a","en","que","un","una","lo","es","con","por","para",
  "the","and","a","in","of","to","is","it","on","for","as"
]);
function nowHHMM() { const d = new Date(); return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

// --- Elementos DOM ---
const totalEl = document.getElementById("total");
const lastUpdateEl = document.getElementById("lastUpdate");
const viewBars = document.getElementById("view-bars");
const viewCloud = document.getElementById("view-cloud");
const canvas = document.getElementById("cloudCanvas");
const ctx = canvas.getContext("2d");

// --- Estado ---
let chart;                 // gráfico de barras (Chart.js)
let currentView = "bars";  // alterna 'bars' / 'cloud'
let nodes = [];            // [{word, freq, x,y,vx,vy,r,fontSize,alpha,targetFreq}]
let edges = [];            // [{a,b,weight}]
let animReq = null;
let lastCounts = null;

// --- Datos ---
async function fetchApproved() {
  const res = await fetch("/api/responses?status=approved", { cache: "no-store" });
  return await res.json();
}
async function fetchCounts() {
  const res = await fetch('/api/admin/counts', { cache: 'no-store' });
  return await res.json();
}

// Frecuencias q1 para barras
function aggregateQ1(items) {
  const counts = {};
  for (const it of items) {
    const v = (it.payload?.q1 || "").trim();
    if (!v) continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a,b) => b[1]-a[1]);
}

// Frecuencias y co-ocurrencias q2 (top N palabras)
function wordsAndCooccurrence(items, topN=30) {
  const freq = {};
  const pairs = new Map(); // key "w1|w2" -> weight

  for (const it of items) {
    const raw = (it.payload?.q2 || "").toLowerCase();
    if (!raw) continue;
    const tokens = Array.from(new Set( // set para no contar repetida en misma respuesta
      raw.split(/[^a-záéíóúüñ0-9]+/i)
         .filter(Boolean)
         .filter(t => t.length>=2 && !stopwords.has(t))
    ));
    // frecuencia
    for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
    // co-ocurrencias
    for (let i=0;i<tokens.length;i++){
      for (let j=i+1;j<tokens.length;j++){
        const [a,b] = tokens[i] < tokens[j] ? [tokens[i], tokens[j]] : [tokens[j], tokens[i]];
        const key = `${a}|${b}`;
        pairs.set(key, (pairs.get(key)||0)+1);
      }
    }
  }

  const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0, topN);
  const words = new Set(sorted.map(([w])=>w));

  // filtra edges solo entre top words
  const edgesArr = [];
  for (const [key, weight] of pairs.entries()){
    const [a,b] = key.split("|");
    if (words.has(a) && words.has(b)) edgesArr.push({a,b,weight});
  }
  return { freqList: sorted, edges: edgesArr };
}

// --- Barras (Chart.js) ---
function renderBars(agg) {
  const labels = agg.map(([k]) => k);
  const data = agg.map(([,v]) => v);
  const ctxb = document.getElementById("chartQ1").getContext("2d");
  if (!chart) {
    chart = new Chart(ctxb, {
      type: "bar",
      data: { labels, datasets: [{ label: "Respuestas", data }] },
      options: {
        responsive: true,
        animation: { duration: 400 },
        scales: { y: { beginAtZero: true, ticks: { precision:0 } } },
        plugins: { legend: { display: false }, tooltip: { enabled: true } }
      }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  }
}

// --- Canvas helpers ---
function resizeCanvas(){
  // Ajusta canvas a CSS size (HiDPI aware)
  const dpr = window.devicePixelRatio || 1;
  const cssW = viewCloud.clientWidth || canvas.clientWidth || window.innerWidth;
  const cssH = canvas.clientHeight || (window.innerHeight * 0.7);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resizeCanvas);

// Crea/actualiza nodos a partir de freqList
function syncNodes(freqList){
  const map = new Map(nodes.map(n=>[n.word,n]));
  const max = Math.max(...freqList.map(([,v])=>v), 1);
  const min = Math.min(...freqList.map(([,v])=>v), 0);

  // actualiza/crea
  for (const [word, f] of freqList){
    let n = map.get(word);
    const targetFreq = f;
    const targetR = 16 + (max===min ? 0 : (f-min)/(max-min))*34; // radio 16..50
    const targetFont = 10 + (max===min ? 1 : (f-min)/(max-min))*18; // font 10..28 px
    if (!n){
      n = {
        word, freq:f, targetFreq,
        x: Math.random()*(canvas.width/ (window.devicePixelRatio||1) - 100)+50,
        y: Math.random()*(canvas.height/(window.devicePixelRatio||1) - 60)+30,
        vx: (Math.random()-0.5)*0.6, vy: (Math.random()-0.5)*0.6,
        r: 4, targetR, fontSize: 2, targetFont, alpha: 0
      };
      nodes.push(n);
    } else {
      n.targetFreq = f;
      n.targetR = targetR;
      n.targetFont = targetFont;
    }
    map.delete(word);
  }
  // los que sobran se desvanecen
  for (const n of map.values()){
    n.targetR = 0; n.targetFont = 0; n.targetFreq = 0; // desaparecer
  }
  // limpia desaparecidos
  nodes = nodes.filter(n => !(n.r<=1 && n.alpha <= 0.02));
}

// edges desde co-ocurrencias
function syncEdges(edgesInput){
  // crea lookup por palabra
  const idx = new Map(nodes.map((n,i)=>[n.word,i]));
  const arr = [];
  let maxW = 1;
  for (const e of edgesInput){
    const ai = idx.get(e.a);
    const bi = idx.get(e.b);
    if (ai==null || bi==null) continue;
    maxW = Math.max(maxW, e.weight);
    arr.push({ai, bi, weight:e.weight});
  }
  // normaliza y acota a las más fuertes para no saturar
  arr.sort((a,b)=>b.weight - a.weight);
  edges = arr.slice(0, 120).map(e => ({...e, norm: e.weight / maxW}));
}

// Física simple + dibujo
function stepPhysics(){
  const W = canvas.width / (window.devicePixelRatio||1);
  const H = canvas.height / (window.devicePixelRatio||1);
  const center = {x: W/2, y: H/2};

  // actualizar targets (suavizado)
  for (const n of nodes){
    n.r += (n.targetR - n.r)*0.08;
    n.fontSize += (n.targetFont - n.fontSize)*0.08;
    const targetAlpha = n.targetR>0 ? 1 : 0;
    n.alpha += (targetAlpha - n.alpha)*0.06;

    // fuerzas
    const kCenter = 0.0009; // atracción al centro
    n.vx += (center.x - n.x) * kCenter;
    n.vy += (center.y - n.y) * kCenter;

    // ligera deriva
    n.vx += (Math.random()-0.5)*0.02;
    n.vy += (Math.random()-0.5)*0.02;

    // amortiguación
    n.vx *= 0.96; n.vy *= 0.96;

    // mover
    n.x += n.vx;
    n.y += n.vy;

    // colisiones contra bordes
    if (n.x < n.r){ n.x = n.r; n.vx *= -0.8; }
    if (n.x > W-n.r){ n.x = W-n.r; n.vx *= -0.8; }
    if (n.y < n.r){ n.y = n.r; n.vy *= -0.8; }
    if (n.y > H-n.r){ n.y = H-n.r; n.vy *= -0.8; }
  }

  // colisiones entre nodos (push apart)
  for (let i=0;i<nodes.length;i++){
    for (let j=i+1;j<nodes.length;j++){
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const minDist = (a.r + b.r) * 0.85;
      if (dist < minDist){
        const overlap = (minDist - dist)/2;
        const ux = dx/dist, uy = dy/dist;
        a.x -= ux*overlap; a.y -= uy*overlap;
        b.x += ux*overlap; b.y += uy*overlap;
      }
    }
  }
}

function drawScene(){
  const W = canvas.width / (window.devicePixelRatio||1);
  const H = canvas.height / (window.devicePixelRatio||1);

  // fondo
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // opcional: leve retícula o glow
  // ctx.fillStyle = "rgba(255,255,255,0.02)"; ctx.fillRect(0,0,canvas.width,canvas.height);

  // líneas (edges)
  for (const e of edges){
    const a = nodes[e.ai], b = nodes[e.bi];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx,dy);
    const alpha = clamp(0.08 + e.norm*0.35 - dist/1200, 0, 0.45); // más cerca y más fuerte → más opaco
    if (alpha <= 0.01) continue;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(180,180,200,${alpha})`;
    ctx.lineWidth = 1 + e.norm*1.5;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // palabras (nodos)
  for (const n of nodes){
    if (n.alpha <= 0.01 || n.r <= 1) continue;

    // halo
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.06*n.alpha})`;
    ctx.arc(n.x, n.y, n.r*1.4, 0, Math.PI*2);
    ctx.fill();

    // texto
    ctx.fillStyle = `rgba(255,255,255,${clamp(0.6*n.alpha+0.2,0,1)})`;
    ctx.font = `${Math.max(10, n.fontSize|0)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n.word, n.x, n.y);
  }
}

// bucle animación nube
function animate(){
  stepPhysics();
  drawScene();
  animReq = requestAnimationFrame(animate);
}

// Alternancia de vistas
function toggleView() {
  currentView = currentView === "bars" ? "cloud" : "bars";
  if (currentView === "bars") {
    viewBars.style.display = "";
    viewCloud.style.display = "none";
    if (animReq) { cancelAnimationFrame(animReq); animReq = null; }
  } else {
    viewBars.style.display = "none";
    viewCloud.style.display = "";
    resizeCanvas();
    if (!animReq) animReq = requestAnimationFrame(animate);
  }
}

// --- Bucle principal ---
async function loop() {
  while (true) {
    try {
      const [items, counts] = await Promise.all([fetchApproved(), fetchCounts()]);
      lastCounts = counts;
      totalEl.textContent = `Aprobadas: ${items.length}`;
      lastUpdateEl.textContent = `Última aprobación: ${timeSince(counts.last_approved_at)}`;

      // Barras
      renderBars(aggregateQ1(items));

      // Nube dinámica
      const { freqList, edges: E } = wordsAndCooccurrence(items, 30);
      syncNodes(freqList);
      syncEdges(E);
    } catch (e) {
      console.error(e);
    }
    // refresco de datos cada 6 segundos
    await sleep(6000);
    toggleView(); // alterna vista cada ciclo
  }
}

function timeSince(iso){
  if(!iso) return "—";
  const last = new Date(iso), now = new Date();
  const m = Math.floor((now-last)/60000);
  if (m<1) return "<1 min";
  if (m===1) return "1 min";
  return `${m} min`;
}

// Arranque
resizeCanvas();
loop();
