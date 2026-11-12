// ==========================================
// ExamBro Admin Dashboard Core Logic (SAT & Token System)
// ==========================================

let currentTab = 'schedule';
let isDemoMode = false;
let demoInterval = null;
let boardQR = null;
let apkQR = null;
let dbRef = null;

let knownDevices = {};

// Daftar Jadwal Ujian Pre-Scheduling (SAT / PAS)
let examSchedules = [
  {
    id: 'exam-1',
    title: 'Matematika Wajib - Kelas XII',
    token: 'MAT12',
    url: 'https://forms.gle/sample-matematika',
    pin: '123',
    date: new Date().toISOString().slice(0, 10),
    startTime: '07:30',
    endTime: '09:30',
    isActive: true
  },
  {
    id: 'exam-2',
    title: 'Bahasa Indonesia - Kelas XII',
    token: 'BINDO',
    url: 'https://forms.gle/sample-bindo',
    pin: '123',
    date: new Date().toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '11:30',
    isActive: true
  },
  {
    id: 'exam-3',
    title: 'Pendidikan Agama Islam - Kelas XII',
    token: 'PAI99',
    url: 'https://forms.gle/sample-pai',
    pin: '123',
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // Besok
    startTime: '07:30',
    endTime: '09:00',
    isActive: true
  }
];

let activeExamId = 'exam-1';
let students = [];

// Sample data siswa simulasi
const sampleStudents = [
  { id: 'ahmad_dani_xii_mipa_1', name: 'Ahmad Dani Saputra', class: 'XII MIPA 1', deviceId: 'dev_847120', isDeviceChanged: false, status: 'examining', battery: 88, violations: 0, joinedAt: '07:32' },
  { id: 'bunga_citra_xii_mipa_1', name: 'Bunga Citra Lestari', class: 'XII MIPA 1', deviceId: 'dev_932140', isDeviceChanged: false, status: 'examining', battery: 74, violations: 0, joinedAt: '07:33' },
  { id: 'dimas_anggara_xii_mipa_1', name: 'Dimas Anggara', class: 'XII MIPA 1', deviceId: 'dev_112093', isDeviceChanged: true, status: 'warning', battery: 45, violations: 2, joinedAt: '07:35' },
  { id: 'fitri_handayani_xii_mipa_2', name: 'Fitri Handayani', class: 'XII MIPA 2', deviceId: 'dev_664129', isDeviceChanged: false, status: 'examining', battery: 92, violations: 0, joinedAt: '07:36' },
  { id: 'gilang_ramadhan_xii_mipa_2', name: 'Gilang Ramadhan', class: 'XII MIPA 2', deviceId: 'dev_889412', isDeviceChanged: false, status: 'done', battery: 60, violations: 0, joinedAt: '07:30' },
  { id: 'hana_maulida_xii_mipa_2', name: 'Hana Maulida', class: 'XII MIPA 2', deviceId: 'dev_771239', isDeviceChanged: false, status: 'examining', battery: 81, violations: 0, joinedAt: '07:38' }
];

document.addEventListener('DOMContentLoaded', () => {
  loadStoredSchedules();
  loadKnownDevices();
  renderScheduleCards();
  populateActiveExamSelect();
  updateBoardDisplay();
  initAPKQR();
  initFirebase();
  renderStudentsTable();
  updateMetrics();
});

// ----------------- TAB SWITCHING -----------------
function switchTab(tabId) {
  currentTab = tabId;
  const tabs = ['schedule', 'board', 'monitoring', 'download'];
  
  tabs.forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    
    if (t === tabId) {
      section.classList.remove('hidden');
      if (btn) {
        btn.classList.add('bg-brand-50', 'text-brand-700', 'font-semibold');
        btn.classList.remove('text-slate-600', 'hover:bg-slate-100');
      }
    } else {
      section.classList.add('hidden');
      if (btn) {
        btn.classList.remove('bg-brand-50', 'text-brand-700', 'font-semibold');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    }
  });

  if (tabId === 'board') {
    updateBoardDisplay();
  }
}

// ----------------- SCHEDULES CRUD (PRE-SCHEDULING) -----------------
function loadStoredSchedules() {
  const saved = localStorage.getItem('exambro_schedules');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        examSchedules = parsed;
      }
    } catch (_) {}
  }
}

function saveSchedulesToStorage() {
  localStorage.setItem('exambro_schedules', JSON.stringify(examSchedules));
  if (dbRef) {
    // Sinkronkan seluruh jadwal token ke Firebase agar HP siswa bisa langsung memvalidasi
    dbRef.child('schedules').set(examSchedules);
  }
}

