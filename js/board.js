/* ==========================================================================
   PERUBAHAN SOSIAL KONTEMPORER — Scene 1: Papan Hijau (Menu Visual)
   Diaktifkan oleh event 'psk:board-reveal' yang dipancarkan main.js.
   --------------------------------------------------------------------------
   MODIFIKASI:
   - Ditambahkan navigasi ke present.html setelah fokus foto pertama selesai.
   - Tidak ada perubahan lain pada logika board/focus/return.
   ========================================================================== */

(function () {
	"use strict";

	var boardScene = document.getElementById("boardScene");
	var feltCanvas = document.getElementById("feltCanvas");
	var photosHost = document.getElementById("boardPhotos");
	var backBtn = document.getElementById("boardBack");
	var boardFrame = boardScene
		? boardScene.querySelector(".board-frame")
		: null;
	if (!boardScene || !feltCanvas || !photosHost || !boardFrame) return;

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	/* ---------------------------------------------------------------------
     0. KONFIGURASI 7 FOTO
     --------------------------------------------------------------------- */
	var PHOTOS = [
		{
			src: "img/slide-1.jpg",
			alt: "Slide 1",
			x: 50,
			y: 10,
			tilt: -3,
			size: 1.0
		},
		{
			src: "img/slide-2.jpg",
			alt: "Slide 2",
			x: 12,
			y: 32,
			tilt: 4,
			size: 1.0
		},
		{
			src: "img/slide-3.jpg",
			alt: "Slide 3",
			x: 88,
			y: 30,
			tilt: -4.5,
			size: 1.0
		},
		{
			src: "img/slide-4.jpg",
			alt: "Slide 4",
			x: 50,
			y: 52,
			tilt: 2.6,
			size: 1.1
		},
		{
			src: "img/slide-5.jpg",
			alt: "Slide 5",
			x: 10,
			y: 74,
			tilt: -2.2,
			size: 1.0
		},
		{
			src: "img/slide-6.jpg",
			alt: "Slide 6",
			x: 90,
			y: 72,
			tilt: 3.4,
			size: 1.0
		},
		{
			src: "img/slide-7.jpg",
			alt: "Slide 7",
			x: 50,
			y: 92,
			tilt: -2.8,
			size: 1.0
		}
	];

	/* State Machine */
	var STATE = {
		TRANSITION: "transition",
		BOARD: "board",
		FOCUSING: "focusing",
		FOCUS: "focus",
		RETURNING: "returning"
	};

	var state = STATE.TRANSITION;
	var revealed = false;
	var isTransitioning = false;
	var selectedPhoto = null;
	var currentFocusedPhoto = null;
	var transitionTimeout = null;

	/* ---------------------------------------------------------------------
     1. TEKSTUR FELT HIJAU
     --------------------------------------------------------------------- */
	function drawFelt() {
		var dpr = Math.min(window.devicePixelRatio || 1, 2);
		var w = feltCanvas.clientWidth;
		var h = feltCanvas.clientHeight;
		if (!w || !h) return;
		feltCanvas.width = w * dpr;
		feltCanvas.height = h * dpr;
		var ctx = feltCanvas.getContext("2d");
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		var grad = ctx.createRadialGradient(
			w * 0.5,
			h * 0.32,
			10,
			w * 0.5,
			h * 0.5,
			w * 0.75
		);
		grad.addColorStop(0, "#1c7a45");
		grad.addColorStop(0.55, "#116038");
		grad.addColorStop(1, "#0a4527");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);

		var fiberCount = Math.floor((w * h) / 700);
		for (var i = 0; i < fiberCount; i++) {
			var x = Math.random() * w;
			var y = Math.random() * h;
			var len = Math.random() * 5 + 1.5;
			var ang = Math.random() * Math.PI;
			var light = Math.random() > 0.5;
			ctx.strokeStyle = light
				? "rgba(210,255,220," + (Math.random() * 0.05 + 0.015) + ")"
				: "rgba(0,20,10," + (Math.random() * 0.08 + 0.02) + ")";
			ctx.lineWidth = 0.6;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
			ctx.stroke();
		}

		for (var b = 0; b < 6; b++) {
			var bx = Math.random() * w,
				by = Math.random() * h;
			var br = 60 + Math.random() * 140;
			var bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
			bg.addColorStop(0, "rgba(0,20,10,0.10)");
			bg.addColorStop(1, "rgba(0,20,10,0)");
			ctx.fillStyle = bg;
			ctx.fillRect(bx - br, by - br, br * 2, br * 2);
		}
	}

	/* ---------------------------------------------------------------------
     2. BANGUN 7 FOTO
     HANYA FOTO INDEX 0 (Photo 1) yang interaktif -> membuka Slide 1.
     Foto index 1-6 dirender sebagai <div> dekoratif statis: tanpa click
     listener, tanpa hover interaction, tanpa focus/zoom state, tanpa
     camera target. Visualnya (posisi, tilt, ukuran, pin, kertas) identik
     dengan sebelumnya — cuma tidak diberi interaksi apa pun.
     --------------------------------------------------------------------- */
	var INTERACTIVE_INDEX = 0;

	function buildPhotos() {
		photosHost.innerHTML = "";
		PHOTOS.forEach(function (p, idx) {
			var isInteractive = idx === INTERACTIVE_INDEX;
			var el = document.createElement(isInteractive ? "button" : "div");
			el.className = isInteractive
				? "board-photo"
				: "board-photo board-photo--static";
			el.style.setProperty("--x", p.x + "%");
			el.style.setProperty("--y", p.y + "%");
			el.style.setProperty("--tilt", (p.tilt || 0) + "deg");
			el.style.setProperty("--size", String(p.size || 1));
			el.style.setProperty(
				"--delay",
				(prefersReducedMotion ? 0 : 180 + idx * 90) + "ms"
			);

			if (isInteractive) {
				el.type = "button";
				el.setAttribute("data-index", String(idx));
				el.setAttribute("aria-label", p.alt);
			} else {
				// Dekorasi murni: bukan kontrol, disembunyikan dari a11y tree.
				el.setAttribute("aria-hidden", "true");
			}

			var pin = document.createElement("span");
			pin.className = "board-photo__pin";
			el.appendChild(pin);

			var paper = document.createElement("span");
			paper.className = "board-photo__paper";
			var img = document.createElement("img");
			img.src = p.src;
			img.alt = isInteractive ? p.alt : "";
			img.loading = "lazy";
			img.draggable = false;
			paper.appendChild(img);
			el.appendChild(paper);

			if (isInteractive) {
				el.addEventListener("click", function (e) {
					e.preventDefault();
					e.stopPropagation();
					if (state !== STATE.BOARD || isTransitioning) return;
					focusPhoto(idx, el, p);
				});

				el.addEventListener("pointerdown", function (e) {
					e.preventDefault();
				});

				el.addEventListener("dragstart", function (e) {
					e.preventDefault();
				});
			}
			// Foto 2-7: sengaja tidak diberi event listener apa pun.

			photosHost.appendChild(el);
		});
	}

	/* ---------------------------------------------------------------------
     2.5 RED STRING — SVG di bawah foto
     --------------------------------------------------------------------- */
	function createRedStrings() {
		var svgNS = "http://www.w3.org/2000/svg";
		var svg = document.createElementNS(svgNS, "svg");
		svg.setAttribute("class", "board-strings");
		svg.setAttribute("viewBox", "0 0 100 100");
		svg.setAttribute("preserveAspectRatio", "none");

		var connections = [
			[0, 1],
			[0, 3],
			[1, 4],
			[2, 3],
			[3, 4],
			[3, 5],
			[3, 6],
			[5, 6]
		];

		connections.forEach(function (conn) {
			var start = PHOTOS[conn[0]];
			var end = PHOTOS[conn[1]];
			var x1 = start.x,
				y1 = start.y;
			var x2 = end.x,
				y2 = end.y;

			var path = document.createElementNS(svgNS, "path");
			var mx = (x1 + x2) / 2 + (Math.random() * 10 - 5);
			var my = (y1 + y2) / 2 + (Math.random() * 8 - 4);
			var d =
				"M " +
				x1 +
				" " +
				y1 +
				" Q " +
				mx +
				" " +
				my +
				" " +
				x2 +
				" " +
				y2;
			path.setAttribute("d", d);
			path.setAttribute("fill", "none");
			path.setAttribute("stroke", "#8B3A3A");
			path.setAttribute("stroke-width", "0.8");
			path.setAttribute("stroke-linecap", "round");
			path.setAttribute("opacity", "0.9");
			svg.appendChild(path);
		});

		var felt = document.querySelector(".board-felt");
		var photos = document.getElementById("boardPhotos");
		felt.insertBefore(svg, photos);
	}

	/* ---------------------------------------------------------------------
     3. FOCUS MODE
     --------------------------------------------------------------------- */
	function focusPhoto(index, el, data) {
		if (state !== STATE.BOARD || isTransitioning) return;

		isTransitioning = true;
		state = STATE.FOCUSING;
		selectedPhoto = index;
		currentFocusedPhoto = el;

		var allPhotos = photosHost.querySelectorAll(".board-photo");
		allPhotos.forEach(function (btn) {
			btn.style.pointerEvents = "none";
		});
		el.style.pointerEvents = "auto";

		boardScene.classList.add("is-focus");
		if (boardFrame) boardFrame.style.overflow = "visible";

		var rect = el.getBoundingClientRect();
		var viewportW = window.innerWidth;
		var viewportH = window.innerHeight;
		var scale =
			Math.max(viewportW / rect.width, viewportH / rect.height) * 1.02;

		var currentCenterX = rect.left + rect.width / 2;
		var currentCenterY = rect.top + rect.height / 2;
		var dx = viewportW / 2 - currentCenterX;
		var dy = viewportH / 2 - currentCenterY;

		el.style.transition = "transform 0.8s cubic-bezier(0.22, 0.8, 0.2, 1)";
		el.classList.add("is-fullscreen");
		el.style.transform =
			"translate(-50%, -50%) translate(" +
			dx +
			"px," +
			dy +
			"px) rotate(0deg) scale(" +
			scale +
			")";

		if (transitionTimeout) clearTimeout(transitionTimeout);
		transitionTimeout = setTimeout(function () {
			if (state === STATE.FOCUSING) {
				completeFocus();
			}
		}, 900);

		function onTransitionEnd(event) {
			if (event.propertyName === "transform" && event.target === el) {
				el.removeEventListener("transitionend", onTransitionEnd);
				completeFocus();
			}
		}
		el.addEventListener("transitionend", onTransitionEnd);
	}

	function completeFocus() {
		state = STATE.FOCUS;
		isTransitioning = false;
		if (transitionTimeout) {
			clearTimeout(transitionTimeout);
			transitionTimeout = null;
		}
		document.dispatchEvent(
			new CustomEvent("psk:photo-focused", {
				detail: { index: selectedPhoto }
			})
		);

		// ============================================================
		// NAVIGASI KE PRESENT.HTML — HANYA UNTUK FOTO PERTAMA (INDEX 0)
		// ============================================================
		if (selectedPhoto === INTERACTIVE_INDEX) {
			// Buat overlay fade sederhana (tanpa bergantung CSS eksternal)
			var overlay = document.createElement("div");
			overlay.setAttribute("aria-hidden", "true");
			overlay.style.position = "fixed";
			overlay.style.inset = "0";
			overlay.style.zIndex = "200";
			overlay.style.background = "#000";
			overlay.style.opacity = "0";
			overlay.style.pointerEvents = "none";
			overlay.style.transition = "opacity 600ms ease";
			document.body.appendChild(overlay);

			// Paksa reflow agar transisi berjalan
			void overlay.offsetWidth;
			overlay.style.opacity = "1";

			setTimeout(function () {
				// Pastikan present.html selalu mulai dari Slide 1 saat dibuka dari board,
				// bukan dari slide terakhir yang tersimpan di localStorage.
				try {
					window.localStorage.removeItem("presentation_last_slide");
				} catch (err) {
					/* abaikan jika localStorage tidak tersedia */
				}
				window.location.href = "present.html";
			}, 600);
		}
	}

	/* ---------------------------------------------------------------------
     4. RETURN TO BOARD (modified)
     --------------------------------------------------------------------- */
	function returnToBoard() {
		if (state !== STATE.FOCUS || isTransitioning || !currentFocusedPhoto)
			return;

		isTransitioning = true;
		state = STATE.RETURNING;

		var el = currentFocusedPhoto;

		var allPhotos = photosHost.querySelectorAll(".board-photo");
		allPhotos.forEach(function (btn) {
			btn.style.pointerEvents = "";
		});

		el.style.transition = "transform 0.8s cubic-bezier(0.22, 0.8, 0.2, 1)";
		el.classList.remove("is-fullscreen");
		el.style.transform = "";

		if (transitionTimeout) clearTimeout(transitionTimeout);
		transitionTimeout = setTimeout(function () {
			if (state === STATE.RETURNING) {
				completeReturn();
			}
		}, 900);

		function onTransitionEnd(event) {
			if (event.propertyName === "transform" && event.target === el) {
				el.removeEventListener("transitionend", onTransitionEnd);
				completeReturn();
			}
		}
		el.addEventListener("transitionend", onTransitionEnd);
	}

	function completeReturn(keepLock) {
		if (boardFrame) boardFrame.style.overflow = "hidden";
		boardScene.classList.remove("is-focus");
		if (currentFocusedPhoto) {
			currentFocusedPhoto.style.transition = "";
			currentFocusedPhoto = null;
		}
		selectedPhoto = null;
		state = STATE.BOARD;
		if (!keepLock) {
			isTransitioning = false;
		}
		if (transitionTimeout) {
			clearTimeout(transitionTimeout);
			transitionTimeout = null;
		}
		document.dispatchEvent(new CustomEvent("psk:board-returned"));
	}

	/* ---------------------------------------------------------------------
     BACK BUTTON & ESC (board)
     --------------------------------------------------------------------- */
	if (backBtn) {
		backBtn.addEventListener("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			returnToBoard();
		});
	}

	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && state === STATE.FOCUS) {
			returnToBoard();
		}
	});

	/* ---------------------------------------------------------------------
     LAYOUT & RESIZE
     --------------------------------------------------------------------- */
	function layout() {
		drawFelt();
	}

	var resizeRAF = null;
	window.addEventListener("resize", function () {
		if (resizeRAF) cancelAnimationFrame(resizeRAF);
		resizeRAF = requestAnimationFrame(layout);
	});

	/* ---------------------------------------------------------------------
     REVEAL
     --------------------------------------------------------------------- */
	function fadeOutLensOverlay() {
		var overlay = document.getElementById("lensOverlay");
		if (!overlay) return;
		if (prefersReducedMotion) {
			overlay.classList.remove("is-active");
			overlay.style.removeProperty("--lens-progress");
			return;
		}
		overlay.style.transition = "opacity 900ms ease";
		void overlay.offsetWidth;
		overlay.style.opacity = "0";
		setTimeout(function () {
			overlay.classList.remove("is-active");
			overlay.style.transition = "";
			overlay.style.opacity = "";
			overlay.style.removeProperty("--lens-progress");
		}, 950);
	}

	document.addEventListener("psk:board-reveal", function () {
		if (revealed) return;
		revealed = true;

		buildPhotos();
		createRedStrings();
		boardScene.style.display = "flex";
		void boardScene.offsetWidth;

		requestAnimationFrame(function () {
			layout();
			boardScene.classList.add("is-visible");
			state = STATE.BOARD;
			fadeOutLensOverlay();
		});
	});
})();
