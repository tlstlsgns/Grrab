(function(){
  "use strict";

  var rowA = document.getElementById("rowA");
  if (!rowA) return;

  var rowACursor = rowA.querySelector(".rowA-cursor");
  var rowACopyTip = rowA.querySelector(".rowA-tip--copy");
  var rowAPasteTip = rowA.querySelector(".rowA-tip--paste");
  var rowAToast = rowA.querySelector(".rowA-toast");
  var rowAPastes = rowA.querySelectorAll(".rowA-paste");
  var rowACanvas = rowA.querySelector(".rowA-canvas");
  var rowACanvasPan = rowA.querySelector(".rowA-canvas-pan");
  var rowAGallery = rowA.querySelector(".rowA-gallery");
  var rowATiles = rowAGallery ? rowAGallery.querySelectorAll(".rowA-tile") : [];

  var rowARepLen = 3200;
  var rowAToastMs = 1200;
  var rowAPasteMin = 0.06;
  var rowAPasteRetries = 24;
  var rowAPlaced = [];
  var rowATimers = [];
  var rowARaf = 0;
  var rowAReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  var rowAClearTimers = function(){
    for (var i = 0; i < rowATimers.length; i++) clearTimeout(rowATimers[i]);
    rowATimers = [];
  };
  var rowAAt = function(ms, fn){ rowATimers.push(setTimeout(fn, ms)); };

  var rowAOffsetIn = function(el){
    var x = 0, y = 0, n = el;
    while (n && n !== rowA) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y };
  };
  var rowACentreIn = function(el){
    var p = rowAOffsetIn(el);
    return { x: p.x + el.offsetWidth / 2, y: p.y + el.offsetHeight / 2 };
  };
  var rowAPointIn = function(el){
    var o = rowAOffsetIn(el);
    return { x: o.x + el.offsetWidth / 2, y: o.y + el.offsetHeight / 2 };
  };
  var rowAMoveTo = function(p){
    if (rowACursor) rowACursor.style.transform = "translate(" + p.x + "px," + p.y + "px)";
  };

  var rowAHotOnly = function(tile){
    for (var i = 0; i < rowATiles.length; i++){
      if (rowATiles[i] === tile) rowATiles[i].classList.add("rowA-tile--hot");
      else rowATiles[i].classList.remove("rowA-tile--hot");
    }
  };

  var rowATrack = function(durationMs){
    var started = Date.now();
    var tick = function(){
      if (!rowACursor) return;
      var r = rowACursor.getBoundingClientRect();
      var under = document.elementFromPoint(r.left, r.top);
      rowAHotOnly(under && under.closest ? under.closest(".rowA-tile") : null);
      if (Date.now() - started < durationMs) rowARaf = requestAnimationFrame(tick);
      else rowARaf = 0;
    };
    rowARaf = requestAnimationFrame(tick);
  };

  var rowAPastePointIn = function(ox, oy){
    if (!rowACanvas) return { x: 0, y: 0 };
    if (ox == null) ox = 0;
    if (oy == null) oy = 0;
    var p = rowACentreIn(rowACanvas);
    return { x: p.x + rowACanvas.offsetWidth * ox,
             y: p.y + rowACanvas.offsetHeight * oy };
  };

  var rowAPasteAt = function(el, ox, oy){
    if (!el || !rowACanvas || !rowACanvasPan) return;
    if (ox == null) ox = 0;
    if (oy == null) oy = 0;
    var p = rowAPastePointIn(ox, oy);
    var o = rowAOffsetIn(rowACanvasPan);
    el.classList.add("rowA-paste--in");
    void el.offsetWidth;
    el.style.left = (p.x - o.x - el.offsetWidth / 2) + "px";
    el.style.top = (p.y - o.y - el.offsetHeight / 2) + "px";
  };

  var rowATileImgSrc = function(tile){
    var img = tile ? tile.querySelector("img") : null;
    return img ? img.getAttribute("src") : "";
  };

  var rowAPickTiles = function(){
    var order = [rowATiles[0]];
    var pool = [];
    for (var ti = 1; ti < rowATiles.length; ti++) pool.push(rowATiles[ti]);
    for (var sj = pool.length - 1; sj > 0; sj--) {
      var sk = Math.floor(Math.random() * (sj + 1));
      var st = pool[sj]; pool[sj] = pool[sk]; pool[sk] = st;
    }
    for (var pi = 0; pi < 4 && pi < pool.length; pi++) order.push(pool[pi]);
    return order;
  };

  var rowAPickSlot = function(){
    var ox = 0, oy = 0, attempt, ok, pi;
    for (attempt = 0; attempt < rowAPasteRetries; attempt++) {
      ox = Math.random() * 0.2 - 0.10;
      oy = Math.random() * 0.2 - 0.10;
      ok = true;
      if (rowACanvas && rowACanvas.offsetWidth) {
        for (pi = 0; pi < rowAPlaced.length; pi++) {
          var dx = (ox - rowAPlaced[pi].ox) * rowACanvas.offsetWidth;
          var dy = (oy - rowAPlaced[pi].oy) * rowACanvas.offsetHeight;
          if (Math.sqrt(dx * dx + dy * dy) < rowACanvas.offsetWidth * rowAPasteMin) {
            ok = false;
            break;
          }
        }
      }
      if (ok) break;
    }
    var slot = { ox: ox, oy: oy };
    rowAPlaced.push(slot);
    return slot;
  };

  var rowAReset = function(){
    if (rowARaf) { cancelAnimationFrame(rowARaf); rowARaf = 0; }
    rowAHotOnly(null);
    if (rowACursor) {
      rowACursor.classList.remove("rowA-cursor--on");
      rowACursor.style.transition = "none";
      rowACursor.style.transform = "";
      void rowACursor.offsetWidth;
      rowACursor.style.transition = "";
    }
    if (rowACopyTip) rowACopyTip.classList.remove("rowA-tip--in");
    if (rowAPasteTip) rowAPasteTip.classList.remove("rowA-tip--in");
    if (rowAToast) rowAToast.classList.remove("rowA-toast--in");
    rowAPlaced = [];
    for (var pri = 0; pri < rowAPastes.length; pri++) {
      rowAPastes[pri].classList.remove("rowA-paste--in");
      rowAPastes[pri].style.left = "";
      rowAPastes[pri].style.top = "";
      rowAPastes[pri].setAttribute("src", "");
    }
  };

  var rowAPlay = function(){
    if (!rowACursor || !rowACanvas || !rowACanvas.offsetWidth || !rowATiles.length) return;
    rowAClearTimers();
    rowAReset();

    var tileOrder = rowAPickTiles();
    var slots = [];
    for (var si = 0; si < 5; si++) slots.push(rowAPickSlot());

    if (rowAReduce && rowAReduce.matches) {
      for (var ri = 0; ri < 5; ri++) {
        var rtile = tileOrder[ri];
        var rel = rowAPastes[ri];
        if (rtile && rel) {
          rel.setAttribute("src", rowATileImgSrc(rtile));
          rowAPasteAt(rel, slots[ri].ox, slots[ri].oy);
        }
      }
      if (tileOrder[0]) tileOrder[0].classList.add("rowA-tile--hot");
      rowACursor.classList.add("rowA-cursor--on");
      var lastSlot = slots[4] || slots[0];
      rowAMoveTo(rowAPastePointIn(lastSlot.ox, lastSlot.oy));
      return;
    }

    var canvasCentre = rowACentreIn(rowACanvas);
    rowACursor.classList.add("rowA-cursor--on");
    rowACursor.style.transition = "none";
    rowAMoveTo(canvasCentre);
    void rowACursor.offsetWidth;
    rowACursor.style.transition = "";

    for (var rep = 0; rep < 5; rep++) {
      (function(beat, tile, pasteEl, slot){
        var t0 = beat * rowARepLen;

        rowAAt(t0 + 60, function(){
          if (!tile || !tile.offsetWidth) return;
          rowAMoveTo(rowAPointIn(tile));
          rowATrack(1000);
        });
        rowAAt(t0 + 1150, function(){
          if (rowARaf) { cancelAnimationFrame(rowARaf); rowARaf = 0; }
          rowAHotOnly(tile);
        });
        rowAAt(t0 + 1450, function(){
          if (rowACopyTip) rowACopyTip.classList.add("rowA-tip--in");
          if (rowAToast) rowAToast.classList.add("rowA-toast--in");
        });
        rowAAt(t0 + 1450 + rowAToastMs, function(){
          if (rowAToast) rowAToast.classList.remove("rowA-toast--in");
        });
        rowAAt(t0 + 1790, function(){
          if (rowACopyTip) rowACopyTip.classList.remove("rowA-tip--in");
          rowAMoveTo(rowAPastePointIn(slot.ox, slot.oy));
          rowATrack(1000);
        });
        rowAAt(t0 + 2790, function(){
          if (rowAPasteTip) rowAPasteTip.classList.add("rowA-tip--in");
          if (pasteEl) {
            pasteEl.setAttribute("src", rowATileImgSrc(tile));
            rowAPasteAt(pasteEl, slot.ox, slot.oy);
          }
        });
        rowAAt(t0 + 3130, function(){
          if (rowAPasteTip) rowAPasteTip.classList.remove("rowA-tip--in");
        });
      })(rep, tileOrder[rep], rowAPastes[rep], slots[rep]);
    }
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function(entries){
      for (var i = 0; i < entries.length; i++){
        if (entries[i].isIntersecting) rowAPlay();
        else { rowAClearTimers(); rowAReset(); }
      }
    }, { threshold: 0.6 }).observe(rowA);
  }
})();
