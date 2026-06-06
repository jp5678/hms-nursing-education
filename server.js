const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions for DB access
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file:', error);
    return {
      users: [],
      patients: [],
      appointments: [],
      consultations: [],
      billings: [],
      nursingLogs: []
    };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing database file:', error);
    return false;
  }
}

// ----------------------------------------------------
// 1. Authentication API
// ----------------------------------------------------
app.post('/api/login', (req, res) => {
  const { id, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === id && u.password === password);
  
  if (user) {
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        specialty: user.specialty || '',
        licenseNo: user.licenseNo || ''
      }
    });
  } else {
    res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
  }
});

// ----------------------------------------------------
// 2. Dashboard Stats API
// ----------------------------------------------------
app.get('/api/dashboard', (req, res) => {
  const db = readDB();
  
  // 금일 예약 구하기 (2026-06-06 기준)
  const today = '2026-06-06';
  const todayAppointments = db.appointments.filter(a => a.date === today);
  
  // 금일 매출 (완료된 청구서 중 2026-06-06 혹은 가장 최근 청구일 기준 합산)
  const todayBillingAmount = db.billings
    .filter(b => b.date === today && b.status === '완료')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  // 총 입원 현황 (간호기록 상에서 입원/중환자실 ICU 특이사항 환자 수 가상 계산)
  const activeInpatientsCount = db.patients.filter(p => p.notes.includes('입원') || p.notes.includes('ICU') || p.notes.includes('중환자실')).length;

  // 진료과목별 환자 수 (통계용)
  const specialtyDistribution = {};
  db.appointments.forEach(a => {
    if (a.status === '완료' || a.status === '진료중') {
      const dept = a.doctorName.split('(')[1]?.replace(')', '') || '기타';
      specialtyDistribution[dept] = (specialtyDistribution[dept] || 0) + 1;
    }
  });

  // 최근 환자 등록 추이 (예제 데이터 기반)
  const registrationTrends = {
    labels: ['06-01', '06-02', '06-03', '06-04', '06-05', '06-06'],
    data: [1, 2, 0, 3, 2, db.patients.length] // 마지막 날에 현재 총 환자수 반영
  };

  res.json({
    kpis: {
      totalPatients: db.patients.length,
      todayAppointments: todayAppointments.length,
      todayBilling: todayBillingAmount,
      inpatients: activeInpatientsCount
    },
    specialtyDistribution,
    registrationTrends
  });
});

// ----------------------------------------------------
// 3. Patients API
// ----------------------------------------------------
app.get('/api/patients', (req, res) => {
  const db = readDB();
  res.json(db.patients);
});

app.post('/api/patients', (req, res) => {
  const { name, birthDate, gender, phone, bloodType, allergies, notes } = req.body;
  if (!name || !birthDate || !gender) {
    return res.status(400).json({ success: false, message: '필수 필드가 누락되었습니다.' });
  }

  const db = readDB();
  const newId = `P-${String(db.patients.length + 1).padStart(5, '0')}`;
  const newPatient = {
    id: newId,
    name,
    birthDate,
    gender,
    phone,
    bloodType,
    allergies: allergies || '없음',
    notes: notes || ''
  };

  db.patients.push(newPatient);
  if (writeDB(db)) {
    res.json({ success: true, patient: newPatient });
  } else {
    res.status(500).json({ success: false, message: 'DB 저장 실패' });
  }
});

// ----------------------------------------------------
// 4. Staff API
// ----------------------------------------------------
app.get('/api/staff', (req, res) => {
  const db = readDB();
  // 의사와 간호사 정보 추출
  const doctors = db.users.filter(u => u.role === 'doctor').map(d => ({
    id: d.id,
    name: d.name.split(' (')[0],
    specialty: d.specialty,
    licenseNo: d.licenseNo,
    status: '진료중'
  }));

  const nurses = db.users.filter(u => u.role === 'nurse').map(n => ({
    id: n.id,
    name: n.name.split(' (')[0],
    specialty: n.specialty,
    licenseNo: n.licenseNo,
    status: '근무중'
  }));

  res.json({ doctors, nurses });
});

// ----------------------------------------------------
// 5. Appointments API
// ----------------------------------------------------
app.get('/api/appointments', (req, res) => {
  const db = readDB();
  res.json(db.appointments);
});

app.post('/api/appointments', (req, res) => {
  const { patientId, doctorId, date, time, symptoms } = req.body;
  if (!patientId || !doctorId || !date || !time) {
    return res.status(400).json({ success: false, message: '필수 필드가 누락되었습니다.' });
  }

  const db = readDB();
  const patient = db.patients.find(p => p.id === patientId);
  const doctor = db.users.find(u => u.id === doctorId);

  if (!patient || !doctor) {
    return res.status(404).json({ success: false, message: '환자 또는 의사 정보를 찾을 수 없습니다.' });
  }

  const newId = `A-${String(db.appointments.length + 1).padStart(5, '0')}`;
  const newAppointment = {
    id: newId,
    patientId,
    patientName: patient.name,
    doctorId,
    doctorName: doctor.name,
    date,
    time,
    symptoms: symptoms || '',
    status: '대기'
  };

  db.appointments.push(newAppointment);
  if (writeDB(db)) {
    res.json({ success: true, appointment: newAppointment });
  } else {
    res.status(500).json({ success: false, message: 'DB 저장 실패' });
  }
});

