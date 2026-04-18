// ===== PLAYERS VIEW =====
import { getData, getPosition, getStatus, getScoutLabel, formatPrice, formatVariation } from '../api.js';

let currentSort = { key: 'media_num', dir: 'desc' };
let currentFilters = { position: '', club: '', status: '', search: '' };
let currentPage = 1;
const PAGE_SIZE = 25;

export function renderPlayers(container) {
  const data = getData();
  if (!data) return;

  const { athletes, clubs } = data;
  const clubList = Object.values(clubs).sort((a, b) => a.nome_fantasia.localeCompare(b.nome_fantasia));

  container.innerHTML = `
    <div class="animate-in">
      <!-- Filters -->
      <div class="filters-bar">
        <div class="filter-group">
          <span class="filter-search-icon">🔍</span>
          <input type="text" class="filter-input" id="filter-search" placeholder="Buscar jogador..." />
        </div>
        <select class="filter-select" id="filter-position">
          <option value="">Todas Posições</option>
          <option value="1">Goleiro</option>
          <option value="2">Lateral</option>
          <option value="3">Zagueiro</option>
          <option value="4">Meia</option>
          <option value="5">Atacante</option>
          <option value="6">Técnico</option>
        </select>
        <select class="filter-select" id="filter-club">
          <option value="">Todos os Times</option>
          ${clubList.map(c => `<option value="${c.id}">${c.nome_fantasia}</option>`).join('')}
        </select>
        <select class="filter-select" id="filter-status">
          <option value="">Todos os Status</option>
          <option value="7">Provável</option>
          <option value="2">Dúvida</option>
          <option value="3">Suspenso</option>
          <option value="5">Contundido</option>
          <option value="6">Nulo</option>
        </select>
      </div>

      <!-- Results count -->
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px" id="results-count"></div>

      <!-- Table -->
      <div class="table-container" id="players-table-container">
        <!-- Table rendered by updateTable -->
      </div>

      <!-- Pagination -->
      <div class="pagination" id="pagination"></div>
    </div>
  `;

  // Listen for filter changes
  document.getElementById('filter-search').addEventListener('input', (e) => {
    currentFilters.search = e.target.value.toLowerCase();
    currentPage = 1;
    updateTable();
  });
  document.getElementById('filter-position').addEventListener('change', (e) => {
    currentFilters.position = e.target.value;
    currentPage = 1;
    updateTable();
  });
  document.getElementById('filter-club').addEventListener('change', (e) => {
    currentFilters.club = e.target.value;
    currentPage = 1;
    updateTable();
  });
  document.getElementById('filter-status').addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    currentPage = 1;
    updateTable();
  });

  updateTable();
}

function getFilteredAthletes() {
  const data = getData();
  if (!data) return [];

  let athletes = [...data.athletes];

  // Filter
  if (currentFilters.search) {
    athletes = athletes.filter(a =>
      a.apelido.toLowerCase().includes(currentFilters.search) ||
      a.nome.toLowerCase().includes(currentFilters.search)
    );
  }
  if (currentFilters.position) {
    athletes = athletes.filter(a => a.posicao_id === parseInt(currentFilters.position));
  }
  if (currentFilters.club) {
    athletes = athletes.filter(a => a.clube_id === parseInt(currentFilters.club));
  }
  if (currentFilters.status) {
    athletes = athletes.filter(a => a.status_id === parseInt(currentFilters.status));
  }

  // Sort
  athletes.sort((a, b) => {
    let va = a[currentSort.key];
    let vb = b[currentSort.key];
    if (typeof va === 'string') {
      va = va.toLowerCase();
      vb = vb.toLowerCase();
    }
    if (currentSort.dir === 'asc') return va > vb ? 1 : -1;
    return va < vb ? 1 : -1;
  });

  return athletes;
}

