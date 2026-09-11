/* ==========================================================================
   TRANSISI 3 → 4 — CLOUD TRANSITION
   File: js/transition-3-4.js

   REVISI AWAN:
   - Menghapus semua logika layang-layang (kite) dan clip-path (wipe).
   - Menggunakan elemen awan solid untuk menutupi layar sepenuhnya.
   - Fase:
     1. Awan masuk menutupi layar (ENTER_DURATION).
     2. Layar tertutup 100% (COVER_DELAY). Di titik ini Slide 3 diganti Slide 4.
     3. Awan keluar membuka layar (EXIT_DURATION), mengungkap Slide 4.

   PATCH BUG #1 (black screen / state desync):
   - Menandai window.__cloudTransitionBusy selama cloud berjalan agar
     present.js (paper sweep) dan transition-4-5.js tidak memulai
     transition paralel yang merusak state slide di belakang overlay.
   - swapSlidesBehindClouds() kini juga menyetel style.display inline
     (seperti showSlide/hideSlide di present.js), supaya slide target
     yang sebelumnya pernah di-hideSlide() (inline display:none) tidak
     tetap invisible di balik awan → black screen.
   ========================================================================== */

(function () {
	"use strict";

	var slide3 = document.getElementById("slide3Scene");
	var slide4 = document.getElementById("slide4Scene");
	var nextBtn = document.getElementById("s3NextSlide");
	var overlay = document.getElementById("cloudTransitionOverlay");

	if (!slide3 || !slide4 || !nextBtn || !overlay) return;

	// PENTING: file ini sengaja dimuat SEBELUM js/present.js.
	// Atribut ini dilepas supaya present.js TIDAK ikut memasang transisinya
	nextBtn.removeAttribute("data-goto");

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	var isTransitioning = false;
	var ENTER_DURATION = 1050; // Ms, durasi maksimum animasi masuk (front layer)
	var COVER_DELAY = 200; // Ms, durasi layar tertutup penuh awan
	var EXIT_DURATION = 1200; // Ms, durasi maksimum animasi keluar (back layer)
	var transitionTimeout = null;

	nextBtn.addEventListener(
		"click",
		function (e) {
			if (
				isTransitioning ||
				window.__cloudTransitionBusy ||
				!slide3.classList.contains("is-active")
			) {
				return;
			}

			e.preventDefault();
			e.stopPropagation();

			if (prefersReducedMotion) {
				switchSlideImmediate();
				return;
			}

			startCloudTransition();
		},
		true
	);

	function startCloudTransition() {
		isTransitioning = true;
		window.__cloudTransitionBusy = true;

		// Bersihkan sisa state sebelum memulai
		overlay.classList.remove("is-active", "is-entering", "is-exiting");
		if (transitionTimeout) {
			clearTimeout(transitionTimeout);
			transitionTimeout = null;
		}

		// Paksa reflow
		void overlay.offsetWidth;

		// Mulai animasi awan masuk
		overlay.classList.add("is-active", "is-entering");

		transitionTimeout = setTimeout(function () {
			// Awan sudah 100% menutupi layar.
			// Diam-diam ganti Slide 3 dengan Slide 4 di belakang awan.
			swapSlidesBehindClouds();

			// Tahan sebentar saat tertutup penuh, lalu buka awan
			transitionTimeout = setTimeout(function () {
				overlay.classList.remove("is-entering");
				overlay.classList.add("is-exiting");

				// Tunggu hingga animasi awan keluar selesai
				transitionTimeout = setTimeout(function () {
					finishCloudTransition();
				}, EXIT_DURATION);
			}, COVER_DELAY);
		}, ENTER_DURATION);
	}

	function swapSlidesBehindClouds() {
		// Samakan konvensi dengan present.js:
		//   - slide yang tidak aktif: style.display = "none" + tanpa is-active
		//   - slide aktif          : style.display = "flex" + is-active
		// Ini penting karena present.js menyimpan visibility lewat inline
		// style.display, bukan hanya lewat class. Kalau inline display:none
		// dari kunjungan sebelumnya dibiarkan, slide target akan tetap
		// invisible di balik awan → black screen saat awan keluar.
		var allScenes = document.querySelectorAll(".generic-slide-scene");
		for (var i = 0; i < allScenes.length; i++) {
			allScenes[i].classList.remove("is-active");
			allScenes[i].style.display = "none";
		}
		slide4.style.display = "flex";
		slide4.classList.add("is-active");

		var event = new CustomEvent("psk:slide-changed", {
			detail: { slide: 4 }
		});
		document.dispatchEvent(event);
	}

	function finishCloudTransition() {
		transitionTimeout = null;
		overlay.classList.remove("is-active", "is-exiting");
		isTransitioning = false;
		window.__cloudTransitionBusy = false;
	}

	function switchSlideImmediate() {
		swapSlidesBehindClouds();
	}
})();
