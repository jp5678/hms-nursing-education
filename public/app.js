// ----------------------------------------------------
// HMS Client Application (Nursing Informatics Focus)
// ----------------------------------------------------

let currentUser = null;
let currentView = 'dashboard';
let charts = {}; // Store Chart instances to destroy/recreate safely

// API URL helper
const API_BASE = '/api';

// On page load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme
  initTheme();

  // Check session storage for user persistence
  const savedUser = sessionStorage.getItem('hms_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    initApp();
  } else {
    showLogin();
  }

  // Bind Login Form
  document.getElementById('login-form').addEventListener('submit', handleLogin);
});

// ----------------------------------------------------
// THEME MANAGEMENT (Dark / Light Mode)
// ----------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem('hms_theme');
  const isLight = savedTheme === 'light';
  if (isLight) {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('hms_theme', isLight ? 'light' : 'dark');
  updateThemeUI(isLight);
  
  // Refresh view to apply new grid/text colors to Chart.js
  if (currentView === 'dashboard') {
    renderView('dashboard');
  }
}

function updateThemeUI(isLight) {
  const iconLight = document.getElementById('theme-icon-light');
  const iconDark = document.getElementById('theme-icon-dark');
  const pageTitle = document.getElementById('page-title');

  if (!iconLight || !iconDark) return;

  if (isLight) {
    iconLight.style.display = 'inline-block';
    iconDark.style.display = 'none';
    if (pageTitle) {
      pageTitle.classList.remove('text-light');
      pageTitle.classList.add('text-dark');
    }
  } else {
    iconLight.style.display = 'none';
    iconDark.style.display = 'inline-block';
    if (pageTitle) {
      pageTitle.classList.remove('text-dark');
      pageTitle.classList.add('text-light');
    }
  }
}


// ----------------------------------------------------
// AUTHENTICATION
// ----------------------------------------------------
function showLogin() {
  document.getElementById('login-section').style.display = 'flex';
  document.getElementById('app-layout').style.display = 'none';
}

function initApp() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('app-layout').style.display = 'flex';
  
  // Set User Display
  document.getElementById('user-display-name').innerText = currentUser.name;
  document.getElementById('user-display-role').innerText = getRoleName(currentUser.role);
  document.getElementById('user-role-badge').innerText = getRoleName(currentUser.role);

  // Apply Current Theme UI Status
  updateThemeUI(document.body.classList.contains('light-mode'));

  // Check RBAC menu visibility
  if (currentUser.role === 'admin') {
    document.getElementById('menu-staff').style.display = 'block';
  } else {
    document.getElementById('menu-staff').style.display = 'none';
  }

  // Load Dashboard by default
  navigate('dashboard');
}

function getRoleName(role) {
  switch (role) {
    case 'admin': return '시스템 관리자';
    case 'doctor': return '담당 의사';
    case 'nurse': return '임상 간호사';
    default: return '사용자';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const id = document.getElementById('login-id').value;
  const password = document.getElementById('login-password').value;

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password })
    });
    
    const result = await response.json();
    if (result.success) {
      currentUser = result.user;
      sessionStorage.setItem('hms_user', JSON.stringify(currentUser));
      initApp();
    } else {
      showToast(result.message || '로그인 실패');
    }
  } catch (err) {
    console.error(err);
    showToast('서버와의 통신에 실패했습니다.');
  }
}

function quickLogin(roleId) {
  document.getElementById('login-id').value = roleId;
  document.getElementById('login-password').value = roleId;
  document.getElementById('login-form').dispatchEvent(new Event('submit'));
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('hms_user');
  showLogin();
}

// ----------------------------------------------------
// SPA ROUTER / NAVIGATOR
// ----------------------------------------------------
function navigate(viewName) {
  currentView = viewName;
  
  // Update Active Menu State in Sidebar
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
  });
  const activeMenu = document.getElementById(`menu-${viewName}`);
  if (activeMenu) activeMenu.classList.add('active');

  // Update navbar title
  const pageTitles = {
    dashboard: '종합 모니터링 대시보드',
    patients: '환자 정보 및 안전 관리',
    appointments: '외래 진료 예약 시스템',
    consultations: '진료 기록 및 처방전 관리',
    billings: '의료 청구 및 수납 관리',
    reports: '일일 보고서 및 성과 통계',
    staff: '의료진 및 시스템 관리자 설정'
  };
  const pageTitle = document.getElementById('page-title');
  pageTitle.innerText = pageTitles[viewName] || '병원 관리 시스템';
  if (document.body.classList.contains('light-mode')) {
    pageTitle.classList.remove('text-light');
    pageTitle.classList.add('text-dark');
  } else {
    pageTitle.classList.remove('text-dark');
    pageTitle.classList.add('text-light');
  }

  // Render view
  renderView(viewName);
  
  // Update DIKW Guidance Panel based on current view
  updateDIKWPanel(viewName);
}

function renderView(viewName) {
  const workspace = document.getElementById('workspace-view');
  workspace.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info" role="status"></div></div>';

  switch (viewName) {
    case 'dashboard':
      loadDashboardView(workspace);
      break;
    case 'patients':
      loadPatientsView(workspace);
      break;
    case 'appointments':
      loadAppointmentsView(workspace);
      break;
    case 'consultations':
      loadConsultationsView(workspace);
      break;
    case 'billings':
      loadBillingsView(workspace);
      break;
    case 'reports':
      loadReportsView(workspace);
      break;
    case 'staff':
      loadStaffView(workspace);
      break;
  }
}

// ----------------------------------------------------
// 1. DASHBOARD VIEW
// ----------------------------------------------------
async function loadDashboardView(container) {
  try {
    const res = await fetch(`${API_BASE}/dashboard`);
    const data = await res.json();
    const kpi = data.kpis;

    container.innerHTML = `
      <!-- KPI Cards Row -->
      <div class="row g-4 mb-4">
        <div class="col-md-3">
          <div class="card-premium">
            <div class="kpi-title"><i class="fa-solid fa-users text-info me-2"></i>총 등록 환자 수</div>
            <div class="kpi-value text-info">${kpi.totalPatients}명</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card-premium">
            <div class="kpi-title"><i class="fa-solid fa-calendar-day text-primary me-2"></i>금일 외래 예약</div>
            <div class="kpi-value text-primary">${kpi.todayAppointments}건</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card-premium">
            <div class="kpi-title"><i class="fa-solid fa-won-sign text-success me-2"></i>금일 매출 (수납완료)</div>
            <div class="kpi-value text-success">${kpi.todayBilling.toLocaleString()}원</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card-premium">
            <div class="kpi-title"><i class="fa-solid fa-bed text-warning me-2"></i>재원 환자 (집중관리)</div>
            <div class="kpi-value text-warning">${kpi.inpatients}명</div>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="row g-4">
        <div class="col-md-7">
          <div class="card-premium h-100">
            <h5 class="text-light mb-3 font-heading"><i class="fa-solid fa-chart-line text-info me-2"></i>최근 환자 내원 추이</h5>
            <div style="position: relative; height: 250px;">
              <canvas id="trendChart"></canvas>
            </div>
          </div>
        </div>
        <div class="col-md-5">
          <div class="card-premium h-100">
            <h5 class="text-light mb-3 font-heading"><i class="fa-solid fa-chart-pie text-primary me-2"></i>진료과목별 분포</h5>
            <div style="position: relative; height: 250px;">
              <canvas id="specialtyChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Clinical Feeds -->
      <div class="card-premium mt-4">
        <h5 class="text-light mb-3 font-heading"><i class="fa-solid fa-bell text-warning me-2"></i>실습 모니터링 이벤트</h5>
        <div class="list-group list-group-flush" style="background: transparent;">
          <div class="list-group-item bg-transparent text-light border-secondary d-flex justify-content-between align-items-center">
            <span><span class="badge bg-danger me-2">알레르기 경보</span> P-00001 홍길동 환자는 <strong>페니실린 계열 알레르기</strong>가 등록되어 있습니다.</span>
            <small class="text-muted">실시간</small>
          </div>
          <div class="list-group-item bg-transparent text-light border-secondary d-flex justify-content-between align-items-center">
            <span><span class="badge bg-primary me-2">신규 환자</span> P-00003 이철수 환자가 소아청소년과 예약을 완료했습니다.</span>
            <small class="text-muted">1시간 전</small>
          </div>
        </div>
      </div>
    `;

    // Render Charts
    initDashboardCharts(data);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="alert alert-danger">대시보드 데이터를 불러오는 데 실패했습니다.</div>';
  }
}

