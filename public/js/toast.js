// ============================================================
//  public/js/toast.js  –  Globální toast notifikace
//  Použití: showToast("Hotovo!", "success")
//           showToast("Něco se pokazilo", "danger")
//           showToast("Pozor", "warning")
//           showToast("Info", "info")
// ============================================================

(function () {
  // Vytvoř kontejner jednou, pokud ještě neexistuje
  function getContainer() {
    let el = document.getElementById("toastContainer");
    if (!el) {
      el = document.createElement("div");
      el.id = "toastContainer";
      el.style.cssText = [
        "position:fixed",
        "bottom:24px",
        "right:24px",
        "z-index:9999",
        "display:flex",
        "flex-direction:column",
        "gap:10px",
        "pointer-events:none",
        "max-width:340px",
        "width:calc(100vw - 48px)",
      ].join(";");
      document.body.appendChild(el);
    }
    return el;
  }

  const ICONS = {
    success: "bi-check-circle-fill",
    danger:  "bi-x-circle-fill",
    warning: "bi-exclamation-triangle-fill",
    info:    "bi-info-circle-fill",
  };

  const COLORS = {
    success: "#198754",
    danger:  "#dc3545",
    warning: "#e6a817",
    info:    "#0d6efd",
  };

  /**
   * Zobrazí toast notifikaci.
   * @param {string} message   – text zprávy
   * @param {"success"|"danger"|"warning"|"info"} type – typ (default: "info")
   * @param {number} duration  – ms do zmizení (default: 3500)
   */
  window.showToast = function (message, type = "info", duration = 3500) {
    const container = getContainer();
    const color     = COLORS[type] || COLORS.info;
    const icon      = ICONS[type]  || ICONS.info;

    const toast = document.createElement("div");
    toast.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:10px",
      "background:#fff",
      "border-radius:10px",
      "box-shadow:0 4px 20px rgba(0,0,0,0.15)",
      "padding:12px 16px",
      `border-left:4px solid ${color}`,
      "pointer-events:auto",
      "opacity:0",
      "transform:translateY(12px)",
      "transition:opacity .25s ease, transform .25s ease",
      "font-size:.92rem",
      "line-height:1.4",
      "word-break:break-word",
    ].join(";");

    toast.innerHTML = `
      <i class="bi ${icon}" style="color:${color};font-size:1.15rem;flex-shrink:0;"></i>
      <span style="flex:1;">${message}</span>
      <button onclick="this.closest('div').remove()" style="
        background:none;border:none;cursor:pointer;padding:0 0 0 6px;
        color:#aaa;font-size:1rem;line-height:1;flex-shrink:0;" title="Zavřít">✕</button>
    `;

    container.appendChild(toast);

    // Animace IN
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.opacity   = "1";
        toast.style.transform = "translateY(0)";
      });
    });

    // Auto-dismiss
    const timer = setTimeout(() => dismissToast(toast), duration);

    // Pozastav timer při hoveru
    toast.addEventListener("mouseenter", () => clearTimeout(timer));
    toast.addEventListener("mouseleave", () => {
      setTimeout(() => dismissToast(toast), 1200);
    });
  };

  function dismissToast(toast) {
    toast.style.opacity   = "0";
    toast.style.transform = "translateY(12px)";
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }
})();
