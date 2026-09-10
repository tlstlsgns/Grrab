(function(){
  "use strict";

  var rowA = document.getElementById("rowA");
  if (!rowA) return;

  var rowACursor = rowA.querySelector(".rowA-cursor");
  var rowACopyTip = rowA.querySelector(".rowA-tip--copy");
  var rowAPasteTip = rowA.querySelector(".rowA-tip--paste");
  var rowAToast = null;
  var rowACanvas = rowA.querySelector(".rowA-canvas");
  var rowACanvasPan = rowA.querySelector(".rowA-canvas-pan");
  var rowATiles = [];

  var rowARepLen = 3200;
  var rowAToastMs = 1200;
  var rowAPasteMin = 0.10;
  var rowAPasteRetries = 24;
  var rowAPasteMax = 10;
  var rowAPasteCount = 0;
  var rowAPlaced = [];
  var rowAUsedAnchors = [];
  var rowAPasteAnchors = [
    { ox: -0.25, oy: -0.25 }, { ox: 0, oy: -0.25 }, { ox: 0.25, oy: -0.25 },
    { ox: -0.25, oy: 0 }, { ox: 0, oy: 0 }, { ox: 0.25, oy: 0 },
    { ox: -0.25, oy: 0.25 }, { ox: 0, oy: 0.25 }, { ox: 0.25, oy: 0.25 }
  ];
  var rowATimers = [];
  var rowARaf = 0;
  var rowAReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  var rowAMobile = window.matchMedia && window.matchMedia("(max-width:820px)");

  var rowAClearTimers = function(){
    for (var i = 0; i < rowATimers.length; i++) clearTimeout(rowATimers[i]);
    rowATimers = [];
  };
  var rowAAt = function(ms, fn){ rowATimers.push(setTimeout(fn, ms)); };
  var rowASetCanvasFront = function(on){
    if (!rowA) return;
    if (on) rowA.classList.add("canvas-front");
    else rowA.classList.remove("canvas-front");
  };
  var rowACheckCanvasCross = function(){
    if (!rowA || !rowACanvas || !rowACursor) return;
    if (!rowA.classList.contains("canvas-front")) return;
    var cr = rowACursor.getBoundingClientRect();
    var lr = rowACanvas.getBoundingClientRect();
    if (cr.left < lr.left) rowASetCanvasFront(false);
  };
  var rowATileBehindCanvas = function(tile){
    if (!tile || !rowACanvas) return false;
    var tr = tile.getBoundingClientRect();
    var lr = rowACanvas.getBoundingClientRect();
    return tr.right > lr.left;
  };

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
  var rowABrowserStartIn = function(){
    var body = rowA.querySelector(".hero-body");
    if (!body) return { x: 0, y: 0 };
    var b = rowAOffsetIn(body);
    return { x: b.x + body.offsetWidth * 0.86, y: b.y + body.offsetHeight * 0.92 };
  };
  var rowAMoveTo = function(p){
    if (rowACursor) rowACursor.style.transform = "translate(" + p.x + "px," + p.y + "px)";
  };

  var rowARefreshTiles = function(){
    var gallery = rowA.querySelector(".hero-gallery");
    rowATiles = gallery ? [].slice.call(gallery.querySelectorAll(".hero-tile")) : [];
    rowAToast = rowA.querySelector(".hero-toast");
    return rowATiles;
  };

  var rowAHotOnly = function(tile){
    for (var i = 0; i < rowATiles.length; i++){
      if (rowATiles[i] === tile) rowATiles[i].classList.add("hero-tile--hot");
      else rowATiles[i].classList.remove("hero-tile--hot");
    }
  };

  var rowATrack = function(durationMs){
    var started = Date.now();
    var tick = function(){
      if (!rowACursor) return;
      var r = rowACursor.getBoundingClientRect();
      var under = document.elementFromPoint(r.left, r.top);
      rowAHotOnly(under && under.closest ? under.closest(".hero-tile") : null);
      rowACheckCanvasCross();
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

  var rowAClampPaste = function(el){
    if (!el || !rowACanvas || !rowACanvasPan) return;
    var panO = rowAOffsetIn(rowACanvasPan);
    var canvasO = rowAOffsetIn(rowACanvas);
    var minLeft = canvasO.x - panO.x;
    var minTop = canvasO.y - panO.y;
    var W = rowACanvas.offsetWidth;
    var H = rowACanvas.offsetHeight;
    var w = el.offsetWidth;
    var h = el.offsetHeight;
    var left = parseFloat(el.style.left) || 0;
    var top = parseFloat(el.style.top) || 0;
    var leftPad = (rowAMobile && rowAMobile.matches) ? W * 0.07 : 0;
    if (w <= W - leftPad) left = Math.max(minLeft + leftPad, Math.min(left, minLeft + W - w));
    else left = minLeft + leftPad;
    if (h <= H) top = Math.max(minTop, Math.min(top, minTop + H - h));
    else top = minTop;
    el.style.left = left + "px";
    el.style.top = top + "px";
  };
  var rowAPastePosition = function(el, ox, oy){
    var p = rowAPastePointIn(ox, oy);
    var o = rowAOffsetIn(rowACanvasPan);
    el.style.left = (p.x - o.x - el.offsetWidth / 2) + "px";
    el.style.top = (p.y - o.y - el.offsetHeight / 2) + "px";
    rowAClampPaste(el);
  };
  var rowAPasteSize = function(el, rw, rh){
    if (!el || !rw || !rh) return false;
    el.style.aspectRatio = rw + "/" + rh;
    if (rw > rh) {
      el.style.width = "50%";
      el.style.height = "";
    } else {
      el.style.height = "50%";
      el.style.width = "";
    }
    return true;
  };
  var rowAPasteAt = function(el, ox, oy, rw, rh){
    if (!el || !rowACanvas || !rowACanvasPan) return;
    if (ox == null) ox = 0;
    if (oy == null) oy = 0;
    var place = function(){
      void el.offsetWidth;
      rowAPastePosition(el, ox, oy);
    };
    el.classList.add("rowA-paste--in");
    if (rowAPasteSize(el, rw, rh)) place();
    else {
      el.addEventListener("load", function(){
        rowAPasteSize(el, el.naturalWidth, el.naturalHeight);
        place();
      }, { once: true });
      place();
    }
  };

  var rowATileImgSrc = function(tile){
    var img = tile ? tile.querySelector("img") : null;
    return img ? img.getAttribute("src") : "";
  };
  var rowATileNatural = function(tile){
    var img = tile ? tile.querySelector("img") : null;
    if (!img || !img.naturalWidth) return null;
    return { w: img.naturalWidth, h: img.naturalHeight };
  };

  var rowAVisibleTiles = function(){
    var body = rowA.querySelector(".hero-body");
    if (!body || !rowATiles.length) return [];
    var br = body.getBoundingClientRect();
    var visible = [];
    for (var vi = 0; vi < rowATiles.length; vi++) {
      if (rowATileBehindCanvas(rowATiles[vi])) continue;
      var tr = rowATiles[vi].getBoundingClientRect();
      if (tr.top >= br.top && tr.left >= br.left &&
          tr.right <= br.right && tr.bottom <= br.bottom) {
        visible.push(rowATiles[vi]);
      }
    }
    return visible;
  };

  var rowAPickTiles = function(){
    var visible = rowAVisibleTiles();
    if (!visible.length) return [];
    var lead = rowATiles[0];
    var leadOk = false;
    for (var li = 0; li < visible.length; li++) {
      if (visible[li] === lead) { leadOk = true; break; }
    }
    if (!leadOk) lead = visible[0];
    var order = [lead];
    var pool = [];
    for (var ti = 0; ti < visible.length; ti++) {
      if (visible[ti] !== lead) pool.push(visible[ti]);
    }
    for (var sj = pool.length - 1; sj > 0; sj--) {
      var sk = Math.floor(Math.random() * (sj + 1));
      var st = pool[sj]; pool[sj] = pool[sk]; pool[sk] = st;
    }
    for (var pi = 0; pi < 4 && pi < pool.length; pi++) order.push(pool[pi]);
    while (order.length < 5) order.push(visible[order.length % visible.length]);
    return order;
  };

  var rowAAnchorTiers = [[4], [0, 2, 6, 8], [1, 3, 5, 7]];
  var rowAPickAnchor = function(){
    var ai, pi, ti, ki, pool = [], tierPool = [];
    for (ai = 0; ai < rowAPasteAnchors.length; ai++) {
      var taken = false;
      for (pi = 0; pi < rowAUsedAnchors.length; pi++) {
        if (rowAUsedAnchors[pi] === ai) { taken = true; break; }
      }
      if (!taken) pool.push(ai);
    }
    if (!pool.length) return Math.floor(Math.random() * rowAPasteAnchors.length);
    for (ti = 0; ti < rowAAnchorTiers.length; ti++) {
      tierPool = [];
      for (ki = 0; ki < rowAAnchorTiers[ti].length; ki++) {
        ai = rowAAnchorTiers[ti][ki];
        for (pi = 0; pi < pool.length; pi++) {
          if (pool[pi] === ai) { tierPool.push(ai); break; }
        }
      }
      if (tierPool.length) return tierPool[Math.floor(Math.random() * tierPool.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  };
  var rowAPickSlot = function(){
    var anchorIdx = rowAPickAnchor();
    var anchor = rowAPasteAnchors[anchorIdx];
    var ox = 0, oy = 0, attempt, ok, pi;
    for (attempt = 0; attempt < rowAPasteRetries; attempt++) {
      ox = anchor.ox + (Math.random() * 0.15 - 0.075);
      oy = anchor.oy + (Math.random() * 0.15 - 0.075);
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
    rowAUsedAnchors.push(anchorIdx);
    var slot = { ox: ox, oy: oy };
    rowAPlaced.push(slot);
    return slot;
  };

  var rowAClearPastes = function(){
    if (!rowACanvasPan) return;
    var nodes = rowACanvasPan.querySelectorAll(".rowA-paste");
    for (var ci = 0; ci < nodes.length; ci++) nodes[ci].remove();
    rowAPlaced = [];
    rowAUsedAnchors = [];
    rowAPasteCount = 0;
  };

  var rowACreatePaste = function(src, ox, oy, tile){
    if (!rowACanvasPan) return null;
    if (rowAPasteCount >= rowAPasteMax) rowAClearPastes();
    var el = document.createElement("img");
    el.className = "rowA-paste";
    el.setAttribute("src", src);
    el.setAttribute("alt", "");
    el.setAttribute("draggable", "false");
    rowACanvasPan.appendChild(el);
    var nat = rowATileNatural(tile);
    var rw = nat ? nat.w : 0;
    var rh = nat ? nat.h : 0;
    if (!rw && el.complete && el.naturalWidth) {
      rw = el.naturalWidth;
      rh = el.naturalHeight;
    }
    rowAPasteAt(el, ox, oy, rw, rh);
    rowAPasteCount++;
    return { ox: ox, oy: oy };
  };

  var rowAReset = function(){
    rowARefreshTiles();
    if (rowARaf) { cancelAnimationFrame(rowARaf); rowARaf = 0; }
    rowASetCanvasFront(false);
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
    if (rowAToast) rowAToast.classList.remove("hero-toast--in");
  };

  var rowAStop = function(){
    rowAClearTimers();
    rowAReset();
  };

  var rowAPlay = function(){
    if (window.grrabBrowser && window.grrabBrowser.stopHero) window.grrabBrowser.stopHero();
    rowARefreshTiles();
    if (!rowACursor || !rowACanvas || !rowACanvas.offsetWidth || !rowATiles.length) return;
    rowAClearTimers();
    if (rowAPasteCount + 5 > rowAPasteMax) rowAClearPastes();
    rowAReset();

    var tileOrder = rowAPickTiles();
    if (!tileOrder.length) return;

    if (rowAReduce && rowAReduce.matches) {
      var lastSlot = null;
      for (var ri = 0; ri < 5; ri++) {
        var rtile = tileOrder[ri];
        if (rtile) {
          var rslot = rowAPickSlot();
          lastSlot = rowACreatePaste(rowATileImgSrc(rtile), rslot.ox, rslot.oy, rtile);
        }
      }
      if (tileOrder[0]) tileOrder[0].classList.add("hero-tile--hot");
      rowACursor.classList.add("rowA-cursor--on");
      if (lastSlot) {
        rowASetCanvasFront(true);
        rowAMoveTo(rowAPastePointIn(lastSlot.ox, lastSlot.oy));
      }
      return;
    }

    var browserStart = rowABrowserStartIn();
    rowACursor.classList.add("rowA-cursor--on");
    rowACursor.style.transition = "none";
    rowAMoveTo(browserStart);
    void rowACursor.offsetWidth;
    rowACursor.style.transition = "";

    for (var rep = 0; rep < 5; rep++) {
      (function(beat, tile){
        var t0 = beat * rowARepLen;
        var slot = null;

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
          if (rowAToast) rowAToast.classList.add("hero-toast--in");
        });
        rowAAt(t0 + 1450 + rowAToastMs, function(){
          if (rowAToast) rowAToast.classList.remove("hero-toast--in");
        });
        rowAAt(t0 + 1790, function(){
          if (rowACopyTip) rowACopyTip.classList.remove("rowA-tip--in");
          slot = rowAPickSlot();
          rowASetCanvasFront(true);
          rowAMoveTo(rowAPastePointIn(slot.ox, slot.oy));
        });
        rowAAt(t0 + 2790, function(){
          if (rowAPasteTip) rowAPasteTip.classList.add("rowA-tip--in");
          if (tile && slot) rowACreatePaste(rowATileImgSrc(tile), slot.ox, slot.oy, tile);
        });
        rowAAt(t0 + 3130, function(){
          if (rowAPasteTip) rowAPasteTip.classList.remove("rowA-tip--in");
        });
      })(rep, tileOrder[rep]);
    }
  };

  if ("IntersectionObserver" in window) {
    var rowAHasEntered = false;
    new IntersectionObserver(function(entries){
      for (var i = 0; i < entries.length; i++){
        if (entries[i].isIntersecting) {
          rowAHasEntered = true;
          if (window.grrabBrowser && window.grrabBrowser.flying) return;
          if (window.grrabBrowser && window.grrabBrowser.at === "hero") {
            if (window.grrabBrowser.heroVisible) return;
            window.grrabBrowser.moveToRowA(rowAPlay);
          } else if (window.grrabBrowser && window.grrabBrowser.at === "rowB") {
            window.grrabBrowser.moveToRowA(rowAPlay);
          } else if (window.grrabBrowser && window.grrabBrowser.at === "rowA") {
            if (!window.grrabBrowser.heroVisible) rowAPlay();
          } else {
            rowAPlay();
          }
        } else {
          if (!rowAHasEntered) continue;
          rowAStop();
          if (window.grrabBrowser && window.grrabBrowser.flying) return;
          if (window.grrabBrowser && entries[i].boundingClientRect.top > 0) {
            window.grrabBrowser.moveToHero();
          } else if (window.grrabBrowser && window.grrabBrowser.rowBIntersecting &&
                     !(rowAMobile && rowAMobile.matches)) {
            window.grrabBrowser.moveToRowB(window.grrabBrowser.playRowB);
          }
        }
      }
    }, { threshold: 0.6 }).observe(rowA);
  }

  if (window.grrabBrowser) {
    window.grrabBrowser.stopRowA = rowAStop;
    window.grrabBrowser.playRowA = rowAPlay;
  }
})();
