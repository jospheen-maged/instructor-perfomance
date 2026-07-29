(() => {
  "use strict";
  const BLUE = "#056FEC";
  const LIGHT_BLUE = "#05ACFF";
  const LOGO = "./iSchool-logo.svg";
  const USER_HASH = "cc6cf4e26159be5f8036715852dcc45336632dca330b5d9a511a02e930564d15";
  const PASS_HASH = "fc9b1b3764e95c78f84608354dab7fc91e32ad9880a29e123e32e5c5fefa8e82";
  const SESSION_KEY = "quality-analytics-auth-v1";
  const SESSION_MS = 8 * 60 * 60 * 1000;

  function validSession() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      return Boolean(session?.expiresAt && Date.now() < session.expiresAt);
    } catch {
      return false;
    }
  }

  if (!validSession()) document.documentElement.classList.add("qa-locked");

  const css = document.createElement("style");
  css.textContent = `
    :root{--brand-blue:#056FEC;--brand-blue-light:#05ACFF;--brand-yellow:#FFD700;--brand-orange:#FF7F1C}
    html.qa-locked,html.qa-locked body{overflow:hidden!important}
    html.qa-locked #root{visibility:hidden!important}
    #qa-login{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 10% 10%,rgba(5,111,236,.14),transparent 34%),radial-gradient(circle at 90% 85%,rgba(255,215,0,.16),transparent 32%),#f5f8fc;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #qa-login-card{width:min(430px,100%);padding:34px;border:1px solid rgba(5,111,236,.15);border-radius:28px;background:rgba(255,255,255,.98);box-shadow:0 28px 80px rgba(11,35,74,.16)}
    #qa-login-logo{display:flex;align-items:center;justify-content:center;min-height:92px;margin:0 auto 22px;padding:16px 22px;border-radius:20px;background:#fff;box-shadow:0 10px 34px rgba(11,35,74,.08)}
    #qa-login-logo img{display:block;width:245px;max-width:100%;height:auto}
    #qa-login-card h1{margin:0;color:#1F2A55;text-align:center;font-size:26px;font-weight:800;letter-spacing:-.02em}
    #qa-login-card p{margin:9px 0 26px;color:#597587;text-align:center;font-size:14px;line-height:1.6}
    .qa-field{margin-top:16px}.qa-field label{display:block;margin-bottom:7px;color:#334155;font-size:13px;font-weight:700}
    .qa-field input{box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #dbe4ef;border-radius:14px;outline:none;background:#fff;color:#0f172a;transition:.2s ease}
    .qa-field input:focus{border-color:var(--brand-blue);box-shadow:0 0 0 4px rgba(5,111,236,.12)}
    #qa-login-submit{width:100%;height:50px;margin-top:22px;border:0;border-radius:15px;background:var(--brand-blue);color:#fff;font-weight:800;cursor:pointer;box-shadow:0 12px 28px rgba(5,111,236,.24)}
    #qa-login-submit:hover{filter:brightness(.96)}#qa-login-submit:disabled{opacity:.7;cursor:wait}
    #qa-login-error{min-height:20px;margin-top:12px;color:#AA1818;text-align:center;font-size:13px;font-weight:700}
    #qa-login-note{margin-top:18px;color:#85A5B9;text-align:center;font-size:11px}
    #qa-logout{position:fixed;right:18px;bottom:18px;z-index:999999;height:38px;padding:0 14px;border:1px solid rgba(5,111,236,.18);border-radius:999px;background:rgba(255,255,255,.96);color:#1F2A55;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 10px 30px rgba(11,35,74,.12);backdrop-filter:blur(12px)}
    #qa-logout:hover{color:var(--brand-blue);border-color:rgba(5,111,236,.4)}
    .text-blue-500,.text-blue-600,.text-blue-700,.text-blue-800,.text-blue-900,.text-sky-500,.text-sky-600{color:var(--brand-blue)!important}
    .bg-blue-500,.bg-blue-600,.bg-blue-700,.bg-blue-800,.bg-sky-500,.bg-sky-600{background-color:var(--brand-blue)!important}
    .border-blue-400,.border-blue-500,.border-blue-600,.border-sky-400,.border-sky-500{border-color:var(--brand-blue)!important}
    @media(max-width:768px){#qa-login-card{padding:28px 22px;border-radius:22px}#qa-login-logo img{width:210px}#qa-logout{right:12px;bottom:12px}}
  `;
  document.head.appendChild(css);

  const replaceColor = (value) => {
    if (!value || typeof value !== "string") return value;
    return value
      .replace(/#1769e0/gi, BLUE)
      .replace(/rgb\(\s*23\s*,\s*105\s*,\s*224\s*\)/gi, BLUE)
      .replace(/#5aa7ff/gi, LIGHT_BLUE)
      .replace(/rgb\(\s*90\s*,\s*167\s*,\s*255\s*\)/gi, LIGHT_BLUE);
  };

  function recolor(node) {
    if (!(node instanceof Element)) return;
    const elements = [node, ...node.querySelectorAll("[style],[fill],[stroke]")];
    elements.forEach((el) => {
      ["style", "fill", "stroke"].forEach((attr) => {
        const oldValue = el.getAttribute(attr);
        const newValue = replaceColor(oldValue);
        if (newValue && newValue !== oldValue) el.setAttribute(attr, newValue);
      });
    });
  }

  function addLogout() {
    if (document.getElementById("qa-logout")) return;
    const button = document.createElement("button");
    button.id = "qa-logout";
    button.type = "button";
    button.textContent = "Log out";
    button.onclick = () => {
      localStorage.removeItem(SESSION_KEY);
      location.reload();
    };
    document.body.appendChild(button);
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function unlock() {
    document.documentElement.classList.remove("qa-locked");
    document.getElementById("qa-login")?.remove();
    addLogout();
  }

  function showLogin() {
    document.documentElement.classList.add("qa-locked");
    if (document.getElementById("qa-login")) return;
    const gate = document.createElement("div");
    gate.id = "qa-login";
    gate.innerHTML = `
      <form id="qa-login-card" autocomplete="off">
        <div id="qa-login-logo"><img src="${LOGO}" alt="iSchool"></div>
        <h1>Quality Intelligence</h1>
        <p>Sign in to access monthly reviews, team analytics, objections and SLA insights.</p>
        <div class="qa-field"><label for="qa-user">Username</label><input id="qa-user" type="text" autocomplete="username" required></div>
        <div class="qa-field"><label for="qa-pass">Password</label><input id="qa-pass" type="password" autocomplete="current-password" required></div>
        <button id="qa-login-submit" type="submit">Sign in</button>
        <div id="qa-login-error" role="alert" aria-live="polite"></div>
        <div id="qa-login-note">Protected access • Session expires after 8 hours</div>
      </form>`;
    document.body.appendChild(gate);

    const form = gate.querySelector("form");
    const user = gate.querySelector("#qa-user");
    const pass = gate.querySelector("#qa-pass");
    const error = gate.querySelector("#qa-login-error");
    const submit = gate.querySelector("#qa-login-submit");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      submit.disabled = true;
      submit.textContent = "Checking…";
      try {
        const [userHash, passHash] = await Promise.all([sha256(user.value.trim()), sha256(pass.value)]);
        if (userHash === USER_HASH && passHash === PASS_HASH) {
          localStorage.setItem(SESSION_KEY, JSON.stringify({ expiresAt: Date.now() + SESSION_MS }));
          unlock();
        } else {
          error.textContent = "Incorrect username or password.";
          pass.value = "";
          pass.focus();
        }
      } catch {
        error.textContent = "Unable to verify access. Refresh and try again.";
      } finally {
        submit.disabled = false;
        submit.textContent = "Sign in";
      }
    });
    setTimeout(() => user.focus(), 0);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes") recolor(mutation.target);
      mutation.addedNodes.forEach(recolor);
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "fill", "stroke"] });

  const start = () => {
    if (validSession()) unlock(); else showLogin();
    recolor(document.documentElement);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  setInterval(() => {
    if (!validSession() && !document.getElementById("qa-login")) {
      localStorage.removeItem(SESSION_KEY);
      location.reload();
    }
  }, 60000);
})();