function initDashboardCharts(data) {
  // Clean old charts to prevent memory leaks
  if (charts.trend) charts.trend.destroy();
  if (charts.specialty) charts.specialty.destroy();

  const isLight = document.body.classList.contains('light-mode');
  const gridColor = isLight ? '#e2e8f0' : '#222d44';
  const tickColor = isLight ? '#475569' : '#94a3b8';

  const ctxTrend = document.getElementById('trendChart').getContext('2d');
  charts.trend = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: data.registrationTrends.labels,
      datasets: [{
        label: '일별 누적 내원/등록 환자',
        data: data.registrationTrends.data,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: gridColor }, ticks: { color: tickColor } },
        x: { grid: { color: gridColor }, ticks: { color: tickColor } }
      }
    }
  });

  const ctxSpec = document.getElementById('specialtyChart').getContext('2d');
  const specLabels = Object.keys(data.specialtyDistribution);
  const specData = Object.values(data.specialtyDistribution);

  charts.specialty = new Chart(ctxSpec, {
    type: 'doughnut',
    data: {
      labels: specLabels.length > 0 ? specLabels : ['내과', '소아청소년과'],
      datasets: [{
        data: specData.length > 0 ? specData : [2, 1],
        backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: tickColor }
        }
      }
    }
  });
}

