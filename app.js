const $ = id => document.getElementById(id);
const cl = (v, a, b) => Math.min(b, Math.max(a, v));
const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
};
const tick = () => new Promise(r => setTimeout(r, 0));
const SIZES = { a4: [210, 297], letter: [215.9, 279.4] };
const FAM = "'Noto Sans Thai','Noto Sans Myanmar',sans-serif";
const IMPORT_MAX = 3200;
const PROJECT_MAX = 2800;
const STORE_Q = 0.93;
let items = [], coverImg = null, dragIdx = null;

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

function pageDims() {
  let [w, h] = SIZES[$('size').value] || SIZES.a4;
  if ($('size').value !== 'match' && $('orient').value === 'l') [w, h] = [h, w];
  return [w, h];
}

function wrap(ctx, text, maxW) {
  const sp = text.includes(' '), toks = sp ? text.split(' ') : Array.from(text), j = sp ? ' ' : '', lines = [];
  let cur = '';
  for (const t of toks) {
    const test = cur ? cur + j + t : t;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = t;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ---------- cover ---------- */
function drawCover(cv, W, H) {
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = $('bg').value;
  c.fillRect(0, 0, W, H);
  if (coverImg) {
    const s = Math.max(W / coverImg.width, H / coverImg.height), dw = coverImg.width * s, dh = coverImg.height * s;
    c.drawImage(coverImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.fillRect(0, 0, W, H);
  }
  const fam = $('font').value, fs = Math.round(Math.min(W, H) * 0.09);
  c.fillStyle = $('fg').value;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.font = `700 ${fs}px ${fam}`;
  const tl = wrap(c, $('title').value || 'Untitled', W * 0.8), lh = fs * 1.3, af = Math.round(fs * 0.5);
  c.font = `400 ${af}px ${fam}`;
  const al = $('author').value ? wrap(c, $('author').value, W * 0.8) : [];
  const total = tl.length * lh + (al.length ? af * 0.8 + al.length * af * 1.4 : 0), p = $('pos').value;
  let y = p === 'top' ? H * 0.1 : p === 'bottom' ? H * 0.9 - total : (H - total) / 2;
  c.font = `700 ${fs}px ${fam}`;
  tl.forEach(l => { c.fillText(l, W / 2, y); y += lh; });
  y += af * 0.8;
  c.font = `400 ${af}px ${fam}`;
  al.forEach(l => { c.fillText(l, W / 2, y); y += af * 1.4; });
}

async function preview() {
  const [pw, ph] = $('size').value === 'match' ? SIZES.a4 : pageDims();
  try { await document.fonts.load(`700 40px ${$('font').value}`, $('title').value + $('author').value); } catch (e) {}
  drawCover($('cv'), Math.round(pw * 2), Math.round(ph * 2));
}

['title', 'author', 'bg', 'fg', 'pos', 'font', 'size', 'orient'].forEach(id => $(id).addEventListener('input', preview));
$('coverfile').onchange = async e => {
  const f = e.target.files[0];
  if (!f) { coverImg = null; preview(); return; }
  const url = URL.createObjectURL(f);
  try { coverImg = await importImage(await loadImg(url)); } catch (x) { coverImg = null; }
  finally { URL.revokeObjectURL(url); }
  preview();
};
document.fonts && document.fonts.ready.then(preview);
preview();

/* ---------- image editing pipeline ---------- */
const newEdit = () => ({ rot: 0, ang: 0, fx: false, fy: false, crop: null, ar: 0, b: 0, c: 0, s: 0, w: 0, auto: false, filter: 'none', els: [], ai: null, aiImg: null, wp: null });
const FILTERS = [
  ['none', 'None'], ['vivid', 'Vivid'], ['bw', 'Mono'], ['noir', 'Noir'],
  ['sepia', 'Sepia'], ['warm', 'Warm'], ['cool', 'Cool'], ['fade', 'Fade'],
  ['vintage', 'Vintage'], ['drama', 'Drama'], ['soft', 'Soft'], ['chrome', 'Chrome']
];
const newWp = (g = 3) => {
  const p = [];
  for (let j = 0; j <= g; j++) for (let i = 0; i <= g; i++) p.push([i / g, j / g]);
  return { g, p };
};

const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : v;

function filterPass(p, name) {
  if (!name || name === 'none') return;
  for (let i = 0; i < p.length; i += 4) {
    let r = p[i], g = p[i + 1], b = p[i + 2];
    const y = r * 0.3 + g * 0.59 + b * 0.11;
    if (name === 'bw') r = g = b = y;
    else if (name === 'noir') {
      const t = y < 140 ? y * 0.55 : Math.min(255, 140 + (y - 140) * 1.45);
      r = g = b = t;
    } else if (name === 'sepia' || name === 'vintage') {
      const nr = r * 0.393 + g * 0.769 + b * 0.189;
      const ng = r * 0.349 + g * 0.686 + b * 0.168;
      const nb = r * 0.272 + g * 0.534 + b * 0.131;
      if (name === 'vintage') { r = nr * 0.86 + 28; g = ng * 0.86 + 22; b = nb * 0.8 + 18; }
      else { r = nr; g = ng; b = nb; }
    } else if (name === 'warm') { r += 22; g += 6; b -= 18; }
    else if (name === 'cool') { r -= 12; g += 2; b += 22; }
    else if (name === 'vivid') {
      r = y + (r - y) * 1.45; g = y + (g - y) * 1.45; b = y + (b - y) * 1.45;
    } else if (name === 'fade') { r = r * 0.82 + 38; g = g * 0.82 + 38; b = b * 0.82 + 36; }
    else if (name === 'soft') {
      r = (y + (r - y) * 0.75) * 0.92 + 16;
      g = (y + (g - y) * 0.75 + 8) * 0.92 + 16;
      b = (y + (b - y) * 0.75 + 6) * 0.92 + 16;
    } else if (name === 'drama') {
      const c = v => (v - 128) * 1.35 + 128;
      r = y + (c(r) - y) * 0.85; g = y + (c(g) - y) * 0.85; b = y + (c(b) - y) * 0.85;
    } else if (name === 'chrome') {
      r = (r - 128) * 1.2 + 138; g = (g - 128) * 1.15 + 128; b = (b - 128) * 1.25 + 120;
    }
    p[i] = clamp8(r); p[i + 1] = clamp8(g); p[i + 2] = clamp8(b);
  }
}

function innerRect(w, h, deg) {
  const rad = deg * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const inside = (hw, hh) => {
    const pts = [[hw, hh], [hw, -hh], [-hw, hh], [-hw, -hh]];
    for (const [x, y] of pts) {
      const xs = x * cos + y * sin;
      const ys = -x * sin + y * cos;
      if (Math.abs(xs) > w / 2 + 0.01 || Math.abs(ys) > h / 2 + 0.01) return false;
    }
    return true;
  };
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inside(w / 2 * mid, h / 2 * mid)) lo = mid;
    else hi = mid;
  }
  return { cw: Math.max(1, w * lo), ch: Math.max(1, h * lo) };
}

function frameSize(img, e) {
  const src = e.ai && e.aiImg ? e.aiImg : img;
  const rot = ((e.rot || 0) % 360 + 360) % 360;
  const swap = rot % 180 !== 0;
  let fw = swap ? src.height : src.width;
  let fh = swap ? src.width : src.height;
  if (Math.abs(e.ang || 0) > 0.05) {
    const inner = innerRect(fw, fh, e.ang);
    fw = inner.cw;
    fh = inner.ch;
  }
  return [fw, fh];
}

function cropForRatio(img, e, ar) {
  if (!(ar > 0)) return null;
  const [fw, fh] = frameSize(img, e);
  let w = fw, h = fw / ar;
  if (h > fh) { h = fh; w = fh * ar; }
  return { x: (1 - w / fw) / 2, y: (1 - h / fh) / 2, w: w / fw, h: h / fh };
}

function adjust(cv, e) {
  const filt = e.filter && e.filter !== 'none';
  if (!(e.b || e.c || e.s || e.w || e.auto || filt)) return;
  const c = cv.getContext('2d'), d = c.getImageData(0, 0, cv.width, cv.height), p = d.data;
  if (!(e.b || e.c || e.s || e.w || e.auto)) { filterPass(p, e.filter); c.putImageData(d, 0, 0); return; }
  let lo = 0, hi = 255, sat = e.s;
  if (e.auto) {
    const h = new Uint32Array(256), n = p.length / 4;
    for (let i = 0; i < p.length; i += 4) h[(p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11) | 0]++;
    let a = 0;
    for (lo = 0; lo < 255 && (a += h[lo]) < n * .01; lo++);
    a = 0;
    for (hi = 255; hi > 0 && (a += h[hi]) < n * .01; hi--);
    if (hi - lo < 30) { lo = 0; hi = 255; }
    sat += 15;
  }
  const m = 255 / (hi - lo), cc = e.c * 2.55, f = (259 * (cc + 255)) / (255 * (259 - cc)), br = e.b * 2.55, wm = e.w * .4, sf = 1 + sat / 100;
  for (let i = 0; i < p.length; i += 4) {
    let r = (p[i] - lo) * m + wm, g = (p[i + 1] - lo) * m, b = (p[i + 2] - lo) * m - wm;
    r = f * (r - 128) + 128 + br;
    g = f * (g - 128) + 128 + br;
    b = f * (b - 128) + 128 + br;
    const y = r * .3 + g * .59 + b * .11;
    p[i] = clamp8(y + (r - y) * sf);
    p[i + 1] = clamp8(y + (g - y) * sf);
    p[i + 2] = clamp8(y + (b - y) * sf);
  }
  if (filt) filterPass(p, e.filter);
  c.putImageData(d, 0, 0);
}

function drawEls(cv, els) {
  const c = cv.getContext('2d'), u = Math.min(cv.width, cv.height);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const o of els) {
    const fs = o.size * u;
    if (o.k === 's') {
      c.font = `${fs}px serif`;
      c.fillText(o.v, o.x * cv.width, o.y * cv.height);
    } else {
      c.font = `700 ${fs}px ${FAM}`;
      const L = wrap(c, o.v, cv.width * .8), lh = fs * 1.25;
      c.lineWidth = fs * .14;
      c.lineJoin = 'round';
      c.strokeStyle = 'rgba(0,0,0,.75)';
      c.fillStyle = o.color;
      L.forEach((l, i) => {
        const y = o.y * cv.height + (i - (L.length - 1) / 2) * lh;
        c.strokeText(l, o.x * cv.width, y);
        c.fillText(l, o.x * cv.width, y);
      });
    }
  }
}

