/* ==========================================================================
   SLIDE 2 — FILMSTRIP (5 SHOT) — logic navigasi shot SAJA.

   File ini TIDAK membuat sistem navigasi slide baru: perpindahan
   Slide 2 -> Slide 3 tetap lewat #s2NextSlide, yang memakai atribut
   [data-goto="3"] yang sudah otomatis dikaitkan oleh init() di
   js/present.js (lihat querySelectorAll("[data-goto]")). Di sini kita
   hanya mengatur KAPAN tombol itu boleh terlihat/diklik.

   State shot (currentShot / isShotTransitioning) sengaja terpisah dari
   state slide (currentSlide / isTransitioning) di present.js — dua
   lapis independen, bukan duplikat.
   ========================================================================== */

(function () {
	"use strict";

	var section = document.getElementById("slide2Scene");
	if (!section) return;

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	var track = document.getElementById("s2Track");
	var shots = section.querySelectorAll(".s2-shot");
	var TOTAL_SHOTS = shots.length || 5;

	var counterEl = document.getElementById("s2Counter");
	var nextShotBtn = document.getElementById("s2NextShot");
	var nextSlideBtn = document.getElementById("s2NextSlide");

	// Harus sinkron dengan durasi transition di css/slide2-film.css (.s2-track).
	var SHOT_DURATION = 600; // ms

	var currentShot = 1;
	var isShotTransitioning = false;
	var shotFallbackTimer = null;

	function pad2(n) {
		return n < 10 ? "0" + n : "" + n;
	}

	function updateCounter() {
		if (!counterEl) return;
		counterEl.textContent = pad2(currentShot) + " / " + pad2(TOTAL_SHOTS);
	}

	// Dipanggil setelah animasi (atau langsung, jika reduced motion) —
	// supaya tombol Next Slide baru bisa diklik SETELAH benar-benar
	// berhenti di Shot terakhir, bukan saat masih bergeser ke sana.
	function updateControlsSettled() {
		var atLast = currentShot === TOTAL_SHOTS;
		if (nextShotBtn) nextShotBtn.classList.toggle("is-hidden", atLast);
		if (nextSlideBtn) nextSlideBtn.classList.toggle("is-visible", atLast);
	}

	function setTrackPosition(n, animate) {
		if (!track) return;
		if (!animate) {
			// Pindah instan tanpa transisi (init/reduced-motion/reset).
			var prevTransition = track.style.transition;
			track.style.transition = "none";
			track.style.transform =
				"translateX(-" + (n - 1) * (100 / TOTAL_SHOTS) + "%)";
			// Paksa reflow lalu kembalikan transition supaya perpindahan
			// shot BERIKUTNYA tetap animasi seperti biasa.
			void track.offsetWidth;
			track.style.transition = prevTransition || "";
		} else {
			track.style.transform =
				"translateX(-" + (n - 1) * (100 / TOTAL_SHOTS) + "%)";
		}
	}

	function goToShot(n) {
		if (
			isShotTransitioning ||
			n === currentShot ||
			n < 1 ||
			n > TOTAL_SHOTS
		) {
			return;
		}

		currentShot = n;
		updateCounter();

		if (prefersReducedMotion || !track) {
			setTrackPosition(currentShot, false);
			updateControlsSettled();
			return;
		}

		isShotTransitioning = true;
		track.classList.add("is-moving");
		setTrackPosition(currentShot, true);

		function onMoveEnd(e) {
			if (e && e.target !== track) return;
			cleanup();
		}

		function cleanup() {
			track.removeEventListener("transitionend", onMoveEnd);
			if (shotFallbackTimer) {
				clearTimeout(shotFallbackTimer);
				shotFallbackTimer = null;
			}
			track.classList.remove("is-moving");
			isShotTransitioning = false;
			updateControlsSettled();
		}

		track.addEventListener("transitionend", onMoveEnd);
		// Fallback: kalau transitionend tidak terpicu, tetap bersihkan
		// state agar tombol tidak pernah terkunci.
		shotFallbackTimer = setTimeout(cleanup, SHOT_DURATION + 150);
	}

	// Reset ke Shot 01 setiap kali Slide 2 diaktifkan dari awal (misalnya
	// nanti ada navigasi mundur ke Slide 2 lagi), tanpa animasi supaya
	// tidak ada sweep shot yang tidak diminta saat slide baru muncul.
	document.addEventListener("psk:slide-changed", function (e) {
		var target = e && e.detail ? e.detail.slide : null;
		if (target !== 2) return;
		if (currentShot !== 1) {
			currentShot = 1;
			setTrackPosition(currentShot, false);
			updateCounter();
		}
		updateControlsSettled();
	});

	if (nextShotBtn) {
		nextShotBtn.addEventListener("click", function (e) {
			e.preventDefault();
			goToShot(currentShot + 1);
		});
	}

	// Inisialisasi tampilan awal (Shot 01, Next Shot terlihat, Next
	// Slide tersembunyi) — tidak menunggu event apa pun.
	setTrackPosition(currentShot, false);
	updateCounter();
	updateControlsSettled();
})();
