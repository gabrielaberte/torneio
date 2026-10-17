# Etapa 7 — Testes de persistência, sincronização e uso offline

## Objetivo
Verificar fluxos locais e dependentes de rede, incluindo comportamento após reconexão.

## Contexto
Dados do torneio usam localStorage; JSONBin requer rede. `vite.config.js` configura VitePWA/Workbox, mas configuração não comprova cache correto em produção.

## Escopo
Testar importação, cadastro, backup/restauração, sincronização em dispositivos, uso offline, reload sem internet e publicação posterior. Confirmar service worker, assets e estratégia de cache no build publicado.

## Requisitos
Documentar pré-condições, passos e resultados esperados; separar claramente operações locais de remotas. Verificar conflito de versões e retry pendente. Não presumir que app abre offline antes de confirmar instalação/carregamento e cache.

## Restrições
Usar infraestrutura atual e registrar limitações; não adicionar backend/serviço sem aprovação.

## Critérios de aceitação
Matriz de testes reproduzível com evidências e classificação de cada fluxo como local, online ou pendente de confirmação.

## Testes esperados
Gravar e recarregar local offline, abrir/recarregar após cache, falha de sync, reconectar e publicar, transferir estado entre dispositivos e restaurar backups antigos/novos.

## O que não deve ser feito
Não declarar suporte offline com base apenas no plugin/configuração.
