(function () {
  "use strict";

  const IDLE_CHECK_INTERVAL_MS = 60 * 1000;
  let lastActivity = Date.now();
  let idleIntervalId = null;

  async function includeOne(el) {
    const url = el.getAttribute("data-include");
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      el.outerHTML = `<!-- failed to load partial: ${url} (network error) -->`;
      return;
    }
    if (!res.ok) {
      el.outerHTML = `<!-- failed to load partial: ${url} (${res.status}) -->`;
      return;
    }
    el.outerHTML = await res.text();
  }

  function setActiveNav() {
    const page = document.body.dataset.page;
    if (!page) return;
    document.querySelectorAll("[data-nav]").forEach((el) => {
      if (el.getAttribute("data-nav") === page) el.classList.add("active");
    });
  }

  async function bindUserChip() {
    const user = await Api.getCurrentUser();
    if (!user) {
      window.location.href = "login.html";
      return null;
    }
    document.querySelectorAll('[data-bind="user-initials"]').forEach((el) => {
      el.textContent = user.initials;
      el.title = user.name;
    });
    return user;
  }

  async function doLogout() {
    await Api.logout();
    window.location.href = "login.html";
  }

  function bindLogout() {
    const link = document.getElementById("logoutLink");
    if (!link) return;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      doLogout();
    });
  }

  function startIdleWatch() {
    if (idleIntervalId) return;
    lastActivity = Date.now();
    ["click", "keydown", "mousemove"].forEach((evt) => {
      document.addEventListener(evt, () => {
        lastActivity = Date.now();
      });
    });
    idleIntervalId = setInterval(() => {
      if (AuthRules.isSessionIdle(lastActivity, Date.now())) {
        clearInterval(idleIntervalId);
        idleIntervalId = null;
        doLogout();
      }
    }, IDLE_CHECK_INTERVAL_MS);
  }

  function showPageError() {
    const main = document.querySelector("main.app-content");
    if (main) main.innerHTML = `<p>تعذّر تحميل الصفحة. يرجى إعادة المحاولة.</p>`;
  }

  async function initPartials() {
    const targets = Array.from(document.querySelectorAll("[data-include]"));
    await Promise.all(targets.map(includeOne));
    setActiveNav();
    const user = await bindUserChip();
    if (!user) return null;
    bindLogout();
    startIdleWatch();
    return user;
  }

  window.Partials = { initPartials, showPageError };
})();
