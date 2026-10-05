# Roteiro de apresentação — P2

## Antes de apresentar

1. Use Node 24 e execute `npm ci` e `npm run dev`.
2. Abra `http://127.0.0.1:5173`.
3. Rode `npm run check` em outro terminal.
4. Use dados fictícios. Se desejar anexar uma imagem, separe um JPG/PNG de até 2 MB.

## Apresentação prática (5 a 8 minutos)

| Momento | Ação | O que explicar |
|---|---|---|
| Problema | Mostre a página pública | A população precisa de um canal para registrar problemas e acompanhar a resposta. O gestor precisa organizar os atendimentos. |
| Registro | Clique em “Reportar problema” | Preencha “Buraco próximo à escola”, Pavimentação, endereço e bairro fictícios, Zona Norte e uma descrição com risco aos pedestres. Anexe uma foto se desejar. |
| Protocolo | Envie o formulário | Mostre o protocolo único e a prioridade sugerida. A triagem atual é por regras e exige validação humana. |
| Acompanhamento | Abra “Acompanhar ocorrência” | Mostre os dados salvos e os primeiros eventos do histórico. |
| Gestão | Abra o acesso de gestor pelo rodapé ou `#/gestor` | Mostre o painel e a fila. Busque o protocolo que acabou de gerar. |
| Encaminhamento | Abra “Detalhes”, selecione “Equipe Norte 02” e escreva uma justificativa | Clique “Enviar equipe”. A ocorrência passa para Programada e a alteração fica registrada. |
| Operação | Abra “Equipes” | O cartão aparece na coluna Programada. Abra o cartão, registre o início e clique “Avançar etapa”. |
| Conclusão | Registre a solução nos detalhes | Clique “Concluir ocorrência”. Confira o histórico e a conclusão. |
| Transparência | Volte a Meus relatos e aos indicadores | O cidadão acompanha o novo status; os gráficos e a taxa de solução refletem o banco. |
| Persistência | Recarregue a página | O protocolo e o atendimento permanecem salvos no SQLite. |

## Explicação técnica curta

“O React apresenta as telas e envia requisições à API. O Node valida os dados e o fluxo. O SQLite guarda o relato e cada evento do histórico. Assim, a interface do cidadão e o painel do gestor consultam a mesma fonte de dados.”

## Delimitação do escopo

- Implementado: registro, protocolo, foto, filtros, acompanhamento, atribuição de equipe, etapas, histórico, indicadores e CSV.
- Demonstrativo: acesso por perfil, mapa esquemático, triagem e agrupamento por regras.
- Próxima etapa: autenticação real, usuários isolados, mapa com coordenadas, notificações e IA integrada.

Não apresente a triagem por regras como um modelo treinado, nem os dados fictícios como indicadores oficiais de Marília.
