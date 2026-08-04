import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("inclui a identidade e os acessos principais", async () => {
  const [home, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);
  assert.match(home, /Quem conecta o Rio Grande do Sul ao mundo/);
  assert.match(home, /Explorar intercâmbio/);
  assert.match(layout, /Mapa de Agências RS/);
  assert.match(layout, /className="nav-link nav-exchange">Intercâmbio/);
  assert.match(layout, /className="nav-link nav-tourism">Agências de turismo/);
  assert.match(layout, /className="nav-link nav-map">Mapa regional/);
  assert.match(layout, /\/agencias/);
  assert.match(layout, /\/turismo/);
  assert.match(layout, /\/mapa/);
  assert.match(layout, /\/admin/);
  assert.doesNotMatch(home + layout, /codex-preview|react-loading-skeleton/);
});

test("unifica as bases na visão regional e oferece filtros", async () => {
  const [regional, mapPage] = await Promise.all([
    readFile(new URL("app/components/RegionalView.tsx", root), "utf8"),
    readFile(new URL("app/mapa/page.tsx", root), "utf8"),
  ]);
  assert.match(regional, /\/api\/regional/);
  assert.match(regional, /Intercâmbio/);
  assert.match(regional, /Turismo/);
  assert.match(regional, /Buscar nome, cidade, CNPJ ou endereço/);
  assert.match(regional, /Endereço/);
  assert.match(regional, /Telefone/);
  assert.match(mapPage, /base unificada/);
});

test("gera o pacote e o cartão social", async () => {
  await access(new URL("dist/server/index.js", root));
  await access(new URL("public/og.png", root));
  const tourism = JSON.parse(await readFile(new URL("lib/turismo-seed.json", root), "utf8"));
  assert.equal(tourism.length, 2813);
  assert.ok(tourism.every((item) => item.status === "Regular" && item.state === "RS"));
  assert.equal(tourism.find((item) => item.city.startsWith("Viam"))?.city, "Viamão");
  assert.equal(tourism.find((item) => item.city.startsWith("Jaguar"))?.city, "Jaguarão");
  const hosting = JSON.parse(await readFile(new URL(".openai/hosting.json", root), "utf8"));
  assert.equal(hosting.d1, "DB");
});

test("inclui o workspace comercial e os fluxos da prioridade 1", async () => {
  const [dashboard, followUps, directory, detail, dashboardApi, tasksApi, migration] = await Promise.all([
    readFile(new URL("app/dashboard/page.tsx", root), "utf8"),
    readFile(new URL("app/follow-ups/page.tsx", root), "utf8"),
    readFile(new URL("app/components/AgencyDirectory.tsx", root), "utf8"),
    readFile(new URL("app/components/AgencyDetail.tsx", root), "utf8"),
    readFile(new URL("app/api/dashboard/route.ts", root), "utf8"),
    readFile(new URL("app/api/tasks/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0001_tiresome_thing.sql", root), "utf8"),
  ]);
  assert.match(dashboard, /Dashboard/);
  assert.match(followUps, /FollowUpBoard/);
  assert.match(directory, /status comercial/);
  assert.match(directory, /agency-table/);
  assert.match(detail, /Registrar interação/);
  assert.match(detail, /Chamar no WhatsApp/);
  assert.match(detail, /Agendar follow-up/);
  assert.match(dashboardApi, /getCommercialSummary/);
  assert.match(tasksApi, /Tarefa concluída/);
  assert.match(migration, /agency_status_history/);
  assert.match(migration, /tasks/);
});
