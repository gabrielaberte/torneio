# Status da implementação

| Etapa | Status |
|---|---|
| 1 — Auditoria do código atual | Concluída |
| 2 — Modelo de dados | Concluída |
| 3 — Importação e validação de Excel | Concluída |
| 4 — Persistência da importação | Concluída |
| 5 — Backups e publicação | Implementação concluída (variáveis de ambiente necessárias no deploy) |
| 6 — Cadastro manual | Não iniciada |
| 7 — Testes de persistência, sincronização e uso offline | Não iniciada |
| 8 — Cards públicos de scouting | Não iniciada |

## Registro por etapa

### Etapa 1 — Auditoria do código atual

- Status: Concluída (auditoria estática)
- Decisões: Achados e dúvidas registrados em etapa-01-auditoria.md.
- Alterações realizadas: Relatório documental.
- Testes executados e resultados: Inspeção estática; sem teste runtime ou offline.
- Pendências: Validar service worker, reload offline, sync concorrente e serviços na etapa 7.
- Arquivos envolvidos: Ver etapa-01-auditoria.md.

### Etapa 2 — Modelo de dados

- Status: Concluída (especificação documental)
- Decisões: Modelo aditivo no roster; dados de edição corrente separados do histórico; id existente preservado; ausência distinta de zero.
- Alterações realizadas: Especificação em etapa-02-modelo-dados.md.
- Testes executados e resultados: Revisão estática/conceitual.
- Pendências: Associação entre torneios, histórico datado e revisão de duplicatas.
- Arquivos envolvidos: Referências de modelo em storage.js, useTournament.js e constants.js; não modificados nesta etapa.

### Etapa 3 — Importação e validação de Excel

- Status: Concluída (leitura, validação e prévia)
- Decisões: .xlsx/.xls, primeira aba, 13 cabeçalhos previstos, duplicidade sinalizada.
- Alterações realizadas: Parser, interface de prévia e dependência xlsx; detalhes em etapa-03-importacao-validacao.md.
- Testes executados e resultados: Build passou; sem cenários manuais/automatizados.
- Pendências: Exercitar planilhas reais.
- Arquivos envolvidos: playerImport.js, Cadastro.jsx, package.json, package-lock.json.

### Etapa 4 — Persistência da importação

- Status: Concluída (integração ao estado oficial)
- Decisões: merge explícito por ID, campos vazios preservados, IDs/times/estatísticas existentes mantidos.
- Alterações realizadas: applyPlayerImport e confirmação/resumo; detalhes em etapa-04-persistencia.md.
- Testes executados e resultados: Build passou; sem cenários manuais/automatizados.
- Pendências: Validar merges, conflitos e cancelamento manualmente.
- Arquivos envolvidos: useTournament.js, Cadastro.jsx, playerImport.js.

### Etapa 5 — Backups e publicação

- Status: Implementação concluída; implantação depende das variáveis de ambiente server-side.
- Decisões: Backup e sync preservam o estado integral; snapshot público usa allowlist; Master Key apenas na Function; sessão administrativa assinada em cookie HttpOnly.
- Alterações realizadas: normalização compatível, projeção pública, Functions `/api/admin-auth` e `/api/jsonbin`, interface de login/logout e remoção da credencial antiga do localStorage. Detalhes em etapa-05-backup-publicacao.md.
- Verificação: `npm run build` passou; sem chamadas reais à Vercel/JSONBin ou round-trip de backup.
- Pendências: Configurar `JSONBIN_MASTER_KEY`, `VOLEI_ADMIN_PASSWORD` e `VOLEI_SESSION_SECRET` na Vercel; validar as Functions e fluxos com sessão na etapa 7.
- Arquivos envolvidos: src/lib/storage.js, src/lib/cloud.js, src/hooks/useTournament.js, src/components/EventPicker.jsx, src/components/admin/Historico.jsx, src/App.jsx, api/admin-auth.js, api/jsonbin.js, server/adminAuth.js e docs/etapa-05-backup-publicacao.md.
## Registro por etapa futura

Copie esta seção para cada etapa iniciada:

### Etapa [n] — [nome]

- Status: Não iniciada
- Decisões:
- Alterações realizadas:
- Testes executados e resultados:
- Pendências e dúvidas:
- Arquivos envolvidos:

