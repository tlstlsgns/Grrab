(function(){
  "use strict";

  var copyDemo = document.getElementById("copyDemo");
  if (!copyDemo) return;

  var cdCursor = copyDemo.querySelector(".copyDemo-cursor");
  var cdCopyTip = copyDemo.querySelector(".copyDemo-tip--copy");
  var cdPasteTip = copyDemo.querySelector(".copyDemo-tip--paste");
  var cdToast = copyDemo.querySelector(".copyDemo-toast");
  var cdPastes = copyDemo.querySelectorAll(".copyDemo-paste");
  var cdCanvas = copyDemo.querySelector(".copyDemo-canvas");
  var cdCanvasPan = copyDemo.querySelector(".copyDemo-canvas-pan");
  var cdGallery = copyDemo.querySelector(".copyDemo-gallery");
  var cdTiles = cdGallery ? cdGallery.querySelectorAll(".copyDemo-tile") : [];

  var cdRepLen = 3200;
  var cdToastMs = 1200;
  var cdPasteMin = 0.06;
  var cdPasteRetries = 24;
  var cdPlaced = [];
  var cdTimers = [];
  var cdRaf = 0;
  var cdReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  var cdClearTimers = function(){
    for (var i = 0; i < cdTimers.length; i++) clearTimeout(cdTimers[i]);
    cdTimers = [];
  };
  var cdAt = function(ms, fn){ cdTimers.push(setTimeout(fn, ms)); };

  var cdOffsetIn = function(el){
    var x = 0, y = 0, n = el;
    while (n && n !== copyDemo) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y };
  };
  var cdCentreIn = function(el){
    var p = cdOffsetIn(el);
    return { x: p.x + el.offsetWidth / 2, y: p.y + el.offsetHeight / 2 };
  };
  var cdPointIn = function(el){
    var o = cdOffsetIn(el);
    return { x: o.x + el.offsetWidth / 2, y: o.y + el.offsetHeight / 2 };
  };
  var cdMoveTo = function(p){
    if (cdCursor) cdCursor.style.transform = "translate(" + p.x + "px," + p.y + "px)";
  };

  var cdHotOnly = function(tile){
    for (var i = 0; i < cdTiles.length; i++){
      if (cdTiles[i] === tile) cdTiles[i].classList.add("copyDemo-tile--hot");
      else cdTiles[i].classList.remove("copyDemo-tile--hot");
    }
  };

  var cdTrack = function(durationMs){
    var started = Date.now();
    var tick = function(){
      if (!cdCursor) return;
      var r = cdCursor.getBoundingClientRect();
      var under = document.elementFromPoint(r.left, r.top);
      cdHotOnly(under && under.closest ? under.closest(".copyDemo-tile") : null);
      if (Date.now() - started < durationMs) cdRaf = requestAnimationFrame(tick);
      else cdRaf = 0;
    };
    cdRaf = requestAnimationFrame(tick);
  };

  var cdPastePointIn = function(ox, oy){
    if (!cdCanvas) return { x: 0, y: 0 };
    if (ox == null) ox = 0;
    if (oy == null) oy = 0;
    var p = cdCentreIn(cdCanvas);
    return { x: p.x + cdCanvas.offsetWidth * ox,
             y: p.y + cdCanvas.offsetHeight * oy };
  };

  var cdPasteAt = function(el, ox, oy){
    if (!el || !cdCanvas || !cdCanvasPan) return;
    if (ox == null) ox = 0;
    if (oy == null) oy = 0;
    var p = cdPastePointIn(ox, oy);
    var o = cdOffsetIn(cdCanvasPan);
    el.classList.add("copyDemo-paste--in");
    void el.offsetWidth;
    el.style.left = (p.x - o.x - el.offsetWidth / 2) + "px";
    el.style.top = (p.y - o.y - el.offsetHeight / 2) + "px";
  };

  var cdTileImgSrc = function(tile){
    var img = tile ? tile.querySelector("img") : null;
    return img ? img.getAttribute("src") : "";
  };

  var cdPickTiles = function(){
    var order = [cdTiles[0]];
    var pool = [];
    for (var ti = 1; ti < cdTiles.length; ti++) pool.push(cdTiles[ti]);
    for (var sj = pool.length - 1; sj > 0; sj--) {
      var sk = Math.floor(Math.random() * (sj + 1));
      var st = pool[sj]; pool[sj] = pool[sk]; pool[sk] = st;
    }
    for (var pi = 0; pi < 4 && pi < pool.length; pi++) order.push(pool[pi]);
    return order;
  };

  var cdPickSlot = function(){
    var ox = 0, oy = 0, attempt, ok, pi;
    for (attempt = 0; attempt < cdPasteRetries; attempt++) {
      ox = Math.random() * 0.2 - 0.10;
      oy = Math.random() * 0.2 - 0.10;
      ok = true;
      if (cdCanvas && cdCanvas.offsetWidth) {
        for (pi = 0; pi < cdPlaced.length; pi++) {
          var dx = (ox - cdPlaced[pi].ox) * cdCanvas.offsetWidth;
          var dy = (oy - cdPlaced[pi].oy) * cdCanvas.offsetHeight;
          if (Math.sqrt(dx * dx + dy * dy) < cdCanvas.offsetWidth * cdPasteMin) {
            ok = false;
            break;
          }
        }
      }
      if (ok) break;
    }
    var slot = { ox: ox, oy: oy };
    cdPlaced.push(slot);
    return slot;
  };

  var cdReset = function(){
    if (cdRaf) { cancelAnimationFrame(cdRaf); cdRaf = 0; }
    cdHotOnly(null);
    if (cdCursor) {
      cdCursor.classList.remove("copyDemo-cursor--on");
      cdCursor.style.transition = "none";
      cdCursor.style.transform = "";
      void cdCursor.offsetWidth;
      cdCursor.style.transition = "";
    }
    if (cdCopyTip) cdCopyTip.classList.remove("copyDemo-tip--in");
    if (cdPasteTip) cdPasteTip.classList.remove("copyDemo-tip--in");
    if (cdToast) cdToast.classList.remove("copyDemo-toast--in");
    cdPlaced = [];
    for (var pri = 0; pri < cdPastes.length; pri++) {
      cdPastes[pri].classList.remove("copyDemo-paste--in");
      cdPastes[pri].style.left = "";
      cdPastes[pri].style.top = "";
      cdPastes[pri].setAttribute("src", "");
    }
  };

  var cdPlay = function(){
    if (!cdCursor || !cdCanvas || !cdCanvas.offsetWidth || !cdTiles.length) return;
    cdClearTimers();
    cdReset();

    var tileOrder = cdPickTiles();
    var slots = [];
    for (var si = 0; si < 5; si++) slots.push(cdPickSlot());

    if (cdReduce && cdReduce.matches) {
      for (var ri = 0; ri < 5; ri++) {
        var rtile = tileOrder[ri];
        var rel = cdPastes[ri];
        if (rtile && rel) {
          rel.setAttribute("src", cdTileImgSrc(rtile));
          cdPasteAt(rel, slots[ri].ox, slots[ri].oy);
        }
      }
      if (tileOrder[0]) tileOrder[0].classList.add("copyDemo-tile--hot");
      cdCursor.classList.add("copyDemo-cursor--on");
      var lastSlot = slots[4] || slots[0];
      cdMoveTo(cdPastePointIn(lastSlot.ox, lastSlot.oy));
      return;
    }

    var canvasCentre = cdCentreIn(cdCanvas);
    cdCursor.classList.add("copyDemo-cursor--on");
    cdCursor.style.transition = "none";
    cdMoveTo(canvasCentre);
    void cdCursor.offsetWidth;
    cdCursor.style.transition = "";

    for (var rep = 0; rep < 5; rep++) {
      (function(beat, tile, pasteEl, slot){
        var t0 = beat * cdRepLen;

        cdAt(t0 + 60, function(){
          if (!tile || !tile.offsetWidth) return;
          cdMoveTo(cdPointIn(tile));
          cdTrack(1000);
        });
        cdAt(t0 + 1150, function(){
          if (cdRaf) { cancelAnimationFrame(cdRaf); cdRaf = 0; }
          cdHotOnly(tile);
        });
        cdAt(t0 + 1450, function(){
          if (cdCopyTip) cdCopyTip.classList.add("copyDemo-tip--in");
          if (cdToast) cdToast.classList.add("copyDemo-toast--in");
        });
        cdAt(t0 + 1450 + cdToastMs, function(){
          if (cdToast) cdToast.classList.remove("copyDemo-toast--in");
        });
        cdAt(t0 + 1790, function(){
          if (cdCopyTip) cdCopyTip.classList.remove("copyDemo-tip--in");
          cdMoveTo(cdPastePointIn(slot.ox, slot.oy));
          cdTrack(1000);
        });
        cdAt(t0 + 2790, function(){
          if (cdPasteTip) cdPasteTip.classList.add("copyDemo-tip--in");
          if (pasteEl) {
            pasteEl.setAttribute("src", cdTileImgSrc(tile));
            cdPasteAt(pasteEl, slot.ox, slot.oy);
          }
        });
        cdAt(t0 + 3130, function(){
          if (cdPasteTip) cdPasteTip.classList.remove("copyDemo-tip--in");
        });
      })(rep, tileOrder[rep], cdPastes[rep], slots[rep]);
    }
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function(entries){
      for (var i = 0; i < entries.length; i++){
        if (entries[i].isIntersecting) cdPlay();
        else { cdClearTimers(); cdReset(); }
      }
    }, { threshold: 0.6 }).observe(copyDemo);
  }
})();
