// Label Studio Community Edition REST client. Config-driven via env; every
// method no-ops safely (returns { configured: false }) when the instance/token
// aren't set, so the portal runs without a live LS. Verified mechanisms per the
// integration spec's Section 9 (annotator_evaluation_enabled + ground_truth).

const BASE = process.env.LABEL_STUDIO_BASE_URL;
const TOKEN = process.env.LABEL_STUDIO_API_TOKEN;

function configured(): boolean {
  return Boolean(BASE && TOKEN);
}

async function ls<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<{ configured: boolean; ok: boolean; status: number; data?: T; error?: string }> {
  if (!configured()) return { configured: false, ok: false, status: 0, error: "Label Studio not configured" };
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Token ${TOKEN}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const data = (await res.json().catch(() => undefined)) as T | undefined;
    return { configured: true, ok: res.ok, status: res.status, data };
  } catch (e) {
    return { configured: true, ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export const labelStudio = {
  configured,

  // Create a project (optionally from a template's labeling config XML).
  createProject(input: { title: string; label_config?: string }) {
    return ls("/api/projects/", { method: "POST", body: JSON.stringify(input) });
  },

  // Turn on native gold-task-first serving for a qualification/exam project.
  enableAnnotatorEvaluation(projectId: string) {
    return ls(`/api/projects/${projectId}/`, {
      method: "PATCH",
      body: JSON.stringify({ annotator_evaluation_enabled: true }),
    });
  },

  // Import tasks. Tag with rate-card metadata (task_type, complexity, client).
  importTasks(projectId: string, tasks: Array<Record<string, unknown>>) {
    return ls(`/api/projects/${projectId}/import`, { method: "POST", body: JSON.stringify(tasks) });
  },

  // Mark the known-correct answer as a ground_truth annotation (the answer key).
  createGroundTruthAnnotation(taskId: string, result: unknown) {
    return ls(`/api/tasks/${taskId}/annotations/`, {
      method: "POST",
      body: JSON.stringify({ result, ground_truth: true }),
    });
  },

  // Register the ANNOTATION_CREATED/UPDATED webhook back to Valtaris.
  ensureWebhook(projectId: string, url: string) {
    return ls("/api/webhooks/", {
      method: "POST",
      body: JSON.stringify({ project: projectId, url, send_payload: true, actions: ["ANNOTATION_CREATED", "ANNOTATION_UPDATED"] }),
    });
  },

  // Reconciliation: list annotations for a project (paged upstream).
  listAnnotations(projectId: string) {
    return ls(`/api/projects/${projectId}/annotations/`, { method: "GET" });
  },
};
