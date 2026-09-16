/* ==========================================================================
   SLIDE 4 — "DAMPAK SOSIAL: PELUANG DAN TANTANGAN" — logic state saja.

   Sama seperti pola js/slide3.js: file ini TIDAK membuat sistem navigasi
   slide baru. Tombol NEXT (#s4NextSlide) tetap memakai [data-goto="5"]
   yang sudah otomatis dikaitkan oleh init() di js/present.js — di sini
   kita hanya mengatur kapan tombol itu terlihat/aktif (lewat CSS,
   berdasarkan atribut data-s4-state, lihat css/slide4.css).

   State PELUANG <-> TANTANGAN adalah lapisan independen dari state slide
   (currentSlide / isTransitioning) milik present.js, sama seperti state
   kertas di slide3.js atau shot di slide2-film.js.

   Semua "gerak" transisi (siang<->malam, karakter berbalik, panel
   fade) dikerjakan lewat CSS @keyframes (css/slide4.css) yang dipicu
   dengan menambah/melepas SATU class pada section
   (.is-turning-to-night / .is-turning-to-day). Tidak ada
   requestAnimationFrame/interval baru di sini — hanya satu setTimeout
   untuk mengunci interaksi selama durasi transisi & menuntaskan state
   di akhir, sama seperti pola timer fallback di present.js/slide3.js.
   ========================================================================== */

(function () {
	"use strict";

	var section = document.getElementById("slide4Scene");
	if (!section) return;

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	// Harus sinkron dengan total durasi animasi transisi di css/slide4.css
	// (day/night fade delay 300ms + duration 550ms = selesai di 850ms;
	// karakter delay 150ms + duration 650ms = selesai di 800ms; panel
	// masuk delay ~620-640ms + durasi 300ms = selesai di ~940ms).
	var TRANSITION_DURATION = 950; // ms

	var panelPeluang = section.querySelector('[data-panel="peluang"]');
	var panelTantangan = section.querySelector('[data-panel="tantangan"]');
	var toggleBtn = document.getElementById("s4Toggle");

	var state = "peluang"; // 'peluang' | 'tantangan'
	var isTransitioning = false;
	var transitionFallbackTimer = null;

	function setActivePanel(target) {
		if (panelPeluang) {
			panelPeluang.classList.toggle("is-active", target === "peluang");
		}
		if (panelTantangan) {
			panelTantangan.classList.toggle(
				"is-active",
				target === "tantangan"
			);
		}
	}

	function updateToggleLabel(target) {
		if (!toggleBtn) return;
		if (target === "peluang") {
			toggleBtn.setAttribute("aria-label", "Lihat Tantangan");
		} else {
			toggleBtn.setAttribute("aria-label", "Kembali ke Peluang");
		}
	}

	// Set langsung tanpa animasi (dipakai saat init / reset / reduced motion).
	function applyStateInstant(target) {
		state = target;
		section.setAttribute("data-s4-state", target);
		setActivePanel(target);
		updateToggleLabel(target);
	}

	function toggleState() {
		if (isTransitioning) return;

		var target = state === "peluang" ? "tantangan" : "peluang";

		if (prefersReducedMotion) {
			applyStateInstant(target);
			return;
		}

		isTransitioning = true;
		if (toggleBtn) toggleBtn.disabled = true;

		var turnClass =
			target === "tantangan" ? "is-turning-to-night" : "is-turning-to-day";

		// Panel tujuan harus sudah "aktif" (opacity dikendalikan oleh
		// animasi transisi, bukan oleh .is-active) supaya terlihat saat
		// animasi masuknya berjalan; panel asal baru dilepas is-active
		// setelah transisi selesai.
		if (target === "tantangan" && panelTantangan) {
			panelTantangan.classList.add("is-active");
		} else if (target === "peluang" && panelPeluang) {
			panelPeluang.classList.add("is-active");
		}

		section.classList.add(turnClass);

		function cleanup() {
			section.classList.remove(turnClass);
			section.setAttribute("data-s4-state", target);
			setActivePanel(target);
			updateToggleLabel(target);
			state = target;
			isTransitioning = false;
			if (toggleBtn) toggleBtn.disabled = false;
			transitionFallbackTimer = null;
		}

		transitionFallbackTimer = setTimeout(cleanup, TRANSITION_DURATION);
	}

	// Reset ke PELUANG setiap kali Slide 4 diaktifkan dari awal (mis. jika
	// suatu saat ada navigasi mundur), sama seperti pola resetDeck() di
	// slide3.js — instan, tanpa animasi, supaya tidak ada state yang
	// "menempel" dari kunjungan sebelumnya.
	function resetToPeluang() {
		if (isTransitioning) {
			section.classList.remove("is-turning-to-night", "is-turning-to-day");
			if (transitionFallbackTimer) {
				clearTimeout(transitionFallbackTimer);
				transitionFallbackTimer = null;
			}
			isTransitioning = false;
			if (toggleBtn) toggleBtn.disabled = false;
		}
		applyStateInstant("peluang");
	}

	document.addEventListener("psk:slide-changed", function (e) {
		var target = e && e.detail ? e.detail.slide : null;
		if (target !== 4) return;
		resetToPeluang();
	});

	if (toggleBtn) {
		toggleBtn.addEventListener("click", function (e) {
			e.preventDefault();
			toggleState();
		});
	}

	// Inisialisasi tampilan awal — tidak menunggu event apa pun, sama
	// seperti pola init di slide3.js/slide2-film.js.
	applyStateInstant("peluang");
})();
