/* ================================================================
   Cute Fusion Lab — v4
   Two tabs: Combine (2 photos) / Effects (1 photo)
   Visual-only selections: gender, hair length, effect cards.
   ================================================================ */

const API_BASE = window.VITE_API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:8001' : '/api');

// ---- DOM (Combine tab) ----
const personAInput = document.getElementById("personA");
const personBInput = document.getElementById("personB");
const previewA     = document.getElementById("previewA");
const previewB     = document.getElementById("previewB");
const dropA        = document.getElementById("dropA");
const dropB        = document.getElementById("dropB");
const clearA       = document.getElementById("clearA");
const clearB       = document.getElementById("clearB");
const combineBtn   = document.getElementById("combineBtn");

// ---- DOM (Effects tab) ----
const personFxInput = document.getElementById("personFx");
const previewFx     = document.getElementById("previewFx");
const dropFx        = document.getElementById("dropFx");
const clearFx       = document.getElementById("clearFx");
const effectsGrid   = document.getElementById("effectsGrid");
const generateBtn   = document.getElementById("generateBtn");

// ---- DOM (shared) ----
const regenerateBtn = document.getElementById("regenerateBtn");
const statusEl      = document.getElementById("status");
const resultFrame   = document.getElementById("resultFrame");
const resultImage   = document.getElementById("resultImage");
const downloadLink  = document.getElementById("downloadLink");
const resultBtns    = document.getElementById("resultBtns");
const resultSub     = document.getElementById("resultSub");

// ---- DOM (share card) ----
const shareBtn       = document.getElementById("shareBtn");
const shareModal     = document.getElementById("shareModal");
const shareClose     = document.getElementById("shareClose");
const sharePreview   = document.getElementById("sharePreview");
const shareImage     = document.getElementById("shareImage");
const shareNativeBtn = document.getElementById("shareNativeBtn");
const shareDownload  = document.getElementById("shareDownload");
const shareCopy      = document.getElementById("shareCopy");
const shareHint      = document.getElementById("shareHint");
let shareBlob      = null;
let shareObjectUrl = null;

// ---- Effects data ----
const EFFECTS = [
  { key: "trump",     icon: "\u{1F454}",       title: "Trump",          desc: "Presidential business mogul." },
  { key: "obama",     icon: "\u{1F3DB}\uFE0F", title: "Obama",          desc: "Charismatic world leader." },
  { key: "hulk",      icon: "\u{1F4AA}",       title: "Hulk",           desc: "Giant green powerhouse." },
  { key: "rock",      icon: "\u{1F4AA}",       title: "The Rock",       desc: "Action hero movie star." },
  { key: "anime",     icon: "\u{1F338}",       title: "Anime",          desc: "Japanese anime character." },
  { key: "cyberpunk", icon: "\u{1F916}",       title: "Cyberpunk",      desc: "Neon-lit cyber augmentation." },
  { key: "angel",     icon: "\u{1F607}",       title: "Angel",          desc: "Celestial being with wings." },
  { key: "devil",     icon: "\u{1F608}",       title: "Devil",          desc: "Dark lord with horns." },
  { key: "executive", icon: "\u{1F4BC}",       title: "CEO",            desc: "Fortune 500 executive." },
  { key: "emperor",   icon: "\u{1FA90}",       title: "Space Emperor",  desc: "Cosmic ruler in armor." },
];

let activeTab = "combine";
let selectedEffect = null;
let backendOk = null;
let lastMode = null;
let lastTab = null;

// ---- Rate limit modal ----
const rlOverlay  = document.getElementById("rlOverlay");
const rlDismiss  = document.getElementById("rlDismiss");
const rlCount    = document.getElementById("rlCount");

function showRateLimitModal(count) {
  rlCount.textContent = count;
  rlOverlay.classList.add("open");
}
function hideRateLimitModal() {
  rlOverlay.classList.remove("open");
}
rlDismiss.addEventListener("click", hideRateLimitModal);
rlOverlay.addEventListener("click", (e) => { if (e.target === rlOverlay) hideRateLimitModal(); });

