// === NAVIGATION ===
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  const titles = {
    dashboard:'📊 Dashboard Tổng quan', vehicles:'🚛 Thông tin xe', schedule:'📋 Lịch Tải',
    fines:'🚨 Phạt Nguội', efficiency:'📊 Hiệu suất xe', staff:'👥 Nhân sự',
    reinforcement:'📦 Tăng cường Lấy'
  };
  document.getElementById('pageTitle').textContent = titles[page] || '';
  if (page === 'dashboard' && !window._dashChartsRendered) { renderDashboardCharts(); window._dashChartsRendered = true; }
  if (page === 'efficiency' && !window._effChartsRendered) { renderEfficiencyCharts(); window._effChartsRendered = true; }
  if (page === 'staff' && !window._staffChartsRendered) { renderStaffCharts(); window._staffChartsRendered = true; }
}

// === CLOCK ===
function updateClock() {
  const now = new Date();
  document.getElementById('headerTime').textContent = now.toLocaleString('vi-VN', {
    weekday:'long', day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  });
}
setInterval(updateClock, 1000); updateClock();

// === HELPERS ===
function fmt(n) { return new Intl.NumberFormat('vi-VN').format(Math.round(n)); }
function fmtM(n) { return (n/1000000).toFixed(1) + 'M'; }
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = 'Inter';
const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'];

function isExpiringSoon(dateStr) {
  if (!dateStr || dateStr === 'hết hạn') return dateStr === 'hết hạn' ? 'expired' : null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const now = new Date();
  const diff = (d - now) / (1000*60*60*24);
  if (diff < 0) return 'expired';
  if (diff < 30) return 'critical';
  if (diff < 90) return 'warning';
  return 'ok';
}

function dateCell(dateStr) {
  const st = isExpiringSoon(dateStr);
  if (!dateStr) return '<td>-</td>';
  if (dateStr === 'hết hạn') return '<td><span class="status breakdown">Hết hạn</span></td>';
  const cls = st === 'expired' ? 'breakdown' : st === 'critical' ? 'delayed' : st === 'warning' ? 'unassigned' : 'completed';
  const label = st === 'expired' ? '⛔' : st === 'critical' ? '🔴' : st === 'warning' ? '🟡' : '🟢';
  return `<td>${label} ${dateStr}</td>`;
}

function makeKPI(cards) {
  return cards.map(c =>
    `<div class="kpi-card ${c.c}"><div class="kpi-header"><div><div class="kpi-label">${c.l}</div><div class="kpi-value">${c.v}</div></div><div class="kpi-icon">${c.i}</div></div></div>`
  ).join('');
}

function populateSelect(id, values) {
  const sel = document.getElementById(id);
  if (sel.options.length <= 1) values.forEach(v => { const o = document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); });
}

