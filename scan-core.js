// ScanPress – searchable PDF writer (picture + invisible text you can search and copy), Word (.docx) and text
// export, image clean-up filters, search. No DOM – tested with node.
const SCN = (() => {
const b64 = (s) => { if (typeof atob === 'function') { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; } return new Uint8Array(Buffer.from(s, 'base64')); };
// "GlyphLessFont" from Tesseract OCR (Apache-2.0): one empty glyph, so the text layer is invisible but searchable
const GLYPHLESS = 'AAEAAAAKAIAAAwAgT1MvMlbeyJQAAAEoAAAAYGNtYXAACgA0AAABkAAAAB5nbHlmFSJBJAAAAbgAAAAYaGVhZAt48WUAAACsAAAANmhoZWEMAgQCAAAA5AAAACRobXR4BAAAAAAAAYgAAAAIbG9jYQAMAAAAAAGwAAAABm1heHAABAAFAAABCAAAACBuYW1l8usW2gAAAdAAAABLcG9zdAABAAEAAAIcAAAAIAABAAAAAQAAsJRxEF8PPPUEBwgAAAAAAM+a/G4AAAAA1MOn8gAAAAAEAAgAAAAAEAACAAAAAAAAAAEAAAgA//8AAAQAAAAAAAQAAAEAAAAAAAAAAAAAAAAAAAACAAEAAAACAAQAAQAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAwAAAZAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAQABAAAAAAAAAAAAAAAAAAAAAAAAAAAAR09PRwBAAAAAAAAB//8AAAABAAGAAAAAAAAAAAAAAAAAAAABAAAAAAAABAAAAAAAAAIAAQAAAAAAFAADAAAAAAAUAAYACgAAAAAAAAAAAAAAAAAMAAAAAQAAAAAEAAgAAAMAADEhESEEAPwACAAAAAADACoAAAADAAAABQAWAAAAAQAAAAAABQALABYAAwABBAkABQAWAAAAVgBlAHIAcwBpAG8AbgAgADEALgAwVmVyc2lvbiAxLjAAAAEAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA=';
const CIDMAP_FLATE = 'eNrtwgEJAAAAAqD6fzpoh2gaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgBsA/wAQ';
const PAPER = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] };

