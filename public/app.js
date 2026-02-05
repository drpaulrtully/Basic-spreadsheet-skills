/* =========================================================
   FEthink — AI Prompting Automarker (Level 1)
   + Spreadsheet preview toggles (Task tracking / Attendance)
   - Access code gate -> signed httpOnly cookie session
   - Marking rules:
       <20 words: "Please add..." only; no score; no extras; no model answer
       >=20 words: score + strengths + tags + grid + improvement notes
       + optional Learn more panel (collapsed by default)
       + model answer shown only when server returns it
   ========================================================= */

const gateEl = document.getElementById("gate");
const codeInput = document.getElementById("codeInput");
const unlockBtn = document.getElementById("unlockBtn");
const gateMsg = document.getElementById("gateMsg");

const backToCourse = document.getElementById("backToCourse");
const nextLesson = document.getElementById("nextLesson");

const questionTextEl = document.getElementById("questionText");
const targetWordsEl = document.getElementById("targetWords");
const minGateEl = document.getElementById("minGate");

const insertTemplateBtn = document.getElementById("insertTemplateBtn");
const clearBtn = document.getElementById("clearBtn");
const answerTextEl = document.getElementById("answerText");

const submitBtn = document.getElementById("submitBtn");
const wordCountBox = document.getElementById("wordCountBox");

const scoreBig = document.getElementById("scoreBig");
const wordCountBig = document.getElementById("wordCountBig");
const feedbackBox = document.getElementById("feedbackBox");

// Strengths / Tags / Grid
const strengthsWrap = document.getElementById("strengthsWrap");
const strengthsList = document.getElementById("strengthsList");

const tagsWrap = document.getElementById("tagsWrap");
const tagsRow = document.getElementById("tagsRow");

const gridWrap = document.getElementById("gridWrap");
const gEthical = document.getElementById("gEthical");
const gImpact = document.getElementById("gImpact");
const gLegal = document.getElementById("gLegal");
const gRecs = document.getElementById("gRecs");
const gStructure = document.getElementById("gStructure");

// Learn more panel
const learnMoreWrap = document.getElementById("learnMoreWrap");
const learnMoreBtn = document.getElementById("learnMoreBtn");
const frameworkPanel = document.getElementById("frameworkPanel");
const learnMoreText = document.getElementById("learnMoreText");

// Model answer
const modelWrap = document.getElementById("modelWrap");
const modelAnswerEl = document.getElementById("modelAnswer");

/* ---------------- Local state ---------------- */
let TEMPLATE_TEXT = "";
let MIN_GATE = 20;