// ----------------------------------------------------
// 2. PATIENTS VIEW
// ----------------------------------------------------
async function loadPatientsView(container) {
  try {
    const res = await fetch(`${API_BASE}/patients`);
    const patients = await res.json();

    container.innerHTML = `
      <div class="row g-4">
        <!-- Patient List -->
        <div class="col-md-7">
          <div class="card-premium">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="text-light m-0 font-heading"><i class="fa-solid fa-list me-2"></i>환자 명부</h5>
              <span class="badge bg-dark border border-secondary text-info">총 ${patients.length}명</span>
            </div>
            
            <div class="table-responsive">
              <table class="table table-custom text-light">
                <thead>
                  <tr>
                    <th>환자 ID</th>
                    <th>이름</th>
                    <th>생년월일</th>
                    <th>성별</th>
                    <th>알레르기 정보</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  ${patients.map(p => `
                    <tr>
                      <td><code>${p.id}</code></td>
                      <td class="fw-bold">${p.name}</td>
                      <td>${p.birthDate}</td>
                      <td>${p.gender}</td>
                      <td>
                        ${p.allergies !== '없음' 
                          ? `<span class="allergy-alert badge-allergy"><i class="fa-solid fa-circle-exclamation me-1"></i>${p.allergies}</span>` 
                          : `<span class="badge bg-secondary">없음</span>`}
                      </td>
                      <td>
                        <button class="btn btn-sm btn-dark-outline py-1 px-2" onclick="viewPatientDetail('${p.id}')">상세</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Add Patient Form -->
        <div class="col-md-5">
          <div class="card-premium">
            <h5 class="text-light mb-3 font-heading"><i class="fa-solid fa-user-plus me-2"></i>신규 환자 등록</h5>
            <form id="new-patient-form">
              <div class="mb-3">
                <label class="form-label text-muted small">성명 <span class="text-danger">*</span></label>
                <input type="text" id="p-name" class="form-control form-control-custom" required>
              </div>
              <div class="row mb-3">
                <div class="col">
                  <label class="form-label text-muted small">생년월일 <span class="text-danger">*</span></label>
                  <input type="date" id="p-birth" class="form-control form-control-custom" required>
                </div>
                <div class="col">
                  <label class="form-label text-muted small">성별 <span class="text-danger">*</span></label>
                  <select id="p-gender" class="form-select form-control-custom" required>
                    <option value="남성">남성</option>
                    <option value="여성">여성</option>
                  </select>
                </div>
              </div>
              <div class="row mb-3">
                <div class="col">
                  <label class="form-label text-muted small">연락처</label>
                  <input type="text" id="p-phone" class="form-control form-control-custom" placeholder="010-XXXX-XXXX">
                </div>
                <div class="col">
                  <label class="form-label text-muted small">혈액형</label>
                  <select id="p-blood" class="form-select form-control-custom">
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label text-danger small fw-bold">알레르기 (알레르기 항원)</label>
                <input type="text" id="p-allergy" class="form-control form-control-custom border-danger" placeholder="예: 페니실린, 아스피린, 없음">
                <div class="form-text text-muted" style="font-size: 0.7rem;">환자 안전을 위해 반드시 정확히 입력해 주세요.</div>
              </div>
              <div class="mb-3">
                <label class="form-label text-muted small">기타 특이사항 (기왕력 등)</label>
                <textarea id="p-notes" class="form-control form-control-custom" rows="2" placeholder="기타 간호 관리 시 참고할 사항"></textarea>
              </div>
              <button type="submit" class="btn btn-cyan w-100">환자 등록 완료</button>
            </form>
          </div>
        </div>
      </div>

      <!-- Detail Modal placeholder -->
      <div id="patient-detail-container"></div>
    `;

    // Handle Form Submit
    document.getElementById('new-patient-form').addEventListener('submit', handleAddPatient);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="alert alert-danger">환자 목록을 불러오지 못했습니다.</div>';
  }
}

async function handleAddPatient(e) {
  e.preventDefault();
  const name = document.getElementById('p-name').value;
  const birthDate = document.getElementById('p-birth').value;
  const gender = document.getElementById('p-gender').value;
  const phone = document.getElementById('p-phone').value;
  const bloodType = document.getElementById('p-blood').value;
  const allergies = document.getElementById('p-allergy').value;
  const notes = document.getElementById('p-notes').value;

  try {
    const response = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, birthDate, gender, phone, bloodType, allergies, notes })
    });
    const result = await response.json();
    if (result.success) {
      showToast('신규 환자가 안전하게 등록되었습니다.', 'success');
      navigate('patients');
    } else {
      showToast(result.message || '등록 실패');
    }
  } catch (err) {
    console.error(err);
    showToast('저장에 실패했습니다.');
  }
}

async function viewPatientDetail(id) {
  try {
    const res = await fetch(`${API_BASE}/patients`);
    const patients = await res.json();
    const p = patients.find(pat => pat.id === id);
    if (!p) return;

    // 간호기록 및 진료이력 가져오기
    const nLogsRes = await fetch(`${API_BASE}/nursing-logs`);
    const nLogs = await nLogsRes.json();
    const patientLogs = nLogs.filter(log => log.patientId === id);

    const detailContainer = document.getElementById('patient-detail-container');
    detailContainer.innerHTML = `
      <div class="modal fade show" id="patientDetailModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.6);" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content glass-panel text-light border-secondary" style="background-color: var(--bg-card);">
            <div class="modal-header border-secondary">
              <h5 class="modal-title font-heading text-info"><i class="fa-solid fa-id-card me-2"></i>환자 상세 임상 프로필</h5>
              <button type="button" class="btn-close btn-close-white" onclick="closeModal('patientDetailModal')"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <p class="mb-1 text-muted small">환자 정보</p>
                  <h4>${p.name} <span class="fs-6 text-muted">(${p.gender}, ${p.birthDate}생)</span></h4>
                  <p class="mb-2"><strong>ID:</strong> <code>${p.id}</code> | <strong>혈액형:</strong> ${p.bloodType} | <strong>연락처:</strong> ${p.phone}</p>
                  
                  <div class="p-3 bg-dark border border-secondary rounded mt-3">
                    <h6 class="text-danger font-heading"><i class="fa-solid fa-triangle-exclamation me-1"></i>알레르기 (Allergies)</h6>
                    <p class="m-0 text-light ${p.allergies !== '없음' ? 'allergy-alert fw-bold' : ''}">${p.allergies}</p>
                  </div>
                  
                  <div class="p-3 bg-dark border border-secondary rounded mt-2">
                    <h6 class="text-info font-heading">의료 특이사항 / 기왕력</h6>
                    <p class="m-0 text-muted small" style="white-space: pre-line;">${p.notes || '없음'}</p>
                  </div>
                </div>

                <div class="col-md-6">
                  <h6 class="text-light font-heading border-bottom border-secondary pb-2 mb-3">
                    <i class="fa-solid fa-clipboard-user text-primary me-2"></i>최근 간호 과정 기록 (Nursing Logs)
                  </h6>
                  
                  ${patientLogs.length === 0 ? '<p class="text-muted small">작성된 간호 기록이 없습니다.</p>' : `
                    <div style="max-height: 250px; overflow-y: auto;">
                      ${patientLogs.map(log => `
                        <div class="p-2 mb-2 bg-dark rounded border-start border-3 border-info">
                          <div class="d-flex justify-content-between text-muted small mb-1">
                            <span>${log.date}</span>
                            <span>작성자: ${log.nurseName}</span>
                          </div>
                          <div class="small">
                            <strong>[진단]</strong> ${log.nursingDiagnosis}<br>
                            <strong>[계획]</strong> ${log.nursingPlan.substring(0, 30)}...
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  `}

                  <!-- Add Nursing Log directly from details (for Nurses) -->
                  <div class="mt-3">
                    <button class="btn btn-sm btn-cyan w-100" onclick="openNursingLogForm('${p.id}', '${p.name}')">새 간호기록 작성</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer border-secondary">
              <button type="button" class="btn btn-dark-outline" onclick="closeModal('patientDetailModal')">닫기</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Dynamic logging check to teach clinical step in DIKW
    const cdssText = p.allergies !== '없음' 
      ? `현재 조회 중인 ${p.name} 환자는 [${p.allergies}] 알레르기가 등록되어 있어, 약물 처방 및 투약 시 지혜(Wisdom) 단계를 활용한 적극적 교차검증(CDSS)이 활성화됩니다.`
      : `${p.name} 환자는 특이 알레르기가 등록되어 있지 않습니다. 표준 프로토콜에 의거하여 간호 중재를 진행하십시오.`;
    document.getElementById('cdss-log').innerHTML = cdssText;

  } catch (err) {
    console.error(err);
    showToast('환자 상세정보를 불러오는 데 실패했습니다.');
  }
}

function openNursingLogForm(patientId, patientName) {
  closeModal('patientDetailModal');
  
  // Render dynamic Form for Nursing Log
  const modalContainer = document.getElementById('patient-detail-container');
  modalContainer.innerHTML = `
    <div class="modal fade show" id="nursingLogModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.6);" aria-modal="true" role="dialog">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content glass-panel text-light border-secondary" style="background-color: var(--bg-card);">
          <div class="modal-header border-secondary">
            <h5 class="modal-title font-heading text-info"><i class="fa-solid fa-pen-to-square me-2"></i>간호 기록(Nursing Process) 등록</h5>
            <button type="button" class="btn-close btn-close-white" onclick="closeModal('nursingLogModal')"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted small mb-3">
              대상 환자: <strong class="text-light">${patientName} (${patientId})</strong>
            </p>
            <form id="nursing-log-form">
              <input type="hidden" id="nl-patient-id" value="${patientId}">
              
              <div class="mb-2">
                <label class="form-label text-muted small">1단계: 간호 진단 (Nursing Diagnosis)</label>
                <input type="text" id="nl-diag" class="form-control form-control-custom" placeholder="NANDA 진단 기반 예: 심박출량 감소와 관련된 호흡곤란" required>
              </div>

              <div class="mb-2">
                <label class="form-label text-muted small">2단계: 간호 계획 (Nursing Planning)</label>
                <textarea id="nl-plan" class="form-control form-control-custom" rows="2" placeholder="목표 및 세부 행동 계획 수립" required></textarea>
              </div>

              <div class="mb-2">
                <label class="form-label text-muted small">3단계: 간호 수행 (Nursing Implementation)</label>
                <textarea id="nl-impl" class="form-control form-control-custom" rows="2" placeholder="투약, 바이탈 측정, 냉찜질 등 실제 수행 사항" required></textarea>
              </div>

              <div class="mb-2">
                <label class="form-label text-muted small">4단계: 간호 평가 (Nursing Evaluation)</label>
                <textarea id="nl-eval" class="form-control form-control-custom" rows="2" placeholder="중재 후 환자 상태 및 재사정 내용"></textarea>
              </div>

              <button type="submit" class="btn btn-cyan w-100 mt-3">기록 저장</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('nursing-log-form').addEventListener('submit', handleAddNursingLog);
}

async function handleAddNursingLog(e) {
  e.preventDefault();
  const patientId = document.getElementById('nl-patient-id').value;
  const nursingDiagnosis = document.getElementById('nl-diag').value;
  const nursingPlan = document.getElementById('nl-plan').value;
  const nursingImplementation = document.getElementById('nl-impl').value;
  const nursingEvaluation = document.getElementById('nl-eval').value;

  try {
    const response = await fetch(`${API_BASE}/nursing-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        nurseId: currentUser.id,
        nurseName: currentUser.name,
        nursingDiagnosis,
        nursingPlan,
        nursingImplementation,
        nursingEvaluation
      })
    });

    const result = await response.json();
    if (result.success) {
      showToast('간호 과정(Nursing Process) 기록이 반영되었습니다.', 'success');
      closeModal('nursingLogModal');
      navigate('patients');
    } else {
      showToast(result.message || '저장 실패');
    }
  } catch (err) {
    console.error(err);
    showToast('저장에 실패했습니다.');
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  // Also clean elements inside patient-detail-container
  document.getElementById('patient-detail-container').innerHTML = '';
}

// ----------------------------------------------------
// 3. APPOINTMENTS VIEW
// ----------------------------------------------------
async function loadAppointmentsView(container) {
  try {
    const apptsRes = await fetch(`${API_BASE}/appointments`);
    const appts = await apptsRes.json();

    const patientsRes = await fetch(`${API_BASE}/patients`);
    const patients = await patientsRes.json();

    const staffRes = await fetch(`${API_BASE}/staff`);
    const staff = await staffRes.json();

    container.innerHTML = `
      <div class="row g-4">
        <!-- Appointment Queue -->
        <div class="col-md-8">
          <div class="card-premium">
            <h5 class="text-light mb-3 font-heading"><i class="fa-solid fa-clock-rotate-left me-2"></i>진료 예약 및 대기 현황</h5>
            
            <div class="table-responsive">
              <table class="table table-custom text-light">
                <thead>
                  <tr>
                    <th>예약 번호</th>
                    <th>환자명</th>
                    <th>의사명</th>
                    <th>일시</th>
                    <th>증상</th>
                    <th>상태</th>
                    <th>상태 제어</th>
                  </tr>
                </thead>
                <tbody>
                  ${appts.map(a => `
                    <tr>
                      <td><code>${a.id}</code></td>
                      <td class="fw-bold">${a.patientName}</td>
                      <td>${a.doctorName}</td>
                      <td>${a.date} ${a.time}</td>
                      <td class="small text-muted">${a.symptoms || '-'}</td>
                      <td>
                        <span class="badge ${getStatusBadgeClass(a.status)}">${a.status}</span>
                      </td>
                      <td>
                        <select class="form-select form-select-sm form-control-custom py-0" onchange="updateAppointmentStatus('${a.id}', this.value)" style="width: auto; font-size: 0.75rem;">
                          <option value="대기" ${a.status === '대기' ? 'selected' : ''}>대기</option>
                          <option value="진료중" ${a.status === '진료중' ? 'selected' : ''}>진료중</option>
                          <option value="완료" ${a.status === '완료' ? 'selected' : ''}>완료</option>
                          <option value="취소" ${a.status === '취소' ? 'selected' : ''}>취소</option>
                        </select>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Add Appointment -->
        <div class="col-md-4">
          <div class="card-premium">
            <h5 class="text-light mb-3 font-heading"><i class="fa-solid fa-calendar-plus me-2"></i>새 예약 등록</h5>
            <form id="new-appt-form">
              <div class="mb-3">
                <label class="form-label text-muted small">진료 대상 환자</label>
                <select id="appt-patient" class="form-select form-control-custom" required>
                  <option value="">환자 선택</option>
                  ${patients.map(p => `<option value="${p.id}">${p.name} (${p.birthDate})</option>`).join('')}
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label text-muted small">담당 의사</label>
                <select id="appt-doctor" class="form-select form-control-custom" required>
                  <option value="">의사 선택</option>
                  ${staff.doctors.map(d => `<option value="${d.id}">${d.name} [${d.specialty}]</option>`).join('')}
                </select>
              </div>

              <div class="row mb-3">
                <div class="col">
                  <label class="form-label text-muted small">날짜</label>
                  <input type="date" id="appt-date" class="form-control form-control-custom" value="2026-06-06" required>
                </div>
                <div class="col">
                  <label class="form-label text-muted small">시간</label>
                  <input type="time" id="appt-time" class="form-control form-control-custom" value="10:00" required>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label text-muted small">주소증 및 증상</label>
                <textarea id="appt-symptoms" class="form-control form-control-custom" rows="3" placeholder="예: 두통, 발열, 오한 등"></textarea>
              </div>

              <button type="submit" class="btn btn-cyan w-100">예약 생성</button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.getElementById('new-appt-form').addEventListener('submit', handleAddAppointment);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="alert alert-danger">예약 시스템을 로드할 수 없습니다.</div>';
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case '대기': return 'bg-secondary text-light';
    case '진료중': return 'bg-warning text-dark';
    case '완료': return 'bg-success text-light';
    case '취소': return 'bg-danger text-light';
    default: return 'bg-dark';
  }
}

async function handleAddAppointment(e) {
  e.preventDefault();
  const patientId = document.getElementById('appt-patient').value;
  const doctorId = document.getElementById('appt-doctor').value;
  const date = document.getElementById('appt-date').value;
  const time = document.getElementById('appt-time').value;
  const symptoms = document.getElementById('appt-symptoms').value;

  try {
    const response = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, doctorId, date, time, symptoms })
    });
    const result = await response.json();
    if (result.success) {
      showToast('새 예약이 성공적으로 잡혔습니다.', 'success');
      navigate('appointments');
    } else {
      showToast(result.message || '예약 생성 실패');
    }
  } catch (err) {
    console.error(err);
    showToast('저장에 실패했습니다.');
  }
}

async function updateAppointmentStatus(id, newStatus) {
  try {
    const response = await fetch(`${API_BASE}/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const result = await response.json();
    if (result.success) {
      showToast(`예약 ${id}의 상태가 [${newStatus}](으)로 변경되었습니다.`, 'success');
      navigate('appointments');
    } else {
      showToast(result.message || '상태 수정 실패');
    }
  } catch (err) {
    console.error(err);
    showToast('네트워크 오류');
  }
}

// ----------------------------------------------------
// 4. CONSULTATIONS & PRESCRIPTIONS VIEW
// ----------------------------------------------------
async function loadConsultationsView(container) {
  // Check RBAC permission (Doctors preferred, Nurses can view only)
  const isDoctor = currentUser.role === 'doctor';

  try {
    // 1. Get appointments that are active (진료중) or pending (대기)
    const apptsRes = await fetch(`${API_BASE}/appointments`);
    const appts = await apptsRes.json();
    
    // Filter active patients waiting for this doctor (or all if not doctor)
    const activeAppts = appts.filter(a => (a.status === '대기' || a.status === '진료중'));

    // 2. Get past consultations
    const consultsRes = await fetch(`${API_BASE}/consultations`);
    const consults = await consultsRes.json();

    // 3. Get all patients to match details
    const patientsRes = await fetch(`${API_BASE}/patients`);
    const patients = await patientsRes.json();

    container.innerHTML = `
      <div class="row g-4">
        <!-- Consultation Console (Left/Top) -->
        <div class="col-md-7">
          <div class="card-premium">
            <h5 class="text-light mb-3 font-heading"><i class="fa-solid fa-stethoscope me-2"></i>환자 대기 및 진료 제어판</h5>
            
            ${activeAppts.length === 0 ? '<p class="text-muted text-center py-4">대기 중이거나 진료 중인 외래 환자가 없습니다.</p>' : `
              <div class="list-group mb-4">
                ${activeAppts.map(a => {
                  const pat = patients.find(p => p.id === a.patientId);
                  return `
                    <div class="list-group-item bg-dark border-secondary text-light p-3 mb-2 rounded d-flex justify-content-between align-items-start">
                      <div>
                        <div class="d-flex align-items-center gap-2">
                          <strong class="fs-5 text-light">${a.patientName}</strong>
                          <span class="badge bg-secondary small">${a.id}</span>
                          ${pat && pat.allergies !== '없음' 
                            ? `<span class="allergy-alert badge-allergy small"><i class="fa-solid fa-circle-exclamation me-1"></i>알레르기 환자</span>` 
                            : ''
                          }
                        </div>
                        <p class="m-0 text-muted small mt-1"><strong>예약 일시:</strong> ${a.date} ${a.time} | <strong>의사:</strong> ${a.doctorName}</p>
                        <p class="m-0 text-muted small"><strong>주소증(CC):</strong> ${a.symptoms}</p>
                      </div>
                      <div>
                        ${isDoctor ? `
                          <button class="btn btn-sm btn-cyan" onclick="startConsultation('${a.id}', '${a.patientId}', '${a.patientName}', '${a.symptoms.replace(/'/g, "\\'")}')">진료 시작</button>
                        ` : `
                          <button class="btn btn-sm btn-dark-outline" disabled>간호사 관찰용</button>
                        `}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}

            <!-- Consultation Form -->
            <div id="active-consultation-form-container" style="display: none;" class="border-top border-secondary pt-3">
              <h5 class="text-info font-heading mb-3"><i class="fa-solid fa-notes-medical me-2"></i>전자 차트 및 처방전 작성</h5>
              <form id="consultation-form">
                <input type="hidden" id="c-appt-id">
                <input type="hidden" id="c-patient-id">
                
                <div class="mb-3 text-muted small">
                  대상 환자: <strong class="text-light fs-6" id="c-patient-display">성명</strong>
                </div>

                <div class="mb-3">
                  <label class="form-label text-muted small">주소증 및 주 호소 (Chief Complaint)</label>
                  <textarea id="c-cc" class="form-control form-control-custom" rows="2" required></textarea>
                </div>

                <div class="mb-3">
                  <label class="form-label text-muted small">진단명 / 한국표준질병사인분류 (ICD-10 Code)</label>
                  <input type="text" id="c-diag" class="form-control form-control-custom" placeholder="예: 상세불명의 고혈압 (I10.9) 또는 급성 편도염 (J03.9)" required>
                </div>

                <!-- Prescription Builder -->
                <div class="p-3 bg-dark border border-secondary rounded mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="text-info font-heading m-0"><i class="fa-solid fa-pills me-1"></i>처방 의약품 (Prescriptions)</h6>
                    <button type="button" class="btn btn-sm btn-outline-info py-0 px-2" onclick="addPrescriptionRow()"><i class="fa-solid fa-plus me-1"></i>약품 추가</button>
                  </div>
                  
                  <div id="prescription-rows-container">
                    <!-- Row templates will be inserted here dynamically -->
                  </div>
                </div>

                <div class="d-flex gap-2">
                  <button type="submit" class="btn btn-cyan w-100">전자 서명 및 처방 전송</button>
                  <button type="button" class="btn btn-dark-outline" onclick="cancelActiveConsultation()">취소</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Consultation History (Right/Bottom) -->
        <div class="col-md-5">
          <div class="card-premium">
            <h5 class="text-light mb-3 font-heading"><i class="fa-solid fa-history me-2"></i>최근 진료 & 처방 이력</h5>
            <div style="max-height: 500px; overflow-y: auto;">
              ${consults.length === 0 ? '<p class="text-muted small">기록된 과거 진료 내역이 없습니다.</p>' : `
                ${consults.map(c => {
                  const patName = patients.find(p => p.id === c.patientId)?.name || '알수없음';
                  return `
                    <div class="p-3 bg-dark border border-secondary rounded mb-3">
                      <div class="d-flex justify-content-between text-muted small mb-2">
                        <span><strong>진료일:</strong> ${c.date}</span>
                        <span><strong>환자:</strong> ${patName}</span>
                      </div>
                      <div class="mb-2">
                        <strong class="text-info small">진단:</strong> <span class="small">${c.diagnosis}</span>
                      </div>
                      <div class="mb-2">
                        <strong class="text-info small">주소증:</strong> <p class="m-0 text-muted small" style="white-space: pre-line;">${c.chiefComplaint}</p>
                      </div>
                      
                      <div class="border-top border-secondary pt-2 mt-2">
                        <strong class="text-warning small d-block mb-1"><i class="fa-solid fa-file-prescription me-1"></i>처방약:</strong>
                        <ul class="m-0 ps-3 text-muted small">
                          ${c.prescriptions.map(p => `
                            <li>${p.drugName} (${p.dosage} / ${p.route} / ${p.frequency})</li>
                          `).join('')}
                        </ul>
                      </div>
                    </div>
                  `;
                }).join('')}
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind consultation form submit
    if (isDoctor) {
      document.getElementById('consultation-form').addEventListener('submit', handleConsultationSubmit);
    }

  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="alert alert-danger">진료 화면 로딩에 실패했습니다.</div>';
  }
}

// Global functions for prescription interactions
function startConsultation(apptId, patientId, patientName, symptoms) {
  document.getElementById('c-appt-id').value = apptId;
  document.getElementById('c-patient-id').value = patientId;
  document.getElementById('c-patient-display').innerText = `${patientName} (${patientId})`;
  document.getElementById('c-cc').value = symptoms;
  document.getElementById('c-diag').value = '';
  document.getElementById('prescription-rows-container').innerHTML = '';
  
  // Show consultation console
  document.getElementById('active-consultation-form-container').style.display = 'block';
  
  // Pre-add one empty row
  addPrescriptionRow();

  // Scroll to view
  document.getElementById('active-consultation-form-container').scrollIntoView({ behavior: 'smooth' });

  // CDSS simulation logging
  document.getElementById('cdss-log').innerText = `[${patientName}] 환자 진료 시작. 차트 입력 대기 중.`;
}

function cancelActiveConsultation() {
  document.getElementById('active-consultation-form-container').style.display = 'none';
  document.getElementById('cdss-log').innerText = '진료 작업이 취소되었습니다.';
}

function addPrescriptionRow() {
  const container = document.getElementById('prescription-rows-container');
  const index = container.children.length;
  
  const row = document.createElement('div');
  row.className = 'row g-2 mb-2 prescription-row align-items-end';
  row.innerHTML = `
    <div class="col-md-4">
      <label class="form-label text-muted" style="font-size: 0.65rem;">약물명</label>
      <input type="text" class="form-control form-control-custom py-1 rx-drug" placeholder="예: Penicillin G" required>
    </div>
    <div class="col-md-2">
      <label class="form-label text-muted" style="font-size: 0.65rem;">1회 용량</label>
      <input type="text" class="form-control form-control-custom py-1 rx-dosage" placeholder="예: 500mg" required>
    </div>
    <div class="col-md-3">
      <label class="form-label text-muted" style="font-size: 0.65rem;">투여 경로</label>
      <select class="form-select form-control-custom py-1 rx-route" required>
        <option value="경구(PO)">경구(PO)</option>
        <option value="정맥주사(IV)">정맥주사(IV)</option>
        <option value="근육주사(IM)">근육주사(IM)</option>
        <option value="피하주사(SC)">피하주사(SC)</option>
        <option value="외용제(Topical)">외용제(Topical)</option>
      </select>
    </div>
    <div class="col-md-2">
      <label class="form-label text-muted" style="font-size: 0.65rem;">투여 횟수</label>
      <input type="text" class="form-control form-control-custom py-1 rx-freq" placeholder="예: 1일 3회" required>
    </div>
    <div class="col-md-1 text-end">
      <button type="button" class="btn btn-sm btn-outline-danger py-1" onclick="this.parentElement.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>
    </div>
  `;
  container.appendChild(row);
}

// ----------------------------------------------------
// CDSS ALLERGY VERIFIER (THE WISDOM LAYER)
// ----------------------------------------------------
async function handleConsultationSubmit(e) {
  e.preventDefault();
  const apptId = document.getElementById('c-appt-id').value;
  const patientId = document.getElementById('c-patient-id').value;
  const chiefComplaint = document.getElementById('c-cc').value;
  const diagnosis = document.getElementById('c-diag').value;

  // Retrieve prescriptions from rows
  const rxRows = document.querySelectorAll('.prescription-row');
  const prescriptions = [];
  
  for (let row of rxRows) {
    prescriptions.push({
      drugName: row.querySelector('.rx-drug').value.trim(),
      dosage: row.querySelector('.rx-dosage').value.trim(),
      route: row.querySelector('.rx-route').value,
      frequency: row.querySelector('.rx-freq').value.trim()
    });
  }

  // Fetch Patient info to check allergy cross match
  try {
    const pRes = await fetch(`${API_BASE}/patients`);
    const patients = await pRes.json();
    const patient = patients.find(p => p.id === patientId);

    if (patient && patient.allergies !== '없음') {
      // CDSS logic check: Check if drugName contains words matching the patient's allergy
      // e.g. Patient allergy = "페니실린(Penicillin)", drug name input = "Penicillin V" or "페니실린 G"
      const allergyKeyword = patient.allergies.toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
      
      const dangerousPrescription = prescriptions.find(rx => {
        const drugClean = rx.drugName.toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
        // Check partial overlap: if penicillin is in Penicillin G
        return drugClean.includes(allergyKeyword) || allergyKeyword.includes(drugClean);
      });

      if (dangerousPrescription) {
        // [CDSS Wisdom Alert Triggered!]
        showCDSSWarningModal(patient.name, patient.allergies, dangerousPrescription.drugName, () => {
          // If user decides to proceed anyway (overriding warning - sometimes necessary but must log)
          submitConsultationToServer(apptId, patientId, chiefComplaint, diagnosis, prescriptions, true);
        });
        return; // Halt regular submission
      }
    }

    // No warning or clean, submit directly
    submitConsultationToServer(apptId, patientId, chiefComplaint, diagnosis, prescriptions, false);

  } catch (error) {
    console.error(error);
    showToast('환자 대조 및 처방 검증 중 오류가 발생했습니다.');
  }
}

function showCDSSWarningModal(patientName, patientAllergy, targetDrug, onAcceptOverride) {
  // Show dynamic warning pop-up
  const alertContainer = document.getElementById('patient-detail-container');
  alertContainer.innerHTML = `
    <div class="modal fade show animate-pulse" id="cdssAlertModal" tabindex="-1" style="display: block; background: rgba(244,63,94,0.4);" aria-modal="true" role="dialog">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content text-light border-danger" style="background-color: #1a0f12;">
          <div class="modal-header border-danger">
            <h5 class="modal-title font-heading text-danger fw-bold"><i class="fa-solid fa-triangle-exclamation me-2 animate-bounce"></i>[CDSS 경고] 치명적 환자 안전 경고</h5>
          </div>
          <div class="modal-body text-center p-4">
            <span class="fs-1 text-danger d-block mb-3"><i class="fa-solid fa-biohazard"></i></span>
            <h4 class="text-light">${patientName} 환자 약물 투약 안전 위배</h4>
            <p class="text-muted mt-3">
              이 환자는 <strong class="text-danger">${patientAllergy} 알레르기</strong> 병력이 존재합니다.<br>
              현재 입력된 처방약물: <strong class="text-warning">${targetDrug}</strong>
            </p>
            <div class="alert alert-danger text-start small mt-3">
              <strong>[지식 근거 (Knowledge):]</strong> 페니실린 및 유사 베타락탐계 항생제는 알레르기 병력이 있는 환자에게 아나필락시스 쇼크, 기도 부종 또는 중증 알레르기 피부 발병(Steven-Johnson syndrome)을 일으킬 수 있어 투여 금기입니다.
            </div>
            <p class="text-muted small">해당 처방을 반려하고 다른 항생제(예: 세펨계 대체 또는 퀴놀론계 등)로 대체하시겠습니까?</p>
          </div>
          <div class="modal-footer border-danger d-flex justify-content-between">
            <button type="button" class="btn btn-outline-light" onclick="closeCDSSAlertAndRedesign()">처방 수정 (권장)</button>
            <button type="button" class="btn btn-danger" id="cdss-override-btn">경고 무시하고 진행</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Log to CDSS Simulator panel
  document.getElementById('cdss-log').innerHTML = `
    <span class="text-danger fw-bold"><i class="fa-solid fa-triangle-exclamation"></i> CDSS 경보 발동:</span><br>
    ${patientName} 환자에게 알레르기 유발 항원인 [${targetDrug}]이(가) 포함되어 처약을 긴급 통제했습니다.
  `;

  document.getElementById('cdss-override-btn').onclick = () => {
    closeModal('cdssAlertModal');
    onAcceptOverride();
  };
}

function closeCDSSAlertAndRedesign() {
  closeModal('cdssAlertModal');
  document.getElementById('cdss-log').innerHTML = '의사가 CDSS 경고를 수락하고 안전한 약물 처방을 위해 입력을 재수정하고 있습니다.';
}

async function submitConsultationToServer(apptId, patientId, chiefComplaint, diagnosis, prescriptions, isOverridden = false) {
  try {
    const response = await fetch(`${API_BASE}/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: apptId, patientId, doctorId: currentUser.id, chiefComplaint, diagnosis, prescriptions })
    });
    
    const result = await response.json();
    if (result.success) {
      if (isOverridden) {
        showToast('경고를 무시하고 강제 처방이 전송되었습니다. 안전 보고서에 기록됩니다.', 'warning');
      } else {
        showToast('성공적으로 진료가 등록되고 처방이 완료되었습니다.', 'success');
      }
      navigate('consultations');
    } else {
      showToast(result.message || '진료 기록 실패');
    }
  } catch (err) {
    console.error(err);
    showToast('저장에 실패했습니다.');
  }
}

// ----------------------------------------------------
// 5. BILLINGS VIEW
// ----------------------------------------------------
async function loadBillingsView(container) {
  try {
    const billRes = await fetch(`${API_BASE}/billings`);
    const billings = await billRes.json();

    container.innerHTML = `
      <div class="card-premium">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="text-light m-0 font-heading"><i class="fa-solid fa-file-invoice-dollar me-2"></i>의료 청구 & 수납 현황</h5>
          <span class="badge bg-dark border border-secondary text-info">미납 내역: ${billings.filter(b => b.status === '미납').length}건</span>
        </div>

        <div class="table-responsive">
          <table class="table table-custom text-light">
            <thead>
              <tr>
                <th>청구 번호</th>
                <th>환자명</th>
                <th>청구 일시</th>
                <th>진료비</th>
                <th>검사비</th>
                <th>약제비</th>
                <th>합계 금액</th>
                <th>수납 상태</th>
                <th>조치</th>
              </tr>
            </thead>
            <tbody>
              ${billings.map(b => `
                <tr>
                  <td><code>${b.id}</code></td>
                  <td class="fw-bold">${b.patientName}</td>
                  <td>${b.date}</td>
                  <td>${b.fees.consultation.toLocaleString()}원</td>
                  <td>${b.fees.examination.toLocaleString()}원</td>
                  <td>${b.fees.pharmacy.toLocaleString()}원</td>
                  <td class="fw-bold text-info">${b.totalAmount.toLocaleString()}원</td>
                  <td>
                    <span class="badge ${b.status === '완료' ? 'bg-success' : 'bg-danger'}">${b.status === '완료' ? '완납' : '미납'}</span>
                  </td>
                  <td>
                    ${b.status === '미납' 
                      ? `<button class="btn btn-sm btn-cyan py-0 px-2" onclick="payBilling('${b.id}')">수납 처리</button>` 
                      : `<button class="btn btn-sm btn-dark-outline py-0 px-2" onclick="viewReceipt('${b.id}')">영수증</button>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Detail Modal placeholder -->
      <div id="billing-detail-container"></div>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="alert alert-danger">청구 목록 로드 실패</div>';
  }
}

async function payBilling(id) {
  try {
    const response = await fetch(`${API_BASE}/billings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '완료' })
    });
    const result = await response.json();
    if (result.success) {
      showToast(`청구건 ${id} 수납 완료되었습니다.`, 'success');
      navigate('billings');
    } else {
      showToast(result.message || '수납 처리 실패');
    }
  } catch (err) {
    console.error(err);
    showToast('수납 오류');
  }
}

