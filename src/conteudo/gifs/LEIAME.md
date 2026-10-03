# Os gifs do app

Uma pasta por **humor**. Jogue o arquivo na pasta certa — não precisa cadastrar
nada nem mexer em código: o app varre as pastas sozinho na hora de montar.

| Pasta | Onde aparece |
|---|---|
| `feliz/` | a carta do wrap no fim da diária; o acerto de alguém que zerou ("tudo quite") |
| `triste/` | toda pergunta de "apagar"/"desfazer"; apagar uma produção na tela inicial |
| `duvida/` | as perguntas comuns: "tem certeza?", "sair sem salvar?", "você leu?" |
| `medo/` | o que não tem volta: apagar produção de vez, arquivar o financeiro — vazia, usa um de `triste/` |
| `vazio/` | salvar um membro novo só com o nome ("tem quase nada aí") — vazia, usa um de `duvida/` |

**Pasta nova = humor novo.** Criar `susto/` e encher de arquivos já deixa o
humor pronto — falta só dizer ao Claude onde usar.

## Formato: prefira MP4

Aceita `.gif`, `.webp`, `.png`, `.jpg` e `.mp4`. **Jogou gif? Rode `npm run gifs`**: ele converte tudo para mp4 leve e guarda o original em `gifs-originais/`. **Prefira mp4**: o mesmo
trecho pesa dez vezes menos e o app o toca mudo, em laço, igual a um gif. No
Giphy, troque o fim do link por `giphy.mp4`:

    https://media1.giphy.com/media/<código>/giphy.mp4

Os gifs de 02/10/2026 chegaram com 12 MB e viraram mp4 de 1,8 MB no total. Os
originais ficaram em `gifs-originais/`, na raiz do projeto, fora do app (e
fora do git).

## Antes de encher as pastas

- **Tudo aqui viaja com o app**, para funcionar no set sem sinal. Cada megabyte
  é um megabyte que todo mundo baixa na próxima atualização. Mantenha cada
  arquivo abaixo de ~1 MB.
- **Só aparece depois de publicar.** A pasta é lida quando o app é montado.
- **O nome do arquivo não aparece na tela** — serve para você achar depois.
- **Cada pessoa pode desligar** em Configurações → Diversão → "Gifs pelo app".
  Com movimento reduzido ligado no aparelho, também não aparecem.
