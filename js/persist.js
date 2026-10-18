(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.Persist = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Root cause of "case not found after I just opened it": this whole app has
  // no backend — every data module's array lives only in that page's JS heap
  // and resets to the static seed on the next page load. This is the fix:
  // every Api.* call snapshots the live arrays to localStorage, and every data
  // module hydrates from that snapshot (falling back to its seed) at load time.
  const PREFIX = "platform_ui_v1_";

  function hasStorage() {
    try {
      return typeof localStorage !== "undefined";
    } catch (e) {
      return false;
    }
  }

  function load(key, fallback) {
    if (!hasStorage()) return fallback;
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    if (!hasStorage()) return;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      // storage full or blocked (private browsing) — this page's in-memory
      // state still works, it just won't survive to the next page load.
    }
  }

  function clear() {
    if (!hasStorage()) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.indexOf(PREFIX) === 0)
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  }

  return { load, save, clear };
});
