(function () {
  "use strict";

  let allUnits = [];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function csvCell(v) {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadCsv(filename, rows, columns) {
    const header = columns.map((c) => c.label).join(",");
    const lines = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(","));
    const csv = [header, ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function inDateRange(isoDate, from, to) {
    const d = (isoDate || "").slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function unitMatches(orgUnitId, scopeUnitId) {
    if (!scopeUnitId) return true;
    if (!orgUnitId) return false;
    return OrgTree.isWithinScope(allUnits, scopeUnitId, orgUnitId);
  }

  function breakdown(rows, keyFn) {
    const counts = {};
    rows.forEach((r) => {
      const k = keyFn(r) || "—";
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  function renderSection(id, title, totalLabel, total, breakdownPairs, onExport) {
    const rows = breakdownPairs.map(([label, count]) => `<tr><td>${escapeHtml(label)}</td><td class="id">${count}</td></tr>`).join("");
    return `
      <div class="report-section">
        <div class="panel">
          <div class="panel-head">
            <h2>${escapeHtml(title)} — ${totalLabel}: <span class="mono">${total}</span></h2>
            <button class="btn outline" type="button" id="${id}-export">تصدير CSV</button>
          </div>
          <table class="data-table breakdown-table">
            <tbody>${rows || '<tr><td colspan="2">لا بيانات ضمن هذه الفلاتر</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function renderAll() {
    const from = document.getElementById("fromDate").value;
    const to = document.getElementById("toDate").value;
    const scopeUnitId = document.getElementById("unitFilter").value;

    const [allCases, allPersonnel, allLabTests, allTracks, auditLog] = await Promise.all([
      Api.listCases({ pageSize: 9999 }).then((r) => r.items),
      Api.listPersonnel({ includeArchived: true }),
      Api.listLabTests({}),
      Api.listAwarenessTracks({}),
      Api.listAuditLog({}),
    ]);

    const personnelById = new Map(allPersonnel.map((p) => [p.id, p]));
    const unitOfPersonnel = (personnelId) => (personnelById.get(personnelId) || {}).orgUnitId;

    const cases = allCases.filter((c) => inDateRange(c.openedDate, from, to) && unitMatches(c.orgUnitId, scopeUnitId));
    const personnel = allPersonnel.filter((p) => inDateRange(p.joinDate, from, to) && unitMatches(p.orgUnitId, scopeUnitId));
    const labTests = allLabTests.filter((t) => inDateRange(t.requestedAt, from, to) && unitMatches(unitOfPersonnel(t.personnelId), scopeUnitId));
    const tracks = allTracks.filter((t) => inDateRange(t.statusHistory[0] && t.statusHistory[0].timestamp, from, to) && unitMatches(unitOfPersonnel(t.personnelId), scopeUnitId));
    const audit = auditLog.filter((e) => inDateRange(e.timestamp, from, to));

    const html = [
      renderSection("cases", "القضايا الإدارية", "الإجمالي", cases.length, breakdown(cases, (c) => Format.getCaseDisplayStatus(c))),
      renderSection("personnel", "تعريف المنسوبين", "الإجمالي", personnel.length, breakdown(personnel, (p) => p.status === "archived" ? "مؤرشف" : "نشط")),
      renderSection("lab", "التحاليل المخبرية", "الإجمالي", labTests.length, breakdown(labTests, (t) => t.status)),
      renderSection("awareness", "التوعية والمعالجة", "الإجمالي", tracks.length, breakdown(tracks, (t) => t.status)),
      renderSection("audit", "سجل التدقيق", "الإجمالي", audit.length, breakdown(audit, (e) => e.eventType)),
    ].join("");

    document.getElementById("reportSections").innerHTML = html;

    document.getElementById("cases-export").addEventListener("click", () =>
      downloadCsv("تقرير-القضايا.csv", cases, [
        { key: "id", label: "رقم القضية" }, { key: "type", label: "النوع" }, { key: "status", label: "الحالة" },
        { key: "openedDate", label: "تاريخ الفتح" }, { key: "orgUnitId", label: "جهة العمل" },
      ])
    );
    document.getElementById("personnel-export").addEventListener("click", () =>
      downloadCsv("تقرير-المنسوبين.csv", personnel, [
        { key: "personnelNumber", label: "رقم المنسوب" }, { key: "name", label: "الاسم" }, { key: "rank", label: "الرتبة" },
        { key: "orgUnitId", label: "جهة العمل" }, { key: "joinDate", label: "تاريخ الالتحاق" }, { key: "status", label: "الحالة" },
      ])
    );
    document.getElementById("lab-export").addEventListener("click", () =>
      downloadCsv("تقرير-التحاليل.csv", labTests, [
        { key: "id", label: "رقم الفحص" }, { key: "personnelId", label: "المنسوب" }, { key: "testType", label: "نوع الفحص" },
        { key: "status", label: "الحالة" }, { key: "requestedAt", label: "تاريخ الطلب" },
      ])
    );
    document.getElementById("awareness-export").addEventListener("click", () =>
      downloadCsv("تقرير-التوعية.csv", tracks, [
        { key: "id", label: "رقم المسار" }, { key: "personnelId", label: "المنسوب" }, { key: "reason", label: "السبب" }, { key: "status", label: "الحالة" },
      ])
    );
    document.getElementById("audit-export").addEventListener("click", () =>
      downloadCsv("تقرير-سجل-التدقيق.csv", audit, [
        { key: "id", label: "الرقم" }, { key: "actorName", label: "الفاعل" }, { key: "eventType", label: "نوع الحدث" },
        { key: "description", label: "الوصف" }, { key: "timestamp", label: "الوقت" },
      ])
    );
  }

  async function init() {
    const currentUser = await Partials.initPartials();
    if (!currentUser) return;
    try {
      allUnits = await Api.listOrgUnits();
      const LEVEL_DEPTH = { hq: 0, region: 1, department: 2, division: 3, section: 4 };
      document.getElementById("unitFilter").insertAdjacentHTML(
        "beforeend",
        allUnits.map((u) => `<option value="${escapeHtml(u.id)}">${"— ".repeat(LEVEL_DEPTH[u.level] || 0)}${escapeHtml(u.name)}</option>`).join("")
      );

      await renderAll();
      document.getElementById("applyFiltersBtn").addEventListener("click", renderAll);
    } catch (e) {
      Partials.showPageError();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
