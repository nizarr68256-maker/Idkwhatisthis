/* ==========================================================================
   SLIDE 8 — closing / final animation.

   FIX v4:
   - Tambah forceResetFlash() yang dipanggil di awal runTransition() dan
     setiap kali slide berubah ke slide != 8 — memastikan class
     s8-flash--active selalu dibersihkan kalau ada race/timing bug yang
     meninggalkan flash aktif dan menutupi slide lain.
   - Retry loop dot8.click() tetap ada (anti race dengan isTransitioning
     present.js).
   - Typewriter REPLAY setiap kali masuk Slide 8.
   ========================================================================== */

(function () {
	"use strict";

	var slide7 = document.getElementById("slide7Scene");
	var slide8 = document.getElementById("slide8Scene");
	var nextBtn = document.getElementById("s7NextBtn");
	var flashOverlay = document.getElementById("s8FlashOverlay");
	var endingText = document.getElementById("s8EndingText");

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	/* ---------------------------------------------------------------------
	   Helper: matikan flash overlay total. Dipanggil (a) sebelum mulai
	   transisi baru, (b) setiap keluar Slide 8. Aman dipanggil berkali-
	   kali.
	   --------------------------------------------------------------------- */
	function forceResetFlash() {
		if (!flashOverlay) return;
		flashOverlay.classList.remove("s8-flash--active");
		// Set inline opacity 0 untuk memastikan tidak ada sisa transisi
		// CSS yang membuatnya tetap terlihat — dihapus lagi nanti saat
		// transition benar-benar mulai (biar CSS transition tetap jalan).
		flashOverlay.style.opacity = "";
	}

	/* ---------------------------------------------------------------------
	   A. TRANSISI 7 -> 8
	   --------------------------------------------------------------------- */
	var isTransitioning = false;
	var flashOutTimer = null;

	function tryGotoSlide8() {
		var dot8 = document.querySelector('.psk-nav-dot[data-goto="8"]');
		if (dot8) {
			dot8.click();
			return;
		}
		if (typeof window.presentTransitionTo === "function") {
			window.presentTransitionTo(8);
		}
	}

	function runTransition() {
		if (isTransitioning) return;
		isTransitioning = true;

		// Pastikan tidak ada sisa flash dari sesi sebelumnya sebelum
		// memulai yang baru.
		forceResetFlash();

		if (slide7) slide7.classList.add("s7-is-ending");

		// Force reflow supaya browser register opacity: 0 -> baru
		// opacity: 1 memicu transition (bukan lompat).
		if (flashOverlay) {
			void flashOverlay.offsetWidth;
			flashOverlay.classList.add("s8-flash--active");
		}

		var attempts = 0;
		var MAX_ATTEMPTS = 25;
		function attemptSwap() {
			attempts++;
			if (slide8 && slide8.classList.contains("is-active")) return;
			tryGotoSlide8();
			if (attempts < MAX_ATTEMPTS) {
				setTimeout(attemptSwap, 120);
			}
		}
		setTimeout(attemptSwap, 550);

		if (flashOutTimer) clearTimeout(flashOutTimer);
		flashOutTimer = setTimeout(function () {
			flashOutTimer = null;
			forceResetFlash();
			if (slide7) slide7.classList.remove("s7-is-ending");
			isTransitioning = false;
		}, 1250);
	}

	if (nextBtn) {
		nextBtn.addEventListener(
			"click",
			function (e) {
				e.preventDefault();
				e.stopPropagation();
				runTransition();
			},
			true
		);
	}

	/* ---------------------------------------------------------------------
	   B. TYPEWRITER
	   --------------------------------------------------------------------- */
	var TYPE_MS = 90;
	var ERASE_MS = 55;
	var THANKS_HOLD_MS = 10000;
	var YUPI_HOLD_MS = 3000;
	var START_DELAY_MS = 400;

	var timers = [];
	var isRunning = false;

	function clearTimers() {
		for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
		timers = [];
	}

	function later(fn, delay) {
		var id = setTimeout(fn, delay);
		timers.push(id);
		return id;
	}

	function typeText(text, onDone) {
		if (!endingText) {
			onDone();
			return;
		}
		if (prefersReducedMotion) {
			endingText.textContent = text;
			onDone();
			return;
		}
		var i = 0;
		endingText.textContent = "";
		function step() {
			i += 1;
			endingText.textContent = text.slice(0, i);
			if (i < text.length) later(step, TYPE_MS);
			else onDone();
		}
		later(step, TYPE_MS);
	}

	function eraseText(onDone) {
		if (!endingText) {
			onDone();
			return;
		}
		if (prefersReducedMotion) {
			endingText.textContent = "";
			onDone();
			return;
		}
		function step() {
			var cur = endingText.textContent;
			if (!cur || cur.length === 0) {
				onDone();
				return;
			}
			endingText.textContent = cur.slice(0, -1);
			later(step, ERASE_MS);
		}
		later(step, ERASE_MS);
	}

	function runSequence() {
		if (isRunning) return;
		isRunning = true;
		typeText("Thanks", function () {
			later(function () {
				eraseText(function () {
					typeText("Yupi", function () {
						later(function () {
							eraseText(function () {
								typeText("Thanks", function () {
									isRunning = false;
								});
							});
						}, YUPI_HOLD_MS);
					});
				});
			}, THANKS_HOLD_MS);
		});
	}

	/* ---------------------------------------------------------------------
	   C. SINKRON DENGAN NAVIGASI SLIDE.
	   Setiap kali slide berubah ke != 8 -> paksa flash mati.
	   Setiap kali slide berubah ke == 8 -> mulai typewriter.
	   --------------------------------------------------------------------- */
	var lastSlide = null;

	document.addEventListener("psk:slide-changed", function (e) {
		var target = e && e.detail ? e.detail.slide : null;

		// KUNCI fix bug hitam di transisi 3->4: setiap keluar dari Slide 8
		// atau setiap ganti slide yang BUKAN 8, paksa flash overlay mati
		// total. Ini mencegah sisa class/flash dari transisi sebelumnya
		// "nyangkut" dan menutupi slide baru.
		if (target !== 8) {
			forceResetFlash();
		}

		if (target === 8) {
			clearTimers();
			isRunning = false;
			if (endingText) endingText.textContent = "";
			later(function () {
				runSequence();
			}, START_DELAY_MS);
		} else if (lastSlide === 8) {
			clearTimers();
			isRunning = false;
		}
		lastSlide = target;
	});

	/* ---------------------------------------------------------------------
	   D. FALLBACK restore lokal.
	   --------------------------------------------------------------------- */
	if (slide8 && slide8.classList.contains("is-active")) {
		later(function () {
			runSequence();
		}, START_DELAY_MS);
	}
})();

