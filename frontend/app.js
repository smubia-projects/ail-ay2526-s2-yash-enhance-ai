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

// ---- DOM (telegram QR) ----
const tgSend        = document.getElementById("tgSend");
const tgQrBtn       = document.getElementById("tgQrBtn");
const tgHint        = document.getElementById("tgHint");
const qrModal       = document.getElementById("qrModal");
const qrCanvas      = document.getElementById("qrCanvas");
const qrClose       = document.getElementById("qrClose");
const qrBotName     = document.getElementById("qrBotName");
let botUsername      = null;

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
let lastFilename = null;

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
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(err.detail || `Error ${resp.status}`);
    }
    const data = await resp.json();
    const url = data.image_url.startsWith("http") ? data.image_url : `${API_BASE}${data.image_url}`;
    lastFilename = data.filename;
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
  tgSend.classList.add("visible");
  tgHint.textContent = "Recipient must message your bot first";
  tgHint.className = "tg-hint";
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

// ---- Telegram QR ----
async function fetchBotInfo() {
  if (botUsername) return botUsername;
  try {
    const resp = await fetch(`${API_BASE}/api/telegram-bot`);
    const data = await resp.json();
    if (data.username) { botUsername = data.username; return botUsername; }
  } catch (e) {
    console.error("Failed to fetch bot info:", e);
  }
  return null;
}

tgQrBtn.addEventListener("click", async () => {
  console.log("QR button clicked, lastFilename:", lastFilename);
  if (!lastFilename) {
    tgHint.textContent = "Generate an image first";
    tgHint.className = "tg-hint error";
    return;
  }

  const bot = await fetchBotInfo();
  console.log("Bot username:", bot);
  if (!bot) {
    tgHint.textContent = "Telegram bot not configured on server";
    tgHint.className = "tg-hint error";
    return;
  }

  // Strip .png extension for the deep-link payload
  const imageId = lastFilename.replace(/\.png$/, "");
  const deepLink = `https://t.me/${bot}?start=${imageId}`;
  console.log("Deep link:", deepLink);

  qrCanvas.innerHTML = "";

  if (typeof QRCode === "undefined") {
    // Fallback: show clickable link if QR library failed to load
    qrCanvas.innerHTML = `<a href="${deepLink}" target="_blank" style="color:#29a9ea;word-break:break-all">${deepLink}</a>`;
  } else {
    new QRCode(qrCanvas, {
      text: deepLink,
      width: 256,
      height: 256,
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  qrBotName.textContent = `@${bot}`;
  qrModal.classList.add("open");
});

qrClose.addEventListener("click", () => qrModal.classList.remove("open"));
qrModal.addEventListener("click", (e) => { if (e.target === qrModal) qrModal.classList.remove("open"); });

renderEffects();
updateButtons();
probeBackend().then((ok) => {
  setStatus(ok ? "Ready. Upload photos to start." : "Backend offline \u2014 start server on port 8001.", "info");
});
