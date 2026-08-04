import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputDir = resolve(root, "github-pages");
const exchangeSource = await readFile(resolve(root, "lib/seed.ts"), "utf8");
const exchangeModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(exchangeSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText).toString("base64")}`);
const tourism = JSON.parse(await readFile(resolve(root, "lib/turismo-seed.json"), "utf8"));
const verifiedAt = "2026-08-03";

const regionForCity = (city) => {
  const groups = {
    "Metropolitana": ["Porto Alegre", "Canoas", "Viamão", "Gravataí", "Cachoeirinha", "Alvorada", "Guaíba", "Esteio", "Sapucaia do Sul", "São Leopoldo"],
    "Serra": ["Caxias do Sul", "Bento Gonçalves", "Farroupilha", "Flores da Cunha", "Gramado", "Canela", "Nova Petrópolis", "Vacaria", "Cambará do Sul"],
    "Vale dos Sinos": ["Novo Hamburgo", "Campo Bom", "Estância Velha", "Ivoti", "Sapiranga", "Dois Irmãos"],
    "Vales": ["Lajeado", "Santa Cruz do Sul", "Venâncio Aires", "Estrela", "Arroio do Meio", "Rio Pardo"],
    "Centro": ["Santa Maria", "Cachoeira do Sul", "Santiago", "São Gabriel", "Cruz Alta"],
    "Norte": ["Passo Fundo", "Erechim", "Carazinho", "Marau", "Frederico Westphalen", "Palmeira das Missões"],
    "Sul": ["Pelotas", "Rio Grande", "Bagé", "Camaquã", "Jaguarão", "São Lourenço do Sul"],
    "Litoral": ["Capão da Canoa", "Torres", "Tramandaí", "Osório", "Cidreira", "Imbé", "Xangri-lá"],
  };
  return Object.entries(groups).find(([, cities]) => cities.includes(city))?.[0] ?? "Outras regiões";
};

const activeTourism = tourism.filter((item) => item.status === "Regular" && (item.expiresAt ?? "") >= verifiedAt);
const exchange = exchangeModule.seedAgencies.map((item) => ({
  id: `exchange-${item.id}`,
  kind: "exchange",
  name: item.tradeName,
  legalName: item.legalName,
  city: item.city,
  region: item.region,
  address: item.address,
  neighborhood: item.neighborhood,
  cep: item.cep,
  phone: item.phone,
  email: item.email,
  website: item.website,
  instagram: item.instagram,
  sourceUrl: item.sourceUrl,
  sourceLabel: item.sourceLabel,
  publicStatus: "Intercâmbio",
  detail: item.audienceProfile,
  programs: item.programs ?? [],
}));
const tourismRecords = activeTourism.map((item) => ({
  id: `tourism-${item.id}`,
  kind: "tourism",
  name: item.tradeName === "*" ? "Nome não divulgado" : item.tradeName,
  legalName: item.legalName,
  city: item.city,
  region: regionForCity(item.city),
  address: item.address,
  neighborhood: item.neighborhood,
  cep: item.cep,
  phone: item.phone,
  email: null,
  website: item.website,
  sourceUrl: item.sourceUrl,
  sourceLabel: item.sourceLabel,
  publicStatus: item.status,
  detail: `Cadastur ${item.cadasturNumber} · validade ${item.expiresAt}`,
  programs: [],
}));
const records = [...exchange, ...tourismRecords];
const payload = JSON.stringify(records).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mapa de Agências RS · Diretório público</title>
  <meta name="description" content="Diretório público de agências de intercâmbio e turismo do Rio Grande do Sul.">
  <style>
    :root{--ink:#10263f;--blue:#2979a7;--red:#d84b3e;--green:#26735d;--paper:#f5f1e8;--paper2:#ebe5d8;--white:#fffdf8;--line:rgba(16,38,63,.17)}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif}a{color:inherit;text-decoration:none}
    .header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:26px;padding:18px clamp(20px,5vw,72px);background:rgba(245,241,232,.94);border-bottom:1px solid var(--line);backdrop-filter:blur(14px)}
    .brand{display:flex;align-items:center;gap:12px}.mark{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--red);color:#fff;font-size:12px;font-weight:800}.brand strong{display:block;font:700 18px Georgia,serif}.brand small{display:block;margin-top:3px;color:#657687;font-size:9px;letter-spacing:.18em;text-transform:uppercase}.header-links{display:flex;align-items:center;gap:20px;font-size:12px;font-weight:800}.header-links a:last-child{padding:11px 14px;background:var(--ink);color:#fff}
    main{max-width:1400px;margin:auto}.hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:60px;padding:clamp(55px,9vw,110px) clamp(20px,6vw,92px) 70px;border-bottom:1px solid var(--line)}.eyebrow{color:var(--red);font-size:10px;font-weight:800;letter-spacing:.2em;text-transform:uppercase}.hero h1{max-width:800px;margin:22px 0 20px;font:400 clamp(48px,7vw,94px)/.9 Georgia,serif;letter-spacing:-.055em}.hero p{max-width:610px;color:#53697a;font:19px/1.5 Georgia,serif}.stats{align-self:end;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line)}.stat{min-height:132px;padding:20px;background:var(--ink);color:#fff}.stat strong{display:block;font:48px/.9 Georgia,serif}.stat span{display:block;margin-top:12px;color:#b9c5ce;font-size:10px;line-height:1.35;text-transform:uppercase;letter-spacing:.08em}
    .directory{padding:42px clamp(20px,6vw,92px) 90px}.directory-head{display:flex;justify-content:space-between;align-items:end;gap:30px;margin-bottom:20px}.directory-head h2{margin:12px 0 0;font:34px Georgia,serif}.directory-head p{margin:0;color:#66798a;font-size:12px}.tools{display:grid;grid-template-columns:minmax(260px,1fr) 180px 180px 180px;gap:8px;padding:12px;background:var(--white);border:1px solid var(--line)}.tools input,.tools select{min-height:46px;width:100%;padding:0 12px;border:1px solid var(--line);background:var(--paper);color:var(--ink);outline:0}.meta{display:flex;justify-content:space-between;gap:20px;padding:18px 2px;color:#71818c;font-size:10px;letter-spacing:.08em;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{display:flex;min-height:275px;flex-direction:column;padding:18px 18px 0;background:var(--white);border:1px solid var(--line);transition:transform .18s,box-shadow .18s}.card:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(16,38,63,.1)}.card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#71818c;font-size:9px;letter-spacing:.08em;text-transform:uppercase}.kind{padding:6px 8px;border:1px solid;font-weight:800}.kind-exchange{color:var(--red);border-color:rgba(216,75,62,.45);background:rgba(216,75,62,.05)}.kind-tourism{color:var(--green);border-color:rgba(38,115,93,.45);background:rgba(38,115,93,.05)}.card h3{margin:21px 0 7px;font:22px/1.08 Georgia,serif}.legal{min-height:26px;margin:0;color:#6c7a83;font-size:10px;line-height:1.35}.place{margin:15px 0;color:var(--red);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.detail{margin:0 0 16px;color:#53697a;font:13px/1.4 Georgia,serif}.contact{display:grid;gap:6px;margin:0;padding:13px 0;border-top:1px solid var(--line);color:#314b60;font-size:11px}.contact span{overflow-wrap:anywhere}.card-foot{display:flex;justify-content:space-between;gap:12px;margin:auto -18px 0;padding:13px 18px;border-top:1px solid var(--line);color:#71818c;font-size:9px}.card-foot a{color:var(--red);font-weight:800}.empty{padding:70px 20px;text-align:center;background:var(--white);border:1px solid var(--line);color:#71818c}.pages{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:25px}.pages button{padding:10px 14px;border:1px solid var(--line);background:var(--white);font-size:11px;font-weight:800;cursor:pointer}.pages button:disabled{opacity:.4;cursor:default}.pages span{color:#71818c;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.footer{display:flex;justify-content:space-between;gap:30px;padding:30px clamp(20px,6vw,92px);border-top:1px solid var(--line);color:#71818c;font-size:10px}.footer a{color:var(--red);font-weight:800}
    @media(max-width:980px){.hero{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tools{grid-template-columns:1fr 1fr}.tools input{grid-column:1/-1}}
    @media(max-width:620px){.header{align-items:flex-start}.header-links{gap:10px}.header-links a:not(:last-child){display:none}.hero{padding-top:58px}.grid{grid-template-columns:1fr}.tools{grid-template-columns:1fr}.footer{flex-direction:column}}
  </style>
</head>
<body>
  <header class="header"><a class="brand" href="./"><span class="mark">RS</span><span><strong>Mapa de Agências</strong><small>Rio Grande do Sul</small></span></a><nav class="header-links"><a href="#diretorio">Diretório</a><a href="https://mapa-intercambio-rs.baxinski.chatgpt.site/login">Acesso da equipe ↗</a></nav></header>
  <main>
    <section class="hero"><div><span class="eyebrow">Diretório público · dados verificáveis</span><h1>As agências que movem o Rio Grande do Sul.</h1><p>Uma visão aberta de agências de intercâmbio e turismo, com cidade, contato, fonte de consulta e situação cadastral em um só lugar.</p></div><div class="stats"><div class="stat"><strong id="total"></strong><span>registros na base pública</span></div><div class="stat"><strong id="cities"></strong><span>municípios representados</span></div><div class="stat"><strong id="exchange"></strong><span>fichas de intercâmbio</span></div><div class="stat"><strong id="tourism"></strong><span>agências de turismo regulares</span></div></div></section>
    <section class="directory" id="diretorio"><div class="directory-head"><div><span class="eyebrow">Consulta rápida</span><h2>Encontre uma agência</h2></div><p>Base pública consultada em ${verifiedAt.split("-").reverse().join("/")}. Filtros funcionam direto no navegador.</p></div><div class="tools"><input id="search" type="search" placeholder="Buscar por nome, cidade, CNPJ ou telefone" aria-label="Buscar agências"><select id="type" aria-label="Tipo"><option value="all">Todos os tipos</option><option value="exchange">Intercâmbio</option><option value="tourism">Turismo</option></select><select id="city" aria-label="Cidade"><option value="all">Todas as cidades</option></select><select id="region" aria-label="Região"><option value="all">Todas as regiões</option></select></div><div class="meta"><span id="resultMeta"></span><span>Fonte pública em cada ficha</span></div><div id="results" class="grid"></div><div class="pages"><button id="previous">Anterior</button><span id="pageMeta"></span><button id="next">Próxima</button></div></section>
  </main>
  <footer class="footer"><span>Mapa de Agências RS · diretório público independente</span><span><a href="https://github.com/baxinski/baxinski-mapa-agencias-rs">Código no GitHub ↗</a> · <a href="https://mapa-intercambio-rs.baxinski.chatgpt.site">Plataforma comercial ↗</a></span></footer>
  <script>window.__AGENCIES__ = ${payload};</script>
  <script>
    const records = window.__AGENCIES__ || [];
    const pageSize = 24;
    let page = 1;
    const byId = (id) => document.getElementById(id);
    const normalize = (value) => (value || "").toString().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
    const formatPhone = (value) => { if (!value) return ""; const digits = value.replace(/\\D/g, ""); return digits.length >= 10 ? "+55 " + digits : value; };
    const safeUrl = (value) => { if (!value || !/^https?:\\/\\//i.test(value)) return null; return value; };
    const unique = (values) => [...new Set(values.filter(Boolean))].sort((a,b) => a.localeCompare(b, "pt-BR"));
    byId("total").textContent = records.length.toLocaleString("pt-BR");
    byId("cities").textContent = unique(records.map((item) => item.city)).length.toLocaleString("pt-BR");
    byId("exchange").textContent = records.filter((item) => item.kind === "exchange").length.toLocaleString("pt-BR");
    byId("tourism").textContent = records.filter((item) => item.kind === "tourism").length.toLocaleString("pt-BR");
    unique(records.map((item) => item.city)).forEach((city) => byId("city").insertAdjacentHTML("beforeend", '<option value="' + city.replace(/"/g, "&quot;") + '">' + city + "</option>"));
    unique(records.map((item) => item.region)).forEach((region) => byId("region").insertAdjacentHTML("beforeend", '<option value="' + region.replace(/"/g, "&quot;") + '">' + region + "</option>"));
    function filtered() {
      const query = normalize(byId("search").value);
      const type = byId("type").value;
      const city = byId("city").value;
      const region = byId("region").value;
      return records.filter((item) => {
        if (type !== "all" && item.kind !== type) return false;
        if (city !== "all" && item.city !== city) return false;
        if (region !== "all" && item.region !== region) return false;
        if (!query) return true;
        return normalize([item.name, item.legalName, item.city, item.region, item.phone, item.detail, item.cadasturNumber].join(" ")).includes(query);
      });
    }
    function card(item) {
      const link = safeUrl(item.website) || safeUrl(item.sourceUrl);
      const phone = formatPhone(item.phone);
      const contact = [item.address ? "<span>⌖ " + item.address + (item.neighborhood ? " · " + item.neighborhood : "") + "</span>" : "", phone ? "<span>☎ " + phone + "</span>" : "", item.email ? "<span>✉ " + item.email + "</span>" : ""].filter(Boolean).slice(0, 2).join("");
      return '<article class="card"><div class="card-top"><span class="kind kind-' + item.kind + '">' + (item.kind === "exchange" ? "Intercâmbio" : "Turismo") + '</span><span>' + (item.publicStatus || "") + '</span></div><h3>' + (item.name || "Nome não informado") + '</h3><p class="legal">' + (item.legalName || "Registro público") + '</p><div class="place">' + item.city + " · " + item.region + '</div><p class="detail">' + (item.detail || "Dados públicos disponíveis") + '</p><div class="contact">' + (contact || "<span>Contato não divulgado</span>") + '</div><div class="card-foot"><span>' + (item.kind === "tourism" ? "Cadastur regular" : "Ficha verificada") + '</span>' + (link ? '<a href="' + link + '" target="_blank" rel="noreferrer">Abrir fonte ↗</a>' : "<span>Fonte consultada</span>") + '</div></article>';
    }
    function render() {
      const list = filtered();
      const pages = Math.max(1, Math.ceil(list.length / pageSize));
      if (page > pages) page = pages;
      const start = (page - 1) * pageSize;
      const visible = list.slice(start, start + pageSize);
      byId("resultMeta").textContent = list.length ? (start + 1).toLocaleString("pt-BR") + "–" + Math.min(start + pageSize, list.length).toLocaleString("pt-BR") + " de " + list.length.toLocaleString("pt-BR") : "Nenhum registro encontrado";
      byId("pageMeta").textContent = "Página " + page + " de " + pages;
      byId("results").innerHTML = visible.length ? visible.map(card).join("") : '<div class="empty">Ajuste os filtros para encontrar uma agência.</div>';
      byId("previous").disabled = page === 1;
      byId("next").disabled = page === pages;
    }
    ["search", "type", "city", "region"].forEach((id) => byId(id).addEventListener(id === "search" ? "input" : "change", () => { page = 1; render(); }));
    byId("previous").addEventListener("click", () => { page -= 1; render(); window.scrollTo({ top: byId("diretorio").offsetTop - 80, behavior: "smooth" }); });
    byId("next").addEventListener("click", () => { page += 1; render(); window.scrollTo({ top: byId("diretorio").offsetTop - 80, behavior: "smooth" }); });
    render();
  </script>
</body>
</html>`;

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "index.html"), html, "utf8");
await writeFile(resolve(outputDir, "404.html"), html, "utf8");
await writeFile(resolve(outputDir, ".nojekyll"), "", "utf8");
console.log(`GitHub Pages: ${records.length} registros, ${activeTourism.length} turismo regular, ${exchange.length} intercâmbio`);
