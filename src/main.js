import JSZip from 'jszip';
import pica from 'pica';

const $ = id => document.getElementById(id);
const PRESETS = [
  [3440, 1440, '21:9 UW'], [2560, 1440, '1440p'], [1920, 1080, '1080p'],
  [3840, 2160, '4K'], [5120, 1440, '32:9'], [2560, 1600, '16:10'], [1170, 2532, 'Phone']
];
const store = {
  get(k, d) { try { const v = localStorage.getItem('wpc.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('wpc.' + k, JSON.stringify(v)); } catch {} }
};

let W = store.get('w', 3440), H = store.get('h', 1440);
let fmt = store.get('fmt', 'image/jpeg'), quality = store.get('q', 92);
let items = [], cur = -1;
let aiOn = store.get('ai', true);

// ---------- setup ----------
const presetsEl = $('presets');
PRESETS.forEach(([pw, ph, label]) => {
  const b = document.createElement('button');
  b.className = 'preset mono';
  b.innerHTML = `${pw}×${ph}<small>${label}</small>`;
  b.onclick = () => { W = pw; H = ph; syncDims(); };
  b.dataset.w = pw; b.dataset.h = ph;
  presetsEl.appendChild(b);
});
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function syncDims() {
  $('w').value = W; $('h').value = H;
  const g = gcd(W, H);
  $('ratio').textContent = `${W / g}:${H / g}  (${(W / H).toFixed(3)})`;
  presetsEl.querySelectorAll('.preset').forEach(b => b.classList.toggle('active', +b.dataset.w === W && +b.dataset.h === H));
  store.set('w', W); store.set('h', H);
}
['w', 'h'].forEach(id => $(id).addEventListener('input', () => {
  const v = Math.round(+$(id).value);
  if (v >= 16 && v <= 16384) { if (id === 'w') W = v; else H = v; syncDims(); }
}));
$('fmt').value = fmt; $('q').value = quality; $('qVal').textContent = quality;
function syncFmt() {
  const lossy = fmt !== 'image/png';
  $('q').disabled = !lossy; $('qLabel').style.opacity = $('qVal').style.opacity = lossy ? 1 : .4;
}
$('fmt').onchange = () => { fmt = $('fmt').value; store.set('fmt', fmt); syncFmt(); };
$('q').oninput = () => { quality = +$('q').value; $('qVal').textContent = quality; store.set('q', quality); };
syncDims(); syncFmt();

const drop = $('drop');
['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', ev => start([...ev.dataTransfer.files]));
$('files').onchange = ev => start([...ev.target.files]);

function start(files) {
  files = files.filter(f => f.type.startsWith('image/'));
  if (!files.length) return toast('No images in that selection');
  items = files.map(f => ({ file: f, name: f.name, url: URL.createObjectURL(f), img: null, st: null, status: 'pending', out: null }));
  $('setup').classList.add('hidden');
  $('editor').classList.remove('hidden');
  $('targetPill').textContent = `${W}×${H} · ${fmt.split('/')[1].toUpperCase()}`;
  $('targetPill').classList.remove('hidden');
  $('restartBtn').classList.remove('hidden');
  buildStrip();
  go(0);
}

$('restartBtn').onclick = () => {
  if (items.some(i => i.status === 'done') && !$('restartBtn').dataset.armed) {
    $('restartBtn').dataset.armed = 1; $('restartBtn').textContent = 'Click again to discard';
    setTimeout(() => { delete $('restartBtn').dataset.armed; $('restartBtn').textContent = 'Start over'; }, 3000);
    return;
  }
  delete $('restartBtn').dataset.armed; $('restartBtn').textContent = 'Start over';
  items.forEach(i => { URL.revokeObjectURL(i.url); if (i.out) URL.revokeObjectURL(i.out.url); });
  items = []; cur = -1; $('files').value = '';
  ['editor', 'results'].forEach(id => $(id).classList.add('hidden'));
  ['targetPill', 'restartBtn'].forEach(id => $(id).classList.add('hidden'));
  $('setup').classList.remove('hidden');
};

// ---------- editor ----------
const img = $('img'), imgBox = $('imgBox'), cropEl = $('crop'), stage = $('stage');
let disp = 1; // display px per source px

function buildStrip() {
  const strip = $('strip'); strip.innerHTML = '';
  items.forEach((it, i) => {
    const t = document.createElement('div');
    t.className = 'thumb'; t.innerHTML = `<img src="${it.url}" alt=""><span class="badge"></span>`;
    t.onclick = () => go(i);
    it.thumb = t; strip.appendChild(t);
  });
}
function refreshStrip() {
  items.forEach((it, i) => {
    it.thumb.className = 'thumb ' + it.status + (i === cur ? ' current' : '');
    it.thumb.querySelector('.badge').textContent = it.status === 'done' ? '✓' : it.status === 'skipped' ? '–' : '';
  });
  items[cur]?.thumb.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  const done = items.filter(i => i.status === 'done').length;
  const handled = items.filter(i => i.status !== 'pending').length;
  $('progress').textContent = `${cur + 1} of ${items.length} · ${done} cropped`;
  $('barFill').style.width = (handled / items.length * 100) + '%';
}

async function loadImg(it) {
  if (it.img) return it.img;
  const im = new Image(); im.src = it.url;
  await im.decode();
  it.img = im; return im;
}

function limits(it) {
  const iw = it.img.naturalWidth, ih = it.img.naturalHeight, A = W / H;
  let cwMax, chMax;
  if (iw / ih > A) { chMax = ih; cwMax = ih * A; } else { cwMax = iw; chMax = iw / A; }
  const zMax = Math.max(1, cwMax / W); // don't zoom past 1:1 source pixels
  return { iw, ih, cwMax, chMax, zMax };
}
function cropSize(it) { const L = limits(it); return { ...L, cw: L.cwMax / it.st.zoom, ch: L.chMax / it.st.zoom }; }
function clamp(it) {
  const L = limits(it);
  it.st.zoom = Math.min(Math.max(it.st.zoom, 1), L.zMax);
  const { cw, ch, iw, ih } = cropSize(it);
  it.st.x = Math.min(Math.max(it.st.x, 0), iw - cw);
  it.st.y = Math.min(Math.max(it.st.y, 0), ih - ch);
}
function centre(it) {
  it.st = { zoom: 1, x: 0, y: 0 };
  const { cw, ch, iw, ih } = cropSize(it);
  it.st.x = (iw - cw) / 2; it.st.y = (ih - ch) / 2;
}
function setZoom(it, z) {
  const a = cropSize(it), cx = it.st.x + a.cw / 2, cy = it.st.y + a.ch / 2;
  it.st.zoom = z;
  clamp(it);
  const b = cropSize(it);
  it.st.x = cx - b.cw / 2; it.st.y = cy - b.ch / 2;
  clamp(it); render();
}

async function go(i) {
  if (i < 0 || i >= items.length) return;
  cur = i;
  const it = items[i];
  await loadImg(it);
  if (cur !== i) return;
  if (!it.st) centre(it); else clamp(it);
  img.src = it.url;
  $('fileName').textContent = it.name;
  layout(); refreshStrip();
}

function layout() {
  const it = items[cur]; if (!it?.img) return;
  const pad = 28, sw = stage.clientWidth - pad * 2, sh = stage.clientHeight - pad * 2;
  disp = Math.min(sw / it.img.naturalWidth, sh / it.img.naturalHeight);
  imgBox.style.width = it.img.naturalWidth * disp + 'px';
  imgBox.style.height = it.img.naturalHeight * disp + 'px';
  render();
}
new ResizeObserver(layout).observe(stage);

function render() {
  const it = items[cur]; if (!it?.st) return;
  const { cw, ch, iw, ih, cwMax, zMax } = cropSize(it);
  Object.assign(cropEl.style, { left: it.st.x * disp + 'px', top: it.st.y * disp + 'px', width: cw * disp + 'px', height: ch * disp + 'px' });
  $('sSrc').textContent = `${iw}×${ih}`;
  $('sCrop').textContent = `${Math.round(cw)}×${Math.round(ch)} @ ${Math.round(it.st.x)},${Math.round(it.st.y)}`;
  $('sOut').textContent = `${W}×${H}`;
  const scale = W / cw;
  $('sScale').textContent = scale <= 1 ? `↓ ${(1 / scale).toFixed(2)}×` : `↑ ${scale.toFixed(2)}×`;
  $('sScale').style.color = scale > 1.001 ? 'var(--warn)' : '';
  const up = W / cwMax;
  $('upWarn').classList.toggle('hidden', up <= 1.001);
  $('upWarn').textContent = `This photo is smaller than ${W}×${H}, so it will be upscaled ${up.toFixed(2)}×.`;
  $('aiBox').classList.toggle('hidden', scale <= 1.001);
  $('aiToggle').checked = aiOn;
  const zs = $('zoom');
  zs.disabled = zMax <= 1.0001;
  zs.value = zMax > 1.0001 ? Math.round(Math.log(it.st.zoom) / Math.log(zMax) * 1000) : 0;
  $('zoomVal').textContent = Math.round(it.st.zoom * 100) + '%';
}

$('zoom').oninput = () => {
  const it = items[cur]; const { zMax } = limits(it);
  setZoom(it, Math.pow(zMax, $('zoom').value / 1000));
};
stage.addEventListener('wheel', e => {
  const it = items[cur]; if (!it?.st) return;
  e.preventDefault();
  setZoom(it, it.st.zoom * Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

// drag: grab the crop, or click anywhere on the image to jump the crop there
let drag = null;
function startDrag(e, jump) {
  const it = items[cur]; if (!it?.st) return;
  if (jump) {
    const r = imgBox.getBoundingClientRect(), { cw, ch } = cropSize(it);
    it.st.x = (e.clientX - r.left) / disp - cw / 2;
    it.st.y = (e.clientY - r.top) / disp - ch / 2;
    clamp(it); render();
  }
  drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: it.st.x, y: it.st.y };
  stage.setPointerCapture(e.pointerId);
  e.preventDefault();
}
cropEl.addEventListener('pointerdown', e => { e.stopPropagation(); startDrag(e, false); });
stage.addEventListener('pointerdown', e => startDrag(e, true));
stage.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const it = items[cur];
  it.st.x = drag.x + (e.clientX - drag.sx) / disp;
  it.st.y = drag.y + (e.clientY - drag.sy) / disp;
  clamp(it); render();
});
['pointerup', 'pointercancel'].forEach(t => stage.addEventListener(t, () => drag = null));

// ---------- output ----------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Lanczos-quality resize via pica, with a plain canvas fallback
const picaInst = pica({ features: ['js', 'ww'] });
async function resize(src, w, h) {
  if (src.width === w && src.height === h) return src;
  const dst = canvas(w, h);
  if (picaInst) {
    try { await picaInst.resize(src, dst, { filter: 'lanczos3' }); return dst; } catch (e) { console.warn('pica failed, falling back', e); }
  }
  const x = dst.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, w, h); return dst;
}

// ---------- AI upscaling (idealo RDN "esrgan-medium via UpscalerJS + TensorFlow.js, loaded on first use) ----------
// Dynamic imports, so Vite splits these into separate files that only download when AI upscaling is first used
const modelDefinitions = {
  2: () => import('@upscalerjs/esrgan-medium/2x'),
  3: () => import('@upscalerjs/esrgan-medium/3x'),
  4: () => import('@upscalerjs/esrgan-medium/4x')
};
let tf;
const upscalers = {};
async function getUpscaler(scale) {
  if (upscalers[scale]) return upscalers[scale];
  const [tfModule, { default: Upscaler }, { default: def }] =
    await Promise.all([import('@tensorflow/tfjs'), import('upscaler'), modelDefinitions[scale]()]);
  tf = tfModule;

  try { await tf.setBackend('webgl'); } catch {}
  await tf.ready();
  // the weights are copied into models/ by vite.config.js
  const model = { ...def, path: new URL(`${import.meta.env.BASE_URL}models/x${scale}/model.json`, location.href).href };
  const up = new Upscaler({ model });
  await up.getModel();
  return upscalers[scale] = up;
}
async function aiUpscale(src, scale, onProgress) {
  const up = await getUpscaler(scale);
  const t = await up.upscale(src, {
    output: 'tensor', patchSize: 128, padding: 6,
    progress: p => onProgress?.(typeof p === 'number' ? p : 0)
  });
  const out = canvas(t.shape[1], t.shape[0]);
  const clean = tf.tidy(() => t.clipByValue(0, 255).round().toInt());
  await tf.browser.toPixels(clean, out);
  tf.dispose([t, clean]);
  return out;
}

function busy(msg, frac) {
  $('busy').classList.toggle('hidden', msg == null);
  if (msg != null) { $('busyMsg').textContent = msg; $('busyFill').style.width = Math.round((frac || 0) * 100) + '%'; }
}

async function produce(it) {
  const { cw, ch } = cropSize(it);
  // 1. cut the crop out at native resolution
  const nw = Math.max(1, Math.round(cw)), nh = Math.max(1, Math.round(ch));
  const crop = canvas(nw, nh);
  crop.getContext('2d').drawImage(it.img, it.st.x, it.st.y, cw, ch, 0, 0, nw, nh);
  const r = W / cw;
  let result;
  if (r > 1.001 && aiOn) {
    // 2a. AI path: pick the smallest model that covers the upscale, feed it an input that lands on (about) W×H
    const scale = r <= 2 ? 2 : r <= 3 ? 3 : 4;
    const inW = Math.min(nw, Math.ceil(W / scale)), inH = Math.min(nh, Math.ceil(H / scale));
    busy(`Preparing ×${scale} AI model…`, 0);
    const pre = await resize(crop, inW, inH);
    let enhanced;
    try {
      await getUpscaler(scale);
      enhanced = await aiUpscale(pre, scale, p => busy(`AI enhancing ×${scale}… ${Math.round(p * 100)}%`, p));
    } catch (err) {
      console.error(err);
      toast('AI upscale failed, used Lanczos instead');
      enhanced = crop;
    }
    busy('Finishing…', 1);
    result = await resize(enhanced, W, H);
  } else {
    // 2b. Lanczos straight to target (handles downscale and mild upscale)
    busy('Resizing…', .5);
    result = await resize(crop, W, H);
  }
  // 3. encode
  let out = result;
  if (fmt === 'image/jpeg') { out = canvas(W, H); const x = out.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.drawImage(result, 0, 0); }
  const blob = await new Promise(res => out.toBlob(res, fmt, quality / 100));
  if (!blob) throw new Error('Encoding failed');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[fmt];
  const base = it.name.replace(/\.[^.]+$/, '');
  return { blob, url: URL.createObjectURL(blob), filename: `${base}_${W}x${H}.${ext}` };
}

async function saveNext() {
  const it = items[cur]; if (!it?.st || $('saveNext').disabled) return;
  $('saveNext').disabled = true;
  try {
    if (it.out) URL.revokeObjectURL(it.out.url);
    it.out = await produce(it);
    it.status = 'done';
  } catch (err) { toast('Could not crop: ' + err.message); }
  busy(null);
  $('saveNext').disabled = false;
  advance();
}
function advance() {
  const next = items.findIndex((x, i) => i > cur && x.status === 'pending');
  const any = next >= 0 ? next : items.findIndex(x => x.status === 'pending');
  if (any >= 0) go(any); else showResults();
}

$('saveNext').onclick = saveNext;
$('aiToggle').onchange = () => { aiOn = $('aiToggle').checked; store.set('ai', aiOn); $('aiToggle').blur(); };
$('skipBtn').onclick = () => { const it = items[cur]; if (it.status !== 'done') it.status = 'skipped'; refreshStrip(); advance(); };
$('prevBtn').onclick = () => go(cur - 1);
$('resetBtn').onclick = () => { centre(items[cur]); render(); };
$('finishBtn').onclick = showResults;
$('backToEdit').onclick = () => { $('results').classList.add('hidden'); $('editor').classList.remove('hidden'); layout(); };

document.addEventListener('keydown', e => {
  if ($('editor').classList.contains('hidden') || e.target.matches('input, select')) return;
  const it = items[cur]; if (!it?.st) return;
  const step = (e.shiftKey ? 40 : 4) / disp;
  const k = e.key;
  if (k === 'ArrowLeft') it.st.x -= step;
  else if (k === 'ArrowRight') it.st.x += step;
  else if (k === 'ArrowUp') it.st.y -= step;
  else if (k === 'ArrowDown') it.st.y += step;
  else if (k === '+' || k === '=') return setZoom(it, it.st.zoom * 1.08), e.preventDefault();
  else if (k === '-' || k === '_') return setZoom(it, it.st.zoom / 1.08), e.preventDefault();
  else if (k === 'Enter') return saveNext(), e.preventDefault();
  else if (k === 's' || k === 'S') return $('skipBtn').click();
  else if (k === 'r' || k === 'R') return $('resetBtn').click();
  else if (k === '[') return go(cur - 1);
  else if (k === ']') return go(cur + 1);
  else return;
  e.preventDefault(); clamp(it); render();
});

// ---------- results ----------
function showResults() {
  $('editor').classList.add('hidden'); $('results').classList.remove('hidden');
  const done = items.filter(i => i.out);
  $('resTitle').textContent = `${done.length} wallpaper${done.length === 1 ? '' : 's'} ready`;
  $('zipBtn').disabled = !done.length;
  const g = $('outGrid'); g.innerHTML = '';
  done.forEach(it => {
    const d = document.createElement('div'); d.className = 'out';
    d.innerHTML = `<img src="${it.out.url}" alt=""><div class="meta"><span class="name mono"></span></div>`;
    d.querySelector('.name').textContent = it.out.filename;
    const b = document.createElement('button'); b.textContent = 'Save';
    b.onclick = () => saveFile(it.out.filename, it.out.blob);
    d.querySelector('.meta').appendChild(b);
    g.appendChild(d);
  });
}
function saveFile(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
$('zipBtn').onclick = async () => {
  const done = items.filter(i => i.out); if (!done.length) return;
  $('zipBtn').disabled = true; $('zipBtn').textContent = 'Zipping…';
  try {
    const zip = new JSZip(), used = new Set();
    done.forEach(it => {
      let n = it.out.filename, k = 2;
      while (used.has(n)) n = it.out.filename.replace(/(\.[^.]+)$/, `-${k++}$1`);
      used.add(n); zip.file(n, it.out.blob);
    });
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    saveFile(`wallpapers_${W}x${H}.zip`, blob);
  } catch (err) { toast('Zip failed: ' + err.message); }
  $('zipBtn').disabled = false; $('zipBtn').textContent = 'Download all (.zip)';
};

$('themeBtn').onclick = () => {
  const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t; store.set('theme', t);
};

let tt;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); }
