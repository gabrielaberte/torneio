# Etapa 6 — Cadastro manual

## Objetivo
Permitir editar manualmente os mesmos dados relevantes para scouting.

## Contexto
`Cadastro.jsx` mantém formulário de atleta; `useTournament.js` fornece add/update. Inspecionar os campos e validações vigentes.

## Escopo
Adicionar campos de gênero, inscrição, pote, capitão, contagens de premiações e pódios, alinhados ao modelo da etapa 2.

## Requisitos
Preservar fluxo, IDs, time e estatísticas já registradas. Aplicar validações equivalentes à importação. Distinguir valor não informado de zero e histórico de edição atual.

## Restrições
Adaptar formulários existentes; não duplicar cadastros ou criar armazenamento paralelo.

## Critérios de aceitação
Atleta novo e existente podem ser salvos; edição parcial preserva dados não editados; valores inválidos são impedidos e acessíveis.

## Testes esperados
Criar/editar, campos opcionais, validação de limites, preservação de estatísticas e compatibilidade de atleta legado.

## O que não deve ser feito
Não mudar regras de jogo, times ou elegibilidade fora do necessário.