// ---- Toggle groups (gender + hair per tab) ----
const toggleState = {
  combineAge: "kid",
  combineGender: "",
  combineHair: "",
  combineSkin: "",
  combineEyes: "",
  combineNose: "",
  combineEars: "",
  combineCheekbones: "",
  combineJawline: "",
  fxGender: "",
  fxHair: "",
};

// ---- Helpers ----
function setStatus(msg, type = "info") {
  statusEl.textContent = msg;
  statusEl.className = `status-msg ${type}`;
}

function hasCombinePhotos() {
  return !!(personAInput.files?.[0] && personBInput.files?.[0]);
}

function hasFxPhoto() {
  return !!personFxInput.files?.[0];
}

function updateButtons() {
  combineBtn.disabled = !hasCombinePhotos();
  generateBtn.disabled = !hasFxPhoto() || !selectedEffect;
}

// ---- Backend probe ----
async function probeBackend() {
  try {
    const r = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    backendOk = r.ok;
  } catch { backendOk = false; }
  return backendOk;
}

// ---- Tabs ----
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    document.querySelector(`.tab-panel[data-tab="${activeTab}"]`).classList.add("active");
    updateButtons();
  });
});

// ---- Toggle groups (gender + hair) ----
document.querySelectorAll(".toggle-group").forEach((group) => {
  group.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    const name = group.dataset.name;
    toggleState[name] = btn.dataset.value;
    group.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// ---- Dropzones ----
function setupDrop(dropEl, inputEl, previewEl, clearBtn) {
  const show = (f) => { previewEl.src = URL.createObjectURL(f); dropEl.classList.add("has-image"); updateButtons(); };
  const clear = (e) => { if(e){e.preventDefault();e.stopPropagation()} inputEl.value=""; previewEl.src=""; dropEl.classList.remove("has-image"); updateButtons(); };

  inputEl.addEventListener("change", () => { if(inputEl.files?.[0]) show(inputEl.files[0]); });
  clearBtn.addEventListener("click", clear);

  dropEl.addEventListener("dragenter", (e) => { e.preventDefault(); dropEl.classList.add("drag-over"); });
  dropEl.addEventListener("dragover",  (e) => { e.preventDefault(); });
  dropEl.addEventListener("dragleave", ()  => { dropEl.classList.remove("drag-over"); });
  dropEl.addEventListener("drop", (e) => {
    e.preventDefault(); dropEl.classList.remove("drag-over");
    const f = e.dataTransfer?.files?.[0];
    if (f?.type.startsWith("image/")) {
      const dt = new DataTransfer(); dt.items.add(f); inputEl.files = dt.files;
      show(f);
    }
  });
}

// ---- Effects grid ----
function renderEffects() {
  effectsGrid.innerHTML = "";
  EFFECTS.forEach((fx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `fx-card${fx.key === selectedEffect ? " active" : ""}`;
    btn.innerHTML = `<span class="fx-icon">${fx.icon}</span><h3>${fx.title}</h3><p>${fx.desc}</p>`;
    btn.addEventListener("click", () => {
      selectedEffect = (selectedEffect === fx.key) ? null : fx.key;
      renderEffects();
      updateButtons();
    });
    effectsGrid.appendChild(btn);
  });
}

// ---- API call ----
async function callGenerate(mode, btn, tab) {
  if (tab === "combine" && !hasCombinePhotos()) { setStatus("Upload both photos first.", "error"); return; }
  if (tab === "effects" && !hasFxPhoto()) { setStatus("Upload a photo first.", "error"); return; }
  if (backendOk === null || !backendOk) await probeBackend();
  if (!backendOk) { setStatus("Backend is offline. Start the server first.", "error"); return; }

  btn.disabled = true;
  btn.classList.add("loading");
  lastMode = mode;
  lastTab = tab;
  setStatus("Sending to AI \u2014 this takes 15-30 seconds\u2026", "info");

  try {
    const form = new FormData();

    if (tab === "combine") {
      form.append("person_a", personAInput.files[0]);
      form.append("person_b", personBInput.files[0]);
      if (toggleState.combineGender) form.append("gender", toggleState.combineGender);
      if (toggleState.combineHair) form.append("hair", toggleState.combineHair);
      if (toggleState.combineSkin) form.append("skin", toggleState.combineSkin);
      if (toggleState.combineEyes) form.append("eyes", toggleState.combineEyes);
      if (toggleState.combineNose) form.append("nose", toggleState.combineNose);
      if (toggleState.combineEars) form.append("ears", toggleState.combineEars);
      if (toggleState.combineCheekbones) form.append("cheekbones", toggleState.combineCheekbones);
      if (toggleState.combineJawline) form.append("jawline", toggleState.combineJawline);
    } else {
      form.append("person_a", personFxInput.files[0]);
      // No person_b for effects — single photo mode
      const gender = toggleState.fxGender;
      const hair = toggleState.fxHair;
      if (gender) form.append("gender", gender);
      if (hair) form.append("hair", hair);
    }

    form.append("mode", mode);

    const resp = await fetch(`${API_BASE}/api/generate`, { method: "POST", body: form });
    if (resp.status === 429) {
      const body = await resp.json().catch(() => ({}));
      const count = body.detail?.queries_used ?? "a few";
      showRateLimitModal(count);
      setStatus("Rate limit reached.", "error");
      return;
    }
    // 503 = demo paused via the central kill switch. Distinct from the 429 CTA —
    // a paused demo is an operator action, not the user hitting a limit.
    if (resp.status === 503) {
      const body = await resp.json().catch(() => ({}));
      const msg = body.detail?.message || "This demo is temporarily paused. Check back soon.";
      setStatus("⏸️ " + msg, "error");
      return;
    }
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(err.detail || `Error ${resp.status}`);
    }
    const data = await resp.json();
    const url = data.image_url.startsWith("http") ? data.image_url : `${API_BASE}${data.image_url}`;
    showResult(url, data.mode);
    setStatus(`Done! Mode: ${data.mode}`, "info");
  } catch (err) {
    setStatus(err.message || "Generation failed.", "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
    updateButtons();
  }
}

function showResult(src, mode) {
  resultImage.src = src;
  resultFrame.classList.add("has-image");
  downloadLink.href = src;
  resultBtns.classList.add("visible");
  resultSub.textContent = `AI fusion \u2014 ${mode}`;
  document.getElementById("resultSection").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---- Camera ----
const camModal   = document.getElementById("camModal");
const camVideo   = document.getElementById("camVideo");
const camCanvas  = document.getElementById("camCanvas");
const camCapture = document.getElementById("camCapture");
const camCancel  = document.getElementById("camCancel");
let camStream = null;
let camTargetId = null;

// Map input IDs to their dropzone/preview/clear elements
const inputMap = {
  personA:  { drop: dropA,  preview: previewA,  input: personAInput,  clear: clearA },
  personB:  { drop: dropB,  preview: previewB,  input: personBInput,  clear: clearB },
  personFx: { drop: dropFx, preview: previewFx, input: personFxInput, clear: clearFx },
};

function stopCam() {
  if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; }
  camModal.classList.remove("open");
}

document.querySelectorAll(".cam-btn").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    camTargetId = btn.dataset.target;
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1024 }, height: { ideal: 1024 } },
        audio: false,
      });
      camVideo.srcObject = camStream;
      camModal.classList.add("open");
    } catch {
      setStatus("Camera not available.", "error");
    }
  });
});

