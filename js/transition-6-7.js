/* ==========================================================================
   TRANSISI 6 → 7 — "KAMERA ZOOM KE THUMBNAIL", lalu HARD CUT (TANPA fade/flash)
   File: js/transition-6-7.js

   Konsep: yang di-scale adalah SELURUH panggung Slide 6 (#slide6Scene),
   BUKAN kotak thumbnail itu sendiri — transform-origin diletakkan persis
   di titik tengah thumbnail, sehingga hasilnya terasa seperti kamera
   bergerak mendekat ke thumbnail (elemen di sekitarnya ikut membesar dan
   "pergi" keluar frame), sampai area thumbnail menutupi seluruh layar.
   Begitu animasi zoom selesai, Slide 7 langsung ditukar secara instan
   (hard cut) — transisi opacity bawaan .generic-slide-scene dimatikan
   sesaat khusus untuk pertukaran ini supaya tidak ada fade/flash sama
   sekali.

   Pola file ini SAMA PERSIS dengan js/transition-3-4.js dan
   js/transition-4-5.js yang sudah ada:
   1) lepas [data-goto] dari tombol NEXT terkait SEBELUM present.js
      men-scan semua [data-goto] di init() (karena itu file ini di-load
      lebih dulu di present.html, sebelum js/present.js);
   2) tangani swap class "is-active" + dispatch event "psk:slide-changed"
      sendiri, persis seperti showSlide()/hideSlide() di present.js,
      supaya currentSlide/localStorage tetap sinkron lewat listener yang
      SUDAH ADA di present.js.

   TIDAK ada elemen/section lain yang diubah oleh file ini. TIDAK ada
   RAF loop, Canvas, WebGL, atau <video> — hanya satu CSS transition
   "transform" yang dipicu sekali per klik NEXT.
   ========================================================================== */

(function () {
	"use strict";

	var slide6 = document.getElementById("slide6Scene");
	var slide7 = document.getElementById("slide7Scene");
	var nextBtn = document.getElementById("s6NextSlide");
	var thumb = slide6 ? slide6.querySelector(".s6-thumb") : null;

	// Kalau salah satu elemen tidak ditemukan (mis. markup berubah),
	// JANGAN lepas [data-goto] — biarkan present.js menangani tombol ini
	// dengan paper-sweep generik seperti biasa (fail-safe).
	if (!slide6 || !slide7 || !nextBtn || !thumb) return;

	nextBtn.removeAttribute("data-goto");

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	var isTransitioning = false;
	var ZOOM_DURATION = 900; // ms — durasi push-in kamera
	var fallbackTimer = null;

	nextBtn.addEventListener(
		"click",
		function (e) {
			if (isTransitioning || !slide6.classList.contains("is-active")) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();

			if (prefersReducedMotion) {
				// Reduced motion: langsung tukar slide, tanpa animasi apa pun.
				cutToSlide7();
				return;
			}
			startZoomTransition();
		},
		true
	);

	function startZoomTransition() {
		isTransitioning = true;

		var thumbRect = thumb.getBoundingClientRect();
		var vw = window.innerWidth;
		var vh = window.innerHeight;

		// Titik tengah thumbnail SAAT INI (koordinat viewport).
		var thumbCenterX = thumbRect.left + thumbRect.width / 2;
		var thumbCenterY = thumbRect.top + thumbRect.height / 2;

		// Titik tengah viewport — target akhir kamera, harus pas di sini.
		var viewportCenterX = vw / 2;
		var viewportCenterY = vh / 2;

		// "Cover": skala terbesar dari dua sumbu supaya area thumbnail
		// benar-benar menutupi seluruh layar tanpa celah, sedikit dilebihkan
		// (1.02x) untuk mengantisipasi pembulatan sub-pixel.
		var scale =
			Math.max(vw / thumbRect.width, vh / thumbRect.height) * 1.02;

		// PERBAIKAN (drift ke kiri): transform-origin dipasang di TENGAH
		// #slide6Scene (= tengah viewport). scale() SENDIRIAN tidak
		// memindahkan apa pun ke tengah, cuma membesar di tempat. Supaya
		// titik tengah THUMBNAIL (yang letaknya di kiri layar) ikut
		// "ditarik" persis ke titik tengah viewport selagi membesar,
		// translate() dihitung: scale * (pusatViewport - pusatThumbnailAsli).
		var translateX = scale * (viewportCenterX - thumbCenterX);
		var translateY = scale * (viewportCenterY - thumbCenterY);

		slide6.style.willChange = "transform";
		slide6.style.transformOrigin = "50% 50%";
		slide6.style.transition = "none";
		slide6.style.transform = "translate(0px, 0px) scale(1)";

		// Force reflow (bukan RAF/render loop — cuma satu kali baca layout)
		// eslint-disable-next-line no-unused-expressions
		void slide6.offsetWidth;

		slide6.style.transition =
			"transform " + ZOOM_DURATION + "ms cubic-bezier(0.65, 0, 0.35, 1)";
		slide6.style.transform =
			"translate(" +
			translateX +
			"px, " +
			translateY +
			"px) scale(" +
			scale +
			")";

		function onTransitionEnd(e) {
			if (e.target !== slide6 || e.propertyName !== "transform") return;
			slide6.removeEventListener("transitionend", onTransitionEnd);
			onZoomDone();
		}
		slide6.addEventListener("transitionend", onTransitionEnd);

		fallbackTimer = setTimeout(function () {
			slide6.removeEventListener("transitionend", onTransitionEnd);
			onZoomDone();
		}, ZOOM_DURATION + 150);

		function onZoomDone() {
			if (fallbackTimer) {
				clearTimeout(fallbackTimer);
				fallbackTimer = null;
			}
			cutToSlide7();
		}
	}

	// Hard cut ke Slide 7 — TANPA fade/flash: transisi opacity bawaan
	// .generic-slide-scene dimatikan sesaat khusus untuk Slide 7 di sini.
	function cutToSlide7() {
		slide7.style.transition = "none";
		slide7.style.display = "flex";
		slide7.classList.remove("is-leaving");
		slide7.classList.add("is-active");

		// Sembunyikan Slide 6 & bersihkan SEMUA inline style zoom yang
		// dipasang di atas, supaya elemen ini kembali ke kondisi normal
		// (tidak tersangkut dalam keadaan ter-zoom).
		slide6.classList.remove("is-active", "is-leaving");
		slide6.style.display = "none";
		slide6.style.transform = "";
		slide6.style.transformOrigin = "";
		slide6.style.transition = "";
		slide6.style.willChange = "";

		document.dispatchEvent(
			new CustomEvent("psk:slide-changed", { detail: { slide: 7 } })
		);

		isTransitioning = false;

		// Pulihkan transition opacity default .generic-slide-scene pada
		// Slide 7 setelah swap ini selesai (bukan loop — hanya dijadwalkan
		// sekali), supaya tidak mengubah perilaku slide tsb untuk kasus
		// lain di masa depan.
		setTimeout(function () {
			slide7.style.transition = "";
		}, 0);
	}
})();
