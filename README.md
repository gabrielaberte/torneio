# Placar Vôlei (versão React)

Reescrita em React + Vite do app original em HTML único. Mesmas funcionalidades:
elenco, jogo ao vivo, estatísticas, times, histórico, PIN de admin, múltiplos
torneios, sincronização entre aparelhos e publicação pública via jsonbin.io.

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Gerar versão de produção

```bash
npm run build
```

Gera a pasta `dist/` — é isso que o Vercel publica.

## Publicar no Vercel

1. Suba esta pasta pra um repositório no GitHub.
2. Em vercel.com → **Add New Project** → escolha o repositório.
3. O Vercel detecta sozinho que é um projeto Vite (usa `npm run build`, pasta
   de saída `dist`) — é só clicar em **Deploy**.

## Estrutura

```
src/
  lib/          -> dados puros (constantes, localStorage, chamadas jsonbin.io)
  hooks/        -> useTournament: todo o estado e as ações de um torneio
  components/
    admin/      -> Elenco, Jogo, Estatísticas, Times, Histórico
    public/     -> PublicViewer (link de visualização pública)
    ui/         -> Toast
```

## O que muda em relação à versão HTML única

Nada na funcionalidade — só a organização do código. Cada tela agora é um
arquivo próprio, e o estado fica centralizado no hook `useTournament`, o que
facilita editar uma parte sem afetar as outras.