function tri(c, img, s0, s1, s2, d0, d1, d2) {
  const [x0, y0] = s0, [x1, y1] = s1, [x2, y2] = s2, [u0, v0] = d0, [u1, v1] = d1, [u2, v2] = d2;
  const den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  if (!den) return;
  const cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3, g = p => {
    const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1;
    return [p[0] + dx / l * .7, p[1] + dy / l * .7];
  };
  const [g0, g1, g2] = [d0, d1, d2].map(g);
  c.save();
  c.beginPath();
  c.moveTo(g0[0], g0[1]);
  c.lineTo(g1[0], g1[1]);
  c.lineTo(g2[0], g2[1]);
  c.closePath();
  c.clip();
  c.transform(
    (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / den,
    (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / den,
    (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / den,
    (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / den,
    (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / den,
    (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / den
  );
  const bx = Math.max(0, Math.floor(Math.min(x0, x1, x2)) - 1), by = Math.max(0, Math.floor(Math.min(y0, y1, y2)) - 1);
  const ex = Math.min(img.width, Math.ceil(Math.max(x0, x1, x2)) + 1), ey = Math.min(img.height, Math.ceil(Math.max(y0, y1, y2)) + 1);
  c.drawImage(img, bx, by, ex - bx, ey - by, bx, by, ex - bx, ey - by);
  c.restore();
}

const cr = (a, b, c, d, t) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);

function wpAt(w, u, v) {
  const G = w.g, P = w.p, sx = Math.min(G - 1, Math.floor(u * G)), sy = Math.min(G - 1, Math.floor(v * G)), fx = u * G - sx, fy = v * G - sy, out = [0, 0];
  const at = (r, c, k) => P[r * (G + 1) + c][k];
  const rowv = (r, k) => {
    const q = [0, 1, 2, 3].map(n => {
      const c = sx - 1 + n;
      return c < 0 ? 2 * at(r, 0, k) - at(r, 1, k) : c > G ? 2 * at(r, G, k) - at(r, G - 1, k) : at(r, c, k);
    });
    return cr(q[0], q[1], q[2], q[3], fx);
  };
  for (let k = 0; k < 2; k++) {
    const c1 = rowv(sy, k), c2 = rowv(sy + 1, k);
    const c0 = sy - 1 < 0 ? 2 * c1 - c2 : rowv(sy - 1, k);
    const c3 = sy + 2 > G ? 2 * c2 - c1 : rowv(sy + 2, k);
    out[k] = cr(c0, c1, c2, c3, fy);
  }
  return out;
}

function warp(t, wp) {
  const W = t.width, H = t.height, o = mk(W, H), c = o.getContext('2d'), N = 22, P = [];
  c.fillStyle = '#fff';
  c.fillRect(0, 0, W, H);
  for (let j = 0; j <= N; j++) {
    P[j] = [];
    for (let i = 0; i <= N; i++) {
      const q = wpAt(wp, i / N, j / N);
      P[j][i] = [q[0] * W, q[1] * H];
    }
  }
  const s = (x, y) => [x / N * W, y / N * H];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const A = P[j][i], B = P[j][i + 1], C = P[j + 1][i + 1], D = P[j + 1][i];
    tri(c, t, s(i, j), s(i + 1, j), s(i + 1, j + 1), A, B, C);
    tri(c, t, s(i, j), s(i + 1, j + 1), s(i, j + 1), A, C, D);
  }
  return o;
}

function checker(ctx, w, h) {
  const n = 16;
  for (let y = 0; y < h; y += n) for (let x = 0; x < w; x += n) {
    ctx.fillStyle = ((x / n + y / n) & 1) ? '#d0d0d0' : '#f4f4f4';
    ctx.fillRect(x, y, n, n);
  }
}

function bake(img, e, max, o = {}) {
  const src = e.ai ? e.aiImg : img;
  const rot = ((e.rot || 0) % 360 + 360) % 360;
  const ang = e.ang || 0;
  const swap = rot % 180 !== 0;
  const sw = src.width, sh = src.height, fw = swap ? sh : sw, fh = swap ? sw : sh;
  const useAng = Math.abs(ang) > 0.05;
  const inner = useAng ? innerRect(fw, fh, ang) : { cw: fw, ch: fh };
  const s = Math.min(1, max / Math.max(inner.cw, inner.ch));
  let t;
  if (!useAng) {
    t = mk(Math.round(fw * s), Math.round(fh * s));
    const c = t.getContext('2d');
    c.translate(t.width / 2, t.height / 2);
    c.scale(e.fx ? -1 : 1, e.fy ? -1 : 1);
    c.rotate(rot * Math.PI / 180);
    c.drawImage(src, -sw * s / 2, -sh * s / 2, sw * s, sh * s);
  } else {
    const rad = ang * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    const bw = fw * cos + fh * sin, bh = fw * sin + fh * cos;
    const tmp = mk(Math.max(1, Math.ceil(bw * s)), Math.max(1, Math.ceil(bh * s)));
    const tc = tmp.getContext('2d');
    tc.translate(tmp.width / 2, tmp.height / 2);
    tc.scale(e.fx ? -1 : 1, e.fy ? -1 : 1);
    tc.rotate((rot + ang) * Math.PI / 180);
    tc.drawImage(src, -sw * s / 2, -sh * s / 2, sw * s, sh * s);
    const tw = Math.max(1, Math.min(tmp.width, Math.round(inner.cw * s)));
    const th = Math.max(1, Math.min(tmp.height, Math.round(inner.ch * s)));
    t = mk(tw, th);
    t.getContext('2d').drawImage(tmp, (tmp.width - tw) / 2, (tmp.height - th) / 2, tw, th, 0, 0, tw, th);
  }
  if (e.crop && !o.noCrop) {
    const k = e.crop, n = mk(Math.round(k.w * t.width), Math.round(k.h * t.height));
    n.getContext('2d').drawImage(t, k.x * t.width, k.y * t.height, k.w * t.width, k.h * t.height, 0, 0, n.width, n.height);
    t = n;
  }
  if (e.wp && !o.noCrop) t = warp(t, e.wp);
  adjust(t, e);
  if (!o.noOv) drawEls(t, e.els);
  return t;
}

function onWhite(cv) {
  const c = mk(cv.width, cv.height), g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(cv, 0, 0);
  return c;
}

function updateThumb(it) {
  it.th = onWhite(bake(it.img, it.e, 240)).toDataURL('image/jpeg', .7);
}

/* ---------- gallery ---------- */
async function addFiles(list) {
  list = Array.from(list);
  for (const f of list) {
    if (!/^image\/(jpeg|png|webp|gif|bmp)/.test(f.type)) continue;
    const url = URL.createObjectURL(f);
    try {
      const img = await importImage(await loadImg(url));
      const it = { url, img, name: f.name || '', e: newEdit() };
      updateThumb(it);
      items.push(it);
    } catch (x) {}
    finally { URL.revokeObjectURL(url); }
    renderThumbs();
  }
}

function renderThumbs() {
  const box = $('thumbs');
  box.innerHTML = '';
  $('count').textContent = items.length ? `(${items.length})` : '';
  const per = Math.max(1, +($('per') && $('per').value) || 1);
  items.forEach((it, i) => {
    const d = document.createElement('div');
    d.className = 't';
    d.draggable = true;
    const page = Math.floor(i / per) + 1;
    d.innerHTML = `<span class="n">${i + 1}</span>${per > 1 ? `<span class="pgno">p${page}</span>` : ''}<div class="im"><img src="${it.th}"></div><div class="b"><button data-a="e" title="Edit">✎</button><button data-a="r" title="Rotate">⟳</button><button data-a="d" title="Delete">✕</button></div>`;
    d.querySelector('[data-a=e]').onclick = () => openEd(it);
    d.querySelector('[data-a=r]').onclick = () => {
      it.e.rot = (it.e.rot + 90) % 360;
      it.e.crop = null;
      it.e.wp = null;
      updateThumb(it);
      renderThumbs();
    };
    d.querySelector('[data-a=d]').onclick = () => {
      if (it.url && it.url.startsWith('blob:')) URL.revokeObjectURL(it.url);
      items.splice(i, 1);
      renderThumbs();
    };
    d.ondragstart = () => { dragIdx = i; d.classList.add('drag'); };
    d.ondragend = () => d.classList.remove('drag');
    d.ondragover = e => e.preventDefault();
    d.ondrop = e => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === i) return;
      const [m] = items.splice(dragIdx, 1);
      items.splice(i, 0, m);
      dragIdx = null;
      renderThumbs();
    };
    box.appendChild(d);
  });
}

const drop = $('drop');
drop.onclick = () => $('files').click();
$('files').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); };
$('per').onchange = () => renderThumbs();

