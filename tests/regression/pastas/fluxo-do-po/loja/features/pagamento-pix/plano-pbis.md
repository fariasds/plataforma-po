# Plano de PBIs — Pagamento por Pix

## PBIs

### P1 · DEV · Gerar o QR Code Pix no checkout
Azure: #4211 · Status: Escrito · Arquivo: `PBI-4211-qr-pix.md`
Requisitos: R1 · Decisões: D1 · Depende de: —

### P2 · DEV · Confirmar o pagamento Pix e liberar o pedido
Azure: #4212 · Status: Planejado · Arquivo: —
Requisitos: R2 · Decisões: D1 · Depende de: P1

### P3 · DEV · Expirar o pedido quando o Pix não é pago no prazo
Azure: #a criar · Status: Planejado · Arquivo: —
Requisitos: R2 · Decisões: D2

### P4 · DESIGN · Cliente não sabe quanto tempo tem para pagar o Pix — checkout
Azure: #a criar · Status: Planejado · Arquivo: —
Requisitos: R1 · Decisões: D2

## Cobertura Requisito → PBI
| Requisito | PBI(s) | Observação |
|---|---|---|
| R1 | P1, P4 | |
| R2 | P2, P3 | |
