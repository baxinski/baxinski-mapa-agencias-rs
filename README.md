# Mapa de Agências RS

Diretório comercial profissional para mapear agências de intercâmbio e turismo no Rio Grande do Sul.

## O que está incluído

- página inicial editorial e responsiva;
- listagem pesquisável com filtros por cidade, perfil e potencial A/B/C;
- diretório `/turismo` com todas as agências de turismo em situação regular no RS;
- visão regional esquemática;
- fichas individuais com contatos, programas, decisores, perfil e fonte pública;
- painel administrativo para cadastrar e editar agências;
- histórico persistente de contatos e próximos passos;
- banco de dados D1, pronto para hospedagem no Sites;
- 17 fichas iniciais de intercâmbio verificadas em fontes públicas em 03/08/2026;
- 2.813 registros de agências de turismo extraídos da consulta pública do Cadastur em 03/08/2026.

## Integridade dos dados

Cada ficha inicial informa a fonte e a data de verificação. Campos sem confirmação pública ficam vazios. A classificação de potencial A/B/C é uma avaliação editorial inicial para prospecção e deve ser revisada pela equipe comercial.

A área `/turismo` usa um snapshot do Cadastur filtrado por `situação = Regular` e certificado com validade igual ou posterior a 03/08/2026. A fonte de consulta é o [Cadastur — Ministério do Turismo](https://cadastur.turismo.gov.br/hotsite/#!/public/sou-turista/inicio); a base aberta de referência é o conjunto [Prestadores de serviços turísticos — Agência de Turismo](https://dados.turismo.gov.br/pt_BR/dataset/agencia-de-turismo/resource/d2bf25f0-af31-4e08-9b8f-49b3e52e25f7).

## Execução local

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run dev
```

O banco local é inicializado automaticamente no primeiro acesso à API. Para criar uma versão de produção:

```bash
npm run build
```

## Estrutura principal

- `app/`: páginas, componentes e rotas de API;
- `db/`: esquema e acesso ao banco;
- `drizzle/`: migração SQL;
- `lib/seed.ts`: base pública inicial de intercâmbio e fontes;
- `lib/turismo-seed.json`: snapshot dos registros regulares de agências de turismo;
- `scripts/build-github-pages.mjs`: gera o diretório público estático para GitHub Pages;
- `.github/workflows/pages.yml`: publica automaticamente o diretório a cada push em `main`;
- `.openai/hosting.json`: configuração de persistência para Sites.

O painel administrativo deve permanecer em um ambiente privado ou receber autenticação adicional antes de uma publicação aberta.

## CRM comercial — primeira entrega

O projeto agora inclui um workspace interno para a operação comercial, preservando as rotas públicas existentes:

- `/dashboard`: indicadores reais de funil, contatos, cidades, regiões, oportunidades prioritárias e follow-ups;
- `/follow-ups`: tarefas atrasadas, de hoje e futuras, com conclusão que registra automaticamente uma interação;
- `/agencias`: filtros combináveis por cidade, perfil, potencial e status, com visualização em cartões ou tabela;
- `/agencias/[slug]`: ficha detalhada, ações de contato, status, score, dados públicos, histórico e agenda;
- `/api/dashboard`, `/api/tasks` e `/api/status-history`: APIs do workspace;
- `/api/agencies` e `/api/contacts`: mutações protegidas pela autenticação do Sites/ChatGPT.

### Dados e migração

As colunas de CRM e descoberta (status, responsável, score, valor estimado, contatos, follow-ups, Google, destinos, coordenadas e campos de relacionamento) são adicionadas de forma compatível com a base existente. O bootstrap do D1 também verifica colunas ausentes antes de utilizá-las; as migrações versionadas correspondentes estão em `drizzle/0001_tiresome_thing.sql` e `drizzle/0002_mature_hydra.sql`.

O score de oportunidade é recalculado a cada alteração da ficha. Os pesos iniciais estão documentados em `lib/scoring.ts`; a personalização dos pesos e perfis de usuário fica para a próxima etapa.

### Segurança e escopo

As operações de criação e edição, registro de contato, alteração de status e tarefas exigem o usuário autenticado pelo Sites. A publicação atual é privada para o proprietário. A captação pública de leads, templates, exportação CSV e permissões granulares já estão ativas; cobrança e importação de planilhas permanecem pontos de integração para a próxima fase.

## GitHub, página pública e login

O projeto também contém:

- `/login`: página de entrada com GitHub OAuth;
- `/api/auth/github`, `/api/auth/github/callback`, `/api/auth/session` e `/api/auth/logout`;
- sessão persistente no D1, sem expor o token do GitHub ao navegador;
- página estática pública gerada a partir das bases atuais e publicada por GitHub Actions + GitHub Pages.

Para ativar o login no ambiente hospedado, crie uma OAuth App no GitHub com callback em `https://mapa-intercambio-rs.baxinski.chatgpt.site/api/auth/github/callback` e configure `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` como variáveis secretas do Sites.

O workflow de Pages não substitui a aplicação principal: ele publica uma visão pública, estática e pesquisável do diretório. O painel e o D1 continuam na plataforma principal.

## Plataforma comercial — restante da entrega

Além do diretório público, a aplicação agora inclui:

- `/encontrar-agencia`: formulário público de captação de leads, com consentimento, preferências de intercâmbio e indicação de agências compatíveis;
- `/leads`: fila interna para acompanhar e distribuir solicitações recebidas;
- `/modelos`: biblioteca de modelos de WhatsApp e e-mail com variáveis de agência, cidade, vendedor e reunião;
- `/relatorios`: visão exportável do funil, cobertura regional, cidades, leads e eventos de uso;
- `/usuarios`: gestão de perfis `admin`, `gestor`, `vendedor` e `consulta`;
- `/importar`: validação e importação CSV com detecção de duplicidades, sem sobrescrever fichas existentes;
- `/planos`: catálogo técnico de planos, perfis verificados e distribuição futura de leads, sem cobrança ativa;
- exportação CSV na listagem de intercâmbio e paginação server-side na base de turismo;
- API de eventos (`/api/analytics`) para visualizações, filtros, contatos, leads e conversões;
- APIs de leads, modelos, relatórios e usuários protegidas por sessão e papel de acesso.

As tabelas adicionais (`leads`, `message_templates`, `user_roles` e `analytics_events`) são criadas automaticamente no primeiro acesso ao banco. A variável pública `ADMIN_GITHUB_LOGINS` deve conter os logins GitHub administradores separados por vírgula; no ambiente principal, o login `baxinski` é o administrador inicial.

O checkout e a monetização permanecem como pontos de integração: a estrutura de dados suporta ofertas e cobrança, mas nenhum pagamento é processado sem uma conta de provedor configurada.