async function viewReceipt(id) {
  try {
    const billRes = await fetch(`${API_BASE}/billings`);
    const billings = await billRes.json();
    const b = billings.find(bill => bill.id === id);
    if (!b) return;

    const modalContainer = document.getElementById('billing-detail-container');
    modalContainer.innerHTML = `
      <div class="modal fade show" id="receiptModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.6);" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content glass-panel text-light border-secondary" style="background-color: var(--bg-card);">
            <div class="modal-header border-secondary">
              <h5 class="modal-title font-heading text-success"><i class="fa-solid fa-receipt me-2"></i>수납 영수증</h5>
              <button type="button" class="btn-close btn-close-white" onclick="closeReceipt()"></button>
            </div>
            <div class="modal-body p-4 print-page">
              <div class="text-center mb-4">
                <h4>HMS 대학병원 영수증</h4>
                <p class="text-muted small">발행일: ${b.date} | 영수증 번호: ${b.id}</p>
              </div>
              <table class="table text-light border-secondary small">
                <tbody>
                  <tr>
                    <td>환자 성명</td>
                    <td class="text-end fw-bold">${b.patientName} (${b.patientId})</td>
                  </tr>
                  <tr>
                    <td>진찰 진료비</td>
                    <td class="text-end">${b.fees.consultation.toLocaleString()}원</td>
                  </tr>
                  <tr>
                    <td>검사/검진비</td>
                    <td class="text-end">${b.fees.examination.toLocaleString()}원</td>
                  </tr>
                  <tr>
                    <td>처방 및 약제비</td>
                    <td class="text-end">${b.fees.pharmacy.toLocaleString()}원</td>
                  </tr>
                  <tr class="border-top border-2 border-secondary">
                    <td class="fw-bold fs-6">총액 (수납완료)</td>
                    <td class="text-end text-info fw-bold fs-6">${b.totalAmount.toLocaleString()}원</td>
                  </tr>
                </tbody>
              </table>
              <div class="text-center mt-4 pt-3 border-top border-dashed border-secondary text-muted" style="font-size: 0.75rem;">
                상기 금액을 정히 영수함.<br>
                HMS 의료정보 실습 시뮬레이션용 가상 데이터
              </div>
            </div>
            <div class="modal-footer border-secondary">
              <button type="button" class="btn btn-cyan" onclick="window.print()"><i class="fa-solid fa-print me-1"></i>출력</button>
              <button type="button" class="btn btn-dark-outline" onclick="closeReceipt()">닫기</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

function closeReceipt() {
  document.getElementById('receiptModal').style.display = 'none';
  document.getElementById('billing-detail-container').innerHTML = '';
}

// ----------------------------------------------------
// 6. REPORTS VIEW (PRINT OPTIMIZED)
// ----------------------------------------------------
async function loadReportsView(container) {
  try {
    const billRes = await fetch(`${API_BASE}/billings`);
    const billings = await billRes.json();
    
    const patientsRes = await fetch(`${API_BASE}/patients`);
    const patients = await patientsRes.json();

    const unpaidCount = billings.filter(b => b.status === '미납').length;
    const unpaidAmount = billings.filter(b => b.status === '미납').reduce((sum, b) => sum + b.totalAmount, 0);

    container.innerHTML = `
      <div class="row g-4 no-print mb-4">
        <div class="col-md-6">
          <div class="card-premium">
            <h5 class="text-light mb-2 font-heading"><i class="fa-solid fa-circle-exclamation text-danger me-2"></i>미납 요약 보고</h5>
            <p class="text-muted small">원활한 병원 재정 관리를 위한 미수금 분석 데이터입니다.</p>
            <div class="d-flex justify-content-around mt-3">
              <div class="text-center">
                <span class="text-muted small d-block">미납 건수</span>
                <span class="fs-4 fw-bold text-danger">${unpaidCount}건</span>
              </div>
              <div class="text-center border-start border-secondary ps-4">
                <span class="text-muted small d-block">미납 총액</span>
                <span class="fs-4 fw-bold text-warning">${unpaidAmount.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="card-premium">
            <h5 class="text-light mb-2 font-heading"><i class="fa-solid fa-tools text-primary me-2"></i>보고서 인쇄 제어</h5>
            <p class="text-muted small">출력 시 브라우저 인쇄 모드에 맞춰 사이드바와 설정 패널이 자동 가림 처리됩니다.</p>
            <button class="btn btn-cyan w-100 mt-3" onclick="window.print()">
              <i class="fa-solid fa-print me-2"></i>인쇄용 보고서 출력하기
            </button>
          </div>
        </div>
      </div>

      <!-- Printable Report Layout (A4 format optimized) -->
      <div class="card-premium print-include print-page" id="printable-report-area">
        <div class="print-header text-center mb-4 pb-2 border-bottom border-secondary">
          <h2 class="text-light font-heading">일일 미납 진료비 및 환자 통계 보고서</h2>
          <p class="text-muted small">출력 시간: 2026-06-06 | 보고 기관: HMS 대학병원 실습본부</p>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-md-6">
            <h6 class="text-info font-heading">1. 기본 지표 요약</h6>
            <table class="table table-bordered table-custom text-light small">
              <tbody>
                <tr>
                  <td>총 등록 환자 수</td>
                  <td class="text-end fw-bold text-light">${patients.length}명</td>
                </tr>
                <tr>
                  <td>미결제 미납 청구 건수</td>
                  <td class="text-end fw-bold text-danger">${unpaidCount}건</td>
                </tr>
                <tr>
                  <td>미결제 총합 미수액</td>
                  <td class="text-end fw-bold text-warning">${unpaidAmount.toLocaleString()}원</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="col-md-6">
            <h6 class="text-info font-heading">2. 환자 안전 지표 (알레르기 보유자)</h6>
            <table class="table table-bordered table-custom text-light small">
              <thead>
                <tr>
                  <th>환자명</th>
                  <th>등록 알레르기</th>
                  <th>성별</th>
                </tr>
              </thead>
              <tbody>
                ${patients.filter(p => p.allergies !== '없음').map(p => `
                  <tr>
                    <td>${p.name}</td>
                    <td class="text-danger fw-bold">${p.allergies}</td>
                    <td>${p.gender}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h6 class="text-info font-heading">3. 미결제 청구자 명세 목록</h6>
          <div class="table-responsive">
            <table class="table table-custom table-bordered text-light small">
              <thead>
                <tr>
                  <th>청구 번호</th>
                  <th>환자 성명</th>
                  <th>청구 일시</th>
                  <th>진찰비</th>
                  <th>검사비</th>
                  <th>약제비</th>
                  <th>청구 총액</th>
                </tr>
              </thead>
              <tbody>
                ${billings.filter(b => b.status === '미납').map(b => `
                  <tr>
                    <td><code>${b.id}</code></td>
                    <td class="fw-bold">${b.patientName}</td>
                    <td>${b.date}</td>
                    <td>${b.fees.consultation.toLocaleString()}원</td>
                    <td>${b.fees.examination.toLocaleString()}원</td>
                    <td>${b.fees.pharmacy.toLocaleString()}원</td>
                    <td class="fw-bold text-warning">${b.totalAmount.toLocaleString()}원</td>
                  </tr>
                `).join('')}
                ${billings.filter(b => b.status === '미납').length === 0 ? `
                  <tr>
                    <td colspan="7" class="text-center text-muted">미납된 청구서가 없습니다. Clean State.</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>

        <div class="text-center mt-5 pt-4 border-top border-secondary text-muted" style="font-size: 0.8rem;">
          위 보고서는 병원 내 의료정보 데이터 흐름을 기반으로 작성되었습니다.<br>
          확인자: HMS 솔루션 아키텍트 (서명)
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="alert alert-danger">보고서 데이터를 집계하지 못했습니다.</div>';
  }
}

// ----------------------------------------------------
// 7. STAFF VIEW (ADMIN ONLY)
// ----------------------------------------------------
async function loadStaffView(container) {
  try {
    const res = await fetch(`${API_BASE}/staff`);
    const staff = await res.json();

    container.innerHTML = `
      <div class="row g-4">
        <!-- Doctors List -->
        <div class="col-md-6">
          <div class="card-premium">
            <h5 class="text-light mb-3 font-heading"><i class="fa-solid fa-user-doctor text-primary me-2"></i>의사 목록 (Doctors)</h5>
            <div class="table-responsive">
              <table class="table table-custom text-light">
                <thead>
                  <tr>
                    <th>의사 ID</th>
                    <th>성명</th>
                    <th>진료 과목</th>
                    <th>면허 번호</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  ${staff.doctors.map(d => `
                    <tr>
                      <td><code>${d.id}</code></td>
                      <td class="fw-bold">${d.name}</td>
                      <td><span class="badge bg-primary">${d.specialty}</span></td>
                      <td><code>${d.licenseNo}</code></td>
                      <td><span class="badge bg-success">${d.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Nurses List -->
        <div class="col-md-6">
          <div class="card-premium">
            <h5 class="text-light mb-3 font-heading"><i class="fa-solid fa-user-nurse text-success me-2"></i>간호사 목록 (Nurses)</h5>
            <div class="table-responsive">
              <table class="table table-custom text-light">
                <thead>
                  <tr>
                    <th>간호사 ID</th>
                    <th>성명</th>
                    <th>소속 부서</th>
                    <th>면허 번호</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  ${staff.nurses.map(n => `
                    <tr>
                      <td><code>${n.id}</code></td>
                      <td class="fw-bold">${n.name}</td>
                      <td><span class="badge bg-success">${n.specialty}</span></td>
                      <td><code>${n.licenseNo}</code></td>
                      <td><span class="badge bg-success">${n.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="alert alert-danger">직원 정보를 불러오지 못했습니다.</div>';
  }
}

// ----------------------------------------------------
// DIKW MODEL INSTRUCTION GUIDE CHANGER
// ----------------------------------------------------
function updateDIKWPanel(viewName) {
  // Reset all steps active classes
  document.querySelectorAll('.dikw-step').forEach(step => {
    step.classList.remove('active');
  });

  const d = document.getElementById('dikw-data-text');
  const i = document.getElementById('dikw-info-text');
  const k = document.getElementById('dikw-knowledge-text');
  const w = document.getElementById('dikw-wisdom-text');

  switch (viewName) {
    case 'dashboard':
      document.getElementById('dikw-data').classList.add('active');
      d.innerHTML = "<strong>Data:</strong> 내원 환자수, 미결제액, 재원 환자 상태 등 <strong>원시 데이터</strong>가 입력됩니다.";
      i.innerHTML = "<strong>Information:</strong> 입력 데이터를 Chart.js로 가공하여 <strong>내원자 수의 변동과 진료과 분포 비율 정보</strong>로 변환시킵니다.";
      k.innerHTML = "<strong>Knowledge:</strong> 축적된 통계를 바탕으로 내과 환자가 소아과보다 높은 유입률을 지닌다는 <strong>비즈니스 통찰 지식</strong>을 습득합니다.";
      w.innerHTML = "<strong>Wisdom:</strong> 지식을 토대로 겨울철 소아과 인력을 내과로 전환 재배치하는 등의 <strong>지혜로운 의사결정</strong>을 내립니다.";
      break;

    case 'patients':
      document.getElementById('dikw-info').classList.add('active');
      d.innerHTML = "<strong>Data:</strong> 환자 이름(홍길동), 생년월일, 혈액형(A+), 알레르기 원인('페니실린')을 직접 입력하는 단계입니다.";
      i.innerHTML = "<strong>Information:</strong> 환자 전산 프로필 상에 알레르기가 있는 환자임을 <strong>붉은색 경고 마크로 가공 및 맥락화</strong>하여 즉각 식별이 가능하게 만듭니다.";
      k.innerHTML = "<strong>Knowledge:</strong> 최신 임상 가이드라인 지식을 대조하여, '페니실린 계열 항생제 투약은 아나필락시스 쇼크를 유발하므로 절대 불가하다'는 규칙을 적용합니다.";
      w.innerHTML = "<strong>Wisdom:</strong> 환자가 입원하거나 다른 치료를 받을 때 차트에 연동된 알레르기 플래그를 사전에 대조하여 <strong>오투약을 완벽히 차단</strong>합니다.";
      break;

    case 'appointments':
      document.getElementById('dikw-data').classList.add('active');
      d.innerHTML = "<strong>Data:</strong> 환자 아이디, 지정된 의사, 예약 날짜, 외래 시간, 호소 증상 등의 원시 텍스트를 기입합니다.";
      i.innerHTML = "<strong>Information:</strong> 이 예약을 '진료 대기 순서'에 자동 정렬하여 <strong>오늘 담당 의사가 대기자로 식별 가능하도록 정보화</strong>합니다.";
      k.innerHTML = "<strong>Knowledge:</strong> 환자의 대기 상태(진료 대기, 완료 등) 규칙을 통해 의료 자원 배분 표준 프로토콜을 이해합니다.";
      w.innerHTML = "<strong>Wisdom:</strong> 환자의 대기 시간 및 진료 우선순위(Triage)를 고려하여 효율적으로 외래 프로세스를 최적화합니다.";
      break;

    case 'consultations':
      document.getElementById('dikw-wisdom').classList.add('active');
      d.innerHTML = "<strong>Data:</strong> 의사가 작성하는 주소증(두통) 및 진단 입력 데이터.";
      i.innerHTML = "<strong>Information:</strong> 이 질병의 명세를 <strong>국제표준코드인 ICD-10 표준(I10.9)</strong>에 대조하여 질병 코드로 가공합니다.";
      k.innerHTML = "<strong>Knowledge:</strong> 이 질병의 치료 표준 프로토콜을 대조하여 Metformin(당뇨) 또는 페니실린 계열 항생제 등 약물 지식을 매치합니다.";
      w.innerHTML = "<strong>Wisdom:</strong> <u>임상 의사결정 지원 시스템(CDSS)</u>이 작동하여 환자 알레르기 원인(페니실린)과 일치하는 투약을 처방 단계에서 실시간 확인하여 <strong>경고 및 처방 취소를 강제 유도</strong>합니다.";
      break;

    case 'billings':
      document.getElementById('dikw-info').classList.add('active');
      d.innerHTML = "<strong>Data:</strong> 진료비 15,000원, 검사비 5,000원, 약제비 8,000원 등의 단가 원자료.";
      i.innerHTML = "<strong>Information:</strong> 항목별 수가를 합산하여 총액 28,000원의 <strong>'미납 청구서' 및 '영수증'으로 문맥화하여 인쇄 가능한 서식으로 생성</strong>합니다.";
      k.innerHTML = "<strong>Knowledge:</strong> 의료 보험 및 비급여 가이드라인 지식을 대조하여 정당한 본인부담금 액수를 정하고 미수금 관리 법률을 연결합니다.";
      w.innerHTML = "<strong>Wisdom:</strong> 미납 환자의 수납 처리를 진행하고 병원 운영 예산 건전성을 확보하기 위한 최적의 경영 통제 결정을 단행합니다.";
      break;

    case 'reports':
      document.getElementById('dikw-knowledge').classList.add('active');
      d.innerHTML = "<strong>Data:</strong> 개별 환자의 미납 청구 내역과 개인 알레르기 데이터 목록.";
      i.innerHTML = "<strong>Information:</strong> 병원의 미수금 총액과 알레르기 보유자들의 분포를 요약한 <strong>인쇄 전용 분석 보고서 형태로 정보화</strong>합니다.";
      k.innerHTML = "<strong>Knowledge:</strong> 축적된 통계를 바탕으로 매월 일정 비율의 미납이 발생하므로 이를 대비하기 위한 재정 충당금 상식을 확립합니다.";
      w.innerHTML = "<strong>Wisdom:</strong> 지속적으로 미수금을 차단하고 재정 손실을 최소화하기 위한 경영 가이드라인 수립(예: 진료 전 사전 보증금 수납 등)에 기여합니다.";
      break;
  }
}

// ----------------------------------------------------
// TOAST SYSTEM
// ----------------------------------------------------
function showToast(message, type = 'error') {
  const toastEl = document.getElementById('live-toast');
  const toastMsg = document.getElementById('toast-message');

  toastMsg.innerText = message;

  // Set design according to toast type
  if (type === 'success') {
    toastEl.classList.remove('bg-danger', 'bg-warning');
    toastEl.classList.add('bg-success');
  } else if (type === 'warning') {
    toastEl.classList.remove('bg-danger', 'bg-success');
    toastEl.classList.add('bg-warning', 'text-dark');
  } else {
    toastEl.classList.remove('bg-success', 'bg-warning', 'text-dark');
    toastEl.classList.add('bg-danger');
  }

  const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
  toast.show();
}
