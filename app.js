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
  coverImg = f ? await loadImg(URL.createObjectURL(f)) : null;
  preview();
};
document.fonts && document.fonts.ready.then(preview);
preview();

/* ---------- image editing pipeline ---------- */
const newEdit = () => ({ rot: 0, fx: false, fy: false, crop: null, ar: 0, b: 0, c: 0, s: 0, w: 0, auto: false, els: [], ai: null, aiImg: null, wp: null });
const newWp = (g = 3) => {
  const p = [];
  for (let j = 0; j <= g; j++) for (let i = 0; i <= g; i++) p.push([i / g, j / g]);
  return { g, p };
};

function adjust(cv, e) {
  if (!(e.b || e.c || e.s || e.w || e.auto)) return;
  const c = cv.getContext('2d'), d = c.getImageData(0, 0, cv.width, cv.height), p = d.data;
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
    p[i] = y + (r - y) * sf;
    p[i + 1] = y + (g - y) * sf;
    p[i + 2] = y + (b - y) * sf;
  }
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

function bake(img, e, max, o = {}) {
  const src = e.ai ? e.aiImg : img, od = e.rot % 180 !== 0, sw = src.width, sh = src.height, fw = od ? sh : sw, fh = od ? sw : sh;
  const s = Math.min(1, max / Math.max(fw, fh));
  let t = mk(Math.round(fw * s), Math.round(fh * s)), c = t.getContext('2d');
  c.translate(t.width / 2, t.height / 2);
  c.scale(e.fx ? -1 : 1, e.fy ? -1 : 1);
  c.rotate(e.rot * Math.PI / 180);
  c.drawImage(src, -sw * s / 2, -sh * s / 2, sw * s, sh * s);
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

function updateThumb(it) {
  it.th = bake(it.img, it.e, 240).toDataURL('image/jpeg', .7);
}

/* ---------- gallery ---------- */
async function addFiles(list) {
  list = Array.from(list);
  for (const f of list) {
    if (!/^image\/(jpeg|png|webp|gif|bmp)/.test(f.type)) continue;
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImg(url);
      const it = { url, img, e: newEdit() };
      updateThumb(it);
      items.push(it);
    } catch (x) {}
    renderThumbs();
  }
}

function renderThumbs() {
  const box = $('thumbs');
  box.innerHTML = '';
  $('count').textContent = items.length ? `(${items.length})` : '';
  items.forEach((it, i) => {
    const d = document.createElement('div');
    d.className = 't';
    d.draggable = true;
    d.innerHTML = `<span class="n">${i + 1}</span><div class="im"><img src="${it.th}"></div><div class="b"><button data-a="e" title="Edit">✎</button><button data-a="r" title="Rotate">⟳</button><button data-a="d" title="Delete">✕</button></div>`;
    d.querySelector('[data-a=e]').onclick = () => openEd(it);
    d.querySelector('[data-a=r]').onclick = () => {
      it.e.rot = (it.e.rot + 90) % 360;
      it.e.crop = null;
      it.e.wp = null;
      updateThumb(it);
      renderThumbs();
    };
    d.querySelector('[data-a=d]').onclick = () => {
      URL.revokeObjectURL(it.url);
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

/* ---------- editor ---------- */
let cur = null, E = null, tab = 'crop', selEl = null;
const EMO = ['⭐', '❤️', '😀', '🔥', '🎉', '🌸', '👍', '✨', '📍', '🎈', '☀️', '🌈'];
$('emo').innerHTML = EMO.map(x => `<button>${x}</button>`).join('');
$('emo').onclick = e => {
  if (e.target.tagName !== 'BUTTON') return;
  selEl = { k: 's', v: e.target.textContent, x: .5, y: .5, size: .15 };
  E.els.push(selEl);
  $('esize').value = 15;
  renderOv();
};
$('addt').onclick = () => {
  const v = $('ttxt').value.trim();
  if (!v) return;
  selEl = { k: 't', v, x: .5, y: .5, size: .07, color: $('tcol').value };
  E.els.push(selEl);
  $('esize').value = 7;
  renderOv();
};
$('esize').oninput = e => { if (selEl) { selEl.size = e.target.value / 100; renderOv(); } };
$('edel').onclick = () => {
  if (selEl) {
    E.els = E.els.filter(o => o !== selEl);
    selEl = null;
    renderOv();
  }
};

function openEd(it) {
  cur = it;
  E = JSON.parse(JSON.stringify({ ...it.e, aiImg: null }));
  E.aiImg = it.e.aiImg;
  selEl = null;
  ['b', 'c', 's', 'w'].forEach(k => $({ b: 'sb', c: 'sc', s: 'ss', w: 'sw' }[k]).value = E[k]);
  document.querySelectorAll('#wgs [data-g]').forEach(b => b.classList.toggle('on', +b.dataset.g === (E.wp ? E.wp.g : 3)));
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
  ec.getContext('2d').drawImage(cv, 0, 0);
}

function refresh() {
  drawPrev();
  renderOv();
}

function drag(ev, fn) {
  ev.preventDefault();
  ev.stopPropagation();
  const r = $('ec').getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY;
  const mv = m => fn((m.clientX - sx) / r.width, (m.clientY - sy) / r.height, r);
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
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
        });
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
      });
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
      });
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
      });
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
};

