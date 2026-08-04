import { getAuthenticatedUserWithRole } from "@/app/auth";
import { listAgencies, saveAgency } from "@/db";
import { commercialStatuses, type Agency, type Potential } from "@/lib/types";

export const dynamic = "force-dynamic";

type ParsedRow = Record<string, string>;
type ImportCandidate = { row: number; agency: Agency; duplicateOf: string | null; errors: string[] };

function key(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function splitList(value: string) {
  return value.split(/[;,|]/).map((item) => clean(item, 100)).filter(Boolean);
}

function slugify(value: string) {
  return key(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90) || "agencia";
}

function parseCsv(input: string): ParsedRow[] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { value += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (!quoted && (character === ";" || character === "," || character === "\t")) { row.push(value); value = ""; continue; }
    if (!quoted && character === "\n") { row.push(value); rows.push(row); row = []; value = ""; continue; }
    value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((item) => key(item));
  return rows.slice(1).filter((items) => items.some((item) => item.trim())).map((items) => headers.reduce<ParsedRow>((record, header, index) => { if (header) record[header] = items[index] ?? ""; return record; }, {}));
}

function field(row: ParsedRow, ...names: string[]) {
  for (const name of names) { const value = row[key(name)]; if (value?.trim()) return clean(value); }
  return "";
}

function digits(value: string) { return value.replace(/\D/g, ""); }

function duplicateOf(agency: Agency, existing: Agency[]) {
  const name = key(agency.tradeName);
  const city = key(agency.city);
  const phone = digits(agency.phone ?? agency.whatsapp ?? "");
  const email = key(agency.email ?? "");
  const website = key(agency.website ?? "");
  return existing.find((item) =>
    (name && city && key(item.tradeName) === name && key(item.city) === city) ||
    (phone.length >= 8 && phone === digits(item.phone ?? item.whatsapp ?? "")) ||
    (email.length > 5 && email === key(item.email ?? "")) ||
    (website.length > 5 && website === key(item.website ?? "")),
  )?.tradeName ?? null;
}

function candidateFromRow(row: ParsedRow, rowNumber: number, existing: Agency[], slugs: Set<string>): ImportCandidate {
  const tradeName = field(row, "nome fantasia", "nome", "agencia", "agência", "empresa");
  const city = field(row, "cidade", "municipio", "município");
  const region = field(row, "regiao", "região") || "Interior";
  const errors = [
    tradeName.length < 2 ? "Nome da agência é obrigatório" : "",
    city.length < 2 ? "Cidade é obrigatória" : "",
  ].filter(Boolean);
  let slug = slugify(`${tradeName}-${city}`);
  let suffix = 2;
  while (slugs.has(slug)) slug = `${slugify(`${tradeName}-${city}`)}-${suffix++}`;
  slugs.add(slug);
  const potentialValue = field(row, "potencial", "potencial comercial").toUpperCase();
  const statusValue = field(row, "status", "status comercial");
  const agency: Agency = {
    id: crypto.randomUUID(), slug, tradeName: tradeName || "Agência sem nome", legalName: field(row, "razao social", "razão social") || null,
    city: city || "Cidade não informada", region, state: field(row, "estado", "uf") || "RS", neighborhood: field(row, "bairro") || null,
    address: field(row, "endereco", "endereço") || null, cep: field(row, "cep") || null, phone: field(row, "telefone", "fone") || null,
    whatsapp: field(row, "whatsapp") || null, email: field(row, "email", "e-mail") || null, website: field(row, "site", "website") || null,
    instagram: field(row, "instagram") || null, linkedin: field(row, "linkedin") || null, facebook: field(row, "facebook") || null,
    directors: null, owners: null, commercialManager: null, exchangeLead: null, programs: splitList(field(row, "programas", "programas oferecidos")),
    destinations: splitList(field(row, "destinos", "destinos comercializados")), exchangeTypes: splitList(field(row, "tipos de intercambio", "tipos de intercâmbio", "tipo de intercambio")),
    belta: null, units: 1, audienceProfile: field(row, "perfil", "perfil de publico", "perfil de público") || "Não classificado",
    commercialPotential: (["A", "B", "C"].includes(potentialValue) ? potentialValue : "C") as Potential,
    commercialStatus: commercialStatuses.includes(statusValue as Agency["commercialStatus"]) ? statusValue as Agency["commercialStatus"] : "Não contatada",
    assignedTo: null, estimatedValue: null, firstContactAt: null, lastContactAt: null, nextFollowUpAt: null, lossReason: null,
    googleRating: null, googleReviewCount: null, isFranchise: null, network: null, description: field(row, "descricao", "descrição") || null,
    hours: null, logoUrl: null, competitors: null, productsOfInterest: null, needs: null, notes: null,
    verificationStatus: "Revisar", sourceUrl: field(row, "fonte", "url da fonte", "source") || null, sourceLabel: "Importação CSV",
    verifiedAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10),
  };
  return { row: rowNumber, agency, duplicateOf: duplicateOf(agency, existing), errors };
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!["admin", "gestor"].includes(user.role)) return Response.json({ error: "Somente administradores e gestores podem importar." }, { status: 403 });
  const body = await request.json() as { csv?: string; confirm?: boolean };
  const csv = String(body.csv ?? "");
  if (!csv.trim() || csv.length > 2_000_000) return Response.json({ error: "Envie um CSV válido de até 2 MB." }, { status: 400 });
  const existing = await listAgencies();
  const slugs = new Set(existing.map((item) => item.slug));
  const candidates: ImportCandidate[] = [];
  const duplicatePool = [...existing];
  for (const [index, row] of parseCsv(csv).entries()) {
    const candidate = candidateFromRow(row, index + 2, duplicatePool, slugs);
    candidates.push(candidate);
    if (!candidate.errors.length && !candidate.duplicateOf) duplicatePool.push(candidate.agency);
  }
  const valid = candidates.filter((item) => !item.errors.length && !item.duplicateOf);
  if (!body.confirm) {
    return Response.json({ total: candidates.length, valid: valid.length, duplicates: candidates.filter((item) => item.duplicateOf).length, invalid: candidates.filter((item) => item.errors.length).length, preview: candidates.slice(0, 100).map(({ agency, ...item }) => ({ ...item, tradeName: agency.tradeName, city: agency.city })) });
  }
  const imported: Agency[] = [];
  for (const item of valid) { const saved = await saveAgency(item.agency); if (saved) imported.push(saved); }
  return Response.json({ imported: imported.length, skippedDuplicates: candidates.filter((item) => item.duplicateOf).length, invalid: candidates.filter((item) => item.errors.length).length, records: imported }, { status: 201 });
}
