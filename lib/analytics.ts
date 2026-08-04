export const analyticsEventNames = [
  "visualizacao_agencia", "busca_realizada", "filtro_utilizado", "clique_whatsapp", "clique_telefone", "clique_email", "clique_site",
  "formulario_iniciado", "formulario_enviado", "lead_gerado", "contato_registrado", "reuniao_agendada", "proposta_enviada", "oportunidade_criada", "venda_concluida",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export function trackEvent(name: AnalyticsEventName, metadata: Record<string, string | number | boolean | null> = {}) {
  if (typeof window !== "undefined") {
    const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer ?? [];
    dataLayer.push({ event: name, ...metadata });
    (window as Window & { dataLayer?: unknown[] }).dataLayer = dataLayer;
    void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, path: window.location.pathname, metadata }) }).catch(() => undefined);
  }
}
