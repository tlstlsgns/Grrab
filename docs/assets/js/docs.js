(function(){
  "use strict";
  try {
    var isMac = navigator.platform.toUpperCase().indexOf("MAC") !== -1 ||
                navigator.userAgent.indexOf("Mac") !== -1;
    if (!isMac) {
      var copyTip = document.querySelector(".docs-demo-tip--copy");
      var pasteTip = document.querySelector(".docs-demo-tip--paste");
      if (copyTip) copyTip.textContent = "Ctrl+C";
      if (pasteTip) pasteTip.textContent = "Ctrl+V";
    }
  } catch (e) {}

  var firstCopyDemo = document.getElementById("firstCopyDemo");
  if (!firstCopyDemo) return;

  var docsCursor = firstCopyDemo.querySelector(".docs-demo-cursor");
  var docsCopyTip = firstCopyDemo.querySelector(".docs-demo-tip--copy");
  var docsPasteTip = firstCopyDemo.querySelector(".docs-demo-tip--paste");
  var docsToast = firstCopyDemo.querySelector(".docs-demo-toast");
  var docsInstantPastes = firstCopyDemo.querySelectorAll(".docs-demo-paste--instant");
  var docsCanvas = firstCopyDemo.querySelector(".docs-demo-canvas");
  var docsCanvasBody = firstCopyDemo.querySelector(".docs-demo-canvas-body");
  var docsCanvasPan = firstCopyDemo.querySelector(".docs-demo-canvas-pan");
  var docsGallery = firstCopyDemo.querySelector(".docs-demo-gallery");
  var docsTiles = docsGallery ? docsGallery.querySelectorAll(".docs-demo-tile") : [];
  var docsOverlay = firstCopyDemo.querySelector(".docs-demo-overlay");
  var docsOverlayImg = firstCopyDemo.querySelector(".docs-demo-overlay-img");
  var docsOverlayPicture = firstCopyDemo.querySelector(".docs-demo-overlay-picture");
  var docsOverlayBtn = firstCopyDemo.querySelector(".docs-demo-overlay-btn");
  var docsOverlayAfter = firstCopyDemo.querySelector(".docs-demo-overlay-after");
  var docsMarquee = firstCopyDemo.querySelector(".docs-demo-marquee");
  var docsHint = firstCopyDemo.querySelector(".docs-demo-hint");
  var docsBusy = firstCopyDemo.querySelector(".docs-demo-busy");
  var docsSlider = firstCopyDemo.querySelector(".docs-demo-slider");
  var docsSliderHandle = firstCopyDemo.querySelector(".docs-demo-slider-handle");
  var docsLateActs = firstCopyDemo.querySelectorAll(".docs-demo-overlay-act--late");
  var docsActCopy = firstCopyDemo.querySelector(".docs-demo-overlay-bar-right .docs-demo-overlay-act:last-child");
  var docsSteps = [
    { tile: 0, img: "/assets/landing/img/hero-image-1-before.webp", ratio: "579/800",
      icon: "/assets/landing/icons/hero/icon_removebg.svg", label: "Remove BG", alpha: true },
    { tile: 1, img: "/assets/landing/img/hero-image-3-before.webp", ratio: "1000/750",
      icon: "/assets/landing/icons/hero/icon_erase.svg", label: "Remove",
      box: { l: 0.44, t: 0.43, r: 0.58, b: 0.61 }, alpha: false },
    { tile: 2, img: "/assets/landing/img/hero-image-6-before.webp", ratio: "1000/667",
      icon: "/assets/landing/icons/hero/icon_removebg.svg", label: "Remove BG", alpha: true },
    { tile: 3, img: "/assets/landing/img/hero-image-5-before.webp", ratio: "1000/668",
      icon: "/assets/landing/icons/hero/icon_erase.svg", label: "Remove",
      box: { l: 0.39, t: 0.38, r: 0.59, b: 0.65 }, alpha: false },
    { tile: 4, img: "/assets/landing/img/hero-image-7-before.webp", ratio: "534/800",
      icon: "/assets/landing/icons/hero/icon_erase.svg", label: "Remove",
      box: { l: 0.45, t: 0.51, r: 0.90, b: 0.96 }, alpha: false },
    { tile: 5, img: "/assets/landing/img/hero-image-4-before.webp", ratio: "1000/667",
      icon: "/assets/landing/icons/hero/icon_removebg.svg", label: "Remove BG", alpha: true },
    { tile: 6, img: "/assets/landing/img/hero-image-12-before.webp", ratio: "1000/667",
      icon: "/assets/landing/icons/hero/icon_erase.svg", label: "Remove",
      box: { l: 0.42, t: 0.32, r: 0.53, b: 0.55 }, alpha: false }
  ];
  var docsInstantRepLen = 3200;
  var docsToastMs = 1200;
  var docsPasteMin = 0.10;
  var docsPasteRetries = 24;
  var docsPasteMax = 10;
  var docsPasteCount = 0;
  var docsPlaced = [];
  var docsUsedAnchors = [];
  var docsUsedTiles = [];
  var docsPasteAnchors = [
    { ox: -0.25, oy: -0.25 }, { ox: 0, oy: -0.25 }, { ox: 0.25, oy: -0.25 },
    { ox: -0.25, oy: 0 }, { ox: 0, oy: 0 }, { ox: 0.25, oy: 0 },
    { ox: -0.25, oy: 0.25 }, { ox: 0, oy: 0.25 }, { ox: 0.25, oy: 0.25 }
  ];
  var docsAnchorTiers = [[4], [0, 2, 6, 8], [1, 3, 5, 7]];
  var docsDemoTimers = [];
  var docsDemoRaf = 0;
  var docsDemoReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  var docsDemoClearTimers = function(){
    for (var i = 0; i < docsDemoTimers.length; i++) clearTimeout(docsDemoTimers[i]);
    docsDemoTimers = [];
  };
  var docsDemoAt = function(ms, fn){ docsDemoTimers.push(setTimeout(fn, ms)); };

  var docsOffsetIn = function(el){
    var x = 0, y = 0, n = el;
    while (n && n !== firstCopyDemo) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y };
  };
  var docsCentreIn = function(el){
    var p = docsOffsetIn(el);
    return { x: p.x + el.offsetWidth / 2, y: p.y + el.offsetHeight / 2 };
  };
  var docsPointIn = function(el){
    var o = docsOffsetIn(el);
    return { x: o.x + el.offsetWidth / 2, y: o.y + el.offsetHeight / 2 };
  };
  var docsMoveTo = function(p){
    if (docsCursor) docsCursor.style.transform = "translate(" + p.x + "px," + p.y + "px)";
  };

  var docsHotOnly = function(tile){
    for (var i = 0; i < docsTiles.length; i++){
      if (docsTiles[i] === tile) docsTiles[i].classList.add("docs-demo-tile--hot");
      else docsTiles[i].classList.remove("docs-demo-tile--hot");
    }
  };

  var docsTrack = function(durationMs){
    var started = Date.now();
    var tick = function(){
      if (!docsCursor) return;
      var r = docsCursor.getBoundingClientRect();
      var under = document.elementFromPoint(r.left, r.top);
      docsHotOnly(under && under.closest ? under.closest(".docs-demo-tile") : null);
      if (Date.now() - started < durationMs) docsDemoRaf = requestAnimationFrame(tick);
      else docsDemoRaf = 0;
    };
    docsDemoRaf = requestAnimationFrame(tick);
  };

  var docsPastePointIn = function(ox, oy){
    if (!docsCanvasBody) return { x: 0, y: 0 };
    if (ox == null) ox = 0;
    if (oy == null) oy = 0;
    var p = docsCentreIn(docsCanvasBody);
    return { x: p.x + docsCanvasBody.offsetWidth * ox,
             y: p.y + docsCanvasBody.offsetHeight * oy };
  };
  var docsPickAnchor = function(){
    var ai, pi, ti, ki, pool = [], tierPool = [];
    for (ai = 0; ai < docsPasteAnchors.length; ai++) {
      var taken = false;
      for (pi = 0; pi < docsUsedAnchors.length; pi++) {
        if (docsUsedAnchors[pi] === ai) { taken = true; break; }
      }
      if (!taken) pool.push(ai);
    }
    if (!pool.length) return Math.floor(Math.random() * docsPasteAnchors.length);
    for (ti = 0; ti < docsAnchorTiers.length; ti++) {
      tierPool = [];
      for (ki = 0; ki < docsAnchorTiers[ti].length; ki++) {
        ai = docsAnchorTiers[ti][ki];
        for (pi = 0; pi < pool.length; pi++) {
          if (pool[pi] === ai) { tierPool.push(ai); break; }
        }
      }
      if (tierPool.length) return tierPool[Math.floor(Math.random() * tierPool.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  };
  var docsPickSlot = function(){
    var anchorIdx = docsPickAnchor();
    var anchor = docsPasteAnchors[anchorIdx];
    var ox = 0, oy = 0, attempt, ok, pi;
    for (attempt = 0; attempt < docsPasteRetries; attempt++) {
      ox = anchor.ox + (Math.random() * 0.15 - 0.075);
      oy = anchor.oy + (Math.random() * 0.15 - 0.075);
      ok = true;
      if (docsCanvasBody && docsCanvasBody.offsetWidth) {
        for (pi = 0; pi < docsPlaced.length; pi++) {
          var dx = (ox - docsPlaced[pi].ox) * docsCanvasBody.offsetWidth;
          var dy = (oy - docsPlaced[pi].oy) * docsCanvasBody.offsetHeight;
          if (Math.sqrt(dx * dx + dy * dy) < docsCanvasBody.offsetWidth * docsPasteMin) {
            ok = false;
            break;
          }
        }
      }
      if (ok) break;
    }
    docsUsedAnchors.push(anchorIdx);
    var slot = { ox: ox, oy: oy };
    docsPlaced.push(slot);
    return slot;
  };
  var docsClearPastes = function(){
    if (!docsCanvasPan) return;
    var nodes = docsCanvasPan.querySelectorAll(".docs-demo-paste:not(.docs-demo-paste--instant):not(.docs-demo-paste--editor):not(.docs-demo-paste--editor-2)");
    for (var ci = 0; ci < nodes.length; ci++) nodes[ci].remove();
    docsPlaced = [];
    docsUsedAnchors = [];
    docsUsedTiles = [];
    docsPasteCount = 0;
  };
  var docsPickSteps = function(){
    var pool = [];
    var si, ui, t, used;
    for (si = 0; si < docsSteps.length; si++) {
      t = docsSteps[si].tile;
      used = false;
      for (ui = 0; ui < docsUsedTiles.length; ui++) {
        if (docsUsedTiles[ui] === t) { used = true; break; }
      }
      if (!used) pool.push(si);
    }
    for (var sj = pool.length - 1; sj > 0; sj--) {
      var sk = Math.floor(Math.random() * (sj + 1));
      var st = pool[sj]; pool[sj] = pool[sk]; pool[sk] = st;
    }
    return pool.slice(0, pool.length < 5 ? pool.length : 5);
  };
  var docsPasteAfterSrc = function(stepIndex){
    return docsSteps[stepIndex].img.replace(/-before\.(webp|jpe?g)$/, "-after.$1");
  };
  var docsClampPaste = function(el){
    if (!el || !docsCanvasBody || !docsCanvasPan) return;
    var panO = docsOffsetIn(docsCanvasPan);
    var canvasO = docsOffsetIn(docsCanvasBody);
    var minLeft = canvasO.x - panO.x;
    var minTop = canvasO.y - panO.y;
    var W = docsCanvasBody.offsetWidth;
    var H = docsCanvasBody.offsetHeight;
    var padX = W * 0.03;
    var padY = H * 0.03;
    var w = el.offsetWidth;
    var h = el.offsetHeight;
    var left = parseFloat(el.style.left) || 0;
    var top = parseFloat(el.style.top) || 0;
    if (w <= W - 2 * padX) left = Math.max(minLeft + padX, Math.min(left, minLeft + W - w - padX));
    else left = minLeft + padX;
    if (h <= H - 2 * padY) top = Math.max(minTop + padY, Math.min(top, minTop + H - h - padY));
    else top = minTop + padY;
    el.style.left = left + "px";
    el.style.top = top + "px";
  };

  var docsSetPictureRatio = function(img, fallback){
    if (!docsOverlayPicture || !img) return;
    var apply = function(){
      if (img.naturalWidth && img.naturalHeight) {
        docsOverlayPicture.style.aspectRatio = img.naturalWidth + "/" + img.naturalHeight;
      } else if (fallback) docsOverlayPicture.style.aspectRatio = fallback;
    };
    apply();
    if (!img.naturalWidth) img.addEventListener("load", apply, { once: true });
  };
  var docsImgRatio = function(img, fallback){
    if (img && img.naturalWidth && img.naturalHeight) {
      return img.naturalWidth + "/" + img.naturalHeight;
    }
    return fallback || "";
  };
  var docsTileCoverDrawn = function(tile, rw, rh){
    if (!tile || !rw || !rh) return null;
    var W = tile.offsetWidth;
    var H = tile.offsetHeight;
    if (!W || !H) return null;
    var r = rw / rh;
    if (W / H > r) return { w: H * r, h: H };
    return { w: W, h: W / r };
  };
  var docsPasteSize = function(el, ratio, tile){
    if (!el || !ratio) return;
    var parts = String(ratio).split("/");
    var rw = parseFloat(parts[0]);
    var rh = parseFloat(parts[1]);
    if (!rw || !rh) return;
    el.style.aspectRatio = rw + "/" + rh;
    var drawn = tile ? docsTileCoverDrawn(tile, rw, rh) : null;
    var panW = docsCanvasPan ? docsCanvasPan.offsetWidth : 0;
    var panH = docsCanvasPan ? docsCanvasPan.offsetHeight : 0;
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
  var docsPasteAt = function(el, ox, oy, ratio, tile){
    if (!el || !docsCanvasBody || !docsCanvasPan) return;
    if (ox == null) ox = 0;
    if (oy == null) oy = 0;
    var p = docsPastePointIn(ox, oy);
    var o = docsOffsetIn(docsCanvasPan);
    docsPasteSize(el, ratio, tile);
    el.classList.add("docs-demo-paste--in");
    void el.offsetWidth;
    el.style.left = (p.x - o.x - el.offsetWidth / 2) + "px";
    el.style.top = (p.y - o.y - el.offsetHeight / 2) + "px";
    docsClampPaste(el);
  };
  var docsCreatePaste = function(stepIndex, ox, oy){
    if (!docsCanvasPan) return null;
    if (docsPasteCount >= docsPasteMax) docsClearPastes();
    var el = document.createElement("img");
    el.className = "docs-demo-paste";
    el.setAttribute("src", docsPasteAfterSrc(stepIndex));
    el.setAttribute("alt", "");
    el.setAttribute("draggable", "false");
    docsCanvasPan.appendChild(el);
    var pasteTile = docsTiles[docsSteps[stepIndex].tile];
    var pasteFallback = docsSteps[stepIndex].ratio;
    var pasteApply = function(){
      var pr = pasteFallback;
      if (el.naturalWidth && el.naturalHeight) {
        pr = el.naturalWidth + "/" + el.naturalHeight;
      }
      docsPasteAt(el, ox, oy, pr, pasteTile);
    };
    if (el.complete && el.naturalWidth) pasteApply();
    else {
      el.addEventListener("load", pasteApply, { once: true });
      pasteApply();
    }
    var pt = docsSteps[stepIndex].tile;
    if (docsUsedTiles.indexOf(pt) < 0) docsUsedTiles.push(pt);
    docsPasteCount++;
    return el;
  };
  var docsPasteApply = function(el, ox, oy, srcImg, fallback, tile){
    if (!el) return;
    var apply = function(){
      var pr = fallback || "";
      if (el.naturalWidth && el.naturalHeight) {
        pr = el.naturalWidth + "/" + el.naturalHeight;
      } else if (srcImg) {
        pr = docsImgRatio(srcImg, fallback);
      }
      docsPasteAt(el, ox, oy, pr, tile);
    };
    if (el.complete && el.naturalWidth) apply();
    else {
      el.addEventListener("load", apply, { once: true });
      apply();
    }
  };

  var docsTileImgSrc = function(tile){
    var img = tile ? tile.querySelector("img") : null;
    return img ? img.getAttribute("src") : "";
  };

  var docsPickInstantTiles = function(){
    var order = [docsTiles[0]];
    var pool = [];
    for (var ti = 1; ti < docsTiles.length; ti++) pool.push(docsTiles[ti]);
    for (var sj = pool.length - 1; sj > 0; sj--) {
      var sk = Math.floor(Math.random() * (sj + 1));
      var st = pool[sj]; pool[sj] = pool[sk]; pool[sk] = st;
    }
    for (var pi = 0; pi < 4 && pi < pool.length; pi++) order.push(pool[pi]);
    return order;
  };

  var docsSetAction = function(erasing){
    if (!docsOverlayBtn) return;
    var icon = docsOverlayBtn.querySelector("img");
    var label = docsOverlayBtn.querySelector("span");
    if (icon) {
      icon.setAttribute("src", erasing
        ? "/assets/landing/icons/rowB/icon_erase.svg"
        : "/assets/landing/icons/rowB/icon_removebg.svg");
    }
    if (label) label.textContent = erasing ? "Remove" : "Remove BG";
    if (docsHint) {
      if (erasing) docsHint.classList.add("docs-demo-hint--off");
      else docsHint.classList.remove("docs-demo-hint--off");
    }
  };

  var docsBoxPoint = function(fx, fy){
    if (!docsOverlayImg) return { x: 0, y: 0 };
    var o = docsOffsetIn(docsOverlayImg);
    return { x: o.x + docsOverlayImg.offsetWidth * fx,
             y: o.y + docsOverlayImg.offsetHeight * fy };
  };

  var docsDragTrack = function(box, durationMs){
    var started = Date.now();
    var tick = function(){
      if (!docsOverlayImg || !docsMarquee || !docsCursor) return;
      var fr = docsOverlayImg.getBoundingClientRect();
      var cr = docsCursor.getBoundingClientRect();
      if (fr.width && fr.height) {
        var w = Math.max(0, Math.min((cr.left - fr.left) / fr.width, 1) - box.l);
        var h = Math.max(0, Math.min((cr.top - fr.top) / fr.height, 1) - box.t);
        docsMarquee.style.width = (w * 100) + "%";
        docsMarquee.style.height = (h * 100) + "%";
      }
      if (Date.now() - started < durationMs) docsDemoRaf = requestAnimationFrame(tick);
      else docsDemoRaf = 0;
    };
    docsDemoRaf = requestAnimationFrame(tick);
  };

  var docsApplyStepBtn = function(step){
    if (!docsOverlayBtn || !step) return;
    var icon = docsOverlayBtn.querySelector("img");
    var label = docsOverlayBtn.querySelector("span");
    if (icon && step.icon) icon.setAttribute("src", step.icon);
    if (label && step.label) label.textContent = step.label;
  };
  var docsSetStep = function(step){
    if (!step || !docsOverlayImg) return;
    docsOverlayImg.setAttribute("src", step.img);
    if (docsOverlayAfter) {
      docsOverlayAfter.setAttribute("src", step.img.replace("-before.webp", "-after.webp"));
      if (step.alpha) docsOverlayAfter.classList.add("docs-demo-overlay-after--alpha");
      else docsOverlayAfter.classList.remove("docs-demo-overlay-after--alpha");
    }
    docsSetPictureRatio(docsOverlayImg, step.ratio || "");
    docsApplyStepBtn(step);
  };

  var docsDemoReset = function(){
    if (docsDemoRaf) { cancelAnimationFrame(docsDemoRaf); docsDemoRaf = 0; }
    docsHotOnly(null);
    if (docsCursor) {
      docsCursor.classList.remove("docs-demo-cursor--on");
      docsCursor.style.transition = "none";
      docsCursor.style.transform = "";
      void docsCursor.offsetWidth;
      docsCursor.style.transition = "";
    }
    if (docsCopyTip) docsCopyTip.classList.remove("docs-demo-tip--in");
    if (docsPasteTip) docsPasteTip.classList.remove("docs-demo-tip--in");
    if (docsToast) docsToast.classList.remove("docs-demo-toast--in");
    var docsAllPastes = firstCopyDemo.querySelectorAll(".docs-demo-canvas-pan .docs-demo-paste");
    for (var pri = 0; pri < docsAllPastes.length; pri++) {
      docsAllPastes[pri].classList.remove("docs-demo-paste--in");
      docsAllPastes[pri].style.left = "";
      docsAllPastes[pri].style.top = "";
      docsAllPastes[pri].style.width = "";
      docsAllPastes[pri].style.height = "";
      docsAllPastes[pri].style.aspectRatio = "";
    }
    for (var ii = 0; ii < docsInstantPastes.length; ii++) {
      docsInstantPastes[ii].setAttribute("src", "");
    }
    docsClearPastes();
    if (docsMarquee) {
      docsMarquee.classList.remove("docs-demo-marquee--on");
      docsMarquee.style.left = "";
      docsMarquee.style.top = "";
      docsMarquee.style.width = "";
      docsMarquee.style.height = "";
    }
    docsSetAction(false);
    docsSetStep(docsSteps[0]);
    if (docsOverlay) docsOverlay.classList.remove("docs-demo-overlay--on");
    if (docsOverlayBtn) {
      docsOverlayBtn.classList.remove("docs-demo-overlay-btn--hover");
      docsOverlayBtn.classList.remove("docs-demo-overlay-btn--press");
    }
    if (docsBusy) docsBusy.classList.remove("docs-demo-busy--on");
    if (docsSlider) docsSlider.classList.remove("docs-demo-slider--wipe");
    if (docsSliderHandle) {
      docsSliderHandle.style.transition = "none";
      docsSliderHandle.style.left = "";
      void docsSliderHandle.offsetWidth;
      docsSliderHandle.style.transition = "";
    }
    if (docsOverlayAfter) {
      docsOverlayAfter.classList.remove("docs-demo-overlay-after--in");
      docsOverlayAfter.style.clipPath = "";
      docsOverlayAfter.style.webkitClipPath = "";
      docsOverlayAfter.style.transition = "none";
      void docsOverlayAfter.offsetWidth;
      docsOverlayAfter.style.transition = "";
    }
    for (var li = 0; li < docsLateActs.length; li++) {
      docsLateActs[li].classList.remove("docs-demo-overlay-act--in");
    }
    if (docsActCopy) {
      docsActCopy.classList.remove("docs-demo-overlay-act--hover");
      docsActCopy.classList.remove("docs-demo-overlay-act--press");
    }
  };

  var docsDemoPlay = function(){
    if (!docsCursor || !docsCanvas || !docsCanvas.offsetWidth || !docsTiles.length) return;
    docsDemoClearTimers();
    docsDemoReset();

    if (docsPasteCount + 5 > docsPasteMax) docsClearPastes();

    var tileOrder = docsPickInstantTiles();
    var slots = [];
    for (var si = 0; si < 5; si++) slots.push(docsPickSlot());

    if (docsDemoReduce && docsDemoReduce.matches) {
      for (var ri = 0; ri < 5; ri++) {
        var rtile = tileOrder[ri];
        var rel = docsInstantPastes[ri];
        if (rtile && rel) {
          rel.setAttribute("src", docsTileImgSrc(rtile));
          docsPasteApply(rel, slots[ri].ox, slots[ri].oy, rtile.querySelector("img"), "", rtile);
          docsPasteCount++;
        }
      }
      if (tileOrder[0]) tileOrder[0].classList.add("docs-demo-tile--hot");
      docsCursor.classList.add("docs-demo-cursor--on");
      var lastSlot = slots[4] || slots[0];
      docsMoveTo(docsPastePointIn(lastSlot.ox, lastSlot.oy));
      return;
    }

    var canvasCentre = docsCentreIn(docsCanvas);
    docsCursor.classList.add("docs-demo-cursor--on");
    docsCursor.style.transition = "none";
    docsMoveTo(canvasCentre);
    void docsCursor.offsetWidth;
    docsCursor.style.transition = "";

    for (var rep = 0; rep < 5; rep++) {
      (function(beat, tile, pasteEl, slot){
        var t0 = beat * docsInstantRepLen;

        docsDemoAt(t0 + 60, function(){
          if (!tile || !tile.offsetWidth) return;
          docsMoveTo(docsPointIn(tile));
          docsTrack(1000);
        });
        docsDemoAt(t0 + 1150, function(){
          if (docsDemoRaf) { cancelAnimationFrame(docsDemoRaf); docsDemoRaf = 0; }
          docsHotOnly(tile);
        });
        docsDemoAt(t0 + 1450, function(){
          if (docsCopyTip) docsCopyTip.classList.add("docs-demo-tip--in");
          if (docsToast) docsToast.classList.add("docs-demo-toast--in");
        });
        docsDemoAt(t0 + 1450 + docsToastMs, function(){
          if (docsToast) docsToast.classList.remove("docs-demo-toast--in");
        });
        docsDemoAt(t0 + 1790, function(){
          if (docsCopyTip) docsCopyTip.classList.remove("docs-demo-tip--in");
          docsMoveTo(docsPastePointIn(slot.ox, slot.oy));
          docsTrack(1000);
        });
        docsDemoAt(t0 + 2790, function(){
          if (docsPasteTip) docsPasteTip.classList.add("docs-demo-tip--in");
          if (pasteEl) {
            pasteEl.setAttribute("src", docsTileImgSrc(tile));
            docsPasteApply(pasteEl, slot.ox, slot.oy, tile.querySelector("img"), "", tile);
            docsPasteCount++;
          }
        });
        docsDemoAt(t0 + 3130, function(){
          if (docsPasteTip) docsPasteTip.classList.remove("docs-demo-tip--in");
        });
      })(rep, tileOrder[rep], docsInstantPastes[rep], slots[rep]);
    }
  };

  var docsEditorReveal = function(){
    if (docsBusy) docsBusy.classList.remove("docs-demo-busy--on");
    if (docsOverlayBtn) docsOverlayBtn.classList.remove("docs-demo-overlay-btn--press");
    if (docsSlider) docsSlider.classList.add("docs-demo-slider--wipe");
    if (docsSliderHandle) {
      docsSliderHandle.style.transition = "none";
      docsSliderHandle.style.left = "100%";
      void docsSliderHandle.offsetWidth;
      docsSliderHandle.style.transition = "";
      docsSliderHandle.style.left = "0%";
    }
    if (docsOverlayAfter) docsOverlayAfter.classList.add("docs-demo-overlay-after--in");
    docsDemoTimers.push(setTimeout(function(){
      if (docsSlider) docsSlider.classList.remove("docs-demo-slider--wipe");
    }, 1400));
  };

  var docsEditorResetOverlay = function(){
    if (docsSlider) docsSlider.classList.remove("docs-demo-slider--wipe");
    if (docsSliderHandle) {
      docsSliderHandle.style.transition = "none";
      docsSliderHandle.style.left = "";
      void docsSliderHandle.offsetWidth;
      docsSliderHandle.style.transition = "";
    }
    if (docsOverlayAfter) {
      docsOverlayAfter.classList.remove("docs-demo-overlay-after--in");
      docsOverlayAfter.style.clipPath = "";
      docsOverlayAfter.style.webkitClipPath = "";
      docsOverlayAfter.style.transition = "none";
      void docsOverlayAfter.offsetWidth;
      docsOverlayAfter.style.transition = "";
    }
    if (docsOverlayBtn) {
      docsOverlayBtn.classList.remove("docs-demo-overlay-btn--hover");
      docsOverlayBtn.classList.remove("docs-demo-overlay-btn--press");
    }
    if (docsBusy) docsBusy.classList.remove("docs-demo-busy--on");
    if (docsMarquee) {
      docsMarquee.classList.remove("docs-demo-marquee--on");
      docsMarquee.style.left = "";
      docsMarquee.style.top = "";
      docsMarquee.style.width = "";
      docsMarquee.style.height = "";
    }
    for (var la = 0; la < docsLateActs.length; la++) {
      docsLateActs[la].classList.remove("docs-demo-overlay-act--in");
    }
    if (docsActCopy) {
      docsActCopy.classList.remove("docs-demo-overlay-act--hover");
      docsActCopy.classList.remove("docs-demo-overlay-act--press");
    }
  };

  var docsPlayEditor = function(overlayAt, step){
    if (!step.box) {
      docsDemoAt(overlayAt + 280, function(){
        if (docsOverlayBtn) docsMoveTo(docsPointIn(docsOverlayBtn));
      });
      docsDemoAt(overlayAt + 1280, function(){
        if (docsOverlayBtn) docsOverlayBtn.classList.add("docs-demo-overlay-btn--hover");
      });
      docsDemoAt(overlayAt + 1680, function(){
        if (docsOverlayBtn) docsOverlayBtn.classList.add("docs-demo-overlay-btn--press");
        if (docsBusy) docsBusy.classList.add("docs-demo-busy--on");
      });
      docsDemoAt(overlayAt + 2680, docsEditorReveal);
      return overlayAt + 2680;
    }
    var box = step.box;
    docsDemoAt(overlayAt + 280, function(){ docsMoveTo(docsBoxPoint(box.l, box.t)); });
    docsDemoAt(overlayAt + 1280, function(){
      if (!docsMarquee) return;
      docsMarquee.style.left = (box.l * 100) + "%";
      docsMarquee.style.top = (box.t * 100) + "%";
      docsMarquee.style.width = "0%";
      docsMarquee.style.height = "0%";
      docsMarquee.classList.add("docs-demo-marquee--on");
      docsMoveTo(docsBoxPoint(box.r, box.b));
      docsDragTrack(box, 820);
    });
    docsDemoAt(overlayAt + 2180, function(){
      if (docsDemoRaf) { cancelAnimationFrame(docsDemoRaf); docsDemoRaf = 0; }
      docsSetAction(true);
      if (docsMarquee) {
        docsMarquee.style.width = ((box.r - box.l) * 100) + "%";
        docsMarquee.style.height = ((box.b - box.t) * 100) + "%";
      }
    });
    docsDemoAt(overlayAt + 2380, function(){
      if (docsOverlayBtn) docsMoveTo(docsPointIn(docsOverlayBtn));
    });
    docsDemoAt(overlayAt + 3380, function(){
      if (docsOverlayBtn) docsOverlayBtn.classList.add("docs-demo-overlay-btn--hover");
    });
    docsDemoAt(overlayAt + 3780, function(){
      if (docsOverlayBtn) docsOverlayBtn.classList.add("docs-demo-overlay-btn--press");
      if (docsBusy) docsBusy.classList.add("docs-demo-busy--on");
    });
    docsDemoAt(overlayAt + 4780, docsEditorReveal);
    return overlayAt + 4780;
  };

  var docsPlayStep = function(base, stepIndex, opts){
    var step = docsSteps[stepIndex];
    var tile = docsTiles[step.tile];
    if (!tile) return base;
    var overlayAt;
    var revealAt;
    var pasteSlot;

    docsDemoAt(base + 60, function(){
      if (!tile.offsetWidth) return;
      docsMoveTo(docsPointIn(tile));
      docsTrack(1000);
    });
    docsDemoAt(base + 1150, function(){
      if (docsDemoRaf) { cancelAnimationFrame(docsDemoRaf); docsDemoRaf = 0; }
      docsHotOnly(tile);
    });
    docsDemoAt(base + 1450, function(){
      if (docsCopyTip) docsCopyTip.classList.add("docs-demo-tip--in");
    });
    docsDemoAt(base + 1790, function(){
      if (docsCopyTip) docsCopyTip.classList.remove("docs-demo-tip--in");
    });
    overlayAt = base + 2090;
    docsDemoAt(overlayAt, function(){
      if (!opts.isFirst) {
        docsEditorResetOverlay();
        docsSetStep(step);
        docsSetAction(false);
      }
      if (docsOverlay) docsOverlay.classList.add("docs-demo-overlay--on");
    });

    revealAt = docsPlayEditor(overlayAt, step);

    docsDemoAt(revealAt + 1400, function(){
      for (var la = 0; la < docsLateActs.length; la++) {
        docsLateActs[la].classList.add("docs-demo-overlay-act--in");
      }
      if (docsActCopy) docsMoveTo(docsPointIn(docsActCopy));
    });
    docsDemoAt(revealAt + 2400, function(){
      if (docsActCopy) docsActCopy.classList.add("docs-demo-overlay-act--hover");
    });
    docsDemoAt(revealAt + 2800, function(){
      if (docsActCopy) docsActCopy.classList.add("docs-demo-overlay-act--press");
    });
    docsDemoAt(revealAt + 3000, function(){
      if (docsActCopy) {
        docsActCopy.classList.remove("docs-demo-overlay-act--press");
        docsActCopy.classList.remove("docs-demo-overlay-act--hover");
      }
      if (docsOverlay) docsOverlay.classList.remove("docs-demo-overlay--on");
      docsHotOnly(null);
      if (docsToast) docsToast.classList.add("docs-demo-toast--in");
      pasteSlot = docsPickSlot();
      docsMoveTo(docsPastePointIn(pasteSlot.ox, pasteSlot.oy));
    });
    docsDemoAt(revealAt + 3000 + docsToastMs, function(){
      if (docsToast) docsToast.classList.remove("docs-demo-toast--in");
    });
    docsDemoAt(revealAt + 4000, function(){
      if (docsPasteTip) docsPasteTip.classList.add("docs-demo-tip--in");
      if (!pasteSlot) pasteSlot = docsPickSlot();
      docsCreatePaste(stepIndex, pasteSlot.ox, pasteSlot.oy);
    });
    docsDemoAt(revealAt + 4340, function(){
      if (docsPasteTip) docsPasteTip.classList.remove("docs-demo-tip--in");
    });
    return revealAt + (opts.isLast ? 4340 : 4710);
  };

  var docsEditorPlay = function(){
    var picked = docsPickSteps();
    if (!picked.length) return;
    if (!docsTiles[docsSteps[picked[0]].tile] || !docsCanvasBody || !docsCanvasBody.offsetWidth || !docsOverlay) return;
    docsDemoClearTimers();
    docsDemoReset();
    if (docsPasteCount + picked.length > docsPasteMax) docsClearPastes();

    if (docsDemoReduce && docsDemoReduce.matches) {
      var rtile = docsTiles[docsSteps[picked[0]].tile];
      if (rtile) rtile.classList.add("docs-demo-tile--hot");
      docsCursor.classList.add("docs-demo-cursor--on");
      var rslot = docsPickSlot();
      docsCreatePaste(picked[picked.length - 1], rslot.ox, rslot.oy);
      docsMoveTo(docsPastePointIn(rslot.ox, rslot.oy));
      return;
    }

    docsSetStep(docsSteps[picked[0]]);
    var canvasCentre = docsCentreIn(docsCanvas);
    docsCursor.classList.add("docs-demo-cursor--on");
    docsCursor.style.transition = "none";
    docsMoveTo(canvasCentre);
    void docsCursor.offsetWidth;
    docsCursor.style.transition = "";

    var offset = 0;
    var si;
    for (si = 0; si < picked.length; si++) {
      offset = docsPlayStep(offset, picked[si], {
        isFirst: si === 0,
        isLast: si === picked.length - 1
      });
    }
  };

  var docsDemoOnScreen = false;

  var docsPlayCurrent = function(){
    var sw = document.querySelector("#first-copy .docs-mode-switch");
    if (sw && sw.getAttribute("data-mode") === "editor") docsEditorPlay();
    else docsDemoPlay();
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function(entries){
      for (var i = 0; i < entries.length; i++){
        if (entries[i].isIntersecting) {
          docsDemoOnScreen = true;
          docsPlayCurrent();
        } else {
          docsDemoOnScreen = false;
          docsDemoClearTimers();
          docsDemoReset();
        }
      }
    }, { threshold: 0.6 }).observe(firstCopyDemo);
  }

  var firstCopySection = document.getElementById("first-copy");
  var modeSwitch = document.querySelector("#first-copy .docs-mode-switch");
  var docsSyncModePanels = function(mode){
    if (firstCopySection) firstCopySection.setAttribute("data-mode", mode);
    if (!firstCopySection) return;
    var panels = firstCopySection.querySelectorAll("[data-mode-panel]");
    for (var pi = 0; pi < panels.length; pi++) {
      var show = panels[pi].getAttribute("data-mode-panel") === mode;
      if (show) panels[pi].removeAttribute("hidden");
      else panels[pi].setAttribute("hidden", "");
    }
  };
  if (modeSwitch) {
    var modeTabs = modeSwitch.querySelectorAll('[role="tab"]');
    docsSyncModePanels(modeSwitch.getAttribute("data-mode") || "editor");
    modeSwitch.addEventListener("click", function(e){
      var btn = e.target.closest('[role="tab"]');
      if (!btn || !modeSwitch.contains(btn)) return;
      var isEditor = modeTabs[1] === btn;
      var mode = isEditor ? "editor" : "instant";
      docsDemoClearTimers();
      docsDemoReset();
      modeSwitch.setAttribute("data-mode", mode);
      docsSyncModePanels(mode);
      for (var mi = 0; mi < modeTabs.length; mi++) {
        modeTabs[mi].setAttribute("aria-selected", modeTabs[mi] === btn ? "true" : "false");
      }
      if (docsDemoOnScreen) docsPlayCurrent();
    });
  }
})();
