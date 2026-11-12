// ==========================================
// ExamBro Admin Dashboard Core Logic
// ==========================================

// Global State
let currentTab = 'session';
let isDemoMode = false;
let demoInterval = null;
let sessionQR = null;
let projectorQR = null;
let apkQR = null;
let dbRef = null;

// Registry of known Device IDs per student { studentKey: deviceId }
let knownDevices = {};

// Default Session Data
let sessionData = {
  id: 'sesi-' + new Date().toISOString().slice(0, 10),
  title: 'Penilaian Akhir Semester - Matematika',
  url: 'https://forms.gle/sample-exam-link',
  pin: '123',
  duration: 90,
  isActive: true,
  createdAt: new Date().toISOString()
};

// Students List (Live or Demo)
let students = [];

// Realistic Indonesian Student Names for Simulation
const sampleStudents = [
  { id: 'ahmad_dani_xii_mipa_1', name: 'Ahmad Dani Saputra', class: 'XII MIPA 1', deviceId: 'dev_847120', isDeviceChanged: false, status: 'examining', battery: 88, violations: 0, joinedAt: '07:32' },
  { id: 'bunga_citra_xii_mipa_1', name: 'Bunga Citra Lestari', class: 'XII MIPA 1', deviceId: 'dev_932140', isDeviceChanged: false, status: 'examining', battery: 74, violations: 0, joinedAt: '07:33' },
  { id: 'dimas_anggara_xii_mipa_1', name: 'Dimas Anggara', class: 'XII MIPA 1', deviceId: 'dev_112093', isDeviceChanged: true, status: 'warning', battery: 45, violations: 2, joinedAt: '07:35' },
  { id: 'fitri_handayani_xii_mipa_2', name: 'Fitri Handayani', class: 'XII MIPA 2', deviceId: 'dev_664129', isDeviceChanged: false, status: 'examining', battery: 92, violations: 0, joinedAt: '07:36' },
  { id: 'gilang_ramadhan_xii_mipa_2', name: 'Gilang Ramadhan', class: 'XII MIPA 2', deviceId: 'dev_889412', isDeviceChanged: false, status: 'done', battery: 60, violations: 0, joinedAt: '07:30' },
  { id: 'hana_maulida_xii_mipa_2', name: 'Hana Maulida', class: 'XII MIPA 2', deviceId: 'dev_771239', isDeviceChanged: false, status: 'examining', battery: 81, violations: 0, joinedAt: '07:38' },
  { id: 'irfan_hakim_xii_ips_1', name: 'Irfan Hakim', class: 'XII IPS 1', deviceId: 'dev_449120', isDeviceChanged: false, status: 'warning', battery: 35, violations: 1, joinedAt: '07:40' },
  { id: 'jasmine_putri_xii_ips_1', name: 'Jasmine Putri', class: 'XII IPS 1', deviceId: 'dev_338910', isDeviceChanged: false, status: 'examining', battery: 95, violations: 0, joinedAt: '07:41' },
];

// Initialize on Page Load
document.addEventListener('DOMContentLoaded', () => {
  loadStoredSession();
  loadKnownDevices();
  initQRCodes();
  initFirebase();
  renderStudentsTable();
  updateMetrics();
});

// ----------------- TAB SWITCHING -----------------
function switchTab(tabId) {
  currentTab = tabId;
  const tabs = ['session', 'projector', 'monitoring', 'download'];
  
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

  if (tabId === 'projector' || tabId === 'session') {
    updateQRCodes();
  }
}

