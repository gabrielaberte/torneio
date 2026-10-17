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

## Execução

- Status: Implementação concluída; fluxos interativos ainda dependem de validação manual.
- O formulário existente de jogador agora edita gênero, inscrição, pote (0–4), capitã, seis contagens de premiação e três contagens de pódio.
- Pot e contagens aceitam vazio como não informado e zero como valor conhecido. Ao limpar um valor já preenchido, ele é salvo como `null`.
- As contagens aceitam somente inteiros não negativos; pote aceita somente inteiro de 0 a 4. Erros são apresentados no formulário e os campos usam rótulos/estados acessíveis.
- Novo cadastro continua gerando ID e sem time por padrão. Edição preserva time, ID, estatísticas atuais, propriedades desconhecidas e histórico não alterado; inscrição inválida mantém a regra existente de retirar o atleta do time.
- `addPlayer` agora aceita os campos adicionais no objeto oficial do roster. `updatePlayer` combina parcialmente `scoutingHistory.awards` e `podiums` sem substituir campos não editados.
- Verificação executada: `npm run build` passou. Não foram executados os cenários interativos de criação/edição desta etapa.
- Arquivos: `src/components/admin/Cadastro.jsx`, `src/hooks/useTournament.js`, `src/styles.css`.
