/* ==========================================================================
   SLIDE 3 — MEJA INVESTIGASI "PERTUKARAN BUDAYA" — logic geser kertas SAJA.

   File ini TIDAK membuat sistem navigasi slide baru: tombol NEXT
   (#s3NextSlide) tetap memakai [data-goto="4"] yang sudah otomatis
   dikaitkan oleh init() di js/present.js. Di sini kita hanya mengatur
   KAPAN tombol itu boleh diklik (lewat properti .disabled bawaan
   <button>, sehingga saat disabled, klik/tap tidak pernah memicu
   listener data-goto milik present.js — tidak perlu mengubah/menduplikasi
   logic transitionTo() di sana).

   State kertas (order / isCycling) sengaja terpisah dari state slide
   (currentSlide / isTransitioning) di present.js — dua lapis independen,
   sama seperti pola js/slide2-film.js untuk shot.

   Animasi hanya memakai transform + opacity (lihat css/slide3.css):
   - Kertas aktif yang digeser: @keyframes s3-paper-exit (transform+opacity).
   - Dua kertas yang tetap di deck: transition CSS pada properti transform
     saja (memberi kesan "maju" tanpa animasi/RAF tambahan).
   - Ilustrasi SVG: transition opacity + transform (translateY kecil) saja.
   Tidak ada RAF/interval baru, tidak ada Three.js/canvas/WebGL.
   ========================================================================== */