// ==================== PAGE 0: DASHBOARD TỔNG QUAN ====================
function renderDashboard() {
  const v = DATA.vehicles;
  const d = DATA.drivers;
  const r = DATA.routes;
  const f = DATA.fines;
  const e = DATA.efficiency;
  const rf = DATA.reinforcement;

  const activeVehicles = v.filter(x => x.status === 'Hoạt động').length;
  const workingDrivers = d.filter(x => x.status === 'Đang làm việc').length;
  const uniqueRoutes = new Set(r.map(x => x.routeName)).size;
  const pendingFines = f.filter(x => x.progress === 'Chưa Làm Việc Với Tài Xế' || x.progress === 'Pending').length;
  const avgEff = e.length ? (e.reduce((s,x) => s + x.efficiency, 0) / e.length).toFixed(1) : 0;
  const reinfOK = rf.filter(x => x.status === 'Có xe').length;
  const totalFineCost = f.reduce((s,x) => s + (typeof x.cost === 'number' ? x.cost : 0), 0);

  // Count expiring items
  let expiringCount = 0;
  v.forEach(x => {
    ['inspectionExpiry','liabilityExpiry','roadFeeExpiry','badgeExpiry'].forEach(fld => {
      const s = isExpiringSoon(x[fld]);
      if (s === 'expired' || s === 'critical') expiringCount++;
    });
  });

  document.getElementById('dashboardKPIs').innerHTML = makeKPI([
    {l:'Xe hoạt động', v: activeVehicles + '/' + v.length, c:'blue', i:'🚛'},
    {l:'Tài xế đang làm', v: workingDrivers + '/' + d.length, c:'green', i:'👥'},
    {l:'Tổng tuyến', v: uniqueRoutes, c:'cyan', i:'🛤️'},
    {l:'Hiệu suất TB', v: avgEff + '%', c:'purple', i:'📊'},
    {l:'Phạt nguội chờ', v: pendingFines, c: pendingFines > 0 ? 'red' : 'green', i:'🚨'},
    {l:'Hạn sắp hết', v: expiringCount, c: expiringCount > 0 ? 'orange' : 'green', i:'⚠️'},
    {l:'Tăng cường OK', v: reinfOK + '/' + rf.length, c:'green', i:'📦'},
    {l:'Tổng phạt', v: fmt(totalFineCost) + '₫', c:'red', i:'💰'}
  ]);

  // Alert message
  const alerts = [];
  if (expiringCount > 0) alerts.push(`${expiringCount} giấy tờ xe hết/sắp hết hạn`);
  if (pendingFines > 0) alerts.push(`${pendingFines} phạt nguội chưa xử lý`);
  const issueVehicles = e.filter(x => x.opStatus && x.opStatus !== 'Đang vận hành' && x.opStatus !== 'Đề xuất thanh lý').length;
  if (issueVehicles > 0) alerts.push(`${issueVehicles} xe gặp sự cố`);
  document.getElementById('dashboardAlertMsg').textContent = alerts.length > 0
    ? '⚡ ' + alerts.join(' | ')
    : '✅ Hệ thống vận hành bình thường';
}

