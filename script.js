// NCAA Analytics Dashboard Script
document.addEventListener('DOMContentLoaded', () => {
  const select = d3.select('#team-select');
  const tournamentFilter = d3.select('#tournament-filter');
  const displayMode = d3.select('#display-mode');
  const teamSearch = d3.select('#team-search');
  const clearBtn = d3.select('#clear-selection');
  const svg = d3.select('#viz');
  const detailsGrid = d3.select('#team-details');
  const selectedCount = d3.select('#selected-count');
  const statusContainer = d3.select('#status-container');
  
  let globalData = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let currentMode = 'default';

  // Axis Configurations
  const modes = {
    default: [
      { name: 'ATO (E)', angle: 0, stat: 'ato' },
      { name: 'Pace (S)', angle: Math.PI / 2, stat: 'pace' },
      { name: 'eFG% (W)', angle: Math.PI, stat: 'efg_pct' },
      { name: 'Net Rating (N)', angle: 3 * Math.PI / 2, stat: 'net_rating' }
    ],
    efficiency: [
      { name: 'eFG% (E)', angle: 0, stat: 'efg_pct' },
      { name: 'DRtg (S - Inv)', angle: Math.PI / 2, stat: 'drtg', invert: true },
      { name: 'ATO (W)', angle: Math.PI, stat: 'ato' },
      { name: 'ORtg (N)', angle: 3 * Math.PI / 2, stat: 'ortg' }
    ],
    performance: [
      { name: 'Pace (E)', angle: 0, stat: 'pace' },
      { name: 'DRtg (S)', angle: Math.PI / 2, stat: 'drtg' },
      { name: 'eFG% (W)', angle: Math.PI, stat: 'efg_pct' },
      { name: 'ORtg (N)', angle: 3 * Math.PI / 2, stat: 'ortg' }
    ]
  };

  // Load the consolidated team data
  d3.csv('data/teams_2026.csv').then(data => {
    if (!data || data.length === 0) {
      showStatus('Error: CSV file is empty.');
      return;
    }
    
    globalData = data;
    console.log(`Successfully loaded ${data.length} teams`);

    updateTeamList();

    // Listeners
    tournamentFilter.on('change', function() {
      currentFilter = this.value;
      updateTeamList();
    });

    displayMode.on('change', function() {
      currentMode = this.value;
      refreshVisualization();
    });

    teamSearch.on('input', function() {
      currentSearch = this.value.toLowerCase();
      updateTeamList();
    });

    clearBtn.on('click', () => {
      select.property('value', null);
      refreshVisualization();
      updateTeamCards([]);
      selectedCount.text('No teams selected');
    });

    select.on('change', refreshVisualization);

  }).catch(err => {
    console.error('Could not load CSV', err);
    showStatus(`Error loading data: ${err.message}`);
  });

  function refreshVisualization() {
    const selectedOptions = Array.from(select.node().selectedOptions).map(opt => opt.value);
    const selectedData = globalData.filter(d => selectedOptions.includes(d.team));
    updateVisualization(selectedData);
    updateTeamCards(selectedData);
    selectedCount.text(selectedData.length > 0 ? `${selectedData.length} teams selected` : 'No teams selected');
  }

  function showStatus(msg) {
    statusContainer.append('div')
      .attr('class', 'status-msg')
      .text(msg)
      .transition()
      .delay(5000)
      .remove();
  }

  function updateTeamList() {
    const currentSelections = Array.from(select.node().selectedOptions).map(opt => opt.value);
    select.selectAll('option').remove();
    
    let filteredData = globalData;
    if (currentFilter === 'qualified') filteredData = filteredData.filter(d => d.is_qualified === '1');
    if (currentSearch) filteredData = filteredData.filter(d => d.team.toLowerCase().includes(currentSearch));

    if (currentFilter === 'qualified') {
      filteredData.sort((a, b) => (parseInt(a.seed) || 99) - (parseInt(b.seed) || 99) || a.team.localeCompare(b.team));
    } else {
      filteredData.sort((a, b) => a.team.localeCompare(b.team));
    }

    filteredData.forEach(d => {
      const displayName = d.seed ? `${d.seed}. ${d.team}` : d.team;
      const opt = select.append('option').attr('value', d.team).text(displayName);
      if (currentSelections.includes(d.team)) opt.property('selected', true);
    });
  }

  function updateTeamCards(selectedData) {
    detailsGrid.selectAll('.team-card').remove();
    const cards = detailsGrid.selectAll('.team-card').data(selectedData).enter().append('div')
      .attr('class', 'card team-card').style('--color', (d, i) => d3.schemeCategory10[i % 10]);

    cards.html(d => `
      <h3>${d.team}</h3>
      <div class="meta">${d.seed ? d.seed + ' Seed • ' : ''}${d.region || 'No Region'}</div>
      <div class="stats-row">
        <div class="stat-item"><span class="stat-label">Net Rating</span><span class="stat-value">${d.net_rating}</span></div>
        <div class="stat-item"><span class="stat-label">Pace</span><span class="stat-value">${d.pace}</span></div>
        <div class="stat-item"><span class="stat-label">ORtg</span><span class="stat-value">${d.ortg}</span></div>
        <div class="stat-item"><span class="stat-label">DRtg</span><span class="stat-value">${d.drtg}</span></div>
        <div class="stat-item"><span class="stat-label">eFG%</span><span class="stat-value">${d.efg_pct}</span></div>
        <div class="stat-item"><span class="stat-label">ATO</span><span class="stat-value">${d.ato}</span></div>
      </div>
    `);
  }

  function updateVisualization(selectedData) {
    svg.selectAll('*').remove();
    if (selectedData.length === 0) return;

    const width = +svg.attr('width'), height = +svg.attr('height');
    const centerX = width / 2, centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 80;
    const axes = modes[currentMode];

    // Create scales for each axis
    const scales = {};
    axes.forEach(axis => {
      const domain = [d3.min(globalData, d => +d[axis.stat]), d3.max(globalData, d => +d[axis.stat])];
      scales[axis.stat] = d3.scaleLinear().domain(domain).range(axis.invert ? [maxRadius, 20] : [20, maxRadius]);
    });

    const g = svg.append('g');

    // Background circles
    [0.25, 0.5, 0.75, 1].forEach(p => {
      g.append('circle').attr('cx', centerX).attr('cy', centerY).attr('r', maxRadius * p)
        .attr('fill', 'none').attr('stroke', '#f1f5f9').attr('stroke-width', 1);
    });

    axes.forEach(axis => {
      const x2 = centerX + Math.cos(axis.angle) * maxRadius, y2 = centerY + Math.sin(axis.angle) * maxRadius;
      g.append('line').attr('x1', centerX).attr('y1', centerY).attr('x2', x2).attr('y2', y2)
        .attr('stroke', '#e2e8f0').attr('stroke-dasharray', '4,4');
      g.append('text').attr('x', centerX + Math.cos(axis.angle) * (maxRadius + 30)).attr('y', centerY + Math.sin(axis.angle) * (maxRadius + 30))
        .attr('text-anchor', 'middle').attr('alignment-baseline', 'middle').style('font-size', '11px').style('font-weight', '600').style('fill', '#64748b').text(axis.name);
    });

    selectedData.forEach((team, i) => {
      const color = d3.schemeCategory10[i % 10];
      const points = axes.map(axis => {
        const r = scales[axis.stat](+team[axis.stat]);
        return [centerX + Math.cos(axis.angle) * r, centerY + Math.sin(axis.angle) * r];
      });

      const lineGenerator = d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveCardinalClosed.tension(0));
      g.append('path').datum(points).attr('d', lineGenerator).attr('fill', color).attr('fill-opacity', 0.2)
        .attr('stroke', color).attr('stroke-width', 3).attr('class', 'team-shape').style('opacity', 0).transition().duration(500).style('opacity', 1);
    });
  }
});
