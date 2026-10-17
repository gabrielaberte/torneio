# Etapa 3 — Importação e validação de Excel

## Objetivo

Ler planilha, validar os dados e permitir revisão de uma prévia sem persistir alterações no cadastro.

## Contexto

O roster oficial permanece em state.roster no estado do torneio. A biblioteca xlsx é carregada sob demanda ao selecionar arquivo. A ação de confirmar e a integração persistente são escopo da Etapa 4.

## Escopo implementado

Na aba Elenco, o botão “Importar planilha Excel · prévia” abre uma janela para selecionar arquivos .xlsx ou .xls. A primeira aba do arquivo é lida. A interface apresenta resumo, linha de origem, nome, gênero, inscrição, pote, campos históricos preenchidos e resultado da validação.

Os 13 cabeçalhos definidos no plano são exigidos: Nome, Gênero, Inscrição validada, Pot, MVP, Melhor sacador, Melhor defesa, Melhor ataque, Maior pontuador, Melhor bloqueio, 1º lugar, 2º lugar e 3º lugar. Os valores das colunas Pot e de histórico podem ficar vazios. Nomes de cabeçalho são comparados sem diferença de caixa/acentos; colunas extras são ignoradas. Gênero aceita M/Masculino e F/Feminino; inscrição aceita Sim/Não, sem diferença de caixa/acentos.

## Requisitos e comportamento

- Nome, gênero e inscrição validada são obrigatórios.
- Pote aceita inteiro de 0 a 4. Célula vazia permanece ausente.
- MVP, Melhor sacador, Melhor defesa, Melhor ataque, Maior pontuador, Melhor bloqueio e colocações de pódio aceitam inteiros não negativos. Células vazias permanecem ausentes.
- Linhas totalmente vazias são ignoradas. Outros erros são apresentados por número de linha e campo.
- Possíveis duplicatas são sinalizadas por nome normalizado (caixa, acentos e espaços), contra o roster existente e dentro do arquivo. Isso é apenas uma indicação; não faz fusão.
- A prévia não chama ações de atualização do hook, não altera roster e não tem botão de confirmação. Fechar/cancelar descarta o resultado em memória.

## Restrições

A importação nesta etapa não persiste, sincroniza nem publica. Não altera IDs, estatísticas, estado oficial ou dados existentes. A biblioteca é carregada dinamicamente para não aumentar o bundle inicial.

## Critérios de aceitação

- Arquivo Excel válido pode ser lido e pré-visualizado.
- Qualquer cabeçalho previsto ausente produz erro claro.
- Valores fora do formato permitido geram erro por linha/campo.
- Valores históricos e pote aparecem na prévia; vazio não é mostrado como zero.
- Duplicatas possíveis são alertadas sem merge.
- Cancelar/fechar não grava dados.

## Testes esperados

Build de produção executado com sucesso. Não há script de testes automatizados configurado no package.json e não foram executados testes automatizados nem cenários manuais de arquivos. Casos a cobrir em verificação posterior: planilha válida, obrigatórios ausentes, inscrição inválida, pote fora da faixa, contagens negativas/fracionárias, células vazias, duplicata, cabeçalhos ausentes, linha vazia e cancelamento.

## O que não deve ser feito

Não confirmar ou salvar a importação, não criar IDs, não mesclar duplicatas, não modificar dados existentes e não avançar para Etapa 4 nesta etapa.

