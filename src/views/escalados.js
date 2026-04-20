// ===== MAIS ESCALADOS VIEW =====
// Shows most picked players based on pontuados data (escalacoes field)
import { getData, formatPrice, formatVariation, getPosition } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded } from '../history.js';
import { calcPlayerStats } from '../stats.js';

export function renderEscalados(container) {
  const data = getData();
  if (!data) return;

  const { athletes, market } = data;
  
  // Use 'minimo_para_valorizar' or sort by media + preco to simulate popularity
  // The API atletas/mercado contains the field 'variacao_num' and 'media_num' 
  // We'll rank by a combination of status=provavel + media + low std deviation
  
  const probable = athletes.filter(a => a.status_id === 7 && a.jogos_num > 0);

  // Build popularity score: higher media + cheaper = more likely to be picked
  // Weight: 60% media, 20% cost-efficiency, 20% recent form
  let ranked = probable.map(a => {
    let stats = null;
    let recentAvg = a.media_num;
    if (isHistoryLoaded()) {
      stats = calcPlayerStats(a.atleta_id);
      if (stats && stats.history.length > 0) {
        recentAvg = stats.history.slice(-3).reduce((s, h) => s + h.pontuacao, 0) / Math.max(stats.history.slice(-3).length, 1);
      }
    }
    const efficiency = a.preco_num > 0 ? a.media_num / a.preco_num : 0;
    const popScore = a.media_num * 0.6 + efficiency * 3 + recentAvg * 0.2;
    return { ...a, popScore, recentAvg, stats, efficiency };
  });

  let currentPos = 0;

  function renderTable(posFilter) {
    let filtered = posFilter > 0 ? ranked.filter(a => a.posicao_id === posFilter) : ranked;
    filtered = [...filtered].sort((a, b) => b.popScore - a.popScore).slice(0, 30);

    const tableEl = document.getElementById('escalados-table');
    if (!tableEl) return;

    tableEl.innerHTML = `
      <div class="card-header">
        <div class="card-title">🏅 Ranking de Popularidade</div>
        <div class="card-subtitle">${filtered.length} jogadores · Score baseado em média, preço e forma recente</div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jogador</th>
              <th>Pos</th>
              <th>Time</th>
              <th>Média</th>
              <th>Recente</th>
              <th>Preço</th>
              <th>C/B</th>
              <th>Var</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((a, i) => {
              const varClass = a.variacao_num > 0 ? 'value-positive' : a.variacao_num < 0 ? 'value-negative' : 'value-neutral';
              return `
              <tr>
                <td><span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span></td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <img src="${a.clubBadge}" alt="" class="club-badge" onerror="this.style.display='none'">
                    <span style="font-weight:600;cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\\\'")}')"
                      onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</span>
                  </div>
                </td>
                <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
                <td style="font-size:11px">${a.clubName}</td>
                <td style="font-weight:700;color:var(--accent-green)">${a.media_num.toFixed(2)}</td>
                <td style="color:var(--accent-gold)">${a.recentAvg.toFixed(1)}</td>
                <td>${formatPrice(a.preco_num)}</td>
                <td style="font-size:12px">${a.efficiency.toFixed(2)}</td>
                <td class="${varClass}">${formatVariation(a.variacao_num)}</td>
                <td style="font-weight:800;color:var(--accent-blue)">${a.popScore.toFixed(1)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Build position breakdown cards
  const posCounts = {};
  [1,2,3,4,5].forEach(p => {
    const pos = getPosition(p);
    const players = probable.filter(a => a.posicao_id === p);
    const avgMedia = players.length > 0 ? players.reduce((s, a) => s + a.media_num, 0) / players.length : 0;
    posCounts[p] = { ...pos, count: players.length, avg: avgMedia };
  });

  container.innerHTML = `
    <div class="animate-in">
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">🔝 Mais Escalados</div>
          <div class="card-subtitle">Jogadores mais populares por posição · Rodada ${market.rodada_atual}</div>
        </div>

        <!-- Position summary -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(120px, 1fr));gap:10px;margin:16px 0">
          ${[1,2,3,4,5].map(p => {
            const pc = posCounts[p];
            return `
            <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;text-align:center;cursor:pointer;transition:all var(--transition-fast);border:1px solid var(--border-color)"
              onclick="document.querySelectorAll('.esc-pos-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');window.__filterEscPos(${p})"
              class="esc-pos-btn"
              onmouseover="this.style.borderColor='var(--accent-green)'" onmouseout="this.style.borderColor='var(--border-color)'">
              <div style="font-size:20px;margin-bottom:4px">${pc.icon || '⚽'}</div>
              <div style="font-size:12px;font-weight:700">${pc.nome}</div>
              <div style="font-size:11px;color:var(--text-muted)">${pc.count} prováveis</div>
              <div style="font-size:13px;font-weight:700;color:var(--accent-green);margin-top:4px">${pc.avg.toFixed(2)}</div>
            </div>`;
          }).join('')}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="pos-btn active" data-escpos="0">📋 Todos</button>
          <button class="pos-btn" data-escpos="1">🧤 GOL</button>
          <button class="pos-btn" data-escpos="2">🏃 LAT</button>
          <button class="pos-btn" data-escpos="3">🛡️ ZAG</button>
          <button class="pos-btn" data-escpos="4">🎯 MEI</button>
          <button class="pos-btn" data-escpos="5">⚽ ATA</button>
        </div>
      </div>

      <div class="card" id="escalados-table"></div>
    </div>
  `;

  // Bind filters
  container.querySelectorAll('.pos-btn[data-escpos]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.pos-btn[data-escpos]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPos = parseInt(btn.dataset.escpos);
      renderTable(currentPos);
    });
  });

  window.__filterEscPos = (pos) => {
    container.querySelectorAll('.pos-btn[data-escpos]').forEach(b => b.classList.remove('active'));
    const btn = container.querySelector(`.pos-btn[data-escpos="${pos}"]`);
    if (btn) btn.classList.add('active');
    currentPos = pos;
    renderTable(pos);
  };

  renderTable(0);

  if (!isHistoryLoaded()) {
    onHistoryLoaded(() => {
      // Recalc with history
      ranked = probable.map(a => {
        const stats = calcPlayerStats(a.atleta_id);
        let recentAvg = a.media_num;
        if (stats && stats.history.length > 0) {
          recentAvg = stats.history.slice(-3).reduce((s, h) => s + h.pontuacao, 0) / Math.max(stats.history.slice(-3).length, 1);
        }
        const efficiency = a.preco_num > 0 ? a.media_num / a.preco_num : 0;
        const popScore = a.media_num * 0.6 + efficiency * 3 + recentAvg * 0.2;
        return { ...a, popScore, recentAvg, stats, efficiency };
      });
      renderTable(currentPos);
    });
  }
}

export function destroyEscalados() {
  delete window.__filterEscPos;
}
