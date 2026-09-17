/* ==========================================================================
   SLIDE 2 — CAROUSEL LOGIC.

   Tanggung jawab file ini HANYA:
   - Menentukan shot mana yang aktif / prev / next (toggle class CSS).
   - Menampilkan / menyembunyikan tombol "NEXT SHOT" dan "NEXT →".
   - Reset ke shot 1 saat Slide 2 diaktifkan.

   BUKAN tugas file ini:
   - Membuat sistem navigasi slide (itu di present.js via [data-goto]).
   - Mengatur animasi (itu di CSS transitions).
   - Mengubah foto (foto static, dikunci CSS !important).

   Tidak ada RAF, tidak ada render loop, tidak ada per-frame DOM.
   ========================================================================== */

(function () {
	"use strict";

	var section = document.getElementById("slide2Scene");
	if (!section) return;

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	var shots = section.querySelectorAll(".s2-shot");
	var TOTAL_SHOTS = shots.length || 5;

	var counterEl = document.getElementById("s2Counter");
	var nextShotBtn = document.getElementById("s2NextShot");
	var nextSlideBtn = document.getElementById("s2NextSlide");

	// Harus sinkron dengan durasi transition CSS .s2-shot.
	var SHOT_DURATION = 700; // ms

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

	function updateControlsSettled() {
		var atLast = currentShot === TOTAL_SHOTS;
		if (nextShotBtn) nextShotBtn.classList.toggle("is-hidden", atLast);
		if (nextSlideBtn) nextSlideBtn.classList.toggle("is-visible", atLast);
	}

	/* Toggle class per shot: satu .is-active, satu .is-prev (jika ada),
	   satu .is-next (jika ada). Sisanya tanpa class → hidden (scale 0). */
	function updateCarousel() {
		for (var i = 0; i < shots.length; i++) {
			var shotIndex = i + 1;
			var el = shots[i];
			el.classList.remove("is-active", "is-prev", "is-next");
			if (shotIndex === currentShot) {
				el.classList.add("is-active");
			} else if (shotIndex === currentShot - 1) {
				el.classList.add("is-prev");
			} else if (shotIndex === currentShot + 1) {
				el.classList.add("is-next");
			}
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
		updateCarousel();

		if (prefersReducedMotion) {
			updateControlsSettled();
			return;
		}

		isShotTransitioning = true;
		if (shotFallbackTimer) clearTimeout(shotFallbackTimer);
		shotFallbackTimer = setTimeout(function () {
			shotFallbackTimer = null;
			isShotTransitioning = false;
			updateControlsSettled();
		}, SHOT_DURATION);
	}

	// Reset ke Shot 1 setiap kali Slide 2 diaktifkan.
	document.addEventListener("psk:slide-changed", function (e) {
		var target = e && e.detail ? e.detail.slide : null;
		if (target !== 2) return;

		if (shotFallbackTimer) {
			clearTimeout(shotFallbackTimer);
			shotFallbackTimer = null;
		}
		isShotTransitioning = false;
		currentShot = 1;
		updateCounter();
		updateCarousel();
		updateControlsSettled();
	});

	if (nextShotBtn) {
		nextShotBtn.addEventListener("click", function (e) {
			e.preventDefault();
			goToShot(currentShot + 1);
		});
	}

	// Inisialisasi awal (state Shot 1).
	updateCounter();
	updateCarousel();
	updateControlsSettled();
})();
