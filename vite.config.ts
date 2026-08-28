import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

/**
 * A versão sai do package.json e entra no app.
 *
 * Antes o relatório de bug mandava `versao_app: 'v4'` escrito à mão — e ficou
 * assim enquanto o app passava por v4.1, v4.2 e v4.3. Um relatório que não diz
 * a versão obriga a adivinhar de qual build veio o problema, que é justamente
 * o que ele deveria responder.
 */
const versao = JSON.parse(readFileSync('./package.json', 'utf8')).version as string

export default defineConfig({
  define: {
    __VERSAO_APP__: JSON.stringify(versao),
  },
  plugins: [
    react(),
    VitePWA({
      /*
        `prompt`, e NÃO `autoUpdate` — que era o que estava aqui e quebrava a
        tela de quem já estava com o app aberto.

        Com `autoUpdate`, o service worker novo chama `skipWaiting()` assim que
        chega: assume o controle na hora e apaga o cache do anterior. Só que a
        aba aberta continua rodando o `index.html` ANTIGO, que carrega as telas
        sob demanda por nomes com hash — `DashboardGeral-C9rGlOfJ.js`. Esses
        arquivos acabaram de sumir do cache E do servidor, que agora só tem os
        novos.

        O resultado apareceu num relato do dia 28:

            TypeError: error loading dynamically imported module:
            .../assets/DashboardGeral-C9rGlOfJ.js

        A pessoa clica numa aba e a tela não abre. Nada de errado com a
        internet, nada de errado com o código — o app se serrou pela metade
        sozinho, e a única saída era o Ctrl+Shift+F5 que o Lucas tinha que ficar
        pedindo no grupo.

        Com `prompt`, o service worker novo ESPERA. O cache antigo continua de
        pé, a aba aberta segue funcionando, e a troca acontece quando a pessoa
        aceita — no `AvisoDeVersao`. Trocar durante a diária, sem avisar, é o
        que não pode.
      */
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      workbox: {
        // As fontes base do pdf.js (.pfb/.ttf) entram no cache offline: sem
        // elas o roteiro abre com a camada de texto desalinhada, e no set não
        // há internet para buscá-las depois.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,pfb,ttf}'],
        // O padrão do Workbox é 2 MiB, e o pacote passou disso (o pdf.js sozinho
        // é a maior parte). Sem subir o teto, o arquivo principal fica FORA do
        // cache e o app deixa de abrir offline — que é justamente o cenário do
        // set. Vale dividir o pacote depois; o teto não substitui isso.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'SetProd',
        short_name: 'SetProd',
        description: 'Plataforma de produção de set',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