function updateTable() {
  const athletes = getFilteredAthletes();
  const totalPages = Math.ceil(athletes.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageAthletes = athletes.slice(start, start + PAGE_SIZE);

  // Results count
  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = `${athletes.length} jogadores encontrados`;

  // Table
  const tableContainer = document.getElementById('players-table-container');
  if (!tableContainer) return;

  const columns = [
    { key: 'apelido', label: 'Jogador', sortable: true },
    { key: 'posicao_id', label: 'Pos', sortable: true },
    { key: 'clube_id', label: 'Time', sortable: false },
    { key: 'status_id', label: 'Status', sortable: true },
    { key: 'pontos_num', label: 'Pts', sortable: true },
    { key: 'media_num', label: 'Média', sortable: true },
    { key: 'preco_num', label: 'Preço', sortable: true },
    { key: 'variacao_num', label: 'Var.', sortable: true },
    { key: 'jogos_num', label: 'Jogos', sortable: true },
  ];

  tableContainer.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          ${columns.map(col => `
            <th class="${currentSort.key === col.key ? 'sorted' : ''}" 
                ${col.sortable ? `onclick="window.__sortPlayers('${col.key}')"` : ''}
                style="${col.sortable ? 'cursor:pointer' : 'cursor:default'}">
              ${col.label}
              ${col.sortable ? `<span class="sort-arrow">${currentSort.key === col.key ? (currentSort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>` : ''}
            </th>
          `).join('')}
          <th style="width:40px"></th>
        </tr>
      </thead>
      <tbody>
        ${pageAthletes.map(a => renderPlayerRow(a)).join('')}
      </tbody>
    </table>
  `;

  // Pagination
  renderPagination(totalPages, athletes.length);

  // Register sort handler
  window.__sortPlayers = (key) => {
    if (currentSort.key === key) {
      currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort.key = key;
      currentSort.dir = 'desc';
    }
    updateTable();
  };

  // Register expand handler
  window.__toggleScout = (id) => {
    const row = document.getElementById(`scout-${id}`);
    if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
  };
}

function renderPlayerRow(a) {
  const varClass = a.variacao_num > 0 ? 'value-positive' : a.variacao_num < 0 ? 'value-negative' : 'value-neutral';
  const ptsClass = a.pontos_num > 0 ? 'value-positive' : a.pontos_num < 0 ? 'value-negative' : 'value-neutral';

  const scoutEntries = Object.entries(a.scout || {});

  return `
    <tr>
      <td>
        <div class="player-info">
          <img src="${a.clubBadge60 || a.clubBadge}" alt="" class="player-photo" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 36 36%22><rect fill=%22%231a2234%22 width=%2236%22 height=%2236%22 rx=%2218%22/><text x=%2218%22 y=%2224%22 font-size=%2218%22 text-anchor=%22middle%22 fill=%22%235a6577%22>⚽</text></svg>'">
          <div>
            <div class="player-name player-name-link" onclick="window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')"
              style="cursor:pointer;transition:color 0.15s" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">${a.apelido}</div>
            <div class="player-full-name">${a.nome}</div>
          </div>
        </div>
      </td>
      <td><span class="position-badge ${a.position.class}">${a.position.abr}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <img src="${a.clubBadge}" alt="" class="club-badge" onerror="this.style.display='none'">
          <span style="font-size:12px">${a.clubName}</span>
        </div>
      </td>
      <td><span class="status-badge ${a.status.class}">${a.status.icon} ${a.status.nome}</span></td>
      <td><span class="${ptsClass}" style="font-weight:700">${a.pontos_num.toFixed(1)}</span></td>
      <td><span style="font-weight:700">${a.media_num.toFixed(2)}</span></td>
      <td style="font-weight:600">${formatPrice(a.preco_num)}</td>
      <td><span class="${varClass}" style="font-weight:600">${formatVariation(a.variacao_num)}</span></td>
      <td style="text-align:center">${a.jogos_num}</td>
      <td style="white-space:nowrap">
        <button class="btn-ghost" onclick="window.__openPlayerProfile(${a.atleta_id}, '${a.apelido.replace(/'/g, "\\'")}')"
          style="font-size:14px" title="Ver perfil">👤</button>
        ${scoutEntries.length > 0 ? `<button class="btn-ghost" onclick="window.__toggleScout(${a.atleta_id})" style="font-size:16px" title="Ver scout">📊</button>` : ''}
      </td>
    </tr>
    ${scoutEntries.length > 0 ? `
    <tr id="scout-${a.atleta_id}" style="display:none">
      <td colspan="10" style="padding:8px 16px;background:rgba(0,0,0,0.2)">
        <div class="scout-details">
          ${scoutEntries.map(([key, val]) => `
            <div class="scout-item">
              <span class="scout-item-label">${getScoutLabel(key)}</span>
              <span class="scout-item-value">${val}</span>
            </div>
          `).join('')}
        </div>
      </td>
    </tr>
    ` : ''}
  `;
}

function renderPagination(totalPages, total) {
  const pagination = document.getElementById('pagination');
  if (!pagination || totalPages <= 1) {
    if (pagination) pagination.innerHTML = '';
    return;
  }

  let pages = [];
  const maxVisible = 7;
  
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    let start = Math.max(2, currentPage - 2);
    let end = Math.min(totalPages - 1, currentPage + 2);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  pagination.innerHTML = `
    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="window.__goToPage(${currentPage - 1})">‹</button>
    ${pages.map(p => p === '...' 
      ? `<span class="pagination-info">...</span>`
      : `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="window.__goToPage(${p})">${p}</button>`
    ).join('')}
    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.__goToPage(${currentPage + 1})">›</button>
    <span class="pagination-info">${total} jogadores</span>
  `;

  window.__goToPage = (page) => {
    currentPage = page;
    updateTable();
    document.getElementById('players-table-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

export function destroyPlayers() {
  delete window.__sortPlayers;
  delete window.__toggleScout;
  delete window.__goToPage;
  delete window.__openPlayerProfile;
}

// Register globally
window.__openPlayerProfile = (atletaId, playerName) => {
  window.__navigateTo?.('player-profile', { atletaId, playerName });
};
