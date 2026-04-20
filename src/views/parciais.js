// ===== PARCIAIS VIEW =====
// Live/partial scores for current round
import { getData, fetchScored, fetchMatchesByRound, getPosition, formatPrice } from '../api.js';

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
      </div>

      <!-- Matches Summary -->
      <div id="parciais-matches" class="card" style="margin-bottom:20px">
        <div style="text-align:center;padding:20px">
          <div class="loading-spinner" style="margin:0 auto 8px"></div>
          <span style="color:var(--text-muted);font-size:12px">Carregando jogos...</span>
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
    const [scored, matches] = await Promise.all([
      fetchScored(),
      fetchMatchesByRound(round),
    ]);

    _scoredData = scored;
    _matchesData = matches;
    _clubsMap = matches.clubes || {};

    const updateEl = document.getElementById('parciais-update-time');
    if (updateEl) updateEl.textContent = `Atualizado: ${new Date().toLocaleTimeString('pt-BR')}`;

    renderMatchesSummary();
    renderScoredTable(0);
  } catch (e) {
    console.error('Erro ao carregar parciais:', e);
  }
}

function renderMatchesSummary() {
  const container = document.getElementById('parciais-matches');
  if (!container || !_matchesData) return;

  const matches = _matchesData.partidas || [];

  container.innerHTML = `
    <div class="card-header">
      <div class="card-title">🏟️ Jogos da Rodada</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:12px;margin-top:12px">
      ${matches.map(m => {
        const home = _clubsMap[m.clube_casa_id];
        const away = _clubsMap[m.clube_visitante_id];
        const homeName = home?.nome_fantasia || home?.nome || '???';
        const awayName = away?.nome_fantasia || away?.nome || '???';
        const homeBadge = home?.escudos?.['30x30'] || '';
        const awayBadge = away?.escudos?.['30x30'] || '';
        
        const isLive = m.periodo_tr === 'JOGO' || m.status_transmissao_tr === 'EM_ANDAMENTO';
        const isFinished = m.periodo_tr === 'POS_JOGO';
        const statusLabel = isLive ? '🔴 AO VIVO' : isFinished ? '✅ Encerrado' : '⏳ Aguardando';
        const statusColor = isLive ? 'var(--accent-red)' : isFinished ? 'var(--accent-green)' : 'var(--text-muted)';

        return `
        <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;border:1px solid var(--border-color)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:10px;color:${statusColor};font-weight:700">${statusLabel}</span>
            <span style="font-size:10px;color:var(--text-muted)">${m.local || ''}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:6px;flex:1">
              <img src="${homeBadge}" alt="" style="width:24px;height:24px" onerror="this.style.display='none'">
              <span style="font-size:13px;font-weight:600">${homeName}</span>
            </div>
            <div style="font-size:18px;font-weight:800;padding:0 12px;min-width:50px;text-align:center">
              ${m.placar_oficial_mandante ?? '-'} x ${m.placar_oficial_visitante ?? '-'}
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex:1;justify-content:flex-end">
              <span style="font-size:13px;font-weight:600">${awayName}</span>
              <img src="${awayBadge}" alt="" style="width:24px;height:24px" onerror="this.style.display='none'">
            </div>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  `;
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
  _matchesData = null;
  _clubsMap = null;
}
