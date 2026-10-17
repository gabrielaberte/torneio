# Etapa 5 — Backups e publicação

## Situação atual: implementação concluída; configuração de deploy pendente

Backup e sincronização privada preservam o estado completo e os campos adicionados. A publicação usa uma projeção pública allowlist. As operações administrativas agora passam por Functions da Vercel, com a Master Key mantida somente no servidor e autenticação por senha server-side com sessão assinada em cookie HttpOnly.

## Objetivo

Manter os novos campos nos backups e na sync privada, restaurar estados legados com compatibilidade, publicar somente os dados públicos necessários e remover a Master Key do código executado no navegador.

## Implementação

- `normalizeEventState` combina estados recebidos com defaults, preservando propriedades desconhecidas e dados de scouting. Estado local, backup manual e sincronização aplicam normalização; backups mantêm o formato `{ eventName, state }`.
- Push e pull privados mantêm o estado integral, incluindo `pot`, `isCaptain` e `scoutingHistory`.
- Snapshot público contém somente os campos projetados. Para scouting envia nome, `isCaptain`, contagens permitidas de prêmios/pódios e `potColor`; não envia ID, gênero, inscrição, time, estatísticas individuais ou número do pote.
- A agenda pública projeta ID, fase, times, horário e status. Classificação, resultados, grupos e placar ao vivo seguem disponíveis à visualização pública.
- `api/jsonbin.js` é o proxy server-side restrito às operações JSONBin usadas pelo aplicativo. Ele injeta `JSONBIN_MASTER_KEY` do ambiente server-side, rejeita métodos/caminhos não permitidos e exige sessão autenticada e origem same-origin.
- `api/admin-auth.js` autentica com `VOLEI_ADMIN_PASSWORD` e emite cookie assinado `HttpOnly`, `Secure`, `SameSite=Strict`, escopo `/api`, com validade de oito horas. A assinatura usa `VOLEI_SESSION_SECRET`; a senha nunca é gravada no navegador. A interface oferece entrar/sair e apaga a antiga `volei_jsonbin_key` do localStorage.
- Leituras públicas de bins permanecem diretas e sem credencial. Importar sync privada e as operações de escrita exigem a sessão administrativa.

## Configuração necessária na Vercel

Antes de publicar, definir as três variáveis no ambiente Vercel correspondente (Production e, quando necessário, Preview):

- `JSONBIN_MASTER_KEY`: Master Key da conta JSONBin usada pelo projeto.
- `VOLEI_ADMIN_PASSWORD`: senha administrativa com pelo menos 8 caracteres.
- `VOLEI_SESSION_SECRET`: segredo HMAC aleatório com pelo menos 32 caracteres; deve ser diferente da senha.

Sem essas variáveis, a Function de autenticação retorna erro de configuração e o proxy não faz chamadas administrativas. O repositório não contém valores dessas credenciais. Para desenvolvimento local com as Functions, usar `vercel dev`; o servidor Vite (`npm run dev`) sozinho não implementa `/api`.

## Critérios de aceitação

- Campos novos acompanham backup completo e sync privada; estados antigos são normalizados preservando campos existentes.
- Payload público recebe projeção limitada de scouting e agenda; o pote é enviado como cor derivada, nunca como número.
- Master Key não é enviada nem armazenada pelo frontend. O único uso de `X-Master-Key` está na Function server-side.
- Chamadas administrativas usam autenticação server-side com cookie HttpOnly e proxy com allowlist de caminhos/métodos.
- A configuração das variáveis server-side é requisito operacional antes do deploy.

## Verificação e pendências

- Build de produção do frontend: `npm run build` passou; 51 módulos transformados e service worker gerado.
- Não foram feitos round-trips de backup, chamadas reais ao JSONBin nem verificação de cookie por navegador. Esses cenários permanecem para a Etapa 7.
- As Functions não são compiladas pelo build Vite; precisam ser verificadas no ambiente Vercel/local `vercel dev` após configurar as variáveis.
- Nenhuma publicação real foi feita.

## Restrições mantidas

Não substituir infraestrutura, não enviar roster completo ou pote numérico ao bin público, não colocar Master Key no payload e não tratar o PIN frontend como autenticação server-side.