/* ==========================================================================
   ★ ADDITIVE PATCH — HAMBURGER "MENU JAWABAN" (Slide 8 saja)

   IIFE TERPISAH dari IIFE typewriter di atas. TIDAK ada variabel yang
   dibagi dengan kode di atas (semua nama beda), TIDAK memanggil
   clearTimers()/runSequence()/forceResetFlash(), TIDAK menyentuh
   #s8EndingText. Satu-satunya listener tambahan ke psk:slide-changed
   di sini hanya untuk menutup menu/panel saat meninggalkan Slide 8
   (state cleanup) — tidak memengaruhi timer typewriter sama sekali.
   ========================================================================== */
(function () {
	"use strict";

	var hamburgerBtn = document.getElementById("s8HamburgerBtn");
	var menuEl = document.getElementById("s8KnowledgeMenu");
	var overlayEl = document.getElementById("s8InfoOverlay");
	var panelTitleEl = document.getElementById("s8InfoPanelTitle");
	var panelMetaEl = document.getElementById("s8InfoPanelMeta");
	var panelDefEl = document.getElementById("s8InfoPanelDef");
	var panelExampleEl = document.getElementById("s8InfoPanelExample");
	var panelCoreEl = document.getElementById("s8InfoPanelCore");

	// Fail-safe: kalau markup belum ada/berubah, jangan lanjut sama sekali
	// (tidak menambah listener setengah jadi).
	if (!hamburgerBtn || !menuEl || !overlayEl) return;

	var TOPICS = {
		"cultural-imperialism": {
			name: "Cultural Imperialism",
			def:
				"Penyebaran budaya dari kelompok atau negara yang lebih " +
				"dominan sehingga dapat memengaruhi, mendominasi, atau " +
				"menekan budaya lokal.",
			example:
				"Film, musik, gaya hidup, atau produk budaya dari negara " +
				"dominan menjadi sangat populer dan dapat menggeser " +
				"perhatian terhadap budaya lokal.",
			core:
				"Budaya lokal tidak selalu hilang. Budaya dapat beradaptasi, " +
				"berubah, atau bercampur dengan budaya lain."
		},
		difusi: {
			name: "Difusi Budaya",
			def:
				"Proses penyebaran unsur budaya dari satu kelompok " +
				"masyarakat ke kelompok masyarakat lain.",
			example:
				"Makanan, musik, bahasa, pakaian, atau kebiasaan menyebar " +
				"dari satu daerah atau negara ke tempat lain.",
			core:
				"Budaya dapat menyebar melalui migrasi, perdagangan, media, " +
				"teknologi, dan interaksi sosial."
		},
		glocalization: {
			name: "Glocalization",
			def:
				"Proses ketika unsur global diadaptasi dengan kondisi, " +
				"kebutuhan, atau budaya lokal.",
			example:
				"Produk atau konsep global disesuaikan dengan selera " +
				"masyarakat setempat.",
			core:
				"Global dan lokal tidak selalu bertentangan; keduanya dapat " +
				"menghasilkan bentuk baru."
		},
		hibridasi: {
			name: "Hibridasi Budaya",
			def:
				"Proses bercampurnya unsur budaya yang berbeda sehingga " +
				"menghasilkan bentuk budaya baru.",
			example:
				"Musik, makanan, fashion, atau seni yang menggabungkan " +
				"unsur dari beberapa budaya.",
			core:
				"Pertemuan budaya dapat menghasilkan budaya baru yang " +
				"tidak sepenuhnya berasal dari satu budaya saja."
		},
		mcdonaldization: {
			name: "McDonaldization",
			tokoh: "George Ritzer",
			def:
				"Konsep yang menjelaskan bagaimana prinsip efisiensi, " +
				"keterukuran, prediktabilitas, dan kontrol semakin " +
				"memengaruhi berbagai bidang kehidupan masyarakat.",
			example:
				"Layanan yang dibuat sangat standar, cepat, terukur, dan " +
				"memiliki prosedur yang sama di banyak tempat.",
			core:
				"Prinsip yang awalnya terlihat dalam restoran cepat saji " +
				"dapat meluas ke berbagai institusi dan aktivitas sosial."
		},
		"network-society": {
			name: "Network Society",
			tokoh: "Manuel Castells",
			def:
				"Masyarakat yang semakin terorganisasi melalui jaringan " +
				"informasi dan komunikasi digital.",
			example:
				"Media sosial, komunitas online, kerja jarak jauh, dan " +
				"jaringan ekonomi digital.",
			core:
				"Jaringan digital memengaruhi cara manusia berkomunikasi, " +
				"bekerja, membangun hubungan, dan menjalankan aktivitas " +
				"sosial."
		},
		inklusif: {
			name: "Inklusif",
			def:
				"Upaya memastikan setiap orang memiliki kesempatan untuk " +
				"berpartisipasi dan memperoleh akses yang setara tanpa " +
				"diskriminasi.",
			example:
				"Penyediaan akses teknologi dan informasi bagi masyarakat " +
				"yang memiliki keterbatasan ekonomi, lokasi, pendidikan, " +
				"atau kemampuan tertentu.",
			core:
				"Globalisasi tidak hanya tentang semakin terhubungnya " +
				"dunia, tetapi juga tentang memastikan keterhubungan " +
				"tersebut dapat dirasakan secara lebih adil."
		}
	};

	// Satu state boolean untuk tampilan hamburger (☰ vs X), terpisah dari
	// topic mana yang sedang ditampilkan.
	var isOpen = false;

	function setMenuOpen(open) {
		menuEl.classList.toggle("s8-menu--open", open);
		menuEl.setAttribute("aria-hidden", open ? "false" : "true");
	}

	function setOverlayOpen(open) {
		overlayEl.classList.toggle("s8-info-overlay--open", open);
		overlayEl.setAttribute("aria-hidden", open ? "false" : "true");
	}

	function setHamburgerActive(active) {
		hamburgerBtn.classList.toggle("s8-hamburger--active", active);
		hamburgerBtn.setAttribute("aria-expanded", active ? "true" : "false");
	}

	function closeAll() {
		isOpen = false;
		setMenuOpen(false);
		setOverlayOpen(false);
		setHamburgerActive(false);
	}

	function openMenu() {
		isOpen = true;
		setOverlayOpen(false);
		setMenuOpen(true);
		setHamburgerActive(true);
	}

	function showTopic(key) {
		var topic = TOPICS[key];
		if (!topic) return;

		if (panelTitleEl) panelTitleEl.textContent = topic.name;
		if (panelMetaEl) {
			if (topic.tokoh) {
				panelMetaEl.textContent = "Tokoh: " + topic.tokoh;
				panelMetaEl.style.display = "";
			} else {
				panelMetaEl.textContent = "";
				panelMetaEl.style.display = "none";
			}
		}
		if (panelDefEl) panelDefEl.textContent = topic.def;
		if (panelExampleEl) panelExampleEl.textContent = topic.example;
		if (panelCoreEl) panelCoreEl.textContent = topic.core;

		isOpen = true;
		setMenuOpen(false);
		setOverlayOpen(true);
		setHamburgerActive(true);
	}

	// Hamburger = OPEN MENU dan CLOSE MENU/CLOSE PANEL sekaligus (tidak
	// ada tombol X terpisah, sesuai permintaan).
	hamburgerBtn.addEventListener("click", function (e) {
		e.preventDefault();
		if (isOpen) {
			closeAll();
		} else {
			openMenu();
		}
	});

	var menuItems = menuEl.querySelectorAll(".s8-menu__item");
	for (var i = 0; i < menuItems.length; i++) {
		menuItems[i].addEventListener("click", function (e) {
			e.preventDefault();
			showTopic(this.getAttribute("data-topic"));
		});
	}

	// Cleanup saat meninggalkan Slide 8: mencegah menu/panel "nyangkut"
	// terbuka kalau user balik lagi ke Slide 8 nanti. Listener ini HANYA
	// menyentuh isOpen/menuEl/overlayEl/hamburgerBtn di atas — tidak
	// menyentuh timers/isRunning/lastSlide milik typewriter di IIFE lain.
	document.addEventListener("psk:slide-changed", function (e) {
		var target = e && e.detail ? e.detail.slide : null;
		if (target !== 8 && isOpen) {
			closeAll();
		}
	});
})();
