const root = document.querySelector("#ops-root");

loadOps();
setInterval(loadOps, 15000);

async function loadOps() {
  if (!root) {
    return;
  }

  try {
    const response = await fetch("/api/ops", {
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Não foi possível carregar as métricas.");
    }

    root.innerHTML = `
      <div class="ops-panel">
        <h2 class="section-title">Status atual</h2>
        <pre>${escapeHtml(JSON.stringify(payload.status, null, 2))}</pre>
      </div>
      <div class="ops-panel">
        <h2 class="section-title">Monitoramento</h2>
        <pre>${escapeHtml(JSON.stringify(payload.monitoring, null, 2))}</pre>
      </div>
      <div class="ops-panel">
        <h2 class="section-title">Operação da IA</h2>
        <pre>${escapeHtml(JSON.stringify(payload.ops, null, 2))}</pre>
        <p class="ops-note">Atualizado em ${escapeHtml(new Date(payload.generatedAt).toLocaleString("pt-BR"))}</p>
      </div>
    `;
  } catch (error) {
    root.innerHTML = `
      <div class="ops-panel">
        <h2 class="section-title">Falha ao carregar</h2>
        <pre>${escapeHtml(error instanceof Error ? error.message : "Erro inesperado.")}</pre>
      </div>
    `;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