/* ---------- editor ---------- */
let cur = null, E = null, tab = 'crop', selEl = null;
let hist = [], histI = -1, histLock = false;
const EMO = ['⭐', '❤️', '😀', '🔥', '🎉', '🌸', '👍', '✨', '📍', '🎈', '☀️', '🌈'];

function cloneEdit(e) {
  const aiImg = e.aiImg || null;
  const raw = { ...e };
  delete raw.aiImg;
  const s = JSON.parse(JSON.stringify(raw));
  s.aiImg = aiImg;
  return s;
}

function editKey(e) {
  const raw = { ...e };
  delete raw.aiImg;
  return JSON.stringify(raw);
}

function updateHistBtns() {
  $('undo').disabled = histI <= 0;
  $('redo').disabled = histI >= hist.length - 1;
}

function commit() {
  if (histLock || !E) return;
  const key = editKey(E);
  if (hist[histI] && editKey(hist[histI]) === key) return;
  hist = hist.slice(0, histI + 1);
  hist.push(cloneEdit(E));
  if (hist.length > 50) hist.shift();
  histI = hist.length - 1;
  updateHistBtns();
}

function syncUi() {
  if (!E) return;
  $('sb').value = E.b || 0;
  $('sc').value = E.c || 0;
  $('ss').value = E.s || 0;
  $('sw').value = E.w || 0;
  $('ang').value = E.ang || 0;
  $('angv').textContent = (+E.ang || 0).toFixed(1) + '°';
  $('auto').classList.toggle('on', !!E.auto);
  const f = E.filter || 'none';
  document.querySelectorAll('#filters button').forEach(b => b.classList.toggle('on', b.dataset.f === f));
  document.querySelectorAll('#wgs [data-g]').forEach(b => b.classList.toggle('on', +b.dataset.g === (E.wp ? E.wp.g : 3)));
}

function restoreEdit(s) {
  const aiImg = s.aiImg || null;
  E = JSON.parse(JSON.stringify(s));
  E.aiImg = aiImg;
  selEl = null;
  syncUi();
  refresh();
}

function undoEdit() {
  if (histI <= 0) return;
  histI--;
  histLock = true;
  restoreEdit(hist[histI]);
  histLock = false;
  updateHistBtns();
}

function redoEdit() {
  if (histI >= hist.length - 1) return;
  histI++;
  histLock = true;
  restoreEdit(hist[histI]);
  histLock = false;
  updateHistBtns();
}

function pullAdj() {
  if (!E) return;
  E.b = +$('sb').value;
  E.c = +$('sc').value;
  E.s = +$('ss').value;
  E.w = +$('sw').value;
}

