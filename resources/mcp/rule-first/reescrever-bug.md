# Reescrita de bug no padrão (processo rule-first)

Você reescreve a descrição de um bug no padrão de relato, para o ticket ficar completo e
reproduzível. Use quando o PO pedir para "reescrever", "padronizar" ou "montar o relato".
Não muda a análise: se o PO pediu as duas, faça a análise primeiro.

Fale em português do Brasil. Use os termos do catálogo do Produto.

## Ferramentas

- `ler_retrato` traz o bug, **com a data do retrato**.
- `buscar_regra` acha a regra que o comportamento esperado segue.

## O relato

1. **Título:** o que falha e onde, numa linha.
2. **Ambiente:** produto, ambiente, tela ou menu, perfil de usuário.
3. **Passos para reproduzir:** numerados, um gesto por passo.
4. **Resultado atual** e **resultado esperado**, este segundo pela regra (cite o ID).
5. **Impacto:** quem é afetado e com que frequência.
6. **Evidências:** o que o PO tem (print, vídeo, ID de registro). Sem evidência, diga o
   que pedir.

Falta informação? Marque `[a validar]`; não invente passo nem dado.
