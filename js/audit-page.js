(function () {
  "use strict";

  const PRIVILEGED_ROLES = ["super-admin", "auditor"];

  function scopedEntries(user, allEntries) {
    if (PRIVILEGED_ROLES.includes(user.role)) return allEntries;
    return allEntries.filter((e) => e.actorId === user.id);
  }

  function populateEventTypeOptions(entries) {
    const select = document.getElementById("eventTypeFilter");
    const types = Array.from(new Set(entries.map((e) => e.eventType)));
    types.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      select.appendChild(opt);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderRows(entries) {
    const html = entries
      .map((e) => {
        const dt = new Date(e.timestamp);
        const timeStr = dt.toISOString().replace("T", " ").slice(0, 16);
        return `<tr><td class="time">${timeStr}</td><td>${escapeHtml(e.actorName)}</td><td>${escapeHtml(e.eventType)}</td><td>${escapeHtml(e.description)}</td></tr>`;
      })
      .join("");
    document.getElementById("auditBody").innerHTML = html || `<tr><td colspan="4">لا توجد أحداث مطابقة</td></tr>`;
  }

  async function applyFilters(user, scopedAllEntries) {
    const actorQuery = document.getElementById("actorFilter").value.trim().toLowerCase();
    const eventType = document.getElementById("eventTypeFilter").value;

    let scoped = scopedAllEntries;
    if (actorQuery) {
      scoped = scoped.filter((e) => e.actorName.toLowerCase().includes(actorQuery));
    }
    if (eventType) {
      scoped = scoped.filter((e) => e.eventType === eventType);
    }
    renderRows(scoped);
  }

  async function init() {
    try {
      const user = await Partials.initPartials();
      if (!user) return;

      const scopeNote = document.getElementById("scopeNote");
      scopeNote.textContent = PRIVILEGED_ROLES.includes(user.role)
        ? "عرض كامل لسجل التدقيق (صلاحية عليا / مدقق نظام)."
        : "عرض جزئي: الأحداث المرتبطة بحسابك فقط.";

      const allEntries = await Api.listAuditLog();
      const scoped = scopedEntries(user, allEntries);
      populateEventTypeOptions(scoped);

      document.getElementById("actorFilter").addEventListener("input", () => applyFilters(user, scoped));
      document.getElementById("eventTypeFilter").addEventListener("change", () => applyFilters(user, scoped));

      await applyFilters(user, scoped);
    } catch (e) {
      Partials.showPageError();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
