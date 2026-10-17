# Etapa 1 — Auditoria do código atual

## Resultado e método

Auditoria estática dos arquivos citados abaixo e dos pontos de entrada relacionados. Não foram alterados código, configuração, dependências, dados ou serviços. Nenhum teste runtime foi executado; cache/offline precisa de verificação prática na etapa 7.

## Cadastro de atletas e estado do torneio

- `src/components/admin/Cadastro.jsx` apresenta cadastro e edição de nome, gênero (M/F) e validação da inscrição. A composição/edição é delegada ao hook.
- `src/hooks/useTournament.js` define `addPlayer`, que cria ID via `uid()` e guarda atleta em `state.roster` com `team` vazio. `updatePlayer` mescla campos ao objeto existente e remove o atleta do time se a inscrição passa a inválida. `deletePlayer` remove o atleta e suas estatísticas atuais em `playerStats`.
- O mesmo hook concentra times, partida corrente, chaveamento, classificação, histórico e estatísticas por jogador. Os dados de edição estão juntos no objeto de estado, sem modelo de histórico vitalício observado.
- `src/lib/constants.js` define gêneros, eventos estatísticos e IDs aleatórios curtos via `uid()`.

## Armazenamento local

- `src/lib/storage.js` guarda lista de torneios em `localStorage` (`volei_events`) e cada estado em `volei_state_<id>`. `loadEventState` combina dados lidos com `defaultState()`; falhas de parse retornam estado padrão.
- Mudanças de estado passam por `saveEventState` no hook e são serializadas em localStorage, com `updatedAt`. Falha de gravação é somente avisada no console.
- Papel atual, torneio selecionado, PIN, Master Key JSONBin, ID do registry, URL do viewer e fila de publicação também ficam em localStorage. A sessão liberada pelo PIN usa sessionStorage.
- Excluir torneio remove o estado local daquele ID e a entrada da lista; não há exclusão remota demonstrada nesse fluxo.

## Backup e importação de torneio sincronizado

- `src/components/admin/Historico.jsx` oferece backup manual como texto JSON copiado para clipboard ou prompt, e restauração colando texto.
- `src/hooks/useTournament.js` exporta `{ eventName, state }`. Importação valida somente a presença de `state`, então substitui o estado corrente por inteiro; não há validação detalhada de schema ou merge no fluxo observado.
- `src/lib/storage.js` também possui funções de exportar/parsear backup, mas a interface/hook usa implementação própria.
- `src/components/EventPicker.jsx` importa estado remoto por código, cria evento local e grava a cópia integral de `record.state`; mantém o binId remoto como referência de sync.

## JSONBin: publicação e sincronização

- A integração está em `src/lib/cloud.js` e usa `https://api.jsonbin.io/v3/b`.
- O snapshot público é montado em `publishSnapshot`: inclui data de atualização, classificação por time, resultados de partidas, partidas da agenda, grupos e placar ao vivo. Não inclui roster nem estatísticas individuais no código atual. O bin público e o registry são criados como públicos; o registry contém nome, binId e atualização dos torneios.
- Sync é um fluxo separado: `activateSync` cria bin privado com `eventName`, timestamp e estado completo; `pushCloud` atualiza esse estado e `pullCloud` lê o último registro.
- `src/hooks/useTournament.js` tenta puxar o bin privado ao abrir torneio e aplica a versão remota se o timestamp for mais novo. Salva localmente em toda mudança e agenda push após 4 segundos quando há chave, bin e conexão. Push automático falho é engolido em `cloud.js`; não há indicação visual confirmada de erro nesse caminho.
- Publicação manual, fila pendente e retry no evento `online` estão no hook. Erros de publicação mantêm pendência local e mostram toast. A chamada de publicação envia apenas os dados usados pelo snapshot listado acima.
- A Master Key é inserida na interface de `Historico.jsx`, armazenada sem criptografia em localStorage e enviada pelo navegador no header `X-Master-Key`. Portanto, ela está disponível ao cliente que executa o app e não é um segredo protegido por backend. Risco relevante: qualquer pessoa com acesso ao navegador/origem e ferramentas de desenvolvimento pode inspecionar o armazenamento/execução; o PIN local não elimina essa exposição. O impacto exato depende das permissões da chave/conta e não foi testado.
- O bin privado é marcado como privado, mas o código de sincronização e a Master Key são solicitados para importação no outro aparelho. Não foi feita chamada de rede para validar regras externas do JSONBin.

