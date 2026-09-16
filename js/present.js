/* ==========================================================================
   PRESENT.HTML — logic presentasi saja.
   TIDAK ada import Three.js, TIDAK ada renderer/camera/canvas/RAF baru,
   TIDAK ada dependency ke board.js/main.js/detective board. Halaman ini
   berdiri sendiri: begitu present.html dibuka, Slide 1 langsung tampil
   (tanpa menunggu event apa pun dari board), lalu navigasi antar slide
   berjalan normal di dalam halaman ini.

   Tambahan: transisi khusus Slide 2 -> Slide 3 (movie frame terdorong
   keluar + viewport turun). Tidak memengaruhi transisi lainnya.

   ★ STEP 3: indikator baca (satu bulat fixed di atas-tengah) mengikuti
   event psk:slide-changed yang sudah ada — tidak menambah sistem
   navigasi/state baru.
   ========================================================================== */

(function () {
	"use strict";

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	/* ---------------------------------------------------------------------
	   1. FADE-IN HALAMAN (pasangan dari fade-out di board.js/index.html)
	   --------------------------------------------------------------------- */
	var fadeOverlay = document.getElementById("presentFadeOverlay");

	function fadeInPresent() {
		if (!fadeOverlay) return;
		if (prefersReducedMotion) {
			fadeOverlay.classList.add("is-hidden");
			return;
		}
		requestAnimationFrame(function () {
			requestAnimationFrame(function () {
				fadeOverlay.classList.add("is-hidden");
			});
		});
	}

	/* ---------------------------------------------------------------------
	   2. SISTEM TRANSISI SLIDE — "paper sweep"
	   Satu layer paper (lihat #paperTransition di present.html) menyapu
	   layar. Slide lama disembunyikan & slide baru ditampilkan TEPAT saat
	   paper menutupi layar penuh (di titik tengah animasi), sehingga
	   pertukaran display terjadi tanpa terlihat — tidak ada blank frame,
	   tidak butuh crossfade opacity pada slide itu sendiri.

	   Khusus transisi Slide 2 → Slide 3, kita TIDAK menggunakan paper
	   sweep. Sebagai gantinya, Slide 2 (movie frame) didorong keluar ke
	   kanan atas dengan sedikit rotasi/asimetri, lalu Slide 3 muncul dari
	   bawah. Detailnya ada di fungsi transition2To3().
	   --------------------------------------------------------------------- */
	var currentSlide = 1;
	var isTransitioning = false;
	var TOTAL_SLIDES = 8;

	/* ---------------------------------------------------------------------
	   2b. PERSISTENCE SLIDE TERAKHIR (untuk tombol refresh)
	   Key khusus project, localStorage sederhana, dibungkus try/catch
	   supaya kalau localStorage tidak tersedia/gagal (mis. private mode,
	   storage penuh), presentasi tetap berjalan normal (fallback ke
	   Slide 1) tanpa pernah membuat halaman error.
	   --------------------------------------------------------------------- */
	var LAST_SLIDE_KEY = "presentation_last_slide";

	function readSavedSlide() {
		var raw = null;
		try {
			raw = window.localStorage.getItem(LAST_SLIDE_KEY);
		} catch (err) {
			return null;
		}
		if (raw === null) return null;

		var n = parseInt(raw, 10);
		if (
			!isFinite(n) ||
			String(n) !== String(raw).trim() ||
			n < 1 ||
			n > TOTAL_SLIDES
		) {
			// Nilai invalid (0, -1, 999, NaN, string aneh, dll) — bersihkan
			// supaya reload berikutnya tidak mencoba membaca sampah yang
			// sama lagi, lalu fallback ke Slide 1.
			try {
				window.localStorage.removeItem(LAST_SLIDE_KEY);
			} catch (err2) {
				/* abaikan */
			}
			return null;
		}
		return n;
	}

	function saveCurrentSlide(n) {
		try {
			window.localStorage.setItem(LAST_SLIDE_KEY, String(n));
		} catch (err) {
			/* localStorage tidak tersedia/gagal — abaikan, jangan crash */
		}
	}

	// Harus sinkron dengan durasi @keyframes paper-sweep di css/present.css.
	var PAPER_DURATION = 600; // ms, total durasi sweep (masuk -> menutup -> keluar)
	var PAPER_SWAP_POINT = 0.5; // fraksi durasi saat paper menutupi layar penuh

	var paperEl = document.getElementById("paperTransition");
	var paperSweepFallbackTimer = null;

	function getSlide(n) {
		return document.getElementById("slide" + n + "Scene");
	}

	function showSlide(el) {
		if (!el) return;
		el.style.display = "flex";
		el.classList.remove("is-leaving");
		el.classList.add("is-active");
	}

	function hideSlide(el) {
		if (!el) return;
		el.classList.remove("is-active", "is-leaving");
		el.style.display = "none";
	}

	function dispatchSlideChanged(target) {
		document.dispatchEvent(
			new CustomEvent("psk:slide-changed", {
				detail: { slide: target }
			})
		);
	}

	function finishTransition(target) {
		currentSlide = target;
		isTransitioning = false;
		dispatchSlideChanged(target);
	}

	/* ---------------------------------------------------------------------
	   2c. GLOBAL 7-DOT NAVIGATION — sinkronisasi state aktif saja.
	   Klik dot memakai [data-goto] generik yang sudah dikaitkan di init()
	   (lihat bawah); di sini HANYA menandai dot mana yang aktif, mengikuti
	   slide saat ini (bukan hardcoded ke satu slide). Dipanggil saat init()
	   dan setiap kali event "psk:slide-changed" terjadi, dari sumber
	   manapun perubahan slide itu berasal (transitionTo, restore
	   localStorage, dsb) — satu titik sinkronisasi, tidak ada state kedua.
	   --------------------------------------------------------------------- */
	function syncGlobalNavActive(target) {
		document.querySelectorAll(".psk-nav-dot").forEach(function (dot) {
			var n = parseInt(dot.getAttribute("data-goto"), 10);
			var isActive = n === target;
			dot.classList.toggle("psk-nav-dot--active", isActive);
			if (isActive) {
				dot.setAttribute("aria-current", "true");
			} else {
				dot.removeAttribute("aria-current");
			}
		});
	}

	/* ---------------------------------------------------------------------
	   ★ STEP 3 — INDIKATOR BACA (satu bulat fixed di atas-tengah).
	   Mengikuti event psk:slide-changed yang sudah ada — sumber yang SAMA
	   dengan syncGlobalNavActive. Tidak menambah sistem navigasi/state
	   baru; hanya menerjemahkan nomor slide ke modifier class warna.
	   --------------------------------------------------------------------- */
	var READER_COLORS = {
		1: "blue",
		2: "red",
		3: "green",
		4: "red",
		5: "green",
		6: "yellow",
		7: "yellow",
		8: "red"
	};

	function syncReaderIndicator(target) {
		var el = document.getElementById("presentReaderIndicator");
		if (!el) return;
		var color = READER_COLORS[target] || "red";
		el.classList.remove(
			"present-reader-indicator--blue",
			"present-reader-indicator--red",
			"present-reader-indicator--green",
			"present-reader-indicator--yellow"
		);
		el.classList.add("present-reader-indicator--" + color);
	}

	/*
		ROOT CAUSE (ditemukan saat audit) — js/transition-3-4.js menangani
		transisi Slide 3 -> 4 (cloud transition) SENDIRI: ia menukar class
		is-active dan men-dispatch "psk:slide-changed" TANPA pernah
		memanggil finishTransition() di atas. Akibatnya variabel
		`currentSlide` di closure ini tidak pernah ikut menjadi 4 — tetap
		nyangkut di 3. Begitu user lanjut dari Slide 4 ke Slide 5,
		transitionTo(5) mengira slide yang sedang aktif adalah Slide 3
		(bukan 4), lalu HANYA menyembunyikan Slide 3 (yang sebenarnya
		sudah tersembunyi) sementara Slide 4 tidak pernah disembunyikan
		— Slide 4 & Slide 5 sama-sama tampil bertumpuk. Ini salah satu
		penyebab nyata gambar "tiba-tiba besar"/terlihat belum selesai
		diinisialisasi yang dilaporkan.

		Fix minimal: dengarkan event yang SUDAH ada ini sebagai satu
		titik sinkronisasi tunggal, dari sumber manapun perubahan slide
		itu berasal. Sekaligus dipakai untuk menyimpan slide aktif ke
		localStorage (fitur refresh). Tidak menambah arsitektur baru.

		★ STEP 3: listener yang sama juga menyinkronkan indikator baca
		(satu pemanggilan tambahan, tanpa sistem/event baru).
	*/
	document.addEventListener("psk:slide-changed", function (e) {
		var target = e && e.detail ? e.detail.slide : null;
		if (typeof target !== "number" || target < 1 || target > TOTAL_SLIDES) {
			return;
		}
		currentSlide = target;
		saveCurrentSlide(target);
		syncGlobalNavActive(target);
		syncReaderIndicator(target);
	});

	/* ---------------------------------------------------------------------
	   SHARED FLAG dengan cloud transition (3→4 dan 4→5).
	   Cloud transition TIDAK berjalan lewat transitionTo() di file ini —
	   ia mengelola overlay-nya sendiri. Tanpa flag ini, klik navigasi
	   (dot [data-goto] / NEXT slide lain) saat cloud masih menutup layar
	   akan memicu paper-sweep paralel: paper-sweep menyembunyikan slide
	   aktif dan menampilkan slide tujuan, lalu swapSlidesBehindClouds()
	   milik cloud menghapus is-active dari SEMUA .generic-slide-scene
	   dan menambahkannya ke slide4 (yang display:none) → tidak ada slide
	   visible → layar hitam. Cukup satu boolean global, tanpa arsitektur baru.
	   --------------------------------------------------------------------- */
	if (typeof window.__cloudTransitionBusy === "undefined") {
		window.__cloudTransitionBusy = false;
	}

	/* ---------------------------------------------------------------------
	   3. TRANSISI KHUSUS SLIDE 2 -> SLIDE 3
	   Movie frame (Slide 2) keluar asimetris ke kanan atas,
	   lalu Slide 3 direveal dari bawah.
	   --------------------------------------------------------------------- */
	function transition2To3() {
		var slide2 = getSlide(2);
		var slide3 = getSlide(3);
		if (!slide2 || !slide3) {
			finishTransition(3);
			return;
		}

		// Reduced motion: langsung tukar slide tanpa animasi
		if (prefersReducedMotion) {
			hideSlide(slide2);
			showSlide(slide3);
			finishTransition(3);
			return;
		}

		// Set z-index agar Slide 2 berada di depan Slide 3 selama overlap
		slide2.style.zIndex = "80";
		slide3.style.zIndex = "75";
		// Pastikan Slide 3 tampil (display flex) sebelum animasi masuk
		slide3.style.display = "flex";

		// Terapkan class animasi
		slide2.classList.add("s2-exit");
		slide3.classList.add("s3-enter");

		var duration = 700; // harus sinkron dengan durasi animasi CSS
		var cleanup = function () {
			// Hapus class transisi
			slide2.classList.remove("s2-exit");
			slide3.classList.remove("s3-enter");
			// Reset z-index dan inline style yang kita set
			slide2.style.zIndex = "";
			slide3.style.zIndex = "";
			slide2.style.transform = "";
			slide3.style.transform = "";
			slide2.style.opacity = "";
			slide3.style.opacity = "";
			slide2.style.transition = "";
			slide3.style.transition = "";
			// Sembunyikan Slide 2 dan jadikan Slide 3 aktif
			hideSlide(slide2);
			showSlide(slide3);
			// Selesaikan transisi
			finishTransition(3);
		};

		// Fallback timer: pastikan cleanup selalu berjalan
		var fallbackTimer = setTimeout(cleanup, duration + 50);

		// Gunakan animationend untuk cleanup lebih cepat (jika didukung)
		var onAnimationEnd = function (e) {
			if (e.target === slide2 || e.target === slide3) {
				clearTimeout(fallbackTimer);
				slide2.removeEventListener("animationend", onAnimationEnd);
				slide3.removeEventListener("animationend", onAnimationEnd);
				cleanup();
			}
		};
		slide2.addEventListener("animationend", onAnimationEnd);
		slide3.addEventListener("animationend", onAnimationEnd);
	}

	/* ---------------------------------------------------------------------
	   4. FUNGSI TRANSISI UTAMA
	   Paper sweep untuk semua transisi kecuali 2→3.
	   --------------------------------------------------------------------- */
	function transitionTo(target) {
		if (
			isTransitioning ||
			target === currentSlide ||
			target < 1 ||
			target > TOTAL_SLIDES
		) {
			return;
		}

		/* BARU: cloud transition (3→4 / 4→5) sedang berjalan → jangan
		   jalankan paper sweep. Biarkan cloud transition menyelesaikan
		   dirinya sendiri lalu mengirim psk:slide-changed (yang sudah
		   disinkronkan di listener psk:slide-changed di atas). */
		if (window.__cloudTransitionBusy) {
			return;
		}

		// Transisi khusus Slide 2 -> Slide 3
		if (currentSlide === 2 && target === 3) {
			isTransitioning = true;
			transition2To3();
			return;
		}

		isTransitioning = true;

		var slideOut = getSlide(currentSlide);
		var slideIn = getSlide(target);

		function swapSlides() {
			hideSlide(slideOut);
			showSlide(slideIn);
		}

		// Reduced motion / paper tidak ditemukan: tukar langsung tanpa
		// sweep, tidak ada animation loop atau timer tambahan.
		if (prefersReducedMotion || !paperEl) {
			swapSlides();
			finishTransition(target);
			return;
		}

		// Pastikan tidak ada sisa animasi/listener dari transisi
		// sebelumnya yang masih menempel (mencegah duplicate listener).
		if (paperSweepFallbackTimer) {
			clearTimeout(paperSweepFallbackTimer);
			paperSweepFallbackTimer = null;
		}
		paperEl.classList.remove("is-sweeping");

		// Restart animasi dari awal secara aman (force reflow) walau
		// transisi sebelumnya baru saja selesai.
		// eslint-disable-next-line no-unused-expressions
		void paperEl.offsetWidth;
		paperEl.classList.add("is-sweeping");

		var swapTimer = setTimeout(
			swapSlides,
			Math.round(PAPER_DURATION * PAPER_SWAP_POINT)
		);

		function onSweepEnd(e) {
			if (e && e.target !== paperEl) return;
			paperEl.removeEventListener("animationend", onSweepEnd);
			if (paperSweepFallbackTimer) {
				clearTimeout(paperSweepFallbackTimer);
				paperSweepFallbackTimer = null;
			}
			paperEl.classList.remove("is-sweeping");
			finishTransition(target);
		}

		paperEl.addEventListener("animationend", onSweepEnd);
		// Fallback: kalau animationend tidak terpicu untuk alasan apa pun,
		// tetap bersihkan state agar navigasi tidak pernah terkunci.
		paperSweepFallbackTimer = setTimeout(function () {
			paperEl.removeEventListener("animationend", onSweepEnd);
			paperEl.classList.remove("is-sweeping");
			finishTransition(target);
		}, PAPER_DURATION + 150);
	}

	// Ekspos transitionTo agar bisa dipanggil dari slide5.js
	window.presentTransitionTo = transitionTo;

	function bindRefreshButton() {
		var btn = document.getElementById("presentRefreshBtn");
		if (!btn) return;
		// Satu handler saja (init() hanya dipanggil sekali saat script
		// dimuat), tidak ada kemungkinan double-listener.
		btn.addEventListener("click", function (e) {
			e.preventDefault();
			// 1. simpan slide aktif SEBELUM reload — bukan sekadar
			//    location.reload() polos.
			saveCurrentSlide(currentSlide);
			// 2. jangan jalankan NEXT/BACK, jangan ubah currentSlide,
			//    jangan memicu transition apa pun di sini.
			window.location.reload();
		});
	}

	function init() {
		var savedSlide = readSavedSlide();

		if (!savedSlide || savedSlide === 1) {
			// Perilaku asli, TIDAK diubah: fade-in Slide 1 lewat double rAF
			// (memberi waktu browser mem-paint display:flex dulu sebelum
			// class is-active memicu transisi opacity CSS).
			var slide1 = getSlide(1);
			if (slide1) {
				slide1.style.display = "flex";
				requestAnimationFrame(function () {
					requestAnimationFrame(function () {
						slide1.classList.add("is-active");
					});
				});
			}
			currentSlide = 1;
		} else {
			// RESTORE LANGSUNG ke slide tersimpan — tanpa transition,
			// tanpa singgah di Slide 1 dulu, tanpa memanggil NEXT
			// berkali-kali. Slide 1 dibiarkan pada state default (display
			// none via CSS), tidak pernah dimunculkan sama sekali.
			var restored = getSlide(savedSlide);
			if (restored) {
				restored.style.display = "flex";
				restored.classList.add("is-active");
				currentSlide = savedSlide;
				// Sinkronkan lapisan state internal slide (shot/kertas/
				// peluang-tantangan) ke kondisi awal slide tsb — pola yang
				// sama dipakai slide2-film.js/slide3.js/slide4.js sendiri.
				dispatchSlideChanged(savedSlide);
			} else {
				// Elemen tidak ditemukan (mis. markup berubah) — fallback
				// aman ke Slide 1, jangan biarkan presentasi kosong/error.
				var fallback = getSlide(1);
				if (fallback) {
					fallback.style.display = "flex";
					fallback.classList.add("is-active");
				}
				currentSlide = 1;
			}
		}

		// Kaitkan tombol NEXT generik (data-goto) — mencakup juga dot
		// #pskNav (lihat present.html), tidak ada binding kedua untuk itu.
		document.querySelectorAll("[data-goto]").forEach(function (btn) {
			btn.addEventListener("click", function (e) {
				e.preventDefault();
				var target = parseInt(btn.getAttribute("data-goto"), 10);
				if (!isNaN(target)) {
					transitionTo(target);
				}
			});
		});

		// Tandai dot navigasi global sesuai slide awal (baru dibuka di
		// Slide 1, atau hasil restore localStorage) — bukan di-hardcode.
		syncGlobalNavActive(currentSlide);

		// ★ STEP 3: set warna indikator baca sesuai slide awal.
		// Satu baris — tidak ada state/sistem tambahan.
		syncReaderIndicator(currentSlide);

		// Kaitkan tombol NEXT khusus slide1
		var btn1 = document.getElementById("slide1Next");
		if (btn1) {
			btn1.addEventListener("click", function (e) {
				e.preventDefault();
				transitionTo(2);
			});
		}

		bindRefreshButton();

		fadeInPresent();
	}

	init();
})();
