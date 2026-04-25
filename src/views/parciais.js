// ===== PARCIAIS VIEW =====
// Live/partial scores for current round
import { getData, fetchScored, getPosition, formatPrice } from '../api.js';

let refreshInterval = null;

export async function renderParciais(container) {
  const data = getData();
  if (!data) return;

  const { market } = data;
  const round = market.rodada_atual;

  container.innerHTML = `
    <div class="animate-in">
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">📡 Parciais da Rodada ${round}</div>
          <div class="card-subtitle" id="parciais-update-time">Carregando...</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="pos-btn active" data-posfilter="0" id="parc-filter-all">📋 Todos</button>
          <button class="pos-btn" data-posfilter="1">🧤 GOL</button>
          <button class="pos-btn" data-posfilter="2">🏃 LAT</button>
          <button class="pos-btn" data-posfilter="3">🛡️ ZAG</button>
          <button class="pos-btn" data-posfilter="4">🎯 MEI</button>
          <button class="pos-btn" data-posfilter="5">⚽ ATA</button>
          <button class="pos-btn" data-posfilter="6">📋 TEC</button>
        </div>

        <!-- Scout Legend (inline) -->
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-color)">
          <div style="font-weight:700;font-size:12px;color:var(--text-secondary);margin-bottom:8px">📖 Legenda dos Scouts</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:6px">
            <div class="scout-legend-item"><span class="scout-icon positive">⚽</span><span><strong>G</strong> — Gol</span><span class="scout-pts positive">+8.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon positive">🅰️</span><span><strong>A</strong> — Assistência</span><span class="scout-pts positive">+5.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon positive">🧤</span><span><strong>SG</strong> — Jogo Sem Gol</span><span class="scout-pts positive">+5.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon positive">🧱</span><span><strong>DE</strong> — Defesa</span><span class="scout-pts positive">+1.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon positive">💪</span><span><strong>DS</strong> — Desarme</span><span class="scout-pts positive">+1.2</span></div>
            <div class="scout-legend-item"><span class="scout-icon positive">🎯</span><span><strong>FD</strong> — Final. Defendida</span><span class="scout-pts positive">+1.2</span></div>
            <div class="scout-legend-item"><span class="scout-icon positive">🦶</span><span><strong>FS</strong> — Falta Sofrida</span><span class="scout-pts positive">+0.5</span></div>
            <div class="scout-legend-item"><span class="scout-icon positive">🏆</span><span><strong>V</strong> — Vitória (Téc.)</span><span class="scout-pts positive">+1.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon positive">🥅</span><span><strong>PE</strong> — Pênalti</span><span class="scout-pts positive">+7.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon negative">🟨</span><span><strong>CA</strong> — Cartão Amarelo</span><span class="scout-pts negative">-1.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon negative">🟥</span><span><strong>CV</strong> — Cartão Vermelho</span><span class="scout-pts negative">-3.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon negative">😰</span><span><strong>GS</strong> — Gol Sofrido</span><span class="scout-pts negative">-1.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon negative">❌</span><span><strong>GC</strong> — Gol Contra</span><span class="scout-pts negative">-3.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon negative">🏳️</span><span><strong>FC</strong> — Falta Cometida</span><span class="scout-pts negative">-0.3</span></div>
            <div class="scout-legend-item"><span class="scout-icon negative">🚫</span><span><strong>PP</strong> — Pênalti Perdido</span><span class="scout-pts negative">-4.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon neutral">📐</span><span><strong>FF</strong> — Final. Pra Fora</span><span class="scout-pts neutral">+0.8</span></div>
            <div class="scout-legend-item"><span class="scout-icon neutral">🪵</span><span><strong>FT</strong> — Final. na Trave</span><span class="scout-pts neutral">+3.0</span></div>
            <div class="scout-legend-item"><span class="scout-icon neutral">🏳️‍⬛</span><span><strong>I</strong> — Impedimento</span><span class="scout-pts negative">-0.1</span></div>
          </div>
        </div>
      </div>

      <!-- Scored Players Table -->
      <div class="card" id="parciais-table">
        <div style="text-align:center;padding:30px">
          <div class="loading-spinner" style="margin:0 auto 8px"></div>
          <span style="color:var(--text-muted);font-size:12px">Carregando pontuações...</span>
        </div>
      </div>
    </div>
  `;

  // Position filter handlers
  container.querySelectorAll('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderScoredTable(parseInt(btn.dataset.posfilter));
    });
  });

  await loadParciais(round);
}

