/* ==========================================================================
   SLIDE 6 — interaksi visual OPSIONAL saja.

   Sama seperti pola js/slide3.js, js/slide4.js, js/slide5.js: file ini
   TIDAK membuat navigasi/router/state-management baru. Navigasi antar
   slide sepenuhnya ditangani oleh js/present.js melalui transitionTo();
   tombol NEXT di Slide 6 memakai [data-goto="7"] yang sudah otomatis
   dikaitkan oleh init() di sana.

   Di sini hanya tiga toggle tampilan ringan (tanpa efek nyata):
   - tombol play/pause di tengah thumbnail (murni ganti ikon)
   - tombol Like (murni ganti warna/state)
   - tombol Subscribe (murni ganti label/state)

   Tidak ada <video>/autoplay/audio, tidak ada RAF/Canvas/WebGL, tidak ada
   native Share API, tidak ada modal.
   ========================================================================== */

(function () {
	"use strict";

	var section = document.getElementById("slide6Scene");
	if (!section) return;

	function bindToggle(selector, activeAttr) {
		var el = section.querySelector(selector);
		if (!el) return;
		el.addEventListener("click", function (e) {
			e.preventDefault();
			var isActive = el.getAttribute(activeAttr) === "true";
			el.setAttribute(activeAttr, String(!isActive));
		});
	}

	// Play/pause icon toggle pada thumbnail (visual affordance saja).
	bindToggle(".s6-thumb__play", "aria-pressed");

	// Like — hanya toggle state warna, tidak mengubah angka.
	bindToggle(".s6-meta__like", "aria-pressed");

	// Subscribe — toggle label/state, tidak ada permintaan/izin nyata.
	var subscribeBtn = section.querySelector(".s6-meta__subscribe");
	if (subscribeBtn) {
		subscribeBtn.addEventListener("click", function (e) {
			e.preventDefault();
			var isSubscribed = subscribeBtn.getAttribute("aria-pressed") === "true";
			subscribeBtn.setAttribute("aria-pressed", String(!isSubscribed));
			subscribeBtn.textContent = isSubscribed ? "Subscribe" : "Subscribed";
		});
	}
})();