// pages: [{ jpeg: Uint8Array, iw, ih (pixels), gray (bool), words: [[x0, y0, x1, y1, text, lineHeight]] }]
// opts: { paper: 'a4' | 'letter' | 'legal' | 'image' (300 dpi), title, footer }
function toPDF(pages, opts) {
  opts = opts || {};
  const parts = [], offs = []; let size = 0, nobj = 0;
  const enc = new TextEncoder();
  const put = (x) => { const b = typeof x === 'string' ? latin(x) : x; parts.push(b); size += b.length; };
  const latin = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
  const reserve = () => ++nobj;
  const obj = (id, body, stream) => { offs[id] = size; put(`${id} 0 obj\n${body}`); if (stream) { put('\nstream\n'); put(stream); put('\nendstream'); } put('\nendobj\n'); };
  put('%PDF-1.5\n%\xe2\xe3\xcf\xd3\n');
  const font = b64(GLYPHLESS), cmap = b64(CIDMAP_FLATE);
  const fType0 = reserve(), fCid = reserve(), fDesc = reserve(), fFile = reserve(), fMap = reserve(), fUni = reserve(), pagesId = reserve(), helv = reserve();
  const uni = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n1 beginbfrange\n<0000> <FFFF> <0000>\nendbfrange\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
  obj(fType0, `<< /Type /Font /Subtype /Type0 /BaseFont /GlyphLessFont /Encoding /Identity-H /DescendantFonts [${fCid} 0 R] /ToUnicode ${fUni} 0 R >>`);
  obj(fCid, `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /GlyphLessFont /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${fDesc} 0 R /DW 500 /CIDToGIDMap ${fMap} 0 R >>`);
  obj(fDesc, `<< /Type /FontDescriptor /FontName /GlyphLessFont /Flags 5 /FontBBox [0 0 500 1000] /ItalicAngle 0 /Ascent 1000 /Descent -1 /CapHeight 1000 /StemV 80 /FontFile2 ${fFile} 0 R >>`);
  obj(fFile, `<< /Length ${font.length} /Length1 ${font.length} >>`, font);
  obj(fMap, `<< /Length ${cmap.length} /Filter /FlateDecode >>`, cmap);
  obj(fUni, `<< /Length ${uni.length} >>`, uni);
  obj(helv, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids = [];
  for (const pg of pages) {
    let pw, ph;
    if (!opts.paper || opts.paper === 'image') { pw = (pg.iw / 300) * 72; ph = (pg.ih / 300) * 72; }
    else { [pw, ph] = PAPER[opts.paper] || PAPER.a4; if (pg.iw > pg.ih) [pw, ph] = [ph, pw]; }
    const sc = Math.min(pw / pg.iw, ph / pg.ih), dw = pg.iw * sc, dh = pg.ih * sc, ox = (pw - dw) / 2, oy = (ph - dh) / 2;
    const img = reserve(), cont = reserve(), page = reserve(); kids.push(page);
    obj(img, `<< /Type /XObject /Subtype /Image /Width ${pg.iw} /Height ${pg.ih} /ColorSpace /${pg.gray ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>`, pg.jpeg);
    let s = `q ${dw.toFixed(3)} 0 0 ${dh.toFixed(3)} ${ox.toFixed(3)} ${oy.toFixed(3)} cm /Im1 Do Q\n`;
    if (pg.words && pg.words.length) {
      s += 'BT 3 Tr\n';
      for (const w of pg.words) {
        const [x0, y0, x1, y1, text] = w, lh = w[5] || y1 - y0;
        const str = String(text || '').trim(); if (!str) continue;
        const fs = Math.max(1, lh * sc * 0.85), wpt = (x1 - x0) * sc;
        const units = []; for (const ch of str + ' ') { const c = ch.codePointAt(0); if (c > 0xffff) { const v = c - 0x10000; units.push(0xd800 + (v >> 10), 0xdc00 + (v & 1023)); } else units.push(c); }
        const tz = (wpt / (units.length * 0.5 * fs)) * 100;
        const hex = units.map((u) => u.toString(16).padStart(4, '0')).join('');
        s += `/F1 ${fs.toFixed(2)} Tf ${Math.max(1, tz).toFixed(2)} Tz 1 0 0 1 ${(ox + x0 * sc).toFixed(2)} ${(oy + dh - y1 * sc + (y1 - y0) * sc * 0.15).toFixed(2)} Tm <${hex}> Tj\n`;
      }
      s += 'ET\n';
    }
    if (opts.footer) s += `BT 0 Tr /F2 7 Tf 0.45 g 24 12 Td (${opts.footer.replace(/[()\\]/g, '')}) Tj ET\n`;
    const cs = latin(s);
    obj(cont, `<< /Length ${cs.length} >>`, cs);
    obj(page, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << /XObject << /Im1 ${img} 0 R >> /Font << /F1 ${fType0} 0 R /F2 ${helv} 0 R >> >> /Contents ${cont} 0 R >>`);
  }
  obj(pagesId, `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`);
  const info = reserve(), cat = reserve();
  const t = opts.title || 'Scanned document', th = Array.from(t).map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  obj(info, `<< /Producer (ScanPress) /Title <feff${th}> >>`);
  obj(cat, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const xref = size;
  let x = `xref\n0 ${nobj + 1}\n0000000000 65535 f \n`; for (let i = 1; i <= nobj; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  put(x + `trailer\n<< /Size ${nobj + 1} /Root ${cat} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(size); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---------- OCR result → compact words / paragraphs ----------
function fromTesseract(data) {
  const words = [], paras = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) {
    const lines = [];
    for (const l of p.lines || []) {
      const lh = l.bbox.y1 - l.bbox.y0, ws = [];
      for (const w of l.words || []) { words.push([w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1, w.text, lh]); ws.push(w.text); }
      lines.push(ws.join(' '));
    }
    paras.push(lines.join('\n'));
  }
  return { words, paras, text: paras.join('\n\n'), conf: Math.round(data.confidence || 0) };
}
// lines that end with a hyphen are joined; single line breaks inside a paragraph become spaces
function tidyPara(p) { return p.replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(); }
function pageText(pg) { if (pg.edited != null) return pg.edited; return (pg.ocr ? pg.ocr.paras : []).map(tidyPara).filter(Boolean).join('\n\n'); }
function docText(doc) { return doc.pages.map(pageText).join('\n\n\f\n\n').replace(/\n\n\f\n\n$/, ''); }

// ---------- Word ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const [name, data0] of files) {
    const nb = enc.encode(name), data = typeof data0 === 'string' ? enc.encode(data0) : data0, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(h.buffer), nb, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nb); off += 30 + nb.length + data.length;
  }
  const cs = central.reduce((n, x) => n + x.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)], n = all.reduce((k, x) => k + x.length, 0), out = new Uint8Array(n); let o = 0; for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}