/* ---------------- Helpers ---------------- */
function wc(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showGate(message = "") {
  if (!gateEl) return;
  gateEl.style.display = "flex";
  if (gateMsg) gateMsg.textContent = message;
  if (codeInput) codeInput.focus();
}

function hideGate() {
  if (!gateEl) return;
  gateEl.style.display = "none";
}

function resetExtras() {
  // Strengths
  if (strengthsWrap) strengthsWrap.style.display = "none";
  if (strengthsList) strengthsList.innerHTML = "";

  // Tags
  if (tagsWrap) tagsWrap.style.display = "none";
  if (tagsRow) tagsRow.innerHTML = "";

  // Grid
  if (gridWrap) gridWrap.style.display = "none";
  if (gEthical) gEthical.textContent = "—";
  if (gImpact) gImpact.textContent = "—";
  if (gLegal) gLegal.textContent = "—";
  if (gRecs) gRecs.textContent = "—";
  if (gStructure) gStructure.textContent = "—";

  // Learn more
  if (learnMoreWrap) learnMoreWrap.style.display = "none";
  if (frameworkPanel) {
    frameworkPanel.style.display = "none";
    frameworkPanel.setAttribute("aria-hidden", "true");
  }
  if (learnMoreBtn) learnMoreBtn.setAttribute("aria-expanded", "false");
  if (learnMoreText) learnMoreText.textContent = "";

  // Model answer
  if (modelWrap) modelWrap.style.display = "none";
  if (modelAnswerEl) modelAnswerEl.textContent = "";
}

function resetFeedback() {
  if (scoreBig) scoreBig.textContent = "—";
  if (wordCountBig) wordCountBig.textContent = "—";
  if (feedbackBox) feedbackBox.textContent = "";
  resetExtras();
}

/* ---------------- Config load ---------------- */
async function loadConfig() {
  try {
    const res = await fetch("/api/config", { credentials: "include" });
    const data = await res.json();
    if (!data?.ok) return;

    // NAV FIRST (so a missing element elsewhere cannot prevent nav wiring)
    if (backToCourse && data.courseBackUrl) {
      backToCourse.href = data.courseBackUrl;
      backToCourse.style.display = "inline-block";
    }
    if (nextLesson && data.nextLessonUrl) {
      nextLesson.href = data.nextLessonUrl;
      nextLesson.style.display = "inline-block";
    }

    if (questionTextEl) questionTextEl.textContent = data.questionText || "Task loaded.";
    if (targetWordsEl) targetWordsEl.textContent = data.targetWords || "20-200";

    MIN_GATE = data.minWordsGate ?? 20;
    if (minGateEl) minGateEl.textContent = String(MIN_GATE);

    TEMPLATE_TEXT = data.templateText || "";
  } catch (e) {
    console.error("loadConfig failed:", e);
  }
}

/* ---------------- Gate unlock ---------------- */
async function unlock() {
  const code = (codeInput?.value || "").trim();
  if (!code) {
    if (gateMsg) gateMsg.textContent = "Please enter the access code from your lesson.";
    return;
  }

  if (unlockBtn) unlockBtn.disabled = true;
  if (gateMsg) gateMsg.textContent = "Checking…";

  try {
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code })
    });

    const data = await res.json();

    if (!res.ok || !data?.ok) {
      if (gateMsg) gateMsg.textContent = "That code didn’t work. Check it and try again.";
      return;
    }

    hideGate();
    await loadConfig();
  } catch (e) {
    if (gateMsg) gateMsg.textContent = "Network issue. Please try again.";
    console.error("unlock failed:", e);
  } finally {
    if (unlockBtn) unlockBtn.disabled = false;
  }
}

if (unlockBtn) unlockBtn.addEventListener("click", unlock);
if (codeInput) {
  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") unlock();
  });
}

/* ---------------- Word count live ---------------- */
function updateWordCount() {
  if (!answerTextEl || !wordCountBox) return;
  const n = wc(answerTextEl.value);
  wordCountBox.textContent = `Words: ${n}`;
}
if (answerTextEl) answerTextEl.addEventListener("input", updateWordCount);
updateWordCount();

/* ---------------- Template + clear ---------------- */
if (insertTemplateBtn) {
  insertTemplateBtn.addEventListener("click", () => {
    if (!answerTextEl || !TEMPLATE_TEXT) return;
    const existing = answerTextEl.value.trim();
    answerTextEl.value = existing ? `${TEMPLATE_TEXT}\n\n---\n\n${existing}` : TEMPLATE_TEXT;
    answerTextEl.focus();
    updateWordCount();
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (!answerTextEl) return;
    answerTextEl.value = "";
    updateWordCount();
    resetFeedback();
  });
}

/* ---------------- Learn more toggle ---------------- */
if (learnMoreBtn && frameworkPanel) {
  learnMoreBtn.addEventListener("click", () => {
    const isOpen = frameworkPanel.style.display === "block";
    if (isOpen) {
      frameworkPanel.style.display = "none";
      frameworkPanel.setAttribute("aria-hidden", "true");
      learnMoreBtn.setAttribute("aria-expanded", "false");
    } else {
      frameworkPanel.style.display = "block";
      frameworkPanel.setAttribute("aria-hidden", "false");
      learnMoreBtn.setAttribute("aria-expanded", "true");
    }
  });
}