camCapture.addEventListener("click", () => {
  const w = camVideo.videoWidth;
  const h = camVideo.videoHeight;
  const side = Math.min(w, h);
  camCanvas.width = side;
  camCanvas.height = side;
  const ctx = camCanvas.getContext("2d");
  ctx.drawImage(camVideo, (w - side) / 2, (h - side) / 2, side, side, 0, 0, side, side);

  camCanvas.toBlob((blob) => {
    if (!blob || !camTargetId) return;
    const file = new File([blob], "camera-photo.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    const target = inputMap[camTargetId];
    if (target) {
      target.input.files = dt.files;
      target.preview.src = URL.createObjectURL(blob);
      target.drop.classList.add("has-image");
      updateButtons();
    }
    stopCam();
  }, "image/png");
});

camCancel.addEventListener("click", stopCam);

// ---- Setup ----
setupDrop(dropA, personAInput, previewA, clearA);
setupDrop(dropB, personBInput, previewB, clearB);
setupDrop(dropFx, personFxInput, previewFx, clearFx);

combineBtn.addEventListener("click", () => {
  const ageMap = { baby: "merge_baby", kid: "merge", adult: "merge_adult" };
  const mode = ageMap[toggleState.combineAge] || "merge";
  callGenerate(mode, combineBtn, "combine");
});
generateBtn.addEventListener("click", () => { if (selectedEffect) callGenerate(selectedEffect, generateBtn, "effects"); });
regenerateBtn.addEventListener("click", () => { if (lastMode && lastTab) callGenerate(lastMode, regenerateBtn, lastTab); });

// ================================================================
//  SHARE CARD
//  Builds a branded, ready-to-post PNG entirely on a <canvas>: the
//  original input photo(s) + result + a baked-in "make your own"
//  invite. No backend, no upload — everything stays in the browser.
// ================================================================
const BRAND = "CUTE FUSION LAB";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Keep the canvas untainted so we can export it. The result image is
    // served with CORS headers; parent previews are same-origin blob: URLs.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("An image failed to load"));
    img.src = src;
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Draw an image cropped to "cover" a rounded box, with a green frame.
function drawCover(ctx, img, x, y, w, h, r) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(34,197,94,.55)";
  ctx.stroke();
  ctx.restore();
}

