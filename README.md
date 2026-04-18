# 🏆 PROJETO CARTOLA

Aplicação web de análise avançada para o **Cartola FC 2026**.

## Funcionalidades

- **Dashboard** — Visão geral da rodada com countdown e top jogadores
- **Jogadores** — Tabela completa com filtros (posição, time, status, busca)
- **Perfil Individual** — Gráfico de evolução, scouts por rodada, consistência, MPV
- **Times** — GM/GS por mando (casa/fora), %JCGM/%JCGS, forma recente, gráfico de gols
- **Comparar** — Filtro Casa/Fora/Total com métricas históricas e gráfico radar
- **Recomendações** — 6 abas de estratégia:
  - 🔥 Mitar — jogadores com maior chance de pontuar alto
  - 📈 Valorizar — baratos com potencial de valorização (Time Tio Patinhas)
  - 💰 Custo-benefício — por posição (pts/C$)
  - 💎 Pérolas — baratos com boa média
  - 🎯 Consistentes — regulares vs dente de serra
  - ⛔ Evitar — lesionados, suspensos e em queda

## Stack

- **Vite** + **Vanilla JS/CSS**
- **Chart.js** para gráficos
- API pública do **Cartola FC** (via proxy CORS no Vite)

## Como usar

```bash
npm install
npm run dev
# Abrir http://localhost:5173
```

## Dados

Todos os dados são carregados da API oficial do Cartola FC:
- `/atletas/mercado` — dados atuais dos jogadores
- `/atletas/pontuados/{rodada}` — histórico por rodada
- `/partidas/{rodada}` — jogos e resultados
- `/mercado/status` — status da rodada

O histórico carrega em background com cache no `sessionStorage`.