/* ---------------- Render helpers ---------------- */
function renderStrengths(strengths) {
  if (!strengthsWrap || !strengthsList) return;
  if (!Array.isArray(strengths) || strengths.length === 0) {
    strengthsWrap.style.display = "none";
    strengthsList.innerHTML = "";
    return;
  }
  strengthsList.innerHTML = strengths.slice(0, 3).map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  strengthsWrap.style.display = "block";
}

function tagBadge(name, status) {
  const symbol = status === "ok" ? "✔" : status === "mid" ? "◐" : "✗";
  const cls = status === "ok" ? "tag ok" : status === "mid" ? "tag mid" : "tag bad";
  return `<span class="${cls}"><span class="tagStatus">${symbol}</span>${escapeHtml(name)}</span>`;
}

function renderTags(tags) {
  if (!tagsWrap || !tagsRow) return;
  if (!Array.isArray(tags) || tags.length === 0) {
    tagsWrap.style.display = "none";
    tagsRow.innerHTML = "";
    return;
  }
  tagsRow.innerHTML = tags
    .map((t) => tagBadge(t.name || t.label || "", t.status))
    .join("");
  tagsWrap.style.display = "block";
}

function renderGrid(grid) {
  if (!gridWrap || !gEthical || !gImpact || !gLegal || !gRecs || !gStructure) return;

  if (!grid) {
    gridWrap.style.display = "none";
    return;
  }

  // Object-style grid (legacy)
  if (!Array.isArray(grid)) {
    gEthical.textContent = grid.ethical || "—";
    gImpact.textContent = grid.impact || "—";
    gLegal.textContent = grid.legal || "—";
    gRecs.textContent = grid.recs || "—";
    gStructure.textContent = grid.structure || "—";
    gridWrap.style.display = "block";
    return;
  }

  // Array-style grid from server (Role/Task/Context/Format)
  const getStatus = (label) => {
    const row = grid.find((r) => (r.label || "").toLowerCase() === label.toLowerCase());
    return row ? (row.status || "—") : "—";
  };

  gEthical.textContent = getStatus("Role");
  gImpact.textContent = getStatus("Task");
  gLegal.textContent = getStatus("Context");
  gRecs.textContent = getStatus("Format");
  gStructure.textContent = "—";
  gridWrap.style.display = "block";
}

function renderFramework(frameworkText) {
  if (!learnMoreWrap || !frameworkPanel || !learnMoreBtn) return;

  if (!frameworkText) {
    learnMoreWrap.style.display = "none";
    return;
  }

  if (learnMoreText) learnMoreText.textContent = frameworkText;

  // Show wrapper, keep panel collapsed until learner clicks
  learnMoreWrap.style.display = "block";
  frameworkPanel.style.display = "none";
  frameworkPanel.setAttribute("aria-hidden", "true");
  learnMoreBtn.setAttribute("aria-expanded", "false");
}