function greenGradient(ctx, x0, x1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, "#22c55e");
  g.addColorStop(1, "#4ade80");
  return g;
}

function paintBackground(ctx, W, H) {
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, W, H);
  const g1 = ctx.createRadialGradient(W * 0.15, H * 0.08, 0, W * 0.15, H * 0.08, W * 0.75);
  g1.addColorStop(0, "rgba(34,197,94,.22)");
  g1.addColorStop(1, "rgba(34,197,94,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W * 0.9, H * 0.96, 0, W * 0.9, H * 0.96, W * 0.75);
  g2.addColorStop(0, "rgba(16,185,129,.18)");
  g2.addColorStop(1, "rgba(16,185,129,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
}

function drawBrand(ctx, W) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 34px 'Space Grotesk', sans-serif";
  ctx.fillStyle = greenGradient(ctx, W * 0.2, W * 0.8);
  ctx.fillText(BRAND, W / 2, 90);
  ctx.font = "600 20px 'Inter', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.fillText("AI FACE FUSION", W / 2, 122);
}

function drawPillLabel(ctx, text, cx, y) {
  ctx.font = "700 22px 'Inter', sans-serif";
  const tw = ctx.measureText(text).width;
  const pad = 18;
  const h = 42;
  const w = tw + pad * 2;
  roundRectPath(ctx, cx - w / 2, y, w, h, h / 2);
  ctx.fillStyle = "rgba(34,197,94,.16)";
  ctx.fill();
  ctx.fillStyle = "#4ade80";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

function drawHeadline(ctx, W, lines, startY) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let y = startY;
  for (const ln of lines) {
    ctx.font = ln.strong
      ? "700 50px 'Space Grotesk', sans-serif"
      : "500 40px 'Inter', sans-serif";
    ctx.fillStyle = ln.strong ? greenGradient(ctx, W * 0.12, W * 0.88) : "#e8e8e8";
    ctx.fillText(ln.text, W / 2, y);
    y += ln.gap;
  }
}

// The two scannable calls-to-action baked into every card.
const QR_TARGETS = [
  { url: "https://smubia.com", label: "smubia.com" },
  { url: "https://ail-ay2526-s2-yash-enhance-ai.vercel.app/", label: "Make your own" },
];

