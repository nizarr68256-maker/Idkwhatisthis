/* ==========================================================================
   SLIDE 7 — closing "MENGHADAPI GLOBALISASI".

   Dua tanggung jawab file ini:
   1) Memicu urutan kemunculan 5 panel (kiri->kanan) lewat satu class
      "s7-is-revealing" di #slide7Scene — animasi sesungguhnya murni CSS.
   2) Bumi 3D — SATU-SATUNYA render loop Three.js di present.html. Three.js
      dimuat via dynamic import() HANYA saat Slide 7 pertama kali aktif.
      Loop dihentikan setiap kali Slide 7 tidak aktif atau tab disembunyikan.

   REVISI v4 — cinematic framing:
   - camera.position.z = 6.2 (radius 1.35, FOV 30° -> angular radius
     12.58° < half-FOV 15° → margin ~17% tiap sisi, tidak terpotong).
   - Lighting: ambient lebih gelap, directional lebih hangat & kuat.

   REVISI v11 — idempotent enter + MutationObserver fallback.

   REVISI v12 — fix intermittent blank (animasi CSS tidak play saat
   section masih display:none).
   - startReveal() sekarang menunggu computed display section != "none"
     sebelum memicu .s7-is-revealing. Ini krusial: CSS Animation TIDAK
     berjalan pada element display:none, dan jika class dipasang saat
     section masih hidden, animasi dianggap "sudah dikonsumsi" dan
     tidak restart saat section menjadi visible — panel stuck di
     opacity: 0 (slide tampak kosong).
   - Loop rAF dengan timeout ~1.5s sebagai jaring pengaman kalau
     section tidak pernah menjadi visible (fallback: tetap coba reveal).

   Tidak ada perubahan pada: model, texture, radius, rotasi, cloud layer,
   atmosphere shader, resize observer, visibility handling, star field,
   posisi panel, warna panel, animasi keyframes.
   ========================================================================== */

