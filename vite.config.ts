import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
