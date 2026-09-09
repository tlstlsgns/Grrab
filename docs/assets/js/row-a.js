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
  var rowAPasteMin = 0.06;
  var rowAPasteRetries = 24;
  var rowAPasteMax = 10;
  var rowAPasteCount = 0;
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

  var rowAVisibleTiles = function(){
    var body = rowA.querySelector(".hero-body");
    if (!body || !rowATiles.length) return [];
    var br = body.getBoundingClientRect();
    var visible = [];
    for (var vi = 0; vi < rowATiles.length; vi++) {
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

  var rowAClearPastes = function(){
    if (!rowACanvasPan) return;
    var nodes = rowACanvasPan.querySelectorAll(".rowA-paste");
    for (var ci = 0; ci < nodes.length; ci++) nodes[ci].remove();
    rowAPlaced = [];
    rowAPasteCount = 0;
  };

  var rowACreatePaste = function(src, ox, oy){
    if (!rowACanvasPan) return null;
    if (rowAPasteCount >= rowAPasteMax) rowAClearPastes();
    var el = document.createElement("img");
    el.className = "rowA-paste";
    el.setAttribute("src", src);
    el.setAttribute("alt", "");
    el.setAttribute("draggable", "false");
    rowACanvasPan.appendChild(el);
    rowAPasteAt(el, ox, oy);
    rowAPasteCount++;
    return el;
  };

  var rowAReset = function(){
    rowARefreshTiles();
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
    var slots = [];
    for (var si = 0; si < 5; si++) slots.push(rowAPickSlot());

    if (rowAReduce && rowAReduce.matches) {
      for (var ri = 0; ri < 5; ri++) {
        var rtile = tileOrder[ri];
        if (rtile) {
          rowACreatePaste(rowATileImgSrc(rtile), slots[ri].ox, slots[ri].oy);
        }
      }
      if (tileOrder[0]) tileOrder[0].classList.add("hero-tile--hot");
      rowACursor.classList.add("rowA-cursor--on");
      var lastSlot = slots[4] || slots[0];
      rowAMoveTo(rowAPastePointIn(lastSlot.ox, lastSlot.oy));
      return;
    }

    var browserStart = rowABrowserStartIn();
    rowACursor.classList.add("rowA-cursor--on");
    rowACursor.style.transition = "none";
    rowAMoveTo(browserStart);
    void rowACursor.offsetWidth;
    rowACursor.style.transition = "";

    for (var rep = 0; rep < 5; rep++) {
      (function(beat, tile, slot){
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
          if (rowAToast) rowAToast.classList.add("hero-toast--in");
        });
        rowAAt(t0 + 1450 + rowAToastMs, function(){
          if (rowAToast) rowAToast.classList.remove("hero-toast--in");
        });
        rowAAt(t0 + 1790, function(){
          if (rowACopyTip) rowACopyTip.classList.remove("rowA-tip--in");
          rowAMoveTo(rowAPastePointIn(slot.ox, slot.oy));
          rowATrack(1000);
        });
        rowAAt(t0 + 2790, function(){
          if (rowAPasteTip) rowAPasteTip.classList.add("rowA-tip--in");
          if (tile) rowACreatePaste(rowATileImgSrc(tile), slot.ox, slot.oy);
        });
        rowAAt(t0 + 3130, function(){
          if (rowAPasteTip) rowAPasteTip.classList.remove("rowA-tip--in");
        });
      })(rep, tileOrder[rep], slots[rep]);
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
          } else if (window.grrabBrowser && window.grrabBrowser.rowBIntersecting) {
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
