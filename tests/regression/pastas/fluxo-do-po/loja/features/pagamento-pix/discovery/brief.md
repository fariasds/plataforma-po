# Brief — Pagamento por Pix

Feature: #4102 · Produto: Loja Online · Atualizado: 2026-11-20

## 1. Problema
O cliente não consegue concluir a compra do jeito que precisa.

## 2. Para quem
Cliente da Loja Online.

## 3. Evidências
- Feedbacks do board da Loja

## 4. Como é hoje
Hoje a RN-PAG-012 trata só cartão e boleto. O limite por pedido vem da RN-PAG-099.

## 5. Objetivo e métrica
Converter quem hoje abandona no pagamento; meta: 20% menos abandono em 60 dias.

## 6. Escopo
- O fluxo principal da Loja

**Não-escopo**
- O App Mobile

## 7. Requisitos
- **R1** · O cliente conclui a compra no fluxo principal
  Decisões: D1 · RNs impactadas: RN-PAG-012 (altera)
- **R2** · O pedido segue sem intervenção manual
  Decisões: D1

## 9. Perguntas em aberto
- [x] **P1** · Vale para o app? — **Respondida:** não.
- [ ] **P2** · O QR expira em quanto tempo? — `bloqueia a quebra`
- [ ] **P3** · Estorno parcial? — `não bloqueia`
