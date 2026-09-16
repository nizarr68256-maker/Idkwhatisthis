/* ==========================================================================
   YUSMENTORO67 / LYNUXS — maskot global persistent.

   ★ STEP 5.7 — Bigger headline + credits + extended fall.
   ★ STEP 5.8 — Credits lifecycle: ENTER → HOLD → EXIT → CLEANUP.
   ★ STEP 5.9 — INIT RELIABILITY:
     - Single-start guarantee (arrivalStarted flag).
     - isArrivalEligible() re-check di bootstrap + fire-time.
     - bootstrapCinematic() dipanggil setelah DOM ready.
     - Watchdog 22s: force cleanup jika cinematic stuck.
     - Fail-safe: charEl selalu di-reveal jika cinematic di-skip/gagal.
     - Debug log via `?y67debug=1` di URL.
   ★ STEP 6.0 — NATURAL FREE-FALL BODY ANIMATION:
     - Class `y67-anim-freefall` ditambahkan pada bodyEl selama lock
       phase (8s). CSS keyframe di css/yusmentoro67.css memberi drift
       halus, tilt, sway pada legs, flutter pada ears, tilt pada head.
     - Class dihapus saat settle — keyframe 100% = identity, jadi
       tidak ada lompatan visual.
     - Tidak mengubah charEl (camera-follow), cinematicScale, atau
       posisi world. Murni lokal pada sub-elements SVG.

   Tidak ada perubahan pada: camera-follow, fall duration, cloud,
   headline, credits, city, landing, get-up, glasses, responsive
   framing, sessionStorage, cinematic init.
   ========================================================================== */

