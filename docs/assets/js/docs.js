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
  var docsPaste = firstCopyDemo.querySelector(".docs-demo-paste--editor");
  var docsPaste2 = firstCopyDemo.querySelector(".docs-demo-paste--editor-2");
  var docsInstantPastes = firstCopyDemo.querySelectorAll(".docs-demo-paste--instant");
  var docsCanvas = firstCopyDemo.querySelector(".docs-demo-canvas");
  var docsCanvasPan = firstCopyDemo.querySelector(".docs-demo-canvas-pan");
  var docsGallery = firstCopyDemo.querySelector(".docs-demo-gallery");
  var docsTiles = docsGallery ? docsGallery.querySelectorAll(".docs-demo-tile") : [];
  var docsOverlay = firstCopyDemo.querySelector(".docs-demo-overlay");
  var docsOverlayImg = firstCopyDemo.querySelector(".docs-demo-overlay-img");
  var docsOverlayBtn = firstCopyDemo.querySelector(".docs-demo-overlay-btn");
  var docsOverlayAfter = firstCopyDemo.querySelector(".docs-demo-overlay-after");
  var docsMarquee = firstCopyDemo.querySelector(".docs-demo-marquee");
  var docsHint = firstCopyDemo.querySelector(".docs-demo-hint");
  var docsBusy = firstCopyDemo.querySelector(".docs-demo-busy");
  var docsSlider = firstCopyDemo.querySelector(".docs-demo-slider");
  var docsSliderHandle = firstCopyDemo.querySelector(".docs-demo-slider-handle");
  var docsLateActs = firstCopyDemo.querySelectorAll(".docs-demo-overlay-act--late");
  var docsActCopy = firstCopyDemo.querySelector(".docs-demo-overlay-bar-right .docs-demo-overlay-act:last-child");
  var docsPasteBefore = "/assets/landing/img/rowB/rowB-image-1-before.webp";
  var docsPasteAfter = "/assets/landing/img/rowB/rowB-image-1-after.webp";
  var docsEditorStep1 = { img: docsPasteBefore, alpha: true };
  var docsEditorStep2 = { img: "/assets/landing/img/rowB/rowB-image-7-before.webp", alpha: false };
  var docsPasteOx1 = -0.10;
  var docsPasteOy1 = -0.10;
  var docsPasteOx2 = 0.10;
  var docsPasteOy2 = 0.10;
  var docsEraseBox = { l: 0.39, t: 0.38, r: 0.59, b: 0.65 };
  var docsEraseBeatStart = 9480;
  var docsInstantRepLen = 3200;
  var docsToastMs = 1200;
  var docsInstantPasteMin = 0.06;
  var docsInstantPasteRetries = 24;
  var docsInstantPlaced = [];
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
    if (!docsCanvas) return { x: 0, y: 0 };
    if (ox == null) ox = 0;
    if (oy == null) oy = 0;
    var p = docsCentreIn(docsCanvas);
    return { x: p.x + docsCanvas.offsetWidth * ox,
             y: p.y + docsCanvas.offsetHeight * oy };
  };

  var docsPasteAt = function(el, ox, oy){
    if (!el || !docsCanvas || !docsCanvasPan) return;
    if (ox == null) ox = 0;
    if (oy == null) oy = 0;
    var p = docsPastePointIn(ox, oy);
    var o = docsOffsetIn(docsCanvasPan);
    el.classList.add("docs-demo-paste--in");
    void el.offsetWidth;
    el.style.left = (p.x - o.x - el.offsetWidth / 2) + "px";
    el.style.top = (p.y - o.y - el.offsetHeight / 2) + "px";
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

  var docsPickPasteSlot = function(){
    var ox = 0, oy = 0, attempt, ok, pi;
    for (attempt = 0; attempt < docsInstantPasteRetries; attempt++) {
      ox = Math.random() * 0.2 - 0.10;
      oy = Math.random() * 0.2 - 0.10;
      ok = true;
      if (docsCanvas && docsCanvas.offsetWidth) {
        for (pi = 0; pi < docsInstantPlaced.length; pi++) {
          var dx = (ox - docsInstantPlaced[pi].ox) * docsCanvas.offsetWidth;
          var dy = (oy - docsInstantPlaced[pi].oy) * docsCanvas.offsetHeight;
          if (Math.sqrt(dx * dx + dy * dy) < docsCanvas.offsetWidth * docsInstantPasteMin) {
            ok = false;
            break;
          }
        }
      }
      if (ok) break;
    }
    var slot = { ox: ox, oy: oy };
    docsInstantPlaced.push(slot);
    return slot;
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

  var docsSetStep = function(step){
    if (!step || !docsOverlayImg) return;
    docsOverlayImg.setAttribute("src", step.img);
    if (docsOverlayAfter) {
      docsOverlayAfter.setAttribute("src", step.img.replace("-before.webp", "-after.webp"));
      if (step.alpha) docsOverlayAfter.classList.add("docs-demo-overlay-after--alpha");
      else docsOverlayAfter.classList.remove("docs-demo-overlay-after--alpha");
    }
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
    docsInstantPlaced = [];
    var docsAllPastes = firstCopyDemo.querySelectorAll(".docs-demo-canvas-pan .docs-demo-paste");
    for (var pri = 0; pri < docsAllPastes.length; pri++) {
      docsAllPastes[pri].classList.remove("docs-demo-paste--in");
      docsAllPastes[pri].style.left = "";
      docsAllPastes[pri].style.top = "";
    }
    for (var ii = 0; ii < docsInstantPastes.length; ii++) {
      docsInstantPastes[ii].setAttribute("src", "");
    }
    if (docsPaste) docsPaste.setAttribute("src", docsPasteAfter);
    if (docsMarquee) {
      docsMarquee.classList.remove("docs-demo-marquee--on");
      docsMarquee.style.left = "";
      docsMarquee.style.top = "";
      docsMarquee.style.width = "";
      docsMarquee.style.height = "";
    }
    docsSetAction(false);
    docsSetStep(docsEditorStep1);
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

    var tileOrder = docsPickInstantTiles();
    var slots = [];
    for (var si = 0; si < 5; si++) slots.push(docsPickPasteSlot());

    if (docsDemoReduce && docsDemoReduce.matches) {
      for (var ri = 0; ri < 5; ri++) {
        var rtile = tileOrder[ri];
        var rel = docsInstantPastes[ri];
        if (rtile && rel) {
          rel.setAttribute("src", docsTileImgSrc(rtile));
          docsPasteAt(rel, slots[ri].ox, slots[ri].oy);
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
            docsPasteAt(pasteEl, slot.ox, slot.oy);
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

  var docsEditorPlayErase = function(){
    var tile = docsTiles[4];
    if (!tile) return;
    var t0 = docsEraseBeatStart;
    var box = docsEraseBox;

    docsDemoAt(t0 + 60, function(){
      if (!tile.offsetWidth) return;
      docsMoveTo(docsPointIn(tile));
      docsTrack(1000);
    });
    docsDemoAt(t0 + 1150, function(){
      if (docsDemoRaf) { cancelAnimationFrame(docsDemoRaf); docsDemoRaf = 0; }
      docsHotOnly(tile);
    });
    docsDemoAt(t0 + 1450, function(){
      if (docsCopyTip) docsCopyTip.classList.add("docs-demo-tip--in");
    });
    docsDemoAt(t0 + 1790, function(){
      if (docsCopyTip) docsCopyTip.classList.remove("docs-demo-tip--in");
    });
    docsDemoAt(t0 + 2090, function(){
      docsEditorResetOverlay();
      docsSetStep(docsEditorStep2);
      docsSetAction(false);
      if (docsOverlay) docsOverlay.classList.add("docs-demo-overlay--on");
    });
    docsDemoAt(t0 + 2370, function(){
      docsMoveTo(docsBoxPoint(box.l, box.t));
    });
    docsDemoAt(t0 + 3370, function(){
      if (!docsMarquee) return;
      docsMarquee.style.left = (box.l * 100) + "%";
      docsMarquee.style.top = (box.t * 100) + "%";
      docsMarquee.style.width = "0%";
      docsMarquee.style.height = "0%";
      docsMarquee.classList.add("docs-demo-marquee--on");
      docsMoveTo(docsBoxPoint(box.r, box.b));
      docsDragTrack(box, 820);
    });
    docsDemoAt(t0 + 4270, function(){
      if (docsDemoRaf) { cancelAnimationFrame(docsDemoRaf); docsDemoRaf = 0; }
      docsSetAction(true);
      if (docsMarquee) {
        docsMarquee.style.width = ((box.r - box.l) * 100) + "%";
        docsMarquee.style.height = ((box.b - box.t) * 100) + "%";
      }
    });
    docsDemoAt(t0 + 4470, function(){
      if (!docsOverlayBtn) return;
      docsMoveTo(docsPointIn(docsOverlayBtn));
    });
    docsDemoAt(t0 + 5470, function(){
      if (docsOverlayBtn) docsOverlayBtn.classList.add("docs-demo-overlay-btn--hover");
    });
    docsDemoAt(t0 + 5870, function(){
      if (docsOverlayBtn) docsOverlayBtn.classList.add("docs-demo-overlay-btn--press");
      if (docsBusy) docsBusy.classList.add("docs-demo-busy--on");
    });
    docsDemoAt(t0 + 6870, docsEditorReveal);
    docsDemoAt(t0 + 8270, function(){
      for (var la = 0; la < docsLateActs.length; la++) {
        docsLateActs[la].classList.add("docs-demo-overlay-act--in");
      }
      if (docsActCopy) docsMoveTo(docsPointIn(docsActCopy));
    });
    docsDemoAt(t0 + 9270, function(){
      if (docsActCopy) docsActCopy.classList.add("docs-demo-overlay-act--hover");
    });
    docsDemoAt(t0 + 9670, function(){
      if (docsActCopy) docsActCopy.classList.add("docs-demo-overlay-act--press");
    });
    docsDemoAt(t0 + 9870, function(){
      if (docsActCopy) {
        docsActCopy.classList.remove("docs-demo-overlay-act--press");
        docsActCopy.classList.remove("docs-demo-overlay-act--hover");
      }
      if (docsOverlay) docsOverlay.classList.remove("docs-demo-overlay--on");
      docsHotOnly(null);
      if (docsToast) docsToast.classList.add("docs-demo-toast--in");
      docsMoveTo(docsPastePointIn(docsPasteOx2, docsPasteOy2));
    });
    docsDemoAt(t0 + 9870 + docsToastMs, function(){
      if (docsToast) docsToast.classList.remove("docs-demo-toast--in");
    });
    docsDemoAt(t0 + 10870, function(){
      if (docsPasteTip) docsPasteTip.classList.add("docs-demo-tip--in");
      if (docsPaste2) docsPasteAt(docsPaste2, docsPasteOx2, docsPasteOy2);
    });
    docsDemoAt(t0 + 11210, function(){
      if (docsPasteTip) docsPasteTip.classList.remove("docs-demo-tip--in");
    });
  };

  var docsEditorPlay = function(){
    var tile = docsTiles[0];
    if (!tile || !docsCursor || !docsCanvas || !docsCanvas.offsetWidth || !docsOverlay) return;
    docsDemoClearTimers();
    docsDemoReset();

    if (docsDemoReduce && docsDemoReduce.matches) {
      tile.classList.add("docs-demo-tile--hot");
      docsCursor.classList.add("docs-demo-cursor--on");
      if (docsPaste) {
        docsPaste.setAttribute("src", docsPasteAfter);
        docsPasteAt(docsPaste, docsPasteOx1, docsPasteOy1);
      }
      if (docsPaste2) docsPasteAt(docsPaste2, docsPasteOx2, docsPasteOy2);
      docsMoveTo(docsPastePointIn(docsPasteOx2, docsPasteOy2));
      return;
    }

    var canvasCentre = docsCentreIn(docsCanvas);
    docsCursor.classList.add("docs-demo-cursor--on");
    docsCursor.style.transition = "none";
    docsMoveTo(canvasCentre);
    void docsCursor.offsetWidth;
    docsCursor.style.transition = "";

    docsDemoAt(60, function(){
      if (!tile.offsetWidth) return;
      docsMoveTo(docsPointIn(tile));
      docsTrack(1000);
    });
    docsDemoAt(1150, function(){
      if (docsDemoRaf) { cancelAnimationFrame(docsDemoRaf); docsDemoRaf = 0; }
      docsHotOnly(tile);
    });
    docsDemoAt(1450, function(){
      if (docsCopyTip) docsCopyTip.classList.add("docs-demo-tip--in");
    });
    docsDemoAt(1790, function(){
      if (docsCopyTip) docsCopyTip.classList.remove("docs-demo-tip--in");
    });
    docsDemoAt(2090, function(){
      if (docsOverlay) docsOverlay.classList.add("docs-demo-overlay--on");
    });
    docsDemoAt(2370, function(){
      if (!docsOverlayBtn) return;
      docsMoveTo(docsPointIn(docsOverlayBtn));
    });
    docsDemoAt(3370, function(){
      if (docsOverlayBtn) docsOverlayBtn.classList.add("docs-demo-overlay-btn--hover");
    });
    docsDemoAt(3770, function(){
      if (docsOverlayBtn) docsOverlayBtn.classList.add("docs-demo-overlay-btn--press");
      if (docsBusy) docsBusy.classList.add("docs-demo-busy--on");
    });
    docsDemoAt(4770, docsEditorReveal);
    docsDemoAt(6170, function(){
      for (var la = 0; la < docsLateActs.length; la++) {
        docsLateActs[la].classList.add("docs-demo-overlay-act--in");
      }
      if (docsActCopy) docsMoveTo(docsPointIn(docsActCopy));
    });
    docsDemoAt(7170, function(){
      if (docsActCopy) docsActCopy.classList.add("docs-demo-overlay-act--hover");
    });
    docsDemoAt(7570, function(){
      if (docsActCopy) docsActCopy.classList.add("docs-demo-overlay-act--press");
    });
    docsDemoAt(7770, function(){
      if (docsActCopy) {
        docsActCopy.classList.remove("docs-demo-overlay-act--press");
        docsActCopy.classList.remove("docs-demo-overlay-act--hover");
      }
      if (docsOverlay) docsOverlay.classList.remove("docs-demo-overlay--on");
      docsHotOnly(null);
      if (docsToast) docsToast.classList.add("docs-demo-toast--in");
      docsMoveTo(docsPastePointIn(docsPasteOx1, docsPasteOy1));
    });
    docsDemoAt(7770 + docsToastMs, function(){
      if (docsToast) docsToast.classList.remove("docs-demo-toast--in");
    });
    docsDemoAt(8770, function(){
      if (docsPasteTip) docsPasteTip.classList.add("docs-demo-tip--in");
      if (docsPaste) docsPaste.setAttribute("src", docsPasteAfter);
      docsPasteAt(docsPaste, docsPasteOx1, docsPasteOy1);
    });
    docsDemoAt(9110, function(){
      if (docsPasteTip) docsPasteTip.classList.remove("docs-demo-tip--in");
    });
    docsEditorPlayErase();
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

  var modeSwitch = document.querySelector("#first-copy .docs-mode-switch");
  if (modeSwitch) {
    var modeTabs = modeSwitch.querySelectorAll('[role="tab"]');
    modeSwitch.addEventListener("click", function(e){
      var btn = e.target.closest('[role="tab"]');
      if (!btn || !modeSwitch.contains(btn)) return;
      var isEditor = modeTabs[1] === btn;
      docsDemoClearTimers();
      docsDemoReset();
      modeSwitch.setAttribute("data-mode", isEditor ? "editor" : "instant");
      for (var mi = 0; mi < modeTabs.length; mi++) {
        modeTabs[mi].setAttribute("aria-selected", modeTabs[mi] === btn ? "true" : "false");
      }
      if (docsDemoOnScreen) docsPlayCurrent();
    });
  }
})();
