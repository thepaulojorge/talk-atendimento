import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /* O site fica em thepaulojorge.github.io/talk-atendimento/ (numa "subpasta").
     Sem isto, o navegador procuraria os arquivos em thepaulojorge.github.io/assets/...
     que não existe, e a página ficaria em branco */
  base: '/talk-atendimento/',
})
