# Apuração ao vivo — 2º turno presidencial 2026

Painel em tempo real (Lula × Flávio Bolsonaro) com mapa por estado, votos, % de seções apuradas,
comparecimento e tabela por UF. Os dados vêm direto do TSE (`resultados.tse.jus.br`).

## Como rodar

    npm start        # ou: node server.js

Abra http://localhost:3000. Requer Node 18+ (sem dependências).

- O servidor busca no TSE a cada 10 s (Brasil + 27 UFs + exterior); o navegador consulta o servidor a cada 5 s.
- Mapa: vermelho = Lula na frente, azul = Flávio na frente; o tom fica mais forte conforme a vantagem cresce.
- Outra eleição: `ELEICAO=6258 CICLO=ele2026 node server.js` (códigos em `/oficial/comum/config/ele-c.json`).

---

Feito por [Gabriel Andrade](https://gabandrade.dev).
