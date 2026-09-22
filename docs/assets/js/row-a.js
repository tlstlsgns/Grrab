(function(){
  "use strict";

  var rowA = document.getElementById("rowA");
  if (!rowA) return;

  var rowACursor = rowA.querySelector(".rowA-cursor");
  var rowACopyTip = rowA.querySelector(".rowA-tip--copy");
  var rowAPasteTip = rowA.querySelector(".rowA-tip--paste");
  var rowAToast = null;
  var rowAToastEls = [];
  var rowAMobileToastStack = [];
  var rowAToastFadeMs = 300;
  var rowARepLenMobile = 1790;
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
  var rowACursorMoveMs = 1000;
  var rowAReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  var rowAMobile = window.matchMedia && window.matchMedia("(max-width:820px)");

  var rowABrowserChrome = function(){
    var mobile = rowAMobile && rowAMobile.matches;
    if (mobile) {
      return rowA.querySelector(".rowA-browser-copy .hero-chrome");
    }
    return rowA.querySelector(".hero-mockup-wrap:not(.rowA-browser-copy) .hero-chrome");
  };
  var rowABrowserBody = function(){
    var chrome = rowABrowserChrome();
    return chrome ? chrome.querySelector(".hero-body") : null;
  };

  var rowAClearTimers = function(){
    for (var i = 0; i < rowATimers.length; i++) clearTimeout(rowATimers[i]);
    rowATimers = [];
  };
  var rowAAt = function(ms, fn){ rowATimers.push(setTimeout(fn, ms)); };
  var rowAMobileToastDomSync = function(){
    var stack = rowA.querySelector(".rowA-toast-stack");
    if (!stack) return;
    var i, el;
    for (i = 0; i < rowAMobileToastStack.length; i++) {
      stack.appendChild(rowAMobileToastStack[i]);
    }
    for (i = 0; i < rowAToastEls.length; i++) {
      el = rowAToastEls[i];
      if (!el) continue;
      if (rowAMobileToastStack.indexOf(el) < 0) stack.appendChild(el);
    }
  };
  var rowAMobileToastHideEl = function(el){
    if (!el || !el.classList.contains("hero-toast--in")) return;
    el.classList.add("hero-toast--leaving");
    rowAAt(rowAToastFadeMs, function(){
      el.classList.remove("hero-toast--in", "hero-toast--leaving");
      var si = rowAMobileToastStack.indexOf(el);
      if (si >= 0) rowAMobileToastStack.splice(si, 1);
      rowAMobileToastDomSync();
    });
  };
  var rowAResetMobileToasts = function(){
    var i, el;
    rowAMobileToastStack = [];
    for (i = 0; i < rowAToastEls.length; i++) {
      el = rowAToastEls[i];
      if (!el) continue;
      el.classList.remove("hero-toast--in", "hero-toast--leaving");
    }
    rowAMobileToastDomSync();
  };
  var rowAMobileToastShow = function(){
    if (rowAToastEls.length < 2) return;
    var el = null;
    var i;
    for (i = 0; i < rowAToastEls.length; i++) {
      if (!rowAToastEls[i]) continue;
      if (!rowAToastEls[i].classList.contains("hero-toast--in") &&
          !rowAToastEls[i].classList.contains("hero-toast--leaving")) {
        el = rowAToastEls[i];
        break;
      }
    }
    if (!el) return;
    el.classList.add("hero-toast--in");
    rowAMobileToastStack.push(el);
    rowAMobileToastDomSync();
    rowAAt(rowAToastMs, function(){ rowAMobileToastHideEl(el); });
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
    var body = rowABrowserBody();
    if (!body) return { x: 0, y: 0 };
    var b = rowAOffsetIn(body);
    return { x: b.x + body.offsetWidth * 0.86, y: b.y + body.offsetHeight * 0.92 };
  };
  var rowAMoveTo = function(p){
    if (rowACursor) rowACursor.style.transform = "translate(" + p.x + "px," + p.y + "px)";
  };

  var rowARefreshTiles = function(){
    var mobile = rowAMobile && rowAMobile.matches;
    var body = rowABrowserBody();
    var gallery = body ? body.querySelector(".hero-gallery") : null;
    rowATiles = gallery ? [].slice.call(gallery.querySelectorAll(".hero-tile")) : [];
    if (mobile) {
      rowAToastEls = [
        document.getElementById("rowAToast"),
        document.getElementById("rowAToast2")
      ];
      rowAToast = rowAToastEls[0];
    } else {
      rowAToastEls = [];
      rowAToast = document.getElementById("heroToast");
    }
    return rowATiles;
  };

  var rowAHotOnly = function(tile){
    for (var i = 0; i < rowATiles.length; i++){
      if (rowATiles[i] === tile) rowATiles[i].classList.add("hero-tile--hot");
      else rowATiles[i].classList.remove("hero-tile--hot");
    }
  };

  var rowATrack = function(durationMs, opts){
    opts = opts || {};
    if (rowARaf) { cancelAnimationFrame(rowARaf); rowARaf = 0; }
    var started = Date.now();
    var tick = function(){
      if (!rowACursor) return;
      var r = rowACursor.getBoundingClientRect();
      var under = document.elementFromPoint(r.left, r.top);
      rowAHotOnly(under && under.closest ? under.closest(".hero-tile") : null);
      if (Date.now() - started < durationMs) rowARaf = requestAnimationFrame(tick);
      else {
        rowARaf = 0;
        if (opts.clearOnEnd) rowAHotOnly(null);
      }
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
      if (w <= W) left = Math.max(minLeft, Math.min(left, minLeft + W - w));
      else left = minLeft;
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
  var rowATileCoverDrawn = function(tile, rw, rh){
    if (!tile || !rw || !rh) return null;
    var W = tile.offsetWidth;
    var H = tile.offsetHeight;
    if (!W || !H) return null;
    var r = rw / rh;
    if (W / H > r) return { w: H * r, h: H };
    return { w: W, h: W / r };
  };
  var rowAPasteSize = function(el, rw, rh, tile){
    if (!el || !rw || !rh) return false;
    el.style.aspectRatio = rw + "/" + rh;
    var drawn = tile ? rowATileCoverDrawn(tile, rw, rh) : null;
    if (drawn) {
      el.style.width = drawn.w + "px";
      el.style.height = drawn.h + "px";
      return true;
    }
    if (rw > rh) {
      el.style.width = "50%";
      el.style.height = "";
    } else {
      el.style.height = "50%";
      el.style.width = "";
    }
    return true;
  };
  var rowAPasteAt = function(el, ox, oy, rw, rh, tile){
    if (!el || !rowACanvas || !rowACanvasPan) return;
    if (ox == null) ox = 0;
    if (oy == null) oy = 0;
    var place = function(){
      void el.offsetWidth;
      rowAPastePosition(el, ox, oy);
    };
    el.classList.add("rowA-paste--in");
    if (rowAPasteSize(el, rw, rh, tile)) place();
    else {
      el.addEventListener("load", function(){
        rowAPasteSize(el, el.naturalWidth, el.naturalHeight, tile);
        place();
      }, { once: true });
      place();
    }
  };

  var rowATileImgSrc = function(tile){
    var img = tile ? tile.querySelector("img") : null;
    return img ? img.getAttribute("src") : "";
  };
  /* Hero watermark demo uses these -before files on tiles 6, 7 and 13 (and a second tile 2).
     Row A copies as-is, so any tile showing one of these paths is skipped. */
  var rowATilePickExcluded = function(tile){
    var src = rowATileImgSrc(tile);
    return /hero-image-(9|2|14)-before\.webp/.test(src);
  };
  var rowAPickEligible = function(tiles){
    var out = [];
    for (var ei = 0; ei < tiles.length; ei++) {
      if (!rowATilePickExcluded(tiles[ei])) out.push(tiles[ei]);
    }
    return out;
  };
  var rowATileNatural = function(tile){
    var img = tile ? tile.querySelector("img") : null;
    if (!img || !img.naturalWidth) return null;
    return { w: img.naturalWidth, h: img.naturalHeight };
  };

  var rowAVisibleTiles = function(){
    var body = rowABrowserBody();
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

  var rowAPickTiles = function(forcedTile){
    if (forcedTile && rowATilePickExcluded(forcedTile)) forcedTile = null;
    var visible = rowAPickEligible(rowAVisibleTiles());
    if (!visible.length) visible = rowAPickEligible(rowATiles);
    if (!visible.length) return [];
    var lead;
    if (forcedTile) {
      lead = forcedTile;
    } else {
      lead = rowATiles[0];
      var leadOk = false;
      for (var li = 0; li < visible.length; li++) {
        if (visible[li] === lead) { leadOk = true; break; }
      }
      if (!leadOk || rowATilePickExcluded(lead)) lead = visible[0];
    }
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
    rowAPasteAt(el, ox, oy, rw, rh, tile);
    rowAPasteCount++;
    return { ox: ox, oy: oy };
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
    if (rowAMobile && rowAMobile.matches) rowAResetMobileToasts();
    else if (rowAToast) rowAToast.classList.remove("hero-toast--in");
  };

  var rowAStop = function(){
    rowAClearTimers();
    rowAReset();
  };

  var rowAPlay = function(forcedTile){
    if (window.grrabBrowser && window.grrabBrowser.stopHero) window.grrabBrowser.stopHero();
    rowARefreshTiles();
    var mobilePlay = rowAMobile && rowAMobile.matches;
    if (!rowACursor || !rowATiles.length) return;
    if (!mobilePlay && (!rowACanvas || !rowACanvas.offsetWidth)) return;
    rowAClearTimers();
    if (forcedTile) {
      rowAClearPastes();
    } else if (rowAPasteCount + 5 > rowAPasteMax) {
      rowAClearPastes();
    }
    rowAReset();

    var tileOrder = rowAPickTiles(forcedTile);
    if (!tileOrder.length) return;

    if (rowAReduce && rowAReduce.matches && !mobilePlay) {
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
      if (lastSlot) rowAMoveTo(rowAPastePointIn(lastSlot.ox, lastSlot.oy));
      return;
    }

    if (mobilePlay) {
      rowAResetMobileToasts();
      var browserStartM = rowABrowserStartIn();
      rowACursor.classList.add("rowA-cursor--on");
      rowACursor.style.transition = "none";
      rowAMoveTo(browserStartM);
      void rowACursor.offsetWidth;
      rowACursor.style.transition = "";

      for (var repM = 0; repM < 5; repM++) {
        (function(beat, tile){
          var t0 = beat * rowARepLenMobile;
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
            rowAMobileToastShow();
          });
          rowAAt(t0 + 1790, function(){
            if (rowACopyTip) rowACopyTip.classList.remove("rowA-tip--in");
          });
        })(repM, tileOrder[repM]);
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
          rowAMoveTo(rowAPastePointIn(slot.ox, slot.oy));
          rowATrack(rowACursorMoveMs, { clearOnEnd: true });
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
          if (rowAMobile && rowAMobile.matches) {
            rowAPlay();
          } else if (window.grrabBrowser && window.grrabBrowser.at === "hero") {
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
          if (window.grrabBrowser && entries[i].boundingClientRect.top > 0 &&
              !(rowAMobile && rowAMobile.matches)) {
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
