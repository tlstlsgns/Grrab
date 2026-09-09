(function(){
  "use strict";
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(e){}

  /* ───────────────── SHORTCUT GLYPH — platform parity ─────────────────
     The markup ships the macOS glyph. On non-Mac we rewrite every shortcut
     spot to what the extension's formatShortcut() returns, using the same
     detection it uses, so the page never shows a shortcut the visitor
     cannot press. Failing open leaves the macOS text in place. */
  var KC_SHORTCUT_SELECTOR =
    ".rowA-step-kbd, .rowB-tip, .hero-tip, .sidepanel-kbd";
  try {
    var isMac = navigator.platform.toUpperCase().indexOf("MAC") !== -1 ||
                navigator.userAgent.indexOf("Mac") !== -1;
    if (!isMac) {
      var kcEls = document.querySelectorAll(KC_SHORTCUT_SELECTOR);
      for (var kcI = 0; kcI < kcEls.length; kcI++) {
        kcEls[kcI].textContent = "Ctrl+C";
      }
      var heroTipV = document.getElementById("heroTipV");
      if (heroTipV) heroTipV.textContent = "Ctrl+V";
    }
  } catch (e) {}

  /* ──────────────────── HERO — EDIT-MODE SEQUENCE ──────────────────── */
  var heroCamera = document.querySelector(".hero-camera");
  var heroBody = document.querySelector(".hero-body");
  var heroCursor = document.getElementById("heroCursor");
  var heroTip = document.getElementById("heroTip");
  var heroOverlay = document.getElementById("heroOverlay");
  var heroOverlayAfter = document.getElementById("heroOverlayAfter");
  var heroOverlayBtn = document.getElementById("heroOverlayBtn");
  var heroBusy = document.getElementById("heroBusy");
  var heroHandle = document.getElementById("heroHandle");
  var heroClip = document.querySelector(".hero-slider-clip");
  var heroFigure = document.querySelector(".hero-overlay-figure");
  var heroOverlayImg = document.getElementById("heroOverlayImg");
  var heroOverlayBtnIcon = document.getElementById("heroOverlayBtnIcon");
  var heroOverlayBtnLabel = document.getElementById("heroOverlayBtnLabel");
  var heroActs = [].slice.call(document.querySelectorAll(".hero-overlay-act"));
  var heroActClip = document.getElementById("heroActClip");
  var heroLateActs = heroOverlay
    ? [].slice.call(heroOverlay.querySelectorAll(".hero-overlay-act--late"))
    : [];
  var heroToast = document.getElementById("heroToast");
  var heroCanvas = document.querySelector(".hero-canvas");
  var heroCanvasBody = document.querySelector(".hero-canvas-body");
  var heroCanvasPan = document.getElementById("heroCanvasPan");
  var heroTipV = document.getElementById("heroTipV");
  var heroGallery = document.querySelector(".hero-gallery");
  var heroMarquee = document.getElementById("heroMarquee");
  var heroHint = document.getElementById("heroHint");
  var heroTiles = [].slice.call(document.querySelectorAll(".hero-tile"));

  if (heroCamera && heroBody && heroCursor && heroOverlay && heroTiles.length) {
    var heroTimers = [];
    var heroLateTimer = 0;
    var heroRaf = 0;
    var heroReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    var heroAt = function(ms, fn){ heroTimers.push(setTimeout(fn, ms)); };

    /* Positions come from offsetLeft/offsetTop, walking up to .hero-camera, rather
       than from getBoundingClientRect. The walk ends at the camera rather than the
       window because the cursor lives there and has to be able to travel between the
       two windows. */
    var heroOffsetIn = function(el){
      var x = 0, y = 0, n = el;
      while (n && n !== heroCamera) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x: x, y: y };
    };
    var heroCentreIn = function(el){
      var p = heroOffsetIn(el);
      return { x: p.x + el.offsetWidth / 2, y: p.y + el.offsetHeight / 2 };
    };
    var heroMoveTo = function(p){
      heroCursor.style.transform = "translate(" + p.x + "px," + p.y + "px)";
    };

    var heroHotOnly = function(tile){
      for (var i = 0; i < heroTiles.length; i++){
        if (heroTiles[i] === tile) heroTiles[i].classList.add("hero-tile--hot");
        else heroTiles[i].classList.remove("hero-tile--hot");
      }
    };

    /* Hit testing DOES use getBoundingClientRect with elementFromPoint, because that
       pair works in viewport space and is unaffected by the transform either way. */
    var heroTrack = function(durationMs){
      var started = Date.now();
      var tick = function(){
        var r = heroCursor.getBoundingClientRect();
        var under = document.elementFromPoint(r.left, r.top);
        heroHotOnly(under && under.closest ? under.closest(".hero-tile") : null);
        if (Date.now() - started < durationMs) heroRaf = requestAnimationFrame(tick);
        else heroRaf = 0;
      };
      heroRaf = requestAnimationFrame(tick);
    };

    /* The press is NOT released on a timer any more. It stays down for as long as the
       spinner runs, which is what makes the button read as busy rather than as a
       click that already finished. heroReveal is the single point where both end. */
    var heroHover = function(){
      if (heroOverlayBtn) heroOverlayBtn.classList.add("hero-overlay-btn--hover");
    };
    var heroPress = function(){
      if (heroOverlayBtn) heroOverlayBtn.classList.add("hero-overlay-btn--press");
      if (heroBusy) heroBusy.classList.add("hero-busy--on");
      if (heroMarquee) {
        heroMarquee.classList.remove("hero-marquee--on");
        heroMarquee.style.width = "0%";
        heroMarquee.style.height = "0%";
      }
    };
    var heroReveal = function(){
      if (heroBusy) heroBusy.classList.remove("hero-busy--on");
      if (heroOverlayBtn) heroOverlayBtn.classList.remove("hero-overlay-btn--press");
      if (heroClip) heroClip.classList.add("hero-slider-clip--wipe");
      if (heroHandle) {
        heroHandle.style.transition = "none";
        heroHandle.style.left = "100%";
        void heroHandle.offsetWidth;
        heroHandle.style.transition = "";
        heroHandle.style.left = "0%";
      }
      if (heroOverlayAfter) heroOverlayAfter.classList.add("hero-overlay-after--in");
      if (heroLateTimer) { clearTimeout(heroLateTimer); heroLateTimer = 0; }
      heroLateTimer = setTimeout(function(){
        heroLateTimer = 0;
        if (heroLateActs) {
          heroLateActs.forEach(function(el){ el.classList.add("hero-overlay-act--in"); });
        }
        if (heroClip) heroClip.classList.remove("hero-slider-clip--wipe");
      }, 1400);
      heroTimers.push(heroLateTimer);
    };
    /* Everything that differs between one editor pass and the next lives here rather
       than being hardcoded in the markup, so a second pass is a config entry instead
       of a second set of elements. The ratios are the images' own: 2000x1333 and
       2000x1335 differ by only 0.6px at this size, but the figure has to match its
       image exactly or the checkerboard shows past the picture's edge. */
    var heroSteps = [
      { img:"/assets/landing/img/hero-image-1-before.webp", ratio:"2000/1333", alpha:true },
      { img:"/assets/landing/img/hero-image-7-before.webp", ratio:"2000/1335", alpha:false }
    ];
    /* The action button no longer belongs to the step. In the extension it always opens
       as Remove BG with the hint beside it, and only becomes Remove once a selection
       exists — so the drag, not the pass, is what switches it. */
    var heroSetAction = function(erasing){
      if (heroOverlayBtnIcon) heroOverlayBtnIcon.setAttribute("src",
        erasing ? "/assets/landing/icons/hero/icon_erase.svg"
                : "/assets/landing/icons/hero/icon_removebg.svg");
      if (heroOverlayBtnLabel) heroOverlayBtnLabel.textContent = erasing ? "Remove" : "Remove BG";
      if (heroHint) {
        if (erasing) heroHint.classList.add("hero-hint--off");
        else heroHint.classList.remove("hero-hint--off");
      }
    };
    var heroSetStep = function(s){
      if (heroOverlayImg) heroOverlayImg.setAttribute("src", s.img);
      if (heroOverlayAfter) {
        heroOverlayAfter.setAttribute("src", s.img.replace(/-before\.(webp|jpe?g)$/, "-after.$1"));
        if (s.alpha) heroOverlayAfter.classList.add("hero-overlay-after--alpha");
        else heroOverlayAfter.classList.remove("hero-overlay-after--alpha");
      }
      heroSetAction(false);
    };
    /* Reopening the editor needs the first pass's leftovers cleared: the result would
       otherwise already be revealed and Clip already showing. Killing the transition
       around the class removal stops the result rewinding on screen. */
    var heroResetOverlay = function(){
      if (heroLateTimer) { clearTimeout(heroLateTimer); heroLateTimer = 0; }
      if (heroLateActs) {
        heroLateActs.forEach(function(el){ el.classList.remove("hero-overlay-act--in"); });
      }
      if (heroOverlayAfter) {
        heroOverlayAfter.style.transition = "none";
        heroOverlayAfter.classList.remove("hero-overlay-after--in");
        void heroOverlayAfter.offsetWidth;
        heroOverlayAfter.style.transition = "";
      }
      if (heroClip) heroClip.classList.remove("hero-slider-clip--wipe");
      if (heroHandle) {
        heroHandle.style.transition = "none";
        heroHandle.style.left = "0%";
      }
      if (heroMarquee) {
        heroMarquee.classList.remove("hero-marquee--on");
        heroMarquee.style.width = "0%";
        heroMarquee.style.height = "0%";
      }
    };
    var heroBoxPoint = function(fx, fy){
      var o = heroOffsetIn(heroOverlayImg);
      return { x: o.x + heroOverlayImg.offsetWidth * fx,
               y: o.y + heroOverlayImg.offsetHeight * fy };
    };
    /* Screen rects are safe here even though the camera scales them: the marquee's size
       is a RATIO of two rects, so the scale cancels. */
    var heroDragTrack = function(box, durationMs){
      var started = Date.now();
      var tick = function(){
        var ir = heroOverlayImg.getBoundingClientRect();
        var cr = heroCursor.getBoundingClientRect();
        if (ir.width && ir.height) {
          var w = Math.max(0, Math.min((cr.left - ir.left) / ir.width, 1) - box.l);
          var h = Math.max(0, Math.min((cr.top - ir.top) / ir.height, 1) - box.t);
          heroMarquee.style.width = (w * 100) + "%";
          heroMarquee.style.height = (h * 100) + "%";
        }
        if (Date.now() - started < durationMs) heroRaf = requestAnimationFrame(tick);
        else heroRaf = 0;
      };
      heroRaf = requestAnimationFrame(tick);
    };
    var heroClipHover = function(){
      if (heroActClip) heroActClip.classList.add("hero-overlay-act--hover");
    };
    var heroClipPress = function(){
      if (heroActClip) heroActClip.classList.add("hero-overlay-act--press");
    };
    /* One moment does three things: the editor closes, the toast appears, and the
       cursor leaves for the canvas. They are deliberately on the same tick. */
    var heroClipDone = function(){
      if (heroActClip) {
        heroActClip.classList.remove("hero-overlay-act--press");
        heroActClip.classList.remove("hero-overlay-act--hover");
      }
      heroOverlay.classList.remove("hero-overlay--on");
      /* The gallery comes back into view here and the cursor is on the button, not on
         a tile, so nothing should still be lit. */
      heroHotOnly(null);
      if (heroToast) heroToast.classList.add("hero-toast--in");
      heroSlot1 = heroPickSlot();
      heroMoveTo(heroPastePointIn(heroSlot1.ox, heroSlot1.oy));
    };
    var heroToastOut = function(){
      if (heroToast) heroToast.classList.remove("hero-toast--in");
    };
    /* The paste is shown first so its laid-out size can be read, then positioned at a
       random offset near the canvas centre. No fade: a paste is instantaneous. */
    var heroPasteMin = 0.06;
    var heroPasteRetries = 24;
    var heroPasteMax = 10;
    var heroPasteCount = 0;
    var heroPlaced = [];
    var heroSlot1 = null;
    var heroSlot2 = null;
    var heroPastePointIn = function(ox, oy){
      if (!heroCanvas) return { x: 0, y: 0 };
      if (ox == null) ox = 0;
      if (oy == null) oy = 0;
      var p = heroCentreIn(heroCanvas);
      return { x: p.x + heroCanvas.offsetWidth * ox,
               y: p.y + heroCanvas.offsetHeight * oy };
    };
    var heroPickSlot = function(){
      var ox = 0, oy = 0, attempt, ok, pi;
      for (attempt = 0; attempt < heroPasteRetries; attempt++) {
        ox = Math.random() * 0.2 - 0.10;
        oy = Math.random() * 0.6 - 0.30;
        ok = true;
        if (heroCanvas && heroCanvas.offsetWidth) {
          for (pi = 0; pi < heroPlaced.length; pi++) {
            var dx = (ox - heroPlaced[pi].ox) * heroCanvas.offsetWidth;
            var dy = (oy - heroPlaced[pi].oy) * heroCanvas.offsetHeight;
            if (Math.sqrt(dx * dx + dy * dy) < heroCanvas.offsetWidth * heroPasteMin) {
              ok = false;
              break;
            }
          }
        }
        if (ok) break;
      }
      var slot = { ox: ox, oy: oy };
      heroPlaced.push(slot);
      return slot;
    };
    var heroClearPastes = function(){
      if (!heroCanvasPan) return;
      var nodes = heroCanvasPan.querySelectorAll(".hero-paste");
      for (var hi = 0; hi < nodes.length; hi++) nodes[hi].remove();
      heroPlaced = [];
      heroPasteCount = 0;
    };
    var heroPasteAfterSrc = function(stepIndex){
      return heroSteps[stepIndex].img.replace(/-before\.(webp|jpe?g)$/, "-after.$1");
    };
    var heroPasteAt = function(el, ox, oy, ratio){
      if (!el || !heroCanvas || !heroCanvasPan) return;
      if (ox == null) ox = 0;
      if (oy == null) oy = 0;
      var p = heroPastePointIn(ox, oy);
      var o = heroOffsetIn(heroCanvasPan);
      if (ratio) el.style.aspectRatio = ratio;
      el.classList.add("hero-paste--in");
      void el.offsetWidth;
      el.style.left = (p.x - o.x - el.offsetWidth / 2) + "px";
      el.style.top = (p.y - o.y - el.offsetHeight / 2) + "px";
    };
    var heroCreatePaste = function(stepIndex, ox, oy){
      if (!heroCanvasPan) return null;
      if (heroPasteCount >= heroPasteMax) heroClearPastes();
      var el = document.createElement("img");
      el.className = "hero-paste";
      el.setAttribute("src", heroPasteAfterSrc(stepIndex));
      el.setAttribute("alt", "");
      el.setAttribute("draggable", "false");
      heroCanvasPan.appendChild(el);
      heroPasteAt(el, ox, oy, heroSteps[stepIndex].ratio);
      heroPasteCount++;
      return el;
    };
    var heroPasteIn = function(){
      if (heroTipV) heroTipV.classList.add("hero-tip--in");
      if (!heroSlot1) heroSlot1 = heroPickSlot();
      heroCreatePaste(0, heroSlot1.ox, heroSlot1.oy);
    };
    var heroPasteIn2 = function(){
      if (heroTipV) heroTipV.classList.add("hero-tip--in");
      if (!heroSlot2) heroSlot2 = heroPickSlot();
      heroCreatePaste(1, heroSlot2.ox, heroSlot2.oy);
    };
    /* Clip's second press does only what the editor's closing needs. */
    var heroClipDone2 = function(){
      if (heroActClip) {
        heroActClip.classList.remove("hero-overlay-act--press");
        heroActClip.classList.remove("hero-overlay-act--hover");
      }
      heroOverlay.classList.remove("hero-overlay--on");
      heroHotOnly(null);
      if (heroToast) heroToast.classList.add("hero-toast--in");
    };
    /* The opposite conversion to heroPasteAt: a layer coordinate back to a screen one,
       because the cursor lives outside the layer. */
    var heroTipVOut = function(){
      if (heroTipV) heroTipV.classList.remove("hero-tip--in");
    };

    var heroClearTimers = function(){
      for (var ht = 0; ht < heroTimers.length; ht++) clearTimeout(heroTimers[ht]);
      heroTimers.length = 0;
      heroLateTimer = 0;
    };

    var heroStop = function(){
      heroClearTimers();
      if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }
      window.heroReset();
    };

    var heroPlay = function(){
      if (window.grrabBrowser && window.grrabBrowser.stopRowA) window.grrabBrowser.stopRowA();
      if (window.grrabBrowser && window.grrabBrowser.stopRowB) window.grrabBrowser.stopRowB();
      var tile = heroTiles[0];
      if (!tile || !heroBody.offsetWidth) return;
      /* Every cycle queues about thirty timers. Cancelling and emptying the list here
         keeps that from growing without bound, and means a stray call cannot leave two
         sequences running against each other. */
      heroClearTimers();
      if (heroPasteCount + 2 > heroPasteMax) heroClearPastes();
      heroSlot1 = null;
      heroSlot2 = null;
      if (heroLateActs) {
        heroLateActs.forEach(function(el){ el.classList.remove("hero-overlay-act--in"); });
      }
      heroSetStep(heroSteps[0]);

      var b = heroOffsetIn(heroBody);
      heroCursor.style.transition = "none";
      heroCursor.style.transform = "translate(" + (b.x + heroBody.offsetWidth * 0.86) + "px," +
                                                  (b.y + heroBody.offsetHeight * 0.92) + "px)";
      void heroCursor.offsetWidth;
      heroCursor.style.transition = "";

      heroAt(60, function(){
        heroCursor.classList.add("hero-cursor--on");
        heroMoveTo(heroCentreIn(tile));
        heroTrack(790);
      });
      heroAt(880, function(){
        if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }
        heroHotOnly(tile);
      });
      heroAt(1180, function(){ if (heroTip) heroTip.classList.add("hero-tip--in"); });
      heroAt(1520, function(){ if (heroTip) heroTip.classList.remove("hero-tip--in"); });
      heroAt(1820, function(){ heroOverlay.classList.add("hero-overlay--on"); });
      heroAt(2100, function(){
        if (heroOverlayBtn) heroMoveTo(heroCentreIn(heroOverlayBtn));
      });
      heroAt(2850, heroHover);
      heroAt(3250, heroPress);
      heroAt(4250, heroReveal);
      heroAt(5650, function(){
        if (heroActClip) heroMoveTo(heroCentreIn(heroActClip));
      });
      heroAt(6400, heroClipHover);
      heroAt(6800, heroClipPress);
      heroAt(7000, heroClipDone);
      heroAt(8100, heroToastOut);
      heroAt(7750, heroPasteIn);
      heroAt(8140, heroTipVOut);
      heroAt(8140, function(){
        var lateTile = heroTiles[5];
        if (!lateTile) return;
        heroMoveTo(heroCentreIn(lateTile));
        heroTrack(790);
      });
      heroAt(8960, function(){
        if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }
        heroHotOnly(heroTiles[5]);
      });

      /* ── second pass: erase, on the tile the cursor just settled on ── */
      var box = { l:0.39, t:0.38, r:0.59, b:0.65 };
      heroAt(9370, function(){ if (heroTip) heroTip.classList.add("hero-tip--in"); });
      heroAt(9710, function(){ if (heroTip) heroTip.classList.remove("hero-tip--in"); });
      heroAt(10010, function(){
        heroSetStep(heroSteps[1]);
        heroResetOverlay();
        heroOverlay.classList.add("hero-overlay--on");
      });
      heroAt(10290, function(){ heroMoveTo(heroBoxPoint(box.l, box.t)); });
      heroAt(11040, function(){
        if (!heroMarquee) return;
        heroMarquee.style.left = (box.l * 100) + "%";
        heroMarquee.style.top = (box.t * 100) + "%";
        heroMarquee.style.width = "0%";
        heroMarquee.style.height = "0%";
        heroMarquee.classList.add("hero-marquee--on");
        heroMoveTo(heroBoxPoint(box.r, box.b));
        heroDragTrack(box, 820);
      });
      heroAt(11860, function(){
        if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }
        heroSetAction(true);
        if (!heroMarquee) return;
        heroMarquee.style.width = ((box.r - box.l) * 100) + "%";
        heroMarquee.style.height = ((box.b - box.t) * 100) + "%";
      });
      heroAt(12070, function(){
        if (heroOverlayBtn) heroMoveTo(heroCentreIn(heroOverlayBtn));
      });
      heroAt(12810, heroHover);
      heroAt(13210, heroPress);
      heroAt(14210, heroReveal);

      /* ── second clip: second paste on the canvas ── */
      heroAt(15610, function(){
        if (heroActClip) heroMoveTo(heroCentreIn(heroActClip));
      });
      heroAt(16360, heroClipHover);
      heroAt(16760, heroClipPress);
      heroAt(16960, heroClipDone2);
      heroAt(17410, function(){
        heroSlot2 = heroPickSlot();
        heroMoveTo(heroPastePointIn(heroSlot2.ox, heroSlot2.oy));
      });
      heroAt(18710, heroToastOut);
      heroAt(18160, heroPasteIn2);
      heroAt(18550, heroTipVOut);
    };

    /* Puts everything back to the opening state. Defined here and hung on window so it
       can be called from the console before anything depends on it; the loop wires it up
       in a later round. */
    window.heroReset = function(){
      if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }

      heroSlot1 = null;
      heroSlot2 = null;

      /* the cursor */
      heroCursor.classList.remove("hero-cursor--on");
      heroCursor.classList.remove("hero-cursor--out");
      heroCursor.style.transition = "none";
      heroCursor.style.transform = "";
      void heroCursor.offsetWidth;
      heroCursor.style.transition = "";
      if (heroTip) heroTip.classList.remove("hero-tip--in");
      if (heroTipV) heroTipV.classList.remove("hero-tip--in");

      /* the editor */
      heroOverlay.classList.remove("hero-overlay--on");
      if (heroLateTimer) { clearTimeout(heroLateTimer); heroLateTimer = 0; }
      if (heroLateActs) {
        heroLateActs.forEach(function(el){ el.classList.remove("hero-overlay-act--in"); });
      }
      heroResetOverlay();
      heroSetStep(heroSteps[0]);
      if (heroOverlayBtn) {
        heroOverlayBtn.classList.remove("hero-overlay-btn--hover");
        heroOverlayBtn.classList.remove("hero-overlay-btn--press");
      }
      if (heroActClip) {
        heroActClip.classList.remove("hero-overlay-act--hover");
        heroActClip.classList.remove("hero-overlay-act--press");
      }
      if (heroBusy) heroBusy.classList.remove("hero-busy--on");

      /* the toast and the tile glow */
      if (heroToast) heroToast.classList.remove("hero-toast--in");
      heroHotOnly(null);
    };

    var heroSlot = document.querySelector(".hero-browser-slot");
    var heroMockup = document.querySelector(".hero-mockup-wrap");
    var rowABrowser = document.querySelector(".rowA-browser");
    var rowBSlot = document.querySelector(".rowB-mockup-wrap");
    var browserAt = "hero";

    var browserFlying = false;
    var browserFlightRaf = 0;
    var browserFlightMs = 400;
    var browserPlaced = false;
    var browserPending = null;
    var browserFlightDone = null;

    var browserSetPending = function(at, done){
      browserPending = { at: at, done: done || null };
    };

    var browserContinueAfterLanding = function(){
      if (browserAt === "rowA") {
        if (rowBIntersecting()) {
          browserFlightDone = null;
          moveToRowB(window.grrabBrowser && window.grrabBrowser.playRowB);
          return true;
        }
        if (!rowAIntersecting()) {
          browserFlightDone = null;
          return true;
        }
        return false;
      }
      if (browserAt === "hero") {
        if (rowBIntersecting()) {
          browserFlightDone = null;
          moveToRowB(window.grrabBrowser && window.grrabBrowser.playRowB);
          return true;
        }
        if (rowAIntersecting()) {
          browserFlightDone = null;
          moveToRowA(window.grrabBrowser && window.grrabBrowser.playRowA);
          return true;
        }
      }
      return false;
    };

    var browserFinishMove = function(){
      if (browserPending) {
        var pending = browserPending;
        browserPending = null;
        browserFlightDone = null;
        if (pending.at === browserAt) {
          if (pending.done) pending.done();
          return;
        }
        if (pending.at === "rowA") moveToRowA(pending.done);
        else if (pending.at === "rowB") moveToRowB(pending.done);
        else moveToHero(pending.done);
        return;
      }
      if (browserContinueAfterLanding()) return;
      if (browserFlightDone) {
        var flightDone = browserFlightDone;
        browserFlightDone = null;
        flightDone();
      }
    };

    var clearMockupFlightStyles = function(){
      heroMockup.style.position = "";
      heroMockup.style.left = "";
      heroMockup.style.top = "";
      heroMockup.style.width = "";
      heroMockup.style.height = "";
      heroMockup.style.margin = "";
      heroMockup.style.zIndex = "";
      heroMockup.style.boxSizing = "";
    };

    var setMockupFixedRect = function(rect){
      heroMockup.style.position = "fixed";
      heroMockup.style.left = rect.left + "px";
      heroMockup.style.top = rect.top + "px";
      heroMockup.style.width = rect.width + "px";
      heroMockup.style.height = rect.height + "px";
      heroMockup.style.margin = "0";
      heroMockup.style.zIndex = "10";
      heroMockup.style.boxSizing = "border-box";
    };

    var browserFlightEase = function(t){
      return 1 - Math.pow(1 - t, 3);
    };

    var browserFlyMockup = function(startRect, destRectFn, onLand, done){
      browserFlying = true;
      browserFlightDone = done || null;
      document.body.appendChild(heroMockup);
      setMockupFixedRect(startRect);
      var t0 = performance.now();
      var tick = function(now){
        var t = Math.min(1, (now - t0) / browserFlightMs);
        var e = browserFlightEase(t);
        var dest = destRectFn();
        setMockupFixedRect({
          left: startRect.left + (dest.left - startRect.left) * e,
          top: startRect.top + (dest.top - startRect.top) * e,
          width: startRect.width + (dest.width - startRect.width) * e,
          height: startRect.height + (dest.height - startRect.height) * e
        });
        if (t < 1) {
          browserFlightRaf = requestAnimationFrame(tick);
          return;
        }
        browserFlightRaf = 0;
        browserFlying = false;
        clearMockupFlightStyles();
        onLand();
        browserFinishMove();
      };
      browserFlightRaf = requestAnimationFrame(tick);
    };

    var browserPlaceMockup = function(slot, atValue, done){
      clearMockupFlightStyles();
      slot.appendChild(heroMockup);
      browserAt = atValue;
      browserPlaced = true;
      if (done) done();
    };

    var moveToRowA = function(done){
      if (browserAt === "rowA") {
        if (done) done();
        return;
      }
      if (browserFlying) {
        browserSetPending("rowA", done);
        return;
      }
      if (!heroMockup || !heroSlot || !rowABrowser) return;
      if (browserAt === "hero") {
        heroStop();
      } else if (browserAt === "rowB") {
        if (window.grrabBrowser && window.grrabBrowser.stopRowB) window.grrabBrowser.stopRowB();
      }
      if (!browserPlaced) {
        browserPlaceMockup(rowABrowser, "rowA", done);
        return;
      }
      var startRectA = heroMockup.getBoundingClientRect();
      browserFlyMockup(startRectA, function(){
        return rowABrowser.getBoundingClientRect();
      }, function(){
        rowABrowser.appendChild(heroMockup);
        browserAt = "rowA";
      }, done);
    };

    var heroTopIntersecting = function(){
      var top = document.getElementById("top");
      if (!top) return false;
      var r = top.getBoundingClientRect();
      if (!r.height) return false;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      return vis / r.height >= 0.6;
    };

    var rowAIntersecting = function(){
      var rowAEl = document.getElementById("rowA");
      if (!rowAEl) return false;
      var r = rowAEl.getBoundingClientRect();
      if (!r.height) return false;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      return vis / r.height >= 0.6;
    };

    var rowBIntersecting = function(){
      var rowBRow = document.querySelector(".grrab-rowB");
      if (!rowBRow) return false;
      var r = rowBRow.getBoundingClientRect();
      if (!r.height) return false;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      return vis / r.height >= 0.6;
    };

    var moveToRowB = function(done){
      if (browserAt === "rowB") {
        if (done) done();
        return;
      }
      if (browserFlying) {
        browserSetPending("rowB", done);
        return;
      }
      if (!heroMockup || !rowBSlot) return;
      if (browserAt === "rowA") {
        if (window.grrabBrowser && window.grrabBrowser.stopRowA) window.grrabBrowser.stopRowA();
      } else if (browserAt === "hero") {
        heroStop();
      }
      if (!browserPlaced) {
        browserPlaceMockup(rowBSlot, "rowB", done);
        return;
      }
      var startRectB = heroMockup.getBoundingClientRect();
      browserFlyMockup(startRectB, function(){
        return rowBSlot.getBoundingClientRect();
      }, function(){
        rowBSlot.appendChild(heroMockup);
        browserAt = "rowB";
      }, done);
    };

    var moveToHero = function(done){
      if (browserAt === "hero") {
        if (!(heroReduce && heroReduce.matches) && heroTopIntersecting()) heroPlay();
        if (done) done();
        return;
      }
      if (browserFlying) {
        browserSetPending("hero", done);
        return;
      }
      if (!heroMockup || !heroSlot) return;
      if (window.grrabBrowser && window.grrabBrowser.stopRowA) window.grrabBrowser.stopRowA();
      if (window.grrabBrowser && window.grrabBrowser.stopRowB) window.grrabBrowser.stopRowB();
      if (!browserPlaced) {
        browserPlaceMockup(heroSlot, "hero", function(){
          if (!(heroReduce && heroReduce.matches) && heroTopIntersecting()) heroPlay();
          if (done) done();
        });
        return;
      }
      var startRectH = heroMockup.getBoundingClientRect();
      browserFlyMockup(startRectH, function(){
        return heroSlot.getBoundingClientRect();
      }, function(){
        heroSlot.appendChild(heroMockup);
        browserAt = "hero";
        if (!(heroReduce && heroReduce.matches) && heroTopIntersecting()) heroPlay();
      }, done);
    };

    window.grrabBrowser = {
      moveToRowA: moveToRowA,
      moveToRowB: moveToRowB,
      moveToHero: moveToHero,
      stopHero: heroStop
    };
    Object.defineProperty(window.grrabBrowser, "at", {
      get: function(){ return browserAt; },
      enumerable: true
    });
    Object.defineProperty(window.grrabBrowser, "flying", {
      get: function(){ return browserFlying; },
      enumerable: true
    });
    Object.defineProperty(window.grrabBrowser, "heroVisible", {
      get: function(){ return heroTopIntersecting(); },
      enumerable: true
    });
    Object.defineProperty(window.grrabBrowser, "rowAIntersecting", {
      get: function(){ return rowAIntersecting(); },
      enumerable: true
    });
    Object.defineProperty(window.grrabBrowser, "rowBIntersecting", {
      get: function(){ return rowBIntersecting(); },
      enumerable: true
    });
    Object.defineProperty(window.grrabBrowser, "placed", {
      get: function(){ return browserPlaced; },
      enumerable: true
    });

    if (heroReduce && heroReduce.matches) {
      heroHotOnly(heroTiles[0]);
      heroSetStep(heroSteps[0]);
      heroOverlay.classList.add("hero-overlay--on");
      heroReveal();
      if (heroToast) heroToast.classList.add("hero-toast--in");
      heroPasteIn();
      if (heroTipV) heroTipV.classList.remove("hero-tip--in");
      browserPlaced = true;
    } else {
      var heroTop = document.getElementById("top");
      if (heroTop && "IntersectionObserver" in window) {
        var heroHasEntered = false;
        new IntersectionObserver(function(entries){
          for (var hi = 0; hi < entries.length; hi++){
            if (entries[hi].isIntersecting) {
              heroHasEntered = true;
              if (window.grrabBrowser) {
                if (window.grrabBrowser.at === "hero") {
                  if (!window.grrabBrowser.flying) {
                    heroPlay();
                    browserPlaced = true;
                  }
                } else {
                  window.grrabBrowser.moveToHero();
                }
              }
            } else {
              if (!heroHasEntered) continue;
              heroStop();
              var he = entries[hi];
              if (window.grrabBrowser &&
                  window.grrabBrowser.at === "hero" &&
                  he.boundingClientRect.top < 0) {
                if (rowBIntersecting()) {
                  window.grrabBrowser.moveToRowB(window.grrabBrowser.playRowB);
                } else if (rowAIntersecting()) {
                  window.grrabBrowser.moveToRowA(window.grrabBrowser.playRowA);
                }
              }
            }
          }
        }, { threshold: 0.6 }).observe(heroTop);
      } else {
        heroPlay();
      }
    }
  }

  /* ──────────────────── ROW B — EDIT-MODE DEMO ──────────────────── */
  var rowBMockupWrap = document.querySelector(".rowB-mockup-wrap");
  var rowBCursor = rowBMockupWrap ? rowBMockupWrap.querySelector(".rowB-cursor") : null;
  var rowBTip = document.getElementById("rowBTip");
  var rowBCards = [].slice.call(document.querySelectorAll(".rowB-card"));
  var rowBChrome = null;
  var rowBBody = null;
  var rowBFigure = null;
  var rowBHandle = null;
  var rowBClip = null;
  var rowBOverlay = null;
  var rowBOverlayImg = null;
  var rowBOverlayAfter = null;
  var rowBOverlayBtn = null;
  var rowBActUpscale = null;
  var rowBActs = [];
  var rowBLateActs = [];
  var rowBMarquee = null;
  var rowBBusy = null;
  var rowBBusyText = null;
  var rowBOverlayBtnIcon = null;
  var rowBOverlayBtnLabel = null;
  var rowBHint = null;
  var rowBTiles = [];

  if (rowBMockupWrap && rowBCursor && rowBCards.length) {
    var rowBRefreshBrowser = function(){
      var chrome = (rowBMockupWrap && rowBMockupWrap.querySelector(".hero-chrome")) ||
        document.querySelector(".hero-mockup-wrap .hero-chrome");
      rowBChrome = chrome;
      rowBBody = chrome ? chrome.querySelector(".hero-body") : null;
      rowBTiles = rowBBody ? [].slice.call(rowBBody.querySelectorAll(".hero-tile")) : [];
      rowBFigure = document.querySelector(".hero-overlay-figure");
      rowBHandle = document.getElementById("heroHandle");
      rowBClip = document.querySelector(".hero-slider-clip");
      rowBOverlay = document.getElementById("heroOverlay");
      rowBOverlayImg = document.getElementById("heroOverlayImg");
      rowBOverlayAfter = document.getElementById("heroOverlayAfter");
      rowBOverlayBtn = document.getElementById("heroOverlayBtn");
      rowBActUpscale = document.getElementById("heroActUpscale");
      rowBActs = [].slice.call(document.querySelectorAll(".hero-overlay-act"));
      rowBLateActs = rowBOverlay
        ? [].slice.call(rowBOverlay.querySelectorAll(".hero-overlay-act--late"))
        : [];
      rowBMarquee = document.getElementById("heroMarquee");
      rowBBusy = document.getElementById("heroBusy");
      rowBBusyText = document.getElementById("heroBusyText");
      rowBOverlayBtnIcon = document.getElementById("heroOverlayBtnIcon");
      rowBOverlayBtnLabel = document.getElementById("heroOverlayBtnLabel");
      rowBHint = document.getElementById("heroHint");
      if (rowBCursor && rowBMockupWrap && rowBMockupWrap.offsetWidth) {
        rowBCursor.style.setProperty("--rowB-u", "calc(" + rowBMockupWrap.offsetWidth + "px / 593)");
      }
      return rowBBody;
    };
    var rowBSteps = [
      { tile:0, img:"/assets/landing/img/hero-image-1-before.webp", ratio:"2000/1333",
        icon:"/assets/landing/icons/rowB/icon_removebg.svg", label:"Remove BG", alpha:true },
      /* "Remove" is the extension's own wording for the erase action, and it is written
         out again in the hero's heroSetAction — change both together. */
      { tile:5, img:"/assets/landing/img/hero-image-7-before.webp", ratio:"2000/1335",
        icon:"/assets/landing/icons/rowB/icon_erase.svg", label:"Remove",
        box:{ l:0.39, t:0.38, r:0.59, b:0.65 } },
      /* The bottom bar's Upscale, not the top button — target says which. The images are
         a stand-in: 5-before and 5-after are currently identical, so the wipe runs but
         shows no change. Replacing them is part of the final asset pass. */
      { tile:3, img:"/assets/landing/img/hero-image-8-before.webp", ratio:"999/666",
        icon:"/assets/landing/icons/rowB/icon_upscale.svg", label:"Upscale",
        busy:"Upscaling…", target:"upscale" }
    ];
    /* Row B keeps icon and label on the step, unlike the hero: a card click chooses the
       pass, so which label the drag switches TO depends on the card. Card 1 has no drag
       and stays on Remove BG throughout. */
    var rowBSetAction = function(step, erasing){
      if (rowBBusyText) rowBBusyText.textContent = step.busy || "Removing…";
      if (rowBOverlayBtnIcon) rowBOverlayBtnIcon.setAttribute("src",
        erasing ? step.icon : "/assets/landing/icons/rowB/icon_removebg.svg");
      if (rowBOverlayBtnLabel) rowBOverlayBtnLabel.textContent =
        erasing ? step.label : "Remove BG";
      if (rowBHint) {
        if (erasing) rowBHint.classList.add("hero-hint--off");
        else rowBHint.classList.remove("hero-hint--off");
      }
    };
    var rowBTimers = [];
    var rowBLateTimer = 0;
    var rowBRaf = 0;
    var rowBCurrent = 0;
    var rowBLive = false;
    var rowBDone = false;
    var rowBSplitDragging = false;
    var rowBReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

    var rowBClearTimers = function(){
      for (var i = 0; i < rowBTimers.length; i++) clearTimeout(rowBTimers[i]);
      rowBTimers = [];
      rowBLateTimer = 0;
    };
    var rowBStop = function(){
      rowBClearTimers();
      rowBReset();
    };
    var rowBAt = function(ms, fn){ rowBTimers.push(setTimeout(fn, ms)); };

    var rowBHotOnly = function(tile){
      for (var i = 0; i < rowBTiles.length; i++){
        if (rowBTiles[i] === tile) rowBTiles[i].classList.add("hero-tile--hot");
        else rowBTiles[i].classList.remove("hero-tile--hot");
      }
    };

    var rowBTrack = function(durationMs){
      var started = Date.now();
      var tick = function(){
        var r = rowBCursor.getBoundingClientRect();
        var under = document.elementFromPoint(r.left, r.top);
        rowBHotOnly(under && under.closest ? under.closest(".hero-tile") : null);
        if (Date.now() - started < durationMs) rowBRaf = requestAnimationFrame(tick);
        else rowBRaf = 0;
      };
      rowBRaf = requestAnimationFrame(tick);
    };

    var rowBMoveTo = function(x, y){
      rowBCursor.style.transform = "translate(" + x + "px," + y + "px)";
    };
    /* offsetLeft, not getBoundingClientRect. Below 1200px the row is scaled, so a screen
       rect already carries that factor — and the cursor's translate() is then scaled by
       it again, landing at about 0.68 of the intended distance. Offsets are layout
       pixels and the transform applies to them exactly once. */
    var rowBOffsetIn = function(el){
      var x = 0, y = 0, n = el;
      while (n && n !== rowBMockupWrap) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x: x, y: y };
    };
    var rowBPointIn = function(el){
      var o = rowBOffsetIn(el);
      return { x: o.x + el.offsetWidth / 2, y: o.y + el.offsetHeight / 2 };
    };
    var rowBBoxPoint = function(fx, fy){
      var o = rowBOffsetIn(rowBOverlayImg);
      return { x: o.x + rowBOverlayImg.offsetWidth * fx,
               y: o.y + rowBOverlayImg.offsetHeight * fy };
    };
    var rowBDragTrack = function(box, durationMs){
      var started = Date.now();
      var tick = function(){
        var fr = rowBOverlayImg.getBoundingClientRect();
        var cr = rowBCursor.getBoundingClientRect();
        if (fr.width && fr.height) {
          var w = Math.max(0, Math.min((cr.left - fr.left) / fr.width, 1) - box.l);
          var h = Math.max(0, Math.min((cr.top - fr.top) / fr.height, 1) - box.t);
          rowBMarquee.style.width = (w * 100) + "%";
          rowBMarquee.style.height = (h * 100) + "%";
        }
        if (Date.now() - started < durationMs) rowBRaf = requestAnimationFrame(tick);
        else rowBRaf = 0;
      };
      rowBRaf = requestAnimationFrame(tick);
    };
    /* The press is NOT released on a timer any more. It stays down for as long as the
       spinner runs, which is what makes the button read as busy rather than as a
       click that already finished. rowBReveal is the single point where both end. */
    /* Two buttons can be pressed in this mockup: the top action button, and the bottom
       bar's Upscale on the third card. The class prefixes differ, so the target carries
       both. */
    var rowBTargetEl = function(){
      var s = rowBSteps[rowBCurrent];
      return (s && s.target === "upscale") ? rowBActUpscale : rowBOverlayBtn;
    };
    var rowBTargetCls = function(){
      var s = rowBSteps[rowBCurrent];
      return (s && s.target === "upscale") ? "hero-overlay-act" : "hero-overlay-btn";
    };
    var rowBHover = function(){
      var el = rowBTargetEl();
      if (el) el.classList.add(rowBTargetCls() + "--hover");
    };
    var rowBPress = function(){
      var el = rowBTargetEl();
      if (el) el.classList.add(rowBTargetCls() + "--press");
      if (rowBBusy) rowBBusy.classList.add("hero-busy--on");
      if (rowBMarquee) {
        rowBMarquee.classList.remove("hero-marquee--on");
        rowBMarquee.style.width = "0%";
        rowBMarquee.style.height = "0%";
      }
    };
    var rowBReveal = function(){
      if (rowBBusy) rowBBusy.classList.remove("hero-busy--on");
      var el = rowBTargetEl();
      if (el) el.classList.remove(rowBTargetCls() + "--press");
      if (rowBMarquee) rowBMarquee.classList.remove("hero-marquee--on");
      if (rowBClip) rowBClip.classList.add("hero-slider-clip--wipe");
      if (rowBHandle) {
        rowBHandle.style.transition = "none";
        rowBHandle.style.left = "100%";
        void rowBHandle.offsetWidth;
        rowBHandle.style.transition = "";
        rowBHandle.style.left = "0%";
      }
      if (rowBOverlayAfter) rowBOverlayAfter.classList.add("hero-overlay-after--in");
      if (rowBLateTimer) { clearTimeout(rowBLateTimer); rowBLateTimer = 0; }
      rowBLateTimer = setTimeout(function(){
        rowBLateTimer = 0;
        if (rowBLateActs) {
          rowBLateActs.forEach(function(el){ el.classList.add("hero-overlay-act--in"); });
        }
        var s = rowBSteps[rowBCurrent];
        if (rowBActUpscale && s && s.target === "upscale") {
          rowBActUpscale.classList.remove("hero-overlay-act--hover");
          rowBActUpscale.classList.add("hero-overlay-act--ghost");
        }
      }, 1400);
      rowBTimers.push(rowBLateTimer);
    };
    var rowBSetSplit = function(f){
      if (!rowBOverlayAfter) return;
      f = Math.max(0, Math.min(1, f));
      var clip = "inset(0 0 0 " + (f * 100) + "%)";
      rowBOverlayAfter.style.clipPath = clip;
      rowBOverlayAfter.style.webkitClipPath = clip;
      if (rowBHandle) rowBHandle.style.left = (f * 100) + "%";
    };
    var rowBEnterLive = function(){
      rowBLive = true;
      rowBDone = true;
      rowBCursor.classList.remove("rowB-cursor--on");
      /* The hover goes with the cursor. Live mode is a handover, not a reset, so
         rowBReset's own removal never runs on this path. */
      var el = rowBTargetEl();
      if (el) el.classList.remove(rowBTargetCls() + "--hover");
      if (rowBClip) rowBClip.classList.remove("hero-slider-clip--wipe");
      if (rowBHandle) rowBHandle.style.transition = "";
      if (rowBChrome) rowBChrome.classList.add("hero-chrome--live");
      rowBOverlay.classList.add("hero-overlay--live");
      rowBSetSplit(0);
    };

    var rowBReset = function(){
      rowBRefreshBrowser();
      if (rowBRaf) { cancelAnimationFrame(rowBRaf); rowBRaf = 0; }
      rowBLive = false;
      rowBSplitDragging = false;
      if (rowBLateTimer) { clearTimeout(rowBLateTimer); rowBLateTimer = 0; }
      if (rowBLateActs) {
        rowBLateActs.forEach(function(el){ el.classList.remove("hero-overlay-act--in"); });
      }
      if (rowBChrome) rowBChrome.classList.remove("hero-chrome--live");
      rowBOverlay.classList.remove("hero-overlay--live");
      if (rowBClip) rowBClip.classList.remove("hero-slider-clip--wipe");
      if (rowBHandle) {
        rowBHandle.style.transition = "none";
        rowBHandle.style.left = "0%";
      }
      rowBOverlay.classList.remove("hero-overlay--on");
      rowBCursor.classList.remove("rowB-cursor--on");
      if (rowBTip) rowBTip.classList.remove("rowB-tip--in");
      if (rowBOverlayBtn) {
        rowBOverlayBtn.classList.remove("hero-overlay-btn--press");
        rowBOverlayBtn.classList.remove("hero-overlay-btn--hover");
      }
      if (rowBActUpscale) {
        rowBActUpscale.classList.remove("hero-overlay-act--press");
        rowBActUpscale.classList.remove("hero-overlay-act--hover");
        rowBActUpscale.classList.remove("hero-overlay-act--ghost");
      }
      if (rowBBusy) rowBBusy.classList.remove("hero-busy--on");
      if (rowBHint) rowBHint.classList.remove("hero-hint--off");
      if (rowBOverlayAfter) {
        rowBOverlayAfter.style.clipPath = "";
        rowBOverlayAfter.style.webkitClipPath = "";
        rowBOverlayAfter.style.transition = "none";
        rowBOverlayAfter.classList.remove("hero-overlay-after--in");
        void rowBOverlayAfter.offsetWidth;
        rowBOverlayAfter.style.transition = "";
      }
      if (rowBMarquee) {
        rowBMarquee.classList.remove("hero-marquee--on");
        rowBMarquee.style.width = "0%";
        rowBMarquee.style.height = "0%";
      }
      for (var i = 0; i < rowBTiles.length; i++) rowBTiles[i].classList.remove("hero-tile--hot");
    };

    var rowBPlay = function(index){
      if (window.grrabBrowser && window.grrabBrowser.stopHero) window.grrabBrowser.stopHero();
      if (window.grrabBrowser && window.grrabBrowser.stopRowA) window.grrabBrowser.stopRowA();
      rowBRefreshBrowser();
      if (!rowBOverlayImg) return;
      var step = rowBSteps[index];
      if (!step) return;
      var tile = rowBTiles[step.tile];
      if (!tile) return;
      rowBClearTimers();
      rowBReset();
      rowBCurrent = index;
      rowBDone = false;

      rowBOverlayImg.setAttribute("src", step.img);
      if (rowBOverlayAfter) {
        rowBOverlayAfter.setAttribute("src", step.img.replace(/-before\.(webp|jpe?g)$/, "-after.$1"));
        if (step.alpha) rowBOverlayAfter.classList.add("hero-overlay-after--alpha");
        else rowBOverlayAfter.classList.remove("hero-overlay-after--alpha");
      }
      rowBSetAction(step, false);
      for (var c = 0; c < rowBCards.length; c++){
        if (c === index) rowBCards[c].classList.add("rowB-card--active");
        else rowBCards[c].classList.remove("rowB-card--active");
      }

      if (rowBReduce && rowBReduce.matches) {
        tile.classList.add("hero-tile--hot");
        rowBOverlay.classList.add("hero-overlay--on");
        rowBReveal();
        rowBEnterLive();
        return;
      }

      if (!rowBBody.offsetWidth || !rowBBody.offsetHeight) return;
      rowBCursor.style.transition = "none";
      rowBCursor.style.transform = "translate(" + (rowBBody.offsetWidth * 0.86) + "px," +
                                                  (rowBBody.offsetHeight * 0.92) + "px)";
      void rowBCursor.offsetWidth;
      rowBCursor.style.transition = "";

      rowBAt(60, function(){
        if (!tile.offsetWidth) return;
        rowBCursor.classList.add("rowB-cursor--on");
        var p = rowBPointIn(tile);
        rowBMoveTo(p.x, p.y);
        rowBTrack(790);
      });
      rowBAt(880, function(){
        if (rowBRaf) { cancelAnimationFrame(rowBRaf); rowBRaf = 0; }
        rowBHotOnly(tile);
      });
      rowBAt(1180, function(){ if (rowBTip) rowBTip.classList.add("rowB-tip--in"); });
      rowBAt(1520, function(){ if (rowBTip) rowBTip.classList.remove("rowB-tip--in"); });
      rowBAt(1820, function(){ rowBOverlay.classList.add("hero-overlay--on"); });

      if (!step.box) {
        rowBAt(2100, function(){
          var el = rowBTargetEl();
          if (!el) return;
          var p = rowBPointIn(el);
          rowBMoveTo(p.x, p.y);
        });
        rowBAt(2850, rowBHover);
        rowBAt(3250, rowBPress);
        rowBAt(4250, rowBReveal);
        rowBAt(6140, rowBEnterLive);
      } else {
        rowBAt(2100, function(){
          var p = rowBBoxPoint(step.box.l, step.box.t);
          rowBMoveTo(p.x, p.y);
        });
        rowBAt(2800, function(){
          if (!rowBMarquee) return;
          rowBMarquee.style.left = (step.box.l * 100) + "%";
          rowBMarquee.style.top = (step.box.t * 100) + "%";
          rowBMarquee.style.width = "0%";
          rowBMarquee.style.height = "0%";
          rowBMarquee.classList.add("hero-marquee--on");
          var p = rowBBoxPoint(step.box.r, step.box.b);
          rowBMoveTo(p.x, p.y);
          rowBDragTrack(step.box, 820);
        });
        rowBAt(3650, function(){
          if (rowBRaf) { cancelAnimationFrame(rowBRaf); rowBRaf = 0; }
          rowBSetAction(step, true);
          if (!rowBMarquee) return;
          rowBMarquee.style.width = ((step.box.r - step.box.l) * 100) + "%";
          rowBMarquee.style.height = ((step.box.b - step.box.t) * 100) + "%";
        });
        rowBAt(3850, function(){
          if (!rowBOverlayBtn) return;
          var p = rowBPointIn(rowBOverlayBtn);
          rowBMoveTo(p.x, p.y);
        });
        rowBAt(4600, rowBHover);
        rowBAt(5000, rowBPress);
        rowBAt(6000, rowBReveal);
        rowBAt(7890, rowBEnterLive);
      }
    };

    rowBCards.forEach(function(card, i){
      card.addEventListener("click", function(){ rowBPlay(i); });
    });

    var rowBLiveFigure = document.querySelector(".hero-overlay-figure");
    if (rowBLiveFigure) {
      var rowBSplitFrom = function(clientX){
        if (!rowBOverlayImg) return;
        var r = rowBOverlayImg.getBoundingClientRect();
        if (!r.width) return;
        rowBSetSplit((clientX - r.left) / r.width);
      };
      rowBLiveFigure.addEventListener("dragstart", function(e){ e.preventDefault(); });
      var rowBOnChrome = function(target){
        return !!(target && target.closest &&
          target.closest(".hero-overlay-btn, .hero-overlay-act"));
      };
      rowBLiveFigure.addEventListener("pointerdown", function(e){
        if (!rowBLive) return;
        if (rowBOnChrome(e.target)) return;
        e.preventDefault();
        rowBSplitDragging = true;
        try { rowBLiveFigure.setPointerCapture(e.pointerId); } catch(_){}
        rowBSplitFrom(e.clientX);
      });
      rowBLiveFigure.addEventListener("pointermove", function(e){
        if (rowBLive && rowBSplitDragging) rowBSplitFrom(e.clientX);
      });
      rowBLiveFigure.addEventListener("pointerup", function(e){
        rowBSplitDragging = false;
        try { rowBLiveFigure.releasePointerCapture(e.pointerId); } catch(_){}
      });
      rowBLiveFigure.addEventListener("pointercancel", function(){ rowBSplitDragging = false; });
    }

    var rowBRow = document.querySelector(".grrab-rowB");
    if (rowBRow && "IntersectionObserver" in window) {
      var rowBHasEntered = false;
      new IntersectionObserver(function(entries){
        for (var i = 0; i < entries.length; i++){
          if (rowBDone) continue;
          if (entries[i].isIntersecting) {
            rowBHasEntered = true;
            if (window.grrabBrowser && window.grrabBrowser.at === "rowA") {
              window.grrabBrowser.moveToRowB(function(){ rowBPlay(rowBCurrent); });
            } else if (window.grrabBrowser && window.grrabBrowser.at === "hero") {
              window.grrabBrowser.moveToRowB(function(){ rowBPlay(rowBCurrent); });
            } else if (!window.grrabBrowser || window.grrabBrowser.at === "rowB") {
              rowBPlay(rowBCurrent);
            }
          } else {
            if (!rowBHasEntered) continue;
            rowBStop();
            if (window.grrabBrowser && entries[i].boundingClientRect.top > 0) {
              if (window.grrabBrowser.rowAIntersecting) {
                window.grrabBrowser.moveToRowA(window.grrabBrowser.playRowA);
              } else {
                window.grrabBrowser.moveToHero();
              }
            }
          }
        }
      }, { threshold: 0.6 }).observe(rowBRow);
    }

    if (window.grrabBrowser) {
      window.grrabBrowser.stopRowB = rowBStop;
      window.grrabBrowser.playRowB = function(){ rowBPlay(rowBCurrent); };
    }
  }

  /* ─────────────────────────── ROW B — SOURCE SWITCHER ─────────────────────────── */
  var inspireConfig = [
    {id:"youtube",  label:"YouTube.",  desc:"Thumbnails from feed or video page.",  previewLabel:"YouTube grab preview",  name:"Youtube",   short:"YT", tint:"#FF0000", preview:"/assets/landing/img/youtube_preview.webp",
     icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.9-.5-5.6a2.9 2.9 0 0 0-2-2C18.8 4 12 4 12 4s-6.8 0-8.5.4a2.9 2.9 0 0 0-2 2C1 8.1 1 12 1 12s0 3.9.5 5.6a2.9 2.9 0 0 0 2 2C5.2 20 12 20 12 20s6.8 0 8.5-.4a2.9 2.9 0 0 0 2-2C23 15.9 23 12 23 12Z"/><polygon points="9.8 15.2 15.5 12 9.8 8.8" fill="#fff"/></svg>'},
    {id:"instagram",label:"Instagram.",desc:"Posts, and frames from reels.",        previewLabel:"Instagram grab preview",name:"Instagram", short:"IG", tint:"#C13584", preview:"/assets/landing/img/instagram_preview.webp",
     icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>'},
    {id:"pinterest",label:"Pinterest.",desc:"Any pin, without opening it.",    previewLabel:"Pinterest grab preview",name:"Pinterest", short:"P",  tint:"#E60023", preview:"/assets/landing/img/pinterest_preview.webp",
     icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-4.9s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.5 2.2-.8 3.4-.2.9.5 1.7 1.4 1.7 1.7 0 2.9-2.2 2.9-4.7 0-2-1.3-3.4-3.7-3.4a4.2 4.2 0 0 0-4.4 4.2c0 .8.2 1.4.6 1.8.2.2.2.3.1.5l-.2.8c0 .3-.2.3-.5.2-1.3-.5-1.9-2-1.9-3.6 0-2.7 2.3-5.9 6.7-5.9 3.6 0 5.9 2.6 5.9 5.3 0 3.6-2 6.4-5 6.4-1 0-2-.6-2.3-1.2l-.6 2.5c-.2.8-.7 1.7-1 2.3A10 10 0 1 0 12 2Z"/></svg>'},
    {id:"video",    label:"Any video.",     desc:"Whatever frame is on screen.", previewLabel:"Video grab preview",   name:"Video",     short:"V",  tint:"#BC13FE", preview:"/assets/landing/img/rowC/video-main.webp",
     icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 4C1.34315 4 0 5.34315 0 7V17C0 18.6569 1.34315 20 3 20H13C14.6569 20 16 18.6569 16 17V14.5307L20.7286 18.4249C22.0334 19.4994 24.0001 18.5713 24.0001 16.8811V7.28972C24.0001 5.54447 21.9211 4.63648 20.6408 5.8226L16 10.1222V7C16 5.34315 14.6569 4 13 4H3Z" fill="currentColor"/></svg>'}
  ];
  var activeInspire = "youtube";
  var listEl = document.getElementById("inspireList");
  var panesEl = document.getElementById("inspirePanes");
  var tabHeaderEl = document.getElementById("inspireTabHeader");
  var tabIcon = document.getElementById("tabIcon");
  var tabLabel = document.getElementById("tabLabel");
  var rowEls = {}, paneEls = {}, iconWrapEls = {};

  function browserChromeHtml(opts){
    return '<div class="rowC-header">'+
            '<div class="browser-traffic"><span class="browser-dot browser-dot--red"></span><span class="browser-dot browser-dot--yellow"></span><span class="browser-dot browser-dot--green"></span></div>'+
            '<div class="rowC-urlbar">'+
              '<div class="browser-tab-platform">'+
                '<span class="browser-tab-label">'+opts.label+'</span>'+
              '</div>'+
            '</div>'+
            '<div class="rowC-profile-logo"><img src="/assets/landing/grrab-logo.svg" alt="Grrab"></div>'+
          '</div>';
  }

  function browserMockupHtml(opts){
    return '<div class="browser-mockup-wrap" aria-hidden="true">'+
        '<div class="browser-frame">'+
          browserChromeHtml(opts)+
          opts.bodyHtml+
        '</div>'+
    '</div>';
  }

  function youtubeBodyHtml(){
    var chips = ["All","Music","Podcasts","Live","Playlists","CSS","User interface design","Electropop","Smooth Jazz","Variety shows","Ideas","Ambient Music","Visual arts","Comedy","AI","Motion Graphic","Digital Design"];
    var chipHtml = chips.map(function(c,i){
      return '<span class="yt-chip'+(i===0?' yt-chip--active':' yt-chip--idle')+'">'+c+'</span>';
    }).join('');
    return '<div class="yt-body">'+
            '<aside class="yt-sidebar">'+
              '<div class="yt-sidebar-menu"><span class="yt-sidebar-menu-icon"><img class="yt-slot-img" src="/assets/landing/icons/icon_hamburgerbar.svg" alt=""></span></div>'+
              '<nav class="yt-sidebar-nav">'+
                '<div class="yt-sidebar-item"><span class="yt-sidebar-icon yt-sidebar-icon--home"><img class="yt-slot-img" src="/assets/landing/icons/icon_home.svg" alt=""></span><span class="yt-sidebar-label">Home</span></div>'+
                '<div class="yt-sidebar-item"><span class="yt-sidebar-icon yt-sidebar-icon--shorts"><img class="yt-slot-img" src="/assets/landing/icons/icon_shorts.svg" alt=""></span><span class="yt-sidebar-label">Shorts</span></div>'+
                '<div class="yt-sidebar-item"><span class="yt-sidebar-icon yt-sidebar-icon--subs"><img class="yt-slot-img" src="/assets/landing/icons/icon_subscriptions.svg" alt=""></span><span class="yt-sidebar-label">Subscriptions</span></div>'+
                '<div class="yt-sidebar-item"><span class="yt-sidebar-icon yt-sidebar-icon--you"><img class="yt-slot-img" src="/assets/landing/icons/icon_you.svg" alt=""></span><span class="yt-sidebar-label">You</span></div>'+
              '</nav>'+
            '</aside>'+
            '<div class="yt-main">'+
              '<div class="yt-topbar">'+
                '<div class="yt-logo"><img class="yt-slot-img" src="/assets/landing/icons/logo_youtube.webp" alt=""></div>'+
                '<div class="yt-search-wrap"><div class="yt-search"><div class="yt-search-input"><span>Search</span></div><div class="yt-search-btn"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></div></div></div>'+
                '<div class="yt-topbar-right"></div>'+
              '</div>'+
              '<div class="yt-chips">'+chipHtml+'</div>'+
              '<div class="yt-feed">'+
                '<div class="yt-videos">'+
                  '<div class="yt-video-card">'+
                    '<div class="yt-thumb yt-thumb--glow"><img src="/assets/landing/img/rowC/image-1.webp" alt=""><span class="mock-pointer" style="left:58%;top:42%;"><img src="/assets/landing/icons/rowC/icon_cursor.svg" alt=""></span></div>'+
                    '<div class="yt-meta"><span class="yt-meta-avatar"></span><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div>'+
                  '</div>'+
                  '<div class="yt-video-card yt-video-card--dim">'+
                    '<div class="yt-thumb"><img src="/assets/landing/img/rowC/image-2.webp" alt=""></div>'+
                    '<div class="yt-meta"><span class="yt-meta-avatar"></span><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div>'+
                  '</div>'+
                  '<div class="yt-video-card yt-video-card--dim">'+
                    '<div class="yt-thumb"><img src="/assets/landing/img/rowC/image-3.webp" alt=""></div>'+
                    '<div class="yt-meta"><span class="yt-meta-avatar"></span><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div>'+
                  '</div>'+
                '</div>'+
                '<div class="yt-shorts-section">'+
                  '<div class="yt-shorts-label"><img class="yt-shorts-icon" src="/assets/landing/icons/icon_main_shorts.svg" alt="">Shorts</div>'+
                  '<div class="yt-shorts">'+
                    '<div class="yt-short-card"><div class="yt-thumb yt-thumb--short"><img src="/assets/landing/img/rowC/shorts-1.webp" alt=""></div><div class="yt-meta"><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div></div>'+
                    '<div class="yt-short-card"><div class="yt-thumb yt-thumb--short"><img src="/assets/landing/img/rowC/shorts-2.webp" alt=""></div><div class="yt-meta"><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div></div>'+
                    '<div class="yt-short-card"><div class="yt-thumb yt-thumb--short"><img src="/assets/landing/img/rowC/shorts-3.webp" alt=""></div><div class="yt-meta"><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div></div>'+
                    '<div class="yt-short-card"><div class="yt-thumb yt-thumb--short"><img src="/assets/landing/img/rowC/shorts-4.webp" alt=""></div><div class="yt-meta"><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div></div>'+
                    '<div class="yt-short-card"><div class="yt-thumb yt-thumb--short"><img src="/assets/landing/img/rowC/shorts-5.webp" alt=""></div><div class="yt-meta"><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div></div>'+
                  '</div>'+
                '</div>'+
                '<div class="yt-videos">'+
                  '<div class="yt-video-card yt-video-card--dim">'+
                    '<div class="yt-thumb"><img src="/assets/landing/img/rowC/image-4.webp" alt=""></div>'+
                    '<div class="yt-meta"><span class="yt-meta-avatar"></span><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div>'+
                  '</div>'+
                  '<div class="yt-video-card yt-video-card--dim">'+
                    '<div class="yt-thumb"><img src="/assets/landing/img/rowC/image-5.webp" alt=""></div>'+
                    '<div class="yt-meta"><span class="yt-meta-avatar"></span><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div>'+
                  '</div>'+
                  '<div class="yt-video-card yt-video-card--dim">'+
                    '<div class="yt-thumb"><img src="/assets/landing/img/rowC/image-6.webp" alt=""></div>'+
                    '<div class="yt-meta"><span class="yt-meta-avatar"></span><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div>'+
                  '</div>'+
                '</div>'+
                '<div class="yt-videos">'+
                  '<div class="yt-video-card yt-video-card--dim">'+
                    '<div class="yt-thumb"><img src="/assets/landing/img/rowC/image-7.webp" alt=""></div>'+
                    '<div class="yt-meta"><span class="yt-meta-avatar"></span><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div>'+
                  '</div>'+
                  '<div class="yt-video-card yt-video-card--dim">'+
                    '<div class="yt-thumb"><img src="/assets/landing/img/rowC/image-8.webp" alt=""></div>'+
                    '<div class="yt-meta"><span class="yt-meta-avatar"></span><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div>'+
                  '</div>'+
                  '<div class="yt-video-card yt-video-card--dim">'+
                    '<div class="yt-thumb"><img src="/assets/landing/img/rowC/image-9.webp" alt=""></div>'+
                    '<div class="yt-meta"><span class="yt-meta-avatar"></span><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div>'+
                  '</div>'+
                '</div>'+
              '</div>'+
            '</div>'+
          '</div>';
  }

  function youtubeMockupHtml(){
    return browserMockupHtml({
      label: 'youtube.com',
      bodyHtml: youtubeBodyHtml()
    });
  }

  function igFeedCardHtml(dim, glow, img){
    var cardClass = 'ig-feed-card'+(dim?' ig-feed-card--dim':'');
    var thumbClass = 'ig-feed-thumb'+(glow?' ig-feed-thumb--glow':'');
    var pointerHtml = glow ? '<span class="mock-pointer" style="left:52%;top:36%;"><img src="/assets/landing/icons/rowC/icon_cursor.svg" alt=""></span>' : '';
    var ig = '/assets/landing/icons/instagram/';
    return '<div class="'+cardClass+'">'+
      '<div class="ig-feed">'+
        '<div class="ig-feed-header">'+
          '<div class="ig-feed-profile">'+
            '<div class="ig-feed-profile-avatar"></div>'+
            '<div class="ig-feed-profile-lines">'+
              '<div class="ig-feed-profile-line"></div>'+
              '<span class="ig-feed-profile-sub">Suggested for you</span>'+
            '</div>'+
          '</div>'+
          '<div class="ig-feed-btn">'+
            '<div class="ig-feed-follow"><span>Follow</span></div>'+
            '<span class="ig-feed-menubar"><img class="ig-slot-img" src="'+ig+'icon_menubar.svg" alt=""></span>'+
          '</div>'+
        '</div>'+
        '<div class="'+thumbClass+'">'+(img?'<img src="'+img+'" alt="">':'')+pointerHtml+'</div>'+
      '</div>'+
      '<div class="ig-meta">'+
        '<div class="ig-chips-wrap">'+
          '<div class="ig-chips-left">'+
            '<span class="ig-chip"><span class="ig-chip-icon ig-chip-icon--likes"><img class="ig-slot-img" src="'+ig+'icon_likes.svg" alt=""></span><span class="ig-chip-count">1.1K</span></span>'+
            '<span class="ig-chip"><span class="ig-chip-icon ig-chip-icon--reply"><img class="ig-slot-img" src="'+ig+'icon_reply.svg" alt=""></span><span class="ig-chip-count">4</span></span>'+
            '<span class="ig-chip"><span class="ig-chip-icon ig-chip-icon--retweet"><img class="ig-slot-img" src="'+ig+'icon_retweet.svg" alt=""></span><span class="ig-chip-count">96</span></span>'+
            '<span class="ig-chip"><span class="ig-chip-icon ig-chip-icon--send"><img class="ig-slot-img" src="'+ig+'icon_send.svg" alt=""></span></span>'+
          '</div>'+
          '<div class="ig-chips-right">'+
            '<span class="ig-chip"><span class="ig-chip-icon ig-chip-icon--save"><img class="ig-slot-img" src="'+ig+'icon_save.svg" alt=""></span></span>'+
          '</div>'+
        '</div>'+
        '<div class="ig-meta-lines">'+
          '<span class="ig-meta-line"></span>'+
          '<span class="ig-meta-line ig-meta-line--short"></span>'+
        '</div>'+
      '</div>'+
    '</div>';
  }

  function igBodyHtml(){
    var ig = '/assets/landing/icons/instagram/';
    return '<div class="ig-body">'+
      '<aside class="ig-sidebar">'+
        '<div class="ig-logo"><img class="ig-slot-img" src="'+ig+'logo_instagram.svg" alt=""></div>'+
        '<nav class="ig-sidebar-nav">'+
          '<div class="ig-sidebar-item"><span class="ig-sidebar-icon ig-sidebar-icon--home"><img class="ig-slot-img" src="'+ig+'icon_home.svg" alt=""></span></div>'+
          '<div class="ig-sidebar-item"><span class="ig-sidebar-icon ig-sidebar-icon--shorts"><img class="ig-slot-img" src="'+ig+'icon_shorts.svg" alt=""></span></div>'+
          '<div class="ig-sidebar-item"><span class="ig-sidebar-icon ig-sidebar-icon--message"><img class="ig-slot-img" src="'+ig+'icon_message.svg" alt=""></span></div>'+
          '<div class="ig-sidebar-item"><span class="ig-sidebar-icon ig-sidebar-icon--search"><img class="ig-slot-img" src="'+ig+'icon_search.svg" alt=""></span></div>'+
          '<div class="ig-sidebar-item"><span class="ig-sidebar-icon ig-sidebar-icon--favorite"><img class="ig-slot-img" src="'+ig+'icon_favorite.svg" alt=""></span></div>'+
          '<div class="ig-sidebar-item"><span class="ig-sidebar-icon ig-sidebar-icon--add"><img class="ig-slot-img" src="'+ig+'icon_add.svg" alt=""></span></div>'+
          '<span class="ig-profile-avatar"><img class="ig-slot-img" src="/assets/landing/img/example_profile.webp" alt=""></span>'+
        '</nav>'+
        '<div class="ig-sidebar-footer">'+
          '<div class="ig-sidebar-item"><span class="ig-sidebar-icon ig-sidebar-icon--hamburgerbar"><img class="ig-slot-img" src="'+ig+'icon_hamburgerbar.svg" alt=""></span></div>'+
          '<div class="ig-sidebar-item"><span class="ig-sidebar-icon ig-sidebar-icon--category"><img class="ig-slot-img" src="'+ig+'icon_category.svg" alt=""></span></div>'+
        '</div>'+
      '</aside>'+
      '<div class="ig-main">'+
        igFeedCardHtml(false, true, '/assets/landing/img/rowC/ig-image-1.webp')+   // glow(active)
        igFeedCardHtml(true, false, '/assets/landing/img/rowC/ig-image-2.webp')+   // dim
      '</div>'+
    '</div>';
  }

  function instagramMockupHtml(){
    return browserMockupHtml({
      label: 'instagram.com',
      bodyHtml: igBodyHtml()
    });
  }

  function pinFeedCardHtml(ratio, dim, glow, img){
    var cls = 'pin-feed-card';
    if(dim) cls += ' pin-feed-card--dim';
    if(glow) cls += ' pin-feed-card--glow';
    var pointerHtml = glow ? '<span class="mock-pointer" style="left:42%;top:44%;"><img src="/assets/landing/icons/rowC/icon_cursor.svg" alt=""></span>' : '';
    return '<div class="'+cls+'" style="aspect-ratio:'+ratio+'">'+(img?'<img src="'+img+'" alt="">':'')+pointerHtml+'</div>';
  }

  function pinFeedColHtml(cards){
    return '<div class="pin-feed-col">'+cards.join('')+'</div>';
  }

  function pinBodyHtml(){
    var pin = '/assets/landing/icons/pinterest/';
    return '<div class="pin-body">'+
      '<aside class="pin-sidebar">'+
        '<div class="pin-logo"><img class="pin-slot-img" src="'+pin+'logo_pinterest.webp" alt=""></div>'+
        '<nav class="pin-sidebar-nav">'+
          '<div class="pin-sidebar-item"><span class="pin-sidebar-icon pin-sidebar-icon--home"><img class="pin-slot-img" src="'+pin+'icon_home.svg" alt=""></span></div>'+
          '<div class="pin-sidebar-item"><span class="pin-sidebar-icon pin-sidebar-icon--category"><img class="pin-slot-img" src="'+pin+'icon_category.svg" alt=""></span></div>'+
          '<div class="pin-sidebar-item"><span class="pin-sidebar-icon pin-sidebar-icon--add"><img class="pin-slot-img" src="'+pin+'icon_add.svg" alt=""></span></div>'+
          '<div class="pin-sidebar-item"><span class="pin-sidebar-icon pin-sidebar-icon--notification"><img class="pin-slot-img" src="'+pin+'icon_notification.svg" alt=""></span></div>'+
          '<div class="pin-sidebar-item"><span class="pin-sidebar-icon pin-sidebar-icon--message"><img class="pin-slot-img" src="'+pin+'icon_message.svg" alt=""></span></div>'+
        '</nav>'+
      '</aside>'+
      '<div class="pin-main">'+
        '<div class="pin-topbar">'+
          '<div class="pin-search">'+
            '<span class="pin-search-icon pin-search-icon--search"><img class="pin-slot-img" src="'+pin+'icon_search.svg" alt=""></span>'+
            '<div class="pin-search-input"><span class="pin-search-skeleton"></span></div>'+
            '<span class="pin-search-icon pin-search-icon--close"><img class="pin-slot-img" src="'+pin+'icon_close.svg" alt=""></span>'+
          '</div>'+
        '</div>'+
        '<div class="pin-feed">'+
          pinFeedColHtml([
            pinFeedCardHtml('115.25/160',    true, false, '/assets/landing/img/rowC/pin-image-1.webp'),
            pinFeedCardHtml('115.25/102.33', true, false, '/assets/landing/img/rowC/pin-image-2.webp'),
            pinFeedCardHtml('115.25/169',    true, false, '/assets/landing/img/rowC/pin-image-3.webp'),
            pinFeedCardHtml('115.25/132',    true, false, '/assets/landing/img/rowC/pin-image-13.webp'),
            pinFeedCardHtml('115.25/115.25', true, false, '/assets/landing/img/rowC/pin-image-14.webp')
          ])+
          pinFeedColHtml([
            pinFeedCardHtml('115.25/132',    false,  true,  '/assets/landing/img/rowC/pin-image-4.webp'),
            pinFeedCardHtml('115.25/132',    true, false, '/assets/landing/img/rowC/pin-image-5.webp'),
            pinFeedCardHtml('115.25/115.25', true, false, '/assets/landing/img/rowC/pin-image-6.webp'),
            pinFeedCardHtml('115.25/188',    true, false, '/assets/landing/img/rowC/pin-image-15.webp'),
            pinFeedCardHtml('115.25/169',    true, false, '/assets/landing/img/rowC/pin-image-16.webp')
          ])+
          pinFeedColHtml([
            pinFeedCardHtml('115.25/188',    true, false, '/assets/landing/img/rowC/pin-image-7.webp'),
            pinFeedCardHtml('115.25/115.25', true, false, '/assets/landing/img/rowC/pin-image-8.webp'),
            pinFeedCardHtml('115.25/115.25', true, false, '/assets/landing/img/rowC/pin-image-9.webp'),
            pinFeedCardHtml('115.25/160',    true, false, '/assets/landing/img/rowC/pin-image-17.webp'),
            pinFeedCardHtml('115.25/102.33', true, false, '/assets/landing/img/rowC/pin-image-18.webp')
          ])+
          pinFeedColHtml([
            pinFeedCardHtml('115.25/160',    true, false, '/assets/landing/img/rowC/pin-image-10.webp'),
            pinFeedCardHtml('115.25/169',    true, false, '/assets/landing/img/rowC/pin-image-11.webp'),
            pinFeedCardHtml('115.25/102.33', true, false, '/assets/landing/img/rowC/pin-image-12.webp'),
            pinFeedCardHtml('115.25/132',    true, false, '/assets/landing/img/rowC/pin-image-19.webp'),
            pinFeedCardHtml('115.25/115.25', true, false, '/assets/landing/img/rowC/pin-image-20.webp')
          ])+
        '</div>'+
      '</div>'+
    '</div>';
  }

  function pinterestMockupHtml(){
    return browserMockupHtml({
      label: 'pinterest.com',
      bodyHtml: pinBodyHtml()
    });
  }

  function vidDescLineHtml(pr, h){
    return '<div class="vid-desc-line" style="padding-right:calc('+pr+' / 645 * 100cqw);">'+
             '<span class="vid-desc-line-bar" style="height:calc('+h+' / 645 * 100cqw);"></span>'+
           '</div>';
  }

  function vidCommentHtml(color){
    return '<div class="vid-comment-box">'+
             '<span class="vid-comment-avatar" style="background:'+color+';"></span>'+
             '<div class="vid-comment-lines">'+
               '<div class="vid-comment-line"><span class="vid-comment-line-bar"></span></div>'+
               '<div class="vid-comment-line vid-comment-line--long"><span class="vid-comment-line-bar vid-comment-line-bar--long"></span></div>'+
             '</div>'+
           '</div>';
  }

  function vidRelatedCardHtml(img){
    return '<div class="vid-addition-card vid-addition-card--dim">'+
             '<div class="vid-card-thumb"><img src="'+img+'" alt=""></div>'+
             '<div class="vid-card-meta-lines">'+
               '<div class="vid-card-meta-line"><span class="vid-card-meta-line-bar"></span></div>'+
               '<div class="vid-card-meta-line vid-card-meta-line--short"><span class="vid-card-meta-line-bar vid-card-meta-line-bar--short"></span></div>'+
             '</div>'+
           '</div>';
  }

  function vidBodyHtml(){
    return '<div class="vid-body">'+
             '<div class="vid-main">'+
               '<div class="vid-topbar">'+
                 '<span class="vid-sidebar-menu"><img src="/assets/landing/icons/icon_menubar.svg" alt=""></span>'+
                 '<span class="vid-logo"><img src="/assets/landing/icons/rowC/icon_logo.svg" alt=""></span>'+
                 '<div class="vid-search-wrap">'+
                   '<div class="vid-search">'+
                     '<div class="vid-search-input"><span class="vid-search-text">Search</span></div>'+
                     '<div class="vid-search-btn"><img src="/assets/landing/icons/rowC/icon_search.svg" alt=""></div>'+
                   '</div>'+
                 '</div>'+
                 '<div class="vid-topbar-right"></div>'+
               '</div>'+
               '<div class="vid-screen">'+
                 '<div class="vid-screen-video vid-screen-video--glow">'+
                   '<img src="/assets/landing/img/rowC/video-main.webp" alt="">'+
                   '<span class="mock-pointer" style="left:calc(450.61 / 645 * 100cqw);top:calc(149 / 645 * 100cqw);"><img src="/assets/landing/icons/rowC/icon_cursor.svg" alt=""></span>'+
                 '</div>'+
                 '<div class="vid-screen-controller">'+
                   '<div class="vid-control-playbar"><div class="vid-playbar-played"><span class="vid-playbar-point"></span></div></div>'+
                   '<div class="vid-control-container">'+
                     '<div class="vid-control-left">'+
                       '<span class="vid-control-playbtn"><img src="/assets/landing/icons/rowC/icon_playbtn.svg" alt=""></span>'+
                       '<div class="vid-control-etc">'+
                         '<img class="vid-icon-volume" src="/assets/landing/icons/rowC/icon_volume.svg" alt="">'+
                         '<div class="vid-control-time"><span>0:00</span><span>/</span><span>15:01</span></div>'+
                       '</div>'+
                       '<div class="vid-control-chapter">'+
                         '<span class="vid-chapter-label">Intro</span>'+
                         '<img class="vid-icon-chapter" src="/assets/landing/icons/rowC/icon_chapter.svg" alt="">'+
                       '</div>'+
                     '</div>'+
                     '<div class="vid-control-right">'+
                       '<div class="vid-control-setting">'+
                         '<span class="vid-setting-relay"><img src="/assets/landing/icons/rowC/icon_relay.svg" alt=""></span>'+
                         '<img class="vid-icon-transcription" src="/assets/landing/icons/rowC/icon_transcription.svg" alt="">'+
                         '<img class="vid-icon-setting" src="/assets/landing/icons/rowC/icon_setting.svg" alt="">'+
                         '<img class="vid-icon-view" src="/assets/landing/icons/rowC/icon_view.svg" alt="">'+
                         '<img class="vid-icon-size" src="/assets/landing/icons/rowC/icon_size.svg" alt="">'+
                       '</div>'+
                     '</div>'+
                   '</div>'+
                 '</div>'+
               '</div>'+
             '</div>'+
             '<div class="vid-bottom">'+
               '<div class="vid-info">'+
                 '<div class="vid-meta">'+
                   '<div class="vid-meta-title"><span class="vid-meta-title-bar"></span></div>'+
                   '<div class="vid-meta-info">'+
                     '<div class="vid-meta-profile">'+
                       '<span class="vid-profile-avatar"></span>'+
                       '<div class="vid-profile-lines">'+
                         '<div class="vid-profile-line"><span class="vid-profile-line-bar"></span></div>'+
                         '<div class="vid-profile-line vid-profile-line--long"><span class="vid-profile-line-bar vid-profile-line-bar--long"></span></div>'+
                       '</div>'+
                     '</div>'+
                     '<div class="vid-meta-action">'+
                       '<div class="vid-action-react">'+
                         '<span class="vid-react-good"><img src="/assets/landing/icons/rowC/icon_react_good.svg" alt=""></span>'+
                         '<span class="vid-react-separator"></span>'+
                         '<span class="vid-react-bad"><img src="/assets/landing/icons/rowC/icon_react_bad.svg" alt=""></span>'+
                       '</div>'+
                       '<div class="vid-action-share"><img src="/assets/landing/icons/rowC/icon_share.svg" alt=""><span class="vid-action-label">Share</span></div>'+
                       '<div class="vid-action-save"><img src="/assets/landing/icons/rowC/icon_save.svg" alt=""><span class="vid-action-label">Save</span></div>'+
                       '<div class="vid-action-more"><img src="/assets/landing/icons/rowC/icon_more.svg" alt=""></div>'+
                     '</div>'+
                   '</div>'+
                 '</div>'+
                 '<div class="vid-description">'+
                   '<div class="vid-desc-lines">'+
                     vidDescLineHtml(120, 4)+
                     vidDescLineHtml(60, 4)+
                   '</div>'+
                   '<div class="vid-desc-lines">'+
                     vidDescLineHtml(0, 4.5)+
                     vidDescLineHtml(50, 4.5)+
                     vidDescLineHtml(100, 4)+
                   '</div>'+
                   '<div class="vid-desc-lines">'+
                     vidDescLineHtml(30, 4.5)+
                     vidDescLineHtml(200, 4.5)+
                     vidDescLineHtml(150, 4)+
                   '</div>'+
                   '<div class="vid-desc-lines">'+
                     vidDescLineHtml(120, 4)+
                     vidDescLineHtml(60, 4)+
                   '</div>'+
                 '</div>'+
                 '<div class="vid-comments">'+
                   '<span class="vid-comments-label">Comments</span>'+
                   '<div class="vid-comments-list">'+
                     vidCommentHtml('#FF5E57')+
                     vidCommentHtml('#27C940')+
                     vidCommentHtml('#BC13FE')+
                   '</div>'+
                 '</div>'+
               '</div>'+
               '<div class="vid-addition">'+
                 '<div class="vid-addition-chips">'+
                   '<span class="vid-addition-chip vid-addition-chip--active">All</span>'+
                   '<span class="vid-addition-chip vid-addition-chip--idle">Related</span>'+
                 '</div>'+
                 '<div class="vid-addition-list">'+
                   vidRelatedCardHtml('/assets/landing/img/rowC/video-image-1.webp')+
                   vidRelatedCardHtml('/assets/landing/img/rowC/video-image-2.webp')+
                   vidRelatedCardHtml('/assets/landing/img/rowC/video-image-3.webp')+
                   vidRelatedCardHtml('/assets/landing/img/rowC/video-image-4.webp')+
                 '</div>'+
               '</div>'+
             '</div>'+
           '</div>';
  }

  function videoMockupHtml(){
    return browserMockupHtml({
      label: 'youtube.com/watch/...',
      bodyHtml: vidBodyHtml()
    });
  }

  var mockupHtmlById = {
    youtube: youtubeMockupHtml,
    instagram: instagramMockupHtml,
    pinterest: pinterestMockupHtml,
    video: videoMockupHtml
  };

  inspireConfig.forEach(function(it){
    // list row
    var row = document.createElement("button");
    row.type = "button";
    row.className = "rowC-item";
    row.style.cssText = "display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;font:inherit;padding:14px 16px;border-radius:10px;background:transparent;border:none;outline:none;-webkit-appearance:none;appearance:none;transition:background .15s ease;";
    var iconWrap = document.createElement("span");
    iconWrap.className = "rowC-item-icon";
    iconWrap.style.cssText = "flex-shrink:0;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;color:var(--ink-muted);transition:color .15s ease;";
    iconWrap.innerHTML = it.icon;
    var txt = document.createElement("span");
    txt.className = "rowC-item-text";
    txt.style.cssText = "font-size:17px;line-height:1.45;color:var(--ink-muted);min-width:0;text-align:left;";
    /* The description was a bare text node, which cannot be hidden with CSS. Its own
       span is what lets the mobile rules drop it. */
    /* Two labels, one with the trailing stop and one without. It cannot be done in CSS —
       the stop is part of the string — and the config keeps its own value untouched. The
       hidden one is aria-hidden so the word is not announced twice. */
    var rowCBare = it.label.replace(/\.$/, "");
    txt.innerHTML = '<strong class="rowC-item-title" style="font-weight:700;color:var(--ink-strong);">'+
      '<span class="rowC-item-label">'+it.label+'</span>'+
      '<span class="rowC-item-label-bare" aria-hidden="true">'+rowCBare+'</span>'+
      '</strong> <span class="rowC-item-desc">'+it.desc+'</span>';
    row.appendChild(iconWrap); row.appendChild(txt);
    row.addEventListener("mouseenter", function(){ activate(it.id); });
    row.addEventListener("focus", function(){ activate(it.id); });
    row.addEventListener("click", function(){ activate(it.id); });
    listEl.appendChild(row);
    rowEls[it.id] = row; iconWrapEls[it.id] = iconWrap;

    // preview pane
    var pane = document.createElement("div");
    /* Opacity only. The panes used to cross-fade while one scaled from 1.015 to 1, which
       made the frame appear to squirm — the four headers are now pixel-identical, so any
       scale difference between the outgoing and incoming pane shows as a wobble. */
    pane.style.cssText = "position:absolute;inset:0;background:var(--surface);overflow:hidden;opacity:0;transition:opacity .4s ease;pointer-events:none;z-index:1;display:flex;align-items:stretch;justify-content:stretch;";
    pane.innerHTML = mockupHtmlById[it.id]();
    panesEl.appendChild(pane);
    paneEls[it.id] = pane;
  });

  function tabSlot(it){
    // placeholder logo slot (real brand SVG wired later)
    return '<span data-logo-slot="'+it.id+'" style="width:16px;height:16px;flex-shrink:0;border-radius:4px;background:#fff;border:1px solid var(--border);display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:9px;letter-spacing:-0.03em;color:'+it.tint+';">'+it.short+'</span>';
  }
  /* The list rows switch source on mouseenter, so the pointer can leave a mockup for the
     list and change panes while the hover class is still on. Clearing it here means the
     incoming source is never shown in a half-hovered state. */
  function inspireHoverOff(){ panesEl.classList.remove("inspire-hover"); }

  function activate(id){
    inspireHoverOff();
    activeInspire = id;
    var isMockup = !!mockupHtmlById[id];
    tabHeaderEl.style.display = isMockup ? "none" : "flex";
    panesEl.style.height = isMockup ? "" : "400px";
    panesEl.style.flex = isMockup ? "1" : "none";
    panesEl.style.minHeight = isMockup ? "0" : "";
    panesEl.style.display = isMockup ? "flex" : "block";
    panesEl.style.alignItems = isMockup ? "stretch" : "";
    panesEl.style.justifyContent = isMockup ? "stretch" : "";
    panesEl.style.background = isMockup ? "var(--surface)" : "";
    panesEl.style.overflow = isMockup ? "hidden" : "";
    /* The mobile description sits outside the list, so it is set here rather than by any
       one row. The element is hidden on desktop, so this runs harmlessly there. */
    var descEl = document.getElementById("inspireDesc");
    if (descEl) {
      for (var di = 0; di < inspireConfig.length; di++) {
        if (inspireConfig[di].id === id) { descEl.textContent = inspireConfig[di].desc; break; }
      }
    }
    inspireConfig.forEach(function(it){
      var on = it.id === id;
      var row = rowEls[it.id], iw = iconWrapEls[it.id], pane = paneEls[it.id];
      row.style.background = on ? "var(--surface-subtle)" : "transparent";
      iw.style.color = on ? "var(--accent)" : "var(--ink-muted)";
      pane.style.opacity = on ? "1" : "0";
      pane.style.pointerEvents = on ? "auto" : "none";
      pane.style.zIndex = on ? "2" : "1";
      if(on){
        var meta = it;
        tabLabel.textContent = meta.name;
        tabIcon.innerHTML = tabSlot(meta);
      }
    });
  }
  panesEl.addEventListener("mouseenter", function(){ panesEl.classList.add("inspire-hover"); });
  panesEl.addEventListener("mouseleave", inspireHoverOff);

  activate("youtube");
})();
