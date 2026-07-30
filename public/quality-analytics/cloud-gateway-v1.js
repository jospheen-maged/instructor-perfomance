import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = "https://jpewcvzummlwiplbojip.supabase.co";
const SUPABASE_KEY = "sb_publishable_BKcXs7kCaFlZ2JKnBclV4Q_qyRKKPKD";
const LOGIN_EMAILS = {
  "quality.admin": "quality.admin@internal.example.com",
  "quality.viewer": "quality.viewer@internal.example.com",
};
const DB_NAME = "quality-operations-analytics";
const STORE_NAME = "datasets";
const ROLE_CACHE_KEY = "quality-analytics-auth-v2";
const LOGO = "./iSchool-logo-colors-20260730.svg?v=20260730-cloud-1";
const APP_VERSION = "20260730-cloud-1";
const POLL_MS = 30000;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

let currentRole = "viewer";
let lastLocalSignatures = { reviews: "", objections: "" };
let lastCloudVersion = "";
let syncing = false;
let appLoaded = false;

document.documentElement.classList.add("qa-cloud-locked");

const style = document.createElement("style");
style.textContent = `
  html.qa-cloud-locked,html.qa-cloud-locked body{overflow:hidden!important}
  html.qa-cloud-locked #root{visibility:hidden!important}
  #qa-cloud-gate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 10% 10%,rgba(5,111,236,.14),transparent 34%),radial-gradient(circle at 90% 85%,rgba(255,215,0,.17),transparent 32%),#f5f8fc;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  #qa-cloud-card{width:min(440px,100%);padding:34px;border:1px solid rgba(5,111,236,.15);border-radius:28px;background:#fff;box-shadow:0 28px 80px rgba(31,42,85,.16)}
  #qa-cloud-logo{display:flex;min-height:92px;margin-bottom:22px;padding:15px 20px;align-items:center;justify-content:center;border-radius:20px;background:#fff;box-shadow:0 10px 34px rgba(31,42,85,.08)}
  #qa-cloud-logo img{display:block;width:260px;max-width:100%;height:auto}
  #qa-cloud-card h1{margin:0;color:#1F2A55;text-align:center;font-size:26px;font-weight:850}
  #qa-cloud-card>p{margin:9px 0 25px;color:#597587;text-align:center;font-size:14px;line-height:1.55}
  .qa-cloud-field{margin-top:15px}.qa-cloud-field label{display:block;margin-bottom:7px;color:#334155;font-size:13px;font-weight:750}
  .qa-cloud-field input{box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #dbe4ef;border-radius:14px;outline:none;background:#fff;color:#0f172a}
  .qa-cloud-field input:focus{border-color:#056FEC;box-shadow:0 0 0 4px rgba(5,111,236,.12)}
  #qa-cloud-submit,#qa-local-fallback{width:100%;height:50px;margin-top:22px;border:0;border-radius:15px;background:#056FEC;color:#fff;font-weight:850;cursor:pointer;box-shadow:0 12px 28px rgba(5,111,236,.24)}
  #qa-local-fallback{display:none;background:#1F2A55;box-shadow:none}
  #qa-cloud-error{min-height:20px;margin-top:12px;color:#AA1818;text-align:center;font-size:13px;font-weight:750;line-height:1.5}
  #qa-cloud-note{margin-top:18px;color:#85A5B9;text-align:center;font-size:11px}
  #qa-cloud-controls{position:fixed;right:17px;bottom:17px;z-index:999999;display:flex;align-items:center;gap:8px}
  #qa-cloud-role,#qa-cloud-status,#qa-cloud-logout{height:38px;padding:0 13px;border:1px solid rgba(5,111,236,.18);border-radius:999px;background:rgba(255,255,255,.97);box-shadow:0 10px 30px rgba(31,42,85,.12);font-size:12px;font-weight:850;backdrop-filter:blur(12px)}
  #qa-cloud-role,#qa-cloud-status{display:flex;align-items:center;color:#056FEC}#qa-cloud-status{color:#128157}#qa-cloud-logout{color:#1F2A55;cursor:pointer}
  @media(max-width:768px){#qa-cloud-card{padding:27px 21px}#qa-cloud-controls{right:10px;bottom:10px}#qa-cloud-role{display:none}}
`;
document.head.appendChild(style);

