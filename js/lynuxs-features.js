/* ==========================================================================
   LYNUXS FEATURES — STEP 7.4
   Menu 3-icon + panel Calculator / AI Chat / FAQ.

   Perubahan dari STEP 7.3:
   - AI panel monochrome (lihat css/yusmentoro67.css blok 7.4a).
   - Panel-idle animation: ketika panel aktif, Lynuxs idle bob + sesekali
     glance / lookdown / glasses / lookback / notebook. Timer bersih,
     tidak menumpuk; di-stop total saat panel ditutup.
   - Thought bubble (#y67Thinking) muncul saat request Gemini berlangsung,
     hilang saat response/error. Terhubung langsung ke fetch lifecycle —
     bukan fixed timeout.

   - TIDAK ADA RAF baru. TIDAK ADA canvas/webgl. TIDAK ADA instance
     Lynuxs kedua. Backend AI: Cloudflare Worker (endpoint di bawah).
   ========================================================================== */

(function () {
	"use strict";

	var AI_ENDPOINT = "https://lynuxs-backend.nizarr68256.workers.dev/api/chat";

	var charEl = document.getElementById("yusmentoro67Char");
	var bodyEl = document.getElementById("yusmentoro67Body");
	var menuEl = document.getElementById("y67Menu");
	var calcPanel = document.getElementById("y67CalcPanel");
	var chatPanel = document.getElementById("y67ChatPanel");
	var faqPanel = document.getElementById("y67FaqPanel");
	var calcDisplay = document.getElementById("y67CalcDisplay");
	var chatFeed = document.getElementById("y67ChatFeed");
	var chatForm = document.getElementById("y67ChatForm");
	var chatInput = document.getElementById("y67ChatInput");
	var chatSend = document.getElementById("y67ChatSend");
	var faqBody = document.getElementById("y67FaqBody");
	var closeBtn = document.getElementById("y67CloseBtn");
	var thinkingEl = document.getElementById("y67Thinking");

	if (!charEl || !menuEl || !calcPanel || !chatPanel || !faqPanel) {
		return;
	}

	var menuOpen = false;
	var calcOpen = false;
	var chatOpen = false;
	var faqOpen = false;
	var chatBusy = false;

	function dispatchMenuClosed() {
		try {
			window.dispatchEvent(new CustomEvent("lynuxs:menu-closed"));
		} catch (e) {}
	}

	/* ---------------------------------------------------------------------
	   ★ 7.4 — THINKING BUBBLE
	   Terhubung langsung ke fetch lifecycle (bukan timer tetap).
	   --------------------------------------------------------------------- */
	function showThinking() {
		if (!thinkingEl) return;
		thinkingEl.classList.add("is-visible");
		thinkingEl.setAttribute("aria-hidden", "false");
	}
	function hideThinking() {
		if (!thinkingEl) return;
		thinkingEl.classList.remove("is-visible");
		thinkingEl.setAttribute("aria-hidden", "true");
	}

	/* ---------------------------------------------------------------------
	   ★ 7.4 — PANEL-IDLE ANIMATION
	   Base bob di CSS (.y67-panel-active). Discrete actions dijalankan
	   lewat setTimeout dengan cleanup yang jelas; tidak menumpuk.
	   --------------------------------------------------------------------- */
	var PANEL_IDLE_MIN_MS = 4200;
	var PANEL_IDLE_MAX_MS = 8200;

	var PANEL_IDLE_ACTIONS = [
		{ cls: "y67-anim-glance", dur: 700, weight: 3 },
		{ cls: "y67-anim-lookdown", dur: 850, weight: 3 },
		{ cls: "y67-anim-look", dur: 900, weight: 2 },
		{ cls: "y67-anim-glasses", dur: 480, weight: 2 },
		{ cls: "y67-anim-lookback", dur: 950, weight: 1 },
		{ cls: "y67-anim-panel-notebook", dur: 2400, weight: 2 }
	];

	var panelIdleActive = false;
	var panelIdleTimer = null;
	var panelIdleActionTimer = null;
	var panelIdleActionCls = null;

	function clearPanelIdleTimer() {
		if (panelIdleTimer) {
			clearTimeout(panelIdleTimer);
			panelIdleTimer = null;
		}
	}
	function clearPanelIdleActionTimer() {
		if (panelIdleActionTimer) {
			clearTimeout(panelIdleActionTimer);
			panelIdleActionTimer = null;
		}
	}
	function removePanelIdleActionClass() {
		if (panelIdleActionCls && bodyEl) {
			bodyEl.classList.remove(panelIdleActionCls);
		}
		panelIdleActionCls = null;
		if (charEl) charEl.classList.remove("y67-panel-busy");
	}

	function pickPanelIdleAction() {
		var total = 0;
		for (var i = 0; i < PANEL_IDLE_ACTIONS.length; i++)
			total += PANEL_IDLE_ACTIONS[i].weight;
		var r = Math.random() * total;
		for (var j = 0; j < PANEL_IDLE_ACTIONS.length; j++) {
			r -= PANEL_IDLE_ACTIONS[j].weight;
			if (r <= 0) return PANEL_IDLE_ACTIONS[j];
		}
		return PANEL_IDLE_ACTIONS[0];
	}

	function scheduleNextPanelIdle() {
		if (!panelIdleActive) return;
		clearPanelIdleTimer();
		var delay =
			PANEL_IDLE_MIN_MS +
			Math.random() * (PANEL_IDLE_MAX_MS - PANEL_IDLE_MIN_MS);
		panelIdleTimer = setTimeout(runPanelIdleAction, delay);
	}

	function runPanelIdleAction() {
		panelIdleTimer = null;
		if (!panelIdleActive) return;

		/* Kalau AI sedang memproses request, tahan idle actions supaya
		   fokus ke thought bubble. */
		if (chatBusy) {
			scheduleNextPanelIdle();
			return;
		}

		var action = pickPanelIdleAction();
		panelIdleActionCls = action.cls;
		charEl.classList.add("y67-panel-busy");
		bodyEl.classList.add(action.cls);

		clearPanelIdleActionTimer();
		panelIdleActionTimer = setTimeout(function () {
			panelIdleActionTimer = null;
			removePanelIdleActionClass();
			scheduleNextPanelIdle();
		}, action.dur);
	}

	function startPanelIdle() {
		if (panelIdleActive) return;
		panelIdleActive = true;
		charEl.classList.add("y67-panel-active");
		scheduleNextPanelIdle();
	}

	function stopPanelIdle() {
		if (!panelIdleActive) return;
		panelIdleActive = false;
		charEl.classList.remove("y67-panel-active");
		clearPanelIdleTimer();
		clearPanelIdleActionTimer();
		removePanelIdleActionClass();
	}

	/* ---------------------------------------------------------------------
	   CLOSE BUTTON (X) — dari STEP 7.3, tidak diubah.
	   --------------------------------------------------------------------- */
	function positionCloseBtn(panelEl) {
		if (!closeBtn || !panelEl) return;
		var vw = window.innerWidth || document.documentElement.clientWidth;
		var vh = window.innerHeight || document.documentElement.clientHeight;
		var panelH = panelEl.offsetHeight || 0;
		var panelBottom = (vh + panelH) / 2;
		var top = panelBottom + 14;
		var maxTop = vh - 48;
		if (top > maxTop) top = maxTop;
		if (top < 8) top = 8;
		closeBtn.style.setProperty("--y67-close-left", vw / 2 + "px");
		closeBtn.style.setProperty("--y67-close-top", top + "px");
	}
	function showCloseBtn(panelEl) {
		if (!closeBtn) return;
		positionCloseBtn(panelEl);
		closeBtn.classList.add("is-visible");
		closeBtn.setAttribute("aria-hidden", "false");
	}
	function hideCloseBtn() {
		if (!closeBtn) return;
		closeBtn.classList.remove("is-visible");
		closeBtn.setAttribute("aria-hidden", "true");
	}

	/* ---------------------------------------------------------------------
	   PANEL STATE
	   --------------------------------------------------------------------- */
	function closeMenu() {
		if (!menuOpen) return;
		menuOpen = false;
		menuEl.classList.remove("is-open");
		menuEl.setAttribute("aria-hidden", "true");
	}
	function closeCalc() {
		if (!calcOpen) return;
		calcOpen = false;
		calcPanel.classList.remove("is-open");
		calcPanel.setAttribute("aria-hidden", "true");
		undockChar();
	}
	function closeChat() {
		if (!chatOpen) return;
		chatOpen = false;
		chatPanel.classList.remove("is-open");
		chatPanel.setAttribute("aria-hidden", "true");
		undockChar();
		hideThinking();
	}
	function closeFaq() {
		if (!faqOpen) return;
		faqOpen = false;
		faqPanel.classList.remove("is-open");
		faqPanel.setAttribute("aria-hidden", "true");
		undockChar();
	}
	function isAnyOpen() {
		return menuOpen || calcOpen || chatOpen || faqOpen;
	}

	function dockCharAbovePanel(panelEl, modifierClass) {
		var vw = window.innerWidth || document.documentElement.clientWidth;
		var vh = window.innerHeight || document.documentElement.clientHeight;
		var panelH = panelEl.offsetHeight;
		var topY = (vh - panelH) / 2;
		if (topY < 8) topY = 8;
		charEl.style.setProperty("--y67-dock-left", vw / 2 + "px");
		charEl.style.setProperty("--y67-dock-top", topY + "px");
		charEl.classList.remove(
			"y67-docked--chat",
			"y67-docked--calc",
			"y67-docked--faq"
		);
		charEl.classList.add("y67-docked", modifierClass);
	}

	function undockChar() {
		charEl.classList.remove(
			"y67-docked",
			"y67-docked--chat",
			"y67-docked--calc",
			"y67-docked--faq"
		);
		charEl.style.removeProperty("--y67-dock-left");
		charEl.style.removeProperty("--y67-dock-top");
	}

	function redockIfOpen() {
		if (chatOpen) {
			dockCharAbovePanel(chatPanel, "y67-docked--chat");
			showCloseBtn(chatPanel);
		} else if (calcOpen) {
			dockCharAbovePanel(calcPanel, "y67-docked--calc");
			showCloseBtn(calcPanel);
		} else if (faqOpen) {
			dockCharAbovePanel(faqPanel, "y67-docked--faq");
			showCloseBtn(faqPanel);
		} else {
			hideCloseBtn();
		}
	}
	window.addEventListener("resize", redockIfOpen);

	function closeAll() {
		var wasOpen = isAnyOpen();
		closeMenu();
		closeCalc();
		closeChat();
		closeFaq();
		hideCloseBtn();
		hideThinking();
		stopPanelIdle();
		if (wasOpen) dispatchMenuClosed();
	}

	function positionMenu() {
		var rect = charEl.getBoundingClientRect();
		var cx = rect.left + rect.width / 2;
		var cy = rect.top - 14;
		menuEl.style.left = cx + "px";
		menuEl.style.top = cy + "px";
	}

	function openMenu() {
		positionMenu();
		menuOpen = true;
		menuEl.classList.add("is-open");
		menuEl.setAttribute("aria-hidden", "false");
	}

	menuEl.addEventListener("click", function (e) {
		var btn = e.target.closest("[data-feature]");
		if (!btn) return;
		e.stopPropagation();
		var feature = btn.getAttribute("data-feature");
		closeMenu();
		if (feature === "calc") openCalc();
		else if (feature === "ai") openChat();
		else if (feature === "faq") openFaq();
	});

	/* Close button click — bind sekali di module scope. */
	if (closeBtn) {
		closeBtn.addEventListener("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			closeAll();
		});
	}

	/* =====================================================================
	   CALCULATOR
	   ===================================================================== */
	var calcExpr = "";
	var calcJustEvaluated = false;

	function openCalc() {
		calcOpen = true;
		calcPanel.classList.add("is-open");
		calcPanel.setAttribute("aria-hidden", "false");
		dockCharAbovePanel(calcPanel, "y67-docked--calc");
		showCloseBtn(calcPanel);
		startPanelIdle();
	}

	function renderCalc() {
		calcDisplay.textContent = calcExpr === "" ? "0" : calcExpr;
	}

	function evaluateExpression(input) {
		var src = String(input)
			.replace(/×/g, "*")
			.replace(/÷/g, "/")
			.replace(/−/g, "-");

		var tokens = [];
		var i = 0;
		while (i < src.length) {
			var c = src[i];
			if (c === " ") {
				i++;
				continue;
			}
			if ((c >= "0" && c <= "9") || c === ".") {
				var num = "";
				while (
					i < src.length &&
					((src[i] >= "0" && src[i] <= "9") || src[i] === ".")
				) {
					num += src[i++];
				}
				if (num === "." || (num.match(/\./g) || []).length > 1)
					throw new Error("Angka tidak valid");
				tokens.push({ type: "num", value: parseFloat(num) });
			} else if (c === "+" || c === "-" || c === "*" || c === "/") {
				tokens.push({ type: "op", value: c });
				i++;
			} else if (c === "%") {
				tokens.push({ type: "pct", value: "%" });
				i++;
			} else {
				throw new Error("Karakter tidak dikenal");
			}
		}

		var pos = 0;
		function peek() {
			return tokens[pos];
		}
		function next() {
			return tokens[pos++];
		}

		function parseExpr() {
			var left = parseTerm();
			while (
				peek() &&
				peek().type === "op" &&
				(peek().value === "+" || peek().value === "-")
			) {
				var op = next().value;
				var right = parseTerm();
				left = op === "+" ? left + right : left - right;
			}
			return left;
		}
		function parseTerm() {
			var left = parseFactor();
			while (
				peek() &&
				peek().type === "op" &&
				(peek().value === "*" || peek().value === "/")
			) {
				var op = next().value;
				var right = parseFactor();
				if (op === "*") left = left * right;
				else {
					if (right === 0) throw new Error("Tidak bisa dibagi nol");
					left = left / right;
				}
			}
			return left;
		}
		function parseFactor() {
			var t = peek();
			if (!t) throw new Error("Ekspresi tidak lengkap");
			if (t.type === "op" && (t.value === "-" || t.value === "+")) {
				next();
				var v = parseFactor();
				return t.value === "-" ? -v : v;
			}
			if (t.type === "num") {
				next();
				var n = t.value;
				if (peek() && peek().type === "pct") {
					next();
					n = n / 100;
				}
				return n;
			}
			throw new Error("Format tidak valid");
		}

		var result = parseExpr();
		if (pos < tokens.length) throw new Error("Format tidak valid");
		return result;
	}

	function formatResult(n) {
		if (!isFinite(n)) return "Error";
		var s = Number(n.toPrecision(12)).toString();
		if (s.length > 18) s = n.toExponential(6);
		return s;
	}

	document
		.getElementById("y67CalcKeys")
		.addEventListener("click", function (e) {
			var btn = e.target.closest("[data-key]");
			if (!btn) return;
			var key = btn.getAttribute("data-key");

			if (key === "C") {
				calcExpr = "";
				calcJustEvaluated = false;
				renderCalc();
				return;
			}
			if (key === "back") {
				if (calcJustEvaluated) {
					calcExpr = "";
					calcJustEvaluated = false;
				} else calcExpr = calcExpr.slice(0, -1);
				renderCalc();
				return;
			}
			if (key === "=") {
				if (calcExpr === "") return;
				try {
					var v = evaluateExpression(calcExpr);
					calcExpr = formatResult(v);
					calcJustEvaluated = true;
				} catch (err) {
					calcExpr = "Error";
					calcJustEvaluated = true;
				}
				renderCalc();
				return;
			}

			if (calcJustEvaluated) {
				if (key === "+" || key === "−" || key === "×" || key === "÷") {
					calcJustEvaluated = false;
				} else {
					calcExpr = "";
					calcJustEvaluated = false;
				}
			}
			if ("+−×÷".indexOf(key) !== -1) {
				var last = calcExpr.slice(-1);
				if (
					last === "+" ||
					last === "−" ||
					last === "×" ||
					last === "÷"
				) {
					calcExpr = calcExpr.slice(0, -1);
				}
				if (calcExpr === "" && key !== "−") return;
			}
			if (key === ".") {
				var lastDot = calcExpr.lastIndexOf(".");
				var lastOp = -1;
				for (var k = calcExpr.length - 1; k >= 0; k--) {
					if ("+−×÷".indexOf(calcExpr[k]) !== -1) {
						lastOp = k;
						break;
					}
				}
				if (lastDot > lastOp) return;
			}
			calcExpr += key;
			renderCalc();
		});

	/* =====================================================================
	   AI CHAT
	   ===================================================================== */
	function openChat() {
		chatOpen = true;
		chatPanel.classList.add("is-open");
		chatPanel.setAttribute("aria-hidden", "false");
		dockCharAbovePanel(chatPanel, "y67-docked--chat");
		showCloseBtn(chatPanel);
		startPanelIdle();
		setTimeout(function () {
			try {
				chatInput.focus();
			} catch (e) {}
		}, 60);
	}

	function appendMessage(who, text, opts) {
		var el = document.createElement("div");
		el.className = "y67-chat__msg y67-chat__msg--" + who;
		if (opts && opts.error) el.classList.add("y67-chat__msg--err");

		var label = document.createElement("span");
		label.className = "y67-chat__label";
		label.textContent = who === "user" ? "[ USER ]" : "[ LYNUXS ]";

		var body = document.createElement("div");
		body.className = "y67-chat__text";
		body.textContent = text;

		el.appendChild(label);
		el.appendChild(body);
		chatFeed.appendChild(el);
		scrollChatToBottom();
		return el;
	}

	function appendTyping() {
		var el = document.createElement("div");
		el.className = "y67-chat__msg y67-chat__msg--bot y67-chat__msg--typing";

		var label = document.createElement("span");
		label.className = "y67-chat__label";
		label.textContent = "[ LYNUXS ]";

		var body = document.createElement("div");
		body.className = "y67-chat__text";
		body.innerHTML =
			'<span class="y67-chat__dot"></span>' +
			'<span class="y67-chat__dot"></span>' +
			'<span class="y67-chat__dot"></span>';

		el.appendChild(label);
		el.appendChild(body);
		chatFeed.appendChild(el);
		scrollChatToBottom();
		return el;
	}

	function scrollChatToBottom() {
		chatFeed.scrollTop = chatFeed.scrollHeight;
		redockIfOpen();
	}

	function setChatBusy(busy) {
		chatBusy = busy;
		chatInput.disabled = busy;
		chatSend.disabled = busy;
	}

	chatForm.addEventListener("submit", function (e) {
		e.preventDefault();
		sendChatMessage();
	});

	function sendChatMessage() {
		if (chatBusy) return;
		var text = (chatInput.value || "").trim();
		if (!text) return;

		chatInput.value = "";
		appendMessage("user", text);

		var typingEl = appendTyping();
		setChatBusy(true);
		/* ★ 7.4 — thought bubble ON, terhubung ke lifecycle fetch. */
		showThinking();

		fetch(AI_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: text })
		})
			.then(function (res) {
				if (!res.ok) throw new Error("HTTP " + res.status);
				return res.json();
			})
			.then(function (data) {
				var reply =
					data && typeof data.reply === "string"
						? data.reply.trim()
						: "";
				if (!reply) throw new Error("Reply kosong");
				if (typingEl.parentNode)
					typingEl.parentNode.removeChild(typingEl);
				appendMessage("bot", reply);
			})
			.catch(function () {
				if (typingEl.parentNode)
					typingEl.parentNode.removeChild(typingEl);
				appendMessage(
					"bot",
					"Belum bisa menjawab sekarang. Coba kirim lagi sebentar.",
					{ error: true }
				);
			})
			.then(function () {
				/* ★ 7.4 — request selesai (sukses ATAU error): thinking OFF. */
				hideThinking();
				setChatBusy(false);
				try {
					chatInput.focus();
				} catch (e) {}
			});
	}

	/* =====================================================================
	   FAQ — 6 pertanyaan tetap
	   ===================================================================== */
	var FAQ_ITEMS = [
		{
			q: "Apa itu difusi?",
			a: "Difusi adalah proses penyebaran unsur budaya — seperti ide, kebiasaan, teknologi, makanan, atau musik — dari satu masyarakat ke masyarakat lain melalui interaksi, migrasi, perdagangan, atau media."
		},
		{
			q: "Apa itu glocalization?",
			a: "Glocalization adalah proses ketika unsur budaya atau produk global diadaptasi agar sesuai dengan kondisi, nilai, dan kebiasaan lokal, sehingga menghasilkan bentuk yang khas di setiap daerah."
		},
		{
			q: "Apa itu hibridasi?",
			a: "Hibridasi (hibridisasi) adalah percampuran dua atau lebih unsur budaya yang berbeda hingga menghasilkan bentuk budaya baru yang memadukan ciri keduanya."
		},
		{
			q: "Apa itu inklusif?",
			a: "Inklusif berarti bersikap terbuka dan setara terhadap semua orang tanpa membedakan latar belakang, budaya, atau kemampuan, sehingga semua orang dapat ikut berpartisipasi."
		},
		{
			q: "Apa itu McDonaldization?",
			a: "McDonaldization adalah konsep sosiolog George Ritzer tentang meluasnya prinsip efisiensi, keterhitungan, prediktabilitas, dan kontrol — seperti pada restoran cepat saji — ke berbagai bidang kehidupan."
		},
		{
			q: "Apa itu cultural imperialisme?",
			a: "Cultural imperialism adalah proses menyebarnya budaya dari kelompok atau negara yang dominan sehingga dapat memengaruhi bahkan menekan budaya lokal, baik melalui media, hiburan, maupun pola konsumsi."
		}
	];

	function openFaq() {
		faqOpen = true;
		faqPanel.classList.add("is-open");
		faqPanel.setAttribute("aria-hidden", "false");
		renderFaqList();
		startPanelIdle();
	}

	function renderFaqList() {
		faqBody.innerHTML = "";
		FAQ_ITEMS.forEach(function (item, idx) {
			var btn = document.createElement("button");
			btn.type = "button";
			btn.className = "y67-faq__item";
			btn.textContent = item.q;
			btn.addEventListener("click", function () {
				renderFaqAnswer(idx);
			});
			faqBody.appendChild(btn);
		});
		faqBody.scrollTop = 0;
		if (faqOpen) {
			dockCharAbovePanel(faqPanel, "y67-docked--faq");
			showCloseBtn(faqPanel);
		}
	}

	function renderFaqAnswer(idx) {
		var item = FAQ_ITEMS[idx];
		if (!item) return;
		faqBody.innerHTML = "";

		var wrap = document.createElement("div");
		wrap.className = "y67-faq__answer";

		var back = document.createElement("button");
		back.type = "button";
		back.className = "y67-faq__back";
		back.textContent = "← Kembali ke daftar";
		back.addEventListener("click", renderFaqList);

		var q = document.createElement("h3");
		q.className = "y67-faq__q";
		q.textContent = item.q;

		var a = document.createElement("p");
		a.className = "y67-faq__a";
		a.textContent = item.a;

		wrap.appendChild(back);
		wrap.appendChild(q);
		wrap.appendChild(a);
		faqBody.appendChild(wrap);
		faqBody.scrollTop = 0;
		if (faqOpen) {
			dockCharAbovePanel(faqPanel, "y67-docked--faq");
			showCloseBtn(faqPanel);
		}
	}

	window.LynuxsFeatures = {
		openMenu: openMenu,
		closeMenu: closeMenu,
		closeAll: closeAll,
		isAnyOpen: isAnyOpen
	};
})();
