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
  const bracketView = d3.select('#bracket-view');
  const toggleViewBtn = d3.select('#toggle-view');
  const backToDashboardBtn = d3.select('#back-to-dashboard');
  const bracketContainer = d3.select('#bracket-container');
  
  let globalData = [];
  let bracketData = [];
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

    // View Toggle Listeners
    toggleViewBtn.on('click', () => {
      console.log('Show Bracket button clicked');
      if (bracketView.empty()) {
        console.error('Error: #bracket-view element not found');
        showStatus('Error: Bracket view element not found');
        return;
      }
      bracketView.classed('hidden', false);
      console.log('Bracket view visibility toggled');
      if (bracketData.length === 0) {
        console.log('Loading bracket data...');
        loadBracketData();
      }
    });

    backToDashboardBtn.on('click', () => {
      console.log('Back to Dashboard button clicked');
      bracketView.classed('hidden', true);
    });

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
    if (currentMode === 'trapezoid') {
      renderTrapezoidPlot(selectedData);
      return;
    }

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

  function renderTrapezoidPlot(selectedData) {
    svg.selectAll('*').remove();
    const width = +svg.attr('width'), height = +svg.attr('height');
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([62, 74])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, 40])
      .range([innerHeight, 0]);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(12))
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', 40)
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .text('Pace');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .text('Net Rating (Adj for opponent)');

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-opacity', 0.5)
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''));

    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .attr('stroke', '#e2e8f0')
      .attr('stroke-opacity', 0.5)
      .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''));

    // Trapezoid of Excellence
    const trapezoidPoints = [
      [63, 40], [66, 20], [70, 20], [73, 40], [63, 40]
    ];
    const lineGenerator = d3.line()
      .x(d => xScale(d[0]))
      .y(d => yScale(d[1]));

    g.append('path')
      .datum(trapezoidPoints)
      .attr('d', lineGenerator)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 3);

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .style('font-size', '16px')
      .style('fill', '#10b981')
      .text('TRAPEZOID OF EXCELLENCE');

    // Filtered teams as dots
    let plotData = globalData;
    if (currentFilter === 'qualified') {
      plotData = globalData.filter(d => d.is_qualified === '1');
    }

    g.selectAll('.team-dot')
      .data(plotData)
      .enter()
      .append('circle')
      .attr('class', 'team-dot')
      .attr('cx', d => xScale(+d.pace))
      .attr('cy', d => yScale(+d.net_rating))
      .attr('r', 3)
      .attr('fill', '#94a3b8')
      .attr('opacity', 0.5);

    // Selected teams with names
    const selectedNames = selectedData.map(d => d.team);
    const selectedPoints = g.selectAll('.selected-team')
      .data(selectedData)
      .enter()
      .append('g')
      .attr('class', 'selected-team');

    selectedPoints.append('circle')
      .attr('cx', d => xScale(+d.pace))
      .attr('cy', d => yScale(+d.net_rating))
      .attr('r', 5)
      .attr('fill', (d, i) => d3.schemeCategory10[i % 10]);

    selectedPoints.append('text')
      .attr('x', d => xScale(+d.pace) + 8)
      .attr('y', d => yScale(+d.net_rating) + 4)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', (d, i) => d3.schemeCategory10[i % 10])
      .text(d => d.team);
  }

  function loadBracketData() {
    d3.csv('data/bracket_2026.csv').then(data => {
      bracketData = data;
      renderBracket();
    }).catch(err => {
      console.error('Could not load bracket CSV', err);
      showStatus(`Error loading bracket: ${err.message}`);
    });
  }

  function renderBracket() {
    bracketContainer.selectAll('*').remove();
    
    const width = 1400;
    const height = 1000;
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    
    const svg = bracketContainer.append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'bracket-svg');

    const regions = ['East', 'South', 'West', 'Midwest'];
    const regionConfig = {
      'East': { x: 50, y: 50, direction: 1, verticalOffset: 0 },
      'South': { x: 50, y: 550, direction: 1, verticalOffset: 0 },
      'West': { x: width - 50, y: 50, direction: -1, verticalOffset: 0 },
      'Midwest': { x: width - 50, y: 550, direction: -1, verticalOffset: 0 }
    };

    const gameHeight = 30;
    const gameWidth = 180;
    const roundSpacing = 220;

    regions.forEach(region => {
      const regionTeams = bracketData.filter(d => d.region === region);
      const config = regionConfig[region];
      
      // Draw Region Label
      svg.append('text')
        .attr('x', config.direction === 1 ? config.x + 100 : config.x - 100)
        .attr('y', config.y + 220)
        .attr('class', 'region-label')
        .attr('text-anchor', 'middle')
        .text(region);

      // Round 1 (64 teams -> 32 games total, 8 per region)
      // We need to pair them: 1 vs 16, 8 vs 9, 5 vs 12, 4 vs 13, 6 vs 11, 3 vs 14, 7 vs 10, 2 vs 15
      const seedOrder = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
      const round1Teams = [];
      seedOrder.forEach(seed => {
        const team = regionTeams.find(t => +t.seed === seed);
        round1Teams.push(team || { team: 'TBD', seed: seed });
      });

      const round1Positions = [];

      for (let i = 0; i < 8; i++) {
        const team1 = round1Teams[i * 2];
        const team2 = round1Teams[i * 2 + 1];
        const x = config.x + (config.direction === 1 ? 0 : -gameWidth);
        const y = config.y + i * 60;

        drawGame(svg, x, y, team1, team2, config.direction);
        round1Positions.push({ x: config.direction === 1 ? x + gameWidth : x, y: y + gameHeight / 2 });
      }

      // Round 2 (32 teams -> 16 games total, 4 per region)
      const round2Positions = [];
      for (let i = 0; i < 4; i++) {
        const p1 = round1Positions[i * 2];
        const p2 = round1Positions[i * 2 + 1];
        const x = config.x + config.direction * roundSpacing + (config.direction === 1 ? 0 : -gameWidth);
        const y = (p1.y + p2.y) / 2 - gameHeight / 2;

        // Draw lines from Round 1
        drawBracketLines(svg, p1, p2, x, config.direction);
        
        drawGame(svg, x, y, { team: '', seed: '' }, { team: '', seed: '' }, config.direction);
        round2Positions.push({ x: config.direction === 1 ? x + gameWidth : x, y: y + gameHeight / 2 });
      }

      // Sweet 16 (16 teams -> 8 games total, 2 per region)
      const round3Positions = [];
      for (let i = 0; i < 2; i++) {
        const p1 = round2Positions[i * 2];
        const p2 = round2Positions[i * 2 + 1];
        const x = config.x + config.direction * roundSpacing * 2 + (config.direction === 1 ? 0 : -gameWidth);
        const y = (p1.y + p2.y) / 2 - gameHeight / 2;

        drawBracketLines(svg, p1, p2, x, config.direction);
        drawGame(svg, x, y, { team: '', seed: '' }, { team: '', seed: '' }, config.direction);
        round3Positions.push({ x: config.direction === 1 ? x + gameWidth : x, y: y + gameHeight / 2 });
      }

      // Elite 8 (8 teams -> 4 games total, 1 per region)
      const round4Positions = [];
      {
        const p1 = round3Positions[0];
        const p2 = round3Positions[1];
        const x = config.x + config.direction * roundSpacing * 3 + (config.direction === 1 ? 0 : -gameWidth);
        const y = (p1.y + p2.y) / 2 - gameHeight / 2;

        drawBracketLines(svg, p1, p2, x, config.direction);
        drawGame(svg, x, y, { team: '', seed: '' }, { team: '', seed: '' }, config.direction);
        round4Positions.push({ x: config.direction === 1 ? x + gameWidth : x, y: y + gameHeight / 2 });
      }
      
      // Store Elite 8 winner position for Final Four
      config.elite8Pos = round4Positions[0];
    });

    // Final Four
    const ffY1 = (regionConfig['East'].elite8Pos.y + regionConfig['South'].elite8Pos.y) / 2;
    const ffY2 = (regionConfig['West'].elite8Pos.y + regionConfig['Midwest'].elite8Pos.y) / 2;
    
    const ffX1 = regionConfig['East'].x + roundSpacing * 4;
    const ffX2 = regionConfig['West'].x - roundSpacing * 4 - gameWidth;

    // Lines to Final Four
    drawBracketLines(svg, regionConfig['East'].elite8Pos, regionConfig['South'].elite8Pos, ffX1, 1);
    drawBracketLines(svg, regionConfig['West'].elite8Pos, regionConfig['Midwest'].elite8Pos, ffX2, -1);

    drawGame(svg, ffX1, ffY1 - gameHeight / 2, { team: '', seed: '' }, { team: '', seed: '' }, 1);
    drawGame(svg, ffX2, ffY2 - gameHeight / 2, { team: '', seed: '' }, { team: '', seed: '' }, -1);

    // Championship
    const champX = (ffX1 + ffX2 + gameWidth) / 2 - gameWidth / 2;
    const champY = (ffY1 + ffY2) / 2 - gameHeight / 2;

    // Lines to Championship
    const pFF1 = { x: ffX1 + gameWidth, y: ffY1 };
    const pFF2 = { x: ffX2, y: ffY2 };
    
    svg.append('path')
      .attr('d', `M ${pFF1.x} ${pFF1.y} L ${champX} ${pFF1.y} L ${champX} ${champY + gameHeight/2}`)
      .attr('class', 'bracket-line');
    svg.append('path')
      .attr('d', `M ${pFF2.x} ${pFF2.y} L ${champX + gameWidth} ${pFF2.y} L ${champX + gameWidth} ${champY + gameHeight/2}`)
      .attr('class', 'bracket-line');

    drawGame(svg, champX, champY, { team: '', seed: '' }, { team: '', seed: '' }, 1, true);
    
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', champY - 40)
      .attr('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .style('font-size', '18px')
      .text('NATIONAL CHAMPIONSHIP');
    
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', champY - 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .text('04/06');
  }

  function drawGame(svg, x, y, team1, team2, direction, isChamp = false) {
    const gameWidth = 180;
    const gameHeight = 40;
    const g = svg.append('g')
      .attr('class', 'bracket-game')
      .on('click', () => {
        const t1 = team1.team && team1.team !== 'TBD' ? team1.team : null;
        const t2 = team2.team && team2.team !== 'TBD' ? team2.team : null;
        if (t1 || t2) {
          selectTeamsFromGame(t1, t2);
        }
      });

    // Team 1 box
    g.append('rect')
      .attr('x', x)
      .attr('y', y)
      .attr('width', gameWidth)
      .attr('height', gameHeight / 2)
      .attr('fill', 'white')
      .attr('stroke', '#cbd5e1');

    // Team 2 box
    g.append('rect')
      .attr('x', x)
      .attr('y', y + gameHeight / 2)
      .attr('width', gameWidth)
      .attr('height', gameHeight / 2)
      .attr('fill', 'white')
      .attr('stroke', '#cbd5e1');

    // Team 1 Text
    if (team1.seed) {
      g.append('text')
        .attr('x', x + 5)
        .attr('y', y + 14)
        .attr('class', 'bracket-seed-text')
        .text(team1.seed);
    }
    g.append('text')
      .attr('x', x + 25)
      .attr('y', y + 14)
      .attr('class', 'bracket-team-text')
      .text(team1.team || '');

    // Team 2 Text
    if (team2.seed) {
      g.append('text')
        .attr('x', x + 5)
        .attr('y', y + 34)
        .attr('class', 'bracket-seed-text')
        .text(team2.seed);
    }
    g.append('text')
      .attr('x', x + 25)
      .attr('y', y + 34)
      .attr('class', 'bracket-team-text')
      .text(team2.team || '');
  }

  function drawBracketLines(svg, p1, p2, nextX, direction) {
    const midX = p1.x + (direction * 20);
    svg.append('path')
      .attr('d', `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`)
      .attr('class', 'bracket-line');
    
    svg.append('line')
      .attr('x1', midX)
      .attr('y1', (p1.y + p2.y) / 2)
      .attr('x2', nextX)
      .attr('y2', (p1.y + p2.y) / 2)
      .attr('class', 'bracket-line');
  }

  function selectTeamsFromGame(team1, team2) {
    // Clear current selection
    select.selectAll('option').property('selected', false);
    
    // Select the teams
    select.selectAll('option').filter(function() {
      const val = d3.select(this).property('value');
      return (team1 && val === team1) || (team2 && val === team2);
    }).property('selected', true);

    // Refresh visualization and switch back
    refreshVisualization();
    bracketView.classed('hidden', true);
    
    let msg = 'Selected ';
    if (team1 && team2) msg += `${team1} vs ${team2}`;
    else if (team1) msg += team1;
    else if (team2) msg += team2;
    showStatus(msg);
  }
});