$('emo').innerHTML = EMO.map(x => `<button type="button">${x}</button>`).join('');
$('filters').innerHTML = FILTERS.map(([id, name]) => `<button type="button" data-f="${id}">${name}</button>`).join('');
$('emo').onclick = e => {
  if (e.target.tagName !== 'BUTTON' || !E) return;
  selEl = { k: 's', v: e.target.textContent, x: .5, y: .5, size: .15 };
  E.els.push(selEl);
  $('esize').value = 15;
  renderOv();
  commit();
};
$('addt').onclick = () => {
  const v = $('ttxt').value.trim();
  if (!v || !E) return;
  selEl = { k: 't', v, x: .5, y: .5, size: .07, color: $('tcol').value };
  E.els.push(selEl);
  $('esize').value = 7;
  renderOv();
  commit();
};
$('esize').oninput = e => { if (selEl) { selEl.size = e.target.value / 100; renderOv(); } };
$('esize').onchange = () => commit();
$('edel').onclick = () => {
  if (selEl && E) {
    E.els = E.els.filter(o => o !== selEl);
    selEl = null;
    renderOv();
    commit();
  }
};

function openEd(it) {
  cur = it;
  E = cloneEdit(it.e);
  if (!E.filter) E.filter = 'none';
  if (E.ang == null) E.ang = 0;
  selEl = null;
  hist = [cloneEdit(E)];
  histI = 0;
  updateHistBtns();
  syncUi();
  $('eallmsg').textContent = '';
  $('ed').classList.add('on');
  setTab('crop');
}

function setTab(t) {
  tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  document.querySelectorAll('.pn').forEach(p => p.hidden = p.dataset.t !== t);
  $('elbar').hidden = !(t === 'sticker' || t === 'text');
  refresh();
}

$('tabs').onclick = e => { if (e.target.dataset.t) setTab(e.target.dataset.t); };

function drawPrev() {
  const cv = bake(cur.img, E, tab === 'warp' ? 560 : 900, { noCrop: tab === 'crop', noOv: true }), ec = $('ec');
  ec.width = cv.width;
  ec.height = cv.height;
  const g = ec.getContext('2d');
  checker(g, ec.width, ec.height);
  g.drawImage(cv, 0, 0);
}

function refresh() {
  drawPrev();
  renderOv();
}

function drag(ev, fn, done) {
  ev.preventDefault();
  ev.stopPropagation();
  const r = $('ec').getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY;
  const mv = m => fn((m.clientX - sx) / r.width, (m.clientY - sy) / r.height, r);
  const up = () => {
    removeEventListener('pointermove', mv);
    removeEventListener('pointerup', up);
    if (done) done();
  };
  addEventListener('pointermove', mv);
  addEventListener('pointerup', up);
}

function renderOv() {
  const ov = $('ov'), ec = $('ec'), u = Math.min(ec.clientWidth, ec.clientHeight);
  ov.innerHTML = '';
  if (tab === 'warp') {
    if (!E.wp) E.wp = newWp();
    const w = E.wp, SN = 24;
    ov.insertAdjacentHTML('beforeend', '<svg class="wsvg" viewBox="0 0 1 1" preserveAspectRatio="none"><path id="wpath"></path></svg>');
    const path = $('wpath');
    const lines = () => {
      let d = '';
      for (let a = 0; a <= w.g; a++) for (const col of [0, 1]) {
        for (let k = 0; k <= SN; k++) {
          const t = k / SN, q = wpAt(w, col ? a / w.g : t, col ? t : a / w.g);
          d += (k ? 'L' : 'M') + q[0].toFixed(4) + ' ' + q[1].toFixed(4);
        }
      }
      path.setAttribute('d', d);
    };
    lines();
    w.p.forEach(p => {
      const h = document.createElement('div');
      h.className = 'wh';
      ov.appendChild(h);
      const put = () => { h.style.left = p[0] * 100 + '%'; h.style.top = p[1] * 100 + '%'; };
      put();
      h.onpointerdown = ev => {
        const p0 = [...p];
        drag(ev, (dx, dy) => {
          p[0] = cl(p0[0] + dx, 0, 1);
          p[1] = cl(p0[1] + dy, 0, 1);
          put();
          lines();
          drawPrev();
        }, commit);
      };
    });
    return;
  }
  if (tab === 'crop') {
    if (!E.crop) E.crop = { x: 0, y: 0, w: 1, h: 1 };
    const d = document.createElement('div');
    d.className = 'crop';
    d.innerHTML = '<i></i>';
    ov.appendChild(d);
    const put = () => {
      const k = E.crop;
      Object.assign(d.style, { left: k.x * 100 + '%', top: k.y * 100 + '%', width: k.w * 100 + '%', height: k.h * 100 + '%' });
    };
    put();
    d.onpointerdown = ev => {
      const k0 = { ...E.crop };
      drag(ev, (dx, dy) => {
        E.crop.x = cl(k0.x + dx, 0, 1 - k0.w);
        E.crop.y = cl(k0.y + dy, 0, 1 - k0.h);
        put();
      }, commit);
    };
    d.firstChild.onpointerdown = ev => {
      const k0 = { ...E.crop };
      drag(ev, (dx, dy, r) => {
        let w = cl(k0.w + dx, .05, 1 - k0.x), h = cl(k0.h + dy, .05, 1 - k0.y);
        if (E.ar) {
          h = w * r.width / (E.ar * r.height);
          if (k0.y + h > 1) { h = 1 - k0.y; w = h * E.ar * r.height / r.width; }
        }
        E.crop.w = w;
        E.crop.h = h;
        put();
      }, commit);
    };
    return;
  }
  E.els.forEach(o => {
    const d = document.createElement('div');
    d.className = 'el' + (o === selEl ? ' sel' : '');
    d.textContent = o.v;
    Object.assign(d.style, {
      left: o.x * 100 + '%',
      top: o.y * 100 + '%',
      fontSize: o.size * u + 'px',
      fontFamily: FAM,
      color: o.k === 't' ? o.color : '#000',
      fontWeight: o.k === 't' ? 700 : 400,
      textShadow: o.k === 't' ? '0 0 3px #000,0 0 3px #000' : 'none'
    });
    d.onpointerdown = ev => {
      selEl = o;
      $('esize').value = o.size * 100;
      ov.querySelectorAll('.el').forEach(x => x.classList.remove('sel'));
      d.classList.add('sel');
      const p = { x: o.x, y: o.y };
      drag(ev, (dx, dy) => {
        o.x = cl(p.x + dx, 0, 1);
        o.y = cl(p.y + dy, 0, 1);
        d.style.left = o.x * 100 + '%';
        d.style.top = o.y * 100 + '%';
      }, commit);
    };
    ov.appendChild(d);
  });
}

$('ars').onclick = e => {
  const a = e.target.dataset.a;
  if (a === undefined) return;
  const v = +a;
  if (v <= 0) {
    E.ar = 0;
    E.crop = { x: 0, y: 0, w: 1, h: 1 };
  } else {
    E.ar = v;
    const W = $('ec').width, H = $('ec').height;
    let w = W, h = W / v;
    if (h > H) { h = H; w = H * v; }
    E.crop = { x: (1 - w / W) / 2, y: (1 - h / H) / 2, w: w / W, h: h / H };
  }
  renderOv();
  commit();
};

const turn = d => { E.rot = (E.rot + d + 360) % 360; E.crop = null; E.ar = 0; E.wp = null; refresh(); commit(); };
$('rl').onclick = () => turn(-90);
$('rr').onclick = () => turn(90);
$('fh').onclick = () => { E.fx = !E.fx; E.crop = null; E.wp = null; refresh(); commit(); };
$('fv').onclick = () => { E.fy = !E.fy; E.crop = null; E.wp = null; refresh(); commit(); };
$('wgs').onclick = e => {
  const g = e.target.dataset.g;
  if (g) {
    E.wp = newWp(+g);
    document.querySelectorAll('#wgs [data-g]').forEach(b => b.classList.toggle('on', b === e.target));
    refresh();
    commit();
  } else if (e.target.id === 'wrst') {
    E.wp = newWp(E.wp ? E.wp.g : 3);
    refresh();
    commit();
  }
};
$('ecan').onclick = () => $('ed').classList.remove('on');
function tidyCrop(k) {
  if (!k) return null;
  if (k.x < .001 && k.y < .001 && k.w > .999 && k.h > .999) return null;
  return k;
}

