# ObservaMarília

Protótipo funcional de uma plataforma de participação cidadã e gestão de ocorrências urbanas, criado para apresentação acadêmica da P2.

Interface baseada nas telas do [projeto no Figma](https://www.figma.com/design/evk6tyBKyRvdws8SbaHMxh/Cidade-Inteligente---Fabrica-de-Projetos-Ageis?node-id=0-1).

## Executar no computador

Instale **Node.js 24 ou superior**. O banco usa o módulo SQLite incluído no Node 24. Não é necessário instalar um servidor de banco.

```bash
git clone https://github.com/FelipeAlves4/ObservaMarilia.git
cd ObservaMarilia
git checkout feat/mvp-p2
npm ci
npm run dev
```

Abra **http://127.0.0.1:5173**. A API inicia junto, na porta 3001. Para encerrar, use `Ctrl+C`.

Depois que o pull request for integrado, também será possível executar pela branch `main`.

Para executar a versão compilada:

```bash
npm run build
npm start
```

Abra **http://127.0.0.1:3001**. Neste modo, a API serve também a interface compilada.

## O que já funciona

- Página pública e área do cidadão
- Cadastro de ocorrência com título, categoria, endereço, bairro, região, descrição e foto opcional (JPG/PNG até 2 MB)
- Protocolo único, triagem demonstrativa e confirmação de envio
- Meus relatos e detalhes com histórico de atendimento
- Painel do gestor com indicadores calculados a partir do banco
- Fila de ocorrências com busca e filtros por categoria, região, prioridade e status
- Encaminhamento para equipe com justificativa e avanço sequencial de etapa
- Kanban operacional com cartões que abrem o atendimento
- Mapa esquemático com agrupamento por região, zoom, seleção e camada de calor ilustrativa
- Alertas de concentração por regras explicáveis
- Indicadores públicos, distribuição por categoria, desempenho por região e registros por dia
- Exportação CSV dos registros filtrados
- Layout responsivo, fontes e assets oficiais do Figma servidos localmente

## Fluxo de atendimento

`Nova → Em análise → Programada → Em execução → Resolvida`

O relato enviado pelo cidadão já entra em **Em análise**, após a triagem demonstrativa. A API exige uma equipe válida e uma justificativa para avançar. Cada alteração gera um novo evento no histórico. Não é possível pular etapas ou alterar um atendimento concluído nesta versão.

## Demonstração para a P2

Consulte [docs/ROTEIRO_P2.md](docs/ROTEIRO_P2.md). O projeto inicia com **24 ocorrências fictícias**, sendo **3** do perfil compartilhado do cidadão demo.

Os dados persistem em `data/observamarilia.sqlite`, ignorado pelo Git. Reiniciar a aplicação preserva relatos, fotos e histórico. Para reiniciar completamente uma demonstração, pare a aplicação e remova a pasta local `data`; a próxima execução recria a base inicial. Isso apaga somente os dados locais desse protótipo.

## Stack e estrutura

| Parte | Tecnologia |
|---|---|
| Interface | React 19, TypeScript, Vite e CSS |
| API | Node.js 24, HTTP nativo |
| Persistência | SQLite com `node:sqlite` |
| Testes | `node:test`, integração HTTP e SQLite |
| CI | GitHub Actions: compilação e testes |

```text
src/components/   componentes, layouts, gráficos e mapa
src/pages/        telas de cidadão e gestor
src/api.ts        cliente HTTP
src/data.tsx      carregamento e atualização dos dados
server/           API, regras, persistência e testes
public/assets/    exports oficiais do Figma
docs/             roteiro, arquitetura e escopo
```

## Verificação

```bash
npm run check
```

Executa TypeScript, build da interface e testes da API. Os testes usam bases isoladas e não alteram a demonstração.

## Limites desta primeira etapa

Este é um **protótipo acadêmico**, sem vínculo com a Prefeitura de Marília. Os perfis cidadão e gestor são acessos demonstrativos **sem autenticação nem isolamento de usuários**; não devem receber dados pessoais ou reais.

O painel com o título do Figma “Alertas da IA” usa **regras**, sem modelo de inteligência artificial. Não exibe precisão ou confiança fictícias. O mapa usa posições ilustrativas por região, sem coordenadas reais, geolocalização, cálculo de distância ou serviços cartográficos. Os indicadores são calculados pelo banco da demonstração, sem alegar representar dados oficiais da cidade.

A API escuta apenas em localhost por padrão. Não exponha esta versão como um sistema real. Para uma demonstração em rede isolada, as variáveis `HOST=0.0.0.0` e `ALLOW_PUBLIC_DEMO=true` liberam a interface de rede explicitamente, ainda sem autenticação. O SQLite precisa de disco persistente; hospedar somente a pasta `dist` não disponibiliza a API.

Próximas etapas: login e autorização por perfil, usuários individuais, coordenadas e mapa real, notificações, prazos operacionais e integração de IA validada.
