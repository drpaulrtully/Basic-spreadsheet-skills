import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

/* ---------------- Env / defaults ---------------- */
const ACCESS_CODE = process.env.ACCESS_CODE || "ROME-PROMPT-01";
const COOKIE_SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_MINUTES = parseInt(process.env.SESSION_MINUTES || "60", 10);

// Support BOTH names to avoid breaking your Render setup:
// - older template used COURSE_BACK_URL
// - we previously told you BACK_URL
const COURSE_BACK_URL = process.env.COURSE_BACK_URL || process.env.BACK_URL || "";
const NEXT_LESSON_URL = process.env.NEXT_LESSON_URL || "";

app.use(cookieParser(COOKIE_SECRET));

/* ---------------- Session cookie helpers ---------------- */
const COOKIE_NAME = "fethink_prompting_session";

function setSessionCookie(res) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_MINUTES * 60;

  const payload = { exp };

  res.cookie(COOKIE_NAME, JSON.stringify(payload), {
    httpOnly: true,
    secure: true, // Render uses HTTPS
    sameSite: "lax",
    maxAge: SESSION_MINUTES * 60 * 1000,
    signed: true
  });
}

function isSessionValid(req) {
  const raw = req.signedCookies?.[COOKIE_NAME];
  if (!raw) return false;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return typeof payload?.exp === "number" && now < payload.exp;
}

