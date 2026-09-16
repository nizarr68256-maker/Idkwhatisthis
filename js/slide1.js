/* ==========================================================================
   SLIDE 1 — DUNIA MAKIN TERHUBUNG
   Transisi Slide 1 -> Slide 2 = "paper page turn" murni CSS (transform +
   perspective + transform-origin, didefinisikan di css/slide1.css).
   TIDAK ada renderer/camera/canvas/requestAnimationFrame baru di sini.
   ========================================================================== */

(function () {
	"use strict";

	var slide1Scene = document.getElementById("slide1Scene");
	var slide2Scene = document.getElementById("slide2Scene");
	var nextBtn = document.getElementById("slide1Next");
	if (!slide1Scene || !nextBtn) return;

	var isOpen = false;
	var isTransitioning = false; // lock sederhana, cegah transition bertumpuk
	var state = "hidden"; // 'hidden' | 'entering' | 'idle' | 'turning'

	/* ---------------------------------------------------------------------
     BUKA SLIDE 1 (fade-in sederhana, murni CSS transition opacity)
     --------------------------------------------------------------------- */
	function openSlide1() {
		if (isTransitioning || isOpen) return;
		isTransitioning = true;
		isOpen = true;
		state = "entering";

		slide1Scene.style.display = "flex";
		slide1Scene.style.transform = "";
		void slide1Scene.offsetWidth; // reflow agar transisi opacity terpicu
		slide1Scene.classList.add("is-active");

		var finished = false;
		function finish() {
			if (finished) return;
			finished = true;
			slide1Scene.removeEventListener("transitionend", onEnd);
			state = "idle";
			isTransitioning = false;
		}
		function onEnd(e) {
			if (e.target === slide1Scene && e.propertyName === "opacity") {
				finish();
			}
		}
		slide1Scene.addEventListener("transitionend", onEnd);
		// fallback jika transitionend tidak terpicu (mis. reduced-motion)
		setTimeout(finish, 700);
	}

	/* ---------------------------------------------------------------------
     NEXT -> PAPER PAGE TURN -> SLIDE 2
     Slide 2 sudah "ada di bawah" Slide 1 secara DOM; kita tampilkan dulu
     lalu balik Slide 1 dengan transform CSS agar Slide 2 terlihat muncul
     dari baliknya, seperti membalik halaman fisik dari sudut kanan-bawah.
     --------------------------------------------------------------------- */
	function goNext() {
		if (isTransitioning || state !== "idle") return; // cegah klik ganda
		isTransitioning = true;
		state = "turning";

		// Slide 2 ditampilkan lebih dulu, di bawah Slide 1 yang sedang membalik
		if (slide2Scene) {
			slide2Scene.style.zIndex = "70";
			slide2Scene.style.display = "flex";
		}

		slide1Scene.classList.add("is-turning");

		var finished = false;
		function finish() {
			if (finished) return;
			finished = true;
			slide1Scene.removeEventListener("transitionend", onEnd);

			// Reset Slide 1 sepenuhnya supaya bisa dibuka lagi dari awal jika perlu
			slide1Scene.style.display = "none";
			slide1Scene.classList.remove("is-active", "is-turning");
			slide1Scene.style.transform = "";

			state = "hidden";
			isOpen = false;
			isTransitioning = false;

			// Beri tahu bagian lain (jika ada) bahwa Slide 1 selesai, TANPA
			// memicu ulang sistem zoom-ke-papan/foto milik board.js.
			document.dispatchEvent(new CustomEvent("psk:slide1-complete"));
		}
		function onEnd(e) {
			if (e.target === slide1Scene && e.propertyName === "transform") {
				finish();
			}
		}
		slide1Scene.addEventListener("transitionend", onEnd);
		// fallback timer (mis. reduced-motion mematikan transisi)
		setTimeout(finish, 1000);
	}

	/* Listener untuk event dari board: foto pertama membuka Slide 1 */
	document.addEventListener("psk:photo-focused", function (e) {
		var index = e.detail ? e.detail.index : -1;
		if (index === 0) {
			openSlide1();
		}
	});

	nextBtn.addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		goNext();
	});

	slide1Scene.addEventListener("pointerdown", function (e) {
		e.preventDefault();
	});
})();