(function () {
	"use strict";

	var section = document.getElementById("slide7Scene");
	if (!section) return;

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	/* ---------------------------------------------------------------------
	   1. REVEAL 5 PANEL — toggle satu class, sisanya murni CSS.

	   PENTING: menunggu section punya computed display != "none"
	   sebelum memicu animasi, karena CSS Animation tidak dijalankan
	   pada element display:none — kalau dipaksa, animasi "terbuang"
	   dan panel stuck di opacity: 0.
	   --------------------------------------------------------------------- */
	var revealRafId = null;

	function isSectionVisible() {
		// Cek computed display. Kalau "none", section belum punya layout
		// dan CSS Animation tidak akan jalan.
		try {
			return window.getComputedStyle(section).display !== "none";
		} catch (e) {
			// Kalau getComputedStyle gagal (jarang), anggap visible
			// dan lanjut — lebih baik animasi jalan daripada stuck.
			return true;
		}
	}

	function startReveal() {
		// Reset state: lepas class reveal + batalkan loop sebelumnya.
		section.classList.remove("s7-is-revealing");
		if (revealRafId) {
			cancelAnimationFrame(revealRafId);
			revealRafId = null;
		}

		if (prefersReducedMotion) {
			// Media query reduced-motion sudah memaksa opacity:1 &
			// animation:none; cukup tambah class supaya konten tampil.
			section.classList.add("s7-is-revealing");
			return;
		}

		var MAX_ATTEMPTS = 90; // ~1.5s @60fps
		var attempts = 0;

		function tryReveal() {
			attempts++;

			if (isSectionVisible() || attempts >= MAX_ATTEMPTS) {
				// Section sudah punya layout (atau timeout). Paksa reflow
				// supaya browser register base state (opacity: 0) sebelum
				// menambah class pemicu animasi di frame berikutnya.
				void section.offsetWidth;
				revealRafId = requestAnimationFrame(function () {
					revealRafId = null;
					section.classList.add("s7-is-revealing");
				});
				return;
			}

			revealRafId = requestAnimationFrame(tryReveal);
		}

		revealRafId = requestAnimationFrame(tryReveal);
	}

	/* ---------------------------------------------------------------------
	   2. BUMI 3D — lazy init, satu render loop, pause saat tidak relevan.
	   --------------------------------------------------------------------- */
	var earthWrap = document.getElementById("s7EarthWrap");
	var earthCanvas = document.getElementById("s7EarthCanvas");

	var earthInitStarted = false;
	var earthReady = false;
	var isSlideActive = false;

	var renderer = null;
	var scene = null;
	var camera = null;
	var earthGroup = null;
	var earthMesh = null;
	var cloudMesh = null;
	var resizeObserver = null;
	var rafId = null;
	var lastFrameTime = null;

	var ROTATION_RAD_PER_SEC = (Math.PI * 2) / 150;
	var CLOUD_ROTATION_RAD_PER_SEC = ROTATION_RAD_PER_SEC * 1.5;

	function showFallbackSphere() {
		if (earthWrap) earthWrap.classList.add("s7-earth--fallback");
	}

	function sizeRenderer() {
		if (!renderer || !camera || !earthWrap) return;
		var w = earthWrap.clientWidth;
		var h = earthWrap.clientHeight;
		if (w < 2 || h < 2) return;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		if (prefersReducedMotion && earthReady) renderOneFrame();
	}

	function renderOneFrame() {
		if (renderer && scene && camera) renderer.render(scene, camera);
	}

	function animateEarth(now) {
		if (!isSlideActive || document.hidden) {
			rafId = null;
			return;
		}
		if (lastFrameTime === null) lastFrameTime = now;
		var delta = (now - lastFrameTime) / 1000;
		lastFrameTime = now;
		if (delta > 0.25) delta = 0.25;

		earthMesh.rotation.y += delta * ROTATION_RAD_PER_SEC;
		if (cloudMesh)
			cloudMesh.rotation.y += delta * CLOUD_ROTATION_RAD_PER_SEC;
		renderer.render(scene, camera);
		rafId = requestAnimationFrame(animateEarth);
	}

	function startEarthLoop() {
		if (!earthReady) return;
		if (prefersReducedMotion) {
			renderOneFrame();
			return;
		}
		if (rafId) return;
		lastFrameTime = null;
		rafId = requestAnimationFrame(animateEarth);
	}

	function stopEarthLoop() {
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	var EARTH_TEX_BASE =
		"https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/";

	function initEarth() {
		if (earthInitStarted || !earthCanvas || !earthWrap) return;
		earthInitStarted = true;

		import("https://unpkg.com/three@0.160.1/build/three.module.js")
			.then(function (THREE) {
				renderer = new THREE.WebGLRenderer({
					canvas: earthCanvas,
					antialias: true,
					alpha: true,
					powerPreference: "low-power"
				});
				renderer.setPixelRatio(
					Math.min(window.devicePixelRatio || 1, 2)
				);
				renderer.setClearColor(0x000000, 0);

				scene = new THREE.Scene();

				camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
				camera.position.set(0, 0, 6.2);

				var RADIUS = 1.35;

				earthGroup = new THREE.Group();
				earthGroup.rotation.z = (-8 * Math.PI) / 180;
				earthGroup.rotation.y = Math.PI * 0.15;
				scene.add(earthGroup);

				var textureLoader = new THREE.TextureLoader();
				textureLoader.crossOrigin = "anonymous";

				var loadedCount = 0;
				var TOTAL_TEX = 3;
				function textureReady() {
					loadedCount += 1;
					if (loadedCount >= TOTAL_TEX) {
						earthWrap.classList.add("s7-earth--ready");
					}
				}
				setTimeout(function () {
					earthWrap.classList.add("s7-earth--ready");
				}, 2500);

				var dayMap = textureLoader.load(
					EARTH_TEX_BASE + "earth_atmos_2048.jpg",
					textureReady,
					undefined,
					textureReady
				);
				var specularMap = textureLoader.load(
					EARTH_TEX_BASE + "earth_specular_2048.jpg",
					textureReady,
					undefined,
					textureReady
				);
				var cloudsMap = textureLoader.load(
					EARTH_TEX_BASE + "earth_clouds_1024.png",
					textureReady,
					undefined,
					textureReady
				);
				dayMap.colorSpace = THREE.SRGBColorSpace;

				var earthMaterial = new THREE.MeshPhongMaterial({
					map: dayMap,
					specularMap: specularMap,
					specular: new THREE.Color(0x2a3040),
					shininess: 9
				});
				earthMesh = new THREE.Mesh(
					new THREE.SphereGeometry(RADIUS, 64, 64),
					earthMaterial
				);
				earthGroup.add(earthMesh);

				var cloudMaterial = new THREE.MeshPhongMaterial({
					map: cloudsMap,
					transparent: true,
					opacity: 0.55,
					depthWrite: false
				});
				cloudMesh = new THREE.Mesh(
					new THREE.SphereGeometry(RADIUS * 1.008, 64, 64),
					cloudMaterial
				);
				earthGroup.add(cloudMesh);

				var atmosphereMaterial = new THREE.ShaderMaterial({
					vertexShader:
						"varying vec3 vNormal;" +
						"void main() {" +
						"  vNormal = normalize( normalMatrix * normal );" +
						"  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );" +
						"}",
					fragmentShader:
						"varying vec3 vNormal;" +
						"void main() {" +
						"  float rim = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.6);" +
						"  rim = clamp(rim, 0.0, 1.0);" +
						"  vec3 glowColor = vec3(0.35, 0.62, 1.0);" +
						"  gl_FragColor = vec4(glowColor * rim, rim * 0.85);" +
						"}",
					blending: THREE.AdditiveBlending,
					side: THREE.BackSide,
					transparent: true,
					depthWrite: false
				});
				var atmosphereMesh = new THREE.Mesh(
					new THREE.SphereGeometry(RADIUS * 1.16, 64, 64),
					atmosphereMaterial
				);
				scene.add(atmosphereMesh);

				scene.add(new THREE.AmbientLight(0x1a2333, 0.34));
				var sun = new THREE.DirectionalLight(0xfff4e0, 3.7);
				sun.position.set(-3.2, 1.5, 3.9);
				scene.add(sun);

				sizeRenderer();
				earthReady = true;

				if (window.ResizeObserver) {
					resizeObserver = new ResizeObserver(function () {
						sizeRenderer();
					});
					resizeObserver.observe(earthWrap);
				} else {
					window.addEventListener("resize", sizeRenderer);
				}

				if (isSlideActive) startEarthLoop();
			})
			.catch(function () {
				showFallbackSphere();
			});
	}

	document.addEventListener("visibilitychange", function () {
		if (document.hidden) {
			stopEarthLoop();
		} else if (isSlideActive) {
			startEarthLoop();
		}
	});

	/* ---------------------------------------------------------------------
	   3. SINKRONISASI DENGAN NAVIGASI SLIDE.
	   Guard isSlideActive mencegah enterSlide7() dipanggil dua kali.
	   --------------------------------------------------------------------- */
	function enterSlide7() {
		if (isSlideActive) return;
		isSlideActive = true;

		// startReveal() sekarang idempoten & aman dipanggil kapan pun
		// (menunggu section visible sendiri di dalamnya).
		startReveal();

		if (!earthInitStarted) {
			initEarth();
		} else {
			startEarthLoop();
		}
	}

	function leaveSlide7() {
		if (!isSlideActive) return;
		isSlideActive = false;
		stopEarthLoop();
	}

	document.addEventListener("psk:slide-changed", function (e) {
		var target = e && e.detail ? e.detail.slide : null;
		if (target === 7) {
			enterSlide7();
		} else if (isSlideActive) {
			leaveSlide7();
		}
	});

	/* ---------------------------------------------------------------------
	   4. (DIHAPUS) FINAL ENDING SEQUENCE.
	   Blok lama di sini (typewriter Thanks/Yupi + lock nav + listener
	   klik #s7NextBtn) sudah TIDAK dipakai — closing sequence sekarang
	   sepenuhnya menjadi tanggung jawab js/slide8.js (lihat komentar
	   arsitektur di present.html). Blok lama itu masih memasang listener
	   click KEDUA pada #s7NextBtn (selain listener resmi di slide8.js)
	   dan men-set nextBtn.disabled = true tanpa pernah me-reset-nya —
	   inilah root cause instabilitas Slide 7 yang dilaporkan. Dihapus
	   total di sini, TANPA mengganti dengan listener/logic baru apa pun.
	   --------------------------------------------------------------------- */

	// FALLBACK 1: MutationObserver memantau penambahan class .is-active
	// pada #slide7Scene. Kalau present.js menambahkan class itu SETELAH
	// script ini dimuat (race kondisi saat restore slide), event
	// "psk:slide-changed" bisa terlewat — observer ini menangkapnya.
	if (window.MutationObserver) {
		var activeClassObserver = new MutationObserver(function () {
			if (section.classList.contains("is-active") && !isSlideActive) {
				enterSlide7();
			}
		});
		activeClassObserver.observe(section, {
			attributes: true,
			attributeFilter: ["class"]
		});
	}

	// FALLBACK 2: cek langsung apakah section ini sudah ".is-active" saat
	// script dimuat (mis. restore dari localStorage yang terjadi sebelum
	// script ini jalan).
	if (section.classList.contains("is-active")) {
		enterSlide7();
	}
})();
