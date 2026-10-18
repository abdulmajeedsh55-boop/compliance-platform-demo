(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.Format = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatCountdown(totalSeconds) {
    const clamped = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${pad2(minutes)}:${pad2(seconds)}`;
  }

  function arabicTier(n, one, two, few, many) {
    // few: 3-10, many: 11+
    if (n === 1) return one;
    if (n === 2) return two;
    if (n >= 3 && n <= 10) return `${n} ${few}`;
    return `${n} ${many}`;
  }

  function formatRelativeArabicTime(targetDate, now) {
    const diffMs = now.getTime() - targetDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return "الآن";

    if (diffMinutes < 60) {
      return `قبل ${arabicTier(diffMinutes, "دقيقة", "دقيقتين", "دقائق", "دقيقة")}`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `قبل ${arabicTier(diffHours, "ساعة", "ساعتين", "ساعات", "ساعة")}`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "أمس";
    if (diffDays === 2) return "قبل يومين";
    if (diffDays === 7) return "قبل أسبوع";
    if (diffDays <= 10) return `قبل ${diffDays} أيام`;
    if (diffDays < 30) return `قبل ${diffDays} يوماً`;

    const y = targetDate.getUTCFullYear();
    const m = pad2(targetDate.getUTCMonth() + 1);
    const d = pad2(targetDate.getUTCDate());
    return `${y}-${m}-${d}`;
  }

  const LIFECYCLE_TO_SHORT = {
    "جديدة (منصة داخلية)": "جديدة",
    "جديدة (واردة من الجهة)": "جديدة",
    "قيد المراجعة الداخلية": "قيد المراجعة",
    "مُحالة للجهة / بانتظار رد الجهة": "قيد المراجعة",
    "تصعيد داخلي": "قيد المراجعة",
    "الحكم مستلم": "قيد المراجعة",
    "مغلقة": "مغلقة",
  };

  function getCaseDisplayStatus(caseItem) {
    if (caseItem.internalDecision) return caseItem.internalDecision;
    return LIFECYCLE_TO_SHORT[caseItem.status] || caseItem.status;
  }

  const STATUS_TO_VARIANT = {
    "معتمدة": "success",
    "مرفوضة": "error",
    "تصعيد داخلي": "warn",
    "جديدة": "info",
    "قيد المراجعة": "warn",
    "مغلقة": "neutral",
  };

  function getCaseTagVariant(displayStatus) {
    return STATUS_TO_VARIANT[displayStatus] || "neutral";
  }

  return { formatCountdown, formatRelativeArabicTime, getCaseDisplayStatus, getCaseTagVariant };
});