(function () {
	"use strict";

	var section = document.getElementById("slide3Scene");
	if (!section) return;

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	var papers = section.querySelectorAll(".s3-paper");
	var TOTAL_PAPERS = papers.length || 3;

	var illustWrap = document.getElementById("s3Illustration");
	var illusts = illustWrap ? illustWrap.querySelectorAll(".s3-illust") : [];

	var shuffleBtn = document.getElementById("s3Shuffle");
	var nextSlideBtn = document.getElementById("s3NextSlide");

	// Harus sinkron dengan durasi @keyframes s3-paper-exit di css/slide3.css.
	var EXIT_DURATION = 620; // ms

	// order[i] = nomor kertas (1..3) yang menempati posisi tumpukan ke-i
	// (0 = paling atas/aktif, 1 = tengah, 2 = paling bawah).
	var order = [1, 2, 3];
	var isCycling = false;
	var cycleFallbackTimer = null;

	function paperByNumber(num) {
		for (var i = 0; i < papers.length; i++) {
			if (parseInt(papers[i].getAttribute("data-paper"), 10) === num) {
				return papers[i];
			}
		}
		return null;
	}

	// Terapkan posisi tumpukan (data-role) ke semua kertas sesuai `order`.
	// opts.skipEl: kertas ini dipasang ulang TANPA transisi (dipakai untuk
	// kertas yang baru saja keluar, supaya "masuk ke bawah deck" terjadi
	// instan/tidak terlihat, sesuai permintaan — tidak ada flicker karena
	// kertas ini sudah transparan di akhir animasi keluarnya).
	// opts.allInstant: semua kertas dipasang tanpa transisi (dipakai saat
	// reset/inisialisasi, supaya tidak ada pergeseran yang tidak diminta).
	function applyRoles(opts) {
		opts = opts || {};
		order.forEach(function (num, roleIndex) {
			var el = paperByNumber(num);
			if (!el) return;
			var mustBeInstant = opts.allInstant || el === opts.skipEl;
			if (mustBeInstant) {
				var prevTransition = el.style.transition;
				el.style.transition = "none";
				el.setAttribute("data-role", String(roleIndex));
				// Paksa reflow supaya perubahan berikutnya tetap bertransisi.
				void el.offsetWidth;
				el.style.transition = prevTransition || "";
			} else {
				el.setAttribute("data-role", String(roleIndex));
			}
		});
	}

	function updateNextButton() {
		if (!nextSlideBtn) return;
		nextSlideBtn.disabled = order[0] !== TOTAL_PAPERS;
	}

	function setIllustration(num, animate) {
		if (!illustWrap) return;
		for (var i = 0; i < illusts.length; i++) {
			var el = illusts[i];
			var match = parseInt(el.getAttribute("data-illust"), 10) === num;
			if (!animate) {
				var prevTransition = el.style.transition;
				el.style.transition = "none";
				el.classList.toggle("is-active", match);
				void el.offsetWidth;
				el.style.transition = prevTransition || "";
			} else {
				el.classList.toggle("is-active", match);
			}
		}
	}

	function cyclePapers() {
		if (isCycling) return;

		var activeNum = order[0];
		var activeEl = paperByNumber(activeNum);
		if (!activeEl) return;

		var nextActiveNum = order[1];

		if (prefersReducedMotion) {
			order.push(order.shift());
			applyRoles({ allInstant: true });
			setIllustration(order[0], false);
			updateNextButton();
			return;
		}

		isCycling = true;
		if (shuffleBtn) shuffleBtn.disabled = true;

		// 1-2. Kertas aktif bergerak ke atas & keluar dari area deck.
		activeEl.classList.add("s3-paper--exiting");
		// 3. Ilustrasi SVG berubah secara smooth (berjalan paralel dengan
		//    kertas keluar, bukan menunggu kertas selesai bergerak, supaya
		//    perubahan tetap terasa satu kesatuan gerak).
		setIllustration(nextActiveNum, true);

		function cleanup() {
			activeEl.removeEventListener("animationend", onEnd);
			if (cycleFallbackTimer) {
				clearTimeout(cycleFallbackTimer);
				cycleFallbackTimer = null;
			}
			activeEl.classList.remove("s3-paper--exiting");
			// 4-5. Kertas yang keluar dipasang ulang ke bawah deck (instan,
			//      tanpa terlihat); dua kertas lain maju satu posisi dengan
			//      transisi transform halus (didefinisikan di CSS).
			order.push(order.shift());
			applyRoles({ skipEl: activeEl });
			updateNextButton();
			// 6. Unlock interaction.
			isCycling = false;
			if (shuffleBtn) shuffleBtn.disabled = false;
		}

		function onEnd(e) {
			if (e && e.target !== activeEl) return;
			cleanup();
		}

		activeEl.addEventListener("animationend", onEnd);
		// Fallback: kalau animationend tidak terpicu, tetap bersihkan state
		// agar interaksi tidak pernah terkunci.
		cycleFallbackTimer = setTimeout(cleanup, EXIT_DURATION + 150);
	}

	// Reset tumpukan ke keadaan awal (Paper 01 aktif) setiap kali Slide 3
	// diaktifkan dari awal — sama seperti pola reset Shot 01 di
	// js/slide2-film.js — supaya tidak ada state kertas yang "menempel"
	// dari kunjungan sebelumnya.
	function resetDeck() {
		if (isCycling) {
			papers.forEach(function (el) {
				el.classList.remove("s3-paper--exiting");
			});
			if (cycleFallbackTimer) {
				clearTimeout(cycleFallbackTimer);
				cycleFallbackTimer = null;
			}
			isCycling = false;
			if (shuffleBtn) shuffleBtn.disabled = false;
		}
		order = [1, 2, 3];
		applyRoles({ allInstant: true });
		setIllustration(1, false);
		updateNextButton();
	}

	document.addEventListener("psk:slide-changed", function (e) {
		var target = e && e.detail ? e.detail.slide : null;
		if (target !== 3) return;
		resetDeck();
	});

	if (shuffleBtn) {
		shuffleBtn.addEventListener("click", function (e) {
			e.preventDefault();
			cyclePapers();
		});
	}

	// Inisialisasi tampilan awal — tidak menunggu event apa pun, sama
	// seperti pola init slide2-film.js.
	applyRoles({ allInstant: true });
	setIllustration(1, false);
	updateNextButton();
})();
