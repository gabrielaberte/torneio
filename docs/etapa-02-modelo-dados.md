# Etapa 2 — Modelo de dados

## Objetivo

Especificar uma extensão compatível do estado atual para dados de scouting, separando informações da edição corrente do histórico acumulado do atleta.

## Contexto observado

O estado oficial de cada torneio é o objeto guardado em localStorage sob volei_state_<id>, exportado em backup como { eventName, state } e enviado integralmente ao bin privado de sincronização. O roster atual é state.roster; cada atleta tem id, name, team, gender e registrationValid. Estatísticas atuais por atleta ficam separadamente em state.playerStats[id].

IDs são gerados por uid() e usados como chaves em estatísticas e partidas. O importador de torneio remoto grava o estado recebido e não faz migração/validação detalhada. A restauração manual substitui o estado atual inteiro. Essas formas existentes precisam continuar legíveis.

## Proposta de representação

Manter state.roster e state.playerStats como fonte oficial. Não criar coleção ou armazenamento separado. Acrescentar campos ao objeto existente do atleta:

    {
      id: "id-existente",
      name: "Nome",
      gender: "M",
      registrationValid: true,
      team: "Time da edição",
      pot: 2,
      isCaptain: false,
      scoutingHistory: {
        awards: {
          mvp: 1, bestServer: 0, bestDefense: null,
          bestAttack: null, topScorer: null, bestBlocker: null
        },
        podiums: { first: 1, second: 0, third: null }
      }
    }

Este é um esquema ilustrativo, não uma migração. scoutingHistory representa totais acumulados da carreira, não resultados da edição corrente. As sete chaves de contagem correspondem às colunas da planilha. Chaves camelCase são nomes internos propostos; a interface poderá rotular em português. Se futuramente for necessário consultar temporadas individualmente, será necessária decisão de produto sobre registro por edição; esta etapa não inventa esse detalhe.

### Separação de escopo

- Edição corrente: registrationValid, team, pot e isCaptain. Descrevem inscrição/organização daquele torneio.
- Histórico do atleta: scoutingHistory.awards e scoutingHistory.podiums. Os totais são independentes do estado de uma partida e não devem ser inferidos de playerStats ou history.
- Estatísticas já existentes: manter state.playerStats[id], matchStats, history, standings e demais propriedades onde estão. São métricas/resultados do torneio atual e não substituem prêmios históricos.

## Identidade e duplicatas

1. id existente é a chave técnica. Nunca recriar ID ao editar ou reconciliar atleta reconhecido; ele relaciona playerStats, seleção de time e outros registros.
2. Não usar nome como identificador persistente. Nomes podem mudar ou se repetir.
3. O sistema atual não possui identificador global de pessoa separado do ID local do roster. Nesta proposta, id permanece estável dentro dos dados/backup do torneio. Reutilização automática entre torneios requer identificador global e fluxo de associação, sem presumir migração automática.
4. Comparação normalizada de nome pode gerar alerta de possível duplicata na importação, nunca provar identidade. Resolver conflito explicitamente.

## Regras de valores e ausência

- gender: manter códigos atuais M/F; valores vazios/desconhecidos não devem ser convertidos sem decisão.
- registrationValid: booleano para novos/confirmados. Em dados legados, a regra vigente considera válido qualquer valor diferente de false; leitura compatível deve manter essa semântica até conversão deliberada.
- pot: inteiro 0–4; null ou ausência significa não informado. Zero é valor informado.
- isCaptain: booleano. Campo ausente em estado antigo equivale a condição não marcada na edição; não deduzir capitão por nome, posição ou estatística.
- Cada contagem em scoutingHistory: inteiro não negativo ou null. null/ausência significa histórico não informado; 0 significa histórico conhecido sem ocorrências. Não converter vazio em zero.
- Gênero, inscrição e valores de pote devem ser validados conforme contrato da importação/formulário. Esta etapa registra modelo, não implementa validação.

## Migração e compatibilidade gradual