function toDocx(doc) {
  const x = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const body = [];
  doc.pages.forEach((pg, i) => {
    if (i) body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    for (const para of pageText(pg).split(/\n\s*\n/)) { const t = para.trim(); if (t) body.push(`<w:p><w:r><w:t xml:space="preserve">${x(t.replace(/\n/g, ' '))}</w:t></w:r></w:p>`); }
  });
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`],
    ['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`],
  ];
  return zip(files);
}

// ---------- image clean-up (works on RGBA pixel arrays) ----------
function toGray(px) { const n = px.length / 4, g = new Uint8ClampedArray(n); for (let i = 0; i < n; i++) g[i] = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000; return g; }
// "scan look": lighter paper, darker ink (levels from the 2% and 98% points)
function enhance(px) {
  const g = toGray(px), hist = new Uint32Array(256); for (const v of g) hist[v]++;
  const n = g.length; let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.005) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.3) { hi = v; break; } } // most of a page is paper
  lo = Math.min(lo, 110); hi = Math.max(hi, lo + 90); if (hi > 255) hi = 255;
  const k = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, (px[i + c] - lo) * k));
  return px;
}
function grayscale(px) { const g = toGray(px); for (let i = 0; i < g.length; i++) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = g[i]; } return px; }
// black & white with a local threshold (copes with shadows and uneven light)
function blackWhite(px, w, h) {
  const g = toGray(px), I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
  const r = Math.max(8, Math.round(Math.min(w, h) / 40));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0], mean = sum / ((x1 - x0) * (y1 - y0));
    const v = g[y * w + x] < mean * 0.86 ? 0 : 255, o = (y * w + x) * 4; px[o] = px[o + 1] = px[o + 2] = v;
  }
  return px;
}

// ---------- search across documents ----------
function search(docs, q) {
  q = String(q || '').trim(); if (!q) return [];
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const nq = norm(q), out = [];
  for (const d of docs) d.pages.forEach((pg, i) => { const t = pageText(pg), nt = norm(t); let k = nt.indexOf(nq); if (k >= 0 || norm(d.name).includes(nq)) { k = Math.max(0, k); out.push({ doc: d.id, page: i, snip: t.slice(Math.max(0, k - 40), k + nq.length + 60).replace(/\s+/g, ' ') }); } });
  return out;
}
const safeName = (s) => String(s || 'Scan').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Scan';

// Tesseract language codes people use most (name, code)
const LANGS = [['English', 'eng'], ['Vietnamese', 'vie'], ['Spanish', 'spa'], ['French', 'fra'], ['German', 'deu'], ['Italian', 'ita'], ['Portuguese', 'por'], ['Dutch', 'nld'], ['Polish', 'pol'], ['Czech', 'ces'], ['Romanian', 'ron'], ['Hungarian', 'hun'], ['Swedish', 'swe'], ['Danish', 'dan'], ['Norwegian', 'nor'], ['Finnish', 'fin'], ['Greek', 'ell'], ['Turkish', 'tur'], ['Russian', 'rus'], ['Ukrainian', 'ukr'], ['Arabic', 'ara'], ['Hebrew', 'heb'], ['Hindi', 'hin'], ['Bengali', 'ben'], ['Thai', 'tha'], ['Indonesian', 'ind'], ['Malay', 'msa'], ['Filipino', 'fil'], ['Chinese (Simplified)', 'chi_sim'], ['Chinese (Traditional)', 'chi_tra'], ['Japanese', 'jpn'], ['Korean', 'kor']];

return { toPDF, fromTesseract, tidyPara, pageText, docText, toDocx, zip, enhance, grayscale, blackWhite, search, safeName, LANGS, PAPER };
})();
if (typeof module !== 'undefined') module.exports = SCN;
