(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.Masking = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function maskPersonnelName(fullName) {
    const words = String(fullName).trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "";
    const first = words[0];
    let last = words[words.length - 1];
    // Strip the definite article "ال" prefix from the last word
    if (last.startsWith("ال") && last.length > 2) {
      last = last.substring(2);
    }
    return `${first.charAt(0)}. ***** ${last.charAt(0)}.`;
  }

  function revealPersonnelName(fullName) {
    return String(fullName).trim().replace(/\s+/g, " ");
  }

  return { maskPersonnelName, revealPersonnelName };
});