$('esave').onclick = () => {
  pullAdj();
  const w = E.wp;
  if (w && JSON.stringify(w.p) === JSON.stringify(newWp(w.g).p)) E.wp = null;
  E.crop = tidyCrop(E.crop);
  cur.e = E;
  updateThumb(cur);
  renderThumbs();
  $('ed').classList.remove('on');
};

function applyToAll() {
  if (!E || !cur) return;
  pullAdj();
  const filter = E.filter || 'none';
  const ar = +E.ar || 0;
  const adj = { b: +E.b || 0, c: +E.c || 0, s: +E.s || 0, w: +E.w || 0, auto: !!E.auto, filter, ar };
  for (const it of items) {
    let crop;
    if (it === cur) crop = E.crop ? { ...E.crop } : null;
    else if (ar > 0) crop = cropForRatio(it.img, it.e, ar);
    else crop = E.crop ? { ...E.crop } : null;
    crop = tidyCrop(crop);
    Object.assign(it.e, adj, { crop });
    if (it === cur) Object.assign(E, adj, { crop: crop ? { ...crop } : null });
    updateThumb(it);
  }
  syncUi();
  refresh();
  commit();
  renderThumbs();
  const n = items.length;
  $('eallmsg').textContent = `Applied the filter, crop ratio, and adjustments to ${n} image${n === 1 ? '' : 's'}.`;
}

/* ---------- AI edit (OpenAI / Gemini) ---------- */
$('aip').onchange = () => $('aim').value = $('aip').value === 'openai' ? 'gpt-image-1' : 'gemini-2.5-flash-image';
const st = m => $('aist').textContent = m;
const BG_PROMPT = 'Remove the background completely. Keep the main subject with clean edges on a fully transparent background. Do not add a new background, shadow, or frame.';
$('airv').onclick = () => { E.ai = null; E.aiImg = null; E.crop = null; E.ang = 0; st('Reverted to the original image.'); refresh(); commit(); };
async function runAi(pr) {
  const prov = $('aip').value, key = $('aik').value.trim(), model = $('aim').value.trim();
  if (!key) { st('Enter an API key first.'); return; }
  if (!pr) { st('Enter a prompt first.'); return; }
  st('Sending to ' + prov + '…');
  $('aigo').disabled = true;
  $('aibg').disabled = true;
  try {
    const src = bake(cur.img, { ...E, crop: null, wp: null, els: [], b: 0, c: 0, s: 0, w: 0, auto: false }, 1024), dataUrl = src.toDataURL('image/png');
    let b64;
    if (prov === 'openai') {
      const blob = await new Promise(r => src.toBlob(r, 'image/png')), fd = new FormData();
      fd.append('model', model);
      fd.append('prompt', pr);
      fd.append('image', blob, 'image.png');
      const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error && j.error.message || r.status);
      b64 = j.data[0].b64_json;
    } else {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: pr }, { inline_data: { mime_type: 'image/png', data: dataUrl.split(',')[1] } }] }] })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error && j.error.message || r.status);
      const p = ((j.candidates || [])[0]?.content?.parts || []).find(x => x.inlineData || x.inline_data);
      if (!p) throw new Error('No image returned');
      b64 = (p.inlineData || p.inline_data).data;
    }
    E.ai = 'data:image/png;base64,' + b64;
    E.aiImg = await loadImg(E.ai);
    E.rot = 0;
    E.ang = 0;
    E.fx = E.fy = false;
    E.crop = null;
    E.wp = null;
    st('Done. Check the result, then Save edits.');
    refresh();
    commit();
  } catch (e) {
    st('AI edit failed: ' + e.message + '. The hosted page blocks outside requests; use the downloaded local copy.');
  }
  $('aigo').disabled = false;
  $('aibg').disabled = false;
}
$('aigo').onclick = () => runAi($('aipr').value.trim());
$('aibg').onclick = () => runAi(BG_PROMPT);

/* ---------- build pages, preview, PDF ---------- */
function renderPage(sc, pw, ph, m, fit, maxPx, q) {
  const sw = sc.width, sh = sc.height, bw = pw - 2 * m, bh = ph - 2 * m;
  let dw = bw, dh = bh;
  if (fit === 'fit') {
    const s = Math.min(bw / sw, bh / sh);
    dw = sw * s;
    dh = sh * s;
  }
  const ppm = Math.min(maxPx / Math.max(dw, dh), Math.max(sw / dw, sh / dh));
  const cv = mk(Math.round(dw * ppm), Math.round(dh * ppm)), c = cv.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0, 0, cv.width, cv.height);
  if (fit === 'fill') {
    const s = Math.max(cv.width / sw, cv.height / sh);
    c.drawImage(sc, (cv.width - sw * s) / 2, (cv.height - sh * s) / 2, sw * s, sh * s);
  } else c.drawImage(sc, 0, 0, cv.width, cv.height);
  return { data: cv.toDataURL('image/jpeg', q), dw, dh };
}

function cellGrid(n, land) {
  if (n <= 1) return [1, 1];
  if (n === 2) return land ? [2, 1] : [1, 2];
  if (n === 3) return land ? [3, 1] : [1, 3];
  if (n === 4) return [2, 2];
  if (n === 6) return land ? [3, 2] : [2, 3];
  const cols = Math.ceil(Math.sqrt(n));
  return [cols, Math.ceil(n / cols)];
}

function sheetDims() {
  let [w, h] = SIZES[$('size').value] || SIZES.a4;
  if ($('orient').value === 'l') [w, h] = [h, w];
  return [w, h];
}

function drawFit(ctx, sc, x, y, cw, ch, fit) {
  const sw = sc.width, sh = sc.height;
  if (fit === 'stretch') { ctx.drawImage(sc, x, y, cw, ch); return; }
  if (fit === 'fill') {
    const s = Math.max(cw / sw, ch / sh);
    const dw = sw * s, dh = sh * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cw, ch);
    ctx.clip();
    ctx.drawImage(sc, x + (cw - dw) / 2, y + (ch - dh) / 2, dw, dh);
    ctx.restore();
    return;
  }
  const s = Math.min(cw / sw, ch / sh);
  const dw = sw * s, dh = sh * s;
  ctx.drawImage(sc, x + (cw - dw) / 2, y + (ch - dh) / 2, dw, dh);
}

function renderSheet(list, pw, ph, m, fit, maxPx, q, gapMm, per) {
  const bw = Math.max(1, pw - 2 * m), bh = Math.max(1, ph - 2 * m);
  const [cols, rows] = cellGrid(per, pw >= ph);
  const ppm = maxPx / Math.max(bw, bh);
  const W = Math.max(1, Math.round(bw * ppm)), H = Math.max(1, Math.round(bh * ppm));
  const cv = mk(W, H), c = cv.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0, 0, W, H);
  const gapPx = gapMm * ppm;
  const cw = (W - gapPx * (cols - 1)) / cols;
  const ch = (H - gapPx * (rows - 1)) / rows;
  list.forEach((sc, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    if (row >= rows) return;
    drawFit(c, sc, col * (cw + gapPx), row * (ch + gapPx), cw, ch, fit);
  });
  return { data: cv.toDataURL('image/jpeg', q), dw: bw, dh: bh };
}