// ----------------- QR CODE GENERATOR -----------------
function initQRCodes() {
  const qrData = generateQRString();

  // Small Session Preview QR
  const sessionBox = document.getElementById('session-qr-preview');
  sessionBox.innerHTML = '';
  sessionQR = new QRCode(sessionBox, {
    text: qrData,
    width: 170,
    height: 170,
    colorDark: "#1e1b4b",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  // Big Projector QR
  const projBox = document.getElementById('projector-qr-container');
  projBox.innerHTML = '';
  projectorQR = new QRCode(projBox, {
    text: qrData,
    width: 280,
    height: 280,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  // APK Download QR
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

function generateQRString() {
  const baseUrl = sessionData.url || 'https://forms.gle/sample';
  const configStr = localStorage.getItem('exambro_firebase_config');

  // Jika guru sudah mengatur Firebase, sematkan URL database di hash payload
  if (configStr) {
    try {
      const cfg = JSON.parse(configStr);
      if (cfg.databaseURL) {
        const payload = JSON.stringify({
          db: cfg.databaseURL,
          pin: sessionData.pin,
          title: sessionData.title
        });
        return `${baseUrl}#exambro=${encodeURIComponent(payload)}`;
      }
    } catch (_) {}
  }

  return baseUrl;
}

function updateQRCodes() {
  const text = generateQRString();
  if (sessionQR) sessionQR.makeCode(text);
  if (projectorQR) projectorQR.makeCode(text);
}

// ----------------- SESSION MANAGEMENT -----------------
function loadStoredSession() {
  const saved = localStorage.getItem('exambro_session');
  if (saved) {
    try {
      sessionData = JSON.parse(saved);
      document.getElementById('input-exam-title').value = sessionData.title || '';
      document.getElementById('input-exam-url').value = sessionData.url || '';
      document.getElementById('input-exam-pin').value = sessionData.pin || '123';
      document.getElementById('input-exam-duration').value = sessionData.duration || 90;
    } catch (_) {}
  }
  updateProjectorLabels();
}

function loadKnownDevices() {
  const saved = localStorage.getItem('exambro_known_devices');
  if (saved) {
    try { knownDevices = JSON.parse(saved); } catch (_) {}
  }
}

function saveKnownDevices() {
  localStorage.setItem('exambro_known_devices', JSON.stringify(knownDevices));
}

function saveAndPublishSession() {
  sessionData.title = document.getElementById('input-exam-title').value.trim() || 'Ujian Tanpa Judul';
  sessionData.url = document.getElementById('input-exam-url').value.trim();
  sessionData.pin = document.getElementById('input-exam-pin').value.trim() || '123';
  sessionData.duration = parseInt(document.getElementById('input-exam-duration').value) || 90;
  sessionData.isActive = true;

  localStorage.setItem('exambro_session', JSON.stringify(sessionData));
  
  updateProjectorLabels();
  updateQRCodes();

  if (dbRef) {
    dbRef.child('active_session').set(sessionData)
      .then(() => alertToast('Sesi Ujian Berhasil Diterbitkan ke Server!', 'success'))
      .catch((err) => alertToast('Tersimpan di lokal: ' + err.message, 'warning'));
  } else {
    alertToast('Sesi Ujian Berhasil Disimpan & QR Code Diperbarui!', 'success');
  }
}

function updateProjectorLabels() {
  document.getElementById('proj-exam-title').innerText = sessionData.title;
  document.getElementById('proj-exam-duration').innerText = `${sessionData.duration} Menit`;
  document.getElementById('proj-exam-pin').innerText = sessionData.pin;
}

// ----------------- LIVE MONITORING & SIMULATION -----------------
function toggleDemoStudents() {
  isDemoMode = !isDemoMode;
  const btn = document.getElementById('btn-toggle-demo');
  const text = document.getElementById('demo-toggle-text');

  if (isDemoMode) {
    students = JSON.parse(JSON.stringify(sampleStudents));
    text.innerText = 'Matikan Data Simulasi';
    btn.classList.add('bg-brand-50', 'text-brand-700', 'border-brand-300');
    alertToast('Mode Simulasi Aktif: 8 siswa dummy terhubung.', 'info');

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
    text.innerText = 'Aktifkan Siswa Simulasi';
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

    // Indikator Ganti HP
    let deviceBadge = '';
    if (s.isDeviceChanged) {
      deviceBadge = `
        <div class="mt-1">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <i class="fa-solid fa-mobile-screen-button mr-1"></i> Ganti HP Terdeteksi
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
        <td class="px-6 py-4 text-right space-x-1">
          <button onclick="unlockStudent('${s.id}')" class="px-3 py-1.5 text-xs font-medium rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition" title="Buka Kunci Layar HP Siswa">
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

  document.getElementById('proj-student-count').innerText = active;
  document.getElementById('active-student-badge').innerText = active;
}

// ----------------- ACTIONS (GANTI HP, UNLOCK, EXPORT) -----------------
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
  link.setAttribute("download", `Rekap_Ujian_${sessionData.title.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  alertToast('File rekap CSV berhasil diunduh.', 'success');
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

    // Dengarkan data siswa secara live
    dbRef.child('students').on('value', (snapshot) => {
      if (isDemoMode) return;
      const data = snapshot.val();
      if (data) {
        students = Object.keys(data).map(key => {
          const item = data[key];
          const prevDev = knownDevices[key];
          let isChanged = false;

          // Deteksi pergantian HP
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