function renderScheduleCards() {
  const container = document.getElementById('exam-cards-container');
  const emptyState = document.getElementById('empty-schedule-state');

  if (examSchedules.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = examSchedules.map(exam => {
    return `
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition flex flex-col justify-between space-y-4">
        <div>
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-brand-50 text-brand-700 border border-brand-200 font-mono">
              TOKEN: ${exam.token}
            </span>
            <div class="flex items-center space-x-1">
              <button onclick="editExam('${exam.id}')" class="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-50 transition" title="Edit Jadwal">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button onclick="deleteExam('${exam.id}')" class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-50 transition" title="Hapus Jadwal">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>

          <h3 class="font-bold text-slate-900 text-base leading-snug">${exam.title}</h3>
          
          <div class="mt-3 space-y-1.5 text-xs text-slate-500">
            <div class="flex items-center">
              <i class="fa-regular fa-calendar mr-2 text-slate-400 w-4"></i>
              <span>${exam.date || 'Setiap Hari'}</span>
            </div>
            <div class="flex items-center">
              <i class="fa-regular fa-clock mr-2 text-slate-400 w-4"></i>
              <span>${exam.startTime} - ${exam.endTime} WIB</span>
            </div>
            <div class="flex items-center text-slate-400 truncate">
              <i class="fa-solid fa-link mr-2 text-slate-400 w-4 shrink-0"></i>
              <span class="truncate">${exam.url}</span>
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span class="text-[11px] font-semibold text-slate-500">PIN Guru: <code class="text-slate-800">${exam.pin || '123'}</code></span>
          <button onclick="presentOnBoard('${exam.id}')" class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center">
            <i class="fa-solid fa-chalkboard-user mr-1.5 text-amber-400"></i>Buka di Papan
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openAddExamModal() {
  document.getElementById('modal-exam-heading').innerText = 'Tambah Jadwal Mata Pelajaran';
  document.getElementById('form-exam-id').value = '';
  document.getElementById('form-exam-title').value = '';
  document.getElementById('form-exam-token').value = generateSuggestedToken();
  document.getElementById('form-exam-url').value = '';
  document.getElementById('form-exam-pin').value = '123';
  document.getElementById('form-exam-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('form-exam-start').value = '07:30';
  document.getElementById('form-exam-end').value = '09:30';
  document.getElementById('exam-modal').classList.remove('hidden');
}

function editExam(id) {
  const exam = examSchedules.find(e => e.id === id);
  if (!exam) return;

  document.getElementById('modal-exam-heading').innerText = 'Edit Jadwal Mata Pelajaran';
  document.getElementById('form-exam-id').value = exam.id;
  document.getElementById('form-exam-title').value = exam.title;
  document.getElementById('form-exam-token').value = exam.token;
  document.getElementById('form-exam-url').value = exam.url;
  document.getElementById('form-exam-pin').value = exam.pin || '123';
  document.getElementById('form-exam-date').value = exam.date || '';
  document.getElementById('form-exam-start').value = exam.startTime || '07:30';
  document.getElementById('form-exam-end').value = exam.endTime || '09:30';
  document.getElementById('exam-modal').classList.remove('hidden');
}

function closeExamModal() {
  document.getElementById('exam-modal').classList.add('hidden');
}

function generateRandomToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 5; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById('form-exam-token').value = token;
}

function generateSuggestedToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = 'EX';
  for (let i = 0; i < 3; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function saveExamSchedule() {
  const title = document.getElementById('form-exam-title').value.trim();
  const token = document.getElementById('form-exam-token').value.trim().toUpperCase();
  const url = document.getElementById('form-exam-url').value.trim();
  const pin = document.getElementById('form-exam-pin').value.trim() || '123';
  const date = document.getElementById('form-exam-date').value;
  const startTime = document.getElementById('form-exam-start').value;
  const endTime = document.getElementById('form-exam-end').value;
  const id = document.getElementById('form-exam-id').value;

  if (!title || !token || !url) {
    alertToast('Mohon lengkapi Nama Mapel, Token, dan Tautan Soal!', 'warning');
    return;
  }

  if (id) {
    const idx = examSchedules.findIndex(e => e.id === id);
    if (idx !== -1) {
      examSchedules[idx] = { id, title, token, url, pin, date, startTime, endTime, isActive: true };
    }
  } else {
    const newId = 'exam-' + Date.now();
    examSchedules.push({ id: newId, title, token, url, pin, date, startTime, endTime, isActive: true });
  }

  saveSchedulesToStorage();
  renderScheduleCards();
  populateActiveExamSelect();
  closeExamModal();
  alertToast('Jadwal Ujian berhasil disimpan!', 'success');
}

function deleteExam(id) {
  if (confirm('Hapus jadwal mata pelajaran ini?')) {
    examSchedules = examSchedules.filter(e => e.id !== id);
    saveSchedulesToStorage();
    renderScheduleCards();
    populateActiveExamSelect();
    alertToast('Jadwal berhasil dihapus.', 'info');
  }
}

// ----------------- PAPAN TOKEN KELAS DISPLAY -----------------
function populateActiveExamSelect() {
  const select = document.getElementById('select-active-exam');
  select.innerHTML = examSchedules.map(e => `
    <option value="${e.id}" ${e.id === activeExamId ? 'selected' : ''}>${e.token} - ${e.title}</option>
  `).join('');
}

function changeActiveBoardExam(id) {
  activeExamId = id;
  updateBoardDisplay();
}

function presentOnBoard(id) {
  activeExamId = id;
  populateActiveExamSelect();
  switchTab('board');
}

function updateBoardDisplay() {
  const exam = examSchedules.find(e => e.id === activeExamId) || examSchedules[0];
  if (!exam) return;

  document.getElementById('board-exam-title').innerText = exam.title;
  document.getElementById('board-exam-time').innerText = `Tanggal: ${exam.date || 'Hari Ini'} • Jam: ${exam.startTime} - ${exam.endTime} WIB`;
  document.getElementById('board-exam-token').innerText = exam.token;

  // Render QR Code untuk opsi LCD
  const qrContainer = document.getElementById('board-qr-container');
  qrContainer.innerHTML = '';
  
  // Format payload QR: Memuat URL soal dan token
  let qrText = exam.url;
  const configStr = localStorage.getItem('exambro_firebase_config');
  if (configStr) {
    try {
      const cfg = JSON.parse(configStr);
      if (cfg.databaseURL) {
        qrText = `${exam.url}#exambro=${encodeURIComponent(JSON.stringify({
          token: exam.token,
          title: exam.title,
          db: cfg.databaseURL,
          pin: exam.pin
        }))}`;
      }
    } catch (_) {}
  }

  boardQR = new QRCode(qrContainer, {
    text: qrText,
    width: 170,
    height: 170,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

function copyCurrentToken() {
  const exam = examSchedules.find(e => e.id === activeExamId);
  if (!exam) return;
  navigator.clipboard.writeText(exam.token).then(() => {
    alertToast(`Token ${exam.token} disalin ke papan klip!`, 'success');
  });
}

// ----------------- LIVE MONITORING & SIMULATION -----------------
function loadKnownDevices() {
  const saved = localStorage.getItem('exambro_known_devices');
  if (saved) {
    try { knownDevices = JSON.parse(saved); } catch (_) {}
  }
}

function saveKnownDevices() {
  localStorage.setItem('exambro_known_devices', JSON.stringify(knownDevices));
}

function toggleDemoStudents() {
  isDemoMode = !isDemoMode;
  const btn = document.getElementById('btn-toggle-demo');
  const text = document.getElementById('demo-toggle-text');

  if (isDemoMode) {
    students = JSON.parse(JSON.stringify(sampleStudents));
    text.innerText = 'Matikan Simulasi';
    btn.classList.add('bg-brand-50', 'text-brand-700', 'border-brand-300');
    alertToast('Mode Simulasi Aktif.', 'info');

    demoInterval = setInterval(() => {
      if (!isDemoMode) return;
      const randIdx = Math.floor(Math.random() * students.length);
      const std = students[randIdx];
      if (Math.random() > 0.7 && std.status === 'examining') {
        std.battery = Math.max(10, std.battery - 1);
      }
      renderStudentsTable();
      updateMetrics();
    }, 4000);

  } else {
    students = [];
    text.innerText = 'Data Simulasi';
    btn.classList.remove('bg-brand-50', 'text-brand-700', 'border-brand-300');
    if (demoInterval) clearInterval(demoInterval);
    alertToast('Mode Simulasi Dimatikan.', 'info');
  }

  renderStudentsTable();
  updateMetrics();
}

function renderStudentsTable() {
  const tbody = document.getElementById('student-table-body');
  const emptyState = document.getElementById('empty-student-state');
  const search = (document.getElementById('search-student')?.value || '').toLowerCase();
  const filter = document.getElementById('filter-status')?.value || 'all';

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search) || s.class.toLowerCase().includes(search);
    if (!matchSearch) return false;
    if (filter === 'all') return true;
    return s.status === filter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  tbody.innerHTML = filtered.map(s => {
    let statusBadge = '';
    if (s.status === 'examining') {
      statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span class="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 pulse-online"></span> Layar Terkunci
      </span>`;
    } else if (s.status === 'warning') {
      statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
        <i class="fa-solid fa-triangle-exclamation mr-1.5 text-red-500"></i> Peringatan Keluar!
      </span>`;
    } else {
      statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
        <i class="fa-solid fa-circle-check mr-1.5 text-slate-400"></i> Selesai
      </span>`;
    }

    let deviceBadge = '';
    if (s.isDeviceChanged) {
      deviceBadge = `
        <div class="mt-1">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <i class="fa-solid fa-mobile-screen-button mr-1"></i> Ganti HP
          </span>
          <button onclick="allowDeviceChange('${s.id}')" class="ml-1 text-[10px] font-bold text-brand-600 underline hover:text-brand-800">
            Izinkan
          </button>
        </div>
      `;
    }

    let batteryIcon = 'fa-battery-full text-emerald-500';
    if (s.battery < 20) batteryIcon = 'fa-battery-empty text-red-500';
    else if (s.battery < 50) batteryIcon = 'fa-battery-half text-amber-500';

    return `
      <tr class="hover:bg-slate-50/80 transition ${s.status === 'warning' ? 'bg-red-50/30' : ''}">
        <td class="px-6 py-4">
          <div class="font-semibold text-slate-900">${s.name}</div>
          ${deviceBadge}
        </td>
        <td class="px-6 py-4 text-slate-600">${s.class}</td>
        <td class="px-6 py-4">${statusBadge}</td>
        <td class="px-6 py-4 font-mono text-xs">
          <i class="fa-solid ${batteryIcon} mr-1.5"></i>${s.battery}%
        </td>
        <td class="px-6 py-4 text-xs text-slate-500">${s.joinedAt || '-'}</td>
        <td class="px-6 py-4 text-center">
          ${s.violations > 0 
            ? `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse">${s.violations}x</span>` 
            : `<span class="text-xs text-slate-400">-</span>`}
        </td>
        <td class="px-6 py-4 text-right">
          <button onclick="unlockStudent('${s.id}')" class="px-3 py-1.5 text-xs font-medium rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition">
            <i class="fa-solid fa-lock-open mr-1"></i>Buka Kunci
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function updateMetrics() {
  const total = students.length;
  const active = students.filter(s => s.status === 'examining').length;
  const warnings = students.filter(s => s.status === 'warning').length;
  const done = students.filter(s => s.status === 'done').length;

  document.getElementById('metric-total').innerText = total;
  document.getElementById('metric-active').innerText = active;
  document.getElementById('metric-violations').innerText = warnings;
  document.getElementById('metric-finished').innerText = done;
  document.getElementById('active-student-badge').innerText = active;
}