## Visualização pública

- `src/components/public/PublicViewer.jsx` lê `registry` da query string, obtém lista e snapshot usando chamadas públicas em `cloud.js`. Faz polling a cada 15 segundos e mantém estado exibido se uma chamada falhar.
- Hoje exibe lista de torneios, classificação, resultados recentes, agenda, grupos e placar ao vivo. Não carrega o roster nem cards de atletas.
- A visualização requer rede para obter lista/snapshot. Não foi encontrado cache de dados de torneio em localStorage no componente.

## Proteção administrativa

- `src/App.jsx` guarda seleção de papel no localStorage; o papel admin conduz a `AdminRoot`.
- `src/components/Lock.jsx` cria PIN com mínimo de três caracteres, guarda o texto em localStorage e compara localmente. “Esqueci o PIN” apaga o PIN e permite criar outro; dados locais permanecem.
- `src/components/AdminRoot.jsx` lembra liberação em sessionStorage, que persiste durante a sessão da aba/origem, e então abre seletor/área admin.
- Conclusão: é uma barreira de interface local para o navegador, não autenticação de servidor. Não protege dados já acessíveis no armazenamento do cliente nem controla autorização de chamadas JSONBin.

## Offline e cache

- Operações de leitura/gravação do estado em localStorage são locais e não precisam de rede enquanto a aplicação já está carregada.
- Sync e publicação dependem de fetch/rede. A publicação manual fica pendente se `navigator.onLine` sinalizar offline e tenta novamente no evento `online`; polling público captura falhas e mantém a última tela em memória. Isso não prova que reload offline funcione.
- `vite.config.js` configura `vite-plugin-pwa`, manifesto e Workbox com `navigateFallback: '/index.html'`; `package.json` inclui plugin e workbox-build. Porém, `src/main.jsx` não registra service worker explicitamente e a busca no código não localizou `registerSW` nem uso de `virtual:pwa-register`. É necessário verificar como o plugin injeta/gera o registro no build instalado, os arquivos emitidos e o comportamento num navegador após instalação/carregamento online.
- `index.html` carrega fontes do Google Fonts; aparência offline pode depender de fontes externas. A confirmação de cache de app-shell, assets, rota profunda e reload deve ser feita em build servido e navegador na etapa 7.

## Limitações e pontos a investigar

1. Confirmar no build de produção se o plugin gera e registra service worker sem chamada explícita no código, quais URLs/assets são precacheados e se recarregar sem rede abre a aplicação instalada.
2. Confirmar comportamento de quota/erro de localStorage e se a interface informa quando o salvamento local falha; hoje o catch apenas escreve no console.
3. Confirmar política e impacto da Master Key JSONBin usada no cliente e definir, em etapa própria, como limitar exposição sem presumir infraestrutura nova.
4. Avaliar consistência/conflitos na sincronização entre dois aparelhos: comparação por timestamp, gravações concorrentes e feedback do push automático não foram exercitados.
5. O importador de backup restaura estado inteiro e confia na estrutura além da presença de `state`; confirmar requisitos de compatibilidade e validação ao tratar backups.
6. Confirmar se bins públicos antigos ou dados de registry têm formatos adicionais que não aparecem nos fluxos locais observados.
7. A fila de publicação é persistida por IDs de evento, mas não guarda snapshot pendente; o retry publica o estado atual. Confirmar se esse comportamento é intencional.
8. Fontes externas são carregadas de Google Fonts; avaliar fallback visual offline.

## Arquivos envolvidos

- `src/hooks/useTournament.js`
- `src/lib/storage.js`
- `src/lib/cloud.js`
- `src/lib/constants.js`
- `src/components/admin/Cadastro.jsx`
- `src/components/admin/Historico.jsx`
- `src/components/EventPicker.jsx`
- `src/components/Lock.jsx`
- `src/components/AdminRoot.jsx`
- `src/components/admin/AdminApp.jsx`
- `src/components/public/PublicViewer.jsx`
- `src/App.jsx`
- `src/main.jsx`
- `vite.config.js`
- `package.json`
- `index.html`

## Critérios de aceitação e testes

Relatório baseado em inspeção estática concluído e arquivos envolvidos registrados. Inspeção estática foi o único teste desta etapa; não houve execução de cenário offline, chamadas de serviço, alterações nem teste automatizado.
