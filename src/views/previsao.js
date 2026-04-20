// ===== PREVISÃO DE GOLS VIEW =====
// Predicts goal outcomes for next round using weighted historical stats
import { getData, fetchMatchesByRound } from '../api.js';
import { isHistoryLoaded, onHistoryLoaded, getClubMatches } from '../history.js';
import { calcClubStats } from '../stats.js';

export async function renderPrevisao(container) {
  const data = getData();
  if (!data) return;

  const { market, clubs } = data;
  const currentRound = market.rodada_atual;

  container.innerHTML = `
    <div class="animate-in">
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">🎯 Previsão de Gols</div>
          <div class="card-subtitle">Análise estatística dos confrontos com peso para jogos recentes</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap">
          <label style="font-size:13px;font-weight:600;color:var(--text-secondary)">Rodada:</label>
          <select id="prev-round-select" class="round-select">
            ${Array.from({ length: market.rodada_final || 38 }, (_, i) => i + 1).map(r =>
              `<option value="${r}" ${r === currentRound ? 'selected' : ''}>Rodada ${r}${r === currentRound ? ' (atual)' : ''}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div id="prev-content">
        ${isHistoryLoaded() ? '' : `
          <div class="card" style="text-align:center;padding:40px">
            <div class="loading-spinner" style="margin:0 auto 12px"></div>
            <p style="color:var(--text-secondary)">Carregando dados históricos para análise...</p>
          </div>
        `}
      </div>
    </div>
  `;

  document.getElementById('prev-round-select').addEventListener('change', (e) => {
    loadPredictions(parseInt(e.target.value), clubs);
  });

  if (isHistoryLoaded()) {
    await loadPredictions(currentRound, clubs);
  } else {
    onHistoryLoaded(() => loadPredictions(currentRound, clubs));
  }
}

// Weighted stats: recent matches get higher weight
function calcWeightedStats(clubId) {
  const matches = getClubMatches(clubId);
  if (!matches || matches.length === 0) return null;

  const totalMatches = matches.length;
  let totalW = 0;
  let wGM = 0, wGS = 0, wGMCasa = 0, wGSCasa = 0, wGMFora = 0, wGSFora = 0;
  let jogos = 0, jogosCasa = 0, jogosFora = 0;
  let jcgm = 0, jcgs = 0, jcgmCasa = 0, jcgsCasa = 0, jcgmFora = 0, jcgsFora = 0;
  let wJcgm = 0, wJcgs = 0, wJcgmCasa = 0, wJcgsCasa = 0, wJcgmFora = 0, wJcgsFora = 0;

  matches.forEach((m, idx) => {
    // Weight: more recent = higher weight (linear, last gets 2x first)
    const weight = 1 + (idx / Math.max(totalMatches - 1, 1));
    totalW += weight;
    jogos++;

    wGM += m.goalsFor * weight;
    wGS += m.goalsAgainst * weight;
    if (m.goalsFor > 0) { jcgm++; wJcgm += weight; }
    if (m.goalsAgainst > 0) { jcgs++; wJcgs += weight; }

    if (m.isHome) {
      jogosCasa++;
      wGMCasa += m.goalsFor * weight;
      wGSCasa += m.goalsAgainst * weight;
      if (m.goalsFor > 0) { jcgmCasa++; wJcgmCasa += weight; }
      if (m.goalsAgainst > 0) { jcgsCasa++; wJcgsCasa += weight; }
    } else {
      jogosFora++;
      wGMFora += m.goalsFor * weight;
      wGSFora += m.goalsAgainst * weight;
      if (m.goalsFor > 0) { jcgmFora++; wJcgmFora += weight; }
      if (m.goalsAgainst > 0) { jcgsFora++; wJcgsFora += weight; }
    }
  });

  const basicStats = calcClubStats(clubId);
  const forma = basicStats?.forma || [];

  return {
    jogos, jogosCasa, jogosFora,
    // Weighted averages
    mediaGM: totalW > 0 ? wGM / totalW : 0,
    mediaGS: totalW > 0 ? wGS / totalW : 0,
    mediaGMCasa: jogosCasa > 0 ? wGMCasa / (matches.filter(m => m.isHome).reduce((s, m, i) => s + 1 + (matches.indexOf(m) / Math.max(totalMatches - 1, 1)), 0) || 1) : 0,
    mediaGSCasa: jogosCasa > 0 ? wGSCasa / (matches.filter(m => m.isHome).reduce((s, m, i) => s + 1 + (matches.indexOf(m) / Math.max(totalMatches - 1, 1)), 0) || 1) : 0,
    mediaGMFora: jogosFora > 0 ? wGMFora / (matches.filter(m => !m.isHome).reduce((s, m, i) => s + 1 + (matches.indexOf(m) / Math.max(totalMatches - 1, 1)), 0) || 1) : 0,
    mediaGSFora: jogosFora > 0 ? wGSFora / (matches.filter(m => !m.isHome).reduce((s, m, i) => s + 1 + (matches.indexOf(m) / Math.max(totalMatches - 1, 1)), 0) || 1) : 0,
    // Simple averages for display
    avgGM: jogos > 0 ? matches.reduce((s, m) => s + m.goalsFor, 0) / jogos : 0,
    avgGS: jogos > 0 ? matches.reduce((s, m) => s + m.goalsAgainst, 0) / jogos : 0,
    avgGMCasa: jogosCasa > 0 ? matches.filter(m => m.isHome).reduce((s, m) => s + m.goalsFor, 0) / jogosCasa : 0,
    avgGSCasa: jogosCasa > 0 ? matches.filter(m => m.isHome).reduce((s, m) => s + m.goalsAgainst, 0) / jogosCasa : 0,
    avgGMFora: jogosFora > 0 ? matches.filter(m => !m.isHome).reduce((s, m) => s + m.goalsFor, 0) / jogosFora : 0,
    avgGSFora: jogosFora > 0 ? matches.filter(m => !m.isHome).reduce((s, m) => s + m.goalsAgainst, 0) / jogosFora : 0,
    // Percentages
    pctGM: jogos > 0 ? jcgm / jogos : 0,
    pctGS: jogos > 0 ? jcgs / jogos : 0,
    pctGMCasa: jogosCasa > 0 ? jcgmCasa / jogosCasa : 0,
    pctGSCasa: jogosCasa > 0 ? jcgsCasa / jogosCasa : 0,
    pctGMFora: jogosFora > 0 ? jcgmFora / jogosFora : 0,
    pctGSFora: jogosFora > 0 ? jcgsFora / jogosFora : 0,
    forma,
    totalGM: matches.reduce((s, m) => s + m.goalsFor, 0),
    totalGS: matches.reduce((s, m) => s + m.goalsAgainst, 0),
  };
}

async function loadPredictions(round, clubs) {
  const content = document.getElementById('prev-content');
  if (!content) return;

  content.innerHTML = `
    <div style="text-align:center;padding:30px">
      <div class="loading-spinner" style="margin:0 auto 8px"></div>
      <span style="color:var(--text-muted);font-size:12px">Carregando confrontos da Rodada ${round}...</span>
    </div>
  `;

  try {
    const matchData = await fetchMatchesByRound(round);
    const matches = matchData.partidas || [];
    const clubsMap = matchData.clubes || {};

    if (matches.length === 0) {
      content.innerHTML = `<div class="card" style="text-align:center;padding:40px"><p style="color:var(--text-muted)">Nenhum jogo definido para esta rodada</p></div>`;
      return;
    }

    // Build predictions for each match
    const predictions = matches.map(m => {
      const homeId = m.clube_casa_id;
      const awayId = m.clube_visitante_id;
      const homeClub = clubsMap[homeId] || clubs[homeId] || {};
      const awayClub = clubsMap[awayId] || clubs[awayId] || {};

      const homeStats = calcWeightedStats(homeId);
      const awayStats = calcWeightedStats(awayId);

      let predictedHome = '-', predictedAway = '-', totalExpected = '-';
      let homeAttack = 0, homeDefense = 0, awayAttack = 0, awayDefense = 0;
      let confidence = 'low';

      if (homeStats && awayStats) {
        // Predicted goals: avg of (home attack at home + away defense away) and vice versa
        homeAttack = homeStats.mediaGMCasa || homeStats.mediaGM;
        awayDefense = awayStats.mediaGSFora || awayStats.mediaGS;
        awayAttack = awayStats.mediaGMFora || awayStats.mediaGM;
        homeDefense = homeStats.mediaGSCasa || homeStats.mediaGS;

        const expHome = (homeAttack + awayDefense) / 2;
        const expAway = (awayAttack + homeDefense) / 2;

        predictedHome = expHome.toFixed(1);
        predictedAway = expAway.toFixed(1);
        totalExpected = (expHome + expAway).toFixed(1);

        const minGames = Math.min(homeStats.jogos, awayStats.jogos);
        confidence = minGames >= 8 ? 'high' : minGames >= 4 ? 'medium' : 'low';
      }

      return {
        homeClub, awayClub, homeId, awayId,
        homeStats, awayStats,
        predictedHome, predictedAway, totalExpected,
        homeAttack, homeDefense, awayAttack, awayDefense,
        confidence,
        isFinished: m.valida === true || m.periodo_tr === 'POS_JOGO',
        actualHome: m.placar_oficial_mandante,
        actualAway: m.placar_oficial_visitante,
      };
    });

    content.innerHTML = `
      <!-- Summary -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">📊 Resumo da Rodada ${round}</div>
          <div class="card-subtitle">Previsões baseadas em médias ponderadas · Pesos maiores para jogos recentes</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:4px;margin-top:12px;font-size:10px;color:var(--text-muted)">
          <span>🟢 Confiança Alta = 8+ jogos</span>
          <span>🟡 Confiança Média = 4-7 jogos</span>
          <span>🔴 Confiança Baixa = &lt;4 jogos</span>
        </div>
      </div>

      <!-- Match Predictions -->
      ${predictions.map(p => renderPredictionCard(p)).join('')}
    `;
  } catch (e) {
    content.innerHTML = `<div class="card" style="text-align:center;padding:30px"><p style="color:var(--accent-red)">Erro: ${e.message}</p></div>`;
  }
}

function renderPredictionCard(p) {
  const pct = (v) => `${(v * 100).toFixed(0)}%`;
  const confColor = p.confidence === 'high' ? 'var(--accent-green)' : p.confidence === 'medium' ? 'var(--accent-orange)' : 'var(--accent-red)';
  const confIcon = p.confidence === 'high' ? '🟢' : p.confidence === 'medium' ? '🟡' : '🔴';
  const confLabel = p.confidence === 'high' ? 'Alta' : p.confidence === 'medium' ? 'Média' : 'Baixa';

  const homeBadge = p.homeClub.escudos?.['45x45'] || p.homeClub.escudos?.['30x30'] || '';
  const awayBadge = p.awayClub.escudos?.['45x45'] || p.awayClub.escudos?.['30x30'] || '';
  const homeName = p.homeClub.nome_fantasia || p.homeClub.nome || '???';
  const awayName = p.awayClub.nome_fantasia || p.awayClub.nome || '???';

  const formBadge = (f) => {
    const bg = f === 'V' ? 'var(--accent-green-dim)' : f === 'D' ? 'var(--accent-red-dim)' : 'var(--accent-orange-dim)';
    const color = f === 'V' ? 'var(--accent-green)' : f === 'D' ? 'var(--accent-red)' : 'var(--accent-orange)';
    return `<span style="width:18px;height:18px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;background:${bg};color:${color}">${f}</span>`;
  };

  const homeForm = (p.homeStats?.forma || []).slice(-5);
  const awayForm = (p.awayStats?.forma || []).slice(-5);

  return `
    <div class="card" style="margin-bottom:16px">
      <!-- Header: Team names + predicted score -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="flex:1;text-align:center">
          <img src="${homeBadge}" alt="" style="width:48px;height:48px;display:block;margin:0 auto 6px" onerror="this.style.display='none'">
          <div style="font-weight:700;font-size:15px">${homeName}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">🏠 Em Casa</div>
          <div style="display:flex;gap:2px;justify-content:center;margin-top:4px">${homeForm.map(formBadge).join('')}</div>
        </div>
        <div style="text-align:center;padding:0 16px">
          ${p.isFinished ? `
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:2px">RESULTADO</div>
            <div style="font-size:28px;font-weight:900">${p.actualHome} x ${p.actualAway}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Previsto: ${p.predictedHome} x ${p.predictedAway}</div>
          ` : `
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:2px">PREVISÃO</div>
            <div style="font-size:32px;font-weight:900;color:var(--accent-gold)">${p.predictedHome} x ${p.predictedAway}</div>
            <div style="font-size:11px;margin-top:4px;color:${confColor};font-weight:600">${confIcon} Confiança ${confLabel}</div>
          `}
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Total esperado: <strong>${p.totalExpected}</strong> gols</div>
        </div>
        <div style="flex:1;text-align:center">
          <img src="${awayBadge}" alt="" style="width:48px;height:48px;display:block;margin:0 auto 6px" onerror="this.style.display='none'">
          <div style="font-weight:700;font-size:15px">${awayName}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">✈️ Fora</div>
          <div style="display:flex;gap:2px;justify-content:center;margin-top:4px">${awayForm.map(formBadge).join('')}</div>
        </div>
      </div>

      ${p.homeStats && p.awayStats ? `
      <!-- Detailed stats comparison -->
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0;font-size:12px;border-top:1px solid var(--border-color);padding-top:12px">
        ${statRow(p.homeStats.avgGM.toFixed(2), 'Média GM (Total)', p.awayStats.avgGM.toFixed(2))}
        ${statRow(p.homeStats.avgGS.toFixed(2), 'Média GS (Total)', p.awayStats.avgGS.toFixed(2))}
        ${statRow(p.homeStats.avgGMCasa.toFixed(2), '🏠 GM Casa / ✈️ GM Fora', p.awayStats.avgGMFora.toFixed(2))}
        ${statRow(p.homeStats.avgGSCasa.toFixed(2), '🏠 GS Casa / ✈️ GS Fora', p.awayStats.avgGSFora.toFixed(2))}
        ${statRow(pct(p.homeStats.pctGM), '%JCGM Total', pct(p.awayStats.pctGM))}
        ${statRow(pct(p.homeStats.pctGS), '%JCGS Total', pct(p.awayStats.pctGS))}
        ${statRow(pct(p.homeStats.pctGMCasa), '🏠%JCGM / ✈️%JCGM', pct(p.awayStats.pctGMFora))}
        ${statRow(pct(p.homeStats.pctGSCasa), '🏠%JCGS / ✈️%JCGS', pct(p.awayStats.pctGSFora))}
        ${statRow(p.homeStats.jogos, 'Jogos', p.awayStats.jogos)}
      </div>
      ` : '<p style="color:var(--text-muted);text-align:center;font-size:12px;margin-top:12px">Dados insuficientes para análise</p>'}
    </div>
  `;
}

function statRow(left, label, right) {
  const leftNum = parseFloat(left);
  const rightNum = parseFloat(right);
  const leftBold = !isNaN(leftNum) && !isNaN(rightNum) && leftNum > rightNum;
  const rightBold = !isNaN(leftNum) && !isNaN(rightNum) && rightNum > leftNum;
  return `
    <div style="text-align:right;padding:5px 10px;${leftBold ? 'color:var(--accent-green);font-weight:700' : 'color:var(--text-secondary)'}">${left}</div>
    <div style="text-align:center;padding:5px 8px;color:var(--text-muted);font-size:10px;white-space:nowrap;border-left:1px solid var(--border-color);border-right:1px solid var(--border-color)">${label}</div>
    <div style="text-align:left;padding:5px 10px;${rightBold ? 'color:var(--accent-green);font-weight:700' : 'color:var(--text-secondary)'}">${right}</div>
  `;
}

export function destroyPrevisao() {}