app.patch('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const db = readDB();
  const appt = db.appointments.find(a => a.id === id);

  if (!appt) {
    return res.status(404).json({ success: false, message: '예약을 찾을 수 없습니다.' });
  }

  appt.status = status;
  if (writeDB(db)) {
    res.json({ success: true, appointment: appt });
  } else {
    res.status(500).json({ success: false, message: 'DB 저장 실패' });
  }
});

// ----------------------------------------------------
// 6. Consultations & Prescriptions API
// ----------------------------------------------------
app.get('/api/consultations', (req, res) => {
  const db = readDB();
  res.json(db.consultations);
});

app.post('/api/consultations', (req, res) => {
  const { appointmentId, patientId, doctorId, chiefComplaint, diagnosis, prescriptions } = req.body;
  if (!patientId || !doctorId || !chiefComplaint || !diagnosis) {
    return res.status(400).json({ success: false, message: '필수 필드가 누락되었습니다.' });
  }

  const db = readDB();
  const newId = `C-${String(db.consultations.length + 1).padStart(5, '0')}`;
  const newConsultation = {
    id: newId,
    appointmentId: appointmentId || '',
    patientId,
    doctorId,
    date: new Date().toISOString().split('T')[0],
    chiefComplaint,
    diagnosis,
    prescriptions: prescriptions || []
  };

  db.consultations.push(newConsultation);

  // 예약이 연결된 경우 상태 완료로 변경
  if (appointmentId) {
    const appt = db.appointments.find(a => a.id === appointmentId);
    if (appt) appt.status = '완료';
  }

  // 자동으로 청구서 생성 (진료비: 15,000원, 약제비: 처방 갯수당 5,000원 가상 계산)
  const consultationFee = 15000;
  const pharmacyFee = (prescriptions || []).length * 5000;
  const examinationFee = 5000; // 기본 검사비
  const totalAmount = consultationFee + pharmacyFee + examinationFee;

  const patient = db.patients.find(p => p.id === patientId);
  const newBillingId = `B-${String(db.billings.length + 1).padStart(5, '0')}`;
  const newBilling = {
    id: newBillingId,
    patientId,
    patientName: patient ? patient.name : '알수없음',
    consultationId: newId,
    date: newConsultation.date,
    fees: {
      consultation: consultationFee,
      examination: examinationFee,
      pharmacy: pharmacyFee
    },
    totalAmount,
    status: '미납'
  };

  db.billings.push(newBilling);

  if (writeDB(db)) {
    res.json({ success: true, consultation: newConsultation, billing: newBilling });
  } else {
    res.status(500).json({ success: false, message: 'DB 저장 실패' });
  }
});

// ----------------------------------------------------
// 7. Billings API
// ----------------------------------------------------
app.get('/api/billings', (req, res) => {
  const db = readDB();
  res.json(db.billings);
});

app.patch('/api/billings/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const db = readDB();
  const bill = db.billings.find(b => b.id === id);

  if (!bill) {
    return res.status(404).json({ success: false, message: '청구서를 찾을 수 없습니다.' });
  }

  bill.status = status;
  if (writeDB(db)) {
    res.json({ success: true, billing: bill });
  } else {
    res.status(500).json({ success: false, message: 'DB 저장 실패' });
  }
});

// ----------------------------------------------------
// 8. Nursing Logs API
// ----------------------------------------------------
app.get('/api/nursing-logs', (req, res) => {
  const db = readDB();
  res.json(db.nursingLogs);
});

app.post('/api/nursing-logs', (req, res) => {
  const { patientId, nurseId, nurseName, nursingDiagnosis, nursingPlan, nursingImplementation, nursingEvaluation } = req.body;
  if (!patientId || !nursingDiagnosis || !nursingPlan) {
    return res.status(400).json({ success: false, message: '필수 필드가 누락되었습니다.' });
  }

  const db = readDB();
  const patient = db.patients.find(p => p.id === patientId);
  if (!patient) {
    return res.status(404).json({ success: false, message: '환자를 찾을 수 없습니다.' });
  }

  const newId = `N-${String(db.nursingLogs.length + 1).padStart(5, '0')}`;
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const newLog = {
    id: newId,
    patientId,
    patientName: patient.name,
    nurseId: nurseId || 'system',
    nurseName: nurseName || '간호사',
    date: formattedDate,
    nursingDiagnosis,
    nursingPlan,
    nursingImplementation,
    nursingEvaluation: nursingEvaluation || ''
  };

  db.nursingLogs.push(newLog);
  if (writeDB(db)) {
    res.json({ success: true, nursingLog: newLog });
  } else {
    res.status(500).json({ success: false, message: 'DB 저장 실패' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`HMS server running on http://localhost:${PORT}`);
});
