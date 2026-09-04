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

  /* ──────────────────── HERO — ZOOM-OUT TRIGGER ──────────────────── */
  var heroStage = document.querySelector(".hero-stage");

  if (heroStage) {
    /* The two zoom animations are declared paused so the very first painted frame is
       already the zoomed-in one. Adding the class is what starts them, which is how a
       sequence will later hand off to the pull-back instead of a fixed delay. */
    var heroZoomOut = function(){ heroStage.classList.add("hero-stage--zoomout"); };
    var heroReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

    /* The sequence calls heroZoomOut when the Clip button is pressed. This timer is
       only a backstop for the case where the sequence never runs; adding the class
       twice is harmless. */
    if (heroReduce && heroReduce.matches) heroZoomOut();
    else setTimeout(heroZoomOut, 10500);
  }

  /* ──────────────────── HERO — EDIT-MODE SEQUENCE ──────────────────── */
  var heroCamera = document.querySelector(".hero-camera");
  var heroBody = document.querySelector(".hero-body");
  var heroCursor = document.getElementById("heroCursor");
  var heroTip = document.getElementById("heroTip");
  var heroOverlay = document.getElementById("heroOverlay");
  var heroOverlayAfter = document.getElementById("heroOverlayAfter");
  var heroOverlayBtn = document.getElementById("heroOverlayBtn");
  var heroBusy = document.getElementById("heroBusy");
  var heroWipe = document.getElementById("heroWipe");
  var heroWipeBar = document.getElementById("heroWipeBar");
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
  var heroPaste = document.getElementById("heroPaste");
  var heroPaste2 = document.getElementById("heroPaste2");
  var heroTipV = document.getElementById("heroTipV");
  var heroGallery = document.querySelector(".hero-gallery");
  var heroMarquee = document.getElementById("heroMarquee");
  var heroHint = document.getElementById("heroHint");
  var heroTiles = [].slice.call(document.querySelectorAll(".hero-tile"));

  if (heroCamera && heroBody && heroCursor && heroOverlay && heroTiles.length) {
    var heroTimers = [];
    var heroLateTimer = 0;
    var heroRaf = 0;
    var heroAt = function(ms, fn){ heroTimers.push(setTimeout(fn, ms)); };

    /* Positions come from offsetLeft/offsetTop, walking up to .hero-camera, rather
       than from getBoundingClientRect. The camera scales this whole subtree, so a
       screen rect would be 1.7x the value the cursor's own transform needs; offsets
       are layout pixels and stay correct at any zoom. The walk ends at the camera
       rather than the window because the cursor now lives there and has to be able
       to travel between the two windows. */
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
      if (heroWipe && heroWipeBar) {
        var hw = heroFigure ? heroFigure.offsetWidth : 0;
        heroWipe.classList.add("hero-wipe--on");
        heroWipeBar.style.transition = "none";
        heroWipeBar.style.transform = "translateX(calc(" + hw + "px - 50%))";
        void heroWipeBar.offsetWidth;
        heroWipeBar.style.transition = "";
        heroWipeBar.style.transform = "translateX(-50%)";
      }
      if (heroOverlayAfter) heroOverlayAfter.classList.add("hero-overlay-after--in");
      if (heroLateTimer) { clearTimeout(heroLateTimer); heroLateTimer = 0; }
      heroLateTimer = setTimeout(function(){
        heroLateTimer = 0;
        if (heroLateActs) {
          heroLateActs.forEach(function(el){ el.classList.add("hero-overlay-act--in"); });
        }
        if (heroWipe) heroWipe.classList.remove("hero-wipe--on");
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
        heroOverlayAfter.setAttribute("src", s.img.replace("-before.webp", "-after.webp"));
        if (s.alpha) heroOverlayAfter.classList.add("hero-overlay-after--alpha");
        else heroOverlayAfter.classList.remove("hero-overlay-after--alpha");
      }
      if (heroFigure) heroFigure.style.aspectRatio = s.ratio;
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
      if (heroWipe) heroWipe.classList.remove("hero-wipe--on");
      if (heroWipeBar) {
        heroWipeBar.style.transition = "none";
        heroWipeBar.style.transform = "translateX(-50%)";
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
    /* One moment does four things: the editor closes, the toast appears, the camera
       starts pulling back, and the cursor leaves for the canvas. They are deliberately
       on the same tick so the pull-back reads as a consequence of the click. */
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
      heroZoomOut();
      if (heroCanvas) {
        heroCursor.classList.add("hero-cursor--slow");
        heroMoveTo(heroCentreIn(heroCanvas));
      }
    };
    var heroToastOut = function(){
      if (heroToast) heroToast.classList.remove("hero-toast--in");
    };
    /* The paste is shown first so its laid-out size can be read, then positioned so its
       centre sits under the cursor's point. No fade: a paste is instantaneous. */
    /* heroPanX is added back because the pan layer is what the paste's left is measured
       against. With the layer shifted, the point under the cursor sits that much further
       along the layer than it does on screen. */
    var heroPanX = 0;
    var heroPanY = 0;
    var heroPasteAt = function(el, ratio){
      if (!el || !heroCanvas || !heroCanvasPan) return;
      var p = heroCentreIn(heroCanvas);
      var o = heroOffsetIn(heroCanvasPan);
      el.style.aspectRatio = ratio;
      el.classList.add("hero-paste--in");
      el.style.left = (p.x - o.x - heroPanX - el.offsetWidth / 2) + "px";
      el.style.top = (p.y - o.y - heroPanY - el.offsetHeight / 2) + "px";
    };
    var heroPasteIn = function(){
      if (heroTipV) heroTipV.classList.add("hero-tip--in");
      heroPasteAt(heroPaste, heroSteps[0].ratio);
    };
    var heroPasteIn2 = function(){
      if (heroTipV) heroTipV.classList.add("hero-tip--in");
      heroPasteAt(heroPaste2, heroSteps[1].ratio);
    };
    /* Clip's second press has no camera move: the scene is already at rest, so this
       does only what the editor's closing needs. */
    var heroClipDone2 = function(){
      if (heroActClip) {
        heroActClip.classList.remove("hero-overlay-act--press");
        heroActClip.classList.remove("hero-overlay-act--hover");
      }
      heroOverlay.classList.remove("hero-overlay--on");
      heroHotOnly(null);
      if (heroToast) heroToast.classList.add("hero-toast--in");
    };
    /* The layer and the cursor move the same distance over the same .75s, which is the
       only thing that makes this read as a drag rather than the canvas sliding on its
       own. Both offsets go negative: content moves up and left, so a point on screen
       maps to a LARGER coordinate on the layer.
       0.72 and 0.55 of the paste's own size leave roughly its bottom-right eighth in
       view — enough to say there is more over there without clearing the middle. */
    var heroPanLeft = function(){
      if (!heroCanvasPan || !heroPaste || !heroCanvas) return;
      heroPanX = -heroPaste.offsetWidth * 0.72;
      heroPanY = -heroPaste.offsetHeight * 0.55;
      heroCanvasPan.style.transform = "translate(" + heroPanX + "px," + heroPanY + "px)";
      var p = heroCentreIn(heroCanvas);
      heroMoveTo({ x: p.x + heroPanX, y: p.y + heroPanY });
    };
    var heroTipVOut = function(){
      if (heroTipV) heroTipV.classList.remove("hero-tip--in");
    };
    /* --slow was for the long drift to the canvas; this hop is short and wants the
       cursor's normal .75s back. */
    /* A real scroll is impossible here: .hero-body is the flex row holding the sidebar
       as well, so scrolling it would carry the sidebar up too. The gallery is moved by
       transform instead and .hero-body's overflow:hidden does the clipping. */
    var heroScrollY = 0;
    var heroScrollDown = function(){
      if (!heroGallery) return;
      heroScrollY = Math.max(0, heroGallery.offsetHeight - heroBody.clientHeight);
      heroGallery.style.transform = "translateY(" + (-heroScrollY) + "px)";
    };
    /* offsetTop ignores transforms, so the scrolled distance has to come off by hand.
       elementFromPoint in heroTrack does see the real position and needs no adjusting. */
    var heroHoverLate = function(){
      var tile = heroTiles[heroTiles.length - 5];
      if (!tile) return;
      var p = heroCentreIn(tile);
      heroMoveTo({ x: p.x, y: p.y - heroScrollY });
    };
    /* The opposite conversion to heroPasteAt: a layer coordinate back to a screen one,
       because the cursor lives outside the layer. Hence + heroPanX, not - . */
    var heroCursorAsideOf = function(el){
      if (!el || !heroCanvasPan) return;
      var o = heroOffsetIn(heroCanvasPan);
      heroMoveTo({ x: o.x + heroPanX + el.offsetLeft + el.offsetWidth,
                   y: o.y + heroPanY + el.offsetTop + el.offsetHeight });
    };

    var heroPlay = function(){
      var tile = heroTiles[0];
      if (!tile || !heroBody.offsetWidth) return;
      /* Every cycle queues about thirty timers. Cancelling and emptying the list here
         keeps that from growing without bound, and means a stray call cannot leave two
         sequences running against each other. */
      for (var ht = 0; ht < heroTimers.length; ht++) clearTimeout(heroTimers[ht]);
      heroTimers.length = 0;
      heroLateTimer = 0;
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
      heroAt(8750, heroToastOut);
      heroAt(8450, heroPasteIn);
      heroAt(8790, heroTipVOut);
      /* One tracking run covers the whole return leg: crossing back in, the scroll, and
         the final approach. During the scroll the cursor is still and the tiles slide
         under it, which elementFromPoint picks up frame by frame. 2790 runs to 14190,
         where the glow is locked. */
      heroAt(8790, function(){
        /* --slow belonged to the drift out to the canvas. It used to come off in
           heroCursorAside; with that step gone this is the first move that needs the
           cursor's normal .75s back.
           This fires the moment the tooltip clears, so the cursor leaves as soon as the
           paste has landed. 2650 is 12690 minus 10040 — the tracking has to reach the
           step that locks the glow, so it moves whenever this does. */
        heroCursor.classList.remove("hero-cursor--slow");
        heroMoveTo(heroCentreIn(heroBody));
        heroTrack(2650);
      });
      heroAt(9750, heroScrollDown);
      heroAt(10650, heroHoverLate);
      heroAt(11440, function(){
        if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }
        heroHotOnly(heroTiles[heroTiles.length - 5]);
      });

      /* ── second pass: erase, on the tile the cursor just settled on ── */
      var box = { l:0.39, t:0.38, r:0.59, b:0.65 };
      heroAt(11850, function(){ if (heroTip) heroTip.classList.add("hero-tip--in"); });
      heroAt(12190, function(){ if (heroTip) heroTip.classList.remove("hero-tip--in"); });
      heroAt(12490, function(){
        heroSetStep(heroSteps[1]);
        heroResetOverlay();
        heroOverlay.classList.add("hero-overlay--on");
      });
      heroAt(12770, function(){ heroMoveTo(heroBoxPoint(box.l, box.t)); });
      heroAt(13520, function(){
        if (!heroMarquee) return;
        heroMarquee.style.left = (box.l * 100) + "%";
        heroMarquee.style.top = (box.t * 100) + "%";
        heroMarquee.style.width = "0%";
        heroMarquee.style.height = "0%";
        heroMarquee.classList.add("hero-marquee--on");
        heroMoveTo(heroBoxPoint(box.r, box.b));
        heroDragTrack(box, 820);
      });
      heroAt(14340, function(){
        if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }
        heroSetAction(true);
        if (!heroMarquee) return;
        heroMarquee.style.width = ((box.r - box.l) * 100) + "%";
        heroMarquee.style.height = ((box.b - box.t) * 100) + "%";
      });
      heroAt(14540, function(){
        if (heroOverlayBtn) heroMoveTo(heroCentreIn(heroOverlayBtn));
      });
      heroAt(15290, heroHover);
      heroAt(15690, heroPress);
      heroAt(16690, heroReveal);

      /* ── second clip: no camera move this time, a canvas pan instead ── */
      heroAt(18090, function(){
        if (heroActClip) heroMoveTo(heroCentreIn(heroActClip));
      });
      heroAt(18840, heroClipHover);
      heroAt(19240, heroClipPress);
      heroAt(19440, heroClipDone2);
      heroAt(19890, function(){ heroMoveTo(heroCentreIn(heroCanvas)); });
      heroAt(21190, heroToastOut);
      heroAt(20790, heroPanLeft);
      /* 23250 is exactly when the pan's .75s transition ends, so the cursor sets off
         the instant the canvas stops rather than after a beat. */
      heroAt(21540, function(){ heroMoveTo(heroCentreIn(heroCanvas)); });
      heroAt(22340, heroPasteIn2);
      heroAt(22680, heroTipVOut);
      heroAt(22840, function(){ heroCursorAsideOf(heroPaste2); });

      /* ── the return ── */
      /* Nothing fades and nothing is moved out of the way. The zoom-in carries the camera
         back to the browser window, which takes the canvas and the cursor off-screen on
         its own; by the time the reset clears them they have been out of sight for over a
         second. The gallery scrolls back at the same time because it is inside the window
         the camera is closing in on, so it would be seen if left. */
      heroAt(23790, function(){
        if (heroStage) {
          heroStage.classList.remove("hero-stage--zoomout");
          heroStage.classList.add("hero-stage--zoomin");
        }
        if (heroGallery) {
          heroScrollY = 0;
          heroGallery.style.transform = "translateY(0)";
        }
      });
      heroAt(25290, function(){ window.heroReset(); });
      /* 100ms after the reset rather than in the same tick: the reset suppresses several
         transitions with a forced reflow, and starting the next cycle inside that same
         frame can show as a flicker. */
      heroAt(25390, function(){ heroPlay(); });
    };

    /* Puts everything back to the opening state. Defined here and hung on window so it
       can be called from the console before anything depends on it; the loop wires it up
       in a later round. The camera is deliberately NOT reset — removing the zoom class
       would snap it rather than animate, and the zoom-in is its own step. */
    window.heroReset = function(){
      if (heroRaf) { cancelAnimationFrame(heroRaf); heroRaf = 0; }

      /* pan and scroll, both the variables and what they drew */
      heroPanX = 0; heroPanY = 0; heroScrollY = 0;
      /* Transitions off for the snap back: by the time this runs the sequence has already
         animated both, and letting them glide would send them travelling a second time. */
      if (heroCanvasPan) {
        heroCanvasPan.style.transition = "none";
        heroCanvasPan.style.transform = "";
        void heroCanvasPan.offsetWidth;
        heroCanvasPan.style.transition = "";
      }
      if (heroGallery) {
        heroGallery.style.transition = "none";
        heroGallery.style.transform = "";
        void heroGallery.offsetWidth;
        heroGallery.style.transition = "";
      }

      /* the two pasted images */
      if (heroPaste) { heroPaste.classList.remove("hero-paste--in");
        heroPaste.classList.remove("hero-paste--out");
        heroPaste.style.left = ""; heroPaste.style.top = ""; }
      if (heroPaste2) { heroPaste2.classList.remove("hero-paste--in");
        heroPaste2.classList.remove("hero-paste--out");
        heroPaste2.style.left = ""; heroPaste2.style.top = ""; }

      /* the cursor */
      heroCursor.classList.remove("hero-cursor--on");
      heroCursor.classList.remove("hero-cursor--slow");
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
      /* The zoom-in class is removed but zoom-out is NOT re-added: the stage should be
         left in its opening, zoomed-in state, which is what no class at all means once
         the paused zoom-out animation is gone. */
      if (heroStage) heroStage.classList.remove("hero-stage--zoomin");
    };

    if (heroReduce && heroReduce.matches) {
      heroHotOnly(heroTiles[0]);
      heroSetStep(heroSteps[0]);
      heroOverlay.classList.add("hero-overlay--on");
      heroReveal();
      if (heroToast) heroToast.classList.add("hero-toast--in");
      if (heroPaste) heroPasteIn();
      if (heroTipV) heroTipV.classList.remove("hero-tip--in");
    } else {
      heroPlay();
    }
  }

  /* ──────────────────── ROW B — EDIT-MODE DEMO ──────────────────── */
  var rowBChrome = document.querySelector(".rowB-chrome");
  var rowBBody = document.querySelector(".rowB-body");
  var rowBFigure = document.querySelector(".rowB-overlay-figure");
  var rowBHandle = document.getElementById("rowBHandle");
  var rowBClip = document.querySelector(".rowB-slider-clip");
  var rowBCursor = document.getElementById("rowBCursor");
  var rowBTip = document.getElementById("rowBTip");
  var rowBOverlay = document.getElementById("rowBOverlay");
  var rowBOverlayImg = document.getElementById("rowBOverlayImg");
  var rowBOverlayAfter = document.getElementById("rowBOverlayAfter");
  var rowBOverlayBtn = document.getElementById("rowBOverlayBtn");
  var rowBActUpscale = document.getElementById("rowBActUpscale");
  var rowBActs = [].slice.call(document.querySelectorAll(".rowB-overlay-act"));
  var rowBLateActs = rowBOverlay
    ? [].slice.call(rowBOverlay.querySelectorAll(".rowB-overlay-act--late"))
    : [];
  var rowBMarquee = document.getElementById("rowBMarquee");
  var rowBBusy = document.getElementById("rowBBusy");
  var rowBBusyText = document.getElementById("rowBBusyText");
  var rowBOverlayBtnIcon = document.getElementById("rowBOverlayBtnIcon");
  var rowBOverlayBtnLabel = document.getElementById("rowBOverlayBtnLabel");
  var rowBHint = document.getElementById("rowBHint");
  var rowBCards = [].slice.call(document.querySelectorAll(".rowB-card"));
  var rowBTiles = [].slice.call(document.querySelectorAll(".rowB-tile"));

  if (rowBBody && rowBCursor && rowBOverlay && rowBOverlayImg && rowBCards.length && rowBTiles.length) {
    var rowBSteps = [
      { tile:0, img:"/assets/landing/img/rowB/rowB-image-1-before.webp",
        icon:"/assets/landing/icons/rowB/icon_removebg.svg", label:"Remove BG", alpha:true },
      /* "Remove" is the extension's own wording for the erase action, and it is written
         out again in the hero's heroSetAction — change both together. */
      { tile:4, img:"/assets/landing/img/rowB/rowB-image-7-before.webp",
        icon:"/assets/landing/icons/rowB/icon_erase.svg", label:"Remove",
        box:{ l:0.39, t:0.38, r:0.59, b:0.65 } },
      /* The bottom bar's Upscale, not the top button — target says which. The images are
         a stand-in: 5-before and 5-after are currently identical, so the wipe runs but
         shows no change. Replacing them is part of the final asset pass. */
      { tile:6, img:"/assets/landing/img/rowB/rowB-image-5-before.webp",
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
        if (erasing) rowBHint.classList.add("rowB-hint--off");
        else rowBHint.classList.remove("rowB-hint--off");
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
    var rowBAt = function(ms, fn){ rowBTimers.push(setTimeout(fn, ms)); };

    var rowBHotOnly = function(tile){
      for (var i = 0; i < rowBTiles.length; i++){
        if (rowBTiles[i] === tile) rowBTiles[i].classList.add("rowB-tile--hot");
        else rowBTiles[i].classList.remove("rowB-tile--hot");
      }
    };

    var rowBTrack = function(durationMs){
      var started = Date.now();
      var tick = function(){
        var r = rowBCursor.getBoundingClientRect();
        var under = document.elementFromPoint(r.left, r.top);
        rowBHotOnly(under && under.closest ? under.closest(".rowB-tile") : null);
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
      while (n && n !== rowBBody) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
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
      return (s && s.target === "upscale") ? "rowB-overlay-act" : "rowB-overlay-btn";
    };
    var rowBHover = function(){
      var el = rowBTargetEl();
      if (el) el.classList.add(rowBTargetCls() + "--hover");
    };
    var rowBPress = function(){
      var el = rowBTargetEl();
      if (el) el.classList.add(rowBTargetCls() + "--press");
      if (rowBBusy) rowBBusy.classList.add("rowB-busy--on");
      if (rowBMarquee) {
        rowBMarquee.classList.remove("rowB-marquee--on");
        rowBMarquee.style.width = "0%";
        rowBMarquee.style.height = "0%";
      }
    };
    var rowBReveal = function(){
      if (rowBBusy) rowBBusy.classList.remove("rowB-busy--on");
      var el = rowBTargetEl();
      if (el) el.classList.remove(rowBTargetCls() + "--press");
      if (rowBMarquee) rowBMarquee.classList.remove("rowB-marquee--on");
      if (rowBClip) rowBClip.classList.add("rowB-slider-clip--wipe");
      if (rowBHandle) {
        rowBHandle.style.transition = "none";
        rowBHandle.style.left = "100%";
        void rowBHandle.offsetWidth;
        rowBHandle.style.transition = "";
        rowBHandle.style.left = "0%";
      }
      if (rowBOverlayAfter) rowBOverlayAfter.classList.add("rowB-overlay-after--in");
      if (rowBLateTimer) { clearTimeout(rowBLateTimer); rowBLateTimer = 0; }
      rowBLateTimer = setTimeout(function(){
        rowBLateTimer = 0;
        if (rowBLateActs) {
          rowBLateActs.forEach(function(el){ el.classList.add("rowB-overlay-act--in"); });
        }
        var s = rowBSteps[rowBCurrent];
        if (rowBActUpscale && s && s.target === "upscale") {
          rowBActUpscale.classList.remove("rowB-overlay-act--hover");
          rowBActUpscale.classList.add("rowB-overlay-act--ghost");
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
      if (rowBClip) rowBClip.classList.remove("rowB-slider-clip--wipe");
      if (rowBHandle) rowBHandle.style.transition = "";
      if (rowBChrome) rowBChrome.classList.add("rowB-chrome--live");
      rowBOverlay.classList.add("rowB-overlay--live");
      rowBSetSplit(0);
    };

    var rowBReset = function(){
      if (rowBRaf) { cancelAnimationFrame(rowBRaf); rowBRaf = 0; }
      rowBLive = false;
      rowBSplitDragging = false;
      if (rowBLateTimer) { clearTimeout(rowBLateTimer); rowBLateTimer = 0; }
      if (rowBLateActs) {
        rowBLateActs.forEach(function(el){ el.classList.remove("rowB-overlay-act--in"); });
      }
      if (rowBChrome) rowBChrome.classList.remove("rowB-chrome--live");
      rowBOverlay.classList.remove("rowB-overlay--live");
      if (rowBClip) rowBClip.classList.remove("rowB-slider-clip--wipe");
      if (rowBHandle) {
        rowBHandle.style.transition = "none";
        rowBHandle.style.left = "0%";
      }
      rowBOverlay.classList.remove("rowB-overlay--on");
      rowBCursor.classList.remove("rowB-cursor--on");
      if (rowBTip) rowBTip.classList.remove("rowB-tip--in");
      if (rowBOverlayBtn) {
        rowBOverlayBtn.classList.remove("rowB-overlay-btn--press");
        rowBOverlayBtn.classList.remove("rowB-overlay-btn--hover");
      }
      if (rowBActUpscale) {
        rowBActUpscale.classList.remove("rowB-overlay-act--press");
        rowBActUpscale.classList.remove("rowB-overlay-act--hover");
        rowBActUpscale.classList.remove("rowB-overlay-act--ghost");
      }
      if (rowBBusy) rowBBusy.classList.remove("rowB-busy--on");
      if (rowBHint) rowBHint.classList.remove("rowB-hint--off");
      if (rowBOverlayAfter) {
        rowBOverlayAfter.style.clipPath = "";
        rowBOverlayAfter.style.webkitClipPath = "";
        rowBOverlayAfter.style.transition = "none";
        rowBOverlayAfter.classList.remove("rowB-overlay-after--in");
        void rowBOverlayAfter.offsetWidth;
        rowBOverlayAfter.style.transition = "";
      }
      if (rowBMarquee) {
        rowBMarquee.classList.remove("rowB-marquee--on");
        rowBMarquee.style.width = "0%";
        rowBMarquee.style.height = "0%";
      }
      for (var i = 0; i < rowBTiles.length; i++) rowBTiles[i].classList.remove("rowB-tile--hot");
    };

    var rowBPlay = function(index){
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
        rowBOverlayAfter.setAttribute("src", step.img.replace("-before.webp", "-after.webp"));
        if (step.alpha) rowBOverlayAfter.classList.add("rowB-overlay-after--alpha");
        else rowBOverlayAfter.classList.remove("rowB-overlay-after--alpha");
      }
      rowBSetAction(step, false);
      for (var c = 0; c < rowBCards.length; c++){
        if (c === index) rowBCards[c].classList.add("rowB-card--active");
        else rowBCards[c].classList.remove("rowB-card--active");
      }

      if (rowBReduce && rowBReduce.matches) {
        tile.classList.add("rowB-tile--hot");
        rowBOverlay.classList.add("rowB-overlay--on");
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
      rowBAt(1820, function(){ rowBOverlay.classList.add("rowB-overlay--on"); });

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
          rowBMarquee.classList.add("rowB-marquee--on");
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

    if (rowBFigure) {
      var rowBSplitFrom = function(clientX){
        var r = rowBOverlayImg.getBoundingClientRect();
        if (!r.width) return;
        rowBSetSplit((clientX - r.left) / r.width);
      };
      rowBFigure.addEventListener("dragstart", function(e){ e.preventDefault(); });
      var rowBOnChrome = function(target){
        return !!(target && target.closest &&
          target.closest(".rowB-overlay-btn, .rowB-overlay-act"));
      };
      rowBFigure.addEventListener("pointerdown", function(e){
        if (!rowBLive) return;
        if (rowBOnChrome(e.target)) return;
        e.preventDefault();
        rowBSplitDragging = true;
        try { rowBFigure.setPointerCapture(e.pointerId); } catch(_){}
        rowBSplitFrom(e.clientX);
      });
      rowBFigure.addEventListener("pointermove", function(e){
        if (rowBLive && rowBSplitDragging) rowBSplitFrom(e.clientX);
      });
      rowBFigure.addEventListener("pointerup", function(e){
        rowBSplitDragging = false;
        try { rowBFigure.releasePointerCapture(e.pointerId); } catch(_){}
      });
      rowBFigure.addEventListener("pointercancel", function(){ rowBSplitDragging = false; });
    }

    var rowBRow = document.querySelector(".grrab-rowB");
    if (rowBRow && "IntersectionObserver" in window) {
      new IntersectionObserver(function(entries){
        for (var i = 0; i < entries.length; i++){
          if (rowBDone) continue;
          if (entries[i].isIntersecting) rowBPlay(rowBCurrent);
          else { rowBClearTimers(); rowBReset(); }
        }
      }, { threshold: 0.6 }).observe(rowBRow);
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