1. Tratar campos de scouting como opcionais na leitura. Estado antigo sem esses campos continua válido; interface futura deve exibir ausência discretamente.
2. Ao salvar dados legados, preservar campos desconhecidos e existentes. Não reconstruir cada atleta com lista fechada de propriedades que descarte extensões.
3. Não reescrever todo localStorage ao abrir estado antigo. Normalização pode ocorrer na camada de leitura/uso ou quando houver alteração explícita; escolher e testar essa política na implementação.
4. Se for útil adicionar schemaVersion ao estado, torná-lo opcional e aditivo. Ausência significa formato legado. Não remover ou reinterpretar dados sem migração definida.
5. Backups antigos { eventName, state } e registros privados antigos permanecem aceitos. Campos inexistentes continuam ausentes; defaults não podem apagar campos ao restaurar ou sincronizar.
6. Novos campos no roster acompanham automaticamente backup completo e bin privado quando o estado inteiro é serializado. A publicação pública usa projeção própria em cloud.js; inclusão seletiva será decidida e verificada na etapa 5.

## Regras de merge para importação futura

- Atualização de atleta reconhecido mantém id, team salvo mudança explicitamente confirmada, estatísticas atuais em playerStats e campos desconhecidos.
- Campos correntes preenchidos na importação podem atualizar correspondentes segundo confirmação do usuário.
- Célula vazia não instrui limpar: mantém valor existente, inclusive histórico e pote. Remoção explícita deve ser uma ação separada.
- Contagem histórica fornecida atualiza/substitui aquela contagem após confirmação; não somar automaticamente, pois a planilha pode ser um retrato total e somar pode duplicar.
- Novo atleta recebe ID novo; possível correspondência por nome é apresentada para revisão e não reutiliza ID automaticamente.
- Conflitos/ambiguidades são resolvidos explicitamente; nunca mesclar silenciosamente.

## Exemplos de compatibilidade

### Atleta legado

    { "id": "p123", "name": "Ana", "gender": "F", "registrationValid": true, "team": "Azul" }

Continua legível. pot e isCaptain não informados não causam erro. Histórico fica desconhecido, não igual a zero.

### Novo atleta com histórico conhecido

    {
      "id": "p456", "name": "Bia", "gender": "F",
      "registrationValid": true, "team": "", "pot": 0, "isCaptain": false,
      "scoutingHistory": {
        "awards": {
          "mvp": 0, "bestServer": 2, "bestDefense": null,
          "bestAttack": null, "topScorer": 1, "bestBlocker": null
        },
        "podiums": { "first": 1, "second": 0, "third": 0 }
      }
    }

O pote zero é informado; prêmios zerados são conhecidos como zero; null permanece histórico não informado.

## Critérios de aceitação

- Modelo mantém roster, IDs e estatísticas do sistema como fonte oficial.
- Campos correntes e históricos estão diferenciados.
- Está definido como representar zero, desconhecido e ausência.
- Migração/normalização aceita atletas, backups e estados antigos sem apagar propriedades.
- Regras de duplicata e merge evitam reidentificação por nome, soma acidental e limpeza por células vazias.

## Testes conceituais esperados

| Caso | Resultado esperado |
|---|---|
| Estado legado sem campos de scouting | Lido sem erro; campos desconhecidos permanecem desconhecidos |
| Histórico explicitamente zero | Continua distinguível de histórico ausente |
| Pote 0 | Aceito como valor presente, distinto de pote ausente |
| Importação vazia sobre dado histórico existente | Mantém o dado existente |
| Possível duplicata de nome com IDs diferentes | Sinalizada para revisão; não fundida automaticamente |
| Atualização de atleta existente | Preserva ID, playerStats e campos não importados |
| Backup antigo restaurado | Estado antigo continua utilizável sem perda de compatibilidade |

## Restrições e o que não fazer

Não alterar aplicação nesta etapa; não criar armazenamento paralelo; não substituir IDs por nomes ou gerar novos IDs para registros existentes; não inferir histórico a partir de estatísticas atuais; não converter ausência em zero; não apagar campos desconhecidos; não avançar para importação, persistência, backup/publicação ou interface.

## Pontos a decidir antes da implementação

- Como associar a mesma pessoa em torneios diferentes sem cadastro global atual?
- Os contadores históricos significam totais de carreira sem data, ou será necessário guardar torneio/ano de cada prêmio e pódio?
- Em duplicatas aproximadas, qual fluxo de revisão será aceitável para quem importa?
