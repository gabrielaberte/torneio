# Etapa 4 — Persistência da importação

## Objetivo

Aplicar ao estado oficial apenas as linhas válidas e confirmadas na prévia da Etapa 3.

## Contexto

O roster oficial é state.roster no estado do torneio, mantido por useTournament e salvo pela arquitetura local existente. A prévia usa as linhas parseadas, sem estado paralelo persistente.

## Escopo implementado

A janela da prévia agora permite escolher uma ação por linha válida e confirmar a seleção. A ação passa pelo hook oficial do torneio; as alterações entram no roster existente e seguem o salvamento local normal da aplicação.

## Regras de integração

- Linha sem possível duplicata pode ser adicionada como atleta novo ou ignorada.
- Possível duplicata exige ação explícita: atualizar um atleta existente escolhido pelo ID, adicionar como atleta distinto ou ignorar.
- Se mais de uma linha selecionada tiver o mesmo nome normalizado, a transação é bloqueada até que no máximo uma dessas linhas seja selecionada.
- Linhas inválidas ficam desabilitadas e contam como ignoradas. Erros de escolha ou IDs de destino inexistentes bloqueiam a transação inteira; nenhuma linha é aplicada parcialmente.
- Novo atleta recebe ID novo e team vazio, sem substituir IDs existentes.
- Merge mantém ID, team, estatísticas em playerStats e propriedades desconhecidas. Nome, gênero e inscrição (obrigatórios na planilha) são atualizados. Inscrição inválida remove o atleta do time, seguindo a regra já existente no hook.
- Pot só é atualizado quando a célula continha valor.
- Cada contagem histórica preenchida substitui aquela contagem, sem somar. Chaves vazias e campos desconhecidos existentes são preservados.
- Resultado apresenta quantidades inseridas, atualizadas, ignoradas e conflitos. Se tudo for ignorado, não grava estado.
- A mudança usa o estado oficial e o salvamento local existente. Nenhuma publicação pública é iniciada. A sincronização privada, se configurada, segue o efeito/debounce já existente para qualquer mudança do estado.

## Restrições

Não há armazenamento paralelo, migração destrutiva nem alteração de IDs/estatísticas existentes. Não publicar automaticamente.

## Critérios de aceitação

- Confirmar aplica operações uma única vez ao roster oficial.
- Cancelar/fechar antes da confirmação não altera cadastro.
- Inserção gera ID novo; atualização preserva ID, time e estatísticas correntes.
- Vazio preserva pote e histórico; histórico preenchido substitui o contador correspondente sem soma.
- Duplicatas e conflitos têm escolha explícita e transação inválida não aplica parcialmente.
- Resumo ao final informa inseridos, atualizados, ignorados e conflitos.

## Testes esperados

Build de produção concluído com sucesso. Não foram executados cenários manuais nem testes automatizados. Casos ainda a verificar: atleta novo, merge com ID/time/playerStats preservados, campo histórico vazio, pote vazio/zero, duplicatas existentes e internas, várias linhas conflitantes, linha inválida, cancelamento e importação inteiramente ignorada.

## O que não deve ser feito

Não criar armazenamento novo, não somar automaticamente históricos, não publicar snapshot público, não alterar IDs existentes e não avançar para a Etapa 5.
