(function () {
  const meta = document.querySelector('meta[name="app-api-base"]');
  const isBrowserOrigin = window.location.protocol === "http:" || window.location.protocol === "https:";
  const hostname = window.location.hostname;
  const port = window.location.port;
  const nativeBridge = window.Capacitor;
  const isAndroidWebView = /; wv\)/i.test(window.navigator.userAgent || "");
  const isLocalDevServer =
    (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "") &&
    ["3000", "3001", "4173", "5173"].includes(port);
  const isCapacitorLocalhost = hostname === "localhost" && !isLocalDevServer;
  const isNativeApp =
    window.location.protocol === "capacitor:" ||
    isCapacitorLocalhost ||
    isAndroidWebView ||
    Boolean(nativeBridge?.platform && nativeBridge.platform !== "web") ||
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
