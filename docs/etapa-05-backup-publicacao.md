# Etapa 5 — Backups e publicação

## Objetivo
Adaptar backup, restauração, sincronização e snapshot público aos novos campos.

## Contexto
`storage.js` exporta/parseia backup JSON; `cloud.js` mantém snapshot público e bin privado; `useTournament.js` sincroniza estado e publicação pendente.

## Escopo
Incluir e restaurar campos oficiais, mantendo fluxo existente e compatibilidade com backups antigos. Avaliar minimização dos dados públicos para scouting.

## Requisitos
Preservar dados desconhecidos/legados; distinguir bin público de sincronização privada; definir explicitamente campos enviados. Cards precisam de nome, capitão, premiações, pódios e apenas informação visual de pote, quando possível sem transmitir pote numérico. Investigar credenciais frontend: chave master atualmente é lida/armazenada pelo cliente e usada em chamadas JSONBin; documentar risco e alternativa compatível antes de alterar.

## Restrições
Não adicionar infraestrutura ou serviço pago sem justificativa e aprovação. Não enviar chave secreta ao snapshot público.

## Critérios de aceitação
Backup antigo restaura sem perda; novo ciclo exportar/restaurar preserva campos; snapshot público contém apenas dados necessários; sincronização existente continua coerente.

## Testes esperados
Round-trip antigo/novo, falhas de rede, push/pull, publicação e inspeção de payload público e privado.

## O que não deve ser feito
Não trocar infraestrutura nem expor credenciais em payloads públicos.
