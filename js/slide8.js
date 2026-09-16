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

	/* ★ PATCH: hamburger "Menu Jawaban" (FAQ lama khusus Slide 8) SUDAH
	   DIHAPUS dari sini. Fungsi tanya-jawab sekarang sepenuhnya
	   dipindahkan ke menu global "Hmm?" milik Yusmentoro67 (lihat
	   js/yusmentoro67.js), supaya tidak ada dua sistem FAQ berjalan
	   bersamaan. Sequence typewriter Thanks/Yupi di atas TIDAK berubah. */
})();