function renderDashboardCharts() {
  // 1. Vehicle status pie
  const vStats = {};
  DATA.vehicles.forEach(x => { const s = x.status || 'N/A'; vStats[s] = (vStats[s]||0) + 1; });
  new Chart(document.getElementById('chartDashVehicle'), {
    type:'doughnut', data:{
      labels: Object.keys(vStats),
      datasets:[{data: Object.values(vStats), backgroundColor:['#10b981','#f59e0b','#ef4444','#8b5cf6'], borderWidth:0, hoverOffset:8}]
    }, options:{responsive:true, plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });

  // 2. Staff status pie
  const dStats = {};
  DATA.drivers.forEach(x => { const s = x.status || 'N/A'; dStats[s] = (dStats[s]||0) + 1; });
  new Chart(document.getElementById('chartDashStaff'), {
    type:'doughnut', data:{
      labels: Object.keys(dStats),
      datasets:[{data: Object.values(dStats), backgroundColor:['#10b981','#ef4444'], borderWidth:0, hoverOffset:8}]
    }, options:{responsive:true, plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });

  // 3. Efficiency distribution
  const buckets = {'0%':0,'1-20%':0,'21-40%':0,'41-60%':0,'61-80%':0,'81-100%':0};
  DATA.efficiency.forEach(x => {
    const v = x.efficiency;
    if (v === 0) buckets['0%']++;
    else if (v <= 20) buckets['1-20%']++;
    else if (v <= 40) buckets['21-40%']++;
    else if (v <= 60) buckets['41-60%']++;
    else if (v <= 80) buckets['61-80%']++;
    else buckets['81-100%']++;
  });
  new Chart(document.getElementById('chartDashEfficiency'), {
    type:'bar', data:{
      labels: Object.keys(buckets),
      datasets:[{label:'Số xe', data: Object.values(buckets), backgroundColor: CHART_COLORS.slice(0,6), borderRadius:6}]
    }, options:{responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
  });

  // 4. Reinforcement status
  const rfStats = {};
  DATA.reinforcement.forEach(x => {
    let s = x.status || 'N/A';
    if (s.startsWith('Hủy')) s = 'Hủy';
    rfStats[s] = (rfStats[s]||0) + 1;
  });
  new Chart(document.getElementById('chartDashReinf'), {
    type:'doughnut', data:{
      labels: Object.keys(rfStats),
      datasets:[{data: Object.values(rfStats), backgroundColor:['#10b981','#ef4444','#f59e0b','#94a3b8'], borderWidth:0, hoverOffset:8}]
    }, options:{responsive:true, plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });

  // 5. Supplier distribution bar chart
  const validSuppliers = ['GHN','Huy Bảo Phát','Minh Đăng Khoa','An Hợp Tín','Việt Phong','Quân Khang Phát','Châu Khôi','Vạn Lợi'];
  const supStats = {};
  DATA.routes.forEach(x => { if (x.supplier && validSuppliers.includes(x.supplier)) supStats[x.supplier] = (supStats[x.supplier]||0) + 1; });
  const supLabels = Object.keys(supStats).sort((a,b) => supStats[b] - supStats[a]);
  new Chart(document.getElementById('chartDashSupplier'), {
    type:'bar', data:{
      labels: supLabels,
      datasets:[{label:'Số điểm dừng', data: supLabels.map(l => supStats[l]), backgroundColor: CHART_COLORS, borderRadius:6}]
    }, options:{responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
  });
}

// ==================== PAGE 1: THÔNG TIN XE ====================
function renderVehicles() {
  const v = DATA.vehicles;
  const active = v.filter(x => x.status === 'Hoạt động').length;
  const disposed = v.filter(x => x.status === 'Thanh lý').length;
  const issue = v.length - active - disposed;

  // Count expiring
  let expiringCount = 0;
  v.forEach(x => {
    ['inspectionExpiry','liabilityExpiry','roadFeeExpiry','badgeExpiry','regCertExpiry'].forEach(f => {
      const s = isExpiringSoon(x[f]);
      if (s === 'expired' || s === 'critical') expiringCount++;
    });
  });

  document.getElementById('vehicleKPIs').innerHTML = makeKPI([
    {l:'Tổng xe', v:v.length, c:'blue', i:'🚛'},
    {l:'Hoạt động', v:active, c:'green', i:'✅'},
    {l:'Thanh lý', v:disposed, c:'orange', i:'📋'},
    {l:'SC/Tai nạn', v:issue, c:'red', i:'🔧'},
    {l:'Hạn sắp hết', v:expiringCount, c:'red', i:'⚠️'}
  ]);

  document.getElementById('vehicleExpiryMsg').textContent =
    expiringCount > 0 ? `⚡ ${expiringCount} mục hết hạn/sắp hết hạn (đăng kiểm, BH, phí đường bộ, phù hiệu)` : '✅ Tất cả giấy tờ xe còn hạn';

  const regions = [...new Set(v.map(x=>x.region).filter(Boolean))].sort();
  populateSelect('filterVehicleRegion', regions);
  renderVehicleTable();
}

function renderVehicleTable() {
  const statusF = document.getElementById('filterVehicleStatus').value;
  const regionF = document.getElementById('filterVehicleRegion').value;
  const warnF = document.getElementById('filterVehicleWarning').value;
  const search = (document.getElementById('searchVehicle').value||'').toLowerCase();
  let data = DATA.vehicles;
  if (statusF) data = data.filter(x => x.status === statusF);
  if (regionF) data = data.filter(x => x.region === regionF);
  if (search) data = data.filter(x => (x.plate||'').toLowerCase().includes(search));
  if (warnF === 'expiring') {
    data = data.filter(x => {
      return ['inspectionExpiry','liabilityExpiry','roadFeeExpiry','badgeExpiry','regCertExpiry'].some(f => {
        const s = isExpiringSoon(x[f]);
        return s === 'expired' || s === 'critical' || s === 'warning';
      });
    });
  }

  document.getElementById('vehicleTableBody').innerHTML = data.map(x => {
    const stCls = x.status === 'Hoạt động' ? 'assigned' : x.status === 'Thanh lý' ? 'unassigned' : 'breakdown';
    return `<tr>
      <td>${x.stt||''}</td>
      <td style="font-weight:600;color:var(--text-primary)">${x.plate||''}</td>
      <td>${x.tonnage||''}</td><td>${x.model||''}</td>
      <td>${x.region||''}</td>
      <td><span class="status ${stCls}">${x.status||''}</span></td>
      ${dateCell(x.inspectionExpiry)}${dateCell(x.liabilityExpiry)}
      ${dateCell(x.roadFeeExpiry)}${dateCell(x.badgeExpiry)}
      <td>${x.totalKm ? fmt(x.totalKm) : '-'}</td><td>${x.fleet||''}</td>
    </tr>`;
  }).join('');
}

// ==================== PAGE 2: LỊCH TẢI ====================
function renderSchedule() {
  const r = DATA.routes;
  const uniqueRoutes = new Set(r.map(x=>x.routeName));
  const types = {}; r.forEach(x => { if(x.type) types[x.type]=(types[x.type]||0)+1; });
  const suppliers = {};
  const validSuppliers = ['GHN','Huy Bảo Phát','Minh Đăng Khoa','An Hợp Tín','Việt Phong','Quân Khang Phát','Châu Khôi','Vạn Lợi'];
  r.forEach(x => { if(x.supplier && validSuppliers.includes(x.supplier)) suppliers[x.supplier]=(suppliers[x.supplier]||0)+1; });

  document.getElementById('scheduleKPIs').innerHTML = makeKPI([
    {l:'Tổng tuyến', v:uniqueRoutes.size, c:'blue', i:'🛤️'},
    {l:'Điểm dừng', v:r.length, c:'cyan', i:'📍'},
    {l:'Phân loại', v:types['Phân loại']||0, c:'purple', i:'📦'},
    {l:'Giao', v:types['Giao']||0, c:'green', i:'🚚'},
    {l:'Lấy', v:types['Lấy']||0, c:'orange', i:'📥'}
  ]);

  populateSelect('filterRouteSupplier', Object.keys(suppliers).sort());
  renderScheduleTable();
}

function renderScheduleTable() {
  const typeF = document.getElementById('filterRouteType').value;
  const supF = document.getElementById('filterRouteSupplier').value;
  const search = (document.getElementById('searchRoute').value||'').toLowerCase();
  let data = DATA.routes;
  if (typeF) data = data.filter(x => x.type && x.type.includes(typeF));
  if (supF) data = data.filter(x => x.supplier === supF);
  if (search) data = data.filter(x => (x.routeName||'').toLowerCase().includes(search) || (x.warehouse||'').toLowerCase().includes(search));

  document.getElementById('scheduleTableBody').innerHTML = data.slice(0,200).map(x => {
    const typeCls = x.type==='Phân loại'?'in_transit':x.type==='Giao'?'assigned':x.type==='Lấy'?'unassigned':'completed';
    return `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${x.routeName||''}</td>
      <td>${x.tonnage||''}</td><td>${x.warehouse||''}</td>
      <td><span class="status ${typeCls}">${x.type||''}</span></td>
      <td>${x.arrival||''}</td><td>${x.departure||''}</td>
      <td>${x.km||''}</td><td>${x.supplier||''}</td><td>${x.note||''}</td>
    </tr>`;
  }).join('');
}

// ==================== PAGE 3: PHẠT NGUỘI ====================
function renderFines() {
  const f = DATA.fines;
  const progresses = {};
  f.forEach(x => { if(x.progress) progresses[x.progress]=(progresses[x.progress]||0)+1; });
  const pending = f.filter(x => x.progress === 'Chưa Làm Việc Với Tài Xế' || x.progress === 'Pending').length;
  const processing = f.filter(x => x.progress === 'Đang Xử Lý Với Tài Xế').length;
  const done = f.filter(x => x.progress === 'Tạo eform hoàn ứng').length;
  const totalCost = f.reduce((s,x) => s + (typeof x.cost === 'number' ? x.cost : 0), 0);

  document.getElementById('finesKPIs').innerHTML = makeKPI([
    {l:'Tổng vụ', v:f.length, c:'blue', i:'🚨'},
    {l:'Chưa xử lý', v:pending, c:'red', i:'⏳'},
    {l:'Đang xử lý', v:processing, c:'orange', i:'🔄'},
    {l:'Đã tạo eform', v:done, c:'green', i:'✅'},
    {l:'Tổng chi phí', v:fmt(totalCost)+'₫', c:'purple', i:'💰'}
  ]);

  // Update badges
  document.getElementById('finesBadge').textContent = pending;
  document.getElementById('headerAlertBadge').textContent = pending;

  populateSelect('filterFineProgress', Object.keys(progresses).sort());
  renderFinesTable();
}

function renderFinesTable() {
  const progF = document.getElementById('filterFineProgress').value;
  let data = DATA.fines;
  if (progF) data = data.filter(x => x.progress === progF);

  document.getElementById('finesTableBody').innerHTML = data.map(x => {
    const pCls = (x.progress==='Chưa Làm Việc Với Tài Xế'||x.progress==='Pending')?'delayed':x.progress==='Đang Xử Lý Với Tài Xế'?'unassigned':'assigned';
    const dCls = x.driverStatus === 'Đã nghỉ việc' ? 'breakdown' : 'completed';
    return `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${x.plate||''}</td>
      <td>${x.violationTime||''}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${x.location||''}">${x.location||''}</td>
      <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis" title="${x.violation||''}">${x.violation||''}</td>
      <td style="font-weight:600">${x.cost ? fmt(x.cost)+'₫' : ''}</td>
      <td>${x.driverName||''}</td>
      <td><span class="status ${dCls}">${x.driverStatus||''}</span></td>
      <td>${x.sup||''}</td>
      <td><span class="status ${pCls}">${x.progress||''}</span></td>
    </tr>`;
  }).join('');
}

// ==================== PAGE 4: HIỆU SUẤT XE ====================
function renderEfficiency() {
  const e = DATA.efficiency;
  const opStats = {};
  e.forEach(x => { if(x.opStatus) opStats[x.opStatus]=(opStats[x.opStatus]||0)+1; });
  const operating = opStats['Đang vận hành']||0;
  const avgEff = e.length ? (e.reduce((s,x)=>s+x.efficiency,0)/e.length).toFixed(1) : 0;

  document.getElementById('efficiencyKPIs').innerHTML = makeKPI([
    {l:'Tổng xe', v:e.length, c:'blue', i:'🚛'},
    {l:'Đang vận hành', v:operating, c:'green', i:'✅'},
    {l:'Đề xuất thanh lý', v:opStats['Đề xuất thanh lý']||0, c:'orange', i:'📋'},
    {l:'BTBD/Tai nạn', v:(opStats['BTBD nặng']||0)+(opStats['Xe bị tai nạn']||0)+(opStats['Xe tai nạn']||0), c:'red', i:'🔧'},
    {l:'Hiệu suất TB', v:avgEff+'%', c:'purple', i:'📊'}
  ]);

  populateSelect('filterEffOpStatus', Object.keys(opStats).sort());
  renderEfficiencyTable();
}

function renderEfficiencyCharts() {
  const e = DATA.efficiency;
  // Efficiency distribution
  const buckets = {'0%':0, '1-20%':0, '21-40%':0, '41-60%':0, '61-80%':0, '81-100%':0};
  e.forEach(x => {
    const v = x.efficiency;
    if (v === 0) buckets['0%']++;
    else if (v <= 20) buckets['1-20%']++;
    else if (v <= 40) buckets['21-40%']++;
    else if (v <= 60) buckets['41-60%']++;
    else if (v <= 80) buckets['61-80%']++;
    else buckets['81-100%']++;
  });
  new Chart(document.getElementById('chartEfficiency'), {
    type:'bar', data:{
      labels:Object.keys(buckets),
      datasets:[{label:'Số xe',data:Object.values(buckets),backgroundColor:CHART_COLORS.slice(0,6),borderRadius:6}]
    }, options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
  });

  // Op status pie
  const opStats = {};
  e.forEach(x => { if(x.opStatus) opStats[x.opStatus]=(opStats[x.opStatus]||0)+1; });
  new Chart(document.getElementById('chartOpStatus'), {
    type:'doughnut', data:{
      labels:Object.keys(opStats),
      datasets:[{data:Object.values(opStats),backgroundColor:CHART_COLORS,borderWidth:0,hoverOffset:8}]
    }, options:{responsive:true,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });
}

function renderEfficiencyTable() {
  const opF = document.getElementById('filterEffOpStatus').value;
  const typeF = document.getElementById('filterEffType').value;
  let data = DATA.efficiency;
  if (opF) data = data.filter(x => x.opStatus === opF);
  if (typeF) data = data.filter(x => x.vehicleType === typeF);

  document.getElementById('efficiencyTableBody').innerHTML = data.map(x => {
    const pct = x.efficiency;
    const barCls = pct > 60 ? 'good' : pct > 30 ? 'warn' : 'danger';
    const opCls = x.opStatus==='Đang vận hành'?'assigned':x.opStatus==='Đề xuất thanh lý'?'unassigned':'breakdown';
    return `<tr>
      <td>${x.stt||''}</td>
      <td style="font-weight:600;color:var(--text-primary)">${x.plate||''}</td>
      <td>${x.tonnage||''}</td><td>${x.model||''}</td>
      <td>${x.vehicleType||''}</td><td>${x.region||''}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><span style="min-width:40px">${pct}%</span><div class="capacity-bar" style="width:80px"><div class="fill ${barCls}" style="width:${pct}%"></div></div></div></td>
      <td><span class="status ${opCls}">${x.opStatus||''}</span></td>
    </tr>`;
  }).join('');
}

// ==================== PAGE 5: NHÂN SỰ ====================
function renderStaff() {
  const d = DATA.drivers;
  const working = d.filter(x => x.status === 'Đang làm việc').length;
  const resigned = d.filter(x => x.status === 'Đã nghỉ việc').length;
  const positions = {};
  d.forEach(x => { if(x.position) positions[x.position]=(positions[x.position]||0)+1; });
  const supervisors = d.filter(x => x.position && x.position.includes('Supervisor')).length;

  document.getElementById('staffKPIs').innerHTML = makeKPI([
    {l:'Tổng nhân sự', v:d.length, c:'blue', i:'👥'},
    {l:'Đang làm việc', v:working, c:'green', i:'✅'},
    {l:'Đã nghỉ việc', v:resigned, c:'red', i:'🚪'},
    {l:'Supervisor', v:supervisors, c:'purple', i:'👔'},
    {l:'Chức danh', v:Object.keys(positions).length, c:'cyan', i:'📋'}
  ]);

  populateSelect('filterDriverPosition', Object.keys(positions).sort());
  renderStaffTable();
}

function renderStaffCharts() {
  const d = DATA.drivers;
  const positions = {};
  d.forEach(x => { if(x.position) positions[x.position]=(positions[x.position]||0)+1; });
  new Chart(document.getElementById('chartPositions'), {
    type:'doughnut', data:{
      labels:Object.keys(positions),
      datasets:[{data:Object.values(positions),backgroundColor:CHART_COLORS,borderWidth:0,hoverOffset:8}]
    }, options:{responsive:true,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });

  const statuses = {};
  d.forEach(x => { if(x.status) statuses[x.status]=(statuses[x.status]||0)+1; });
  new Chart(document.getElementById('chartDriverStatus'), {
    type:'doughnut', data:{
      labels:Object.keys(statuses),
      datasets:[{data:Object.values(statuses),backgroundColor:['#10b981','#ef4444'],borderWidth:0,hoverOffset:8}]
    }, options:{responsive:true,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',padding:12}}}}
  });
}

function renderStaffTable() {
  const statusF = document.getElementById('filterDriverStatus').value;
  const posF = document.getElementById('filterDriverPosition').value;
  const search = (document.getElementById('searchDriver').value||'').toLowerCase();
  let data = DATA.drivers;
  if (statusF) data = data.filter(x => x.status === statusF);
  if (posF) data = data.filter(x => x.position === posF);
  if (search) data = data.filter(x => (x.name||'').toLowerCase().includes(search) || (x.employeeId+'').includes(search));

  document.getElementById('staffTableBody').innerHTML = data.slice(0,200).map(x => {
    const stCls = x.status==='Đang làm việc'?'assigned':'breakdown';
    return `<tr>
      <td>${x.stt||''}</td>
      <td style="font-weight:600;color:var(--text-primary)">${x.employeeId||''}</td>
      <td>${x.name||''}</td><td>${x.phone||''}</td>
      <td>${x.position||''}</td><td>${x.supervisor||''}</td>
      <td>${x.route||''}</td>
      <td><span class="status ${stCls}">${x.status||''}</span></td>
      <td>${x.seniority||''}</td>
    </tr>`;
  }).join('');
}

// ==================== PAGE 6: TĂNG CƯỜNG LẤY ====================
function renderReinforcement() {
  const r = DATA.reinforcement;
  const statuses = {};
  r.forEach(x => { if(x.status) statuses[x.status]=(statuses[x.status]||0)+1; });
  const hasVehicle = statuses['Có xe']||0;
  const noVehicle = statuses['Không có xe']||0;
  const cancelled = r.filter(x => x.status && x.status.startsWith('Hủy')).length;
  const suppliers = {};
  r.forEach(x => { if(x.supplier && typeof x.supplier === 'string') suppliers[x.supplier]=(suppliers[x.supplier]||0)+1; });

  document.getElementById('reinforcementKPIs').innerHTML = makeKPI([
    {l:'Tổng ticket', v:r.length, c:'blue', i:'📦'},
    {l:'Có xe', v:hasVehicle, c:'green', i:'✅'},
    {l:'Không có xe', v:noVehicle, c:'red', i:'❌'},
    {l:'Đã hủy', v:cancelled, c:'orange', i:'🚫'}
  ]);

  populateSelect('filterReinfStatus', Object.keys(statuses).sort());
  populateSelect('filterReinfSupplier', Object.keys(suppliers).sort());
  renderReinforcementTable();
}

function renderReinforcementTable() {
  const statusF = document.getElementById('filterReinfStatus').value;
  const supF = document.getElementById('filterReinfSupplier').value;
  const search = (document.getElementById('searchReinf').value||'').toLowerCase();
  let data = DATA.reinforcement;
  if (statusF) data = data.filter(x => x.status === statusF);
  if (supF) data = data.filter(x => x.supplier === supF);
  if (search) data = data.filter(x => (x.ticketId||'').toLowerCase().includes(search) || (x.warehouse||'').toLowerCase().includes(search));

  document.getElementById('reinforcementTableBody').innerHTML = data.slice(0,200).map(x => {
    const stCls = x.status==='Có xe'?'assigned':x.status==='Không có xe'?'breakdown':x.status&&x.status.startsWith('Hủy')?'delayed':'unassigned';
    return `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${x.ticketId||''}</td>
      <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis" title="${x.warehouse||''}">${x.warehouse||''}</td>
      <td>${x.route||''}</td><td>${x.packages||''}</td>
      <td>${x.date||''}</td><td>${x.arrivalTime||''}</td>
      <td><span class="status ${stCls}">${x.status||''}</span></td>
      <td>${x.supplier||''}</td><td>${x.plate||''}</td><td>${x.tonnage||''}</td>
    </tr>`;
  }).join('');
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  renderDashboard();
  renderDashboardCharts();
  window._dashChartsRendered = true;
  renderVehicles();
  renderSchedule();
  renderFines();
  renderEfficiency();
  renderStaff();
  renderReinforcement();
});
