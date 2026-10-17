# Etapa 2 — Modelo de dados

## Objetivo
Definir uma evolução compatível do modelo para cadastro e histórico de scouting.

## Contexto
O estado atual do torneio contém `roster`, estatísticas de partida e torneio, times, resultados e metadados de sincronização em `storage.js`/ `useTournament.js`. O cadastro já tem ID, gênero e validação de inscrição.

## Escopo
Propor campos para gênero, inscrição validada, pote atual (0–4), capitão, premiações individuais e pódios históricos. Separar edição vigente do histórico acumulado do atleta. Definir identificação estável, regras de merge e compatibilidade com estados/backups antigos.

## Requisitos
Preservar IDs, estatísticas registradas e campos desconhecidos relevantes. Campos históricos opcionais devem distinguir ausência de zero. Definir valores válidos, migração/normalização sem perda e representação de dados ausentes.

## Restrições
Não alterar código nem criar armazenamento paralelo. Não tratar o estado da edição como histórico vitalício.

## Critérios de aceitação
Especificação com exemplos de atleta antigo e novo, compatibilidade, merge, validação e estratégia gradual de migração.

## Testes esperados
Casos conceituais para estado legado, campo ausente, valor zero, duplicata e merge sem perda; implementação dos testes fica nas etapas posteriores.

## O que não deve ser feito
Não implementar importação, persistência ou interface nesta etapa.
