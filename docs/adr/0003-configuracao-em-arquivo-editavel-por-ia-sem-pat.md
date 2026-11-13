# Configuração em JSON editável por IA, com o PAT fora dela

**Status:** aceita · 2026-09-27

Tudo o que hoje está fixo no código para a empresa do autor (produtos, area paths, estados,
campos customizados, feriados, tema) vira uma **Configuração**. Ela fica em um
arquivo JSON com `$schema` publicado, acompanhado de um `AGENTS.md` com as
instruções para a IA. A tela do app e o arquivo são duas portas para a mesma fonte:
o app observa o arquivo, valida e, se a validação falhar, mantém a última versão
válida.

Duas restrições saem desta decisão e são garantidas por teste:

- **O PAT nunca fica na Configuração.** O arquivo existe justamente para ser lido
  pela IA e compartilhado entre pessoas.
- **A Configuração guarda o nome da organização, nunca uma URL.** O host é sempre
  montado como `dev.azure.com/<org>`. Se o arquivo aceitasse URL, uma Configuração
  importada poderia mandar o PAT para outro servidor. Por isso o Azure DevOps Server
  (instalação local) fica fora da v1.

## Alternativas consideradas

- **YAML:** mais fácil de ler, mas a IA erra mais a indentação e os tipos ficam
  ambíguos.
- **`config.ts`:** exigiria executar código do usuário dentro do app.