(function () {
	"use strict";

	/* ---------------------------------------------------------------------
	   ★ STEP 5.9 — Debug helper. Enable via URL: ?y67debug=1
	   --------------------------------------------------------------------- */
	var Y67_DEBUG = (function () {
		try {
			return /[?&]y67debug=1(?:&|$)/.test(window.location.search);
		} catch (e) {
			return false;
		}
	})();
	function y67Log() {
		if (!Y67_DEBUG) return;
		try {
			var args = Array.prototype.slice.call(arguments);
			args.unshift("[Y67 CINEMATIC]");
			console.log.apply(console, args);
		} catch (e) {}
	}

	var charEl = document.getElementById("yusmentoro67Char");
	var flipEl = document.getElementById("yusmentoro67Flip");
	var bodyEl = document.getElementById("yusmentoro67Body");
	var bubbleEl = document.getElementById("yusmentoro67Bubble");
	var overlayEl = document.getElementById("yusmentoro67Overlay");
	var panelTitleEl = document.getElementById("yusmentoro67PanelTitle");
	var panelBodyEl = document.getElementById("yusmentoro67PanelBody");
	var closeBtn = document.getElementById("yusmentoro67CloseBtn");
	var dustEl = document.getElementById("y67Dust");

	var slide1CityScene = document.getElementById("slide1CityScene");
	var slide1CloudWorld = document.getElementById("slide1CloudWorld");
	var slide1Heading = document.getElementById("slide1Heading");
	var slide1Desc = document.getElementById("slide1Desc");
	var s1SkyHeadlineLayer = document.getElementById("s1SkyHeadlineLayer");
	var s1SkyHeadline = document.getElementById("s1SkyHeadline");
	var s1SkyCredits = document.getElementById("s1SkyCredits");

	if (
		!charEl ||
		!flipEl ||
		!bodyEl ||
		!bubbleEl ||
		!overlayEl ||
		!panelTitleEl ||
		!panelBodyEl ||
		!closeBtn
	) {
		y67Log("FATAL: required DOM elements missing, script aborted");
		return;
	}

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	var Y67_SKIN = "skin02";
	var TOTAL_SLIDES = 8;

	var currentLiftY = 0;
	var currentTilt = 0;

	var pointerId = null;
	var pointerMode = "idle";
	var pStartClientX = 0;
	var pStartClientY = 0;
	var pCharStartX = 0;
	var pCharStartY = 0;
	var pLastClientX = 0;
	var pLastClientY = 0;
	var pLastMoveTime = 0;
	var pVelX = 0;
	var pVelY = 0;
	var lastTapUpTime = 0;

	var throwState = null;
	var throwRAFId = null;

	var DRAG_THRESHOLD_PX = 10;
	var DOUBLE_TAP_MS = 350;
	var THROW_GRAVITY = 2800;
	var THROW_AIR_DAMPING = 0.55;
	var THROW_END_SPEED = 25;

	var specialState = null;
	var specialCooldownUntil = 0;

	var ARRIVAL_KEY = "y67_arrived_v1";
	var CINEMATIC_START_DELAY_MS = 300;
	var SPECIAL_COOLDOWN_MS = 20000;
	var SPECIAL_CHANCE = 0.22;
	var SLEEP_DURATION_MS = 8000;

	var CINEMATIC_FALL_MS = 10000;
	var CINEMATIC_LOCK_PHASE_MS = 8000;
	var CINEMATIC_SETTLE_MS = 2000;

	var CINEMATIC_EASING_LOCK = "cubic-bezier(0.4, 0.0, 0.6, 1.0)";
	var CINEMATIC_EASING_SETTLE = "cubic-bezier(0.3, 0.0, 0.7, 1.0)";

	var CINEMATIC_LOCK_SCENE_START_PCT = 1100;
	var CINEMATIC_LOCK_SCENE_END_PCT = 50;

	var CINEMATIC_CLOUD_START_PCT = 900;
	var CINEMATIC_CLOUD_LOCK_END_PCT = -1500;

	var CINEMATIC_HEADLINE_START_PCT = 15;
	var CINEMATIC_HEADLINE_LOCK_END_PCT = -10;

	var CINEMATIC_HEADLINE_APPEAR_MS = 1000;
	var CINEMATIC_CREDITS_APPEAR_MS = 1500;
	var CINEMATIC_CREDITS_EXIT_MS = 4500;
	var CINEMATIC_HEADLINE_EXIT_MS = 5600;
	var CINEMATIC_CLEANUP_MS = 6400;

	var CINEMATIC_CLOSE_SCALE = 3;
	var CINEMATIC_PULLBACK_MS = 1400;
	var CINEMATIC_PULLBACK_EASING = "cubic-bezier(0.22, 0.68, 0.16, 1)";

	/* Watchdog duration. Margin > total cinematic (~15.5s). */
	var CINEMATIC_WATCHDOG_MS = 22000;

	var cinematicScale = 1;
	var cinematicFrame = null;
	var cinematicRunning = false;
	var arrivalStarted = false;
	var cinematicTimer = null;
	var headlineTimer = null;
	var creditsTimer = null;
	var exitTimers = [];
	var cinematicWatchdogTimer = null;
	var bootstrapDone = false;

	function scheduleCinematic(fn, ms) {
		clearCinematicTimer();
		cinematicTimer = setTimeout(fn, ms);
	}
	function clearCinematicTimer() {
		if (cinematicTimer) {
			clearTimeout(cinematicTimer);
			cinematicTimer = null;
		}
	}
	function scheduleHeadline(fn, ms) {
		clearHeadlineTimer();
		headlineTimer = setTimeout(fn, ms);
	}
	function clearHeadlineTimer() {
		if (headlineTimer) {
			clearTimeout(headlineTimer);
			headlineTimer = null;
		}
	}
	function scheduleCredits(fn, ms) {
		clearCreditsTimer();
		creditsTimer = setTimeout(fn, ms);
	}
	function clearCreditsTimer() {
		if (creditsTimer) {
			clearTimeout(creditsTimer);
			creditsTimer = null;
		}
	}
	function scheduleExit(fn, ms) {
		var id = setTimeout(fn, ms);
		exitTimers.push(id);
		return id;
	}
	function clearExitTimers() {
		for (var i = 0; i < exitTimers.length; i++) clearTimeout(exitTimers[i]);
		exitTimers.length = 0;
	}
	function armCinematicWatchdog() {
		clearCinematicWatchdog();
		cinematicWatchdogTimer = setTimeout(function () {
			cinematicWatchdogTimer = null;
			if (specialState === "arrival") {
				y67Log("watchdog: cinematic stuck, force cleanup");
				cancelSpecial("watchdog");
			}
		}, CINEMATIC_WATCHDOG_MS);
	}
	function clearCinematicWatchdog() {
		if (cinematicWatchdogTimer) {
			clearTimeout(cinematicWatchdogTimer);
			cinematicWatchdogTimer = null;
		}
	}

	function hasArrived() {
		try {
			return sessionStorage.getItem(ARRIVAL_KEY) === "1";
		} catch (e) {
			return false;
		}
	}
	function markArrived() {
		try {
			sessionStorage.setItem(ARRIVAL_KEY, "1");
		} catch (e) {}
	}

	function resetSkyCredits() {
		if (s1SkyHeadline) {
			s1SkyHeadline.classList.remove(
				"is-visible",
				"is-exiting",
				"is-hidden"
			);
		}
		if (s1SkyCredits) {
			s1SkyCredits.classList.remove(
				"is-visible",
				"is-exiting",
				"is-hidden"
			);
		}
	}
	function cleanupSkyCredits() {
		if (s1SkyHeadline) {
			s1SkyHeadline.classList.remove("is-visible", "is-exiting");
			s1SkyHeadline.classList.add("is-hidden");
		}
		if (s1SkyCredits) {
			s1SkyCredits.classList.remove("is-visible", "is-exiting");
			s1SkyCredits.classList.add("is-hidden");
		}
	}

	function ensureCharVisible() {
		if (!charEl) return;
		charEl.style.visibility = "";
		charEl.style.opacity = "";
	}

	/* ---------------------------------------------------------------------
	   1. KONTEN "Hmm?"
	   --------------------------------------------------------------------- */
	var QA = {
		1: [
			{
				q: "Apa itu globalisasi sosial?",
				a: [
					"Globalisasi sosial adalah proses meningkatnya keterhubungan dan ketergantungan antarmasyarakat di berbagai belahan dunia.",
					"Proses ini didorong oleh kemajuan teknologi, transportasi, ekonomi, serta pertukaran budaya dan ide yang membuat jarak terasa semakin dekat."
				]
			},
			{
				q: "Mengapa dunia semakin terhubung?",
				a: [
					"Kemajuan teknologi komunikasi dan transportasi membuat informasi, barang, dan manusia bisa berpindah antarnegara jauh lebih cepat dibanding sebelumnya.",
					"Interaksi lintas negara yang dulu jarang terjadi kini menjadi bagian dari kehidupan sehari-hari, mulai dari perdagangan hingga pertemanan daring."
				]
			},
			{
				q: "Apa peran teknologi dalam globalisasi?",
				a: [
					"Teknologi, terutama internet dan media sosial, menjadi penggerak utama globalisasi karena memungkinkan pertukaran informasi dan budaya berlangsung hampir seketika.",
					"Tanpa teknologi digital, keterhubungan lintas negara yang kita rasakan hari ini akan jauh lebih lambat dan terbatas."
				]
			}
		],
		2: [
			{
				q: "Mengapa pola interaksi berubah?",
				a: [
					"Kehadiran platform digital menggeser sebagian interaksi sosial dari ruang fisik ke ruang virtual.",
					"Orang kini bisa membangun relasi, berdiskusi, dan berkolaborasi dengan orang di negara lain tanpa pernah bertemu langsung."
				]
			},
			{
				q: "Apa itu komunitas virtual?",
				a: [
					"Komunitas virtual adalah kelompok sosial yang terbentuk dan berinteraksi terutama melalui platform digital, bukan lewat pertemuan tatap muka.",
					"Anggotanya bisa tersebar di berbagai negara namun tetap merasa terhubung karena minat atau tujuan yang sama."
				]
			},
			{
				q: "Bagaimana informasi menyebar dengan cepat?",
				a: [
					"Media sosial dan platform berbagi konten memungkinkan sebuah informasi menjangkau jutaan orang di berbagai negara hanya dalam hitungan jam.",
					"Kecepatan ini membawa manfaat besar, tapi juga membuat penyebaran informasi yang keliru lebih sulit dikendalikan."
				]
			}
		],
		3: [
			{
				q: "Apa itu difusi budaya?",
				a: [
					"Difusi budaya adalah proses penyebaran unsur budaya — seperti makanan, musik, bahasa, atau kebiasaan — dari satu kelompok masyarakat ke kelompok masyarakat lain.",
					"Proses ini terjadi melalui migrasi, perdagangan, media, teknologi, dan interaksi sosial antarbangsa."
				]
			},
			{
				q: "Apa itu glocalization?",
				a: [
					"Glocalization adalah proses ketika unsur global diadaptasi agar sesuai dengan kondisi, kebutuhan, atau budaya lokal.",
					"Contohnya, sebuah merek atau konsep global sering menyesuaikan rasa dan gayanya dengan selera masyarakat setempat."
				]
			},
			{
				q: "Apa itu hibridisasi budaya?",
				a: [
					"Hibridisasi budaya adalah proses bercampurnya unsur-unsur budaya yang berbeda hingga melahirkan bentuk budaya baru.",
					"Musik, makanan, fesyen, atau seni yang menggabungkan beberapa unsur budaya adalah contoh nyata dari proses ini."
				]
			},
			{
				q: "Apakah budaya lokal bisa hilang?",
				a: [
					"Budaya lokal tidak selalu hilang ketika bertemu budaya lain — ia bisa beradaptasi, berubah, atau justru bercampur menjadi sesuatu yang baru.",
					"Yang menentukan kelangsungannya adalah seberapa aktif suatu masyarakat menjaga dan mengembangkan budayanya sendiri."
				]
			}
		],
		4: [
			{
				q: "Apa peluang globalisasi?",
				a: [
					"Globalisasi membuka akses lebih luas terhadap pengetahuan, budaya baru, peluang ekonomi, dan kolaborasi lintas negara.",
					"Masyarakat dapat belajar dari pengalaman dan inovasi yang sebelumnya sulit dijangkau."
				]
			},
			{
				q: "Apa tantangan globalisasi?",
				a: [
					"Globalisasi juga membawa tantangan seperti kesenjangan ekonomi, tekanan terhadap budaya lokal, dan penyebaran informasi yang tidak selalu akurat.",
					"Tantangan ini menuntut masyarakat untuk lebih kritis dan selektif."
				]
			},
			{
				q: "Apakah dampaknya selalu sama bagi semua orang?",
				a: [
					"Tidak. Dampak globalisasi dirasakan berbeda-beda tergantung akses teknologi, ekonomi, dan pendidikan setiap individu atau daerah.",
					"Kelompok dengan akses lebih besar umumnya lebih diuntungkan dibanding kelompok dengan keterbatasan akses."
				]
			}
		],
		5: [
			{
				q: "Apa itu kesenjangan digital?",
				a: [
					"Kesenjangan digital adalah perbedaan akses terhadap teknologi informasi dan komunikasi antara satu kelompok masyarakat dengan kelompok lainnya.",
					"Kesenjangan ini bisa terjadi antarnegara, antarwilayah, maupun antarindividu."
				]
			},
			{
				q: "Mengapa akses teknologi tidak merata?",
				a: [
					"Faktor seperti infrastruktur, kondisi ekonomi, dan lokasi geografis membuat sebagian masyarakat lebih sulit mengakses internet dan perangkat digital dibanding yang lain.",
					"Akibatnya, manfaat globalisasi tidak dirasakan secara merata oleh semua orang."
				]
			},
			{
				q: "Apa hubungannya dengan pendidikan?",
				a: [
					"Akses teknologi yang timpang berdampak langsung pada kesempatan belajar, terutama saat pembelajaran mengandalkan perangkat dan koneksi internet.",
					"Siswa dengan akses terbatas berisiko tertinggal dari siswa yang memiliki akses lebih baik."
				]
			}
		],
		6: [
			{
				q: "Apa itu Global Village?",
				a: [
					'Global Village adalah gagasan Marshall McLuhan yang menggambarkan dunia yang terasa semakin "kecil" karena media dan teknologi komunikasi menghubungkan manusia di berbagai belahan bumi seolah tinggal dalam satu desa.',
					"Peristiwa di satu negara kini bisa langsung diketahui dan dirasakan dampaknya di negara lain."
				]
			},
			{
				q: "Apa itu McDonaldization?",
				a: [
					"McDonaldization adalah konsep dari sosiolog George Ritzer yang menjelaskan bagaimana prinsip efisiensi, keterukuran, prediktabilitas, dan kontrol semakin memengaruhi berbagai bidang kehidupan.",
					"Prinsip yang awalnya terlihat di restoran cepat saji ini kini meluas ke berbagai institusi dan layanan lain."
				]
			},
			{
				q: "Apa itu Cultural Imperialism?",
				a: [
					"Cultural Imperialism menggambarkan penyebaran budaya dari kelompok atau negara yang lebih dominan sehingga dapat memengaruhi, bahkan menekan, budaya lokal.",
					"Meski begitu, budaya lokal tetap bisa bertahan dengan cara beradaptasi, bukan sekadar tergantikan."
				]
			},
			{
				q: "Apa itu Glocalization?",
				a: [
					"Glocalization adalah proses ketika unsur global diadaptasi dengan kondisi dan budaya lokal, sehingga global dan lokal tidak selalu bertentangan.",
					"Perpaduan keduanya justru sering menghasilkan bentuk baru yang lebih relevan bagi masyarakat setempat."
				]
			},
			{
				q: "Apa itu Network Society?",
				a: [
					"Network Society adalah konsep dari sosiolog Manuel Castells tentang masyarakat yang semakin terorganisasi melalui jaringan informasi dan komunikasi digital.",
					"Media sosial, kerja jarak jauh, dan komunitas daring adalah wujud nyata dari masyarakat berjejaring ini."
				]
			}
		],
		7: [
			{
				q: "Bagaimana cara menghadapi globalisasi?",
				a: [
					"Menghadapi globalisasi berarti bersikap terbuka terhadap pengetahuan baru, kritis dalam menyaring informasi, tetap berakar pada budaya sendiri, saling menghargai perbedaan, dan mendorong akses yang inklusif bagi semua orang.",
					"Kelima sikap ini membantu masyarakat mengambil manfaat globalisasi tanpa kehilangan arah."
				]
			},
			{
				q: "Mengapa literasi digital penting?",
				a: [
					"Literasi digital membantu seseorang memilah informasi yang benar dari yang menyesatkan di tengah derasnya arus informasi global.",
					"Tanpa literasi digital, masyarakat lebih rentan terhadap hoaks dan manipulasi informasi."
				]
			},
			{
				q: "Mengapa budaya lokal perlu dikembangkan?",
				a: [
					"Budaya lokal adalah identitas yang membedakan satu masyarakat dari masyarakat lain di tengah arus globalisasi yang menyeragamkan.",
					"Dengan terus mengembangkan budaya sendiri, masyarakat tetap bisa terbuka pada dunia luar tanpa kehilangan jati diri."
				]
			}
		],
		8: [
			{
				q: "Apa itu globalisasi sosial?",
				a: [
					"Globalisasi sosial adalah proses meningkatnya keterhubungan dan ketergantungan antarmasyarakat di berbagai belahan dunia, didorong oleh teknologi, ekonomi, dan pertukaran budaya."
				]
			},
			{
				q: "Bagaimana cara menghadapi globalisasi?",
				a: [
					"Dengan bersikap terbuka, kritis, tetap berakar pada budaya sendiri, saling menghargai, dan mendorong akses yang inklusif bagi semua orang."
				]
			}
		]
	};

	/* ---------------------------------------------------------------------
	   2. KOMENTAR RANDOM
	   --------------------------------------------------------------------- */
	var GENERIC_COMMENTS = [
		"Hmm...",
		"Hmm?",
		"ah...",
		"Idc",
		"Idk",
		"...",
		"Derap...",
		"Yupi...",
		"🤓",
		"?",
		"@#!$%",
		"Gokil",
		"ugh..."
	];
	var SLIDE_COMMENTS = {
		1: ["Hmm...", "Boring..."],
		2: ["Intresting..."],
		3: ["I don't care about that"],
		4: ["my name yusmentoro67"],
		5: ["im need sleep.."],
		6: ["i need rest..."],
		7: ["-_-"],
		8: ["Rapa ♡ Jaya"]
	};
	var SLIDE_BEHAVIOR_HINT = {
		1: "lookup",
		3: "lookdown",
		5: "lookdown",
		6: "glance",
		7: "lookup"
	};

	/* ---------------------------------------------------------------------
	   3. JALUR AMAN
	   --------------------------------------------------------------------- */
	var DEFAULT_TRACK = { min: 4, max: 72 };
	var SLIDE_TRACKS = { 4: { min: 4, max: 30 } };
	var TIGHT_SIZE_SLIDES = {
		4: { size: "clamp(24px, 2vw, 30px)", bottom: "clamp(2px, 0.3vh, 4px)" }
	};

	function getTrack(slideNum) {
		return SLIDE_TRACKS[slideNum] || DEFAULT_TRACK;
	}

	function applySizeForSlide(slideNum) {
		var tight = TIGHT_SIZE_SLIDES[slideNum];
		if (tight) {
			charEl.style.setProperty("--y67-size", tight.size);
			charEl.style.setProperty("--y67-bottom", tight.bottom);
		} else {
			charEl.style.removeProperty("--y67-size");
			charEl.style.removeProperty("--y67-bottom");
		}
	}

	/* ---------------------------------------------------------------------
	   4. DETEKSI SLIDE AKTIF
	   --------------------------------------------------------------------- */
	function detectCurrentSlide() {
		for (var i = 1; i <= TOTAL_SLIDES; i++) {
			var el = document.getElementById("slide" + i + "Scene");
			if (el && el.classList.contains("is-active")) return i;
		}
		return 1;
	}

	var currentSlide = detectCurrentSlide();
	applySizeForSlide(currentSlide);

	/* ---------------------------------------------------------------------
	   5. STATE GERAKAN
	   --------------------------------------------------------------------- */
	var posPx = 0;
	var dir = 1;
	var boundsMinPx = 0;
	var boundsMaxPx = 0;
	var walkTimer = null;
	var panelOpen = false;
	var SPEED_PX_S = 24;

	function scheduleTimer(fn, ms) {
		clearScheduledTimer();
		walkTimer = setTimeout(fn, ms);
	}
	function clearScheduledTimer() {
		if (walkTimer) {
			clearTimeout(walkTimer);
			walkTimer = null;
		}
	}

	function isBusy() {
		return panelOpen || pointerMode !== "idle" || specialState !== null;
	}

	function recomputeBounds() {
		var t = getTrack(currentSlide);
		var vw = window.innerWidth || document.documentElement.clientWidth;
		boundsMinPx = (vw * t.min) / 100;
		boundsMaxPx = (vw * t.max) / 100;
		if (posPx < boundsMinPx) posPx = boundsMinPx;
		if (posPx > boundsMaxPx) posPx = boundsMaxPx;
	}

	function applyPosition(px, transitionSec) {
		charEl.style.transition =
			"transform " +
			transitionSec +
			"s linear, bottom 260ms ease, width 260ms ease, height 260ms ease";
		charEl.style.transform =
			"translate3d(" +
			px +
			"px, " +
			currentLiftY +
			"px, 0) scale(" +
			cinematicScale +
			")";
	}

	/* ---------------------------------------------------------------------
	   5b. CINEMATIC
	   --------------------------------------------------------------------- */

	function setCinematicScale(scale, durationSec, easing) {
		cinematicScale = scale;
		charEl.style.transition =
			"transform " +
			durationSec +
			"s " +
			easing +
			", bottom 260ms ease, width 260ms ease, height 260ms ease";
		charEl.style.transform =
			"translate3d(" +
			posPx +
			"px, " +
			currentLiftY +
			"px, 0) scale(" +
			cinematicScale +
			")";
	}

	function readPctVar(name, fallback) {
		var v = parseFloat(getComputedStyle(charEl).getPropertyValue(name));
		return isFinite(v) ? v : fallback;
	}

	function computeResponsiveCinematicScale(naturalW, naturalH) {
		var vw = window.innerWidth || document.documentElement.clientWidth;
		var vh = window.innerHeight || document.documentElement.clientHeight;
		if (naturalW <= 0 || naturalH <= 0) return CINEMATIC_CLOSE_SCALE;
		var maxByWidth = (vw * 0.4) / naturalW;
		var maxByHeight = (vh * 0.5) / naturalH;
		var s = Math.min(CINEMATIC_CLOSE_SCALE, maxByWidth, maxByHeight);
		if (!isFinite(s) || s < 0.4) s = 0.4;
		return s;
	}

	function applyCinematicStart() {
		if (cinematicRunning) {
			y67Log("applyCinematicStart skipped: already running");
			return;
		}
		cinematicRunning = true;
		cinematicFrame = { x: posPx, y: currentLiftY };

		charEl.style.transition = "none";
		charEl.style.transform =
			"translate3d(" + posPx + "px, " + currentLiftY + "px, 0) scale(1)";
		var rect = charEl.getBoundingClientRect();
		var naturalW = rect.width;
		var naturalH = rect.height;
		y67Log("natural size", naturalW, "x", naturalH);

		var S = computeResponsiveCinematicScale(naturalW, naturalH);
		cinematicScale = S;
		y67Log("computed scale", S);

		var vw = window.innerWidth || document.documentElement.clientWidth;
		var vh = window.innerHeight || document.documentElement.clientHeight;

		var anchorXpct = readPctVar("--y67-cinematic-x", 35);
		var anchorYpct = readPctVar("--y67-cinematic-y", 40);
		var targetCenterX = (vw * anchorXpct) / 100;
		var targetCenterY = (vh * anchorYpct) / 100;

		var halfW = (naturalW * S) / 2;
		var halfH = (naturalH * S) / 2;
		var marginX = vw * 0.06;
		var marginY = vh * 0.06;
		var minCx = halfW + marginX;
		var maxCx = vw - halfW - marginX;
		var minCy = halfH + marginY;
		var maxCy = vh - halfH - marginY;

		if (maxCx < minCx) {
			targetCenterX = vw / 2;
		} else {
			if (targetCenterX < minCx) targetCenterX = minCx;
			if (targetCenterX > maxCx) targetCenterX = maxCx;
		}
		if (maxCy < minCy) {
			targetCenterY = vh / 2;
		} else {
			if (targetCenterY < minCy) targetCenterY = minCy;
			if (targetCenterY > maxCy) targetCenterY = maxCy;
		}

		var curCenterX = rect.left + naturalW / 2;
		var curCenterY = rect.top + naturalH / 2;

		posPx += targetCenterX - curCenterX;
		currentLiftY += targetCenterY - curCenterY;

		charEl.style.transition = "none";
		charEl.style.transform =
			"translate3d(" +
			posPx +
			"px, " +
			currentLiftY +
			"px, 0) scale(" +
			S +
			")";

		if (slide1CityScene) {
			slide1CityScene.style.transition = "none";
			slide1CityScene.style.opacity = "";
			slide1CityScene.style.visibility = "";
			slide1CityScene.style.display = "";
			slide1CityScene.style.transform =
				"translateY(" + CINEMATIC_LOCK_SCENE_START_PCT + "%)";
		}
		if (slide1CloudWorld) {
			slide1CloudWorld.style.transition = "none";
			slide1CloudWorld.style.transform =
				"translateY(" + CINEMATIC_CLOUD_START_PCT + "%)";
		}
		if (slide1Heading) {
			slide1Heading.style.transition = "none";
			slide1Heading.style.opacity = "0";
			slide1Heading.style.transform = "translateY(-14px)";
		}
		if (slide1Desc) {
			slide1Desc.style.transition = "none";
			slide1Desc.style.opacity = "0";
			slide1Desc.style.transform = "translateY(14px)";
		}
		if (s1SkyHeadlineLayer) {
			s1SkyHeadlineLayer.style.transition = "none";
			s1SkyHeadlineLayer.style.transform =
				"translateY(" + CINEMATIC_HEADLINE_START_PCT + "%)";
		}
		resetSkyCredits();
	}

	function startCinematicFall() {
		if (!cinematicRunning) {
			y67Log("startCinematicFall skipped: not running");
			return;
		}
		var dur = CINEMATIC_LOCK_PHASE_MS / 1000;
		var easing = CINEMATIC_EASING_LOCK;

		if (slide1CityScene) {
			void slide1CityScene.offsetWidth;
			slide1CityScene.style.transition =
				"transform " + dur + "s " + easing;
			slide1CityScene.style.transform =
				"translateY(" + CINEMATIC_LOCK_SCENE_END_PCT + "%)";
		}
		if (slide1CloudWorld) {
			void slide1CloudWorld.offsetWidth;
			slide1CloudWorld.style.transition =
				"transform " + dur + "s " + easing;
			slide1CloudWorld.style.transform =
				"translateY(" + CINEMATIC_CLOUD_LOCK_END_PCT + "%)";
		}
		if (s1SkyHeadlineLayer) {
			void s1SkyHeadlineLayer.offsetWidth;
			s1SkyHeadlineLayer.style.transition =
				"transform " + dur + "s " + easing;
			s1SkyHeadlineLayer.style.transform =
				"translateY(" + CINEMATIC_HEADLINE_LOCK_END_PCT + "%)";
		}
		y67Log("fall started, duration", dur, "s");
	}

	function startCinematicSettle() {
		if (!cinematicRunning) return;
		/* ★ STEP 6.0 — freefall animation selesai (keyframe 100% = identity).
		   Hapus class supaya settle murni menggerakkan charEl tanpa keyframe
		   tambahan. */
		bodyEl.classList.remove("y67-anim-freefall");
		var dur = CINEMATIC_SETTLE_MS / 1000;
		var easing = CINEMATIC_EASING_SETTLE;
		var S = cinematicScale;

		void charEl.offsetWidth;
		if (slide1CityScene) void slide1CityScene.offsetWidth;

		charEl.style.transition = "transform " + dur + "s " + easing;
		charEl.style.transform =
			"translate3d(" + posPx + "px, 0px, 0) scale(" + S + ")";

		if (slide1CityScene) {
			slide1CityScene.style.transition =
				"transform " + dur + "s " + easing;
			slide1CityScene.style.transform = "translateY(0%)";
		}
		y67Log("settle started");
	}

	function startCameraPullBack() {
		if (slide1Heading) {
			slide1Heading.style.transition =
				"opacity " +
				CINEMATIC_PULLBACK_MS +
				"ms ease, transform " +
				CINEMATIC_PULLBACK_MS +
				"ms " +
				CINEMATIC_PULLBACK_EASING;
			slide1Heading.style.opacity = "1";
			slide1Heading.style.transform = "translateY(0)";
		}
		if (slide1Desc) {
			slide1Desc.style.transition =
				"opacity " +
				CINEMATIC_PULLBACK_MS +
				"ms ease, transform " +
				CINEMATIC_PULLBACK_MS +
				"ms " +
				CINEMATIC_PULLBACK_EASING;
			slide1Desc.style.opacity = "1";
			slide1Desc.style.transform = "translateY(0)";
		}
		setCinematicScale(
			1,
			CINEMATIC_PULLBACK_MS / 1000,
			CINEMATIC_PULLBACK_EASING
		);
		y67Log("pull-back started");
	}

	function finishCinematic() {
		cinematicRunning = false;
		cinematicFrame = null;
		clearCinematicWatchdog();
		y67Log("cinematic finished");
	}

	function resetCinematicVisuals() {
		clearCinematicTimer();
		clearHeadlineTimer();
		clearCreditsTimer();
		clearExitTimers();
		clearCinematicWatchdog();

		if (cinematicFrame) {
			posPx = cinematicFrame.x;
			currentLiftY = cinematicFrame.y;
		}
		cinematicFrame = null;
		cinematicRunning = false;
		cinematicScale = 1;
		arrivalStarted = false;

		charEl.style.transition = "none";
		charEl.style.transform =
			"translate3d(" + posPx + "px, " + currentLiftY + "px, 0) scale(1)";

		if (slide1CityScene) {
			slide1CityScene.style.transition = "none";
			slide1CityScene.style.opacity = "";
			slide1CityScene.style.visibility = "";
			slide1CityScene.style.display = "";
			slide1CityScene.style.transform = "";
		}
		if (slide1CloudWorld) {
			slide1CloudWorld.style.transition = "none";
			slide1CloudWorld.style.transform =
				"translateY(" + CINEMATIC_CLOUD_START_PCT + "%)";
		}
		if (slide1Heading) {
			slide1Heading.style.transition = "none";
			slide1Heading.style.opacity = "1";
			slide1Heading.style.transform = "translateY(0)";
		}
		if (slide1Desc) {
			slide1Desc.style.transition = "none";
			slide1Desc.style.opacity = "1";
			slide1Desc.style.transform = "translateY(0)";
		}
		if (s1SkyHeadlineLayer) {
			s1SkyHeadlineLayer.style.transition = "none";
			s1SkyHeadlineLayer.style.transform =
				"translateY(" + CINEMATIC_HEADLINE_START_PCT + "%)";
		}
		resetSkyCredits();
		ensureCharVisible();
		y67Log("resetCinematicVisuals done");
	}

	function applyFacing(newDir, transitionSec) {
		flipEl.style.transitionDuration = (transitionSec || 0.26) + "s";
		flipEl.style.transform =
			"rotate(" + currentTilt + "deg) scaleX(" + newDir + ")";
	}
	function setTilt(t) {
		currentTilt = t;
		flipEl.style.transform =
			"rotate(" + currentTilt + "deg) scaleX(" + dir + ")";
	}

	/* ---------------------------------------------------------------------
	   6. PERILAKU RANDOM
	   --------------------------------------------------------------------- */
	function playAnim(className, duration, cb) {
		bodyEl.classList.remove("is-walking");
		bodyEl.classList.add(className);
		scheduleBehaviorEnd(function () {
			bodyEl.classList.remove(className);
			if (cb) cb();
		}, duration);
	}

	var behaviorTimer = null;
	function scheduleBehaviorEnd(fn, ms) {
		if (behaviorTimer) clearTimeout(behaviorTimer);
		behaviorTimer = setTimeout(fn, ms);
	}

	var BEHAVIORS = [
		{
			name: "stop",
			tier: "common",
			weight: 12,
			run: function (cb) {
				bodyEl.classList.remove("is-walking");
				scheduleBehaviorEnd(cb, 900 + Math.random() * 700);
			}
		},
		{
			name: "suddenstop",
			tier: "common",
			weight: 10,
			run: function (cb) {
				bodyEl.classList.remove("is-walking");
				bodyEl.classList.add("y67-anim-brake");
				scheduleBehaviorEnd(function () {
					bodyEl.classList.remove("y67-anim-brake");
					scheduleBehaviorEnd(cb, 500 + Math.random() * 400);
				}, 220);
			}
		},
		{
			name: "headtilt",
			tier: "common",
			weight: 14,
			run: function (cb) {
				playAnim("y67-anim-look", 900, cb);
			}
		},
		{
			name: "lookup",
			tier: "common",
			weight: 10,
			run: function (cb) {
				playAnim("y67-anim-lookup", 1000, cb);
			}
		},
		{
			name: "lookback",
			tier: "common",
			weight: 9,
			run: function (cb) {
				playAnim("y67-anim-lookback", 950, cb);
			}
		},
		{
			name: "lookdown",
			tier: "common",
			weight: 8,
			run: function (cb) {
				playAnim("y67-anim-lookdown", 850, cb);
			}
		},
		{
			name: "glasses",
			tier: "uncommon",
			weight: 7,
			run: function (cb) {
				playAnim("y67-anim-glasses", 480, cb);
			}
		},
		{
			name: "hop",
			tier: "uncommon",
			weight: 6,
			run: function (cb) {
				playAnim("y67-anim-hop", 480, cb);
			}
		},
		{
			name: "bounce",
			tier: "uncommon",
			weight: 6,
			run: function (cb) {
				playAnim("y67-anim-bounce", 600, cb);
			}
		},
		{
			name: "confused",
			tier: "uncommon",
			weight: 6,
			run: function (cb) {
				bodyEl.classList.remove("is-walking");
				bodyEl.classList.add("y67-anim-confused");
				showBubble("Hmm?", null, 1200);
				scheduleBehaviorEnd(function () {
					bodyEl.classList.remove("y67-anim-confused");
					cb();
				}, 1100);
			}
		},
		{
			name: "glance",
			tier: "uncommon",
			weight: 6,
			run: function (cb) {
				playAnim("y67-anim-glance", 700, cb);
			}
		},
		{
			name: "quickturn",
			tier: "rare",
			weight: 3,
			run: function (cb) {
				playAnim("y67-anim-quickturn", 380, function () {
					dir = -dir;
					applyFacing(dir, 0.15);
					cb();
				});
			}
		},
		{
			name: "sleep",
			tier: "rare",
			weight: 2,
			run: function (cb) {
				playAnim("y67-anim-sleep", 1900, cb);
			}
		},
		{
			name: "stumble",
			tier: "rare",
			weight: 2,
			run: function (cb) {
				playAnim("y67-anim-stumble", 620, cb);
			}
		}
	];

	function pickBehavior() {
		var total = 0;
		for (var i = 0; i < BEHAVIORS.length; i++) total += BEHAVIORS[i].weight;
		var r = Math.random() * total;
		for (var j = 0; j < BEHAVIORS.length; j++) {
			r -= BEHAVIORS[j].weight;
			if (r <= 0) return BEHAVIORS[j];
		}
		return BEHAVIORS[0];
	}

	function pickBehaviorForSlide() {
		var hint = SLIDE_BEHAVIOR_HINT[currentSlide];
		if (hint && Math.random() < 0.35) {
			for (var i = 0; i < BEHAVIORS.length; i++) {
				if (BEHAVIORS[i].name === hint) return BEHAVIORS[i];
			}
		}
		return pickBehavior();
	}

	function pickCommentText() {
		var slideList = SLIDE_COMMENTS[currentSlide] || [];
		if (slideList.length && Math.random() < 0.5) {
			return slideList[Math.floor(Math.random() * slideList.length)];
		}
		return GENERIC_COMMENTS[
			Math.floor(Math.random() * GENERIC_COMMENTS.length)
		];
	}

	var bubbleTimer = null;
	function showBubble(text, cb, customDurationMs) {
		if (bubbleTimer) clearTimeout(bubbleTimer);
		bubbleEl.textContent = text;
		bubbleEl.classList.add("is-visible");
		var duration =
			typeof customDurationMs === "number"
				? customDurationMs
				: 1300 + Math.random() * 1200;
		bubbleTimer = setTimeout(function () {
			bubbleEl.classList.remove("is-visible");
			if (cb) cb();
		}, duration);
	}

	function maybeShowBubble(prob) {
		if (panelOpen) return;
		if (Math.random() > prob) return;
		showBubble(pickCommentText());
	}

	/* ---------------------------------------------------------------------
	   7. LOOP JALAN
	   --------------------------------------------------------------------- */
	function nextLeg() {
		if (isBusy() || prefersReducedMotion) return;
		recomputeBounds();
		var trackLen = boundsMaxPx - boundsMinPx;
		if (trackLen <= 4) {
			scheduleTimer(nextLeg, 2000);
			return;
		}

		var goToBoundary = Math.random() < 0.35;
		var target;
		if (goToBoundary) {
			target = dir === 1 ? boundsMaxPx : boundsMinPx;
		} else {
			var minStep = trackLen * 0.18;
			var maxStep = trackLen * 0.5;
			var step = minStep + Math.random() * (maxStep - minStep);
			target =
				dir === 1
					? Math.min(boundsMaxPx, posPx + step)
					: Math.max(boundsMinPx, posPx - step);
		}

		var distance = Math.abs(target - posPx);
		var duration = Math.min(9, Math.max(0.9, distance / SPEED_PX_S));

		bodyEl.classList.add("is-walking");
		applyPosition(target, duration);
		var arrivedAtBoundary =
			Math.abs(target - boundsMaxPx) < 0.5 ||
			Math.abs(target - boundsMinPx) < 0.5;
		posPx = target;

		scheduleTimer(function () {
			bodyEl.classList.remove("is-walking");
			if (isBusy()) return;
			if (arrivedAtBoundary) handleBoundary();
			else maybeBehaviorThenContinue();
		}, duration * 1000);
	}

	function handleBoundary() {
		if (isBusy()) return;
		scheduleTimer(
			function () {
				if (isBusy()) return;
				playAnim("y67-anim-look", 900, function () {
					if (isBusy()) return;
					dir = -dir;
					applyFacing(dir);
					maybeShowBubble(0.3);
					scheduleTimer(nextLeg, 260);
				});
			},
			500 + Math.random() * 500
		);
	}

	function maybeBehaviorThenContinue() {
		if (isBusy()) return;
		if (canRunSpecial() && Math.random() < SPECIAL_CHANCE) {
			if (Math.random() < 0.5) startSleep();
			else startCleanGlasses();
			return;
		}
		if (Math.random() < 0.55) {
			var b = pickBehaviorForSlide();
			b.run(function () {
				if (isBusy()) return;
				maybeShowBubble(0.32);
				scheduleTimer(nextLeg, 150);
			});
		} else {
			scheduleTimer(nextLeg, 150);
		}
	}

	/* ---------------------------------------------------------------------
	   7b. SPECIAL ANIMATION SYSTEM
	   --------------------------------------------------------------------- */
	function canRunSpecial() {
		return (
			!specialState &&
			!prefersReducedMotion &&
			Date.now() > specialCooldownUntil
		);
	}

	function cancelSpecial(reason) {
		if (!specialState) return;
		var wasArrival = specialState === "arrival";
		y67Log("cancelSpecial:", reason, wasArrival ? "(was arrival)" : "");
		clearScheduledTimer();
		if (bubbleTimer) {
			clearTimeout(bubbleTimer);
			bubbleTimer = null;
		}
		bubbleEl.classList.remove("is-visible");
		bodyEl.classList.remove("is-walking");
		bodyEl.classList.remove.apply(bodyEl.classList, ALL_ANIM_CLASSES);
		specialState = null;
		specialCooldownUntil = Date.now() + 15000;
		if (wasArrival) resetCinematicVisuals();
	}

	function triggerDustBurst() {
		if (!dustEl) return;
		dustEl.classList.remove("is-burst");
		void dustEl.offsetWidth;
		dustEl.classList.add("is-burst");
		setTimeout(function () {
			dustEl.classList.remove("is-burst");
		}, 900);
	}

	/* ---------------------------------------------------------------------
	   ★ STEP 5.9 — Arrival eligibility check
	   --------------------------------------------------------------------- */
	function isArrivalEligible() {
		if (prefersReducedMotion) {
			y67Log("not eligible: prefers-reduced-motion");
			return false;
		}
		if (arrivalStarted) {
			y67Log("not eligible: arrivalStarted");
			return false;
		}
		if (hasArrived()) {
			y67Log("not eligible: sessionStorage arrived");
			return false;
		}
		var slideNum = detectCurrentSlide();
		if (slideNum !== 1) {
			y67Log("not eligible: slide", slideNum);
			return false;
		}
		if (!charEl) {
			y67Log("not eligible: charEl missing");
			return false;
		}
		return true;
	}

	/* ---------------------------------------------------------------------
	   ★ STEP 5.9 / 6.0 — startArrival dengan single-start guarantee,
	   fail-safe, dan free-fall body animation.
	   --------------------------------------------------------------------- */
	function startArrival() {
		if (arrivalStarted) {
			y67Log("startArrival ignored: already started");
			return;
		}
		if (!isArrivalEligible()) {
			y67Log(
				"startArrival skipped: not eligible, falling back to walking"
			);
			ensureCharVisible();
			scheduleTimer(nextLeg, 1600);
			return;
		}
		arrivalStarted = true;
		markArrived();
		y67Log("arrival started");

		specialState = "arrival";
		clearScheduledTimer();
		clearExitTimers();
		bodyEl.classList.remove("is-walking");
		bodyEl.classList.remove.apply(bodyEl.classList, ALL_ANIM_CLASSES);

		ensureCharVisible();
		applyCinematicStart();
		bodyEl.classList.add("y67-anim-arrival-airborne");
		/* ★ STEP 6.0 — subtle free-fall body animation selama lock phase */
		bodyEl.classList.add("y67-anim-freefall");
		armCinematicWatchdog();

		startCinematicFall();

		scheduleHeadline(function () {
			if (!cinematicRunning) return;
			if (s1SkyHeadline) s1SkyHeadline.classList.add("is-visible");
			y67Log("headline appeared");
		}, CINEMATIC_HEADLINE_APPEAR_MS);

		scheduleCredits(function () {
			if (!cinematicRunning) return;
			if (s1SkyCredits) s1SkyCredits.classList.add("is-visible");
			y67Log("credits appeared");
		}, CINEMATIC_CREDITS_APPEAR_MS);

		scheduleExit(function () {
			if (!cinematicRunning) return;
			if (s1SkyCredits) s1SkyCredits.classList.add("is-exiting");
			y67Log("credits exiting");
		}, CINEMATIC_CREDITS_EXIT_MS);

		scheduleExit(function () {
			if (!cinematicRunning) return;
			if (s1SkyHeadline) s1SkyHeadline.classList.add("is-exiting");
			y67Log("headline exiting");
		}, CINEMATIC_HEADLINE_EXIT_MS);

		scheduleExit(function () {
			if (!cinematicRunning) return;
			cleanupSkyCredits();
			y67Log("sky credits cleanup");
		}, CINEMATIC_CLEANUP_MS);

		scheduleCinematic(function () {
			if (!cinematicRunning) return;
			startCinematicSettle();

			scheduleCinematic(function () {
				if (!cinematicRunning) return;
				currentLiftY = 0;
				bodyEl.classList.remove("y67-anim-arrival-airborne");
				triggerDustBurst();
				bodyEl.classList.add("y67-anim-arrival-lying");
				y67Log("lying");

				scheduleCinematic(function () {
					if (!cinematicRunning) return;
					bodyEl.classList.remove("y67-anim-arrival-lying");
					bodyEl.classList.add("y67-anim-arrival-headlift");
					y67Log("headlift");

					scheduleCinematic(function () {
						if (!cinematicRunning) return;
						bodyEl.classList.remove("y67-anim-arrival-headlift");
						bodyEl.classList.add("y67-anim-arrival-bodilift");
						y67Log("bodilift");

						scheduleCinematic(function () {
							if (!cinematicRunning) return;
							bodyEl.classList.remove(
								"y67-anim-arrival-bodilift"
							);
							bodyEl.classList.add("y67-anim-arrival-stand");
							y67Log("stand");

							scheduleCinematic(function () {
								if (!cinematicRunning) return;
								bodyEl.classList.remove(
									"y67-anim-arrival-stand"
								);
								bodyEl.classList.add("y67-anim-glasses");
								y67Log("glasses");

								scheduleCinematic(function () {
									if (!cinematicRunning) return;
									bodyEl.classList.remove("y67-anim-glasses");
									startCameraPullBack();
									bodyEl.classList.add(
										"y67-anim-arrival-dust"
									);

									scheduleCinematic(function () {
										bodyEl.classList.remove(
											"y67-anim-arrival-dust"
										);
										finishCinematic();
										specialState = null;
										specialCooldownUntil =
											Date.now() + SPECIAL_COOLDOWN_MS;
										scheduleTimer(nextLeg, 400);
										y67Log(
											"arrival complete, walking resumed"
										);
									}, CINEMATIC_PULLBACK_MS + 100);
								}, 550);
							}, 900);
						}, 800);
					}, 700);
				}, 900);
			}, CINEMATIC_SETTLE_MS);
		}, CINEMATIC_LOCK_PHASE_MS);
	}

	function startSleep() {
		if (!canRunSpecial()) return;
		specialState = "sleep";
		clearScheduledTimer();
		bodyEl.classList.remove("is-walking");
		bodyEl.classList.remove.apply(bodyEl.classList, ALL_ANIM_CLASSES);
		bodyEl.classList.add("y67-anim-sleepy");

		scheduleTimer(function () {
			bodyEl.classList.remove("y67-anim-sleepy");
			bodyEl.classList.add("y67-anim-sleep-deep");
			showBubble("Zzz...", null, SLEEP_DURATION_MS - 1200);

			scheduleTimer(function () {
				bodyEl.classList.remove("y67-anim-sleep-deep");
				bodyEl.classList.add("y67-anim-wake");

				scheduleTimer(function () {
					bodyEl.classList.remove("y67-anim-wake");
					specialState = null;
					specialCooldownUntil = Date.now() + SPECIAL_COOLDOWN_MS;
					scheduleTimer(nextLeg, 400);
				}, 600);
			}, SLEEP_DURATION_MS);
		}, 500);
	}

	function startCleanGlasses() {
		if (!canRunSpecial()) return;
		specialState = "cleanglass";
		clearScheduledTimer();
		bodyEl.classList.remove("is-walking");
		bodyEl.classList.remove.apply(bodyEl.classList, ALL_ANIM_CLASSES);
		bodyEl.classList.add("y67-anim-clean-glasses");

		scheduleTimer(function () {
			bodyEl.classList.remove("y67-anim-clean-glasses");
			specialState = null;
			specialCooldownUntil = Date.now() + SPECIAL_COOLDOWN_MS;
			scheduleTimer(nextLeg, 400);
		}, 2100);
	}

	/* ---------------------------------------------------------------------
	   8. PANEL "Hmm?"
	   --------------------------------------------------------------------- */
	function renderQuestionList(slideNum) {
		var items = QA[slideNum] || QA[1];
		panelTitleEl.textContent = "Hmm?";
		panelBodyEl.innerHTML = "";
		var listEl = document.createElement("ul");
		listEl.className = "yusmentoro67-qlist";
		items.forEach(function (item, idx) {
			var li = document.createElement("li");
			var btn = document.createElement("button");
			btn.type = "button";
			btn.className = "yusmentoro67-qitem";

			var label = document.createElement("span");
			label.textContent = item.q;
			var arrow = document.createElement("span");
			arrow.className = "yusmentoro67-qitem__arrow";
			arrow.setAttribute("aria-hidden", "true");
			arrow.textContent = "→";

			btn.appendChild(label);
			btn.appendChild(arrow);
			btn.addEventListener("click", function () {
				renderAnswer(slideNum, idx);
			});
			li.appendChild(btn);
			listEl.appendChild(li);
		});
		panelBodyEl.appendChild(listEl);
	}

	function renderAnswer(slideNum, idx) {
		var items = QA[slideNum] || QA[1];
		var item = items[idx];
		if (!item) return;
		panelBodyEl.innerHTML = "";

		var back = document.createElement("button");
		back.type = "button";
		back.className = "yusmentoro67-answer__back";
		back.textContent = "← Kembali";
		back.addEventListener("click", function () {
			renderQuestionList(slideNum);
		});

		var title = document.createElement("h3");
		title.className = "yusmentoro67-answer__title";
		title.textContent = item.q;

		panelBodyEl.appendChild(back);
		panelBodyEl.appendChild(title);

		item.a.forEach(function (para) {
			var p = document.createElement("p");
			p.className = "yusmentoro67-answer__text";
			p.textContent = para;
			panelBodyEl.appendChild(p);
		});
	}

	function openPanelUI() {
		overlayEl.classList.add("is-open");
		overlayEl.setAttribute("aria-hidden", "false");
		closeBtn.focus();
	}
	function closePanelUI() {
		overlayEl.classList.remove("is-open");
		overlayEl.setAttribute("aria-hidden", "true");
	}

	function openSequence() {
		if (panelOpen) return;
		panelOpen = true;
		clearScheduledTimer();
		if (behaviorTimer) clearTimeout(behaviorTimer);
		bodyEl.classList.remove("is-walking");

		if (prefersReducedMotion) {
			renderQuestionList(currentSlide);
			openPanelUI();
			return;
		}

		var CLICK_LOOK_MS = 480;
		var CLICK_BUBBLE_MS = 750;
		bodyEl.classList.add("y67-anim-click-look");
		setTimeout(function () {
			bodyEl.classList.remove("y67-anim-click-look");
			showBubble(
				"Hmm?",
				function () {
					renderQuestionList(currentSlide);
					openPanelUI();
				},
				CLICK_BUBBLE_MS
			);
		}, CLICK_LOOK_MS);
	}

	function closePanel() {
		if (!panelOpen) return;
		panelOpen = false;
		closePanelUI();
		scheduleTimer(nextLeg, 400);
	}

	closeBtn.addEventListener("click", function (e) {
		e.preventDefault();
		closePanel();
	});
	overlayEl.addEventListener("click", function (e) {
		if (e.target === overlayEl) closePanel();
	});
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && panelOpen) closePanel();
	});

	/* ---------------------------------------------------------------------
	   8b. POINTER SYSTEM
	   --------------------------------------------------------------------- */
	function stopAllBehaviors() {
		clearScheduledTimer();
		if (behaviorTimer) {
			clearTimeout(behaviorTimer);
			behaviorTimer = null;
		}
		bodyEl.classList.remove("is-walking");
		bodyEl.classList.remove.apply(bodyEl.classList, ALL_ANIM_CLASSES);
	}

	function setCharImmediate(px, y) {
		charEl.style.transform = "translate3d(" + px + "px, " + y + "px, 0)";
	}

	function viewportClampX(x) {
		var vw = window.innerWidth || document.documentElement.clientWidth;
		var cw = charEl.offsetWidth || 50;
		var min = 0;
		var max = vw - cw;
		if (max < min) max = min;
		if (x < min) x = min;
		if (x > max) x = max;
		return x;
	}
	function viewportMaxLift() {
		var vh = window.innerHeight || document.documentElement.clientHeight;
		var ch = charEl.offsetHeight || 50;
		var m = vh - ch - 12;
		return m > 0 ? m : 0;
	}

	function onPointerDown(e) {
		if (panelOpen) return;
		if (e.pointerType === "mouse" && e.button !== 0) return;
		if (pointerMode !== "idle") return;
		if (specialState) cancelSpecial("pointerdown");

		var rect = charEl.getBoundingClientRect();
		posPx = rect.left;
		currentLiftY = rect.top - (window.innerHeight - charEl.offsetHeight);
		if (currentLiftY > 0) currentLiftY = 0;
		charEl.style.transition = "none";
		setCharImmediate(posPx, currentLiftY);

		pointerId = e.pointerId;
		pointerMode = "pending";

		pStartClientX = e.clientX;
		pStartClientY = e.clientY;
		pCharStartX = posPx;
		pCharStartY = currentLiftY;
		pLastClientX = e.clientX;
		pLastClientY = e.clientY;
		pLastMoveTime = performance.now();
		pVelX = 0;
		pVelY = 0;

		stopAllBehaviors();
		try {
			charEl.setPointerCapture(e.pointerId);
		} catch (err) {}
	}

	function onPointerMove(e) {
		if (pointerId === null || e.pointerId !== pointerId) return;
		if (pointerMode === "idle" || pointerMode === "throw") return;

		var dx = e.clientX - pStartClientX;
		var dy = e.clientY - pStartClientY;
		var distSq = dx * dx + dy * dy;

		if (pointerMode === "pending") {
			if (distSq < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
			pointerMode = "drag";
			charEl.style.transition = "none";
			flipEl.style.transitionDuration = "0.08s";
			bodyEl.classList.remove("is-walking");
			bodyEl.classList.remove.apply(bodyEl.classList, ALL_ANIM_CLASSES);
			bodyEl.classList.add("is-held");
			charEl.classList.add("is-grabbing");
		}

		var newX = viewportClampX(pCharStartX + dx);
		var newY = pCharStartY + dy;
		var maxLift = viewportMaxLift();
		if (newY > 0) newY = 0;
		if (newY < -maxLift) newY = -maxLift;

		posPx = newX;
		currentLiftY = newY;
		setCharImmediate(posPx, currentLiftY);

		var now = performance.now();
		var dt = (now - pLastMoveTime) / 1000;
		if (dt > 0.005) {
			var ivx = (e.clientX - pLastClientX) / dt;
			var ivy = (e.clientY - pLastClientY) / dt;
			pVelX = pVelX * 0.6 + ivx * 0.4;
			pVelY = pVelY * 0.6 + ivy * 0.4;
			pLastClientX = e.clientX;
			pLastClientY = e.clientY;
			pLastMoveTime = now;

			if (Math.abs(pVelX) > 120) {
				var nd = pVelX > 0 ? 1 : -1;
				if (nd !== dir) {
					dir = nd;
					applyFacing(dir, 0.15);
				}
			}
			var tilt = pVelX * 0.025;
			if (tilt > 12) tilt = 12;
			if (tilt < -12) tilt = -12;
			setTilt(tilt);
		}
	}

	function onPointerUp(e) {
		if (pointerId === null || e.pointerId !== pointerId) return;
		var wasMode = pointerMode;
		pointerId = null;
		try {
			charEl.releasePointerCapture(e.pointerId);
		} catch (err) {}

		if (wasMode === "pending") {
			pointerMode = "idle";
			var now = performance.now();
			if (now - lastTapUpTime < DOUBLE_TAP_MS) {
				lastTapUpTime = 0;
				openSequence();
			} else {
				lastTapUpTime = now;
				scheduleTimer(nextLeg, 400);
			}
			return;
		}

		if (wasMode === "drag") {
			charEl.classList.remove("is-grabbing");
			bodyEl.classList.remove("is-held");
			var idleMs = performance.now() - pLastMoveTime;
			if (idleMs > 150) {
				pVelX = 0;
				pVelY = 0;
			}
			startThrow();
			return;
		}
		pointerMode = "idle";
	}

	function onPointerCancel(e) {
		if (pointerId === null || e.pointerId !== pointerId) return;
		try {
			charEl.releasePointerCapture(e.pointerId);
		} catch (err) {}
		pVelX = 0;
		pVelY = 0;
		if (pointerMode === "drag") {
			charEl.classList.remove("is-grabbing");
			bodyEl.classList.remove("is-held");
			startThrow();
		} else {
			pointerMode = "idle";
			scheduleTimer(nextLeg, 300);
		}
		pointerId = null;
	}

	function startThrow() {
		pointerMode = "throw";
		bodyEl.classList.remove.apply(bodyEl.classList, ALL_ANIM_CLASSES);
		bodyEl.classList.remove("is-walking");

		throwState = {
			x: posPx,
			y: currentLiftY,
			vx: pVelX,
			vy: pVelY,
			lastTime: performance.now(),
			landed: currentLiftY >= -0.5 && pVelY >= 0
		};
		charEl.style.transition = "none";
		flipEl.style.transitionDuration = "0.08s";
		throwRAFId = requestAnimationFrame(throwStep);
	}

	function throwStep(now) {
		if (!throwState) return;
		var dt = (now - throwState.lastTime) / 1000;
		throwState.lastTime = now;
		if (dt > 0.05) dt = 0.05;
		if (dt < 0) dt = 0;

		throwState.vy += THROW_GRAVITY * dt;
		throwState.vx *= Math.pow(THROW_AIR_DAMPING, dt);
		throwState.x += throwState.vx * dt;
		throwState.y += throwState.vy * dt;

		var vw = window.innerWidth || document.documentElement.clientWidth;
		var cw = charEl.offsetWidth || 50;
		if (throwState.x < 0) {
			throwState.x = 0;
			throwState.vx = -throwState.vx * 0.35;
		} else if (throwState.x > vw - cw) {
			throwState.x = vw - cw;
			throwState.vx = -throwState.vx * 0.35;
		}

		var justLanded = false;
		if (throwState.y > 0) {
			throwState.y = 0;
			if (throwState.vy > 0) {
				if (throwState.vy > 140) {
					throwState.vy = -throwState.vy * 0.32;
				} else {
					throwState.vy = 0;
					if (!throwState.landed) justLanded = true;
					throwState.landed = true;
				}
			}
		}
		posPx = throwState.x;
		currentLiftY = throwState.y;
		setCharImmediate(posPx, currentLiftY);

		var tilt = throwState.vx * 0.025;
		if (tilt > 15) tilt = 15;
		if (tilt < -15) tilt = -15;
		setTilt(tilt);

		if (justLanded) {
			bodyEl.classList.add("y67-anim-land");
			setTimeout(function () {
				bodyEl.classList.remove("y67-anim-land");
			}, 520);
		}

		var speedSq =
			throwState.vx * throwState.vx + throwState.vy * throwState.vy;
		var yStable = Math.abs(throwState.y) < 0.5;
		if (
			yStable &&
			throwState.landed &&
			speedSq < THROW_END_SPEED * THROW_END_SPEED
		) {
			endThrow();
			return;
		}
		throwRAFId = requestAnimationFrame(throwStep);
	}

	function endThrow() {
		if (throwRAFId) {
			cancelAnimationFrame(throwRAFId);
			throwRAFId = null;
		}
		throwState = null;
		charEl.style.transition = "";
		flipEl.style.transitionDuration = "";
		recomputeBounds();
		if (posPx < boundsMinPx) posPx = boundsMinPx;
		if (posPx > boundsMaxPx) posPx = boundsMaxPx;
		currentLiftY = 0;
		currentTilt = 0;
		applyFacing(dir, 0.22);
		applyPosition(posPx, 0.28);
		pointerMode = "idle";
		scheduleTimer(nextLeg, 900);
	}

	charEl.addEventListener("pointerdown", onPointerDown);
	document.addEventListener("pointermove", onPointerMove, { passive: true });
	document.addEventListener("pointerup", onPointerUp, { passive: true });
	document.addEventListener("pointercancel", onPointerCancel, {
		passive: true
	});

	charEl.addEventListener("click", function (e) {
		if (panelOpen) return;
		if (e.detail === 0) {
			e.preventDefault();
			openSequence();
		}
	});

	/* ---------------------------------------------------------------------
	   9. SINKRON SLIDE
	   --------------------------------------------------------------------- */
	var ALL_ANIM_CLASSES = [
		"y67-anim-look",
		"y67-anim-click-look",
		"y67-anim-lookup",
		"y67-anim-lookdown",
		"y67-anim-hop",
		"y67-anim-bounce",
		"y67-anim-glance",
		"y67-anim-quickturn",
		"y67-anim-brake",
		"y67-anim-confused",
		"y67-anim-stumble",
		"y67-anim-sleep",
		"y67-anim-lookback",
		"y67-anim-glasses",
		"y67-anim-land",
		"y67-anim-arrival-fall",
		"y67-anim-arrival-airborne",
		"y67-anim-freefall",
		"y67-anim-arrival-lying",
		"y67-anim-arrival-headlift",
		"y67-anim-arrival-bodilift",
		"y67-anim-arrival-stand",
		"y67-anim-arrival-dust",
		"y67-anim-sleepy",
		"y67-anim-sleep-deep",
		"y67-anim-wake",
		"y67-anim-clean-glasses"
	];

	function resyncForSlideChange() {
		if (pointerMode !== "idle") return;
		if (specialState) return;

		var oldPos = posPx;
		recomputeBounds();
		var neededClamp = Math.abs(posPx - oldPos) > 0.5;
		if (!neededClamp) return;

		clearScheduledTimer();
		if (behaviorTimer) {
			clearTimeout(behaviorTimer);
			behaviorTimer = null;
		}
		bodyEl.classList.remove.apply(bodyEl.classList, ALL_ANIM_CLASSES);

		if (posPx <= boundsMinPx + 0.5) dir = 1;
		if (posPx >= boundsMaxPx - 0.5) dir = -1;
		applyFacing(dir, 0.3);

		bodyEl.classList.add("is-walking");
		applyPosition(posPx, 0.6);
		scheduleTimer(function () {
			bodyEl.classList.remove("is-walking");
			scheduleTimer(nextLeg, 200);
		}, 650);
	}

	document.addEventListener("psk:slide-changed", function (e) {
		var target = e && e.detail ? e.detail.slide : null;
		if (typeof target !== "number" || target < 1 || target > TOTAL_SLIDES)
			return;
		y67Log("slide-changed:", target);
		currentSlide = target;
		applySizeForSlide(target);
		if (panelOpen) {
			closePanel();
		} else if (!prefersReducedMotion) {
			resyncForSlideChange();
		}
	});

	window.addEventListener("resize", function () {
		recomputeBounds();
	});

	/* ---------------------------------------------------------------------
	   9b. LOOK AT CURSOR
	   --------------------------------------------------------------------- */
	if (!prefersReducedMotion) {
		var lastCursorCheckAt = 0;
		var lastCursorTriggerAt = 0;
		var cursorLookBusy = false;
		var CURSOR_CHECK_INTERVAL_MS = 400;
		var CURSOR_COOLDOWN_MS = 9000;
		var CURSOR_PROXIMITY_PX = 130;

		var maybeLookAtCursor = function (clientX, clientY) {
			if (cursorLookBusy) return;
			if (isBusy()) return;
			if (bodyEl.className.indexOf("y67-anim-") !== -1) return;

			var now = Date.now();
			if (now - lastCursorCheckAt < CURSOR_CHECK_INTERVAL_MS) return;
			lastCursorCheckAt = now;
			if (now - lastCursorTriggerAt < CURSOR_COOLDOWN_MS) return;

			var rect = charEl.getBoundingClientRect();
			var cx = rect.left + rect.width / 2;
			var cy = rect.top + rect.height / 2;
			var dx = clientX - cx;
			var dy = clientY - cy;
			if (Math.sqrt(dx * dx + dy * dy) > CURSOR_PROXIMITY_PX) return;

			lastCursorTriggerAt = now;
			cursorLookBusy = true;
			clearScheduledTimer();
			if (behaviorTimer) clearTimeout(behaviorTimer);

			var faceTowards = dx < 0 ? -1 : 1;
			var wasWalking = bodyEl.classList.contains("is-walking");
			bodyEl.classList.remove("is-walking");
			applyFacing(faceTowards, 0.22);
			playAnim("y67-anim-look", 700, function () {
				cursorLookBusy = false;
				if (panelOpen) return;
				applyFacing(dir, 0.22);
				if (wasWalking) bodyEl.classList.add("is-walking");
				scheduleTimer(nextLeg, 220);
			});
		};

		document.addEventListener(
			"mousemove",
			function (e) {
				maybeLookAtCursor(e.clientX, e.clientY);
			},
			{ passive: true }
		);
		document.addEventListener(
			"touchstart",
			function (e) {
				if (!e.touches || !e.touches[0]) return;
				maybeLookAtCursor(e.touches[0].clientX, e.touches[0].clientY);
			},
			{ passive: true }
		);
	}

	/* ---------------------------------------------------------------------
	   ★ STEP 5.9 — BOOTSTRAP
	   --------------------------------------------------------------------- */
	function bootstrapCinematic() {
		if (bootstrapDone) return;
		bootstrapDone = true;

		y67Log("init, readyState =", document.readyState);

		currentSlide = detectCurrentSlide();
		applySizeForSlide(currentSlide);
		y67Log("current slide =", currentSlide);

		recomputeBounds();
		posPx = boundsMinPx + (boundsMaxPx - boundsMinPx) * 0.15;
		currentLiftY = 0;
		currentTilt = 0;
		applyPosition(posPx, 0);
		applyFacing(dir, 0);

		if (prefersReducedMotion) {
			y67Log("reduced-motion, cinematic skipped");
			ensureCharVisible();
			return;
		}

		if (!isArrivalEligible()) {
			y67Log("arrival not eligible at bootstrap, walking fallback");
			ensureCharVisible();
			scheduleTimer(nextLeg, 1600);
			return;
		}

		y67Log("arrival eligible, scheduling start");
		ensureCharVisible();
		charEl.style.visibility = "hidden";
		charEl.style.opacity = "0";

		scheduleTimer(function () {
			if (!isArrivalEligible()) {
				y67Log("arrival not eligible at fire-time, walking fallback");
				ensureCharVisible();
				scheduleTimer(nextLeg, 1600);
				return;
			}
			startArrival();
		}, CINEMATIC_START_DELAY_MS);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", bootstrapCinematic, {
			once: true
		});
	} else {
		bootstrapCinematic();
	}
})();
