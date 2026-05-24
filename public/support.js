const form = document.querySelector("#support-form");
const statusBox = document.querySelector("#support-status");

if (form) {
  form.addEventListener("submit", onSubmitSupport);
}

async function onSubmitSupport(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!email || !subject || !message) {
    renderStatus("Preencha email, assunto e mensagem antes de enviar.", "error");
    return;
  }

  renderStatus("Enviando mensagem...", "neutral");

  try {
    const response = await fetch("/api/support", {
      body: JSON.stringify({
        email,
        message,
        subject,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Não foi possível enviar sua mensagem agora.");
    }

    form.reset();
    renderStatus("Mensagem enviada com sucesso. Obrigado pelo contato.", "success");
  } catch (error) {
    renderStatus(error instanceof Error ? error.message : "Não foi possível enviar sua mensagem agora.", "error");
  }
}

function renderStatus(message, tone) {
  if (!statusBox) {
    return;
  }

  statusBox.textContent = message;
  statusBox.className = `support-status support-status--${tone}`;
}
