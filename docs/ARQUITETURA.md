# Arquitetura e decisões

## Uma base simples para evoluir

O repositório estava vazio. A primeira etapa usa React + TypeScript + Vite, CSS com os tokens do Figma e uma API HTTP em Node 24. O SQLite reduz a configuração necessária para a apresentação e guarda os dados em disco.

Os componentes de layout, filtros, badges, cartões, gráficos e mapa são compartilhados entre telas. `App.tsx` compõe as rotas; `data.tsx` centraliza a consulta e atualização após escrita. Os recursos visuais e a fonte Inter são locais e não dependem de URLs temporárias do Figma.

Rotas da interface usam hash (`#/gestor`, `#/relatar` etc.), permitindo recarregar sem regras extras de reescrita no servidor.

## API

| Método | Rota | Comportamento |
|---|---|---|
| GET | `/api/health` | Saúde e modo demo |
| GET | `/api/options` | Categorias, regiões, equipes e etapas |
| GET | `/api/occurrences` | Registros sem o conteúdo das fotos |
| GET | `/api/occurrences?mine=1` | Relatos do perfil compartilhado `cidadao-demo` |
| POST | `/api/occurrences` | Valida, gera protocolo, salva e registra triagem |
| GET | `/api/occurrences/:id` | Dados completos, foto e histórico |
| PATCH | `/api/occurrences/:id` | Compatibilidade para avanço gerencial permitido |
| GET/POST/PATCH | `/api/collaborators` | Consulta, cadastro e ativação de colaboradores (gestor) |
| POST | `/api/occurrences/:id/assign` | Atribui equipe e colaborador(es) ativos (gestor) |
| GET | `/api/collaborator/tasks` | Lista tarefas atribuídas ao colaborador atual |
| POST | `/api/occurrences/:id/start`, `/progress`, `/conclude` | Execução, andamento e conclusão (colaborador atribuído) |
| POST | `/api/occurrences/:id/validate` | Aprova ou devolve conclusão (gestor) |

O cadastro exige `title`, `category`, `region`, `address`, `neighborhood` e `description`. `photo` aceita `null` ou uma data URL JPG/PNG de até 2 MB. A atualização exige `status`, `team` e `note`.

Validação também ocorre no servidor: limites dos textos, enums, conteúdo inicial do arquivo, tamanho do envio, transições e origem das requisições do navegador. Essas medidas não substituem autenticação e autorização.

## Dados

| Tabela | Campos principais |
|---|---|
| `occurrences` | ID, protocolo único, perfil demo, título, categoria, região, endereço, bairro, descrição, foto, prioridade, status, equipe, regra da triagem, abertura e conclusão |
| `collaborators` | Dados do colaborador, equipe, função e situação ativo/inativo |
| `assignments` | Vínculo entre ocorrência e responsáveis, com gestor e data da atribuição |
| `execution_updates` | Andamentos, conclusão, progresso e evidência opcional |
| `history` | Evento imutável, transições, responsável, perfil, observação e referência de anexo |

Uma ocorrência tem vários eventos. As escritas do relato e histórico ocorrem em uma transação. Consultas usam parâmetros SQL. Índices ajudam a agrupar região/categoria e consultar o histórico. O banco habilita foreign keys e WAL.

## Regras demonstrativas

Prioridade alta: descrição contém termos de risco, como acidente, queda, escola, pedestre ou fio. Sem esses termos, a categoria Outros sugere prioridade baixa; as demais sugerem média. Trata-se de heurística acadêmica, sujeita a falsos positivos e negativos.

Os alertas agrupam chamados não resolvidos da mesma categoria/região no período escolhido. Pelo menos 3 registros geram atenção; pelo menos 6 geram um sinal crítico. São critérios explicáveis e editáveis, sem previsão, inferência por modelo, detecção de imagem ou confiança estatística.

Os indicadores usam os registros do período. Taxa de solução = resolvidos / total. Tempo médio = média entre abertura e conclusão dos relatos resolvidos. Não há SLA, satisfação ou tendência histórica inventados. O gráfico diário mostra o volume criado nos últimos 7 dias.

## Limitações e evolução

O ambiente usa identidades demonstrativas enviadas no cabeçalho `X-Demo-Actor`, que o servidor valida contra os papéis cadastrados para permitir testar autorização e segregação de tarefas. Não é autenticação de produção: deve ser substituído por sessão assinada/OIDC antes de exposição pública.

Para evoluir: adicionar tabela de usuários, autenticação e controle por papel; substituir o perfil fixo pelo usuário autenticado; atribuir equipes por entidade; registrar coordenadas e integrar um mapa; definir prazos e evidência de conclusão; migrar para PostgreSQL se necessário; integrar IA após escolher e validar o objetivo do modelo.
