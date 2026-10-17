# Etapa 4 — Persistência da importação

## Objetivo
Integrar apenas linhas confirmadas ao estado oficial existente.

## Contexto
Estado local é salvo por torneio; `useTournament.js` já centraliza ações e possui importação de atletas. Revisar comportamento e contrato atuais antes da alteração.

## Escopo
Aplicar os dados validados da etapa 3 ao roster existente, mantendo arquitetura e IDs.

## Requisitos
Evitar duplicatas, preservar IDs, times e estatísticas existentes, não substituir histórico com células vazias e explicitar conflitos. Mostrar resumo de inseridos, atualizados, ignorados e conflitantes. Não criar armazenamento paralelo.

## Restrições
Manter compatibilidade com dados legados e edição atual do torneio.

## Critérios de aceitação
Confirmação atualiza estado oficial uma vez; cancelamento permanece sem efeito; merge é previsível e auditável.

## Testes esperados
Importação nova, atualização de existente, duplicata, campo histórico vazio, estatísticas atuais preservadas, conflito e cancelamento.

## O que não deve ser feito
Não implementar serviço de armazenamento novo nem publicar automaticamente sem fluxo existente/autorização explícita.