// Render a QR code to an offscreen canvas via qrcodejs. It's drawn
// same-origin, so it never taints the exported share canvas. Resolves
// null if the library didn't load, so the card can fall back to a URL.
function makeQR(text, size) {
  return new Promise((resolve) => {
    if (typeof QRCode === "undefined") { resolve(null); return; }
    try {
      const holder = document.createElement("div");
      new QRCode(holder, {
        text,
        width: size,
        height: size,
        colorDark: "#080808",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
      const canvas = holder.querySelector("canvas");
      if (canvas) { resolve(canvas); return; }
      const img = holder.querySelector("img");
      if (img && img.complete && img.naturalWidth) { resolve(img); return; }
      if (img) { img.onload = () => resolve(img); img.onerror = () => resolve(null); return; }
      resolve(null);
    } catch { resolve(null); }
  });
}

// White quiet-zone panel + QR (or URL fallback) + caption below.
function drawQRPanel(ctx, source, target, cx, y, size) {
  const pad = 14;
  const box = size + pad * 2;
  const x = cx - box / 2;
  roundRectPath(ctx, x, y, box, box, 20);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  if (source) {
    ctx.drawImage(source, cx - size / 2, y + pad, size, size);
  } else {
    ctx.fillStyle = "#080808";
    ctx.font = "600 18px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(target.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), cx, y + box / 2);
    ctx.textBaseline = "alphabetic";
  }
  ctx.font = "700 24px 'Inter', sans-serif";
  ctx.fillStyle = "#e8e8e8";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(target.label, cx, y + box + 34);
}

// A centered row of the two QR panels, with an optional green heading above.
async function drawQRRow(ctx, W, y, size, heading) {
  if (heading) {
    ctx.font = "600 26px 'Inter', sans-serif";
    ctx.fillStyle = "#4ade80";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(heading, W / 2, y - 22);
  }
  const box = size + 28;
  const gap = 64;
  const totalW = box * 2 + gap;
  const leftCx = (W - totalW) / 2 + box / 2;
  const rightCx = leftCx + box + gap;
  const [q0, q1] = await Promise.all([
    makeQR(QR_TARGETS[0].url, size),
    makeQR(QR_TARGETS[1].url, size),
  ]);
  drawQRPanel(ctx, q0, QR_TARGETS[0], leftCx, y, size);
  drawQRPanel(ctx, q1, QR_TARGETS[1], rightCx, y, size);
}

// Load the web fonts before painting so canvas text isn't drawn in a fallback.
async function ensureFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load("700 34px 'Space Grotesk'"),
      document.fonts.load("700 50px 'Space Grotesk'"),
      document.fonts.load("500 40px 'Inter'"),
      document.fonts.load("600 20px 'Inter'"),
      document.fonts.load("700 22px 'Inter'"),
    ]);
    await document.fonts.ready;
  } catch { /* fall back to system fonts */ }
}

async function buildCombineCard() {
  const W = 1080, H = 1500;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  paintBackground(ctx, W, H);
  drawBrand(ctx, W);

  const [imgA, imgB, imgR] = await Promise.all([
    loadImage(previewA.src),
    loadImage(previewB.src),
    loadImage(resultImage.src),
  ]);

  // Parents row
  const pS = 285, gap = 120;
  const rowW = pS * 2 + gap;
  const ax = (W - rowW) / 2;
  const bx = ax + pS + gap;
  const py = 150;
  drawCover(ctx, imgA, ax, py, pS, pS, 28);
  drawCover(ctx, imgB, bx, py, pS, pS, 28);
  drawPillLabel(ctx, "Parent A", ax + pS / 2, py + pS + 12);
  drawPillLabel(ctx, "Parent B", bx + pS / 2, py + pS + 12);

  ctx.fillStyle = "#4ade80";
  ctx.font = "700 70px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+", W / 2, py + pS / 2);
  ctx.textBaseline = "alphabetic";

  // Result
  const rS = 420;
  const rx = (W - rS) / 2;
  const ry = 525;
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = "700 38px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("↓", W / 2, ry - 18);
  drawCover(ctx, imgR, rx, ry, rS, rS, 36);
  drawPillLabel(ctx, "👶 Their future kid", W / 2, ry + rS + 14);

  drawHeadline(ctx, W, [
    { text: "Want to see what", strong: false, gap: 60 },
    { text: "YOUR future kid looks like?", strong: true, gap: 0 },
  ], 1085);
  await drawQRRow(ctx, W, 1240, 170, "Scan to make your own →");

  return canvas;
}

