# Publicação Segura

Este projeto teve uma fase em que a produção misturava:

- o bundle estático antigo em `public/assets/`
- e o build atual do React/Vite

Isso causava tela branca por carregar dois apps ao mesmo tempo.

## Base segura atual

- `index.html` agora aponta apenas para `src/main.jsx`
- a entrada antiga foi preservada em `index.static-backup.html`

## Antes de publicar

1. Rodar `npm run build`
2. Rodar `npm run lint`
3. Conferir o app local/preview
4. Só depois publicar

## Regra importante

Não voltar a editar a produção tentando combinar `index.html` com os arquivos de `public/assets/`.
Se precisar consultar a base antiga, use apenas `index.static-backup.html` como referência.