function requireSession(req, res, next) {
  if (!isSessionValid(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

/* ---------------- Helpers ---------------- */
function clampStr(s, max = 6000) {
  return String(s || "").slice(0, max);
}

function wordCount(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/* ---------------- Task content (UPDATED) ---------------- */
/* ---------------- Task content (UPDATED) ---------------- */

/* ---------------- Task content (UPDATED) ---------------- */

/* ---------------- Task content (UPDATED) ---------------- */

const QUESTION_TEXT = [
  "Scenario:",
  "You work in a small team and have been given a basic spreadsheet that tracks tasks and deadlines for staff.",
  "The spreadsheet includes columns for task name, project owner, due date, and traffic-light status (red/amber/green).",
  "Some totals look wrong, and it’s hard to see which tasks are overdue or causing delays.",
  "",
  "You are new to spreadsheets and want to use AI as your thinking assistant to help you:",
  "- check whether the spreadsheet is structured sensibly",
  "- spot patterns or problems",
  "- suggest one simple improvement to make the data easier to understand",
  "",
  "=== TASK ===",
  "Write a prompt that asks AI to help you understand the spreadsheet and improve it.",
  "Your prompt must make clear what the columns contain, what you’re unsure about, and what output you want.",
  "",
  "=== USE THE FEthink STRUCTURE ===",
  "ROLE: Tell AI who you are, or what role you want it to adopt.",
  "TASK: What do you want AI to do?",
  "CONTEXT: Who is AI creating the content for, and what is the spreadsheet used for?",
  "FORMAT: How should AI present the answer (steps, bullet points, simple language) and what should it include?",
  "",
  "Aim for at least 20 words."
].join("\n");

const TEMPLATE_TEXT = [
  "Role:",
  "Task:",
  "Context (audience):",
  "Format (structure/tone):"
].join("\n");

const MODEL_ANSWER = [
  "Role:",
  "Act as a patient spreadsheet tutor for beginners who explains things in simple English and avoids technical jargon.",
  "",
  "Task:",
  "Help me understand what is happening in my task-tracking spreadsheet and suggest two simple improvements to make it easier to manage.",
  "Please: briefly explain what the data shows, point out obvious problems or inconsistencies, and suggest one small structural improvement.",
  "",
  "Context (Audience):",
  "I work in a small team and I am new to spreadsheets.",
  "The spreadsheet tracks tasks, project owner, due date, and traffic-light status (red/amber/green).",
  "Some tasks feel overdue, one row looks inconsistent, and I’m not sure the columns are set up in the best way.",
  "I want to use it to keep on top of deadlines and spot problems early.",
  "",
  "Format:",
  "1) A short summary (2–3 sentences) of what the spreadsheet shows",
  "2) Three bullet points highlighting patterns or issues",
  "3) Two simple improvements I can make",
  "4) One practical next step I can do today in Excel or Google Sheets",
  "",
  "Use a friendly, supportive tone suitable for a beginner. Keep it practical."
].join("\n");

const LEARN_MORE_TEXT = [
  "When prompting AI about a spreadsheet, help it ‘see’ the data by describing the columns clearly.",
  "Good prompts ask for: (1) what the data suggests, (2) any inconsistencies, and (3) simple improvements.",
  "",
  "Try including:",
  "- what each column means",
  "- what problem you are trying to solve (e.g., overdue tasks, unclear status)",
  "- the output format you want (steps, bullet points, simple actions)",
  "",
  "If your prompt is vague, AI will reply vaguely. Specific prompts produce useful guidance."
].join("\n");

/* ---------------- Deterministic marker ---------------- */
function markPromptingResponse(answerText) {
  const wc = wordCount(answerText);

  // HARD GATE: under 20 words — no rubric, no model answer, no extras
  if (wc < 20) {
    return {
      gated: true,
      wordCount: wc,
      message:
        "Please add to your answer.\n" +
        "This response is too short to demonstrate the full prompt structure.\n" +
        "Aim for at least 20 words and include: role, task, context, and format.",
      score: null,
      strengths: null,
      tags: null,
      grid: null,
      learnMoreText: null,
      modelAnswer: null
    };
  }

  const t = String(answerText || "").toLowerCase();

  const hasRole = /(role:|you are a|act as|as a )/.test(t);
  const hasTask = /(task:|give me|create|produce|generate|write|build|plan)/.test(t);
  const hasContext = /(context:|i am|we are|for me|for a|audience|staff|team|colleagues|workplace|social|event|budget|london|accessibility|dietary|remote)/.test(t);
  const hasFormat = /(format:|bullet|table|include|ensure|constraints|tone|structure|distance|fees|costs|how long)/.test(t);

  const presentCount = [hasRole, hasTask, hasContext, hasFormat].filter(Boolean).length;

  let rubricMsg = "Needs improvement – use the formula: role, task, context, format.";
  if (presentCount === 4) rubricMsg = "Excellent – you’ve followed the prompt formula.";
  else if (presentCount >= 2) rubricMsg = "Good – try adding audience or tone to strengthen further.";

  const score = presentCount === 4 ? 10 : presentCount === 3 ? 8 : presentCount === 2 ? 6 : 4;

  const strengths = [];
  if (hasRole) strengths.push("You clearly set a role for the AI.");
  if (hasTask) strengths.push("You specify what you want the AI to do.");
  if (hasContext) strengths.push("You include context about who/what the plan is for.");
  if (hasFormat) strengths.push("You set useful formatting constraints for the output.");
  if (strengths.length < 2) strengths.push("You’ve started shaping the prompt — add the missing stages for more control.");

  const tags = [
    { label: "Role", status: hasRole ? "ok" : "bad" },
    { label: "Task", status: hasTask ? "ok" : "bad" },
    { label: "Context", status: hasContext ? "ok" : "bad" },
    { label: "Format", status: hasFormat ? "ok" : "bad" }
  ];

  const grid = [
    { label: "Role", status: hasRole ? "✓ Secure" : "✗ Missing", detail: hasRole ? "Role is present." : "Add a role (e.g., tour guide / travel planner)." },
    { label: "Task", status: hasTask ? "✓ Secure" : "✗ Missing", detail: hasTask ? "Task is present." : "State what you want AI to produce." },
    { label: "Context", status: hasContext ? "✓ Secure" : "✗ Missing", detail: hasContext ? "Context is present." : "Add who it’s for / when / where / constraints." },
    { label: "Format", status: hasFormat ? "✓ Secure" : "✗ Missing", detail: hasFormat ? "Format constraints are present." : "Add format details (bullets, costs, distances, timing, tone)." }
  ];

  return {
    gated: false,
    wordCount: wc,
    message: rubricMsg,
    score,
    strengths: strengths.slice(0, 3),
    tags,
    grid,
    learnMoreText: LEARN_MORE_TEXT,
    modelAnswer: MODEL_ANSWER
  };
}

/* ---------------- Routes ---------------- */

// Config for the frontend
// Config for the frontend
app.get("/api/config", (req, res) => {
  res.json({
    ok: true,
    questionText: QUESTION_TEXT,
    templateText: TEMPLATE_TEXT,
    targetWords: "20–300",
    minWordsGate: 20,
    maxWords: 300,
    courseBackUrl: COURSE_BACK_URL,
    nextLessonUrl: NEXT_LESSON_URL
  });
});

// Check access code and set session cookie
app.post("/api/unlock", (req, res) => {
  const code = clampStr(req.body?.code || "", 80).trim();
  if (!code || code !== ACCESS_CODE) {
    return res.status(401).json({ ok: false, error: "invalid_code" });
  }
  setSessionCookie(res);
  return res.json({ ok: true });
});

// Marking endpoint (requires session)
app.post("/api/mark", requireSession, (req, res) => {
  const answerText = clampStr(req.body?.answerText || req.body?.answer || "", 6000);
  const result = markPromptingResponse(answerText);
  res.json({ ok: true, result });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FEthink automarker running on port ${PORT}`);
});