async function buildEffectsCard() {
  const W = 1080, H = 1320;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  paintBackground(ctx, W, H);
  drawBrand(ctx, W);

  const [imgO, imgR] = await Promise.all([
    loadImage(previewFx.src),
    loadImage(resultImage.src),
  ]);

  // Before / after
  const s = 400, gap = 64;
  const rowW = s * 2 + gap;
  const ax = (W - rowW) / 2;
  const bx = ax + s + gap;
  const y = 272;
  drawPillLabel(ctx, "Before", ax + s / 2, y - 56);
  drawPillLabel(ctx, "After", bx + s / 2, y - 56);
  drawCover(ctx, imgO, ax, y, s, s, 32);
  drawCover(ctx, imgR, bx, y, s, s, 32);

  ctx.fillStyle = "#4ade80";
  ctx.font = "700 66px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("→", W / 2, y + s / 2);
  ctx.textBaseline = "alphabetic";

  drawHeadline(ctx, W, [
    { text: "Want your own", strong: false, gap: 60 },
    { text: "AI transformation?", strong: true, gap: 0 },
  ], 838);
  await drawQRRow(ctx, W, 1000, 168, "Scan to try it yourself →");

  return canvas;
}

function shareText() {
  return lastTab === "effects"
    ? "Check out my AI transformation ✨ Make your own at Cute Fusion Lab!"
    : "This is what our future kid could look like 👶 Try it at Cute Fusion Lab!";
}

function setShareBusy(busy) {
  shareNativeBtn.disabled = busy;
  shareCopy.disabled = busy;
  shareDownload.classList.toggle("disabled", busy);
}

async function openShareModal() {
  if (!resultFrame.classList.contains("has-image")) return;
  shareModal.classList.add("open");
  sharePreview.classList.remove("ready");
  shareHint.textContent = "";
  shareHint.className = "share-hint";
  shareImage.removeAttribute("src");
  setShareBusy(true);

  try {
    await ensureFonts();
    const canvas = lastTab === "effects" ? await buildEffectsCard() : await buildCombineCard();
    const blob = await new Promise((resolve, reject) => {
      // Throws SecurityError if the canvas is tainted (blocked CORS).
      try { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Empty canvas"))), "image/png"); }
      catch (e) { reject(e); }
    });

    if (shareObjectUrl) URL.revokeObjectURL(shareObjectUrl);
    shareBlob = blob;
    shareObjectUrl = URL.createObjectURL(blob);
    shareImage.src = shareObjectUrl;
    shareDownload.href = shareObjectUrl;
    sharePreview.classList.add("ready");
    setShareBusy(false);

    // Hide the native Share button on platforms that can't share files.
    const canNative = !!(navigator.canShare &&
      navigator.canShare({ files: [new File([blob], "card.png", { type: "image/png" })] }));
    shareNativeBtn.style.display = canNative ? "" : "none";
  } catch (err) {
    console.error("Share card failed:", err);
    setShareBusy(false);
    shareHint.textContent = "Couldn't build the card here — you can still download the plain result.";
    shareHint.className = "share-hint error";
  }
}

function closeShareModal() {
  shareModal.classList.remove("open");
}

shareBtn.addEventListener("click", openShareModal);
shareClose.addEventListener("click", closeShareModal);
shareModal.addEventListener("click", (e) => { if (e.target === shareModal) closeShareModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && shareModal.classList.contains("open")) closeShareModal(); });

shareNativeBtn.addEventListener("click", async () => {
  if (!shareBlob) return;
  const file = new File([shareBlob], "cute-fusion-lab.png", { type: "image/png" });
  try {
    await navigator.share({ files: [file], title: "Cute Fusion Lab", text: shareText() });
  } catch { /* user dismissed the share sheet */ }
});

shareCopy.addEventListener("click", async () => {
  if (!shareBlob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": shareBlob })]);
    shareHint.textContent = "Copied! Paste it into any chat or post.";
    shareHint.className = "share-hint success";
  } catch {
    shareHint.textContent = "Copy isn't supported here — use Download instead.";
    shareHint.className = "share-hint error";
  }
});

renderEffects();
updateButtons();
probeBackend().then((ok) => {
  setStatus(ok ? "Ready. Upload photos to start." : "Backend offline \u2014 start server on port 8001.", "info");
});
