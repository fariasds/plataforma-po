# Aviso de versão nova, sem atualização automática

**Status:** aceita · 2026-11-19

Ao abrir, o app pergunta ao GitHub público qual é a última Release. Se for mais nova
que a instalada, avisa e oferece **baixar a versão nova**, abrindo o link do
instalador no navegador. Quem baixa, abre e instala é o PO. O app não baixa
arquivo, não executa instalador e não leva token nem dado do PO nessa consulta.

## Por que assim, e não atualização automática

A atualização automática (`electron-updater`) baixa o instalador e o executa. Sem
assinatura de código (`RN-SEC-14`), a única conferência que ela faz é o SHA-512
publicado **na mesma Release** do instalador. Quem conseguisse trocar o arquivo da
Release trocaria o hash junto, e a versão falsa se instalaria sozinha em toda
máquina. Hoje esse mesmo ataque exige que cada pessoa baixe o arquivo, passe pelo
aviso do SmartScreen e, se quiser, confira o SHA-256. A atualização automática
tiraria essas barreiras.

Ela também contrariaria duas garantias que a tela Segurança mostra: o app passaria a
iniciar processo (`RN-SEC-23`) e a baixar arquivo de um host que não é o Azure.

Abrir o download no navegador mantém tudo isso: o arquivo baixado pelo navegador
leva a marca de "veio da internet", o SmartScreen aparece como sempre, e o SHA-256
da Release continua valendo para conferência.

## O que sai desta decisão

- **`RN-SEC-33`, nova:** a consulta de versão. Um único `fetch`, num arquivo só,
  para um endereço exato (`api.github.com/repos/<repositório público>/releases/latest`),
  só `GET`, sem token, sem cookie e sem seguir redirecionamento. Na demonstração não
  roda (`RN-SEC-27`).
- **`RN-SEC-18`, ampliada:** o main fala com o Azure, com o PAT, e com esse único
  endereço do GitHub, sem PAT. O teste estático passa a aceitar dois arquivos, cada
  um com um `fetch` só, logo depois da sua checagem.
- **`RN-SEC-21`, ampliada:** além do Azure da organização, vão para o navegador só a
  página da Release e o instalador de uma versão, no repositório público, montados
  pelo main a partir do número da versão. A janela não manda URL nenhuma.
- **`RN-GLB-18`, nova:** o aviso na tela.
- **`RN-SEC-23` não muda.** Nenhum processo é iniciado.

## Alternativas consideradas

- **`electron-updater` agora, sem assinatura:** melhor experiência, mas troca a
  garantia de integridade pela conveniência (ver acima).
- **`electron-updater` conferindo o atestado de proveniência da esteira:** prova que
  o instalador saiu do workflow público, mas exige verificar Sigstore no main e
  ainda inicia processo. Assinar o instalador resolve o mesmo com menos peças.
- **Só aviso, sem botão:** seguro, mas deixa o PO procurando o arquivo na Release.

## Consequências

- **Um passo a mais que o automático:** o PO abre o instalador baixado. O NSIS
  instala por cima e mantém Perfis, Configuração e PAT, que moram fora da pasta do
  programa.
- **O GitHub vê o IP de quem abre o app**, uma vez por abertura. Não vê token,
  organização nem Perfil.
- **Rascunho não aparece.** O endpoint devolve só a última Release publicada: a
  etapa manual de publicar (`docs/DISTRIBUICAO.md`) continua sendo o que libera a
  versão para todo mundo.
- **A atualização automática volta à mesa com o instalador assinado.** Aí o
  `electron-updater` confere a assinatura antes de instalar, e a exceção à `RN-SEC-23`
  passa a ter o que a justifique.
