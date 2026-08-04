import { activeTourismAgencies, tourismSource } from "@/lib/tourism";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().toLocaleLowerCase("pt-BR");
  const city = (params.get("city") ?? "").trim();
  const onlyWebsite = params.get("website") === "1";
  const onlyPhone = params.get("phone") === "1";

  const records = activeTourismAgencies.filter((agency) => {
    const haystack = [
      agency.tradeName,
      agency.legalName ?? "",
      agency.cadasturNumber,
      agency.city,
      agency.address ?? "",
      agency.neighborhood ?? "",
      agency.phone ?? "",
    ].join(" ").toLocaleLowerCase("pt-BR");

    return (!query || haystack.includes(query)) &&
      (!city || agency.city === city) &&
      (!onlyWebsite || Boolean(agency.website)) &&
      (!onlyPhone || Boolean(agency.phone));
  }).sort((a, b) => a.tradeName.localeCompare(b.tradeName, "pt-BR"));

  return Response.json({
    records,
    total: records.length,
    source: tourismSource,
    cities: [...new Set(activeTourismAgencies.map((agency) => agency.city))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  });
}
