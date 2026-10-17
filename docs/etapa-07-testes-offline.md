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

## Execução e resultados

- Status: Parcial; verificações locais/build concluídas, fluxos em navegador e JSONBin aguardam confirmação manual no deployment.
- Pré-condições para reproduzir os testes remotos: deployment Vercel atualizado; variáveis de ambiente configuradas; login administrativo funcionando; mesma origem nos dois aparelhos; conexão estável. Para teste offline, carregar o app online até o service worker instalar e concluir o precache antes de desligar a rede.

| Fluxo | Passos reproduzíveis | Resultado/evidência | Classificação |
|---|---|---|---|
| Importar Excel | Use `docs/modelo-importacao-atletas.xlsx`, preencha uma linha válida e importe na aba Cadastro. Repita com pote fora de 0–4 e contagem negativa. | Parser exercitado em Node com planilha derivada do modelo: linha válida, pote zero, prêmio zero e pódio aceitos. UI/planilha inválida não exercitadas no browser. | Parser local: passou; UI e casos inválidos: pendentes |
| Persistência local | Cadastre/edite atleta, recarregue o torneio e compare campos, ID, time e estatísticas. | Smoke local em Node com `localStorage` simulado confirmou save/load, valores zero/null e campos desconhecidos. Não comprova o browser real. | Local simulado: passou; browser: pendente |
| Compatibilidade legada | Carregue estado antigo sem campos de scouting e restaure backup antigo e novo. | Smoke local confirmou normalização de estado legado preservando propriedades desconhecidas; export/parse do backup novo manteve os campos. Restauração pelo modal não exercitada. | Serialização local: passou; UI: pendente |
| Retry de sync privada | Com sync ativa, edite offline, reconecte e confira o registro pelo segundo aparelho. Repita após falha de rede. | Adicionada marca persistente `volei_sync_pending_<eventId>` e tentativa no evento `online`; helpers de fila passaram no smoke local. Envio real e segundo aparelho não verificados. | Fila local: passou; nuvem: pendente |
| Retry de publicação pública | Publique offline, reconecte, confirme envio e abra o link público. | Código existente mantém fila de publicação por torneio e tenta novamente no evento `online`; não houve chamada de publicação real nesta etapa. | Pendente de confirmação online |
| Sessão administrativa | Entre no app e confira que o endpoint cria sessão antes de publicar/sincronizar. | Usuária confirmou login bem-sucedido após configurar as variáveis Vercel. | Online, confirmado pela usuária |
| Cache e reload offline | Faça primeiro carregamento online, aguarde instalação do service worker, desligue a rede, recarregue e valide os assets/cache. | `npm run build` passou. O service worker gerado precacheia 6 entradas, incluindo HTML, JS/CSS, chunk XLSX, manifest e registro; `/api/` está na denylist do fallback. O reload offline real não foi executado. | Build/cache estático: passou; offline real: pendente |
| Dois aparelhos e conflito | Em dois aparelhos autenticados, sincronize o mesmo torneio; faça alterações em ambos antes do push e compare. | Sem teste remoto. Ao abrir, o código carrega o registro remoto quando `updatedAt` é mais recente; o push não faz comparação atômica de versão. Escritas concorrentes têm comportamento last-write-wins e podem sobrescrever alterações. | Pendente; limitação conhecida |

### Smoke local executado

Sem adicionar dependências ou arquivos de teste, foi executado um script Node temporário com asserções para save/load em `localStorage` simulado, normalização de estado legado, round-trip de backup, marcação/limpeza da fila de sync e parsing de uma linha válida de Excel. Resultado: todos esses checks passaram. `npm run build` passou (51 módulos; service worker gerado). Nenhuma chamada real à API JSONBin foi executada.

### Limitações e próximos passos desta etapa

Não foi possível comprovar offline em navegador, instalação do service worker, publicação real, falha/reconexão contra JSONBin, round-trip privado entre dispositivos, restauração pelo modal ou concorrência. Esses cenários exigem uso da aplicação no deployment e duas sessões/aparelhos; mantenha a Etapa 7 pendente até registrá-los. A configuração `/api/` denylist só evita que o app-shell responda por navegações API; não fornece API offline.
