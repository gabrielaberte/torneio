# Status da implementação

| Etapa | Status |
|---|---|
| 1 — Auditoria do código atual | Concluída |
| 2 — Modelo de dados | Concluída |
| 3 — Importação e validação de Excel | Concluída |
| 4 — Persistência da importação | Concluída |
| 5 — Backups e publicação | Não iniciada |
| 6 — Cadastro manual | Não iniciada |
| 7 — Testes de persistência, sincronização e uso offline | Não iniciada |
| 8 — Cards públicos de scouting | Não iniciada |

## Registro por etapa

### Etapa 1 — Auditoria do código atual

- Status: Concluída (auditoria estática)
- Decisões: Nenhuma implementação proposta nesta etapa. Achados e dúvidas registrados em etapa-01-auditoria.md.
- Alterações realizadas: Apenas este registro de status e o relatório de auditoria.
- Testes executados e resultados: Inspeção estática dos fluxos e configurações; sem teste runtime, rede ou offline.
- Pendências: Confirmar registro e precache do service worker no build; validar reload offline, sincronização concorrente e comportamento real dos serviços na etapa 7.
- Arquivos envolvidos: Ver lista em etapa-01-auditoria.md.

### Etapa 2 — Modelo de dados

- Status: Concluída (especificação documental)
- Decisões: Modelo aditivo no roster oficial; dados de inscrição/time/pote/capitão são da edição corrente; prêmios e pódios são contagens históricas. id existente permanece a identidade técnica local; nome não é chave. Ausente/null distingue-se de zero.
- Alterações realizadas: Especificação, compatibilidade, migração gradual, regras de merge e casos conceituais em etapa-02-modelo-dados.md.
- Testes executados e resultados: Revisão estática e validação conceitual dos casos descritos; sem teste de aplicação.
- Pendências: Definir associação de atletas entre torneios, granularidade temporal do histórico e revisão de duplicatas aproximadas antes da implementação.
- Arquivos envolvidos: src/lib/storage.js, src/hooks/useTournament.js, src/lib/constants.js (referências auditadas; não modificados), e etapa-02-modelo-dados.md.

### Etapa 3 — Importação e validação de Excel

- Status: Concluída (leitura, validação e prévia)
- Decisões: Formatos .xlsx/.xls; primeira aba; os 13 cabeçalhos previstos são obrigatórios; gêneros aceitam M/F ou rótulos Masculino/Feminino; duplicidade por nome é apenas alerta até resolução na etapa 4.
- Alterações realizadas: Leitor/validador em src/lib/playerImport.js; prévia em src/components/admin/Cadastro.jsx; dependência xlsx; detalhes em etapa-03-importacao-validacao.md.
- Testes executados e resultados: Build de produção concluído durante a etapa 3.
- Pendências: Cenários de planilha não foram executados manualmente.
- Arquivos envolvidos: src/lib/playerImport.js, src/components/admin/Cadastro.jsx, package.json, package-lock.json e docs/etapa-03-importacao-validacao.md.

### Etapa 4 — Persistência da importação

- Status: Concluída (integração ao estado oficial)
- Decisões: Importação usa state.roster; duplicatas exigem escolha por linha e múltiplas linhas selecionadas com o mesmo nome bloqueiam a transação. Merge por ID mantém team/playerStats e combina apenas campos históricos presentes; vazio não limpa. Nenhum snapshot público é acionado.
- Alterações realizadas: Ação transacional applyPlayerImport no hook, escolhas/confirmar/resumo na prévia, regras detalhadas em etapa-04-persistencia.md.
- Testes executados e resultados: npm run build concluído. Testes automatizados e cenários manuais não foram executados.
- Pendências: Verificar casos de merge, duplicatas e cancelamento manualmente ou com testes dedicados.
- Arquivos envolvidos: src/hooks/useTournament.js, src/components/admin/Cadastro.jsx, src/lib/playerImport.js e docs/etapa-04-persistencia.md.

## Registro por etapa futura

Copie esta seção para cada etapa iniciada:

### Etapa [n] — [nome]

- Status: Não iniciada
- Decisões:
- Alterações realizadas:
- Testes executados e resultados:
- Pendências e dúvidas:
- Arquivos envolvidos:
