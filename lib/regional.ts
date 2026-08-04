const normalizeCity = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Schematic commercial regionalization for municipalities in the RS bases.
 * It is intentionally broader than official boundaries so both directories
 * can be compared with the same filter vocabulary.
 */
const regionCities: Record<string, string[]> = {
  Metropolitana: [
    "Alvorada", "Arroio dos Ratos", "Barra do Ribeiro", "Brochier", "Butia", "Cachoeirinha", "Canoas",
    "Charqueadas", "Eldorado do Sul", "Esteio", "Gravatai", "Guaiba", "Marata", "Montenegro", "Nova Santa Rita",
    "Porto Alegre", "Sao Jeronimo", "Sertao Santana", "Triunfo", "Viamao",
  ],
  "Vale dos Sinos": [
    "Ararica", "Campo Bom", "Capela de Santana", "Dois Irmaos", "Estancia Velha", "Igrejinha", "Ivoti",
    "Lindolfo Collor", "Morro Reuter", "Nova Hartz", "Novo Hamburgo", "Parobe", "Portao", "Riozinho",
    "Rolante", "Santa Maria do Herval", "Sao Jose do Hortencio", "Sao Leopoldo", "Sapiranga", "Sapucaia do Sul",
    "Taquara",
  ],
  Serra: [
    "Alto Feliz", "Antonio Prado", "Barao", "Bento Goncalves", "Bom Jesus", "Bom Principio", "Cambara do Sul",
    "Canela", "Carlos Barbosa", "Caxias do Sul", "Cotipora", "Criuva", "Farroupilha", "Feliz", "Flores da Cunha",
    "Garibaldi", "Gramado", "Guapore", "Jaquirana", "Nova Araca", "Nova Bassano", "Nova Padua", "Nova Petropolis",
    "Nova Prata", "Parai", "Picada Cafe", "Sao Francisco de Paula", "Sao Jose dos Ausentes", "Sao Marcos",
    "Sao Pedro da Serra", "Sao Vendelino", "Serafina Correa", "Tres Coroas", "Tuiuti", "Tupandi", "Vacaria",
    "Vale Real", "Veranopolis", "Vila Seca",
  ],
  "Litoral Norte": [
    "Arroio do Sal", "Capao da Canoa", "Capivari do Sul", "Cidreira", "Imbe", "Mampituba", "Maquine", "Mostardas",
    "Osorio", "Palmares do Sul", "Santo Antonio da Patrulha", "Tavares", "Terra de Areia", "Torres", "Tramandai",
    "Tres Cachoeiras", "Tres Forquilhas", "Xangri-La",
  ],
  Vales: [
    "Anta Gorda", "Arroio do Meio", "Arroio do Tigre", "Bom Retiro do Sul", "Candelaria", "Dois Lajeados", "Encantado",
    "Estrela", "Ilopolis", "Imigrante", "Lajeado", "Marques de Souza", "Mucum", "Nova Brescia", "Passa Sete",
    "Passo do Sobrado", "Paverama", "Rio Pardinho", "Rio Pardo", "Roca Sales", "Santa Clara do Sul", "Santa Cruz do Sul",
    "Sinimbu", "Sobradinho", "Taquari", "Teutonia", "Venancio Aires", "Vera Cruz", "Vespasiano Correa",
  ],
  Centro: [
    "Agudo", "Cachoeira do Sul", "Cruz Alta", "Dona Francisca", "Faxinal do Soturno", "Mata", "Nova Palma", "Novo Cabrais",
    "Restinga Seca", "Santa Maria", "Sao Joao do Polesine", "Sao Pedro", "Sao Sepe", "Sao Vicente do Sul", "Silveira", "Unistalda",
  ],
  Norte: [
    "Almirante Tamandare do Sul", "Ametista do Sul", "Aratiba", "Barra Funda", "Campos Borges", "Carazinho", "Carlos Gomes",
    "Casca", "Centenario", "Chapada", "Constantina", "Derrubadas", "Erechim", "Espumoso", "Frederico Westphalen", "Gaurama",
    "Getulio Vargas", "Ibiruba", "Irai", "Lagoa dos Tres Cantos", "Lagoa Vermelha", "Lajeado Bonito", "Machadinho", "Marau",
    "Marcelino Ramos", "Muitos Capoes", "Muliterno", "Nao-Me-Toque", "Nonoai", "Nova Alvorada", "Novo Xingu", "Passo Fundo",
    "Planalto", "Rodeio Bonito", "Sananduva", "Sarandi", "Severiano de Almeida", "Soledade", "Tapejara", "Tapera", "Tenente Portela",
    "Tres Arroios", "Trindade do Sul", "Vista Alegre",
  ],
  Noroeste: [
    "Alecrim", "Augusto Pestana", "Catuipe", "Cerro Largo", "Condor", "Crissiumal", "Girua", "Guarani das Missoes", "Ijui",
    "Joia", "Nova Candelaria", "Palmeira das Missoes", "Panambi", "Roque Gonzales", "Santa Rosa", "Santo Angelo", "Santo Augusto",
    "Santo Cristo", "Sao Luiz Gonzaga", "Sao Paulo das Missoes", "Sao Pedro do Butia", "Sede Nova", "Tres de Maio", "Tres Passos", "Tuparendi",
  ],
  "Fronteira Oeste": [
    "Alegrete", "Barra do Quarai", "Itaqui", "Quarai", "Santiago", "Sao Borja", "Uruguaiana",
  ],
  Campanha: [
    "Bage", "Cacapava do Sul", "Dom Pedrito", "Lavras do Sul", "Rosario do Sul", "Santana do Livramento",
  ],
  Sul: [
    "Arambare", "Arroio do Padre", "Camaqua", "Cangucu", "Chui", "Cristal", "Jaguarao", "Morro Redondo", "Pantano Grande",
    "Pelotas", "Piratini", "Rio Grande", "Santa Vitoria do Palmar", "Sao Jose do Norte", "Sao Lourenco do Sul", "Sentinela do Sul",
  ],
};

const cityRegion = new Map<string, string>();
for (const [region, cities] of Object.entries(regionCities)) {
  for (const city of cities) cityRegion.set(normalizeCity(city), region);
}

export const regionalFallback = "Interior";

export function regionForCity(city: string) {
  return cityRegion.get(normalizeCity(city)) ?? regionalFallback;
}

export const regionalOrder = [...Object.keys(regionCities), regionalFallback];
