// O Vite (electron-vite e Vitest) entrega o conteúdo do arquivo como texto com
// `?raw`. O template do Perfil entra assim no bundle do main, sem depender de
// onde a pasta resources/ fica no app empacotado.
declare module '*?raw' {
  const content: string
  export default content
}
