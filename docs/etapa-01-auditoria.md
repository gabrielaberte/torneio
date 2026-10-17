# Etapa 1 — Auditoria do código atual

## Objetivo
Documentar o funcionamento existente antes de propor mudanças.

## Contexto
React/Vite. Arquivos inicialmente identificados: `src/hooks/useTournament.js`, `src/lib/storage.js`, `src/lib/cloud.js`, `src/components/admin/Cadastro.jsx`, `src/components/Lock.jsx`, `src/components/AdminRoot.jsx`, `src/components/public/PublicViewer.jsx`, `vite.config.js`.

## Escopo
Rastrear cadastro, estado do torneio, armazenamento, exportação/importação de backup, publicação/sincronização JSONBin, visualização pública, proteção administrativa e uso offline. Registrar fluxos, formato atual, dependências entre componentes e limitações com referências a arquivos.

## Requisitos
Verificar se dados e credenciais ficam no navegador, quais campos seguem para cada bin, como são tratadas falhas de rede e se o PIN funciona como controle local ou autenticação real. Confirmar suporte PWA/cache e comportamento de navegação/reload offline. Registrar dúvidas como pontos a investigar.

## Restrições
Não alterar código da aplicação, configurações, dependências, dados ou serviços.

## Critérios de aceitação
Relatório baseado no código observado, com arquivos envolvidos, fluxos, limites, riscos e perguntas abertas; sem suposições apresentadas como fatos.

## Testes esperados
Inspeção estática dos fluxos e configuração. Não executar mudanças; validação offline real fica para etapa 7.

## O que não deve ser feito
Não implementar etapas seguintes nem recomendar reconstrução de funcionalidades antes de avaliar adaptação.
