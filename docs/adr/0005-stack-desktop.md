# Stack: Electron com React, Ant Design e IPC tipado

**Status:** aceita · 2026-10-03

Registra as decisões de stack que continuam valendo. O contexto: um dashboard
gerencial sobre o Azure DevOps, distribuído como aplicativo desktop para pessoas
não técnicas, sem hospedagem e sem segredo dentro do pacote.

## Decisões

- **App desktop com Electron, não web hospedada.** Zero custo de hospedagem, o PAT
  nunca fica exposto na web e o instalador é distribuível a quem não é técnico.
- **Vite + React SPA, sem Next.js.** O desktop não precisa de SSR nem de Server
  Components, e o servidor embutido do Next foi a origem da complexidade de
  empacotamento. O roteamento é o React Router.
- **TypeScript no processo principal e no renderer.** Uma linguagem só. O app espera
  a resposta do Azure, não processa pesado: velocidade compilada não ajudaria, e uma
  segunda linguagem (Go, C#) custaria sem benefício decisivo.
- **O "backend" é o processo principal, via IPC.** Ele chama o Azure, faz os
  cálculos pesados e guarda o PAT. O renderer pede dados prontos e nunca recebe dado
  bruto. Não existe servidor embutido nem porta aberta para o app.
- **IPC tipado à mão.** O contrato mora em `src/shared/ipc.ts` e os handlers
  resolvem com `{ ok, data | error }`, porque o Electron perde mensagem e código de
  erros lançados. Um gerador de contrato (como `electron-trpc`) fica como evolução
  possível, não como necessidade.
- **TanStack Query sobre o IPC** para cache, estados de carga e nova busca.
- **Ant Design como design system, e tudo segue a lógica dele.** O requisito era um
  design system pronto e documentado, e não um kit para montar o próprio (a
  inconsistência visual anterior veio daí). Gráficos usam `@ant-design/plots` e ícones
  `@ant-design/icons`; cor, raio e densidade saem do tema.
- **O PAT é de cada pessoa, somente leitura e cifrado localmente.** Fica no
  `safeStorage` do sistema (DPAPI no Windows, Keychain no macOS) e só sai da máquina
  por HTTPS para o Azure DevOps (ver [ADR 0002](0002-sem-autenticacao-perfil-local-por-maquina.md)).
- **Empacotamento com electron-builder (NSIS).** Uma lista de inclusão explícita de
  arquivos garante que `.env`, código-fonte e qualquer segredo fiquem fora do
  instalador. Sem assinatura de código no início, o Windows mostra o aviso de editor
  desconhecido e o README orienta quem instala.
- **Distribuição e atualização pelo GitHub Actions e Releases**, a partir de uma tag,
  com o SHA-256 publicado (ver [ADR 0004](0004-repositorio-publico-novo-gpl.md)).

## Alternativas descartadas

- **Hospedar na web:** o plano gratuito é não comercial e a credencial ficaria
  exposta.
- **Next.js standalone dentro do Electron:** foi o que deu errado antes.
- **shadcn/ui, MUI e Mantine:** o primeiro é um kit, não um design system; o segundo
  tem identidade forte e componentes avançados pagos; o terceiro é uma biblioteca
  coesa, mais que um design system documentado.
- **Recharts para gráficos:** quebraria a coerência com o Ant Design.

## Consequências

- Todo recurso novo atravessa o mesmo caminho: método em `IpcApi`, canal, handler no
  main, binding no preload e método no cliente do renderer.
- Não existe leitura do PAT no contrato de IPC, e não deve passar a existir.
