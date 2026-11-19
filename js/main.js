(function(){
  "use strict";

  /* ---- sticky header state ---- */
  var head = document.getElementById('head');
  var onScroll = function(){
    if (window.scrollY > 40) head.classList.add('stuck');
    else head.classList.remove('stuck');
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  /* ---- section menu: Menu button on smaller screens, and a marker on the section that's on screen ---- */
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav [data-nav]'));
  var setMenu = function(open){
    head.classList.toggle('nav-open', open);
    if (navToggle) navToggle.setAttribute('aria-expanded', String(open));
  };
  if (navToggle) {
    navToggle.addEventListener('click', function(){ setMenu(!head.classList.contains('nav-open')); });
    document.querySelectorAll('.site-nav a').forEach(function(a){ a.addEventListener('click', function(){ setMenu(false); }); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setMenu(false); });
    document.addEventListener('click', function(e){ if (!head.contains(e.target)) setMenu(false); });
    window.addEventListener('resize', function(){ if (window.innerWidth >= 1100) setMenu(false); });
  }
  if ('IntersectionObserver' in window && navLinks.length) {
    var spy = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (!en.isIntersecting) return;
        navLinks.forEach(function(a){
          a.setAttribute('aria-current', String(!!en.target.id && a.getAttribute('href') === '#' + en.target.id));
        });
      });
    }, {rootMargin: '-45% 0px -50% 0px'});      // the section crossing the middle of the screen
    // watch every section, so the marker also disappears in sections that aren't in the menu
    document.querySelectorAll('[data-section]').forEach(function(sec){ spy.observe(sec); });
  }

  /* ---- work rail filter ---- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('#work .tab'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('#rail .vcard'));
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      tabs.forEach(function(t){ t.setAttribute('aria-selected', String(t === tab)); });
      var cat = tab.getAttribute('data-cat');
      cards.forEach(function(c){
        c.hidden = !(cat === 'all' || c.getAttribute('data-cat') === cat);
      });
    });
  });

  /* ---- slot players: the play button hides while playing; tap the video to pause ---- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-play]').forEach(function(btn){
    var slot = btn.closest('[data-player]');
    if (!slot) return;
    var video = slot.querySelector('video');
    var label = btn.getAttribute('aria-label');
    var show = function(playing){
      slot.classList.toggle('is-playing', playing);
      btn.textContent = playing ? '❚❚' : '▶';
      btn.setAttribute('aria-label', playing ? label.replace(/^Play/, 'Pause') : label);
    };
    var toggle = function(){
      if (video) { if (video.paused) video.play(); else video.pause(); }
      else show(!slot.classList.contains('is-playing'));
    };
    if (video) {
      video.addEventListener('play', function(){ show(true); });
      video.addEventListener('pause', function(){ show(false); });
      show(!video.paused);
    }
    btn.addEventListener('click', function(e){ e.stopPropagation(); toggle(); });
    // a tap anywhere on the video plays or pauses it (the timeline stops its own clicks)
    slot.addEventListener('click', toggle);
  });

  /* ---- every video (hero reel + spec videos): a timeline you can tap or drag to jump through it ---- */
  document.querySelectorAll('[data-player]').forEach(function(slot){
    var video = slot.querySelector('video');
    if (!video) return;
    var bar = document.createElement('div');
    bar.className = 'scrub';
    bar.setAttribute('role', 'slider');
    bar.setAttribute('tabindex', '0');
    bar.setAttribute('aria-label', 'Video position');
    bar.innerHTML = '<div class="scrub-fill"></div>';
    slot.appendChild(bar);
    var fill = bar.firstChild, raf = null;
    var draw = function(){
      var p = video.duration ? video.currentTime / video.duration : 0;
      fill.style.width = (p * 100) + '%';
      bar.setAttribute('aria-valuenow', Math.round(p * 100));
    };
    var loop = function(){ draw(); raf = video.paused ? null : requestAnimationFrame(loop); };
    video.addEventListener('play', function(){ if (!raf) raf = requestAnimationFrame(loop); });
    video.addEventListener('seeked', draw);
    video.addEventListener('timeupdate', draw);   // backup when animation frames are throttled
    video.addEventListener('emptied', draw);      // reset to the cover: empty the line again
    var seek = function(e){
      var r = bar.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      if (video.duration) { video.currentTime = p * video.duration; draw(); }
    };
    bar.addEventListener('pointerdown', function(e){
      e.stopPropagation();
      bar.setPointerCapture(e.pointerId);
      bar.classList.add('dragging');
      seek(e);
    });
    bar.addEventListener('pointermove', function(e){ if (bar.classList.contains('dragging')) seek(e); });
    var stop = function(){ bar.classList.remove('dragging'); };
    bar.addEventListener('pointerup', stop);
    bar.addEventListener('pointercancel', stop);
    bar.addEventListener('click', function(e){ e.stopPropagation(); });   // don't pause the video
    bar.addEventListener('keydown', function(e){
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + (e.key === 'ArrowRight' ? 2 : -2)));
      }
    });
  });

  /* ---- back to the start: a spec video that was played goes back to its cover image (load() shows the
     poster again; jumping to 0:00 would only show the first frame). The muted hero reel just rewinds. ---- */
  var heroVideo = document.querySelector('.hero video');
  function resetToCover(v){
    if (!v.paused) v.pause();
    if (v === heroVideo) { v.currentTime = 0; return; }
    if (v.currentTime > 0 || v.played.length) v.load();
  }

  /* ---- only one video plays at a time: starting one stops every other and sends it back to the start ---- */
  document.addEventListener('play', function(e){
    document.querySelectorAll('video').forEach(function(v){
      if (v !== e.target && !v.paused) resetToCover(v);
    });
  }, true);   // capture: 'play' doesn't bubble

  /* ---- videos stop when they leave the screen. Scrolled past, scrolled sideways out of the folder or
     filtered away by a tab: spec videos go back to their cover, so they start from the beginning next time
     (even if they were already paused). Browser tab switched: they only pause, so nobody loses their place.
     The muted hero reel picks up again when it comes back into view. ---- */
  var autoPaused = null;   // the hero, when it was paused only because it went out of view
  if ('IntersectionObserver' in window) {
    var seen = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        var v = en.target;
        if (en.intersectionRatio < 0.25) {
          if (v === heroVideo) { if (!v.paused) { v.pause(); autoPaused = v; } }
          else resetToCover(v);
        } else if (v === heroVideo && autoPaused === v && !document.hidden) {
          autoPaused = null; v.play();
        }
      });
    }, {threshold: [0, 0.25]});
    document.querySelectorAll('video').forEach(function(v){ seen.observe(v); });
  }
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) {
      document.querySelectorAll('video').forEach(function(v){
        if (!v.paused) { v.pause(); if (v === heroVideo) autoPaused = v; }
      });
    } else if (autoPaused) {
      var r = autoPaused.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) { autoPaused.play(); autoPaused = null; }
    }
  });
  tabs.forEach(function(tab){       // a filter tab can hide the card that is playing
    tab.addEventListener('click', function(){
      document.querySelectorAll('#rail video').forEach(resetToCover);
    });
  });

  /* ---- sideways rows (spec work videos, gallery mosaic): chevrons show only when there's more that way ---- */
  var setupRow = function(row, prev, next){
    var update = function(){
      var max = row.scrollWidth - row.clientWidth;
      prev.hidden = row.scrollLeft <= 4;
      next.hidden = row.scrollLeft >= max - 4;
    };
    var step = function(dir){
      // one step = one card: a spec work video, or a photo in the gallery rows
      var card = row.querySelector('.vcard:not([hidden])') || row.querySelector('.mtile, .testi');
      var gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      var by = card ? card.offsetWidth + gap : row.clientWidth * 0.8;
      var max = row.scrollWidth - row.clientWidth;
      var target = Math.max(0, Math.min(max, Math.round(row.scrollLeft / by + dir) * by));
      // Chrome drops a smooth scroll that fights mandatory snapping,
      // so snapping is paused until the row lands on a card.
      row.style.scrollSnapType = 'none';
      void row.offsetWidth;   // apply it before scrolling
      var restore = function(){ row.style.scrollSnapType = ''; };
      if ('onscrollend' in window) row.addEventListener('scrollend', restore, {once:true});
      else setTimeout(restore, 700);
      row.scrollTo({left: target, behavior: reduced ? 'auto' : 'smooth'});
    };
    prev.addEventListener('click', function(){ step(-1); });
    next.addEventListener('click', function(){ step(1); });
    row.addEventListener('scroll', update, {passive:true});
    window.addEventListener('resize', update);
    update();
    return update;
  };
  var rail = document.getElementById('rail');
  if (rail) {
    var railWrap = rail.parentNode;
    var updateRail = setupRow(rail, railWrap.querySelector('.rail-prev'), railWrap.querySelector('.rail-next'));
    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){ rail.scrollLeft = 0; updateRail(); });
    });
  }
  var mosaic = document.getElementById('mosaic');
  if (mosaic) {
    var mcard = mosaic.parentNode;
    setupRow(mosaic, mcard.querySelector('.rail-prev'), mcard.querySelector('.rail-next'));
  }

  /* ---- gallery: photos tilt a little while scrolling, then float back straight ---- */
  if (mosaic && !reduced) {
    var tilt = 0, lastX = mosaic.scrollLeft, lastY = window.scrollY, ticking = false;
    var settle = function(){
      tilt *= 0.9;                                     // ease back to straight
      if (Math.abs(tilt) < 0.02) tilt = 0;
      mosaic.style.setProperty('--tilt', tilt.toFixed(3));
      ticking = tilt !== 0;
      if (ticking) requestAnimationFrame(settle);
    };
    var nudge = function(){
      var dx = mosaic.scrollLeft - lastX, dy = window.scrollY - lastY;
      lastX = mosaic.scrollLeft; lastY = window.scrollY;
      tilt = Math.max(-4, Math.min(4, tilt + (dx + dy * 0.5) * 0.06));   // at most 4 degrees
      if (!ticking) { ticking = true; requestAnimationFrame(settle); }
    };
    mosaic.addEventListener('scroll', nudge, {passive:true});
    window.addEventListener('scroll', nudge, {passive:true});
  }

  /* ---- brand logos: the row drifts slowly by itself and loops without an end. Scrolling or swiping it
     yourself takes over (the drift pauses, then picks up again 2s later); hovering pauses it so a logo can
     be read. Off for people who prefer reduced motion — they still get a scrollable row. ---- */
  var strip = document.querySelector('.logo-strip');
  if (strip && strip.children.length) {
    var originals = Array.prototype.slice.call(strip.children);
    var addSet = function(){
      originals.forEach(function(li){
        var c = li.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');          // screen readers hear each logo once
        c.querySelectorAll('img').forEach(function(img){ img.alt = ''; });
        strip.appendChild(c);
      });
    };
    var setWidth = 0, pos = 0, drifting = true, hovered = false, resumeTimer = null, lastT = 0;
    var SPEED = 26;                                      // pixels per second: slow
    var measure = function(){
      if (!strip.offsetWidth) return false;              // section switched off
      addSet();                                          // one copy so we can measure one full set
      setWidth = strip.children[originals.length].offsetLeft - strip.children[0].offsetLeft;
      while (strip.scrollWidth < setWidth * 3 + strip.clientWidth) addSet();
      pos = setWidth; strip.scrollLeft = pos;            // start one set in, so it can loop both ways
      return true;
    };
    var wrap = function(){                               // stay inside the middle copies: endless both ways
      if (pos >= setWidth * 2) pos -= setWidth;
      if (pos < setWidth * 0.5) pos += setWidth;
    };
    var tick = function(t){
      var dt = lastT ? Math.min(t - lastT, 100) : 0; lastT = t;
      if (drifting && !hovered) { pos += SPEED * dt / 1000; wrap(); strip.scrollLeft = pos; }
      requestAnimationFrame(tick);
    };
    var takeOver = function(){                           // the visitor scrolls: pause, resume after a moment
      drifting = false; pos = strip.scrollLeft;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function(){ drifting = true; }, 2000);
    };
    if (measure()) {
      strip.addEventListener('scroll', function(){     // a person scrolled: follow them (and keep it endless)
        if (drifting && !hovered) return;              // that was the drift itself
        pos = strip.scrollLeft; wrap();
        if (Math.abs(strip.scrollLeft - pos) > 1) strip.scrollLeft = pos;
      }, {passive:true});
      strip.addEventListener('wheel', function(e){      // only sideways scrolling takes over, not scrolling the page
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) takeOver();
      }, {passive:true});
      ['touchstart', 'pointerdown'].forEach(function(ev){ strip.addEventListener(ev, takeOver, {passive:true}); });
      strip.addEventListener('mouseenter', function(){ hovered = true; });
      strip.addEventListener('mouseleave', function(){ hovered = false; });
      if (!reduced) requestAnimationFrame(tick);
    }
  }

  /* ---- case studies: the pills switch which campaign report is shown (without JS all reports show,
     one under the other). A report that gets hidden stops its video via the off-screen rule above. ---- */
  var caseTabs = Array.prototype.slice.call(document.querySelectorAll('.case-tab'));
  var showCase = function(tab, focus){
    caseTabs.forEach(function(t){
      var on = t === tab, panel = document.getElementById(t.getAttribute('aria-controls'));
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  };
  if (caseTabs.length > 1) {
    showCase(caseTabs[0], false);
    caseTabs.forEach(function(tab, i){
      tab.addEventListener('click', function(){ showCase(tab, false); });
      tab.addEventListener('keydown', function(e){          // arrow keys move between the pills
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); showCase(caseTabs[(i + d + caseTabs.length) % caseTabs.length], true); }
      });
    });
  }

  /* ---- testimonials: arrows + dots when there are more reviews than fit, and "Read more" on long quotes ---- */
  var testiRow = document.getElementById('testi-row');
  if (testiRow) {
    var testiRail = testiRow.parentNode;
    var updateTestiArrows = setupRow(testiRow, testiRail.querySelector('.rail-prev'), testiRail.querySelector('.rail-next'));
    var testis = Array.prototype.slice.call(testiRow.querySelectorAll('.testi'));
    var dotsBox = document.querySelector('.testi-dots');
    var drawDots = function(){                       // one dot per review, only when the row actually scrolls
      if (!dotsBox) return;
      var scrolls = testiRow.scrollWidth > testiRow.clientWidth + 4;
      dotsBox.innerHTML = '';
      if (!scrolls) return;
      testis.forEach(function(){ dotsBox.appendChild(document.createElement('span')); });
      markDot();
    };
    var markDot = function(){
      if (!dotsBox || !dotsBox.children.length) return;
      var max = testiRow.scrollWidth - testiRow.clientWidth;
      var i = testiRow.scrollLeft >= max - 4 ? testis.length - 1      // at the end: the last dot
            : Math.round(testiRow.scrollLeft / (testis[0].offsetWidth + (parseFloat(getComputedStyle(testiRow).columnGap) || 0)));
      Array.prototype.forEach.call(dotsBox.children, function(d, n){ d.classList.toggle('on', n === i); });
    };
    var checkLong = function(){                      // show "Read more" only where a quote is actually cut off
      testis.forEach(function(card){
        var q = card.querySelector('blockquote'), more = card.querySelector('.testi-more');
        if (!q || !more || card.classList.contains('open')) return;
        more.hidden = q.scrollHeight <= q.clientHeight + 2;
      });
    };
    testis.forEach(function(card){
      var more = card.querySelector('.testi-more');
      if (!more) return;
      more.addEventListener('click', function(){
        var open = card.classList.toggle('open');
        more.textContent = open ? 'Show less' : 'Read more';
        more.setAttribute('aria-expanded', String(open));
      });
    });
    testiRow.addEventListener('scroll', markDot, {passive:true});
    var equalise = function(){                     // every card as tall as the tallest closed card
      testiRow.style.setProperty('--testi-h', '0px');
      var tallest = 0;
      testis.forEach(function(card){ if (!card.classList.contains('open')) tallest = Math.max(tallest, card.offsetHeight); });
      testiRow.style.setProperty('--testi-h', tallest + 'px');
    };
    var refreshTesti = function(){ drawDots(); checkLong(); equalise(); updateTestiArrows(); };
    window.addEventListener('resize', refreshTesti);
    window.addEventListener('load', refreshTesti);   // fonts can change line counts once loaded
    refreshTesti();
  }

  /* ---- gallery: open a photo larger ---- */
  var lb = document.getElementById('lightbox');
  if (lb && lb.showModal) {
    var lbImg = lb.querySelector('img'), lbName = lb.querySelector('.lightbox-name');
    document.querySelectorAll('.mtile-link').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        lbImg.src = a.href;
        lbImg.alt = a.querySelector('img').alt;
        lbName.textContent = a.querySelector('.mtile-name').textContent;
        lb.showModal();
      });
    });
    lb.querySelector('.lightbox-close').addEventListener('click', function(){ lb.close(); });
    lb.addEventListener('click', function(e){ if (e.target === lb) lb.close(); });   // click outside the photo
  }

  /* ---- offer cards: "Get a quote" opens a small popup with the copy-email box ---- */
  var quote = document.getElementById('quote');
  if (quote && quote.showModal) {
    var quoteName = quote.querySelector('[data-quote-name]');
    document.querySelectorAll('[data-quote]').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        quoteName.textContent = '“' + a.getAttribute('data-quote') + '”';
        quote.showModal();
      });
    });
    quote.querySelector('.lightbox-close').addEventListener('click', function(){ quote.close(); });
    quote.addEventListener('click', function(e){     // close only on clicks outside the box
      var r = quote.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) quote.close();
    });
  }

  /* ---- "Send me your brief" (header + footer): a small popup with the copy-email box ---- */
  var brief = document.getElementById('brief');
  if (brief && brief.showModal) {
    document.querySelectorAll('[data-brief]').forEach(function(a){
      a.addEventListener('click', function(e){ e.preventDefault(); brief.showModal(); });
    });
    brief.querySelector('.lightbox-close').addEventListener('click', function(){ brief.close(); });
    brief.addEventListener('click', function(e){     // close only on clicks outside the box
      var r = brief.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) brief.close();
    });
  }

  /* ---- copy email (every .mailbox on the page) ---- */
  document.querySelectorAll('.mailbox').forEach(function(box){
    var copy = box.querySelector('[data-copy]');
    var mail = box.querySelector('[data-mail]');
    if (!copy || !mail) return;
    copy.addEventListener('click', function(){
      var txt = mail.textContent.trim();
      var done = function(){
        copy.textContent = 'Copied';
        copy.classList.add('done');
        setTimeout(function(){ copy.textContent = 'Copy'; copy.classList.remove('done'); }, 1800);
      };
      // older copy method: still works where the modern one is blocked, e.g. when the page is embedded
      // in Notion (pages shown inside another site may not use the clipboard the modern way)
      var legacyCopy = function(){
        var ta = document.createElement('textarea');
        ta.value = txt; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch(e) {}
        ta.remove();
        return ok;
      };
      // last resort: select the address and ask for the keyboard shortcut
      var select = function(){
        var r = document.createRange();
        r.selectNodeContents(mail);
        var sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(r);
        copy.textContent = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'Press ⌘C' : 'Press Ctrl+C';
        setTimeout(function(){ copy.textContent = 'Copy'; }, 2500);
      };
      var embedded = window.self !== window.top;   // shown inside Notion or another site
      if (embedded && legacyCopy()) { done(); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(done).catch(function(){ if (legacyCopy()) done(); else select(); });
      } else if (legacyCopy()) { done(); } else { select(); }
    });
  });

  /* ---- theme toggle ---- */
  var root = document.documentElement;
  var toggle = document.getElementById('theme');
  var stored = null;
  try { stored = localStorage.getItem('yvo-theme'); } catch(e){}
  if (stored === 'dark' || stored === 'light') root.setAttribute('data-theme', stored);
  toggle.addEventListener('click', function(){
    var isDark = root.getAttribute('data-theme') === 'dark' ||
      (!root.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('yvo-theme', next); } catch(e){}
  });
})();
