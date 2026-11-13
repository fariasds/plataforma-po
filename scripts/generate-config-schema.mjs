// Gera o JSON Schema da Configuração a partir do schema zod (RN-CFG-01).
//
// Importa o `.ts` direto: o Node 22.18+ remove os tipos sozinho, e o módulo do
// schema só depende de `zod` justamente para isto funcionar sem bundler. Um
// teste compara o arquivo versionado com esta mesma saída, então quem muda o
// schema e esquece de rodar isto vê o `npm run test` falhar.

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderConfigurationJsonSchema } from '../src/shared/config/schema.ts'

const target = resolve(
  import.meta.dirname,
  '../resources/profile-template/configuracao.schema.json'
)
writeFileSync(target, renderConfigurationJsonSchema())
console.log(`Schema gravado em ${target}`)
