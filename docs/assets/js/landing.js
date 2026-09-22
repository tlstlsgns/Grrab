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
    ".rowA-step-kbd, .rowB-tip, .hero-tip";
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
  var heroOverlayWatermarkBtn = document.getElementById("heroOverlayWatermarkBtn");
  var heroBusy = document.getElementById("heroBusy");
  var heroHandle = document.getElementById("heroHandle");
  var heroClip = document.querySelector(".hero-slider-clip");
  var heroFigure = document.querySelector(".hero-overlay-figure");
  var heroOverlayPicture = document.querySelector("#heroOverlay .hero-overlay-picture");
  var heroOverlayImg = document.getElementById("heroOverlayImg");
  var heroRunToken = 0;
  var rowBRunToken = 0;
  var tokenLive = function(ref){
    return !ref || ref.reg === ref.get();
  };
  var heroResolvedSrc = function(src){
    try { return new URL(src, document.baseURI || window.location.href).href; }
    catch (e) { return src; }
  };
  var heroImgShowsSrc = function(img, wantSrc){
    if (!img || !wantSrc) return false;
    if ((img.getAttribute("src") || "") !== wantSrc) return false;
    return (img.currentSrc || "") === heroResolvedSrc(wantSrc);
  };
  var heroSetPictureRatio = function(img, fallback, picture, tokenRef, wantSrc){
    picture = picture || heroOverlayPicture;
    if (!picture || !img) return;
    wantSrc = wantSrc || img.getAttribute("src") || "";
    var apply = function(){
      if (!tokenLive(tokenRef)) return;
      if (heroImgShowsSrc(img, wantSrc) && img.naturalWidth && img.naturalHeight) {
        picture.style.aspectRatio = img.naturalWidth + "/" + img.naturalHeight;
      } else if (fallback) picture.style.aspectRatio = fallback;
    };
    apply();
    if (!heroImgShowsSrc(img, wantSrc) || !img.naturalWidth) {
      img.addEventListener("load", apply, { once: true });
    }
  };
  var whenOverlayImgReady = function(img, fn, tokenRef){
    if (!img) { fn(); return; }
    var done = false;
    var finish = function(){
      if (done) return;
      if (!tokenLive(tokenRef)) return;
      done = true;
      fn();
    };
    var fallback = setTimeout(finish, 4000);
    var ready = function(){
      clearTimeout(fallback);
      finish();
    };
    if (img.complete && img.naturalWidth) {
      if (img.decode) img.decode().then(ready, ready);
      else ready();
      return;
    }
    img.addEventListener("load", function(){
      if (img.decode) img.decode().then(ready, ready);
      else ready();
    }, { once: true });
    img.addEventListener("error", ready, { once: true });
  };
  var heroOverlayBtnIcon = document.getElementById("heroOverlayBtnIcon");
  var heroOverlayBtnLabel = document.getElementById("heroOverlayBtnLabel");
  var heroActs = [].slice.call(document.querySelectorAll(".hero-overlay-act"));
  var heroActClip = document.getElementById("heroActClip");
  var heroActUpscale = document.getElementById("heroActUpscale");
  var heroBusyText = document.getElementById("heroBusyText");
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
  var heroTiles = heroGallery
    ? [].slice.call(heroGallery.querySelectorAll(".hero-tile"))
    : [];

  if (heroCamera && heroBody && heroCursor && heroOverlay && heroTiles.length) {
    var heroTimers = [];
    var heroLateTimer = 0;
    var heroRaf = 0;
    var heroReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    var heroMobile = window.matchMedia && window.matchMedia("(max-width:820px)");
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
    var heroTileTargetIn = function(tile, step){
      var p = heroCentreIn(tile);
      if (step && step.hoverY) p.y -= tile.offsetHeight * step.hoverY;
      return p;
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
    var heroCursorMoveMs = 750;
    var heroTrack = function(durationMs, opts){
      opts = opts || {};
      if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }
      var started = Date.now();
      var tick = function(){
        var r = heroCursor.getBoundingClientRect();
        var under = document.elementFromPoint(r.left, r.top);
        heroHotOnly(under && under.closest ? under.closest(".hero-tile") : null);
        if (Date.now() - started < durationMs) heroRaf = requestAnimationFrame(tick);
        else {
          heroRaf = 0;
          if (opts.clearOnEnd) heroHotOnly(null);
        }
      };
      heroRaf = requestAnimationFrame(tick);
    };

    /* The press is NOT released on a timer any more. It stays down for as long as the
       spinner runs, which is what makes the button read as busy rather than as a
       click that already finished. heroReveal is the single point where both end. */
    var heroHover = function(btn){
      btn = btn || heroOverlayBtn;
      if (btn) btn.classList.add("hero-overlay-btn--hover");
    };
    var heroPress = function(btn){
      btn = btn || heroOverlayBtn;
      if (btn) btn.classList.add("hero-overlay-btn--press");
      if (heroBusy) heroBusy.classList.add("hero-busy--on");
      if (heroMarquee) {
        heroMarquee.classList.remove("hero-marquee--on");
        heroMarquee.style.width = "0%";
        heroMarquee.style.height = "0%";
      }
    };
    var heroReveal = function(btn){
      btn = btn || heroOverlayBtn;
      if (heroBusy) heroBusy.classList.remove("hero-busy--on");
      if (btn) btn.classList.remove("hero-overlay-btn--press");
      if (heroClip) heroClip.classList.add("hero-slider-clip--wipe");
      if (heroOverlayPicture) {
        heroOverlayPicture.style.transition = "none";
        heroOverlayPicture.style.setProperty("--hero-split", "1");
        void heroOverlayPicture.offsetWidth;
        heroOverlayPicture.style.transition = "";
        heroOverlayPicture.style.setProperty("--hero-split", "0");
      }
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
      { tile:13, img:"/assets/landing/img/hero-image-14-before.webp", ratio:"1000/563",
        target:"watermark", alpha:false },
      { tile:12, img:"/assets/landing/img/hero-image-13-before.webp", ratio:"1000/672",
        icon:"/assets/landing/icons/hero/icon_removebg.svg", label:"Remove BG", alpha:true },
      { tile:11, img:"/assets/landing/img/hero-image-12-before.webp", ratio:"1000/667",
        icon:"/assets/landing/icons/hero/icon_erase.svg", label:"Remove",
        /* Placeholder — maintainer will set the real region from a screenshot. */
        box:{ l:0.42, t:0.32, r:0.53, b:0.55 }, alpha:false },
      { tile:10, img:"/assets/landing/img/hero-image-11-before.webp", ratio:"530/800",
        icon:"/assets/landing/icons/hero/icon_removebg.svg", label:"Remove BG", alpha:true,
        hoverY:0.2 },
      { tile:9, img:"/assets/landing/img/hero-image-10-before.webp", ratio:"1000/667",
        icon:"/assets/landing/icons/hero/icon_removebg.svg", label:"Remove BG", alpha:true },
      { tile:7, img:"/assets/landing/img/hero-image-2-before.webp", ratio:"1000/667",
        target:"watermark", alpha:false },
      { tile:6, img:"/assets/landing/img/hero-image-9-before.webp", ratio:"500/333",
        target:"watermark", alpha:false },
      { tile:5, img:"/assets/landing/img/hero-image-7-before.webp", ratio:"534/800",
        icon:"/assets/landing/icons/hero/icon_erase.svg", label:"Remove",
        /* Measured from a screenshot — approximate, not derived. */
        box: { l:0.45, t:0.51, r:0.90, b:0.96 }, alpha:false },
      { tile:4, img:"/assets/landing/img/hero-image-4-before.webp", ratio:"1000/667",
        icon:"/assets/landing/icons/hero/icon_removebg.svg", label:"Remove BG", alpha:true },
      { tile:2, img:"/assets/landing/img/hero-image-6-before.webp", ratio:"1000/667",
        icon:"/assets/landing/icons/hero/icon_removebg.svg", label:"Remove BG", alpha:true },
      { tile:1, img:"/assets/landing/img/hero-image-3-before.webp", ratio:"1000/750",
        icon:"/assets/landing/icons/hero/icon_erase.svg", label:"Remove",
        /* Measured from a screenshot — approximate, not derived. */
        box:{ l:0.44, t:0.43, r:0.58, b:0.61 }, alpha:false },
      { tile:0, img:"/assets/landing/img/hero-image-1-before.webp", ratio:"579/800",
        icon:"/assets/landing/icons/hero/icon_removebg.svg", label:"Remove BG", alpha:true },
      { tile:8, img:"/assets/landing/img/hero-image-5-before.webp", ratio:"1000/668",
        icon:"/assets/landing/icons/hero/icon_erase.svg", label:"Remove",
        box:{ l:0.39, t:0.38, r:0.59, b:0.65 }, alpha:false },
      { tile:3, img:"/assets/landing/img/hero-image-8-before.webp", ratio:"999/666",
        icon:"/assets/landing/icons/hero/icon_upscale.svg", label:"Upscale",
        busy:"Upscaling…", target:"upscale" }
    ];
    /* The action button no longer belongs to the step. In the extension it always opens
       as Remove BG with the hint beside it, and only becomes Remove once a selection
       exists — so the drag, not the pass, is what switches it. */
    var heroSetAction = function(erasing){
      if (heroOverlayBtnIcon) heroOverlayBtnIcon.setAttribute("src",
        erasing ? "/assets/landing/icons/hero/icon_erase.svg"
                : "/assets/landing/icons/hero/icon_removebg.svg");
      if (heroOverlayBtnLabel) heroOverlayBtnLabel.textContent = erasing ? "Remove" : "Remove BG";
      if (heroOverlayWatermarkBtn) {
        if (erasing) heroOverlayWatermarkBtn.classList.add("hero-overlay-btn--hidden");
        else heroOverlayWatermarkBtn.classList.remove("hero-overlay-btn--hidden");
      }
      if (heroHint) {
        if (erasing) heroHint.classList.add("hero-hint--off");
        else heroHint.classList.remove("hero-hint--off");
      }
    };
    var heroTokenRef = function(){
      return { reg: heroRunToken, get: function(){ return heroRunToken; } };
    };
    var heroSetStep = function(s){
      if (heroOverlayImg) heroOverlayImg.setAttribute("src", s.img);
      if (heroOverlayAfter) {
        heroOverlayAfter.setAttribute("src", s.img.replace(/-before\.(webp|jpe?g)$/, "-after.$1"));
        if (s.alpha) heroOverlayAfter.classList.add("hero-overlay-after--alpha");
        else heroOverlayAfter.classList.remove("hero-overlay-after--alpha");
      }
      heroSetPictureRatio(heroOverlayImg, s.ratio || "", undefined, heroTokenRef(), s.img);
      heroSetAction(false);
    };
    /* Reopening the editor needs the first pass's leftovers cleared: the result would
       otherwise already be revealed and Clip already showing. Killing the transition
       around the class removal stops the result rewinding on screen. */
    var heroResetOverlay = function(){
      if (heroLateTimer) { clearTimeout(heroLateTimer); heroLateTimer = 0; }
      if (browserAt === "rowB") return;
      if (heroLateActs) {
        heroLateActs.forEach(function(el){ el.classList.remove("hero-overlay-act--in"); });
      }
      if (heroClip) heroClip.classList.remove("hero-slider-clip--wipe");
      if (heroOverlayPicture) {
        heroOverlayPicture.style.transition = "none";
        heroOverlayPicture.style.setProperty("--hero-split", "1");
        void heroOverlayPicture.offsetWidth;
        heroOverlayPicture.style.transition = "";
      }
      if (heroMarquee) {
        heroMarquee.classList.remove("hero-marquee--on");
        heroMarquee.style.width = "0%";
        heroMarquee.style.height = "0%";
      }
      if (heroActUpscale) {
        heroActUpscale.classList.remove("hero-overlay-act--press");
        heroActUpscale.classList.remove("hero-overlay-act--hover");
        heroActUpscale.classList.remove("hero-overlay-act--ghost");
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
      heroTrack(heroCursorMoveMs, { clearOnEnd: true });
    };
    var heroToastOut = function(){
      if (heroToast) heroToast.classList.remove("hero-toast--in");
    };
    /* The paste is shown first so its laid-out size can be read, then positioned at a
       random offset near the canvas centre. No fade: a paste is instantaneous. */
    var heroPasteMin = 0.10;
    var heroPasteRetries = 24;
    var heroPasteMax = 10;
    var heroPasteCount = 0;
    var heroPlaced = [];
    var heroUsedAnchors = [];
    var heroUsedTiles = [];
    var heroPasteAnchors = [
      { ox: -0.25, oy: -0.25 }, { ox: 0, oy: -0.25 }, { ox: 0.25, oy: -0.25 },
      { ox: -0.25, oy: 0 }, { ox: 0, oy: 0 }, { ox: 0.25, oy: 0 },
      { ox: -0.25, oy: 0.25 }, { ox: 0, oy: 0.25 }, { ox: 0.25, oy: 0.25 }
    ];
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
    var heroAnchorTiers = [[4], [0, 2, 6, 8], [1, 3, 5, 7]];
    var heroMobileAnchorSkip = [3, 4, 5];
    var heroAnchorIndexAllowed = function(ai){
      if (!heroMobile || !heroMobile.matches) return true;
      for (var si = 0; si < heroMobileAnchorSkip.length; si++) {
        if (heroMobileAnchorSkip[si] === ai) return false;
      }
      return true;
    };
    var heroPickAnchor = function(){
      var ai, pi, ti, ki, pool = [], tierPool = [];
      for (ai = 0; ai < heroPasteAnchors.length; ai++) {
        var taken = false;
        for (pi = 0; pi < heroUsedAnchors.length; pi++) {
          if (heroUsedAnchors[pi] === ai) { taken = true; break; }
        }
        if (!taken && heroAnchorIndexAllowed(ai)) pool.push(ai);
      }
      if (!pool.length) {
        if (heroMobile && heroMobile.matches) {
          var mobFallback = [0, 1, 2, 6, 7, 8];
          return mobFallback[Math.floor(Math.random() * mobFallback.length)];
        }
        return Math.floor(Math.random() * heroPasteAnchors.length);
      }
      for (ti = 0; ti < heroAnchorTiers.length; ti++) {
        tierPool = [];
        for (ki = 0; ki < heroAnchorTiers[ti].length; ki++) {
          ai = heroAnchorTiers[ti][ki];
          for (pi = 0; pi < pool.length; pi++) {
            if (pool[pi] === ai) { tierPool.push(ai); break; }
          }
        }
        if (tierPool.length) return tierPool[Math.floor(Math.random() * tierPool.length)];
      }
      return pool[Math.floor(Math.random() * pool.length)];
    };
    var heroPickSlot = function(){
      var anchorIdx = heroPickAnchor();
      var anchor = heroPasteAnchors[anchorIdx];
      var ox = 0, oy = 0, attempt, ok, pi;
      for (attempt = 0; attempt < heroPasteRetries; attempt++) {
        ox = anchor.ox + (Math.random() * 0.15 - 0.075);
        oy = anchor.oy + (Math.random() * 0.15 - 0.075);
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
      heroUsedAnchors.push(anchorIdx);
      var slot = { ox: ox, oy: oy };
      heroPlaced.push(slot);
      return slot;
    };
    var heroClearPastes = function(){
      if (!heroCanvasPan) return;
      var nodes = heroCanvasPan.querySelectorAll(".hero-paste");
      for (var hi = 0; hi < nodes.length; hi++) nodes[hi].remove();
      heroPlaced = [];
      heroUsedAnchors = [];
      heroUsedTiles = [];
      heroPasteCount = 0;
    };
    var heroStepForTile = function(tileEl){
      var ti = heroTiles.indexOf(tileEl);
      if (ti < 0) return -1;
      for (var hi = 0; hi < heroSteps.length; hi++) {
        if (heroSteps[hi].tile === ti) return hi;
      }
      return -1;
    };
    var heroPickSteps = function(forcedStepIndex){
      var pool = [];
      var hi, ui, t, used;
      var forcing = forcedStepIndex !== undefined && forcedStepIndex !== null &&
        forcedStepIndex >= 0 && forcedStepIndex < heroSteps.length;
      var need = forcing ? 4 : 5;
      for (hi = 0; hi < heroSteps.length; hi++) {
        if (forcing && hi === forcedStepIndex) continue;
        t = heroSteps[hi].tile;
        used = false;
        for (ui = 0; ui < heroUsedTiles.length; ui++) {
          if (heroUsedTiles[ui] === t) { used = true; break; }
        }
        if (!used) pool.push(hi);
      }
      for (var sj = pool.length - 1; sj > 0; sj--) {
        var sk = Math.floor(Math.random() * (sj + 1));
        var st = pool[sj]; pool[sj] = pool[sk]; pool[sk] = st;
      }
      var rest = pool.slice(0, pool.length < need ? pool.length : need);
      if (forcing) return [forcedStepIndex].concat(rest);
      return rest;
    };
    var heroPasteAfterSrc = function(stepIndex){
      return heroSteps[stepIndex].img.replace(/-before\.(webp|jpe?g)$/, "-after.$1");
    };
    var heroMobilePasteScale15 = [6, 7, 9, 12, 13];
    var heroTileCoverDrawn = function(tile, rw, rh){
      if (!tile || !rw || !rh) return null;
      var W = tile.offsetWidth;
      var H = tile.offsetHeight;
      if (!W || !H) return null;
      var r = rw / rh;
      if (W / H > r) return { w: H * r, h: H };
      return { w: W, h: W / r };
    };
    var heroPasteSize = function(el, ratio, tile){
      if (!el || !ratio) return;
      var parts = String(ratio).split("/");
      var rw = parseFloat(parts[0]);
      var rh = parseFloat(parts[1]);
      if (!rw || !rh) return;
      el.style.aspectRatio = rw + "/" + rh;
      var drawn = tile ? heroTileCoverDrawn(tile, rw, rh) : null;
      if (heroMobile && heroMobile.matches && drawn) {
        var pasteScale = 1;
        if (tile) {
          var pasteTileIdx = heroTiles.indexOf(tile);
          if (pasteTileIdx >= 0 && heroMobilePasteScale15.indexOf(pasteTileIdx) >= 0) {
            pasteScale = 1.5;
          }
        }
        el.style.width = (drawn.w * pasteScale) + "px";
        el.style.height = (drawn.h * pasteScale) + "px";
        return;
      }
      var panW = heroCanvasPan ? heroCanvasPan.offsetWidth : 0;
      var panH = heroCanvasPan ? heroCanvasPan.offsetHeight : 0;
      if (rw > rh) {
        el.style.width = "50%";
        el.style.height = "";
        if (drawn && panW && panW * 0.5 < drawn.w) el.style.width = drawn.w + "px";
      } else {
        el.style.height = "50%";
        el.style.width = "";
        if (drawn && panH && panH * 0.5 < drawn.h) el.style.height = drawn.h + "px";
      }
    };
    var heroClampPaste = function(el){
      if (!el || !heroCanvas || !heroCanvasPan) return;
      var panO = heroOffsetIn(heroCanvasPan);
      var canvasO = heroOffsetIn(heroCanvas);
      var minLeft = canvasO.x - panO.x;
      var minTop = canvasO.y - panO.y;
      var W = heroCanvas.offsetWidth;
      var H = heroCanvas.offsetHeight;
      var w = el.offsetWidth;
      var h = el.offsetHeight;
      var left = parseFloat(el.style.left) || 0;
      var top = parseFloat(el.style.top) || 0;
      if (w <= W) left = Math.max(minLeft, Math.min(left, minLeft + W - w));
      else left = minLeft;
      if (h <= H) top = Math.max(minTop, Math.min(top, minTop + H - h));
      else top = minTop;
      el.style.left = left + "px";
      el.style.top = top + "px";
    };
    var heroPasteAt = function(el, ox, oy, ratio, tile){
      if (!el || !heroCanvas || !heroCanvasPan) return;
      if (ox == null) ox = 0;
      if (oy == null) oy = 0;
      var p = heroPastePointIn(ox, oy);
      var o = heroOffsetIn(heroCanvasPan);
      heroPasteSize(el, ratio, tile);
      el.classList.add("hero-paste--in");
      void el.offsetWidth;
      el.style.left = (p.x - o.x - el.offsetWidth / 2) + "px";
      el.style.top = (p.y - o.y - el.offsetHeight / 2) + "px";
      heroClampPaste(el);
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
      var pasteTile = heroTiles[heroSteps[stepIndex].tile];
      var pasteFallback = heroSteps[stepIndex].ratio;
      var pasteApply = function(){
        var pr = pasteFallback;
        if (el.naturalWidth && el.naturalHeight) {
          pr = el.naturalWidth + "/" + el.naturalHeight;
        }
        heroPasteAt(el, ox, oy, pr, pasteTile);
      };
      if (el.complete && el.naturalWidth) pasteApply();
      else {
        el.addEventListener("load", pasteApply, { once: true });
        pasteApply();
      }
      var pt = heroSteps[stepIndex].tile;
      if (heroUsedTiles.indexOf(pt) < 0) heroUsedTiles.push(pt);
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

    /* One step's editor beats, relative to overlayAt. No box goes to the button; a box
       draws the marquee first. Returns the reveal time. */
    var heroPlayEditor = function(overlayAt, step){
      if (step.target === "upscale") {
        heroAt(overlayAt + 280, function(){
          if (heroActUpscale) heroMoveTo(heroCentreIn(heroActUpscale));
        });
        heroAt(overlayAt + 1030, function(){
          if (heroActUpscale) heroActUpscale.classList.add("hero-overlay-act--hover");
        });
        heroAt(overlayAt + 1430, function(){
          if (heroActUpscale) heroActUpscale.classList.add("hero-overlay-act--press");
          if (heroBusy) heroBusy.classList.add("hero-busy--on");
          if (heroBusyText) heroBusyText.textContent = step.busy || "Upscaling…";
          if (heroMarquee) {
            heroMarquee.classList.remove("hero-marquee--on");
            heroMarquee.style.width = "0%";
            heroMarquee.style.height = "0%";
          }
        });
        heroAt(overlayAt + 2430, function(){
          if (heroBusy) heroBusy.classList.remove("hero-busy--on");
          if (heroActUpscale) heroActUpscale.classList.remove("hero-overlay-act--press");
          if (heroClip) heroClip.classList.add("hero-slider-clip--wipe");
          if (heroOverlayPicture) {
            heroOverlayPicture.style.transition = "none";
            heroOverlayPicture.style.setProperty("--hero-split", "1");
            void heroOverlayPicture.offsetWidth;
            heroOverlayPicture.style.transition = "";
            heroOverlayPicture.style.setProperty("--hero-split", "0");
          }
          if (heroLateTimer) { clearTimeout(heroLateTimer); heroLateTimer = 0; }
          heroLateTimer = setTimeout(function(){
            heroLateTimer = 0;
            if (heroLateActs) {
              heroLateActs.forEach(function(el){ el.classList.add("hero-overlay-act--in"); });
            }
            if (heroClip) heroClip.classList.remove("hero-slider-clip--wipe");
            if (heroActUpscale) {
              heroActUpscale.classList.remove("hero-overlay-act--hover");
              heroActUpscale.classList.add("hero-overlay-act--ghost");
            }
          }, 1400);
          heroTimers.push(heroLateTimer);
        });
        return overlayAt + 2430;
      }
      if (step.target === "watermark") {
        heroAt(overlayAt + 280, function(){
          if (heroOverlayWatermarkBtn) heroMoveTo(heroCentreIn(heroOverlayWatermarkBtn));
        });
        heroAt(overlayAt + 1030, function(){ heroHover(heroOverlayWatermarkBtn); });
        heroAt(overlayAt + 1430, function(){ heroPress(heroOverlayWatermarkBtn); });
        heroAt(overlayAt + 2430, function(){ heroReveal(heroOverlayWatermarkBtn); });
        return overlayAt + 2430;
      }
      if (!step.box) {
        heroAt(overlayAt + 280, function(){
          if (heroOverlayBtn) heroMoveTo(heroCentreIn(heroOverlayBtn));
        });
        heroAt(overlayAt + 1030, heroHover);
        heroAt(overlayAt + 1430, heroPress);
        heroAt(overlayAt + 2430, heroReveal);
        return overlayAt + 2430;
      }
      var box = step.box;
      heroAt(overlayAt + 280, function(){ heroMoveTo(heroBoxPoint(box.l, box.t)); });
      heroAt(overlayAt + 1030, function(){
        if (!heroMarquee) return;
        heroMarquee.style.left = (box.l * 100) + "%";
        heroMarquee.style.top = (box.t * 100) + "%";
        heroMarquee.style.width = "0%";
        heroMarquee.style.height = "0%";
        heroMarquee.classList.add("hero-marquee--on");
        heroMoveTo(heroBoxPoint(box.r, box.b));
        heroDragTrack(box, 820);
      });
      heroAt(overlayAt + 1850, function(){
        if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }
        heroSetAction(true);
        if (!heroMarquee) return;
        heroMarquee.style.width = ((box.r - box.l) * 100) + "%";
        heroMarquee.style.height = ((box.b - box.t) * 100) + "%";
      });
      heroAt(overlayAt + 2060, function(){
        if (heroOverlayBtn) heroMoveTo(heroCentreIn(heroOverlayBtn));
      });
      heroAt(overlayAt + 2800, heroHover);
      heroAt(overlayAt + 3200, heroPress);
      heroAt(overlayAt + 4200, heroReveal);
      return overlayAt + 4200;
    };

    /* Schedules one hero step at base ms. Returns the absolute time where the next step
       should begin — base plus the stride for this step. */
    var heroPlayStep = function(base, stepIndex, opts){
      var step = heroSteps[stepIndex];
      var tile = heroTiles[step.tile];
      if (!tile) return base;
      var overlayAt;
      var revealAt;

      if (opts.isFirst) {
        heroAt(base + 60, function(){
          heroCursor.classList.add("hero-cursor--on");
          heroMoveTo(heroTileTargetIn(tile, step));
          heroTrack(790);
        });
        heroAt(base + 880, function(){
          if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }
          heroHotOnly(tile);
        });
        heroAt(base + 1180, function(){ if (heroTip) heroTip.classList.add("hero-tip--in"); });
        heroAt(base + 1520, function(){ if (heroTip) heroTip.classList.remove("hero-tip--in"); });
        overlayAt = base + 1820;
        heroAt(overlayAt, function(){ heroOverlay.classList.add("hero-overlay--on"); });
      } else {
        heroAt(base + 0, function(){
          heroSetStep(step);
          heroMoveTo(heroTileTargetIn(tile, step));
          heroTrack(790);
          heroTipVOut();
        });
        heroAt(base + 820, function(){
          if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }
          heroHotOnly(tile);
        });
        heroAt(base + 1230, function(){ if (heroTip) heroTip.classList.add("hero-tip--in"); });
        heroAt(base + 1570, function(){ if (heroTip) heroTip.classList.remove("hero-tip--in"); });
        overlayAt = base + 1870;
        heroAt(overlayAt, function(){
          heroResetOverlay();
          heroOverlay.classList.add("hero-overlay--on");
        });
      }

      revealAt = heroPlayEditor(overlayAt, step);

      heroAt(revealAt + 1400, function(){
        if (heroActClip) heroMoveTo(heroCentreIn(heroActClip));
      });
      heroAt(revealAt + 2150, heroClipHover);
      heroAt(revealAt + 2550, heroClipPress);

      if (opts.isLast) {
        heroAt(revealAt + 2750, heroClipDone2);
        heroAt(revealAt + 3200, function(){
          heroSlot2 = heroPickSlot();
          heroMoveTo(heroPastePointIn(heroSlot2.ox, heroSlot2.oy));
          heroTrack(heroCursorMoveMs, { clearOnEnd: true });
        });
        heroAt(revealAt + 3950, function(){
          if (heroTipV) heroTipV.classList.add("hero-tip--in");
          if (!heroSlot2) heroSlot2 = heroPickSlot();
          heroCreatePaste(stepIndex, heroSlot2.ox, heroSlot2.oy);
        });
        heroAt(revealAt + 4340, heroTipVOut);
        heroAt(revealAt + 4500, heroToastOut);
        return revealAt + 4500;
      }

      heroAt(revealAt + 2750, heroClipDone);
      heroAt(revealAt + 3500, function(){
        if (heroTipV) heroTipV.classList.add("hero-tip--in");
        if (!heroSlot1) heroSlot1 = heroPickSlot();
        heroCreatePaste(stepIndex, heroSlot1.ox, heroSlot1.oy);
      });
      heroAt(revealAt + 3850, heroToastOut);
      heroAt(revealAt + 3890, heroTipVOut);
      return revealAt + 3890;
    };

    var heroPlay = function(forcedStepIndex){
      heroRunToken++;
      var playToken = { reg: heroRunToken, get: function(){ return heroRunToken; } };
      if (window.grrabBrowser && window.grrabBrowser.stopRowA) window.grrabBrowser.stopRowA();
      if (window.grrabBrowser && window.grrabBrowser.stopRowB) window.grrabBrowser.stopRowB();
      heroStop();
      var picked = heroPickSteps(forcedStepIndex);
      if (!picked.length) return;
      if (!heroTiles[heroSteps[picked[0]].tile] || !heroBody.offsetWidth) return;
      /* Every cycle queues about thirty timers. Cancelling and emptying the list here
         keeps that from growing without bound, and means a stray call cannot leave two
         sequences running against each other. */
      heroClearTimers();
      if (forcedStepIndex !== undefined && forcedStepIndex !== null &&
          forcedStepIndex >= 0 && forcedStepIndex < heroSteps.length) {
        heroClearPastes();
      } else if (heroPasteCount + 5 > heroPasteMax) {
        heroClearPastes();
      }
      heroSlot1 = null;
      heroSlot2 = null;
      if (heroLateActs) {
        heroLateActs.forEach(function(el){ el.classList.remove("hero-overlay-act--in"); });
      }
      heroSetStep(heroSteps[picked[0]]);

      heroCursor.style.transition = "none";
      if (heroMobile && heroMobile.matches && heroCanvas && heroCanvas.offsetWidth) {
        heroMoveTo(heroPastePointIn(heroPasteAnchors[2].ox, heroPasteAnchors[2].oy));
      } else {
        var b = heroOffsetIn(heroBody);
        heroMoveTo({ x: b.x + heroBody.offsetWidth * 0.86,
                     y: b.y + heroBody.offsetHeight * 0.92 });
      }
      void heroCursor.offsetWidth;
      heroCursor.style.transition = "";

      whenOverlayImgReady(heroOverlayImg, function(){
        whenOverlayImgReady(heroOverlayAfter, function(){
          if (!tokenLive(playToken)) return;
          var offset = 0;
          var si;
          for (si = 0; si < picked.length; si++) {
            offset = heroPlayStep(offset, picked[si], {
              isFirst: si === 0,
              isLast: si === picked.length - 1
            });
          }
        }, playToken);
      }, playToken);
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
      if (heroOverlayBtn) {
        heroOverlayBtn.classList.remove("hero-overlay-btn--hover");
        heroOverlayBtn.classList.remove("hero-overlay-btn--press");
      }
      if (heroOverlayWatermarkBtn) {
        heroOverlayWatermarkBtn.classList.remove("hero-overlay-btn--hidden");
        heroOverlayWatermarkBtn.classList.remove("hero-overlay-btn--hover");
        heroOverlayWatermarkBtn.classList.remove("hero-overlay-btn--press");
      }
      if (heroActClip) {
        heroActClip.classList.remove("hero-overlay-act--hover");
        heroActClip.classList.remove("hero-overlay-act--press");
      }
      if (heroActUpscale) {
        heroActUpscale.classList.remove("hero-overlay-act--hover");
        heroActUpscale.classList.remove("hero-overlay-act--press");
        heroActUpscale.classList.remove("hero-overlay-act--ghost");
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
        if (rowBIntersecting() && !(heroMobile && heroMobile.matches)) {
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
        if (rowBIntersecting() && !(heroMobile && heroMobile.matches)) {
          browserFlightDone = null;
          moveToRowB(window.grrabBrowser && window.grrabBrowser.playRowB);
          return true;
        }
        if (rowAIntersecting() && !(heroMobile && heroMobile.matches)) {
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
      if (heroMobile && heroMobile.matches) {
        if (done) done();
        return;
      }
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
      if (heroMobile && heroMobile.matches) {
        if (done) done();
        return;
      }
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

    var browserSendHomeImmediate = function(){
      if (browserFlightRaf) {
        cancelAnimationFrame(browserFlightRaf);
        browserFlightRaf = 0;
      }
      browserFlying = false;
      browserPending = null;
      clearMockupFlightStyles();
      if (!heroMockup || !heroSlot || browserAt === "hero") return;
      if (window.grrabBrowser && window.grrabBrowser.stopRowA) window.grrabBrowser.stopRowA();
      if (window.grrabBrowser && window.grrabBrowser.stopRowB) window.grrabBrowser.stopRowB();
      browserPlaceMockup(heroSlot, "hero");
    };

    if (heroMobile && heroMobile.addEventListener) {
      heroMobile.addEventListener("change", function(e){
        if (e.matches && browserAt !== "hero") browserSendHomeImmediate();
      });
    }

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

    if (heroGallery) {
      heroGallery.addEventListener("click", function(e){
        if (heroMobile && heroMobile.matches) return;
        if (heroOverlay && heroOverlay.classList.contains("hero-overlay--on")) return;
        if (window.grrabBrowser && window.grrabBrowser.flying) return;
        var tile = e.target.closest(".hero-tile");
        if (!tile) return;
        var at = window.grrabBrowser ? window.grrabBrowser.at : "hero";
        if (at === "rowB") return;
        if (at === "hero") {
          var stepIdx = heroStepForTile(tile);
          if (stepIdx < 0) return;
          heroPlay(stepIdx);
        } else if (at === "rowA") {
          if (window.grrabBrowser && window.grrabBrowser.playRowA) {
            window.grrabBrowser.playRowA(tile);
          }
        }
      });
    }

    if (heroReduce && heroReduce.matches) {
      heroRunToken++;
      var reduceToken = { reg: heroRunToken, get: function(){ return heroRunToken; } };
      heroHotOnly(heroTiles[heroSteps[0].tile]);
      heroSetStep(heroSteps[0]);
      whenOverlayImgReady(heroOverlayImg, function(){
        whenOverlayImgReady(heroOverlayAfter, function(){
          if (!tokenLive(reduceToken)) return;
          heroOverlay.classList.add("hero-overlay--on");
          heroReveal();
          if (heroToast) heroToast.classList.add("hero-toast--in");
          heroPasteIn();
          if (heroTipV) heroTipV.classList.remove("hero-tip--in");
          browserPlaced = true;
        }, reduceToken);
      }, reduceToken);
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
                if (rowBIntersecting() && !(heroMobile && heroMobile.matches)) {
                  window.grrabBrowser.moveToRowB(window.grrabBrowser.playRowB);
                } else if (rowAIntersecting() && !(heroMobile && heroMobile.matches)) {
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
  var rowBPicture = null;
  var rowBHandle = null;
  var rowBClip = null;
  var rowBOverlay = null;
  var rowBOverlayImg = null;
  var rowBOverlayAfter = null;
  var rowBOverlayBtn = null;
  var rowBOverlayWatermarkBtn = null;
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
  var rowBMobile = window.matchMedia && window.matchMedia("(max-width:820px)");

  if (rowBMockupWrap && rowBCursor && rowBCards.length) {
    var rowBRefreshBrowser = function(){
      var mobile = rowBMobile && rowBMobile.matches;
      var chrome;
      if (mobile) {
        chrome = rowBMockupWrap && rowBMockupWrap.querySelector(".rowB-browser-copy .hero-chrome");
      } else {
        chrome = (rowBMockupWrap && rowBMockupWrap.querySelector(".hero-mockup-wrap:not(.rowB-browser-copy) .hero-chrome")) ||
          document.querySelector(".hero-mockup-wrap:not(.rowB-browser-copy) .hero-chrome");
      }
      rowBChrome = chrome;
      rowBBody = chrome ? chrome.querySelector(".hero-body") : null;
      rowBTiles = rowBBody ? [].slice.call(rowBBody.querySelectorAll(".hero-tile")) : [];
      if (mobile) {
        rowBOverlay = document.getElementById("rowBOverlay");
        rowBOverlayImg = document.getElementById("rowBOverlayImg");
        rowBOverlayAfter = document.getElementById("rowBOverlayAfter");
        rowBOverlayBtn = document.getElementById("rowBOverlayBtn");
        rowBOverlayWatermarkBtn = document.getElementById("rowBOverlayWatermarkBtn");
        rowBActUpscale = document.getElementById("rowBActUpscale");
        rowBMarquee = document.getElementById("rowBMarquee");
        rowBHandle = document.getElementById("rowBHandle");
        rowBBusy = document.getElementById("rowBBusy");
        rowBBusyText = document.getElementById("rowBBusyText");
        rowBOverlayBtnIcon = document.getElementById("rowBOverlayBtnIcon");
        rowBOverlayBtnLabel = document.getElementById("rowBOverlayBtnLabel");
        rowBHint = document.getElementById("rowBHint");
        rowBFigure = rowBOverlay ? rowBOverlay.querySelector(".hero-overlay-figure") : null;
        rowBPicture = rowBOverlay ? rowBOverlay.querySelector(".hero-overlay-picture") : null;
        rowBClip = rowBOverlay ? rowBOverlay.querySelector(".hero-slider-clip") : null;
        rowBActs = rowBOverlay
          ? [].slice.call(rowBOverlay.querySelectorAll(".hero-overlay-act"))
          : [];
      } else {
        rowBOverlay = document.getElementById("heroOverlay");
        rowBOverlayImg = document.getElementById("heroOverlayImg");
        rowBOverlayAfter = document.getElementById("heroOverlayAfter");
        rowBOverlayBtn = document.getElementById("heroOverlayBtn");
        rowBOverlayWatermarkBtn = document.getElementById("heroOverlayWatermarkBtn");
        rowBActUpscale = document.getElementById("heroActUpscale");
        rowBMarquee = document.getElementById("heroMarquee");
        rowBHandle = document.getElementById("heroHandle");
        rowBBusy = document.getElementById("heroBusy");
        rowBBusyText = document.getElementById("heroBusyText");
        rowBOverlayBtnIcon = document.getElementById("heroOverlayBtnIcon");
        rowBOverlayBtnLabel = document.getElementById("heroOverlayBtnLabel");
        rowBHint = document.getElementById("heroHint");
        rowBFigure = rowBOverlay ? rowBOverlay.querySelector(".hero-overlay-figure") : null;
        rowBPicture = rowBOverlay ? rowBOverlay.querySelector(".hero-overlay-picture") : null;
        rowBClip = rowBOverlay ? rowBOverlay.querySelector(".hero-slider-clip") : null;
        rowBActs = rowBOverlay
          ? [].slice.call(rowBOverlay.querySelectorAll(".hero-overlay-act"))
          : [];
      }
      rowBLateActs = rowBOverlay
        ? [].slice.call(rowBOverlay.querySelectorAll(".hero-overlay-act--late"))
        : [];
      return rowBBody;
    };
    var rowBSteps = [
      { tile:4, img:"/assets/landing/img/hero-image-4-before.webp", ratio:"1000/667",
        icon:"/assets/landing/icons/rowB/icon_removebg.svg", label:"Remove BG", alpha:true },
      { tile:7, img:"/assets/landing/img/hero-image-2-before.webp", ratio:"1000/667",
        target:"watermark", alpha:false },
      /* "Remove" is the extension's own wording for the erase action, and it is written
         out again in the hero's heroSetAction — change both together. */
      { tile:8, img:"/assets/landing/img/hero-image-5-before.webp", ratio:"1000/668",
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
       pass, so which label the drag switches TO depends on the card. Cards without a box
       keep Remove BG on the primary button unless erasing. */
    var rowBSetAction = function(step, erasing){
      if (rowBBusyText) rowBBusyText.textContent = step.busy || "Removing…";
      if (rowBOverlayBtnIcon) rowBOverlayBtnIcon.setAttribute("src",
        erasing ? step.icon : "/assets/landing/icons/rowB/icon_removebg.svg");
      if (rowBOverlayBtnLabel) rowBOverlayBtnLabel.textContent =
        erasing ? step.label : "Remove BG";
      if (rowBOverlayWatermarkBtn) {
        if (erasing) rowBOverlayWatermarkBtn.classList.add("hero-overlay-btn--hidden");
        else rowBOverlayWatermarkBtn.classList.remove("hero-overlay-btn--hidden");
      }
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
    /* Three press targets: Remove Watermark, Remove BG, and the bottom bar's Upscale.
       The class prefixes differ, so the target carries both. */
    var rowBTargetEl = function(){
      var s = rowBSteps[rowBCurrent];
      if (s && s.target === "upscale") return rowBActUpscale;
      if (s && s.target === "watermark") return rowBOverlayWatermarkBtn;
      return rowBOverlayBtn;
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
      if (rowBOverlay) rowBOverlay.classList.remove("hero-overlay--live");
      if (rowBClip) rowBClip.classList.add("hero-slider-clip--wipe");
      if (rowBPicture) {
        rowBPicture.style.transition = "none";
        rowBPicture.style.setProperty("--hero-split", "1");
        void rowBPicture.offsetWidth;
        rowBPicture.style.transition = "";
        rowBPicture.style.setProperty("--hero-split", "0");
      }
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
      if (!rowBPicture) return;
      f = Math.max(0, Math.min(1, f));
      rowBPicture.style.setProperty("--hero-split", String(f));
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
      if (rowBPicture) {
        rowBPicture.style.transition = "none";
        rowBPicture.style.setProperty("--hero-split", "1");
        void rowBPicture.offsetWidth;
        rowBPicture.style.transition = "";
      }
      rowBOverlay.classList.remove("hero-overlay--on");
      rowBCursor.classList.remove("rowB-cursor--on");
      if (rowBTip) rowBTip.classList.remove("rowB-tip--in");
      if (rowBOverlayBtn) {
        rowBOverlayBtn.classList.remove("hero-overlay-btn--press");
        rowBOverlayBtn.classList.remove("hero-overlay-btn--hover");
      }
      if (rowBOverlayWatermarkBtn) {
        rowBOverlayWatermarkBtn.classList.remove("hero-overlay-btn--hidden");
        rowBOverlayWatermarkBtn.classList.remove("hero-overlay-btn--press");
        rowBOverlayWatermarkBtn.classList.remove("hero-overlay-btn--hover");
      }
      if (rowBActUpscale) {
        rowBActUpscale.classList.remove("hero-overlay-act--press");
        rowBActUpscale.classList.remove("hero-overlay-act--hover");
        rowBActUpscale.classList.remove("hero-overlay-act--ghost");
      }
      if (rowBBusy) rowBBusy.classList.remove("hero-busy--on");
      if (rowBHint) rowBHint.classList.remove("hero-hint--off");
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
      rowBRunToken++;
      var playToken = { reg: rowBRunToken, get: function(){ return rowBRunToken; } };
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
      heroSetPictureRatio(rowBOverlayImg, step.ratio || "", rowBPicture, playToken, step.img);
      rowBSetAction(step, false);
      for (var c = 0; c < rowBCards.length; c++){
        if (c === index) rowBCards[c].classList.add("rowB-card--active");
        else rowBCards[c].classList.remove("rowB-card--active");
      }

      whenOverlayImgReady(rowBOverlayImg, function(){
      if (rowBReduce && rowBReduce.matches) {
        whenOverlayImgReady(rowBOverlayAfter, function(){
          if (!tokenLive(playToken)) return;
          tile.classList.add("hero-tile--hot");
          rowBOverlay.classList.add("hero-overlay--on");
          rowBReveal();
          rowBEnterLive();
        }, playToken);
        return;
      }

      if (!tokenLive(playToken)) return;
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
      }, playToken);
    };

    rowBCards.forEach(function(card, i){
      card.addEventListener("click", function(){ rowBPlay(i); });
    });

    var rowBSplitFrom = function(clientX){
      if (!rowBOverlayImg) return;
      var r = rowBOverlayImg.getBoundingClientRect();
      if (!r.width) return;
      rowBSetSplit((clientX - r.left) / r.width);
    };
    var rowBOnChrome = function(target){
      return !!(target && target.closest &&
        target.closest(".hero-overlay-btn, .hero-overlay-act"));
    };
    var rowBBindLiveFigure = function(rowBLiveFigure){
      rowBLiveFigure.addEventListener("dragstart", function(e){ e.preventDefault(); });
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
    };
    [].slice.call(document.querySelectorAll(".hero-overlay-figure")).forEach(rowBBindLiveFigure);

    var rowBRow = document.querySelector(".grrab-rowB");
    if (rowBRow && "IntersectionObserver" in window) {
      var rowBHasEntered = false;
      new IntersectionObserver(function(entries){
        for (var i = 0; i < entries.length; i++){
          if (rowBDone) continue;
          if (entries[i].isIntersecting) {
            rowBHasEntered = true;
            if (rowBMobile && rowBMobile.matches) {
              rowBPlay(rowBCurrent);
            } else if (window.grrabBrowser && window.grrabBrowser.at === "rowA") {
              window.grrabBrowser.moveToRowB(function(){ rowBPlay(rowBCurrent); });
            } else if (window.grrabBrowser && window.grrabBrowser.at === "hero") {
              window.grrabBrowser.moveToRowB(function(){ rowBPlay(rowBCurrent); });
            } else if (!window.grrabBrowser || window.grrabBrowser.at === "rowB") {
              rowBPlay(rowBCurrent);
            }
          } else {
            if (!rowBHasEntered) continue;
            rowBStop();
            if (window.grrabBrowser && entries[i].boundingClientRect.top > 0 &&
                !(rowBMobile && rowBMobile.matches)) {
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
    {id:"youtube",  label:"YouTube.",  previewLabel:"YouTube grab preview",  name:"Youtube",   short:"YT", tint:"#FF0000", preview:"/assets/landing/img/youtube_preview.webp",
     icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.9-.5-5.6a2.9 2.9 0 0 0-2-2C18.8 4 12 4 12 4s-6.8 0-8.5.4a2.9 2.9 0 0 0-2 2C1 8.1 1 12 1 12s0 3.9.5 5.6a2.9 2.9 0 0 0 2 2C5.2 20 12 20 12 20s6.8 0 8.5-.4a2.9 2.9 0 0 0 2-2C23 15.9 23 12 23 12Z"/><polygon points="9.8 15.2 15.5 12 9.8 8.8" fill="#fff"/></svg>'},
    {id:"instagram",label:"Instagram.",previewLabel:"Instagram grab preview",name:"Instagram", short:"IG", tint:"#C13584", preview:"/assets/landing/img/instagram_preview.webp",
     icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>'},
    {id:"pinterest",label:"Pinterest.",previewLabel:"Pinterest grab preview",name:"Pinterest", short:"P",  tint:"#E60023", preview:"/assets/landing/img/pinterest_preview.webp",
     icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-4.9s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.5 2.2-.8 3.4-.2.9.5 1.7 1.4 1.7 1.7 0 2.9-2.2 2.9-4.7 0-2-1.3-3.4-3.7-3.4a4.2 4.2 0 0 0-4.4 4.2c0 .8.2 1.4.6 1.8.2.2.2.3.1.5l-.2.8c0 .3-.2.3-.5.2-1.3-.5-1.9-2-1.9-3.6 0-2.7 2.3-5.9 6.7-5.9 3.6 0 5.9 2.6 5.9 5.3 0 3.6-2 6.4-5 6.4-1 0-2-.6-2.3-1.2l-.6 2.5c-.2.8-.7 1.7-1 2.3A10 10 0 1 0 12 2Z"/></svg>'},
    {id:"chatgpt",  label:"ChatGPT.",       previewLabel:"ChatGPT grab preview", name:"ChatGPT", short:"GPT", tint:"#10A37F",
     preview:"/assets/landing/img/rowC/gpt-image-1.webp",
     icon:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.20509 8.76511V6.50545C9.20509 6.31513 9.27649 6.17234 9.44293 6.0773L13.9861 3.46088C14.6046 3.10413 15.342 2.93769 16.103 2.93769C18.9573 2.93769 20.7651 5.14983 20.7651 7.50454C20.7651 7.67098 20.7651 7.86129 20.7412 8.05161L16.0316 5.2924C15.7462 5.12596 15.4607 5.12596 15.1753 5.2924L9.20509 8.76511ZM19.8135 17.5659V12.1664C19.8135 11.8333 19.6708 11.5955 19.3854 11.429L13.4152 7.95633L15.3656 6.83833C15.5321 6.74328 15.6749 6.74328 15.8413 6.83833L20.3845 9.45474C21.6928 10.216 22.5728 11.8333 22.5728 13.4031C22.5728 15.2108 21.5025 16.8758 19.8135 17.5657V17.5659ZM7.80173 12.8088L5.8513 11.6671C5.68486 11.5721 5.61346 11.4293 5.61346 11.239V6.00613C5.61346 3.46111 7.56389 1.53433 10.2042 1.53433C11.2033 1.53433 12.1307 1.86743 12.9159 2.46202L8.2301 5.17371C7.94475 5.34015 7.80195 5.57798 7.80195 5.91109V12.809L7.80173 12.8088ZM12 15.2349L9.20509 13.6651V10.3351L12 8.76534L14.7947 10.3351V13.6651L12 15.2349ZM13.7958 22.4659C12.7967 22.4659 11.8693 22.1328 11.0841 21.5382L15.7699 18.8265C16.0553 18.6601 16.198 18.4222 16.198 18.0891V11.1912L18.1723 12.3329C18.3388 12.4279 18.4102 12.5707 18.4102 12.761V17.9939C18.4102 20.5389 16.4359 22.4657 13.7958 22.4657V22.4659ZM8.15848 17.1617L3.61528 14.5452C2.30696 13.784 1.42701 12.1667 1.42701 10.5969C1.42701 8.76534 2.52115 7.12414 4.20987 6.43428V11.8574C4.20987 12.1905 4.35266 12.4284 4.63802 12.5948L10.5846 16.0436L8.63415 17.1617C8.46771 17.2567 8.32492 17.2567 8.15848 17.1617ZM7.897 21.0625C5.20919 21.0625 3.23488 19.0407 3.23488 16.5432C3.23488 16.3529 3.25875 16.1626 3.2824 15.9723L7.96817 18.6839C8.25352 18.8504 8.53911 18.8504 8.82446 18.6839L14.7947 15.2351V17.4948C14.7947 17.6851 14.7233 17.8279 14.5568 17.9229L10.0136 20.5393C9.39518 20.8961 8.6578 21.0625 7.89677 21.0625H7.897ZM13.7958 23.8929C16.6739 23.8929 19.0762 21.8474 19.6235 19.1357C22.2874 18.4459 24 15.9484 24 13.4034C24 11.7383 23.2865 10.121 22.002 8.95542C22.121 8.45588 22.1924 7.95633 22.1924 7.45702C22.1924 4.0557 19.4331 1.51045 16.2458 1.51045C15.6037 1.51045 14.9852 1.60549 14.3668 1.81968C13.2963 0.773071 11.8215 0.107086 10.2042 0.107086C7.32606 0.107086 4.92383 2.15256 4.37653 4.86425C1.7126 5.55411 0 8.05161 0 10.5966C0 12.2617 0.713506 13.879 1.99795 15.0446C1.87904 15.5441 1.80764 16.0436 1.80764 16.543C1.80764 19.9443 4.56685 22.4895 7.75421 22.4895C8.39632 22.4895 9.01478 22.3945 9.63324 22.1803C10.7035 23.2269 12.1783 23.8929 13.7958 23.8929Z" fill="currentColor"/></svg>'},
    {id:"video",    label:"Any video.",     previewLabel:"Video grab preview",   name:"Video",     short:"V",  tint:"#BC13FE", preview:"/assets/landing/img/rowC/video-main.webp",
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
          '<div class="rowC-body-scale">'+opts.bodyHtml+'</div>'+
        '</div>'+
    '</div>';
  }

  function youtubeBodyHtml(){
    return '<div class="yt-body">'+
            '<aside class="yt-sidebar">'+
              '<div class="yt-sidebar-menu"><span class="yt-sidebar-menu-icon"><img class="yt-slot-img" src="/assets/landing/icons/icon_hamburgerbar.svg" alt=""></span></div>'+
              '<nav class="yt-sidebar-nav">'+
                '<div class="yt-sidebar-item"><span class="yt-sidebar-icon yt-sidebar-icon--home"><img class="yt-slot-img" src="/assets/landing/icons/icon_home.svg" alt=""></span></div>'+
                '<div class="yt-sidebar-item"><span class="yt-sidebar-icon yt-sidebar-icon--shorts"><img class="yt-slot-img" src="/assets/landing/icons/icon_shorts.svg" alt=""></span></div>'+
                '<div class="yt-sidebar-item"><span class="yt-sidebar-icon yt-sidebar-icon--subs"><img class="yt-slot-img" src="/assets/landing/icons/icon_subscriptions.svg" alt=""></span></div>'+
                '<div class="yt-sidebar-item"><span class="yt-sidebar-icon yt-sidebar-icon--you"><img class="yt-slot-img" src="/assets/landing/icons/icon_you.svg" alt=""></span></div>'+
              '</nav>'+
            '</aside>'+
            '<div class="yt-main">'+
              '<div class="yt-topbar">'+
                '<div class="yt-logo"><img class="yt-slot-img" src="/assets/landing/icons/logo_youtube.webp" alt=""></div>'+
                '<div class="yt-search-wrap"><div class="yt-search"><div class="yt-search-input"><span>Search</span></div><div class="yt-search-btn"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></div></div></div>'+
                '<div class="yt-topbar-right"></div>'+
              '</div>'+
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
                  '<div class="yt-video-card yt-video-card--dim">'+
                    '<div class="yt-thumb"><img src="/assets/landing/img/rowC/image-4.webp" alt=""></div>'+
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
                    '<div class="yt-short-card"><div class="yt-thumb yt-thumb--short"><img src="/assets/landing/img/rowC/shorts-1.webp" alt=""></div><div class="yt-meta"><span class="yt-meta-lines"><span class="yt-meta-line"></span><span class="yt-meta-line yt-meta-line--short"></span></span></div></div>'+
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
            pinFeedCardHtml('115.25/169',    true, false, '/assets/landing/img/rowC/pin-image-3.webp')
          ])+
          pinFeedColHtml([
            pinFeedCardHtml('115.25/132',    false,  true,  '/assets/landing/img/rowC/pin-image-4.webp'),
            pinFeedCardHtml('115.25/132',    true, false, '/assets/landing/img/rowC/pin-image-5.webp'),
            pinFeedCardHtml('115.25/115.25', true, false, '/assets/landing/img/rowC/pin-image-6.webp')
          ])+
          pinFeedColHtml([
            pinFeedCardHtml('115.25/188',    true, false, '/assets/landing/img/rowC/pin-image-7.webp'),
            pinFeedCardHtml('115.25/115.25', true, false, '/assets/landing/img/rowC/pin-image-8.webp'),
            pinFeedCardHtml('115.25/115.25', true, false, '/assets/landing/img/rowC/pin-image-9.webp')
          ])+
          pinFeedColHtml([
            pinFeedCardHtml('115.25/160',    true, false, '/assets/landing/img/rowC/pin-image-10.webp'),
            pinFeedCardHtml('115.25/169',    true, false, '/assets/landing/img/rowC/pin-image-11.webp'),
            pinFeedCardHtml('115.25/102.33', true, false, '/assets/landing/img/rowC/pin-image-12.webp')
          ])+
          pinFeedColHtml([
            pinFeedCardHtml('115.25/132',    true, false, '/assets/landing/img/rowC/pin-image-4.webp'),
            pinFeedCardHtml('115.25/132',    true, false, '/assets/landing/img/rowC/pin-image-5.webp'),
            pinFeedCardHtml('115.25/115.25', true, false, '/assets/landing/img/rowC/pin-image-6.webp')
          ])+
          pinFeedColHtml([
            pinFeedCardHtml('115.25/160',    true, false, '/assets/landing/img/rowC/pin-image-1.webp'),
            pinFeedCardHtml('115.25/102.33', true, false, '/assets/landing/img/rowC/pin-image-2.webp'),
            pinFeedCardHtml('115.25/169',    true, false, '/assets/landing/img/rowC/pin-image-3.webp')
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
    row.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;cursor:pointer;font:inherit;padding:10px 4px;border-radius:10px;background:transparent;border:none;outline:none;-webkit-appearance:none;appearance:none;transition:background .15s ease;";
    var iconWrap = document.createElement("span");
    iconWrap.className = "rowC-item-icon";
    iconWrap.style.cssText = "flex-shrink:0;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;color:var(--ink-muted);transition:color .15s ease;";
    iconWrap.innerHTML = it.icon;
    var txt = document.createElement("span");
    txt.className = "rowC-item-text";
    txt.style.cssText = "font-size:13px;line-height:1.2;color:var(--ink-muted);min-width:0;text-align:center;";
    var rowCBare = it.label.replace(/\.$/, "");
    txt.innerHTML = '<strong class="rowC-item-title" style="font-weight:700;color:var(--ink-strong);">'+rowCBare+'</strong>';
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
    syncRowCMockScale();
  }
  panesEl.addEventListener("mouseenter", function(){ panesEl.classList.add("inspire-hover"); });
  panesEl.addEventListener("mouseleave", inspireHoverOff);

  function syncRowCMockScale(){
    var w = panesEl.clientWidth;
    panesEl.style.setProperty("--rowC-mock-scale", w > 0 ? String(w / 645) : "1");
  }
  syncRowCMockScale();
  if (typeof ResizeObserver !== "undefined") {
    var rowCPaneRo = new ResizeObserver(syncRowCMockScale);
    rowCPaneRo.observe(panesEl);
  } else {
    window.addEventListener("resize", syncRowCMockScale);
  }

  var rowCHeadingEl = listEl.previousElementSibling;
  function syncRowCListHeight(){
    if (!rowCHeadingEl || !rowCHeadingEl.classList.contains("rowC-heading")) return;
    var headingH = rowCHeadingEl.getBoundingClientRect().height;
    var listW = listEl.clientWidth;
    var capH = ((listW - 12) / 4) * 0.7;
    var h = Math.min(headingH, capH);
    listEl.style.setProperty("--rowC-list-h", h + "px");
  }
  syncRowCListHeight();
  if (typeof ResizeObserver !== "undefined") {
    var rowCListRo = new ResizeObserver(syncRowCListHeight);
    rowCListRo.observe(rowCHeadingEl);
    rowCListRo.observe(listEl);
  } else {
    window.addEventListener("resize", syncRowCListHeight);
  }

  activate("youtube");
  syncRowCListHeight();
  syncRowCMockScale();
})();
