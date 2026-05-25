(function () {
  const meta = document.querySelector('meta[name="app-api-base"]');
  const isBrowserOrigin = window.location.protocol === "http:" || window.location.protocol === "https:";
  const apiBase = isBrowserOrigin ? "" : normalizeBase(meta ? meta.content : "");

  function buildApiUrl(pathname) {
    const normalizedPath = String(pathname || "").startsWith("/")
      ? String(pathname || "")
      : `/${String(pathname || "")}`;

    return apiBase ? `${apiBase}${normalizedPath}` : normalizedPath;
  }

  window.ultimoSobreviventeConfig = Object.freeze({
    apiBase,
    buildApiUrl,
  });
})();

function normalizeBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}
