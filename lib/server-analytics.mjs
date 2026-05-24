import { recordFrontendEvent } from "./ops-monitor.mjs";

let vercelTrackPromise;

export async function trackServerEvent(name, properties = {}) {
  if (!name) {
    return;
  }

  recordFrontendEvent(name, properties);

  if (!process.env.VERCEL) {
    console.info("[analytics:event]", JSON.stringify({ name, properties }));
    return;
  }

  try {
    const track = await loadVercelTrack();
    if (!track) {
      return;
    }

    await track(name, properties);
  } catch (error) {
    console.warn("[analytics:event] failed", {
      message: error instanceof Error ? error.message : String(error),
      name,
    });
  }
}

async function loadVercelTrack() {
  if (!vercelTrackPromise) {
    vercelTrackPromise = import("@vercel/analytics/server")
      .then((module) => module.track)
      .catch(() => null);
  }

  return vercelTrackPromise;
}