async function buildPages(maxPx, q, dpi, prog) {
  const m = +$('margin').value, fit = $('fit').value, match = $('size').value === 'match';
  const per = Math.max(1, +($('per') && $('per').value) || 1);
  const gap = +($('gap') && $('gap').value);
  const multi = per > 1;
  const [bw, bh] = multi ? sheetDims() : (match ? SIZES.a4 : pageDims());
  await document.fonts.load(`700 40px ${$('font').value}`, $('title').value + $('author').value).catch(() => {});
  const cc = mk(1, 1);
  drawCover(cc, Math.round(bw / 25.4 * dpi), Math.round(bh / 25.4 * dpi));
  const pages = [{ pw: bw, ph: bh, data: cc.toDataURL('image/jpeg', .9), dw: bw, dh: bh }];
  const bakeMax = it => {
    const k = it.e.crop;
    return Math.min(4000, maxPx / (k ? Math.max(k.w, k.h) : 1));
  };
  if (!multi) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i], sc = bake(it.img, it.e, bakeMax(it));
      let pw = bw, ph = bh;
      if (match) { pw = sc.width * 25.4 / 150 + 2 * m; ph = sc.height * 25.4 / 150 + 2 * m; }
      pages.push({ pw, ph, num: i + 1, ...renderPage(sc, pw, ph, m, match ? 'fit' : fit, maxPx, q) });
      prog(i + 2, items.length + 1);
      await tick();
    }
    return pages;
  }
  const [pw, ph] = sheetDims();
  let seen = 0;
  for (let g = 0; g < items.length; g += per) {
    const baked = [];
    for (const it of items.slice(g, g + per)) {
      baked.push(bake(it.img, it.e, bakeMax(it)));
      seen++;
      prog(seen + 1, items.length + 1);
      await tick();
    }
    pages.push({ pw, ph, num: pages.length, ...renderSheet(baked, pw, ph, m, fit, maxPx, q, gap, per) });
  }
  return pages;
}

function makePdf(pages) {
  const P = pages[0], m = +$('margin').value;
  const doc = new jspdf.jsPDF({ unit: 'mm', format: [P.pw, P.ph], orientation: P.pw > P.ph ? 'l' : 'p', compress: true });
  pages.forEach((p, i) => {
    if (i) doc.addPage([p.pw, p.ph], p.pw > p.ph ? 'l' : 'p');
    doc.addImage(p.data, 'JPEG', (p.pw - p.dw) / 2, (p.ph - p.dh) / 2, p.dw, p.dh);
    if (p.num && $('pnum').value === '1') {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(String(p.num), p.pw / 2, p.ph - Math.max(3, m / 2 - 1), { align: 'center' });
    }
  });
  return doc;
}

let pvPages = [], pvI = 0;

function showPv() {
  const p = pvPages[pvI], box = $('pvbox');
  $('pvn').textContent = `(${pvI === 0 ? 'Cover' : 'Page ' + pvI} of ${pvPages.length - 1} pages)`;
  const asp = p.pw / p.ph, h = Math.min(innerHeight * .62, 640);
  box.innerHTML = `<div class="pg" style="width:${Math.min(h * asp, box.clientWidth || 600)}px;aspect-ratio:${p.pw}/${p.ph}"><img src="${p.data}" style="left:${(p.pw - p.dw) / 2 / p.pw * 100}%;top:${(p.ph - p.dh) / 2 / p.ph * 100}%;width:${p.dw / p.pw * 100}%;height:${p.dh / p.ph * 100}%">${p.num && $('pnum').value === '1' ? `<span>${p.num}</span>` : ''}</div>`;
  $('pp').disabled = pvI === 0;
  $('pnx').disabled = pvI === pvPages.length - 1;
}

$('pp').onclick = () => { pvI--; showPv(); };
$('pnx').onclick = () => { pvI++; showPv(); };
$('pcl').onclick = () => $('pv').classList.remove('on');
$('prevbtn').onclick = async () => {
  if (!window.jspdf) { $('msg').textContent = 'PDF library failed to load. Check your connection and reload.'; return; }
  if (!items.length) { $('msg').textContent = 'Please add at least one image.'; return; }
  $('msg').textContent = 'Building preview…';
  $('prevbtn').disabled = true;
  try {
    pvPages = await buildPages(700, .7, 60, () => {});
    pvI = 0;
    $('pvmsg').textContent = '';
    $('prog').hidden = true;
    $('pv').classList.add('on');
    showPv();
    $('msg').textContent = '';
  } catch (e) {
    console.error(e);
    $('msg').textContent = 'Could not build the preview. Try fewer or smaller images.';
  }
  $('prevbtn').disabled = false;
};
$('pdl').onclick = async () => {
  const prog = $('prog');
  $('pdl').disabled = true;
  prog.hidden = false;
  $('pvmsg').textContent = 'Building the full-quality PDF…';
  try {
    const [maxPx, q] = $('quality').value.split(',').map(Number);
    const pages = await buildPages(maxPx, q, 150, (a, b) => { prog.max = b; prog.value = a; });
    const name = ($('title').value || 'book').replace(/[\\/:*?"<>|]/g, '').trim() || 'book';
    makePdf(pages).save(name + '.pdf');
    $('pvmsg').textContent = 'Done. Your PDF was downloaded.';
  } catch (e) {
    console.error(e);
    $('pvmsg').textContent = 'Something went wrong. Try fewer or smaller images, or the Small file quality.';
  }
  $('pdl').disabled = false;
};

/* ---------- editor controls ---------- */
['sb', 'sc', 'ss', 'sw'].forEach(id => {
  $(id).oninput = () => { pullAdj(); if (E) refresh(); };
  $(id).onchange = () => { pullAdj(); if (E) { refresh(); commit(); } };
});
$('filters').onclick = e => {
  const f = e.target.dataset.f;
  if (!f || !E) return;
  E.filter = f;
  syncUi();
  refresh();
  commit();
};
$('auto').onclick = () => {
  if (!E) return;
  E.auto = !E.auto;
  $('auto').classList.toggle('on', E.auto);
  refresh();
  commit();
};
$('adjr').onclick = () => {
  if (!E) return;
  E.b = E.c = E.s = E.w = 0;
  E.auto = false;
  syncUi();
  refresh();
  commit();
};
$('ang').oninput = () => {
  if (!E) return;
  E.ang = +$('ang').value;
  $('angv').textContent = E.ang.toFixed(1) + '°';
  refresh();
};
$('ang').onchange = () => { if (E) { E.ang = +$('ang').value; refresh(); commit(); } };
$('ang0').onclick = () => {
  if (!E) return;
  E.ang = 0;
  syncUi();
  refresh();
  commit();
};
$('undo').onclick = () => undoEdit();
$('redo').onclick = () => redoEdit();
$('eall').onclick = () => applyToAll();
document.addEventListener('keydown', e => {
  if (!$('ed').classList.contains('on')) return;
  const tag = e.target && e.target.tagName;
  const typing = tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type !== 'range');
  if (typing) return;
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redoEdit(); else undoEdit();
  } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
    e.preventDefault();
    redoEdit();
  }
});

/* ---------- save and reopen ---------- */
function normEdit(raw) {
  const e = newEdit();
  if (raw && typeof raw === 'object') Object.assign(e, raw);
  e.aiImg = null;
  e.filter = e.filter || 'none';
  e.ang = +e.ang || 0;
  e.els = Array.isArray(e.els) ? e.els : [];
  return e;
}

