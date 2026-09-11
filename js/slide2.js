(function () {
	"use strict";

	var slide2Scene = document.getElementById("slide2Scene");
	if (!slide2Scene) return;

	var isOpen = false;

	function openSlide2() {
		if (isOpen) return;
		isOpen = true;
		slide2Scene.style.display = "flex";
		// Animasi masuk sederhana
		slide2Scene.style.opacity = "0";
		slide2Scene.style.transform = "scale(0.9)";
		void slide2Scene.offsetWidth;
		slide2Scene.style.transition = "opacity 0.6s ease, transform 0.6s ease";
		slide2Scene.style.opacity = "1";
		slide2Scene.style.transform = "scale(1)";
	}

	document.addEventListener("psk:photo-focused", function (e) {
		var index = e.detail ? e.detail.index : -1;
		if (index === 1) {
			// Foto 2 -> Slide 2
			openSlide2();
		}
	});
})();
