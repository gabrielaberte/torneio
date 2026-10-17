# Etapa 8 — Cards públicos de scouting

## Objetivo
Exibir cards públicos usando dados oficiais persistidos e publicados.

## Contexto
`PublicViewer.jsx` lê snapshot público; `cloud.js` monta o payload. Confirmar etapas 2–5 e dados disponíveis antes de construir UI.

## Escopo
Mostrar nome, capitão, histórico de pódios e contagens disponíveis de MVP, melhor sacador, melhor defesa, melhor ataque, maior pontuador e melhor bloqueio. Busca por nome; filtros Todos, Capitães, com pódios e com premiações. Layout responsivo.

## Requisitos
Pote 0–4 indicado somente pela cor de fundo. Não exibir número, rótulo de habilidade, legenda de cores nem filtros por pote. Evitar transmitir número de pote à visão pública, enviando representação visual derivada se viável. Ausência de histórico deve ser discreta; ausência de pote tem tratamento visual distinto. Não inventar estatísticas.

## Restrições
Usar dados oficiais publicados e respeitar minimização da etapa 5. Não publicar campos administrativos desnecessários.

## Critérios de aceitação
Cards responsivos, busca/filtros funcionais, campos ausentes tratados, cores sem explicação ou valor textual e payload público minimizado.

## Testes esperados
Busca, cada filtro, atleta sem histórico, atleta sem pote, pote em cada faixa, mobile/desktop e inspeção dos dados realmente publicados.

## O que não deve ser feito
Não mostrar pote numericamente, criar filtro/legenda de pote ou inferir estatísticas ausentes.