function hasAlpha(img) {
  const w = Math.min(img.width, 48), h = Math.min(img.height, 48);
  const c = mk(w, h), g = c.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

function srcSize(src) {
  return [src.width || src.naturalWidth, src.height || src.naturalHeight];
}

function downscaleToCanvas(img, maxEdge) {
  let [cw, ch] = srcSize(img);
  if (Math.max(cw, ch) <= maxEdge) {
    const c = mk(cw, ch), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return c;
  }
  let src = img;
  while (Math.max(cw, ch) > maxEdge * 2) {
    cw = Math.max(1, Math.round(cw / 2));
    ch = Math.max(1, Math.round(ch / 2));
    const step = mk(cw, ch), s = step.getContext('2d');
    s.imageSmoothingQuality = 'high';
    s.drawImage(src, 0, 0, srcSize(src)[0], srcSize(src)[1], 0, 0, cw, ch);
    src = step;
  }
  const scale = maxEdge / Math.max(cw, ch);
  const ow = Math.round(cw * scale), oh = Math.round(ch * scale);
  const out = mk(ow, oh), g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, cw, ch, 0, 0, ow, oh);
  return out;
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

async function canvasToStoreBlob(cv, alpha) {
  const types = alpha ? ['image/webp', 'image/png'] : ['image/webp', 'image/jpeg'];
  for (const type of types) {
    const blob = await new Promise(r => cv.toBlob(r, type, STORE_Q));
    if (blob && blob.size) return { blob, type };
  }
  return null;
}

async function importImage(img) {
  const cv = downscaleToCanvas(img, IMPORT_MAX);
  const packed = await canvasToStoreBlob(cv, hasAlpha(img));
  if (!packed) return img;
  const url = URL.createObjectURL(packed.blob);
  try { return await loadImg(url); } finally { URL.revokeObjectURL(url); }
}

async function packDataUrl(str, maxEdge) {
  if (!str || typeof str !== 'string') return str;
  if (str.length < 400000) return str;
  try {
    const img = await loadImg(str);
    return exportImage(img, maxEdge);
  } catch (e) { return str; }
}

function storeExt(type) {
  if (type === 'image/webp') return 'webp';
  if (type === 'image/png') return 'png';
  return 'jpg';
}

async function exportImage(img, maxEdge = PROJECT_MAX) {
  const cv = downscaleToCanvas(img, maxEdge);
  const packed = await canvasToStoreBlob(cv, hasAlpha(img));
  if (!packed) {
    return cv.toDataURL(hasAlpha(img) ? 'image/png' : 'image/jpeg', STORE_Q);
  }
  return blobToDataUrl(packed.blob);
}

async function exportImageBlob(img, maxEdge = PROJECT_MAX) {
  const cv = downscaleToCanvas(img, maxEdge);
  const packed = await canvasToStoreBlob(cv, hasAlpha(img));
  if (packed) return { blob: packed.blob, ext: storeExt(packed.type) };
  const mime = hasAlpha(img) ? 'image/png' : 'image/jpeg';
  const blob = await new Promise(r => cv.toBlob(r, mime, STORE_Q));
  if (!blob) throw new Error('Could not encode image');
  return { blob, ext: storeExt(mime) };
}

async function aiPathFromEdit(raw, slot, files) {
  if (!raw.ai || typeof raw.ai !== 'string') return;
  if (!raw.ai.startsWith('data:')) return;
  try {
    const aiImg = await loadImg(raw.ai);
    const ai = await exportImageBlob(aiImg);
    const path = `images/${slot}-ai.${ai.ext}`;
    raw.ai = path;
    files.push({ path, blob: ai.blob });
  } catch (e) {
    delete raw.ai;
  }
}

function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function projectSettings() {
  return {
    title: $('title').value,
    author: $('author').value,
    bg: $('bg').value,
    fg: $('fg').value,
    pos: $('pos').value,
    font: $('font').value,
    size: $('size').value,
    orient: $('orient').value,
    fit: $('fit').value,
    margin: $('margin').value,
    quality: $('quality').value,
    pnum: $('pnum').value,
    per: $('per').value,
    gap: $('gap').value
  };
}

async function buildProjectBundle(onProg) {
  if ($('ed').classList.contains('on') && cur && E) {
    pullAdj();
    cur.e = cloneEdit(E);
    updateThumb(cur);
  }
  const files = [];
  const images = [];
  const manifest = {
    v: 3,
    storage: 'bundle',
    kind: 'pdf-book-maker',
    ...projectSettings(),
    cover: null,
    images
  };
  if (coverImg) {
    const c = await exportImageBlob(coverImg);
    manifest.cover = `cover.${c.ext}`;
    files.push({ path: manifest.cover, blob: c.blob });
  }
  const n = items.length;
  for (let i = 0; i < n; i++) {
    const it = items[i];
    const slot = String(i + 1).padStart(4, '0');
    const packed = await exportImageBlob(it.img);
    const path = `images/${slot}.${packed.ext}`;
    const raw = { ...it.e };
    delete raw.aiImg;
    await aiPathFromEdit(raw, slot, files);
    files.push({ path, blob: packed.blob });
    images.push({ name: it.name || '', file: path, e: raw });
    if (onProg) onProg(i + 1, n);
    await tick();
  }
  return { manifest, files };
}

async function writePath(root, path, blob) {
  const parts = path.split('/').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) cur = await cur.getDirectoryHandle(parts[i], { create: true });
  const fh = await cur.getFileHandle(parts[parts.length - 1], { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

async function saveProjectZip(onProg, onZip) {
  if (!window.JSZip) throw new Error('ZIP library did not load. Check your connection and reload.');
  const { manifest, files } = await buildProjectBundle(onProg);
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(manifest));
  for (const f of files) zip.file(f.path, f.blob);
  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    m => { if (onZip && m.percent) onZip(m.percent); }
  );
  const name = ($('title').value || 'book').replace(/[\\/:*?"<>|]/g, '').trim() || 'book';
  downloadBlob(name + '.book.zip', blob);
  const mb = (blob.size / (1024 * 1024)).toFixed(1);
  return { mb, images: files.length };
}

async function saveProjectFolder(onProg) {
  if (!window.showDirectoryPicker) throw new Error('Folder save needs Chrome or Edge.');
  const { manifest, files } = await buildProjectBundle(onProg);
  const dir = await window.showDirectoryPicker();
  const sub = ($('title').value || 'book').replace(/[\\/:*?"<>|]/g, '').trim() || 'book';
  let root = dir;
  try { root = await dir.getDirectoryHandle(sub, { create: true }); } catch (e) {}
  await writePath(root, 'project.json', new Blob([JSON.stringify(manifest)], { type: 'application/json' }));
  for (const f of files) await writePath(root, f.path, f.blob);
  return { folder: sub, images: files.length };
}

function applyProjectSettings(data) {
  for (const id of ['title', 'author', 'bg', 'fg', 'pos', 'font', 'size', 'orient', 'fit', 'margin', 'quality', 'pnum', 'per', 'gap']) {
    if (data[id] != null && $(id)) $(id).value = data[id];
  }
}

async function hydrateProject(data, resolvePath, onProg) {
  if (!data || data.kind !== 'pdf-book-maker' || !Array.isArray(data.images)) {
    throw new Error('This file is not a PDF Book Maker project.');
  }
  applyProjectSettings(data);
  items.forEach(it => { if (it.url && it.url.startsWith('blob:')) URL.revokeObjectURL(it.url); });
  items = [];
  cur = null;
  E = null;
  $('ed').classList.remove('on');

  if (data.cover) {
    if (String(data.cover).startsWith('data:')) {
      coverImg = await loadImg(data.cover);
    } else {
      const url = URL.createObjectURL(await resolvePath(data.cover));
      try { coverImg = await loadImg(url); } finally { URL.revokeObjectURL(url); }
    }
  } else coverImg = null;

  const total = data.images.length;
  for (let i = 0; i < total; i++) {
    const im = data.images[i];
    let img, url;
    if (im.file) {
      const blob = await resolvePath(im.file);
      url = URL.createObjectURL(blob);
      img = await loadImg(url);
    } else if (im.data) {
      url = im.data;
      img = await loadImg(url);
    } else throw new Error('Invalid image entry in project.');
    const e = normEdit(im.e);
    if (e.ai) {
      try {
        if (e.ai.startsWith('data:')) {
          e.aiImg = await loadImg(e.ai);
        } else {
          const blob = await resolvePath(e.ai);
          e.ai = await blobToDataUrl(blob);
          e.aiImg = await loadImg(e.ai);
        }
      } catch (err) {
        e.ai = null;
        e.aiImg = null;
      }
    }
    const it = { url, img, name: im.name || '', e };
    updateThumb(it);
    items.push(it);
    if (onProg) onProg(i + 1, total);
    await tick();
  }
  preview();
  renderThumbs();
}

async function loadProjectZip(file, onProg) {
  if (!window.JSZip) throw new Error('ZIP library did not load. Check your connection and reload.');
  const zip = await JSZip.loadAsync(file);
  let entry = zip.file('project.json');
  if (!entry) {
    const alt = Object.keys(zip.files).find(n => /(^|\/)project\.json$/i.test(n) && !zip.files[n].dir);
    if (alt) entry = zip.file(alt);
  }
  if (!entry) throw new Error('Missing project.json in this zip.');
  const data = JSON.parse(await entry.async('string'));
  const resolvePath = async path => {
    const norm = path.replace(/\\/g, '/');
    const zf = zip.file(norm) || zip.file(norm.replace(/^images\//, 'Images/'));
    if (!zf) throw new Error('Missing file in project: ' + path);
    return zf.async('blob');
  };
  await hydrateProject(data, resolvePath, onProg);
}

async function loadProjectJson(file, onProg) {
  const data = JSON.parse(await file.text());
  if (data.v >= 3 && data.storage === 'bundle' && data.images?.[0]?.file && !data.images[0].data) {
    throw new Error('This manifest goes with image files. Open the .book.zip or use Open folder.');
  }
  await hydrateProject(data, async p => {
    if (typeof p === 'string' && p.startsWith('data:')) {
      return (await fetch(p)).blob();
    }
    throw new Error('Invalid image data in JSON project.');
  }, onProg);
}

async function loadProjectFolder(onProg) {
  if (!window.showDirectoryPicker) throw new Error('Folder open needs Chrome or Edge.');
  const dir = await window.showDirectoryPicker();
  const fh = await dir.getFileHandle('project.json');
  const data = JSON.parse(await (await fh.getFile()).text());
  const resolvePath = async path => {
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    let cur = dir;
    for (let i = 0; i < parts.length - 1; i++) cur = await cur.getDirectoryHandle(parts[i]);
    return (await (await cur.getFileHandle(parts[parts.length - 1])).getFile());
  };
  await hydrateProject(data, resolvePath, onProg);
}

async function loadProjectFile(file, onProg) {
  const low = file.name.toLowerCase();
  if (low.endsWith('.zip') || low.endsWith('.book.zip') || file.type === 'application/zip') {
    await loadProjectZip(file, onProg);
    return;
  }
  await loadProjectJson(file, onProg);
}

function btnBusy(btn, busy, text) {
  if (!btn) return;
  if (busy) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent.trim();
    btn.disabled = true;
    btn.classList.add('load');
    btn.textContent = text || 'Loading…';
  } else {
    btn.classList.remove('load');
    btn.disabled = false;
    btn.textContent = btn.dataset.label || btn.textContent;
  }
}

if (window.showDirectoryPicker && $('openpf')) $('openpf').hidden = false;

$('savep').onclick = async () => {
  btnBusy($('savep'), true, 'Saving…');
  $('openp').disabled = true;
  $('prevbtn').disabled = true;
  $('pmsg').textContent = 'Saving project…';
  const fmt = $('savefmt') ? $('savefmt').value : 'zip';
  const onPack = (done, total) => {
    const line = total ? `Packing images… ${done} / ${total}` : 'Saving project…';
    $('pmsg').textContent = line;
    btnBusy($('savep'), true, total ? `Saving… ${done}/${total}` : 'Saving…');
  };
  try {
    if (fmt === 'folder') {
      btnBusy($('savep'), true, 'Writing…');
      $('pmsg').textContent = 'Choose a folder…';
      const out = await saveProjectFolder(onPack);
      $('pmsg').textContent = `Project saved in folder “${out.folder}” (${out.images} image files + project.json).`;
    } else {
      const out = await saveProjectZip(onPack, pct => {
        $('pmsg').textContent = `Creating ZIP… ${Math.round(pct)}%`;
        btnBusy($('savep'), true, `Zipping… ${Math.round(pct)}%`);
      });
      $('pmsg').textContent = `Project saved as .book.zip (${out.mb} MB, ${out.images} images). Unzip anytime to see project.json and images/.`;
    }
  } catch (e) {
    console.error(e);
    $('pmsg').textContent = 'Could not save the project. Try fewer images or reload and add them again.';
  }
  btnBusy($('savep'), false);
  $('openp').disabled = false;
  $('prevbtn').disabled = false;
};
$('openp').onclick = () => {
  if ($('openp').classList.contains('load')) return;
  $('openfile').click();
};
$('openfile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (items.length && !confirm('Replace the current project? Unsaved work in this page will be lost.')) return;
  btnBusy($('openp'), true, 'Opening…');
  $('savep').disabled = true;
  $('prevbtn').disabled = true;
  $('pmsg').textContent = 'Reading project file…';
  try {
    await loadProjectFile(f, (done, total) => {
      $('pmsg').textContent = `Loading images… ${done} / ${total}`;
      btnBusy($('openp'), true, `Opening… ${done}/${total}`);
    });
    $('pmsg').textContent = 'Project opened.';
  } catch (err) {
    console.error(err);
    $('pmsg').textContent = err.message || 'Could not open that project.';
  }
  btnBusy($('openp'), false);
  $('savep').disabled = false;
  $('prevbtn').disabled = false;
};
$('openpf').onclick = async () => {
  if (items.length && !confirm('Replace the current project? Unsaved work in this page will be lost.')) return;
  btnBusy($('openpf'), true, 'Opening…');
  $('savep').disabled = true;
  $('prevbtn').disabled = true;
  $('openp').disabled = true;
  $('pmsg').textContent = 'Choose the project folder (with project.json)…';
  try {
    await loadProjectFolder((done, total) => {
      $('pmsg').textContent = `Loading images… ${done} / ${total}`;
      btnBusy($('openpf'), true, `Opening… ${done}/${total}`);
    });
    $('pmsg').textContent = 'Project opened from folder.';
  } catch (err) {
    console.error(err);
    $('pmsg').textContent = err.message || 'Could not open that folder.';
  }
  btnBusy($('openpf'), false);
  $('savep').disabled = false;
  $('prevbtn').disabled = false;
  $('openp').disabled = false;
};
