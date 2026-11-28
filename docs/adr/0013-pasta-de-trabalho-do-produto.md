# Os artefatos do fluxo moram numa pasta de trabalho que o PO aponta

**Status:** aceita · 2026-11-24

O fluxo do PO ([desenho](../fluxo-po/DESENHO.md)) produz texto longo: Brief da
Feature, Registro de Decisões, Plano de PBIs, PBIs escritos e o catálogo de regras
do Produto. Esses arquivos ficam numa **pasta de trabalho por Produto**, em
Markdown, num lugar que o PO escolhe. A janela e o servidor MCP leem e gravam só
dentro dela.

## Por que assim

- **O PO quer esses arquivos fora do app:** abrir no editor, versionar com git,
  guardar na pasta sincronizada da empresa.
- **Dados de trabalho são outra coisa.** São JSON pequeno que nasce do uso
  (`RN-CFG-08`). Um Brief é documento, e vive mais que a instalação.
- **O artefato sobrevive à troca de máquina.** O risco que o ADR 0001 encara para
  o planejamento não se repete aqui: a pasta é do PO.

## O que sai desta decisão

- **O caminho da pasta é da máquina e não entra na Configuração.** A Configuração é
  compartilhável; um caminho de disco de outra pessoa não serve a quem a importa.
  Fica nos dados do Perfil, indexado pelo ID do Produto.
- **O servidor MCP ganha um segundo lugar de gravação.** Hoje ele grava só a
  proposta (`RN-SEC-35`). A regra é reescrita: grava a proposta e arquivos dentro
  da pasta de trabalho, e nada fora dela. Caminho com `..`, absoluto ou por link
  simbólico que saia da pasta é recusado.
- **A estrutura da pasta é fixa** (uma subpasta por Feature, o catálogo à parte),
  para a Fase poder ser derivada dos arquivos.

## Alternativas consideradas

- **Dentro da pasta do Perfil:** simples, mas escondida em `userData`, fora do
  alcance do git e da sincronização do PO.
- **Tudo em JSON nos Dados de trabalho:** o PO perderia o arquivo legível, e a IA
  trabalha melhor com Markdown.

## Consequências

- **Dois escritores na mesma pasta:** a IA (pelo servidor MCP) e o PO (no editor).
  A gravação é atômica e por arquivo; quem decide o conteúdo final é o PO, no
  checkpoint.
- **Pasta movida ou apagada** vira estado vazio que diz o que apontar de novo.
- **Conteúdo da pasta é dado da organização do PO.** Nada dela entra no
  repositório do app nem em Cenário.