function allowDeviceChange(studentId) {
  const std = students.find(s => s.id === studentId);
  if (!std) return;

  if (confirm(`Izinkan siswa ${std.name} berganti perangkat HP baru?`)) {
    std.isDeviceChanged = false;
    if (std.deviceId) {
      knownDevices[studentId] = std.deviceId;
      saveKnownDevices();
    }
    renderStudentsTable();
    alertToast(`Perangkat baru untuk ${std.name} telah diizinkan.`, 'success');
  }
}

function unlockStudent(studentId) {
  const std = students.find(s => s.id === studentId);
  if (!std) return;

  if (confirm(`Buka kunci layar untuk siswa: ${std.name}?`)) {
    std.status = 'done';
    renderStudentsTable();
    updateMetrics();

    if (dbRef) {
      dbRef.child(`students/${studentId}/status`).set('unlocked');
    }
    alertToast(`Kunci layar ${std.name} berhasil dibuka.`, 'success');
  }
}

function unlockAllStudents() {
  if (students.length === 0) {
    alertToast('Tidak ada siswa aktif.', 'warning');
    return;
  }
  if (confirm('Buka kunci ujian untuk SELURUH SISWA sekaligus?')) {
    students.forEach(s => s.status = 'done');
    renderStudentsTable();
    updateMetrics();

    if (dbRef) {
      students.forEach(s => {
        dbRef.child(`students/${s.id}/status`).set('unlocked');
      });
      dbRef.child('active_session/force_unlock').set(true);
    }
    alertToast('Semua siswa telah diizinkan keluar ujian.', 'success');
  }
}