const clean = (value) => String(value ?? "").trim();

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readLocal(kind) {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(kind);
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

async function writeLocal(kind, rows) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(rows, kind);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function reviewKey(row) {
  return [row["Tutor ID"], row["Session Recording"] || row["Lesson Name"], row["Review Date"], row["QC Name"]].map(clean).join("|");
}

function objectionKey(row) {
  return clean(row["Objection ID"] || `${row["Quality Review ID"]}|${row["Objected Item"]}|${row["Objection Created At"]}`);
}

function signature(rows) {
  let hash = 2166136261;
  const sample = rows.map((row) => clean(row["Objection ID"] || row["Tutor ID"] || row["Quality Review ID"]) + clean(row["QTL Decision At"] || row["Review Date"] || row["Objection Status"])).join("|");
  for (let i = 0; i < sample.length; i += 1) {
    hash ^= sample.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${rows.length}:${hash >>> 0}`;
}

async function getProfile(userId) {
  const { data, error } = await supabase.from("quality_profiles").select("role").eq("user_id", userId).single();
  if (error) throw error;
  return data;
}

async function getCloudRows(kind) {
  const all = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("quality_data").select("payload").eq("kind", kind).range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []).map((item) => item.payload));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

async function getCloudVersion() {
  const { data, error } = await supabase.from("quality_dataset_versions").select("kind,updated_at,row_count").order("kind");
  if (error) throw error;
  return JSON.stringify(data || []);
}

async function pullCloudToLocal() {
  const [reviews, objections] = await Promise.all([getCloudRows("reviews"), getCloudRows("objections")]);
  await Promise.all([writeLocal("reviews", reviews), writeLocal("objections", objections)]);
  lastLocalSignatures = { reviews: signature(reviews), objections: signature(objections) };
  lastCloudVersion = await getCloudVersion();
  return { reviews, objections };
}

async function pushKind(kind, rows) {
  const keyFn = kind === "reviews" ? reviewKey : objectionKey;
  const { error: deleteError } = await supabase.from("quality_data").delete().eq("kind", kind);
  if (deleteError) throw deleteError;
  const user = (await supabase.auth.getUser()).data.user;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100).map((payload, index) => ({
      kind,
      record_key: keyFn(payload) || `${Date.now()}-${i + index}`,
      cycle: clean(payload.Review_Cycle || payload["Review Cycle"]),
      payload,
      uploaded_by: user?.id || null,
    }));
    if (batch.length) {
      const { error } = await supabase.from("quality_data").upsert(batch, { onConflict: "kind,record_key" });
      if (error) throw error;
    }
  }
  const { error: versionError } = await supabase.from("quality_dataset_versions").upsert({ kind, row_count: rows.length, updated_by: user?.id || null }, { onConflict: "kind" });
  if (versionError) throw versionError;
}

async function seedOrPull() {
  const [localReviews, localObjections, cloudVersion] = await Promise.all([readLocal("reviews"), readLocal("objections"), getCloudVersion()]);
  const cloudCount = JSON.parse(cloudVersion || "[]").reduce((sum, row) => sum + Number(row.row_count || 0), 0);
  if (cloudCount === 0 && currentRole === "admin" && (localReviews.length || localObjections.length)) {
    await Promise.all([pushKind("reviews", localReviews), pushKind("objections", localObjections)]);
    lastLocalSignatures = { reviews: signature(localReviews), objections: signature(localObjections) };
    lastCloudVersion = await getCloudVersion();
    return;
  }
  await pullCloudToLocal();
}

function setStatus(text, tone = "green") {
  const el = document.getElementById("qa-cloud-status");
  if (!el) return;
  el.textContent = text;
  el.style.color = tone === "red" ? "#AA1818" : tone === "orange" ? "#C75A00" : "#128157";
}

async function syncLocalChanges() {
  if (syncing || currentRole !== "admin" || !appLoaded) return;
  syncing = true;
  try {
    const [reviews, objections] = await Promise.all([readLocal("reviews"), readLocal("objections")]);
    const next = { reviews: signature(reviews), objections: signature(objections) };
    const changed = Object.keys(next).filter((kind) => next[kind] !== lastLocalSignatures[kind]);
    if (!changed.length) return;
    setStatus("Saving…", "orange");
    for (const kind of changed) await pushKind(kind, kind === "reviews" ? reviews : objections);
    lastLocalSignatures = next;
    lastCloudVersion = await getCloudVersion();
    setStatus("Cloud saved");
  } catch (error) {
    console.error(error);
    setStatus("Sync failed", "red");
  } finally {
    syncing = false;
  }
}

async function refreshFromCloud() {
  if (syncing || !appLoaded) return;
  try {
    const version = await getCloudVersion();
    if (lastCloudVersion && version !== lastCloudVersion) {
      syncing = true;
      setStatus("Updating…", "orange");
      await pullCloudToLocal();
      location.reload();
    }
  } catch (error) {
    console.error(error);
    setStatus("Offline", "red");
  } finally {
    syncing = false;
  }
}

function addControls() {
  document.getElementById("qa-cloud-controls")?.remove();
  const wrap = document.createElement("div");
  wrap.id = "qa-cloud-controls";
  wrap.innerHTML = `<div id="qa-cloud-role">${currentRole === "admin" ? "Full Analytics" : "Management View"}</div><div id="qa-cloud-status">Cloud synced</div><button id="qa-cloud-logout" type="button">Log out</button>`;
  wrap.querySelector("button").onclick = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(ROLE_CACHE_KEY);
    location.reload();
  };
  document.body.appendChild(wrap);
}

function replaceLocalText() {
  const replacements = new Map([
    ["CSV records are processed and saved only inside this browser.", "CSV records are securely saved in the shared cloud workspace."],
    ["Private by design: imported records stay in IndexedDB on this device. The public website contains no internal data.", "Shared and protected: imported records are saved in Supabase and are available to authorised accounts."],
    ["Reviews and objections are analysed locally in this browser. Your raw CSV data is not sent to a server, and each new month can be merged with the saved history.", "Reviews and objections are saved in the protected shared workspace. Authorised accounts can access the same monthly history from any device."],
    ["Local data protection", "Shared data protection"],
  ]);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const value = node.nodeValue?.trim();
    if (replacements.has(value)) node.nodeValue = node.nodeValue.replace(value, replacements.get(value));
  }
}

function loadScript(src, type = "text/javascript") {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.type = type;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function loadDashboard() {
  window.__QA_ROLE__ = currentRole;
  document.documentElement.dataset.qaRole = currentRole;
  localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ role: currentRole, expiresAt: Date.now() + 24 * 60 * 60 * 1000 }));
  await loadScript(`./app.js?v=${APP_VERSION}`, "module");
  await Promise.all([
    loadScript(`./analytics-enhancements.js?v=${APP_VERSION}`),
    loadScript(`./analytics-tie-fix.js?v=${APP_VERSION}`),
    loadScript(`./brand-fix-20260730.js?v=${APP_VERSION}`),
    loadScript(`./role-views-v1.js?v=${APP_VERSION}`),
  ]);
  appLoaded = true;
  addControls();
  document.documentElement.classList.remove("qa-cloud-locked");
  window.dispatchEvent(new CustomEvent("qa-role-ready", { detail: { role: currentRole } }));
  setTimeout(replaceLocalText, 800);
  new MutationObserver(() => setTimeout(replaceLocalText, 50)).observe(document.body, { childList: true, subtree: true });
  setInterval(syncLocalChanges, 2500);
  setInterval(refreshFromCloud, POLL_MS);
}

function showGate(message = "Sign in to open the shared quality analytics workspace.") {
  document.documentElement.classList.add("qa-cloud-locked");
  document.getElementById("qa-cloud-gate")?.remove();
  const gate = document.createElement("div");
  gate.id = "qa-cloud-gate";
  gate.innerHTML = `<form id="qa-cloud-card" autocomplete="off"><div id="qa-cloud-logo"><img src="${LOGO}" alt="iSchool"></div><h1>Quality Intelligence</h1><p>${message}</p><div class="qa-cloud-field"><label for="qa-cloud-user">Username</label><input id="qa-cloud-user" autocomplete="username" required></div><div class="qa-cloud-field"><label for="qa-cloud-pass">Password</label><input id="qa-cloud-pass" type="password" autocomplete="current-password" required></div><button id="qa-cloud-submit">Sign in</button><div id="qa-cloud-error" role="alert"></div><button id="qa-local-fallback" type="button">Open local dashboard temporarily</button><div id="qa-cloud-note">Secure Supabase account • Shared data across devices</div></form>`;
  document.body.appendChild(gate);
  const form = gate.querySelector("form");
  const userInput = gate.querySelector("#qa-cloud-user");
  const passInput = gate.querySelector("#qa-cloud-pass");
  const errorEl = gate.querySelector("#qa-cloud-error");
  const submit = gate.querySelector("#qa-cloud-submit");
  form.onsubmit = async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    submit.disabled = true;
    submit.textContent = "Checking…";
    try {
      const entered = userInput.value.trim().toLowerCase();
      const email = LOGIN_EMAILS[entered] || entered;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: passInput.value });
      if (error) throw error;
      const profile = await getProfile(data.user.id);
      currentRole = profile.role === "admin" ? "admin" : "viewer";
      await seedOrPull();
      gate.remove();
      await loadDashboard();
    } catch (error) {
      console.error(error);
      const setupMissing = /quality_profiles|quality_data|schema cache|relation/i.test(error?.message || "");
      errorEl.textContent = setupMissing ? "The Supabase database setup has not been applied yet. Run the provided SQL setup once, then sign in again." : "Incorrect username/password, or this account has not been created in Supabase yet.";
      if (setupMissing) gate.querySelector("#qa-local-fallback").style.display = "block";
      passInput.value = "";
      passInput.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  };
  gate.querySelector("#qa-local-fallback").onclick = async () => {
    currentRole = "admin";
    gate.remove();
    await loadDashboard();
    setStatus("Local mode", "orange");
  };
  setTimeout(() => userInput.focus(), 0);
}

async function start() {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      showGate();
      return;
    }
    const profile = await getProfile(data.session.user.id);
    currentRole = profile.role === "admin" ? "admin" : "viewer";
    await seedOrPull();
    await loadDashboard();
  } catch (error) {
    console.error(error);
    await supabase.auth.signOut();
    showGate("Cloud setup is ready in the website, but the database tables and user accounts must be created once in Supabase.");
  }
}

start();
