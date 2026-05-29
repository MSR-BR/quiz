(function () {
  const meta = document.querySelector('meta[name="app-api-base"]');
  const isBrowserOrigin = window.location.protocol === "http:" || window.location.protocol === "https:";
  const nativeBridge = window.Capacitor;
  const isNativeApp =
    window.location.protocol === "capacitor:" ||
    Boolean(nativeBridge?.isNativePlatform?.()) ||
    Boolean(nativeBridge?.getPlatform && nativeBridge.getPlatform() !== "web");
  const apiBase = isBrowserOrigin && !isNativeApp ? "" : normalizeBase(meta ? meta.content : "");

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
