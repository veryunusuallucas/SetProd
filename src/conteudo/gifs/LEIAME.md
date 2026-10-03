# A biblioteca de gifs

Tudo numa pasta só. **O nome do arquivo é o cadastro:** as tags vêm primeiro,
separadas por `_`, e o último pedaço é o filme ou a cena.

    certeza_medo_pulp-fiction-jules.mp4
    abertura_comemorar_rocky-horror.mp4
    triste_interstellar.mp4

Um gif pode ter quantas tags quiser — o Jules apontando a arma serve para
"tem certeza?" e para "medo". Pode escrever em inglês (`happy`, `sad`,
`scared`, `fun`) ou com acento: o app entende.

## Onde cada tag aparece

| Momento | Tags que ele procura (na ordem) | Onde |
|---|---|---|
| Abertura | `abertura` → `comemorar` | logo depois de criar uma produção |
| Wrap | `comemorar` → `feliz` | a carta do fim da diária |
| Tudo quite | `feliz` → `comemorar` | o acerto de alguém que zerou |
| Apagar | `triste` | toda pergunta de apagar ou desfazer |
| Sem volta | `certeza` → `medo` → `triste` | apagar uma produção de vez; arquivar o financeiro |
| Tem certeza? | `duvida` → `certeza` | as outras perguntas (sair sem salvar, trocar algo) |
| Tem nada aí | `vazio` → `duvida` | salvar um membro novo só com o nome |

Se a primeira tag não tiver nenhum gif, vale a próxima. Tag nova (`dinheiro`,
`susto`...) não quebra nada: só não aparece até dizer ao Claude onde usar. A
tabela de verdade está em `src/lib/gifs.ts` (`MOMENTOS`).

## Para ver como ficou

Com o setprod-dev rodando: **http://localhost:5173/galeria-gifs.html**. Mostra
cada momento (com botão para abrir a tela de verdade) e a biblioteca inteira
com as tags de cada arquivo. Não entra no app publicado.

## Jogou um .gif? `npm run gifs`

Converte para mp4 leve (o mesmo trecho pesa dez vezes menos), mantém as tags do
nome e guarda o original em `gifs-originais/`, fora do app e do git. No Giphy,
dá para baixar o mp4 direto trocando o fim do link por `giphy.mp4`.

## Antes de encher

- **Tudo aqui viaja com o app**, para funcionar no set sem sinal. Meta: poucos
  por tag (uns 5), cada um de 1 a 4 segundos.
- **Só aparece depois de publicar.**
- **Cada pessoa pode desligar** em Configurações → Diversão → "Gifs pelo app".
  Com movimento reduzido no aparelho, também não aparecem.
