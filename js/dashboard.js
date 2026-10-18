(function () {
  "use strict";

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMetrics(metrics) {
    document.getElementById("mOpenCases").textContent = metrics.openCases;
    document.getElementById("mPendingLab").textContent = metrics.pendingLabTests;
    document.getElementById("mAwareness").textContent = metrics.activeAwarenessTracks;
    document.getElementById("mSecurity").textContent = metrics.securityAlerts;
  }

  function renderRecentCases(cases) {
    const now = new Date();
    const rows = cases
      .map((c) => {
        const displayStatus = Format.getCaseDisplayStatus(c);
        const variant = Format.getCaseTagVariant(displayStatus);
        const relTime = Format.formatRelativeArabicTime(new Date(c.updatedAt), now);
        return `<tr class="clickable" onclick="location.href='case-detail.html?id=${c.id}'">
          <td class="id">${c.id}</td>
          <td>${c.type}</td>
          <td><span class="tag ${variant}"><span class="dot"></span> ${displayStatus}</span></td>
          <td class="id">${relTime}</td>
        </tr>`;
      })
      .join("");
    document.getElementById("recentCasesBody").innerHTML = rows;
  }

  function renderAuditList(entries) {
    const html = entries
      .map((e) => {
        const t = new Date(e.timestamp);
        const hh = String(t.getUTCHours()).padStart(2, "0");
        const mm = String(t.getUTCMinutes()).padStart(2, "0");
        return `<div class="audit-item"><time>${hh}:${mm}</time><span class="what"><b>${escapeHtml(e.actorName)}</b> ${escapeHtml(e.description)}</span></div>`;
      })
      .join("");
    document.getElementById("auditList").innerHTML = html;
  }

  function resultRowHtml(label, href) {
    return `<a href="${href}" style="display:block; padding:6px 10px; border-radius:var(--radius-sm); text-decoration:none; color:var(--text-default); font-size:13px;">${escapeHtml(label)}</a>`;
  }

  function renderSearchResults(results) {
    const box = document.getElementById("smartSearchResults");
    const groups = [
      { title: "المنسوبون", rows: results.personnel.map((p) => resultRowHtml(`${p.name} (${p.personnelNumber})`, `personnel.html`)) },
      { title: "القضايا", rows: results.cases.map((c) => resultRowHtml(`${c.id} — ${c.type} — ${c.status}`, `case-detail.html?id=${encodeURIComponent(c.id)}`)) },
      { title: "التحاليل المخبرية", rows: results.labTests.map((t) => resultRowHtml(`${t.id} — ${t.testType} — ${t.status}`, `lab.html`)) },
      { title: "مسارات التوعية", rows: results.awarenessTracks.map((t) => resultRowHtml(`${t.id} — ${t.reason} — ${t.status}`, `awareness.html`)) },
    ].filter((g) => g.rows.length);

    box.innerHTML = groups.length
      ? groups.map((g) => `<div style="padding:8px 10px 2px; font-size:11px; color:var(--text-faint); font-weight:600;">${escapeHtml(g.title)}</div>${g.rows.join("")}`).join("")
      : `<div style="padding:10px; font-size:13px; color:var(--text-faint);">لا نتائج</div>`;
    box.style.display = "block";
  }

  function renderSmartSearchBar(user) {
    const effective = Permissions.computeEffectivePermissions(user);
    if (!effective.includes("platform.super_admin")) return;
    const mount = document.getElementById("smartSearchMount");
    if (!mount) return;
    mount.innerHTML = `<div style="position:relative;">
        <div class="search-bar" id="smartSearchBar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
          <input type="text" id="smartSearchInput" placeholder="البحث الذكي — استعلم عن منسوب أو قضية عبر كل الوحدات…">
          <span class="kbd">صلاحية عليا</span>
        </div>
        <div id="smartSearchResults" style="display:none; position:absolute; top:100%; right:0; left:0; background:#fff; border:1px solid var(--border); border-radius:var(--radius-md); box-shadow:var(--shadow-md,0 4px 16px rgba(0,0,0,.08)); z-index:20; max-height:360px; overflow-y:auto; margin-top:4px;"></div>
      </div>`;

    const input = document.getElementById("smartSearchInput");
    input.addEventListener("keydown", async (ev) => {
      if (ev.key !== "Enter") return;
      const q = input.value.trim();
      if (!q) return;
      try {
        renderSearchResults(await Api.smartSearch(q));
      } catch (e) {
        document.getElementById("smartSearchResults").style.display = "none";
      }
    });
  }

  async function init() {
    try {
      const user = await Partials.initPartials();
      if (!user) return;

      renderSmartSearchBar(user);

      const metrics = await Api.getMetrics();
      renderMetrics(metrics);

      const recent = await Api.listCases({ page: 1 });
      renderRecentCases(recent.items.slice(0, 4));

      const audit = await Api.listAuditLog({ limit: 4 });
      renderAuditList(audit);
    } catch (e) {
      Partials.showPageError();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
