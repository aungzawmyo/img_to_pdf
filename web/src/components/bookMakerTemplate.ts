/** Static markup for the book maker UI. */
export const BOOK_MAKER_MARKUP = `
<main>
<h1>📚 PDF Book Maker</h1>
<div class="grid">
 <section class="card">
  <h2>1. Cover</h2>
  <label>Book title</label><input type="text" id="title" value="My Photo Book">
  <label>Author / subtitle (optional)</label><input type="text" id="author">
  <div class="row">
   <div><label>Background</label><input type="color" id="bg" value="#2f5d8a"></div>
   <div><label>Text color</label><input type="color" id="fg" value="#ffffff"></div>
  </div>
  <div class="row">
   <div><label>Text position</label><select id="pos"><option value="top">Top</option><option value="center" selected>Center</option><option value="bottom">Bottom</option></select></div>
   <div><label>Font</label><select id="font"><option value="'Noto Sans Thai','Noto Sans Myanmar',Georgia,serif">Serif / Thai / Burmese</option><option value="'Noto Sans Thai','Noto Sans Myanmar',Arial,sans-serif">Sans / Thai / Burmese</option></select></div>
  </div>
  <label>Cover image (optional)</label><input type="file" id="coverfile" accept="image/*">
  <div class="mt12"><canvas id="cv"></canvas></div>
 </section>
 <section class="card">
  <h2>2. Options</h2>
  <div class="row">
   <div><label>Page size</label><select id="size"><option value="a4">A4</option><option value="letter">Letter</option><option value="match">Match image size</option></select></div>
   <div><label>Orientation</label><select id="orient"><option value="p">Portrait</option><option value="l">Landscape</option></select></div>
  </div>
  <div class="row">
   <div><label>Fit mode</label><select id="fit"><option value="fit">Fit (keep whole image)</option><option value="fill">Fill (crop)</option><option value="stretch">Stretch</option></select></div>
   <div><label>Margins</label><select id="margin"><option value="0">None</option><option value="8" selected>Small</option><option value="20">Large</option></select></div>
  </div>
  <div class="row">
   <div><label>Quality</label><select id="quality"><option value="2400,0.92">High</option><option value="1600,0.8" selected>Medium</option><option value="1000,0.65">Small file</option></select></div>
   <div><label>Page numbers</label><select id="pnum"><option value="1">On</option><option value="0">Off</option></select></div>
  </div>
  <div class="row">
   <div><label>Images per page</label><select id="per"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="6">6</option></select></div>
   <div><label>Gap between images</label><select id="gap"><option value="2">Tight</option><option value="4" selected>Normal</option><option value="8">Wide</option></select></div>
  </div>
  <p class="hint">Titles in Thai or Burmese work: the cover is drawn with web fonts. More than one image per page uses the page size above.</p>
 </section>
</div>
<section class="card">
 <h2>3. Images <span id="count" class="hint"></span></h2>
 <div class="row">
  <div><label>Import size</label><select id="importq"><option value="tiny">Tiny (1200 px, ~0.35 MB)</option><option value="small" selected>Small (1600 px, ~0.55 MB)</option><option value="fast">Fast (1800 px, ~0.85 MB)</option><option value="balanced">Balanced (2400 px, ~1.3 MB)</option><option value="best">Best (3200 px, ~2.2 MB)</option></select></div>
 </div>
 <div id="drop" class="mt8"><span id="droplabel">Drop images here or click to choose (JPG, PNG, WebP)</span><input type="file" id="files" accept="image/*" multiple hidden></div>
 <div id="impstat" class="impstat" hidden>
  <div class="impstat-row"><span class="impstat-spin" aria-hidden="true"></span><span id="impmsg">Importing…</span></div>
  <progress id="impprog" value="0" max="1"></progress>
 </div>
 <div id="thumbs"></div>
 <p class="hint">Drag thumbnails to reorder. ✎ opens the editor. Up to 6 images import at once; files already under the size budget skip re-encode. Smaller Import size = faster and lighter projects.</p>
</section>
<section class="card">
 <h2>4. Preview and download</h2>
 <div class="row">
  <div><label>Save as</label><select id="savefmt"><option value="zip" selected>ZIP archive (.book.zip)</option><option value="folder">Folder (Chrome / Edge)</option></select></div>
 </div>
 <div class="row mt8">
  <button class="p" id="prevbtn">Preview PDF</button>
  <button type="button" id="savep">Save project</button>
  <button type="button" id="openp">Open ZIP or JSON</button>
  <button type="button" id="openpf" hidden>Open folder</button>
  <input type="file" id="openfile" accept=".json,.zip,application/json,application/zip" hidden>
 </div>
 <p class="hint">Projects store <code>project.json</code> plus an <code>images/</code> folder. ZIP is one download; Folder writes the same layout to disk.</p>
 <div id="msg" class="hint mt8"></div>
 <div id="pmsg" class="hint"></div>
</section>
</main>
<div class="modal" id="ed"><div class="mb">
 <div class="row hist" id="histrow">
  <button type="button" id="undo" disabled>Undo</button>
  <button type="button" id="redo" disabled>Redo</button>
  <span class="hint" id="histmsg">Ctrl+Z undoes. Ctrl+Y or Ctrl+Shift+Z redoes.</span>
 </div>
 <div class="row tabs" id="tabs">
  <button type="button" data-t="crop" class="on">Crop</button><button type="button" data-t="transform">Transform</button><button type="button" data-t="warp">Warp</button><button type="button" data-t="adjust">Adjust</button><button type="button" data-t="sticker">Stickers</button><button type="button" data-t="text">Text</button><button type="button" data-t="ai">AI</button>
 </div>
 <div class="stage-wrap"><div class="stage"><canvas id="ec"></canvas><div class="ov" id="ov"></div></div></div>
 <div class="pn" data-t="crop"><div class="row" id="ars">
  <button type="button" data-a="0">Free</button><button type="button" data-a="1">1:1</button><button type="button" data-a="1.3333">4:3</button><button type="button" data-a="0.75">3:4</button><button type="button" data-a="1.7778">16:9</button><button type="button" data-a="-1">Reset</button></div></div>
 <div class="pn" data-t="transform">
  <div class="row"><button type="button" id="rl">⟲ Left</button><button type="button" id="rr">⟳ Right</button><button type="button" id="fh">⇋ Flip H</button><button type="button" id="fv">⇅ Flip V</button></div>
  <label>Straighten <span id="angv">0.0°</span></label>
  <input type="range" id="ang" min="-45" max="45" step="0.1" value="0">
  <div class="row mt8"><button type="button" id="ang0">Reset angle</button></div>
  <p class="hint">Use this to level a tilted photo. Empty corners are cropped away.</p>
 </div>
 <div class="pn" data-t="warp" hidden><p class="hint">Grid warp, like Photoshop: pick a grid size, then drag the points to push and pull the image.</p>
 <div class="row" id="wgs"><button type="button" data-g="2">2x2</button><button type="button" data-g="3" class="on">3x3</button><button type="button" data-g="4">4x4</button><button type="button" data-g="5">5x5</button><button type="button" id="wrst">Reset warp</button></div></div>
 <div class="pn" data-t="adjust" hidden>
  <label>Filter preset</label>
  <div class="presets" id="filters"></div>
  <div class="row"><div><label>Brightness</label><input type="range" id="sb" min="-100" max="100" value="0"></div><div><label>Contrast</label><input type="range" id="sc" min="-100" max="100" value="0"></div></div>
  <div class="row"><div><label>Saturation</label><input type="range" id="ss" min="-100" max="100" value="0"></div><div><label>Warmth</label><input type="range" id="sw" min="-100" max="100" value="0"></div></div>
  <div class="row mt8"><button type="button" id="auto">✨ Auto enhance</button><button type="button" id="adjr">Reset adjustments</button></div></div>
 <div class="pn" data-t="sticker" hidden><div class="row emo" id="emo"></div></div>
 <div class="pn" data-t="text" hidden>
  <label>Text (long text wraps automatically)</label><textarea id="ttxt" rows="2"></textarea>
  <div class="row"><input type="color" id="tcol" value="#ffffff"><button type="button" id="addt">Add text</button></div></div>
 <div class="pn" data-t="ai" hidden>
  <div class="row"><div><label>Provider</label><select id="aip"><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select></div>
  <div><label>Model</label><input type="text" id="aim" value="gpt-image-1"></div></div>
  <label>API key (kept in memory only)</label><input type="password" id="aik" autocomplete="off">
  <label>What should change?</label><textarea id="aipr" rows="2" placeholder="e.g. remove the background, make it look like a watercolor"></textarea>
  <div class="row mt8"><button type="button" id="aigo" class="p">Apply AI edit</button><button type="button" id="aibg">Remove background</button><button type="button" id="airv">Revert AI</button></div>
  <p class="hint" id="aist">Calls go straight from your browser to the provider. Remove background asks for a transparent PNG. Use the downloaded local copy if the hosted page blocks outside requests.</p></div>
 <div id="elbar" class="row mt8" hidden><div><label>Size of selected item</label><input type="range" id="esize" min="3" max="60" value="15"></div><button type="button" id="edel">Delete item</button></div>
 <div class="row mt12"><button type="button" id="eall">Apply filter, crop ratio, and adjustments to all</button></div>
 <p class="hint" id="eallmsg"></p>
 <div class="row mt8"><button type="button" id="ecan">Cancel</button><button type="button" class="p" id="esave">Save edits</button></div>
</div></div>
<div class="modal" id="pv"><div class="mb">
 <h2>Preview <span id="pvn" class="hint"></span></h2>
 <div id="pvbox"></div>
 <div class="row mt10"><button type="button" id="pp">◀ Prev</button><button type="button" id="pnx">Next ▶</button></div>
 <progress id="prog" value="0" max="1" hidden></progress>
 <div id="pvmsg" class="hint"></div>
 <div class="row mt10"><button type="button" id="pcl">Back to editing</button><button type="button" class="p" id="pdl">Download PDF</button></div>
</div></div>
`;