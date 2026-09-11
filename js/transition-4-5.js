/* ==========================================================================
   TRANSISI 4 → 5 — CLOUD TRANSITION (Reuse mekanisme 3→4)
   File: js/transition-4-5.js

   PATCH BUG #1 (black screen / state desync):
   - Menghormati window.__cloudTransitionBusy yang di-set oleh
     transition-3-4.js, agar cloud 4→5 tidak bisa berjalan paralel
     dengan cloud 3→4 yang masih dalam fase exit.
   - Menandai window.__cloudTransitionBusy selama cloud 4→5 berjalan
     agar present.js dan handler lain tidak memulai transition paralel.
   - swapSlidesBehindClouds() juga menyetel style.display inline
     (seperti showSlide/hideSlide di present.js) untuk mencegah slide
     target tetap invisible akibat inline display:none yang nyangkut.
   ========================================================================== */

(function () {
	"use strict";

	var slide4 = document.getElementById("slide4Scene");
	var slide5 = document.getElementById("slide5Scene");
	var nextBtn = document.getElementById("s4NextSlide");
	var overlay = document.getElementById("cloudTransitionOverlay");

	if (!slide4 || !slide5 || !nextBtn || !overlay) return;

	// Lepas data-goto agar present.js tidak memasang paper-sweep
	nextBtn.removeAttribute("data-goto");

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	var isTransitioning = false;
	var ENTER_DURATION = 1050;
	var COVER_DELAY = 200;
	var EXIT_DURATION = 1200;
	var transitionTimeout = null;

	nextBtn.addEventListener(
		"click",
		function (e) {
			if (
				isTransitioning ||
				window.__cloudTransitionBusy ||
				!slide4.classList.contains("is-active")
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

		overlay.classList.remove("is-active", "is-entering", "is-exiting");
		if (transitionTimeout) {
			clearTimeout(transitionTimeout);
			transitionTimeout = null;
		}
		void overlay.offsetWidth;

		overlay.classList.add("is-active", "is-entering");

		transitionTimeout = setTimeout(function () {
			swapSlidesBehindClouds();

			transitionTimeout = setTimeout(function () {
				overlay.classList.remove("is-entering");
				overlay.classList.add("is-exiting");

				transitionTimeout = setTimeout(function () {
					finishCloudTransition();
				}, EXIT_DURATION);
			}, COVER_DELAY);
		}, ENTER_DURATION);
	}

	function swapSlidesBehindClouds() {
		// Sama dengan transition-3-4.js: samakan konvensi dengan present.js
		// (inline style.display + class is-active) agar slide target tidak
		// nyangkut di inline display:none dari kunjungan sebelumnya.
		var allScenes = document.querySelectorAll(".generic-slide-scene");
		for (var i = 0; i < allScenes.length; i++) {
			allScenes[i].classList.remove("is-active");
			allScenes[i].style.display = "none";
		}
		slide5.style.display = "flex";
		slide5.classList.add("is-active");

		var event = new CustomEvent("psk:slide-changed", {
			detail: { slide: 5 }
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
