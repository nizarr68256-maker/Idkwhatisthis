/* ==========================================================================
   PERUBAHAN SOSIAL KONTEMPORER — Scene 0 (Opening) + Transisi ke Board
   TIDAK DIUBAH dari versi sebelumnya. File ini hanya di-load oleh
   index.html. Ia tidak tahu apa-apa tentang present.html/Slide 1-7 —
   satu-satunya "jembatan" keluar dari file ini adalah event DOM
   'psk:board-reveal' yang ditangkap oleh js/board.js.
   ========================================================================== */

import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";

window.startTransition = function startTransition() {
	console.warn("[startTransition] belum siap — scene masih memuat.");
};

(function () {
	"use strict";

	var canvas = document.getElementById("gl");
	var fallback = document.getElementById("wallFallback");
	var titleBlock = document.getElementById("titleBlock");
	var overlay = document.getElementById("lensOverlay");
	var openingScene = document.getElementById("scene");
	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	var renderer;
	try {
		renderer = new THREE.WebGLRenderer({
			canvas: canvas,
			antialias: true,
			alpha: false
		});
	} catch (err) {
		showFallback();
		return;
	}
	if (!renderer) {
		showFallback();
		return;
	}

	function showFallback() {
		if (fallback) fallback.classList.add("is-visible");
		if (canvas) canvas.style.display = "none";
	}

	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	var scene = new THREE.Scene();
	scene.background = new THREE.Color(0x0a0806);

	var camera = new THREE.PerspectiveCamera(
		42,
		window.innerWidth / window.innerHeight,
		0.1,
		100
	);
	var camBase = new THREE.Vector3(0, 0.2, 14);
	camera.position.copy(camBase);
	camera.lookAt(0, 0.2, 0);

	function buildWallTextures() {
		var w = 1536,
			h = 640;
		var canvasD = document.createElement("canvas");
		canvasD.width = w;
		canvasD.height = h;
		var ctx = canvasD.getContext("2d");

		var grad = ctx.createRadialGradient(
			w * 0.5,
			h * 0.35,
			40,
			w * 0.5,
			h * 0.5,
			w * 0.7
		);
		grad.addColorStop(0, "#f6f1e6");
		grad.addColorStop(0.6, "#ece5d6");
		grad.addColorStop(1, "#dad1bd");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);

		var imgData = ctx.getImageData(0, 0, w, h);
		var d = imgData.data;
		for (var i = 0; i < d.length; i += 4) {
			var n = (Math.random() - 0.5) * 14;
			d[i] = clamp255(d[i] + n);
			d[i + 1] = clamp255(d[i + 1] + n);
			d[i + 2] = clamp255(d[i + 2] + n * 0.9);
		}
		ctx.putImageData(imgData, 0, 0);

		for (var s = 0; s < 900; s++) {
			var sx = Math.random() * w,
				sy = Math.random() * h;
			var r = Math.random() * 1.1 + 0.2;
			ctx.beginPath();
			ctx.fillStyle =
				"rgba(30,26,20," + (Math.random() * 0.18 + 0.04) + ")";
			ctx.arc(sx, sy, r, 0, Math.PI * 2);
			ctx.fill();
		}

		for (var b = 0; b < 10; b++) {
			var bx = Math.random() * w,
				by = Math.random() * h;
			var br = 60 + Math.random() * 140;
			var bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
			bg.addColorStop(
				0,
				"rgba(90,80,64," + (Math.random() * 0.05 + 0.02) + ")"
			);
			bg.addColorStop(1, "rgba(90,80,64,0)");
			ctx.fillStyle = bg;
			ctx.fillRect(bx - br, by - br, br * 2, br * 2);
		}

		for (var l = 0; l < 26; l++) {
			var lx = Math.random() * w,
				ly = Math.random() * h;
			var len = 10 + Math.random() * 40;
			var ang = Math.random() * Math.PI;
			ctx.strokeStyle =
				"rgba(" +
				(Math.random() > 0.5 ? "255,255,250," : "20,16,10,") +
				(Math.random() * 0.06 + 0.02) +
				")";
			ctx.lineWidth = 0.6;
			ctx.beginPath();
			ctx.moveTo(lx, ly);
			ctx.lineTo(lx + Math.cos(ang) * len, ly + Math.sin(ang) * len);
			ctx.stroke();
		}

		var diffuse = new THREE.CanvasTexture(canvasD);
		diffuse.colorSpace = THREE.SRGBColorSpace;
		diffuse.anisotropy = 4;

		var canvasB = document.createElement("canvas");
		canvasB.width = w;
		canvasB.height = h;
		var ctxB = canvasB.getContext("2d");
		ctxB.fillStyle = "#808080";
		ctxB.fillRect(0, 0, w, h);
		var bImg = ctxB.getImageData(0, 0, w, h);
		var bd = bImg.data;
		for (var j = 0; j < bd.length; j += 4) {
			var g = 128 + (Math.random() - 0.5) * 60;
			bd[j] = bd[j + 1] = bd[j + 2] = g;
		}
		ctxB.putImageData(bImg, 0, 0);
		var bump = new THREE.CanvasTexture(canvasB);

		return { diffuse: diffuse, bump: bump };
	}

	function clamp255(v) {
		return v < 0 ? 0 : v > 255 ? 255 : v;
	}

	var wallTex = buildWallTextures();
	var wallGeo = new THREE.PlaneGeometry(46, 20, 1, 1);
	var wallMat = new THREE.MeshStandardMaterial({
		map: wallTex.diffuse,
		bumpMap: wallTex.bump,
		bumpScale: 0.02,
		roughness: 0.92,
		metalness: 0.0
	});
	var wall = new THREE.Mesh(wallGeo, wallMat);
	wall.receiveShadow = true;
	wall.position.z = 0;
	scene.add(wall);

	var lampPivot = new THREE.Group();
	lampPivot.position.set(0, 7.0, 1.4);
	scene.add(lampPivot);

	var lamp = new THREE.Group();
	lamp.position.set(0, -7.0, 0);
	lampPivot.add(lamp);

	var cordMat = new THREE.MeshStandardMaterial({
		color: 0x1c1712,
		roughness: 0.6,
		metalness: 0.2
	});
	var cordGeo = new THREE.CylinderGeometry(0.02, 0.02, 3.6, 8);
	var cord = new THREE.Mesh(cordGeo, cordMat);
	cord.position.y = 7.0;
	lamp.add(cord);

	var canopyGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.22, 16);
	var metalMat = new THREE.MeshStandardMaterial({
		color: 0x2b2118,
		roughness: 0.45,
		metalness: 0.55
	});
	var canopy = new THREE.Mesh(canopyGeo, metalMat);
	canopy.position.y = 5.15;
	canopy.castShadow = true;
	lamp.add(canopy);

	var shadePts = [
		new THREE.Vector2(0.05, 0.05),
		new THREE.Vector2(0.22, 0.0),
		new THREE.Vector2(0.35, -0.18),
		new THREE.Vector2(0.62, -0.55),
		new THREE.Vector2(0.9, -0.95),
		new THREE.Vector2(0.98, -1.0)
	];
	var shadeGeo = new THREE.LatheGeometry(shadePts, 32);
	var shadeMat = new THREE.MeshStandardMaterial({
		color: 0x241c14,
		roughness: 0.55,
		metalness: 0.35,
		side: THREE.DoubleSide
	});
	var shade = new THREE.Mesh(shadeGeo, shadeMat);
	shade.position.y = 5.0;
	shade.castShadow = true;
	lamp.add(shade);

	var bulbMat = new THREE.MeshStandardMaterial({
		color: 0xfff2d6,
		emissive: 0xffce85,
		emissiveIntensity: 0,
		roughness: 0.3,
		metalness: 0.0
	});
	var bulbGeo = new THREE.SphereGeometry(0.16, 20, 16);
	var bulb = new THREE.Mesh(bulbGeo, bulbMat);
	bulb.position.y = 3.95;
	lamp.add(bulb);

	var BASE_AMBIENT_INTENSITY = 1.3;
	var BASE_HEMI_INTENSITY = 1.15;

	var ambient = new THREE.AmbientLight(0x2a2a30, BASE_AMBIENT_INTENSITY);
	scene.add(ambient);

	var hemi = new THREE.HemisphereLight(
		0x554433,
		0x0a0806,
		BASE_HEMI_INTENSITY
	);
	scene.add(hemi);

	var spot = new THREE.SpotLight(0xffd9a8, 0, 60, Math.PI / 3.0, 0.8, 1.6);
	spot.position.set(0, 3.95, 1.6);
	spot.target.position.set(0, 0.4, 0);
	spot.castShadow = true;
	spot.shadow.mapSize.set(1024, 1024);
	spot.shadow.bias = -0.0015;
	scene.add(spot);
	scene.add(spot.target);

	var bulbLight = new THREE.PointLight(0xffcf9a, 0, 15, 2);
	bulbLight.position.set(0, 3.95, 1.6);
	scene.add(bulbLight);

	var STABLE_SPOT_INTENSITY = 6.5;
	var STABLE_POINT_INTENSITY = 2.0;
	var STABLE_EMISSIVE = 1.3;

	var magnifier = new THREE.Group();
	var magnifierBaseY = -0.6;
	magnifier.position.set(0, magnifierBaseY, 2.2);
	magnifier.userData.isMagnifier = true;

	var frameMat = new THREE.MeshStandardMaterial({
		color: 0x9b7a4a,
		roughness: 0.32,
		metalness: 0.75
	});
	var frameGeo = new THREE.TorusGeometry(0.62, 0.055, 20, 48);
	var frame = new THREE.Mesh(frameGeo, frameMat);
	magnifier.add(frame);

	var lensMat = new THREE.MeshPhysicalMaterial({
		color: 0xbcd6e0,
		transparent: true,
		opacity: 0.24,
		roughness: 0.06,
		metalness: 0.0,
		clearcoat: 1.0,
		clearcoatRoughness: 0.04,
		ior: 1.5,
		side: THREE.DoubleSide
	});
	var lensGeo = new THREE.CircleGeometry(0.56, 40);
	var lens = new THREE.Mesh(lensGeo, lensMat);
	lens.position.z = 0.01;
	magnifier.add(lens);

	var attachAngle = -0.8727;
	var dirX = Math.cos(attachAngle);
	var dirY = Math.sin(attachAngle);
	var chainRot = Math.PI / 2 + attachAngle;

	var connectorGeo = new THREE.CylinderGeometry(0.09, 0.075, 0.16, 16);
	var connector = new THREE.Mesh(connectorGeo, frameMat);
	var embedRadius = 0.585;
	var connectorMidRadius = embedRadius + 0.16 / 2;
	connector.position.set(
		connectorMidRadius * dirX,
		connectorMidRadius * dirY,
		0
	);
	connector.rotation.z = chainRot;
	magnifier.add(connector);

	var handleMat = new THREE.MeshStandardMaterial({
		color: 0x3a2a1a,
		roughness: 0.6,
		metalness: 0.15
	});
	var handleLength = 0.8;
	var handleGeo = new THREE.CylinderGeometry(0.07, 0.06, handleLength, 14);
	var handle = new THREE.Mesh(handleGeo, handleMat);
	var connectorOuterRadius = embedRadius + 0.16;
	var handleMidRadius = connectorOuterRadius + handleLength / 2;
	handle.position.set(handleMidRadius * dirX, handleMidRadius * dirY, 0);
	handle.rotation.z = chainRot;
	magnifier.add(handle);

	[frame, lens, connector, handle].forEach(function (m) {
		m.castShadow = true;
		m.userData.isMagnifier = true;
	});

	scene.add(magnifier);

	function createPaperTexture(texts, baseColor) {
		baseColor = baseColor || "#f5f0e6";
		var size = 512;
		var canvasP = document.createElement("canvas");
		canvasP.width = size;
		canvasP.height = size;
		var ctx = canvasP.getContext("2d");

		ctx.fillStyle = baseColor;
		ctx.fillRect(0, 0, size, size);

		for (var i = 0; i < 3000; i++) {
			ctx.fillStyle =
				"rgba(0,0,0," + (Math.random() * 0.04).toFixed(3) + ")";
			ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
		}
		for (var j = 0; j < 800; j++) {
			ctx.fillStyle =
				"rgba(255,255,255," + (Math.random() * 0.06).toFixed(3) + ")";
			ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
		}

		ctx.strokeStyle = "rgba(60,50,40,0.35)";
		ctx.lineWidth = 2;
		for (var k = 0; k < 6; k++) {
			ctx.beginPath();
			var sx = 50 + Math.random() * (size - 100);
			var sy = 50 + Math.random() * (size - 100);
			ctx.moveTo(sx, sy);
			ctx.lineTo(
				sx + (Math.random() - 0.5) * 160,
				sy + (Math.random() - 0.5) * 160
			);
			ctx.stroke();
		}

		if (texts && texts.length) {
			ctx.font = "bold 24px 'Jost', sans-serif";
			ctx.fillStyle = "rgba(30,30,30,0.55)";
			texts.forEach(function (text, idx) {
				ctx.fillText(text, 30, 60 + idx * 36);
			});
		}

		var tex = new THREE.CanvasTexture(canvasP);
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}

	function createPaperClip(color) {
		color = color === undefined ? 0xcccccc : color;
		var group = new THREE.Group();
		var mMat = new THREE.MeshStandardMaterial({
			color: color,
			roughness: 0.25,
			metalness: 0.9
		});

		var loop1 = new THREE.Mesh(
			new THREE.TorusGeometry(0.12, 0.02, 8, 24),
			mMat
		);
		loop1.position.set(0, 0.08, 0);
		group.add(loop1);

		var loop2 = new THREE.Mesh(
			new THREE.TorusGeometry(0.09, 0.02, 8, 20),
			mMat
		);
		loop2.position.set(0, -0.1, 0);
		group.add(loop2);

		var connGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6);
		var conn = new THREE.Mesh(connGeo, mMat);
		conn.position.set(0, 0, 0);
		conn.rotation.z = Math.PI / 2;
		group.add(conn);

		return group;
	}

	function createPencil() {
		var group = new THREE.Group();

		var bodyGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
		var bodyMat = new THREE.MeshStandardMaterial({
			color: 0xf2c94c,
			roughness: 0.5,
			metalness: 0.0
		});
		var body = new THREE.Mesh(bodyGeo, bodyMat);
		body.position.y = 0.3;
		group.add(body);

		var tipGeo = new THREE.ConeGeometry(0.04, 0.12, 8);
		var tipMat = new THREE.MeshStandardMaterial({
			color: 0x8b5a2b,
			roughness: 0.5,
			metalness: 0.0
		});
		var tip = new THREE.Mesh(tipGeo, tipMat);
		tip.position.y = 0.66;
		group.add(tip);

		var graphiteGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6);
		var graphiteMat = new THREE.MeshStandardMaterial({
			color: 0x2b2b2b,
			roughness: 0.2,
			metalness: 0.1
		});
		var graphite = new THREE.Mesh(graphiteGeo, graphiteMat);
		graphite.position.y = 0.74;
		group.add(graphite);

		var eraserGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8);
		var eraserMat = new THREE.MeshStandardMaterial({
			color: 0xe0a0a0,
			roughness: 0.8,
			metalness: 0.0
		});
		var eraser = new THREE.Mesh(eraserGeo, eraserMat);
		eraser.position.y = -0.04;
		group.add(eraser);

		return group;
	}

	function createStickyNote(baseColor) {
		baseColor = baseColor || "#fef9c3";
		var size = 256;
		var canvasS = document.createElement("canvas");
		canvasS.width = size;
		canvasS.height = size;
		var ctx = canvasS.getContext("2d");

		ctx.fillStyle = baseColor;
		ctx.fillRect(0, 0, size, size);

		for (var i = 0; i < 800; i++) {
			ctx.fillStyle =
				"rgba(0,0,0," + (Math.random() * 0.03).toFixed(3) + ")";
			ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
		}

		var tex = new THREE.CanvasTexture(canvasS);
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}

	function addMagnifierDecorations() {
		var decorations = new THREE.Group();

		var paperTex1 = createPaperTexture(
			["OBSERVATION", "CASE 01"],
			"#f5f0e6"
		);
		var paper1 = new THREE.Mesh(
			new THREE.PlaneGeometry(1.0, 1.2),
			new THREE.MeshStandardMaterial({
				map: paperTex1,
				roughness: 0.9,
				metalness: 0.0,
				side: THREE.DoubleSide
			})
		);
		paper1.position.set(-1.5, 0.5, 2.1);
		paper1.rotation.set(0.08, -0.05, 0.15);
		decorations.add(paper1);

		var paperTex2 = createPaperTexture(null, "#f0e6d2");
		var paper2 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.9, 1.0),
			new THREE.MeshStandardMaterial({
				map: paperTex2,
				roughness: 0.85,
				metalness: 0.0,
				side: THREE.DoubleSide
			})
		);
		paper2.position.set(1.2, -1.5, 2.05);
		paper2.rotation.set(-0.04, 0.03, -0.1);
		decorations.add(paper2);

		var paperTex3 = createPaperTexture(null, "#f0f4f5");
		var paper3 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.8, 0.9),
			new THREE.MeshStandardMaterial({
				map: paperTex3,
				roughness: 0.9,
				metalness: 0.0,
				side: THREE.DoubleSide
			})
		);
		paper3.position.set(-0.9, -2.0, 2.15);
		paper3.rotation.set(0.06, 0.04, 0.2);
		decorations.add(paper3);

		var paperTex4 = createPaperTexture(null, "#faf3d7");
		var paper4 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.8, 0.85),
			new THREE.MeshStandardMaterial({
				map: paperTex4,
				roughness: 0.88,
				metalness: 0.0,
				side: THREE.DoubleSide
			})
		);
		paper4.position.set(0.6, 1.2, 2.08);
		paper4.rotation.set(-0.05, 0.02, 0.1);
		decorations.add(paper4);

		var stickyTex1 = createStickyNote("#fef9c3");
		var sticky1 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.4, 0.4),
			new THREE.MeshStandardMaterial({
				map: stickyTex1,
				roughness: 0.9,
				metalness: 0.0,
				side: THREE.DoubleSide
			})
		);
		sticky1.position.set(-1.8, -0.8, 2.12);
		sticky1.rotation.set(0.1, 0.02, -0.3);
		decorations.add(sticky1);

		var stickyTex2 = createStickyNote("#fde2e4");
		var sticky2 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.4, 0.4),
			new THREE.MeshStandardMaterial({
				map: stickyTex2,
				roughness: 0.9,
				metalness: 0.0,
				side: THREE.DoubleSide
			})
		);
		sticky2.position.set(1.3, 0.4, 2.14);
		sticky2.rotation.set(0.07, -0.03, 0.4);
		decorations.add(sticky2);

		var clip1 = createPaperClip(0xd4af37);
		clip1.position.set(-1.2, 0.8, 2.12);
		clip1.rotation.set(0, 0, 0.5);
		decorations.add(clip1);

		var clip2 = createPaperClip(0xc0c0c0);
		clip2.position.set(1.4, -1.3, 2.08);
		clip2.rotation.set(0, 0, -0.3);
		decorations.add(clip2);

		var clip3 = createPaperClip(0xb87333);
		clip3.position.set(-0.5, 1.4, 2.1);
		clip3.rotation.set(0, 0, 0.7);
		decorations.add(clip3);

		var pencil1 = createPencil();
		pencil1.position.set(1.5, 0.8, 2.1);
		pencil1.rotation.set(0.1, 0, -0.8);
		decorations.add(pencil1);

		var pencil2 = createPencil();
		pencil2.position.set(-1.3, -1.6, 2.14);
		pencil2.rotation.set(-0.05, 0.1, 1.2);
		decorations.add(pencil2);

		scene.add(decorations);
		return decorations;
	}

	function addPhotoDecorations() {
		var photoDecorations = new THREE.Group();

		var note1 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.6, 0.7),
			new THREE.MeshStandardMaterial({
				map: createPaperTexture(null, "#f5f0e6"),
				roughness: 0.9,
				metalness: 0.0,
				side: THREE.DoubleSide
			})
		);
		note1.position.set(-7.5, 2.5, 1.5);
		note1.rotation.set(0.05, 0.02, 0.2);
		photoDecorations.add(note1);

		var clipPhoto1 = createPaperClip(0xcccccc);
		clipPhoto1.position.set(-7.0, 2.8, 1.55);
		clipPhoto1.rotation.set(0, 0, 0.4);
		photoDecorations.add(clipPhoto1);

		var note2 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.5, 0.6),
			new THREE.MeshStandardMaterial({
				map: createStickyNote("#fde2e4"),
				roughness: 0.9,
				metalness: 0.0,
				side: THREE.DoubleSide
			})
		);
		note2.position.set(-6.0, -2.0, 1.5);
		note2.rotation.set(-0.03, -0.01, -0.1);
		photoDecorations.add(note2);

		var note3 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.5, 0.55),
			new THREE.MeshStandardMaterial({
				map: createPaperTexture(null, "#f0f4f5"),
				roughness: 0.9,
				metalness: 0.0,
				side: THREE.DoubleSide
			})
		);
		note3.position.set(6.8, 2.6, 1.5);
		note3.rotation.set(0.04, -0.02, -0.15);
		photoDecorations.add(note3);

		var clipPhoto3 = createPaperClip(0xd4af37);
		clipPhoto3.position.set(7.2, 2.9, 1.55);
		clipPhoto3.rotation.set(0, 0, -0.3);
		photoDecorations.add(clipPhoto3);

		var note4 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.5, 0.6),
			new THREE.MeshStandardMaterial({
				map: createStickyNote("#fef9c3"),
				roughness: 0.9,
				metalness: 0.0,
				side: THREE.DoubleSide
			})
		);
		note4.position.set(5.5, -2.5, 1.5);
		note4.rotation.set(0.06, 0.03, 0.2);
		photoDecorations.add(note4);

		scene.add(photoDecorations);
		return photoDecorations;
	}

	var magnifierDecorations = addMagnifierDecorations();
	var photoDecorations = addPhotoDecorations();

	/* ======================================================================
	   4 FOTO ANGGOTA — "WANTED" PAPERS (3D, MENEMPEL DI DINDING)
	   Menggantikan 4 <figure class="photo"> HTML/CSS yang lama. Desain visual
	   (kertas polaroid + caption nama) dipertahankan, hanya dipindah menjadi
	   mesh Three.js supaya terasa sebagai objek fisik di dinding. Memakai
	   scene/camera/renderer/render-loop yang SUDAH ADA — tidak membuat
	   renderer/scene/camera/loop baru.
	   ====================================================================== */

	var wantedMembers = [
		{ src: "img/alpa.jpg", name: "(29)Alva" },
		{ src: "img/nizar.png", name: "(24)Nizar" },
		{ src: "img/sesil.jpg", name: "(19)sisil" },
		{ src: "img/alpin.jpg", name: "(25)alvin" },
		{ src: "img/lynuxs.jpg", name: "Lynuxs" }
	];

	// Posisi dihitung dari proyeksi kamera supaya kira-kira menempati area
	// yang sama dengan tata letak CSS lama (2 kiri atas/bawah, 2 kanan
	// atas/bawah, tengah tetap kosong untuk judul + magnifier).
	// Ukuran dinaikkan ~1.35x dari revisi sebelumnya (permintaan: foto lebih
	// besar/terbaca dari jarak jauh); posisi vertikal (y) digeser sedikit
	// menjauh dari pasangannya di sisi yang sama supaya kertas yang membesar
	// tidak saling bertumpuk — posisi horizontal (x) & rotasi tetap sama.
	var wantedLayout = [
		{
			x: -7.46,
			y: 0.78,
			w: 2.43,
			h: 3.51,
			rot: -0.07,
			yaw: 0.035,
			z: 0.07
		},
		{
			x: -5.87,
			y: -2.72,
			w: 2.15,
			h: 3.11,
			rot: 0.05,
			yaw: -0.02,
			z: 0.09
		},
		{ x: 7.28, y: 0.99, w: 2.43, h: 3.51, rot: 0.06, yaw: -0.03, z: 0.075 },
		{
			x: 5.75,
			y: -2.52,
			w: 1.94,
			h: 2.81,
			rot: -0.05,
			yaw: 0.018,
			z: 0.085
		},
		// Lynuxs — tengah horizontal (x:0), bawah (y:-3.6), sedikit lebih
		// kecil agar aman di 16:9 & mobile. Style kertas/WANTED/nama/animate
		// otomatis sama karena dibuat oleh loop yang sama.
		{
			x: 0,
			y: -3.6,
			w: 1.8,
			h: 2.55,
			rot: 0.02,
			yaw: 0.01,
			z: 0.095
		}
	];

	function drawImageCover(ctx, img, x, y, w, h) {
		var ir = img.naturalWidth / img.naturalHeight;
		var br = w / h;
		var sx, sy, sw, sh;
		if (ir > br) {
			sh = img.naturalHeight;
			sw = sh * br;
			sx = (img.naturalWidth - sw) / 2;
			sy = 0;
		} else {
			sw = img.naturalWidth;
			sh = sw / br;
			sx = 0;
			sy = (img.naturalHeight - sh) / 2;
		}
		ctx.save();
		try {
			ctx.filter =
				"contrast(1.06) saturate(0.98) brightness(1.24) sepia(0.05)";
		} catch (e) {}
		ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
		ctx.restore();
	}

	function drawSpacedText(ctx, text, cx, y, spacing) {
		var chars = String(text).split("");
		var widths = chars.map(function (ch) {
			return ctx.measureText(ch).width;
		});
		var total =
			widths.reduce(function (a, b) {
				return a + b;
			}, 0) +
			spacing * (chars.length - 1);
		var x = cx - total / 2;
		var prevAlign = ctx.textAlign;
		ctx.textAlign = "left";
		chars.forEach(function (ch, idx) {
			ctx.fillText(ch, x, y);
			x += widths[idx] + spacing;
		});
		ctx.textAlign = prevAlign;
	}

	function createWantedPaperBump() {
		var size = 256;
		var c = document.createElement("canvas");
		c.width = size;
		c.height = size;
		var ctx = c.getContext("2d");
		ctx.fillStyle = "#808080";
		ctx.fillRect(0, 0, size, size);
		var img = ctx.getImageData(0, 0, size, size);
		var d = img.data;
		for (var i = 0; i < d.length; i += 4) {
			var g = 128 + (Math.random() - 0.5) * 40;
			d[i] = d[i + 1] = d[i + 2] = g;
		}
		ctx.putImageData(img, 0, 0);
		return new THREE.CanvasTexture(c);
	}

	var wantedPaperBump = createWantedPaperBump();

	function createWantedPaperTexture(img, name) {
		var W = 600,
			H = 870;
		var c = document.createElement("canvas");
		c.width = W;
		c.height = H;
		var ctx = c.getContext("2d");

		// Dasar kertas
		var grad = ctx.createLinearGradient(0, 0, W, H);
		grad.addColorStop(0, "#f8f3e9");
		grad.addColorStop(0.55, "#f1ebdc");
		grad.addColorStop(1, "#e8e1cf");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, W, H);

		// Butiran/grain kertas fisik
		var i, sx, sy;
		for (i = 0; i < 2600; i++) {
			sx = Math.random() * W;
			sy = Math.random() * H;
			ctx.fillStyle =
				"rgba(0,0,0," + (Math.random() * 0.05).toFixed(3) + ")";
			ctx.fillRect(sx, sy, 1, 1);
		}
		for (i = 0; i < 700; i++) {
			sx = Math.random() * W;
			sy = Math.random() * H;
			ctx.fillStyle =
				"rgba(255,255,255," + (Math.random() * 0.06).toFixed(3) + ")";
			ctx.fillRect(sx, sy, 1, 1);
		}

		// Lipatan halus
		ctx.strokeStyle = "rgba(60,50,40,0.18)";
		ctx.lineWidth = 1.5;
		for (i = 0; i < 4; i++) {
			ctx.beginPath();
			var lx = 40 + Math.random() * (W - 80);
			var ly = 40 + Math.random() * (H - 80);
			ctx.moveTo(lx, ly);
			ctx.lineTo(
				lx + (Math.random() - 0.5) * 200,
				ly + (Math.random() - 0.5) * 140
			);
			ctx.stroke();
		}

		// Area foto (mengikuti gaya polaroid lama: foto di tengah)
		var padding = 42;
		var topGap = 96;
		var bottomGap = 150;
		var pw = W - padding * 2;
		var ph = H - topGap - bottomGap;
		var px = padding;
		var py = topGap;

		if (img) {
			drawImageCover(ctx, img, px, py, pw, ph);
		} else {
			ctx.fillStyle = "#c9c2b0";
			ctx.fillRect(px, py, pw, ph);
		}

		ctx.strokeStyle = "rgba(255,255,255,0.55)";
		ctx.lineWidth = 2;
		ctx.strokeRect(px - 1, py - 1, pw + 2, ph + 2);
		ctx.strokeStyle = "rgba(0,0,0,0.28)";
		ctx.lineWidth = 1.5;
		ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

		// "WANTED" — kecil, vintage, bagian dari kertas fisik
		ctx.save();
		ctx.fillStyle = "rgba(45,34,22,0.78)";
		ctx.textBaseline = "alphabetic";
		ctx.font = "600 44px Jost, 'Helvetica Neue', sans-serif";
		drawSpacedText(ctx, "WANTED", W / 2, 54, 7);
		ctx.strokeStyle = "rgba(45,34,22,0.32)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(W / 2 - 64, 67);
		ctx.lineTo(W / 2 + 64, 67);
		ctx.stroke();
		ctx.restore();

		// Nama anggota — tetap di bawah, terlihat sebagai bagian kertas
		ctx.save();
		ctx.fillStyle = "#3a2e1e";
		ctx.font = "400 40px Jost, 'Helvetica Neue', sans-serif";
		ctx.textBaseline = "alphabetic";
		drawSpacedText(ctx, name, W / 2, H - 62, 2);
		ctx.restore();

		// Kilau "tape" halus di atas — kesan ditempel, bukan overlay UI
		ctx.save();
		ctx.translate(W / 2, 20);
		ctx.rotate(-0.04);
		var tapeGrad = ctx.createLinearGradient(-70, 0, 70, 0);
		tapeGrad.addColorStop(0, "rgba(255,255,255,0.05)");
		tapeGrad.addColorStop(0.5, "rgba(255,255,255,0.22)");
		tapeGrad.addColorStop(1, "rgba(255,255,255,0.05)");
		ctx.fillStyle = tapeGrad;
		ctx.fillRect(-70, -10, 140, 20);
		ctx.restore();

		// Vignette lembut di tepi
		var vg = ctx.createRadialGradient(
			W / 2,
			H / 2,
			H * 0.32,
			W / 2,
			H / 2,
			H * 0.78
		);
		vg.addColorStop(0, "rgba(0,0,0,0)");
		vg.addColorStop(1, "rgba(20,15,8,0.16)");
		ctx.fillStyle = vg;
		ctx.fillRect(0, 0, W, H);

		var tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 4;
		return tex;
	}

	var wantedPapers = [];
	var wantedGroup = new THREE.Group();
	scene.add(wantedGroup);

	// Jumlah subdivisi permukaan kertas: cukup untuk kurva halus tanpa
	// membebani performa (4 kertas x ~9x13 segmen = ringan di GPU manapun).
	var WANTED_SEG_W = 9;
	var WANTED_SEG_H = 13;

	wantedLayout.forEach(function (layout, idx) {
		var group = new THREE.Group();
		// Pivot di tepi atas kertas: bagian bawah yang "ingin terangkat"
		// saat animasi angin, bagian atas tetap menempel/statis.
		group.position.set(layout.x, layout.y + layout.h / 2, layout.z);
		group.rotation.z = layout.rot;
		group.rotation.y = layout.yaw;

		// PlaneGeometry bersubdivisi (bukan BoxGeometry) sehingga permukaan
		// punya banyak vertex yang bisa dideformasi menjadi kurva lembut.
		// BoxGeometry sebelumnya memakai 1 material yang sama di ke-6 sisi,
		// termasuk sisi tipisnya (depth 0.018) — saat kotak itu diputar,
		// sisi tipis itu ikut menampilkan potongan tekstur yang sama,
		// sehingga terlihat seperti kertas "terpotong"/"terbelah". Plane
		// tunggal tidak punya sisi tambahan itu sama sekali.
		var geo = new THREE.PlaneGeometry(
			layout.w,
			layout.h,
			WANTED_SEG_W,
			WANTED_SEG_H
		);
		// Simpan posisi vertex asli (rata/flat) sebagai referensi dasar;
		// setiap frame kita deformasi DARI posisi ini, bukan menumpuk
		// perubahan dari frame sebelumnya.
		var basePositions = geo.attributes.position.array.slice();

		var mat = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			bumpMap: wantedPaperBump,
			bumpScale: 0.006,
			roughness: 0.88,
			metalness: 0.0,
			emissive: new THREE.Color(0xfff1dd),
			emissiveIntensity: 0.3,
			side: THREE.DoubleSide
		});
		var mesh = new THREE.Mesh(geo, mat);
		mesh.position.y = -layout.h / 2;
		mesh.castShadow = true;
		mesh.receiveShadow = false;
		group.add(mesh);

		wantedGroup.add(group);

		wantedPapers.push({
			group: group,
			mesh: mesh,
			basePositions: basePositions,
			w: layout.w,
			h: layout.h,
			baseRotZ: layout.rot,
			baseZ: layout.z,
			phase: idx * 1.7 + Math.random() * 0.6,
			freq1: 0.42 + idx * 0.05 + Math.random() * 0.06,
			freq2: 1.1 + idx * 0.11,
			ampTilt: 0.018 + Math.random() * 0.008,
			ampSway: 0.01 + Math.random() * 0.005,
			ampZ: 0.012 + Math.random() * 0.006
		});

		var img = new Image();
		img.onload = function () {
			var tex = createWantedPaperTexture(img, wantedMembers[idx].name);
			mat.map = tex;
			mat.emissiveMap = tex;
			mat.needsUpdate = true;
		};
		img.onerror = function () {
			var tex = createWantedPaperTexture(null, wantedMembers[idx].name);
			mat.map = tex;
			mat.emissiveMap = tex;
			mat.needsUpdate = true;
		};
		img.src = wantedMembers[idx].src;
	});

	// Deformasi kurva kertas: setiap vertex digeser dari posisi flat
	// aslinya (basePositions) berdasarkan seberapa jauh vertex itu dari
	// tepi atas (titik tempel/pivot). Tepi atas nyaris tidak bergerak,
	// semakin ke bawah & ke tepi kiri/kanan semakin bebas melengkung.
	// Ini menggantikan rotasi kaku satu bidang penuh yang sebelumnya
	// menyebabkan kesan "terpotong".
	function deformWantedPaper(p, tt, gust) {
		var posAttr = p.mesh.geometry.attributes.position;
		var arr = posAttr.array;
		var base = p.basePositions;
		var halfH = p.h / 2;
		var halfW = p.w / 2;

		for (var vi = 0; vi < arr.length; vi += 3) {
			var bx = base[vi];
			var by = base[vi + 1];

			// 0 di tepi atas (titik tempel) -> 1 di tepi bawah (ujung bebas)
			var tNorm = (halfH - by) / p.h;
			// Ease kuadratik: membuat kurva bertahap/lembut, bukan lipatan
			// bergaris tajam, dan memastikan tepi atas praktis diam.
			var ease = tNorm * tNorm;
			var edgeFactor = halfW > 0 ? bx / halfW : 0; // -1..1

			// Sedikit pergeseran fase melintasi lebar kertas supaya kurva
			// terlihat seperti gelombang lembut, bukan engsel lurus.
			var wave = 0.65 + 0.35 * Math.sin(tt * p.freq1 - tNorm * 2.1);

			// Kertas terangkat/melengkung menjauh dari dinding (+Z).
			var zOff = ease * gust * p.ampZ * 5.5 * wave;
			// Sudut/ujung kertas boleh sedikit lebih bebas dari bagian
			// tengah bawah.
			zOff += ease * Math.abs(edgeFactor) * gust * p.ampZ * 2.2;

			// Pergeseran lateral kecil, juga di-ease dari tepi atas supaya
			// tetap menempel di titik pivot.
			var xOff =
				ease *
				Math.sin(tt * p.freq1 * 0.8 + 1.3) *
				p.ampSway *
				p.h *
				0.6;

			arr[vi] = bx + xOff;
			arr[vi + 2] = base[vi + 2] + zOff;
		}

		posAttr.needsUpdate = true;
		p.mesh.geometry.computeVertexNormals();
	}

	function resetWantedPaperFlat(p) {
		var posAttr = p.mesh.geometry.attributes.position;
		var arr = posAttr.array;
		var base = p.basePositions;
		for (var vi = 0; vi < arr.length; vi++) arr[vi] = base[vi];
		posAttr.needsUpdate = true;
		p.mesh.geometry.computeVertexNormals();
	}

	function updateWantedPapers(t) {
		for (var i = 0; i < wantedPapers.length; i++) {
			var p = wantedPapers[i];
			if (prefersReducedMotion) {
				resetWantedPaperFlat(p);
				p.group.rotation.x = 0;
				p.group.rotation.z = p.baseRotZ;
				p.group.position.z = p.baseZ;
				continue;
			}
			var tt = t + p.phase;
			// Amplop hembusan angin: 0 saat tenang, naik ke 1 saat "gust".
			// Sama seperti perilaku asli (Math.max(0, sin(...))) supaya
			// timing hembusan per kertas tidak berubah.
			var gust = Math.max(0, Math.sin(tt * p.freq1));

			deformWantedPaper(p, tt, gust);

			// Sisa gerakan grup dikecilkan jauh (bukan lagi sumber utama
			// animasi) — hanya getaran/jitter sangat halus supaya kertas
			// terasa hidup, sementara lengkungan utama datang dari
			// deformasi permukaan di atas.
			var jitter =
				Math.sin(tt * 9.0) * 0.0008 + Math.sin(tt * 13.4) * 0.0005;
			p.group.rotation.x = jitter;
			p.group.rotation.z =
				p.baseRotZ + Math.sin(tt * p.freq1 * 0.5) * 0.003;
			p.group.position.z = p.baseZ;
		}
	}

	var raycaster = new THREE.Raycaster();
	var pointerNDC = new THREE.Vector2(-10, -10);
	var hovering = false;
	var magTargetScale = 1;
	var interactionLocked = false;

	function setPointerFromEvent(evt) {
		var rect = canvas.getBoundingClientRect();
		var cx =
			(evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
		var cy =
			(evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
		pointerNDC.x = (cx / rect.width) * 2 - 1;
		pointerNDC.y = -(cy / rect.height) * 2 + 1;
	}

	function checkHover() {
		if (interactionLocked) return;
		raycaster.setFromCamera(pointerNDC, camera);
		var hits = raycaster.intersectObjects(
			[frame, lens, connector, handle],
			false
		);
		hovering = hits.length > 0;
		magTargetScale = hovering ? 1.12 : 1;
		canvas.style.cursor = hovering ? "pointer" : "default";
	}

	canvas.addEventListener("pointermove", function (e) {
		setPointerFromEvent(e);
		checkHover();
	});

	canvas.addEventListener("pointerdown", function (e) {
		e.preventDefault();
	});

	canvas.addEventListener("contextmenu", function (e) {
		e.preventDefault();
	});

	canvas.addEventListener("dragstart", function (e) {
		e.preventDefault();
	});

	canvas.addEventListener("click", function (e) {
		e.preventDefault();
		if (interactionLocked) return;
		setPointerFromEvent(e);
		checkHover();
		if (hovering) window.startTransition();
	});

	var roomLightRoot = document.documentElement;
	function setRoomLight(v) {
		roomLightRoot.style.setProperty("--room-light", v.toFixed(3));
	}

	function runLampFlicker() {
		if (prefersReducedMotion) {
			spot.intensity = STABLE_SPOT_INTENSITY;
			bulbLight.intensity = STABLE_POINT_INTENSITY;
			bulbMat.emissiveIntensity = STABLE_EMISSIVE;
			ambient.intensity = BASE_AMBIENT_INTENSITY;
			hemi.intensity = BASE_HEMI_INTENSITY;
			setRoomLight(1);
			return;
		}

		var steps = [
			[0.9, 100],
			[0.05, 120],
			[0.7, 90],
			[0.08, 110],
			[0.5, 80],
			[0.02, 100],
			[0.85, 90],
			[0.3, 80],
			[0.1, 100],
			[0.9, 200],
			[1.0, 300]
		];

		var ROOM_FLOOR = 0.45;

		var t = 0;
		steps.forEach(function (step) {
			t += step[1];
			setTimeout(function () {
				var f = step[0];
				var roomFactor = ROOM_FLOOR + (1 - ROOM_FLOOR) * f;
				spot.intensity = STABLE_SPOT_INTENSITY * f;
				bulbLight.intensity = STABLE_POINT_INTENSITY * f;
				bulbMat.emissiveIntensity = STABLE_EMISSIVE * f;
				ambient.intensity = BASE_AMBIENT_INTENSITY * roomFactor;
				hemi.intensity = BASE_HEMI_INTENSITY * roomFactor;
				setRoomLight(roomFactor);
			}, t);
		});
	}

	var swayTarget = new THREE.Vector3(0, 0.2, 0);
	function applyCameraSway(t) {
		if (prefersReducedMotion) return;
		var x = Math.sin(t * 0.11) * 0.09 + Math.sin(t * 0.037) * 0.03;
		var y = Math.cos(t * 0.085) * 0.07 + Math.sin(t * 0.023) * 0.02;
		var z = camBase.z + Math.sin(t * 0.05) * 0.06;
		camera.position.set(camBase.x + x, camBase.y + y, z);
		camera.lookAt(
			swayTarget.x + x * 0.4,
			swayTarget.y + y * 0.4,
			swayTarget.z
		);
	}

	var titleAnchor3D = new THREE.Vector3(0, 2.9, 1.4);
	var titleProj = new THREE.Vector3();

	function updateTitleAnchor() {
		if (!titleBlock) return;
		titleProj.copy(titleAnchor3D).project(camera);
		var px = (titleProj.x * 0.5 + 0.5) * window.innerWidth;
		var py = (1 - (titleProj.y * 0.5 + 0.5)) * window.innerHeight;
		titleBlock.style.transform =
			"translate3d(" +
			px.toFixed(1) +
			"px," +
			py.toFixed(1) +
			"px,0) translate(-50%,0)";
	}

	function onResize() {
		var w = window.innerWidth,
			h = window.innerHeight;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h);
	}
	window.addEventListener("resize", onResize);

	var clock = new THREE.Clock();
	var transitionActive = false;

	function animate() {
		requestAnimationFrame(animate);
		var t = clock.getElapsedTime();

		if (!transitionActive) {
			applyCameraSway(t);
			var s =
				magnifier.scale.x + (magTargetScale - magnifier.scale.x) * 0.15;
			magnifier.scale.set(s, s, s);
			magnifier.position.y = magnifierBaseY + Math.sin(t * 0.6) * 0.02;
			magnifier.rotation.z = Math.sin(t * 0.3) * 0.02;
		}

		lampPivot.rotation.z =
			Math.sin(t * 0.7) * 0.04 + Math.sin(t * 0.37) * 0.02;
		lampPivot.rotation.x = Math.sin(t * 0.5) * 0.015;

		updateWantedPapers(t);
		updateTitleAnchor();
		renderer.render(scene, camera);
	}

	onResize();
	runLampFlicker();
	animate();

	function easeInCubic(x) {
		return x * x * x;
	}

	function pushThroughLens(onArrive) {
		if (interactionLocked) return;
		interactionLocked = true;
		transitionActive = true;
		canvas.style.cursor = "default";

		if (openingScene) {
			openingScene.classList.add("opening-exit");
		}

		var startCamZ = camera.position.z;
		var lensWorldZ = magnifier.position.z;
		var approachDuration = prefersReducedMotion ? 1 : 900;
		var refractionDuration = prefersReducedMotion ? 1 : 480;
		var startTime = performance.now();

		if (overlay) {
			overlay.classList.add("is-active");
			overlay.style.setProperty("--lens-progress", "0");
		}

		function approachStep(now) {
			var p = Math.min((now - startTime) / approachDuration, 1);
			var eased = easeInCubic(p);

			var z = startCamZ - (startCamZ - (lensWorldZ + 0.35)) * eased;
			camera.position.set(
				camBase.x * (1 - eased * 0.6),
				camBase.y + (magnifier.position.y - camBase.y) * eased * 0.5,
				z
			);
			camera.lookAt(
				magnifier.position.x,
				magnifier.position.y,
				magnifier.position.z
			);

			var lensScale = 1 + eased * eased * 22;
			magnifier.scale.set(lensScale, lensScale, lensScale);
			lensMat.opacity = 0.24 + eased * 0.5;

			if (overlay) {
				overlay.style.setProperty(
					"--lens-progress",
					(eased * 0.65).toFixed(3)
				);
			}

			if (p < 1) {
				requestAnimationFrame(approachStep);
			} else {
				refractionPop();
			}
		}

		function refractionPop() {
			var popStart = performance.now();
			function step(now) {
				var p = Math.min((now - popStart) / refractionDuration, 1);
				if (overlay) {
					var flash = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
					overlay.style.setProperty(
						"--lens-progress",
						(0.65 + flash * 0.35).toFixed(3)
					);
				}
				if (p < 1) {
					requestAnimationFrame(step);
				} else {
					arrive();
				}
			}
			requestAnimationFrame(step);
		}

		function arrive() {
			if (openingScene) openingScene.style.display = "none";

			if (overlay) {
				overlay.style.setProperty("--lens-progress", "1");
			}

			document.dispatchEvent(new CustomEvent("psk:board-reveal"));
			if (typeof onArrive === "function") onArrive();
		}

		requestAnimationFrame(approachStep);
	}

	window.startTransition = function startTransition() {
		pushThroughLens();
	};
})();
