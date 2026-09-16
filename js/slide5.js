/* ==========================================================================
   SLIDE 5 — "THE SOCIAL REPORT" — logic state saja.

   Sama seperti pola js/slide3.js dan js/slide4.js: file ini TIDAK membuat
   sistem navigasi/state-management/router baru. Navigasi antar slide
   sepenuhnya ditangani oleh js/present.js melalui transitionTo().
   Di sini kita hanya mengatur satu lapisan state independen (report mana
   yang sedang "jatuh"/aktif/tertumpuk), persis seperti pola state kertas
   di slide3.js atau panel di slide4.js.

   Animasi jatuh murni CSS (@keyframes s5-fall, lihat css/slide5.css).
   Tidak ada requestAnimationFrame/physics engine/Three.js di sini — hanya
   penambahan/pelepasan class + satu setTimeout fallback per langkah, sama
   seperti pola timer fallback di present.js/slide3.js.
   ========================================================================== */

(function () {
	"use strict";

	var section = document.getElementById("slide5Scene");
	if (!section) return;

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	// Harus sinkron dengan durasi @keyframes s5-fall di css/slide5.css.
	var FALL_DURATION = 820; // ms

	var reports = Array.prototype.slice.call(
		section.querySelectorAll(".s5-report")
	);
	var nextBtn = document.getElementById("s5NextReport");
	var TOTAL_REPORTS = reports.length; // 4

	var activeIndex = -1; // -1 = belum ada report yang jatuh
	var isAnimating = false;
	var fallbackTimer = null;

	function clearFallback() {
		if (fallbackTimer) {
			clearTimeout(fallbackTimer);
			fallbackTimer = null;
		}
	}

	function updateButtonLabel() {
		if (!nextBtn) return;
		if (activeIndex < TOTAL_REPORTS - 1) {
			nextBtn.textContent = "NEXT REPORT →";
			nextBtn.setAttribute("aria-label", "Lihat laporan berikutnya");
		} else {
			nextBtn.textContent = "CONTINUE →";
			nextBtn.setAttribute("aria-label", "Lanjut ke Slide 6");
		}
	}

	function showButton() {
		if (nextBtn) nextBtn.classList.add("is-visible");
	}

	function hideButton() {
		if (nextBtn) nextBtn.classList.remove("is-visible");
	}

	// Jatuhkan report pada index tertentu. Report-report sebelum index ini
	// otomatis diberi class .is-stacked (tumpukan di belakang), bukan
	// disembunyikan — sesuai konsep "koran yang sudah dibuka tetap di meja".
	function fallReport(index) {
		if (index < 0 || index >= TOTAL_REPORTS) return;
		isAnimating = true;
		hideButton();
		clearFallback();

		reports.forEach(function (el, i) {
			el.classList.remove("is-falling", "is-active", "is-stacked");
			if (i < index) {
				el.classList.add("is-stacked");
				el.style.setProperty("--s5-stack-i", String(index - 1 - i));
				el.style.display = "block";
			} else if (i > index) {
				el.style.display = "none";
			}
		});

		var target = reports[index];

		function settle() {
			target.classList.remove("is-falling");
			target.classList.add("is-active");
			isAnimating = false;
			activeIndex = index;
			updateButtonLabel();
			showButton();
		}

		if (prefersReducedMotion) {
			target.style.display = "block";
			settle();
			return;
		}

		// Force reflow supaya animasi selalu restart bersih walau class
		// sebelumnya baru saja dilepas (mencegah "macet" saat navigasi
		// cepat bolak-balik).
		target.style.display = "block";
		// eslint-disable-next-line no-unused-expressions
		void target.offsetWidth;
		target.classList.add("is-falling");

		function onAnimEnd(e) {
			if (e.target !== target) return;
			target.removeEventListener("animationend", onAnimEnd);
			clearFallback();
			settle();
		}
		target.addEventListener("animationend", onAnimEnd);

		// Fallback: pastikan tidak pernah macet kalau animationend tidak
		// terpicu untuk alasan apa pun.
		fallbackTimer = setTimeout(function () {
			target.removeEventListener("animationend", onAnimEnd);
			settle();
		}, FALL_DURATION + 150);
	}

	function handleNextClick() {
		if (isAnimating) return;

		if (activeIndex < TOTAL_REPORTS - 1) {
			fallReport(activeIndex + 1);
		} else {
			// Report 04 sudah aktif. Langsung navigasi ke Slide 6
			// menggunakan transisi existing dari present.js.
			if (window.presentTransitionTo) {
				window.presentTransitionTo(6);
			}
		}
	}

	// Reset seluruh urutan report ke keadaan awal setiap kali Slide 5
	// diaktifkan dari awal (masuk dari Slide 4 ATAU restore langsung lewat
	// localStorage) — sama seperti pola resetDeck() di js/slide3.js —
	// supaya tidak ada state "menempel" dari kunjungan sebelumnya.
	function resetSlide() {
		clearFallback();
		isAnimating = false;
		activeIndex = -1;

		reports.forEach(function (el) {
			el.classList.remove("is-falling", "is-active", "is-stacked");
			el.style.display = "none";
			el.style.removeProperty("--s5-stack-i");
		});

		hideButton();
		fallReport(0);
	}

	document.addEventListener("psk:slide-changed", function (e) {
		var target = e && e.detail ? e.detail.slide : null;
		if (target === 5) {
			resetSlide();
		}
		// Tidak perlu melakukan apa pun saat meninggalkan Slide 5 karena
		// tidak ada timer/conclusion yang harus dibersihkan.
	});

	if (nextBtn) {
		nextBtn.addEventListener("click", function (e) {
			e.preventDefault();
			handleNextClick();
		});
	}

	// PENTING — race condition saat restore langsung ke Slide 5:
	// js/present.js memanggil dispatchSlideChanged(savedSlide) di dalam
	// init()-nya SENDIRI, dan script ini (js/slide5.js) dimuat/`<script
	// defer>` SETELAH js/present.js dalam present.html. Semua script defer
	// dieksekusi berurutan sesuai posisinya di dokumen sebelum
	// DOMContentLoaded — artinya kalau localStorage menyimpan Slide 5,
	// present.js sudah selesai mengirim event "psk:slide-changed" SEBELUM
	// listener di atas sempat terpasang, sehingga event itu terlewat dan
	// keempat report tetap tersembunyi selamanya.
	//
	// Fix: cek langsung apakah section ini sudah punya class "is-active"
	// (ditambahkan present.js SEBELUM dispatch) saat script ini jalan. Kalau
	// ya, jalankan reset yang sama secara manual di sini. Untuk navigasi
	// normal (klik NEXT dari Slide 4), event listener di atas sudah cukup
	// karena saat itu semua script sudah lama termuat.
	if (section.classList.contains("is-active")) {
		resetSlide();
	} else {
		reports.forEach(function (el) {
			el.style.display = "none";
		});
	}
})();
