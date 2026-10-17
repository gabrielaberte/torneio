# Etapa 3 — Importação e validação de Excel

## Objetivo
Planejar e implementar leitura, validação e prévia da planilha sem persistência definitiva.

## Contexto
A lista atual é `state.roster` e existe uma ação de importação no hook; conferir o fluxo vigente antes de integrá-lo.

## Escopo
Colunas: Nome, Gênero, Inscrição validada, Pot, MVP, Melhor sacador, Melhor defesa, Melhor ataque, Maior pontuador, Melhor bloqueio, 1º lugar, 2º lugar, 3º lugar. Nome, gênero e inscrição obrigatórios; inscrição aceita Sim/Não; pote opcional de 0 a 4; contagens opcionais inteiras não negativas.

## Requisitos
Validar cabeçalhos e linhas, indicar erros por linha/campo, detectar possíveis duplicatas e apresentar prévia e resumo antes de confirmar. Células vazias não equivalem a zero nem apagam histórico. Cancelar não altera cadastro. Nesta etapa, não persistir dados.

## Restrições
Adaptar arquitetura atual e dependências apenas se justificadas no escopo; não alterar estado oficial ao selecionar ou pré-visualizar arquivo.

## Critérios de aceitação
Arquivo válido gera prévia fiel; erros são explicados; duplicatas são sinalizadas; cancelamento deixa estado intacto; valores inválidos não passam silenciosamente.

## Testes esperados
Planilha válida, obrigatórios ausentes, Sim/Não inválido, pote fora da faixa, contagens fracionárias/negativas, células vazias, duplicatas, cabeçalhos incorretos e cancelamento.

## O que não deve ser feito
Não salvar, sincronizar ou publicar os dados importados nesta etapa.
