import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  runApp(const ExamBroApp());
}

class ExamBroApp extends StatelessWidget {
  const ExamBroApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ExamBro Siswa',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E88E5),
          primary: const Color(0xFF1565C0),
        ),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

// ----------------- HALAMAN DEPAN (INPUT TOKEN & SCAN) -----------------
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _classController = TextEditingController();
  final TextEditingController _tokenController = TextEditingController();

  static const MethodChannel _kioskChannel = MethodChannel('com.exambro.app/kiosk');
  String _deviceId = 'device_${DateTime.now().millisecondsSinceEpoch}';
  int _batteryLevel = 100;
  bool _isValidating = false;

  // URL Firebase Database yang bisa disimpan atau disesuaikan
  String? _savedFirebaseDbUrl;

  @override
  void initState() {
    super.initState();
    _loadSavedStudentInfo();
    _fetchDeviceInfo();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _classController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  Future<void> _loadSavedStudentInfo() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _nameController.text = prefs.getString('student_name') ?? '';
      _classController.text = prefs.getString('student_class') ?? '';
      _savedFirebaseDbUrl = prefs.getString('firebase_db_url');
    });
  }

  Future<void> _fetchDeviceInfo() async {
    try {
      final info = await _kioskChannel.invokeMapMethod<String, dynamic>('getDeviceInfo');
      if (info != null) {
        setState(() {
          _batteryLevel = (info['battery'] as num?)?.toInt() ?? 100;
          _deviceId = (info['deviceId'] as String?) ?? _deviceId;
        });
      }
    } catch (_) {}
  }

  Future<void> _saveStudentInfo() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('student_name', _nameController.text.trim());
    await prefs.setString('student_class', _classController.text.trim());
    if (_savedFirebaseDbUrl != null) {
      await prefs.setString('firebase_db_url', _savedFirebaseDbUrl!);
    }
  }

  // ----------------- PROSES MASUK DENGAN TOKEN -----------------
  Future<void> _prosesMasukDenganToken() async {
    final name = _nameController.text.trim();
    final studentClass = _classController.text.trim();
    final token = _tokenController.text.trim().toUpperCase();

    if (name.isEmpty || studentClass.isEmpty) {
      _showSnackbar('Isi Nama Lengkap dan Kelas/NISN terlebih dahulu!', isError: true);
      return;
    }

    if (token.isEmpty) {
      _showSnackbar('Ketik TOKEN Ujian yang tertulis di papan tulis kelas!', isError: true);
      return;
    }

    setState(() => _isValidating = true);
    await _saveStudentInfo();

    String examUrl = '';
    String examTitle = 'Ujian Siswa';
    String supervisorPin = '123';
    String? dbUrl = _savedFirebaseDbUrl;

    // 1. Coba periksa ke server Firebase jika ada
    if (dbUrl != null && dbUrl.isNotEmpty) {
      try {
        String cleanDb = dbUrl.trim();
        if (cleanDb.endsWith('/')) cleanDb = cleanDb.substring(0, cleanDb.length - 1);

        final res = await http.get(Uri.parse('$cleanDb/exambro/schedules.json')).timeout(const Duration(seconds: 4));
        if (res.statusCode == 200) {
          final data = jsonDecode(res.body);
          if (data is List) {
            for (final item in data) {
              if (item is Map && (item['token'] as String?)?.toUpperCase() == token) {
                examUrl = item['url'] ?? '';
                examTitle = item['title'] ?? examTitle;
                supervisorPin = item['pin'] ?? supervisorPin;
                break;
              }
            }
          } else if (data is Map) {
            for (final key in data.keys) {
              final item = data[key];
              if (item is Map && (item['token'] as String?)?.toUpperCase() == token) {
                examUrl = item['url'] ?? '';
                examTitle = item['title'] ?? examTitle;
                supervisorPin = item['pin'] ?? supervisorPin;
                break;
              }
            }
          }
        }
      } catch (_) {}
    }

    // 2. Fallback jika offline atau token bawaan
    if (examUrl.isEmpty) {
      // Cek apakah token merupakan link langsung (jika siswa menempelkan link)
      if (token.startsWith('HTTP://') || token.startsWith('HTTPS://')) {
        examUrl = token.toLowerCase();
      } else if (token == 'MAT12') {
        examUrl = 'https://forms.gle/sample-matematika';
        examTitle = 'Matematika Wajib';
      } else if (token == 'BINDO') {
        examUrl = 'https://forms.gle/sample-bindo';
        examTitle = 'Bahasa Indonesia';
      } else if (token == 'PAI99') {
        examUrl = 'https://forms.gle/sample-pai';
        examTitle = 'Pendidikan Agama Islam';
      }
    }

    setState(() => _isValidating = false);

    if (examUrl.isEmpty) {
      _showSnackbar('Token "$token" tidak ditemukan atau belum aktif. Periksa papan tulis kelas!', isError: true);
      return;
    }

    if (!examUrl.startsWith('http://') && !examUrl.startsWith('https://')) {
      examUrl = 'https://$examUrl';
    }

    _bukaLayarUjian(examUrl, examTitle, supervisorPin, dbUrl);
  }

  void _bukaLayarUjian(String url, String title, String pin, String? dbUrl) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ExamScreen(
          examUrl: url,
          examTitle: title,
          studentName: _nameController.text.trim(),
          studentClass: _classController.text.trim(),
          deviceId: _deviceId,
          initialBattery: _batteryLevel,
          supervisorPin: pin,
          firebaseDbUrl: dbUrl,
        ),
      ),
    );
  }

  // ----------------- SCAN QR (OPSIONAL JIKA ADA LCD) -----------------
  void _bukaScanner() {
    final name = _nameController.text.trim();
    final studentClass = _classController.text.trim();

    if (name.isEmpty || studentClass.isEmpty) {
      _showSnackbar('Isi Nama Lengkap dan Kelas terlebih dahulu!', isError: true);
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ScannerScreen(
          onScanned: (result) async {
            Navigator.pop(context);

            String formattedUrl = result.trim();
            String? dbUrl = _savedFirebaseDbUrl;
            String examTitle = 'Ujian Terjadwal';
            String pin = '123';

            if (formattedUrl.contains('#exambro=')) {
              final parts = formattedUrl.split('#exambro=');
              formattedUrl = parts[0];
              try {
                final meta = jsonDecode(Uri.decodeComponent(parts[1]));
                if (meta is Map) {
                  dbUrl = meta['db'] ?? dbUrl;
                  examTitle = meta['title'] ?? examTitle;
                  pin = meta['pin'] ?? pin;
                  if (meta['token'] != null) {
                    _tokenController.text = meta['token'];
                  }
                }
              } catch (_) {}
            }

            if (dbUrl != null) {
              _savedFirebaseDbUrl = dbUrl;
            }
            await _saveStudentInfo();

            if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
              formattedUrl = 'https://$formattedUrl';
            }

            _bukaLayarUjian(formattedUrl, examTitle, pin, dbUrl);
          },
        ),
      ),
    );
  }

  void _showSnackbar(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.redAccent : Colors.emerald,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        title: const Text(
          'ExamBro Client Siswa',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 12.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Shield Icon
                  Center(
                    child: Container(
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: theme.colorScheme.primary.withAlpha(25),
                      ),
                      child: Center(
                        child: Icon(
                          Icons.verified_user_rounded,
                          size: 42,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Asesmen Sekolah (SAT/PAS)',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Masukkan Nama dan TOKEN yang tertera di papan tulis kelas untuk memulai ujian.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: Colors.grey[600], height: 1.4),
                  ),
                  const SizedBox(height: 22),

                  // Card Form Siswa
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    color: Colors.white,
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Nama Lengkap Siswa',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF334155)),
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _nameController,
                            textCapitalization: TextCapitalization.words,
                            decoration: InputDecoration(
                              hintText: 'Contoh: Ahmad Dani Saputra',
                              prefixIcon: const Icon(Icons.person_rounded),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              filled: true,
                              fillColor: const Color(0xFFF8FAFC),
                            ),
                          ),
                          const SizedBox(height: 14),

                          const Text(
                            'Kelas / NISN',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF334155)),
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _classController,
                            decoration: InputDecoration(
                              hintText: 'Contoh: XII MIPA 1 (10234)',
                              prefixIcon: const Icon(Icons.badge_rounded),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              filled: true,
                              fillColor: const Color(0xFFF8FAFC),
                            ),
                          ),
                          const SizedBox(height: 14),

                          // BOX TOKEN BESAR
                          Row(
                            mainAxisAlignment: MainAxisAlignment.between,
                            children: [
                              const Text(
                                'TOKEN UJIAN DI PAPAN TULIS',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF1565C0)),
                              ),
                              Text(
                                'Tanya Pengawas',
                                style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _tokenController,
                            textCapitalization: TextCapitalization.characters,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 4,
                              fontFamily: 'monospace',
                              color: Color(0xFF1E293B),
                            ),
                            decoration: InputDecoration(
                              hintText: 'CONTOH: MAT12',
                              hintStyle: TextStyle(letterSpacing: 2, fontSize: 15, color: Colors.grey[400]),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFF1565C0), width: 2),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFF1565C0), width: 2.5),
                              ),
                              filled: true,
                              fillColor: const Color(0xFFEEF2FF),
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Action Buttons
                          Row(
                            children: [
                              // Scan QR Button (Opsional jika ada LCD)
                              IconButton.outlined(
                                onPressed: _bukaScanner,
                                icon: const Icon(Icons.qr_code_scanner_rounded),
                                tooltip: 'Scan QR (Jika ada proyektor LCD)',
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.all(14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                ),
                              ),
                              const SizedBox(width: 10),
                              // Mulai Ujian Button
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: _isValidating ? null : _prosesMasukDenganToken,
                                  icon: _isValidating
                                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                      : const Icon(Icons.play_arrow_rounded),
                                  label: Text(_isValidating ? 'Memeriksa Token...' : 'Mulai Ujian Sekarang'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: theme.colorScheme.primary,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    elevation: 2,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 18),
                  Center(
                    child: Text(
                      'ExamBro • Aman, Terkunci & Mendukung Semua Ruang Kelas',
                      style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ----------------- SCANNER QR (OPSIONAL) -----------------
class ScannerScreen extends StatefulWidget {
  final Function(String) onScanned;
  const ScannerScreen({super.key, required this.onScanned});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _hasDetected = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Scan QR Code Ujian'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on_rounded),
            tooltip: 'Senter',
            onPressed: () => _controller.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.cameraswitch_rounded),
            tooltip: 'Ganti Kamera',
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: (capture) {
              if (_hasDetected) return;
              final List<Barcode> barcodes = capture.barcodes;
              for (final barcode in barcodes) {
                if (barcode.rawValue != null && barcode.rawValue!.isNotEmpty) {
                  _hasDetected = true;
                  widget.onScanned(barcode.rawValue!);
                  break;
                }
              }
            },
          ),
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.blueAccent, width: 3),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Padding(
                    padding: EdgeInsets.only(bottom: 12.0),
                    child: Text(
                      'Arahkan kamera ke QR Proyektor Guru',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white, fontSize: 12, backgroundColor: Colors.black54),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ----------------- HALAMAN UJIAN TERKUNCI -----------------
class ExamScreen extends StatefulWidget {
  final String examUrl;
  final String examTitle;
  final String studentName;
  final String studentClass;
  final String deviceId;
  final int initialBattery;
  final String supervisorPin;
  final String? firebaseDbUrl;

  const ExamScreen({
    super.key,
    required this.examUrl,
    required this.examTitle,
    required this.studentName,
    required this.studentClass,
    required this.deviceId,
    required this.initialBattery,
    required this.supervisorPin,
    this.firebaseDbUrl,
  });

  @override
  State<ExamScreen> createState() => _ExamScreenState();
}

class _ExamScreenState extends State<ExamScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  double _loadingProgress = 0.0;
  static const MethodChannel _kioskChannel = MethodChannel('com.exambro.app/kiosk');

  int _violationsCount = 0;
  int _currentBattery = 100;
  Timer? _heartbeatTimer;
  late final String _studentKey;

  @override
  void initState() {
    super.initState();
    _currentBattery = widget.initialBattery;
    _studentKey = _sanitizeKey("${widget.studentName}_${widget.studentClass}");

    WakelockPlus.enable();
    _aktifkanModeKiosk();
    _startHeartbeat();

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (mounted) {
              setState(() {
                _loadingProgress = progress / 100.0;
                _isLoading = progress < 100;
              });
            }
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.examUrl));
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    super.dispose();
  }

  String _sanitizeKey(String raw) {
    return raw.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_').toLowerCase();
  }

  Future<void> _aktifkanModeKiosk() async {
    try {
      await _kioskChannel.invokeMethod('startLockTask');
    } catch (_) {}
  }

  Future<void> _matikanModeKiosk() async {
    try {
      await _kioskChannel.invokeMethod('stopLockTask');
    } catch (_) {}
  }

  void _startHeartbeat() {
    _sendHeartbeat(status: 'examining');

    _heartbeatTimer = Timer.periodic(const Duration(seconds: 6), (_) async {
      try {
        final info = await _kioskChannel.invokeMapMethod<String, dynamic>('getDeviceInfo');
        if (info != null && info.containsKey('battery')) {
          _currentBattery = (info['battery'] as num?)?.toInt() ?? _currentBattery;
        }
      } catch (_) {}

      _sendHeartbeat(status: _violationsCount > 0 ? 'warning' : 'examining');
    });
  }

  Future<void> _sendHeartbeat({required String status}) async {
    final dbUrl = widget.firebaseDbUrl;
    if (dbUrl == null || dbUrl.isEmpty) return;

    try {
      String cleanDb = dbUrl.trim();
      if (cleanDb.endsWith('/')) cleanDb = cleanDb.substring(0, cleanDb.length - 1);

      final url = Uri.parse("$cleanDb/exambro/students/$_studentKey.json");
      final payload = jsonEncode({
        'name': widget.studentName,
        'class': widget.studentClass,
        'deviceId': widget.deviceId,
        'status': status,
        'battery': _currentBattery,
        'violations': _violationsCount,
        'lastPing': DateTime.now().toIso8601String(),
      });

      final response = await http.patch(
        url,
        body: payload,
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is Map && (data['status'] == 'unlocked' || data['status'] == 'done')) {
          _exitViaRemoteUnlock();
        }
      }
    } catch (_) {}
  }

  void _exitViaRemoteUnlock() async {
    _heartbeatTimer?.cancel();
    await _matikanModeKiosk();
    WakelockPlus.disable();

    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.check_circle_outline, color: Colors.emerald),
            SizedBox(width: 8),
            Text('Ujian Selesai'),
          ],
        ),
        content: const Text('Kunci ujian telah dibuka oleh Pengawas / Guru. Terima kasih!'),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pop(context);
            },
            child: const Text('Keluar Aplikasi'),
          ),
        ],
      ),
    );
  }

  void _dialogKeluar() {
    _violationsCount++;
    _sendHeartbeat(status: 'warning');

    final TextEditingController passController = TextEditingController();
    bool obscureText = true;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.lock_outline_rounded, color: Colors.redAccent),
              SizedBox(width: 8),
              Text('Keluar dari Ujian'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Masukkan PIN Pengawas untuk membuka kunci layar:',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: passController,
                obscureText: obscureText,
                keyboardType: TextInputType.number,
                autofocus: true,
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  labelText: 'PIN Pengawas (Default: ${widget.supervisorPin})',
                  suffixIcon: IconButton(
                    icon: Icon(obscureText ? Icons.visibility_off : Icons.visibility, size: 20),
                    onPressed: () => setDialogState(() => obscureText = !obscureText),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Batal'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () async {
                if (passController.text == widget.supervisorPin) {
                  _heartbeatTimer?.cancel();
                  await _sendHeartbeat(status: 'done');
                  await _matikanModeKiosk();
                  WakelockPlus.disable();
                  if (mounted) {
                    Navigator.pop(ctx);
                    Navigator.pop(context);
                  }
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Password Pengawas Salah!'),
                      backgroundColor: Colors.red,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
              child: const Text('Buka Kunci'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          _dialogKeluar();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          elevation: 1,
          title: Row(
            children: [
              const Icon(Icons.shield_rounded, size: 18, color: Colors.white),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.examTitle,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      "${widget.studentName} (${widget.studentClass})",
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: Colors.white70),
                    ),
                  ],
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF1565C0),
          foregroundColor: Colors.white,
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              tooltip: 'Muat Ulang Halaman',
              onPressed: () => _controller.reload(),
            ),
            IconButton(
              icon: const Icon(Icons.exit_to_app_rounded),
              tooltip: 'Keluar Ujian',
              onPressed: _dialogKeluar,
            ),
          ],
        ),
        body: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_isLoading)
              LinearProgressIndicator(
                value: _loadingProgress > 0 ? _loadingProgress : null,
                color: Colors.amber,
                backgroundColor: Colors.transparent,
              ),
          ],
        ),
      ),
    );
  }
}
