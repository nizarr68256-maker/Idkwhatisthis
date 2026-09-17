/* ==========================================================================
   PRESENT.HTML — logic presentasi saja.
   TIDAK ada import Three.js, TIDAK ada renderer/camera/canvas/RAF baru,
   TIDAK ada dependency ke board.js/main.js/detective board. Halaman ini
   berdiri sendiri: begitu present.html dibuka, Slide 1 langsung tampil
   (tanpa menunggu event apa pun dari board), lalu navigasi antar slide
   berjalan normal di dalam halaman ini.

   Tambahan transisi khusus:
   - Slide 2 → Slide 3: camera drop + subtle zoom + atmospheric blend.
   - Slide 5 → Slide 6: "video app opening" overlay (play mark + bg netral).

   ★ STEP 3: indikator baca (satu bulat fixed di atas-tengah) mengikuti
   event psk:slide-changed yang sudah ada — tidak menambah sistem
   navigasi/state baru.

   ★ PATCH: background clapperboard khusus transisi Slide 1 → Slide 2.
   Hanya menambah/turunkan satu modifier class (.is-slide1-to-slide2) di
   elemen paper transition yang SUDAH ADA. Keyframe, durasi, easing, arah
   TIDAK diubah.

   ★ PATCH: atmospheric layer khusus transisi Slide 2 → Slide 3. Hanya
   menambah/turunkan modifier class (.is-s2-s3-atmo) di #paperTransition
   selama animasi 2 → 3.

   ★ PATCH: overlay "video app opening" khusus transisi Slide 5 → Slide 6.
   Hanya menambah/turunkan class .is-active di #s5s6OpenOverlay selama
   animasi 5 → 6. Slide 5, Slide 6, dan transisi lain tidak tersentuh.
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
	   bawah + subtle zoom, lalu Slide 3 muncul dari bawah. Detailnya ada
	   di fungsi transition2To3().

	   Khusus transisi Slide 5 → Slide 6, kita juga TIDAK menggunakan paper
	   sweep. Sebagai gantinya, overlay "video app opening" (#s5s6OpenOverlay)
	   muncul di atas Slide 5, play mark di tengah beranimasi scale + fade,
	   lalu Slide 6 di-swap di belakang overlay dan overlay memudar keluar.
	   Detailnya ada di fungsi transition5To6().
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
	   3. TRANSISI KHUSUS SLIDE 2 -> SLIDE 3 — CINEMATIC CAMERA DROP
	   --------------------------------------------------------------------------
	   Konsep:
	     - Kamera terasa "turun". Film card bergerak ke BAWAH sambil sedikit
	       membesar (subtle zoom) lalu melewati viewport bagian bawah.
	     - Slide 3 (meja) masuk dari bawah dengan zoom-out halus, menyambung
	       gerak "kamera turun" tadi, tapi mulai reveal setelah film card
	       setengah keluar (lihat @keyframes s3-enter-fade di CSS).
	     - Opacity film tetap 1 sampai 65% progress supaya tidak "teleport".
	     - Motion dipecah jadi dua animasi paralel per elemen (transform +
	       opacity) supaya tidak ada segmentasi easing yang bikin gerakan
	       patah-patah.

	   Tidak ada keyframe baru di luar yang didefinisikan di css/present.css.
	   Tidak menyentuh paper sweep / clapperboard 1 → 2 / transisi lainnya.

	   ★ PATCH: atmospheric layer pada #paperTransition (.is-s2-s3-atmo)
	   supaya handoff film → meja tidak terasa seperti hard cut.
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

		// ★ PATCH: aktifkan atmospheric layer pada #paperTransition selama
		// transisi 2 → 3 saja. Class ini di-remove di cleanup.
		if (paperEl) paperEl.classList.add("is-s2-s3-atmo");

		var duration = 900; // harus sinkron dengan durasi animasi CSS
		var cleanup = function () {
			// Hapus class transisi
			slide2.classList.remove("s2-exit");
			slide3.classList.remove("s3-enter");

			// ★ PATCH: matikan atmospheric layer.
			if (paperEl) paperEl.classList.remove("is-s2-s3-atmo");

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
	   3b. TRANSISI KHUSUS SLIDE 5 -> SLIDE 6 — "VIDEO APP OPENING"
	   --------------------------------------------------------------------------
	   Konsep: overlay netral (#s5s6OpenOverlay) menutupi Slide 5, play mark
	   muncul di tengah dengan overshoot ringan, lalu overlay memudar dan
	   Slide 6 yang sudah diswap di belakang overlay muncul sebagai destination.

	   Timing (tidak sinkron dengan durasi CSS @keyframes s5-s6-bg/s5-s6-mark
	   di css/present.css — kalau durasi CSS diubah, samakan angka di bawah):
	     - 0ms      : is-active di-add, animasi CSS mulai
	     - ~435ms   : overlay bg sudah opaque penuh (CSS 30% × 1450ms)
	     - 520ms    : swap slide di belakang overlay (tidak terlihat)
	     - 900ms    : CSS mulai fade out bg + scale out mark
	     - 1450ms   : animasi CSS selesai (bg sudah full transparan)
	     - 1480ms   : is-active di-remove, finishTransition(6)

	   Tidak ada RAF, tidak ada interval. Hanya CSS @keyframes + setTimeout
	   cleanup — sama polanya dengan transition2To3().
	   --------------------------------------------------------------------- */
	function transition5To6() {
		var slide5 = getSlide(5);
		var slide6 = getSlide(6);
		var overlay = document.getElementById("s5s6OpenOverlay");

		// Fallback: kalau elemen tidak ada, langsung swap tanpa animasi.
		if (!slide5 || !slide6 || !overlay) {
			if (slide5) hideSlide(slide5);
			if (slide6) showSlide(slide6);
			finishTransition(6);
			return;
		}

		// Reduced motion: langsung tukar slide, tanpa overlay.
		if (prefersReducedMotion) {
			hideSlide(slide5);
			showSlide(slide6);
			finishTransition(6);
			return;
		}

		// Aktifkan overlay. Animasi CSS mulai (bg + mark).
		overlay.classList.add("is-active");

		// Swap slide di belakang overlay — overlay sudah opaque pada ~30%
		// (≈435ms), jadi swap di 520ms tidak akan terlihat.
		var swapTimer = setTimeout(function () {
			hideSlide(slide5);
			showSlide(slide6);
		}, 520);

		// Cleanup: matikan overlay, bereskan state. Total animasi CSS 1450ms.
		var endTimer = setTimeout(function () {
			overlay.classList.remove("is-active");
			clearTimeout(swapTimer);
			clearTimeout(endTimer);
			finishTransition(6);
		}, 1480);
	}

	/* ---------------------------------------------------------------------
	   4. FUNGSI TRANSISI UTAMA
	   Paper sweep untuk semua transisi kecuali 2→3 dan 5→6.

	   ★ PATCH: saat currentSlide===1 && target===2, kita tambahkan
	   modifier class .is-slide1-to-slide2 pada paperEl. CSS meng-override
	   background-image-nya jadi clapperboard. Semua transisi lain tidak
	   pernah menerima class ini, jadi tetap paper default. Keyframe,
	   durasi, easing, arah tidak berubah sama sekali.
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

		/* Cloud transition (3→4 / 4→5) sedang berjalan → jangan
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

		// ★ PATCH: transisi khusus Slide 5 -> Slide 6 (video app opening).
		if (currentSlide === 5 && target === 6) {
			isTransitioning = true;
			transition5To6();
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

		// ★ PATCH: tandai transisi Slide 1 → Slide 2 agar CSS memakai
		// background clapperboard. Dihapus lagi di dua titik cleanup
		// (onSweepEnd & fallback timer) di bawah.
		if (currentSlide === 1 && target === 2) {
			paperEl.classList.add("is-slide1-to-slide2");
		} else {
			paperEl.classList.remove("is-slide1-to-slide2");
		}

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
			// ★ PATCH: bersihkan modifier background Slide 1 → Slide 2.
			paperEl.classList.remove("is-slide1-to-slide2");
			finishTransition(target);
		}

		paperEl.addEventListener("animationend", onSweepEnd);
		// Fallback: kalau animationend tidak terpicu untuk alasan apa pun,
		// tetap bersihkan state agar navigasi tidak pernah terkunci.
		paperSweepFallbackTimer = setTimeout(function () {
			paperEl.removeEventListener("animationend", onSweepEnd);
			paperEl.classList.remove("is-sweeping");
			// ★ PATCH: bersihkan modifier background Slide 1 → Slide 2.
			paperEl.classList.remove("is-slide1-to-slide2");
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