const turn = d => { E.rot = (E.rot + d + 360) % 360; E.crop = null; E.ar = 0; E.wp = null; refresh(); };
$('rl').onclick = () => turn(-90);
$('rr').onclick = () => turn(90);
$('fh').onclick = () => { E.fx = !E.fx; E.crop = null; E.wp = null; refresh(); };
$('fv').onclick = () => { E.fy = !E.fy; E.crop = null; E.wp = null; refresh(); };
$('wgs').onclick = e => {
  const g = e.target.dataset.g;
  if (g) {
    E.wp = newWp(+g);
    document.querySelectorAll('#wgs [data-g]').forEach(b => b.classList.toggle('on', b === e.target));
    refresh();
  } else if (e.target.id === 'wrst') {
    E.wp = newWp(E.wp ? E.wp.g : 3);
    refresh();
  }
};
$('ecan').onclick = () => $('ed').classList.remove('on');
$('esave').onclick = () => {
  const w = E.wp;
  if (w && JSON.stringify(w.p) === JSON.stringify(newWp(w.g).p)) E.wp = null;
  const k = E.crop;
  if (k && k.x < .001 && k.y < .001 && k.w > .999 && k.h > .999) E.crop = null;
  cur.e = E;
  updateThumb(cur);
  renderThumbs();
  $('ed').classList.remove('on');
};

/* ---------- AI edit (OpenAI / Gemini) ---------- */
$('aip').onchange = () => $('aim').value = $('aip').value === 'openai' ? 'gpt-image-1' : 'gemini-2.5-flash-image';
const st = m => $('aist').textContent = m;
$('airv').onclick = () => { E.ai = null; E.aiImg = null; E.crop = null; st('Reverted to the original image.'); refresh(); };
$('aigo').onclick = async () => {
  const prov = $('aip').value, key = $('aik').value.trim(), pr = $('aipr').value.trim(), model = $('aim').value.trim();
  if (!key || !pr) { st('Enter an API key and a prompt first.'); return; }
  st('Sending to ' + prov + '…');
  $('aigo').disabled = true;
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
    E.fx = E.fy = false;
    E.crop = null;
    E.wp = null;
    st('Done. Check the result, then Save edits.');
    refresh();
  } catch (e) {
    st('AI edit failed: ' + e.message + '. The hosted page blocks outside requests; use the downloaded local copy.');
  }
  $('aigo').disabled = false;
};

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

async function buildPages(maxPx, q, dpi, prog) {
  const m = +$('margin').value, fit = $('fit').value, match = $('size').value === 'match', [bw, bh] = match ? SIZES.a4 : pageDims();
  await document.fonts.load(`700 40px ${$('font').value}`, $('title').value + $('author').value).catch(() => {});
  const cc = mk(1, 1);
  drawCover(cc, Math.round(bw / 25.4 * dpi), Math.round(bh / 25.4 * dpi));
  const pages = [{ pw: bw, ph: bh, data: cc.toDataURL('image/jpeg', .9), dw: bw, dh: bh }];
  for (let i = 0; i < items.length; i++) {
    const it = items[i], k = it.e.crop, sc = bake(it.img, it.e, Math.min(4000, maxPx / (k ? Math.max(k.w, k.h) : 1)));
    let pw = bw, ph = bh;
    if (match) { pw = sc.width * 25.4 / 150 + 2 * m; ph = sc.height * 25.4 / 150 + 2 * m; }
    pages.push({ pw, ph, num: i + 1, ...renderPage(sc, pw, ph, m, match ? 'fit' : fit, maxPx, q) });
    prog(i + 2, items.length + 1);
    await tick();
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