/* ---------------- Submit for marking ---------------- */
async function mark() {
  resetFeedback();

  const answerText = (answerTextEl?.value || "").trim();
  const words = wc(answerText);

  if (!feedbackBox) return;

  if (words === 0) {
    feedbackBox.textContent = "Write your answer first (aim for at least 20 words).";
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  feedbackBox.textContent = "Marking…";
  if (wordCountBig) wordCountBig.textContent = String(words);

  try {
    const res = await fetch("/api/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ answerText })
    });

    if (res.status === 401) {
      showGate("Session expired. Please re-enter the access code from your Payhip lesson.");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    const data = await res.json();
    const result = data?.result;

    if (!data?.ok || !result) {
      feedbackBox.textContent = "Could not mark your answer. Please try again.";
      return;
    }

    if (wordCountBig) wordCountBig.textContent = String(result.wordCount ?? words);

    if (result.gated) {
      if (scoreBig) scoreBig.textContent = "—";
      feedbackBox.textContent = result.message || "Please add to your answer.";
      resetExtras();
      return;
    }

    // >= MIN_GATE words
    if (scoreBig) scoreBig.textContent = `${result.score}/10`;

    renderStrengths(result.strengths);
    renderTags(result.tags);
    renderGrid(result.grid);

    feedbackBox.textContent = result.feedback || result.message || "";

    renderFramework(result.framework || result.learnMoreText);

    if (result.modelAnswer && modelAnswerEl && modelWrap) {
      modelAnswerEl.textContent = result.modelAnswer;
      modelWrap.style.display = "block";
    } else if (modelWrap) {
      modelWrap.style.display = "none";
    }
  } catch (e) {
    feedbackBox.textContent = "Network issue. Please try again.";
    console.error("mark failed:", e);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

if (submitBtn) submitBtn.addEventListener("click", mark);

/* ---------------- Initial load ---------------- */
loadConfig().then(() => showGate());

/* ---------------- Spreadsheet viewer (no horizontal scroll, wraps content) ---------------- */
(() => {
  const SHEET_URL = "/data/FEthink_dummy_spreadsheets_with_variants.xlsx";

  const sheetTable = document.getElementById("sheetTable");
  const sheetTasksBtn = document.getElementById("sheetTasksBtn");
  const sheetAttendanceBtn = document.getElementById("sheetAttendanceBtn");

  if (!sheetTable || !sheetTasksBtn || !sheetAttendanceBtn) return;

  let workbookCache = null;

  async function loadWorkbook() {
    if (typeof XLSX === "undefined") {
      throw new Error("XLSX library not loaded (check /vendor/xlsx.full.min.js is included ABOVE app.js in index.html)");
    }
    if (workbookCache) return workbookCache;

    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

    const buf = await res.arrayBuffer();
    workbookCache = XLSX.read(buf, { type: "array" });
    return workbookCache;
  }

  function renderTableFromAOA(aoa) {
    if (!Array.isArray(aoa) || aoa.length === 0) {
      return `<div class="subtle">No data found.</div>`;
    }

    const header = aoa[0] || [];
    const rows = aoa.slice(1);

    const thead = `<thead><tr>${
      header.map((h) => {
        const isWrap = /notes|details|comment/i.test(String(h));
        return `<th class="${isWrap ? "wrap" : ""}">${escapeHtml(h)}</th>`;
      }).join("")
    }</tr></thead>`;

    const tbody = `<tbody>${
      rows.map((r) => `<tr>${
        header.map((_, i) => {
          const cell = r?.[i] ?? "";
          const colName = String(header[i] ?? "");
          const wrap = /notes|details|comment/i.test(colName);
          return `<td class="${wrap ? "wrap" : ""}">${escapeHtml(cell)}</td>`;
        }).join("")
      }</tr>`).join("")
    }</tbody>`;

    // No colgroup widths: CSS (table-layout: fixed; width:100%) + wrapping handles fit
    return `<table class="sheetPreviewTable">${thead}${tbody}</table>`;
  }

  async function renderSheet(idx) {
    try {
      sheetTable.textContent = "Loading spreadsheet preview…";
      const wb = await loadWorkbook();

      const name = wb.SheetNames[idx];
      if (!name) throw new Error(`Sheet ${idx + 1} not found. Available: ${wb.SheetNames.join(", ")}`);

      const ws = wb.Sheets[name];

      // Convert worksheet to array-of-arrays
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });

      sheetTable.innerHTML = renderTableFromAOA(aoa);
    } catch (e) {
      sheetTable.textContent = `Unable to load spreadsheet preview: ${e.message}`;
      console.error("Spreadsheet preview error:", e);
    }
  }

  sheetTasksBtn.addEventListener("click", () => renderSheet(0));
  sheetAttendanceBtn.addEventListener("click", () => renderSheet(1));

  // Auto-load first sheet
  renderSheet(0);
})();