let _scoredData = null;
let _matchesData = null;
let _clubsMap = null;

async function loadParciais(round) {
  try {
    const scored = await fetchScored();

    _scoredData = scored;

    const updateEl = document.getElementById('parciais-update-time');
    if (updateEl) updateEl.textContent = `Atualizado: ${new Date().toLocaleTimeString('pt-BR')}`;

    renderScoredTable(0);
  } catch (e) {
    console.error('Erro ao carregar parciais:', e);
  }
}



function renderScoredTable(posFilter) {
  const container = document.getElementById('parciais-table');
  if (!container || !_scoredData) return;

  const data = getData();
  const atletas = _scoredData.atletas || {};

  // Build rows: merge scored data with athlete data
  let rows = Object.entries(atletas).map(([id, scored]) => {
    const athlete = data?.athletes?.find(a => a.atleta_id === parseInt(id));
    const pos = getPosition(scored.posicao_id);
    return {
      id: parseInt(id),
      apelido: scored.apelido || athlete?.apelido || `#${id}`,
      clubName: athlete?.clubName || _clubsMap[scored.clube_id]?.nome_fantasia || '',
      clubBadge: athlete?.clubBadge || _clubsMap[scored.clube_id]?.escudos?.['30x30'] || '',
      posicao_id: scored.posicao_id,
      position: pos,
      pontuacao: scored.pontuacao || 0,
      scout: scored.scout || {},
      entrou: scored.entrou_em_campo,
    };
  });

  // Filter by position
  if (posFilter > 0) {
    rows = rows.filter(r => r.posicao_id === posFilter);
  }

  // Sort by score descending
  rows.sort((a, b) => b.pontuacao - a.pontuacao);

  const total = rows.length;
  const avgPts = total > 0 ? rows.reduce((s, r) => s + r.pontuacao, 0) / total : 0;

  // Build scout summary for each row
  function scoutSummary(scout) {
    const parts = [];
    if (scout.G) parts.push(`⚽${scout.G}`);
    if (scout.A) parts.push(`🅰️${scout.A}`);
    if (scout.SG) parts.push(`🧤${scout.SG}`);
    if (scout.DE) parts.push(`🧱${scout.DE}`);
    if (scout.DS) parts.push(`💪${scout.DS}`);
    if (scout.CA) parts.push(`🟨${scout.CA}`);
    if (scout.CV) parts.push(`🟥${scout.CV}`);
    if (scout.GC) parts.push(`❌${scout.GC}`);
    if (scout.GS) parts.push(`😰${scout.GS}`);
    return parts.join(' ') || '-';
  }

  container.innerHTML = `
    <div class="card-header">
      <div class="card-title">📊 Pontuações (${total} jogadores)</div>
      <div class="card-subtitle">Média: ${avgPts.toFixed(2)} pts</div>
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>Pos</th>
            <th>Time</th>
            <th>Pts</th>
            <th>Scouts</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 50).map((r, i) => {
            const ptsClass = r.pontuacao > 0 ? 'value-positive' : r.pontuacao < 0 ? 'value-negative' : 'value-neutral';
            return `
            <tr>
              <td><span class="player-list-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span></td>
              <td>
                <span style="font-weight:600;cursor:pointer" onclick="window.__openPlayerProfile && window.__openPlayerProfile(${r.id}, '${r.apelido.replace(/'/g, "\\'")}')"
                  onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${r.apelido}</span>
              </td>
              <td><span class="position-badge ${r.position.class}">${r.position.abr}</span></td>
              <td>
                <div style="display:flex;align-items:center;gap:4px">
                  <img src="${r.clubBadge}" alt="" class="club-badge" onerror="this.style.display='none'">
                  <span style="font-size:11px">${r.clubName}</span>
                </div>
              </td>
              <td style="font-weight:800;font-size:15px" class="${ptsClass}">${r.pontuacao.toFixed(1)}</td>
              <td style="font-size:11px;white-space:nowrap">${scoutSummary(r.scout)}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
    ${rows.length > 50 ? `<p style="text-align:center;color:var(--text-muted);font-size:11px;margin-top:8px">Mostrando top 50 de ${rows.length}</p>` : ''}
  `;
}

export function destroyParciais() {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  _scoredData = null;
}
