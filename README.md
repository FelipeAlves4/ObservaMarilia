# ObservaMarília

Plataforma de participação cidadã e gestão de ocorrências urbanas. A aplicação React usa Supabase para autenticação, dados, regras de acesso, imagens privadas e funções operacionais.

## Principais fluxos

- Cidadãos autenticados criam e acompanham somente os próprios relatos.
- Gestores fazem triagem, encaminham ocorrências e validam conclusões.
- Colaboradores convidados recebem tarefas de sua equipe, iniciam, atualizam e concluem atendimentos.
- O histórico é imutável e o fluxo é: `Nova → Em análise → Programada → Em execução → Aguardando validação → Resolvida`.
- Imagens ficam no bucket privado `occurrence-media`; o cliente usa URL assinada temporária.
- A busca de endereço passa pela Edge Function `geocode-marilia`, que usa cache e limite global para o Nominatim.

## Rodar localmente

Requer Node.js 24+.

```bash
git clone https://github.com/FelipeAlves4/ObservaMarilia.git
cd ObservaMarilia
npm ci
Copy-Item .env.example .env
npm run dev
```

Abra `http://127.0.0.1:5173`. Preencha `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env` com a chave pública do projeto Supabase. Nunca use a service-role key no frontend.

```bash
npm run build
npm test
```

Os testes atuais em `server/` são uma suíte de regressão do backend SQLite legado. O navegador de produção não o chama; use `npm run dev:legacy` somente para comparações locais temporárias.

## Supabase e produção

O projeto está vinculado ao ref `obiwxknvjvicgyrowcfz`. As migrações em `supabase/migrations/` definem o banco, RLS, políticas do Storage e RPCs de fluxo. As funções Edge ficam em `supabase/functions/`.

Consulte [docs/SUPABASE.md](docs/SUPABASE.md) para configurar Auth, primeiro gestor, variáveis da Vercel, redirects e operação segura.

## Estrutura

```text
src/                       frontend React e cliente Supabase
supabase/migrations/        esquema, RLS e funções RPC versionadas
supabase/functions/         Edge Functions de colaboradores e geocodificação
server/                     backend SQLite legado, apenas desenvolvimento/teste
docs/SUPABASE.md            guia operacional da integração
```

## Limites conhecidos

O mapa depende de OpenStreetMap/Leaflet e o geocoder externo Nominatim. O painel de alertas apresenta regras explicáveis, não um modelo de IA. A plataforma permanece um projeto acadêmico, sem vínculo com a Prefeitura de Marília.