function exportToCSV() {
  if (students.length === 0) {
    alertToast('Tidak ada data siswa untuk di-export.', 'warning');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "ID,Nama Siswa,Kelas,Device ID,Status,Baterai,Waktu Masuk,Jumlah Pelanggaran\n";

  students.forEach(s => {
    csvContent += `"${s.id}","${s.name}","${s.class}","${s.deviceId || '-'}","${s.status}","${s.battery}%","${s.joinedAt || '-'}","${s.violations || 0}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Rekap_Ujian_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  alertToast('File rekap CSV berhasil diunduh.', 'success');
}

// ----------------- APK QR CODE -----------------
function initAPKQR() {
  const apkBox = document.getElementById('apk-qr-container');
  apkBox.innerHTML = '';
  const apkUrl = window.location.origin + window.location.pathname;
  apkQR = new QRCode(apkBox, {
    text: apkUrl,
    width: 180,
    height: 180,
    colorDark: "#065f46",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

// ----------------- FIREBASE REALTIME LISTENER -----------------
function initFirebase() {
  const configStr = localStorage.getItem('exambro_firebase_config');
  if (!configStr) {
    setConnectionStatus(false, 'Mode Standalone');
    return;
  }

  try {
    const config = JSON.parse(configStr);
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    const db = firebase.database();
    dbRef = db.ref('exambro');

    setConnectionStatus(true, 'Firebase Terhubung');

    // Sinkronkan jadwal token ke server
    dbRef.child('schedules').set(examSchedules);

    // Dengarkan aktivitas siswa
    dbRef.child('students').on('value', (snapshot) => {
      if (isDemoMode) return;
      const data = snapshot.val();
      if (data) {
        students = Object.keys(data).map(key => {
          const item = data[key];
          const prevDev = knownDevices[key];
          let isChanged = false;

          if (prevDev && item.deviceId && prevDev !== item.deviceId) {
            isChanged = true;
          } else if (!prevDev && item.deviceId) {
            knownDevices[key] = item.deviceId;
            saveKnownDevices();
          }

          return {
            id: key,
            name: item.name || 'Siswa',
            class: item.class || '-',
            deviceId: item.deviceId || 'unknown',
            isDeviceChanged: isChanged,
            status: item.status || 'examining',
            battery: item.battery || 100,
            violations: item.violations || 0,
            joinedAt: item.lastPing ? item.lastPing.slice(11, 16) : '-'
          };
        });
      } else {
        students = [];
      }
      renderStudentsTable();
      updateMetrics();
    });

  } catch (err) {
    console.error("Firebase init error:", err);
    setConnectionStatus(false, 'Gagal Terhubung Firebase');
  }
}

function setConnectionStatus(connected, text) {
  const pill = document.getElementById('connection-status-pill');
  const label = document.getElementById('connection-status-text');
  label.innerText = text;

  if (connected) {
    pill.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200";
    pill.querySelector('span').className = "w-2 h-2 rounded-full bg-emerald-500";
  } else {
    pill.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200";
    pill.querySelector('span').className = "w-2 h-2 rounded-full bg-amber-500";
  }
}

function openConfigModal() {
  const configStr = localStorage.getItem('exambro_firebase_config');
  if (configStr) {
    try {
      const cfg = JSON.parse(configStr);
      document.getElementById('fb-apiKey').value = cfg.apiKey || '';
      document.getElementById('fb-databaseURL').value = cfg.databaseURL || '';
      document.getElementById('fb-projectId').value = cfg.projectId || '';
    } catch (_) {}
  }
  document.getElementById('config-modal').classList.remove('hidden');
}

function closeConfigModal() {
  document.getElementById('config-modal').classList.add('hidden');
}

function saveFirebaseConfig() {
  const apiKey = document.getElementById('fb-apiKey').value.trim();
  const databaseURL = document.getElementById('fb-databaseURL').value.trim();
  const projectId = document.getElementById('fb-projectId').value.trim();

  if (!apiKey || !databaseURL) {
    alertToast('Mohon isi minimal API Key dan Database URL.', 'warning');
    return;
  }

  const config = { apiKey, databaseURL, projectId };
  localStorage.setItem('exambro_firebase_config', JSON.stringify(config));
  closeConfigModal();
  alertToast('Konfigurasi disimpan! Memuat ulang...', 'success');
  setTimeout(() => window.location.reload(), 1000);
}

function useLocalModeOnly() {
  localStorage.removeItem('exambro_firebase_config');
  closeConfigModal();
  alertToast('Beralih ke Mode Standalone.', 'info');
  setTimeout(() => window.location.reload(), 800);
}

// ----------------- TOAST NOTIFICATIONS -----------------
function alertToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-slate-900 text-white',
  };

  toast.className = `fixed bottom-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center space-x-2 transition-all duration-300 transform translate-y-4 opacity-0 ${colors[type] || colors.info}`;
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
