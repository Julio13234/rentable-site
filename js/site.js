/* Rentable: movimento do site e lista de espera. Sem dependências além do Lenis (rolagem suave). */
(function () {
  'use strict';
  window.__rentableReady = true;

  // Função do Supabase que grava a lista de espera (supabase/functions/lista-de-espera).
  var WAITLIST_URL = 'https://onxdtjqsaqpoxtnqudzf.supabase.co/functions/v1/lista-de-espera';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var introShown = !root.classList.contains('no-intro');
  var introDelay = introShown ? 1200 : 0;
  var modalOpen = false;

  var $ = function (sel, el) {
    return (el || document).querySelector(sel);
  };
  var $$ = function (sel, el) {
    return Array.prototype.slice.call((el || document).querySelectorAll(sel));
  };
  var clamp = function (v, min, max) {
    return Math.min(max, Math.max(min, v));
  };
  var lerp = function (a, b, t) {
    return a + (b - a) * t;
  };
  var easeInOut = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  var easeOut = function (t) {
    return 1 - Math.pow(1 - t, 3);
  };
  var escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // ---------- Abertura: vista uma vez por visita ----------
  if (introShown) {
    try {
      sessionStorage.setItem('rentable.abertura', '1');
    } catch (e) {}
    setTimeout(function () {
      var intro = $('.intro');
      if (intro) intro.remove();
    }, 2300);
  }

  // Barra de status em todos os celulares (escrita uma vez no primeiro, copiada nos outros).
  var statusTemplate = $('.phone .status');
  if (statusTemplate) {
    $$('.phone-screen').forEach(function (screen) {
      if (!$('.status', screen))
        screen.insertBefore(statusTemplate.cloneNode(true), screen.firstChild);
    });
  }

  // ---------- Rolagem suave (computador) ----------
  var lenis = null;
  if (!reduce && finePointer && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    var lenisFrame = function (t) {
      lenis.raf(t);
      requestAnimationFrame(lenisFrame);
    };
    requestAnimationFrame(lenisFrame);
  }
  $$('a[href*="#"]').forEach(function (a) {
    if (a.hasAttribute('data-open-waitlist')) return;
    a.addEventListener('click', function (e) {
      var url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      var target = document.querySelector(url.hash);
      if (!target || !lenis) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: url.hash === '#topo' ? 0 : -80 });
    });
  });

  // Troca de página: onde o navegador não anima sozinho, a página sai com um esmaecer.
  var nativeTransitions = 'onpagereveal' in window;
  if (!nativeTransitions && !reduce) {
    $$('a[href^="/"]').forEach(function (a) {
      if (a.hasAttribute('data-open-waitlist')) return;
      a.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        var url = new URL(a.href, location.href);
        if (url.pathname === location.pathname) return;
        e.preventDefault();
        document.body.style.transition = 'opacity 0.22s ease';
        document.body.style.opacity = '0';
        setTimeout(function () {
          location.href = a.href;
        }, 200);
      });
    });
    window.addEventListener('pageshow', function () {
      document.body.style.opacity = '';
    });
  }

  // ---------- Títulos palavra por palavra ----------
  $$('[data-split]').forEach(function (h) {
    var words = h.textContent.trim().split(/\s+/);
    h.textContent = '';
    words.forEach(function (word, i) {
      var outer = document.createElement('span');
      var inner = document.createElement('span');
      outer.className = 'w';
      inner.textContent = word;
      inner.style.setProperty('--wi', i);
      outer.appendChild(inner);
      h.appendChild(outer);
      if (i < words.length - 1) h.appendChild(document.createTextNode(' '));
    });
  });

  // Frase do manifesto: cada palavra vira um pedaço que acende com a rolagem.
  var statement = $('[data-statement]');
  var statementWords = [];
  if (statement) {
    var para = $('p', statement);
    var nodes = Array.prototype.slice.call(para.childNodes);
    para.textContent = '';
    nodes.forEach(function (node) {
      var strong = node.nodeType === 1;
      node.textContent.split(/(\s+)/).forEach(function (piece) {
        if (!piece) return;
        if (/^\s+$/.test(piece)) {
          para.appendChild(document.createTextNode(' '));
          return;
        }
        var span = document.createElement('span');
        span.className = 'word' + (strong ? ' is-strong' : '');
        span.textContent = piece;
        para.appendChild(span);
        statementWords.push({ el: span, o: -1 });
      });
    });
  }

  // ---------- Blocos que entram ao aparecer ----------
  var reveals = $$('[data-reveal], [data-split]');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) {
      el.classList.add('is-in');
    });
  } else {
    var revealer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          revealer.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.01 },
    );
    reveals.forEach(function (el) {
      revealer.observe(el);
    });
  }

  // ---------- Topo: some ao descer, volta ao subir; menu do celular ----------
  var nav = $('[data-nav]');
  var menu = $('[data-menu]');
  var menuToggle = $('[data-menu-toggle]');
  var lastY = window.scrollY;
  var menuOpen = false;
  var updateNav = function (y) {
    var delta = y - lastY;
    lastY = y;
    nav.classList.toggle('is-scrolled', y > 20);
    if (y < 160 || delta < -2 || menuOpen) nav.classList.remove('is-hidden');
    else if (delta > 2 && !modalOpen) nav.classList.add('is-hidden');
  };
  var setMenu = function (open) {
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    root.classList.toggle('modal-open', open);
    if (lenis) {
      if (open) lenis.stop();
      else lenis.start();
    }
  };
  if (menu && menuToggle) {
    menuToggle.addEventListener('click', function () {
      setMenu(!menuOpen);
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () {
        setMenu(false);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) setMenu(false);
    });
  }

  // ---------- Partículas de luz no fundo ----------
  var canvas = $('[data-stars]');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var stars = [];
  var sw = 0;
  var sh = 0;
  var boost = 0;
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var buildStars = function () {
    if (!ctx) return;
    sw = window.innerWidth;
    sh = window.innerHeight;
    canvas.width = Math.round(sw * dpr);
    canvas.height = Math.round(sh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = sw < 700 ? 55 : 120;
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * sw,
        y: Math.random() * sh,
        r: 0.4 + Math.random() * 1.5,
        a: 0.25 + Math.random() * 0.6,
        s: 0.06 + Math.random() * 0.3,
        ph: Math.random() * Math.PI * 2,
        d: 0.2 + Math.random() * 0.8,
      });
    }
  };
  var drawStars = function (time, mx, my) {
    if (!ctx) return;
    ctx.clearRect(0, 0, sw, sh);
    for (var i = 0; i < stars.length; i++) {
      var p = stars[i];
      if (!reduce) {
        p.y -= p.s * (1 + boost);
        if (p.y < -6) {
          p.y = sh + 6;
          p.x = Math.random() * sw;
        }
      }
      var twinkle = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(time * 0.0016 + p.ph);
      var x = p.x + mx * p.d * 16;
      var y = p.y + my * p.d * 12;
      ctx.globalAlpha = p.a * twinkle;
      ctx.fillStyle = '#ffeef2';
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.r > 1.45) {
        ctx.globalAlpha = p.a * twinkle * 0.18;
        ctx.beginPath();
        ctx.arc(x, y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };
  buildStars();
  window.addEventListener('resize', buildStars);

  // ---------- Mouse: brilho que acompanha, etiquetas com profundidade, botões que puxam ----------
  var pointer = { x: 0, y: 0, cx: -999, cy: -999 };
  var smooth = { x: 0, y: 0, cx: -999, cy: -999 };
  var glow = $('[data-cursor]');
  if (finePointer && !reduce) {
    window.addEventListener('pointermove', function (e) {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      pointer.cx = e.clientX;
      pointer.cy = e.clientY;
      if (smooth.cx < -900) {
        smooth.cx = e.clientX;
        smooth.cy = e.clientY;
      }
    });
    $$('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.setProperty('--mgx', (dx * 6).toFixed(1) + 'px');
        el.style.setProperty('--mgy', (dy * 5).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--mgx', '0px');
        el.style.setProperty('--mgy', '0px');
      });
    });
  } else if (glow) {
    glow.remove();
    glow = null;
  }

  // Abertura: avisos chegando no celular da cena; valores das etiquetas contando.
  if (!reduce) {
    $$('[data-count]').forEach(function (el, i) {
      var target = Number(el.getAttribute('data-count')) / 100;
      el.textContent = money.format(0);
      setTimeout(
        function () {
          var start = performance.now();
          var step = function (now) {
            var t = clamp((now - start) / 1100, 0, 1);
            el.textContent = money.format(target * easeOut(t));
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        },
        introDelay + 1500 + i * 400,
      );
    });
  }

  // ---------- Carrossel das telas: setas, pontinhos, arrastar, teclado; passa sozinho ----------
  var carousel = $('[data-carousel]');
  if (carousel) {
    var track = $('[data-track]', carousel);
    var stage = $('.carousel', carousel);
    var slides = $$('.slide', track);
    var dotsWrap = $('[data-car-dots]', carousel);
    var active = 0;
    var autoTimer = null;
    var inView = false;
    var drag = null;
    var settleTimer = null;
    var aimTimer = null;
    var aimed = -1;
    var ticking = false;

    var centerOf = function (i) {
      var sl = slides[i];
      return sl.offsetLeft + sl.offsetWidth / 2 - track.clientWidth / 2;
    };
    var dots = slides.map(function (sl, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Tela ' + (i + 1) + ': ' + $('h3', sl).textContent);
      b.addEventListener('click', function () {
        goTo(i);
      });
      dotsWrap.appendChild(b);
      return b;
    });
    var markActive = function (i) {
      active = i;
      dots.forEach(function (d, j) {
        d.setAttribute('aria-current', j === i ? 'true' : 'false');
      });
    };
    // Lê a posição: a tela mais perto do meio é a atual; as outras ficam menores e apagadas.
    var readTrack = function () {
      ticking = false;
      var mid = track.scrollLeft + track.clientWidth / 2;
      var best = 0;
      var bestDist = Infinity;
      slides.forEach(function (sl, i) {
        var center = sl.offsetLeft + sl.offsetWidth / 2;
        var dist = Math.abs(center - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
        var focus = 1 - clamp(dist / (sl.offsetWidth * 1.05), 0, 1);
        sl.style.setProperty('--focus', focus.toFixed(3));
        sl.classList.toggle('is-focus', focus > 0.82);
      });
      // Enquanto anda até a tela escolhida, os pontinhos ficam nela (não piscam no caminho).
      if (aimed < 0 && best !== active) markActive(best);
    };
    var scrollToSlide = function (target) {
      aimed = target;
      markActive(target);
      clearTimeout(aimTimer);
      aimTimer = setTimeout(function () {
        aimed = -1;
      }, 900);
      track.scrollTo({ left: centerOf(target), behavior: reduce ? 'auto' : 'smooth' });
    };
    var goTo = function (i, fromAuto) {
      var n = slides.length;
      scrollToSlide(((i % n) + n) % n);
      if (!fromAuto) restartAuto();
    };
    var stopAuto = function () {
      clearTimeout(autoTimer);
      autoTimer = null;
    };
    // Espera parada quando o mouse está em cima ou o teclado está nele (perguntado na hora,
    // para não depender de eventos de entrar e sair).
    var paused = function () {
      return (finePointer && stage.matches(':hover')) || !!carousel.querySelector(':focus-visible');
    };
    var restartAuto = function () {
      stopAuto();
      if (reduce || !inView || drag || document.hidden) return;
      autoTimer = setTimeout(function () {
        if (!paused()) goTo(active + 1, true);
        restartAuto();
      }, 5500);
    };

    $('[data-car-prev]', carousel).addEventListener('click', function () {
      goTo(active - 1);
    });
    $('[data-car-next]', carousel).addEventListener('click', function () {
      goTo(active + 1);
    });
    track.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      goTo(active + (e.key === 'ArrowRight' ? 1 : -1));
    });
    track.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(readTrack);
      },
      { passive: true },
    );

    // Arrastar com o mouse (no toque, o próprio navegador desliza e encaixa).
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: track.scrollLeft, moved: 0, from: active };
      clearTimeout(settleTimer);
      track.style.scrollSnapType = 'none';
      track.classList.add('is-dragging');
      track.setPointerCapture(e.pointerId);
      stopAuto();
    });
    track.addEventListener('pointermove', function (e) {
      if (!drag) return;
      drag.moved = e.clientX - drag.x;
      track.scrollLeft = drag.left - drag.moved;
    });
    var endDrag = function () {
      if (!drag) return;
      var d = drag;
      drag = null;
      track.classList.remove('is-dragging');
      var target = active;
      if (Math.abs(d.moved) > 50 && target === d.from) target = d.from + (d.moved < 0 ? 1 : -1);
      scrollToSlide(clamp(target, 0, slides.length - 1));
      settleTimer = setTimeout(function () {
        track.style.scrollSnapType = '';
      }, 650);
      restartAuto();
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('dragstart', function (e) {
      e.preventDefault();
    });

    // Ao sair com o mouse ou o foco, conta o tempo de novo antes de passar; fora da tela, para.
    stage.addEventListener('pointerleave', restartAuto);
    carousel.addEventListener('focusout', restartAuto);
    document.addEventListener('visibilitychange', restartAuto);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        function (entries) {
          inView = entries[0].isIntersecting;
          restartAuto();
        },
        { threshold: 0.45 },
      ).observe(track);
    }
    window.addEventListener('resize', function () {
      track.scrollTo({ left: centerOf(active), behavior: 'auto' });
      readTrack();
    });
    markActive(0);
    readTrack();
  }

  // ---------- Problema → solução ----------
  var scene = $('[data-scene]');
  var arena = scene && $('.arena', scene);
  if (scene && !reduce) scene.classList.add('is-live');

  // ---------- Passeio pelo app (funcionalidades) ----------
  var steps = $$('.step');
  var storyGrid = $('.story-grid');
  var storyPhone = $('[data-story-phone]');
  var storyTilt = $('[data-story-tilt]');
  var railFill = $('[data-rail-fill]');
  var current = -1;
  if (steps.length && storyPhone && 'IntersectionObserver' in window) {
    var layers = $$('.layer', storyPhone);
    var chips = $$('.chip');
    var dots = $$('.dots li');
    var sequence = null;
    var show = function (i) {
      if (i === current) return;
      current = i;
      clearTimeout(sequence);
      steps.forEach(function (s, j) {
        s.classList.toggle('is-active', j === i);
      });
      dots.forEach(function (d, j) {
        d.classList.toggle('is-active', j === i);
        d.classList.toggle('is-seen', j < i);
      });
      chips.forEach(function (c) {
        c.classList.toggle('is-active', Number(c.getAttribute('data-for')) === i);
      });
      var first = null;
      var then = null;
      layers.forEach(function (l) {
        var f = Number(l.getAttribute('data-for'));
        if (f === i && l.hasAttribute('data-first')) first = l;
        if (f === i && l.hasAttribute('data-then')) then = l;
      });
      layers.forEach(function (l) {
        var f = Number(l.getAttribute('data-for'));
        l.classList.toggle('is-active', f === i && (!first || l === first));
        l.classList.toggle('is-before', f < i);
      });
      if (first && then) {
        sequence = setTimeout(
          function () {
            first.classList.remove('is-active');
            first.classList.add('is-before');
            then.classList.add('is-active');
          },
          reduce ? 0 : 1700,
        );
      }
    };
    var stepObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) show(Number(e.target.getAttribute('data-step')));
        });
      },
      { rootMargin: '-48% 0px -48% 0px' },
    );
    steps.forEach(function (s) {
      stepObserver.observe(s);
    });
    show(0);
  }

  // ---------- Um quadro por vez: tudo o que depende da rolagem e do mouse ----------
  var hero = $('[data-hero]');
  var heroVisual = $('[data-hero-visual]');
  var lastFrameY = window.scrollY;
  var frame = function (time) {
    var y = window.scrollY;
    var vh = window.innerHeight;

    // Leituras.
    var heroH = hero ? hero.offsetHeight : 1;
    var statementRect = statement ? statement.getBoundingClientRect() : null;
    var sceneRect = scene ? scene.getBoundingClientRect() : null;
    var storyRect = storyGrid ? storyGrid.getBoundingClientRect() : null;
    var stepRect = current >= 0 && steps[current] ? steps[current].getBoundingClientRect() : null;

    updateNav(y);

    // Partículas mais rápidas quando a página rola depressa.
    var speed = Math.abs(y - lastFrameY);
    lastFrameY = y;
    boost = lerp(boost, Math.min(speed / 10, 5), 0.08);
    smooth.x = lerp(smooth.x, pointer.x, 0.06);
    smooth.y = lerp(smooth.y, pointer.y, 0.06);
    drawStars(time, smooth.x, smooth.y);

    if (glow) {
      smooth.cx = lerp(smooth.cx, pointer.cx, 0.12);
      smooth.cy = lerp(smooth.cy, pointer.cy, 0.12);
      glow.style.setProperty('--cx', smooth.cx.toFixed(1) + 'px');
      glow.style.setProperty('--cy', smooth.cy.toFixed(1) + 'px');
    }

    // Abertura: a logo cresce e some, os celulares se afastam, o feixe acende.
    if (hero) {
      var t = clamp(y / (heroH * 0.9), 0, 1);
      hero.style.setProperty('--t', t.toFixed(4));
      if (heroVisual) {
        heroVisual.style.setProperty('--mx', smooth.x.toFixed(3));
        heroVisual.style.setProperty('--my', smooth.y.toFixed(3));
      }
    }

    // Manifesto: as palavras acendem conforme a frase passa pela tela.
    if (statementRect && statementWords.length && !reduce) {
      var started = vh * 0.85 - statementRect.top;
      var left = statementRect.bottom - vh * 0.5;
      var sp = clamp(started / Math.max(1, started + left), 0, 1);
      for (var w = 0; w < statementWords.length; w++) {
        var o = clamp(sp * (statementWords.length + 2) - w, 0, 1);
        o = Math.round((0.16 + o * 0.84) * 100) / 100;
        if (o !== statementWords[w].o) {
          statementWords[w].o = o;
          statementWords[w].el.style.setProperty('--o', o);
        }
      }
    }

    // Cena: os problemas são riscados, os papéis entram no celular, o celular "fecha a conta".
    if (sceneRect && arena && scene.classList.contains('is-live')) {
      var total = sceneRect.height - vh;
      var p = total > 0 ? clamp(-sceneRect.top / total, 0, 1) : 1;
      var k = 1 - easeInOut(clamp((p - 0.1) / 0.5, 0, 1));
      arena.style.setProperty('--k', k.toFixed(4));
      scene.style.setProperty('--p', p.toFixed(4));
      for (var s = 0; s < 3; s++) {
        var sv = clamp((p - (0.12 + s * 0.11)) / 0.1, 0, 1);
        scene.style.setProperty('--s' + s, sv.toFixed(3));
      }
      scene.classList.toggle('is-solved', p > 0.56);
      arena.classList.toggle('is-full', p > 0.62);
    }

    // Passeio: o celular gira de leve dentro de cada trecho; a linha lateral acompanha.
    if (storyRect && storyTilt) {
      var stp = clamp((vh * 0.5 - storyRect.top) / storyRect.height, 0, 1);
      if (railFill) railFill.style.setProperty('--rail', stp.toFixed(4));
      if (stepRect) {
        var local = clamp((vh * 0.5 - stepRect.top) / stepRect.height, 0, 1) - 0.5;
        storyTilt.style.setProperty('--sry', (local * -12).toFixed(2) + 'deg');
        storyTilt.style.setProperty('--srx', (local * 5).toFixed(2) + 'deg');
      }
    }
  };

  if (reduce) {
    var still = function () {
      updateNav(window.scrollY);
      drawStars(0, 0, 0);
    };
    window.addEventListener('scroll', still, { passive: true });
    window.addEventListener('resize', still);
    still();
  } else {
    var loop = function (time) {
      if (!document.hidden) frame(time);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---------- Antes e depois: as linhas entram uma a uma ----------
  var table = $('.compare-table');
  if (table && !reduce && 'IntersectionObserver' in window) {
    table.classList.add('is-waiting');
    var rows = $$('tbody tr', table);
    var rowObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var i = rows.indexOf(e.target);
          setTimeout(
            function () {
              e.target.classList.add('is-in');
            },
            (i % 3) * 110,
          );
          rowObserver.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    rows.forEach(function (r) {
      rowObserver.observe(r);
    });
  }

  // ---------- Dúvidas: abrem e fecham com altura animada ----------
  $$('.faq-list details').forEach(function (d) {
    var summary = $('summary', d);
    var answer = $('.answer', d);
    summary.addEventListener('click', function (e) {
      if (reduce || !d.animate) return;
      e.preventDefault();
      if (d.getAttribute('data-moving')) return;
      d.setAttribute('data-moving', '1');
      var from = d.offsetHeight;
      var opening = !d.open;
      if (opening) d.open = true;
      var to = opening ? d.offsetHeight : summary.offsetHeight;
      var anim = d.animate(
        { height: [from + 'px', to + 'px'] },
        { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
      if (opening) {
        answer.animate(
          [
            { opacity: 0, transform: 'translateY(-8px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
      }
      anim.onfinish = function () {
        if (!opening) d.open = false;
        d.removeAttribute('data-moving');
      };
    });
  });

  // Copiar o e-mail de contato.
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var label = b.textContent;
      var done = function () {
        b.textContent = 'Copiado!';
        setTimeout(function () {
          b.textContent = label;
        }, 2000);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
      else done();
    });
  });

  // ---------- Lista de espera ----------
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var TITLES = { android: 'Em breve no Google Play', ios: 'Em breve na App Store' };
  var WHERE = { android: 'ao Google Play', ios: 'à App Store' };
  var GENERIC_ERROR =
    'Não deu para registrar agora. Confira sua internet e tente de novo, ou escreva para contato@rentable.com.br.';
  var guessPlatform = function () {
    var ua = navigator.userAgent;
    var apple =
      /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    return apple ? 'ios' : 'android';
  };
  var saved = function () {
    try {
      return JSON.parse(localStorage.getItem('rentable.lista') || 'null');
    } catch (e) {
      return null;
    }
  };
  var remember = function (email, platform) {
    try {
      var s = saved() || { email: email, platforms: [] };
      if (s.email !== email) s = { email: email, platforms: [] };
      if (s.platforms.indexOf(platform) === -1) s.platforms.push(platform);
      localStorage.setItem('rentable.lista', JSON.stringify(s));
    } catch (e) {}
  };
  var postJson = function (url, payload, fallback) {
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, 12000);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            return res.ok && body && body.ok
              ? { ok: true }
              : { ok: false, error: (body && body.error) || fallback, field: body && body.field };
          });
      })
      .catch(function () {
        return { ok: false, error: fallback };
      })
      .then(function (r) {
        clearTimeout(timer);
        return r;
      });
  };
  var submitWaitlist = function (payload) {
    return postJson(WAITLIST_URL, payload, GENERIC_ERROR);
  };

  // Formulário curto (abertura e chamada final).
  var inlineDone = function (wrap, email, already) {
    wrap.innerHTML =
      '<div class="inline-done" role="status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg><span>' +
      (already ? 'Você já está na lista com ' : 'Pronto! Avisamos em ') +
      escapeHtml(email) +
      (already ? '.' : ' quando o app chegar.') +
      '</span></div>';
  };
  $$('[data-inline-waitlist]').forEach(function (form) {
    var wrap = form.closest('[data-inline-wrap]');
    var msg = $('[data-inline-msg]', wrap);
    var button = $('button', form);
    var input = form.elements.email;
    var s = saved();
    if (s && s.email) {
      inlineDone(wrap, s.email, true);
      return;
    }
    input.addEventListener('input', function () {
      msg.textContent = '';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim().toLowerCase();
      if (email.length > 254 || !EMAIL.test(email)) {
        msg.textContent = 'Digite um e-mail válido, como nome@exemplo.com.';
        form.classList.remove('is-invalid');
        void form.offsetWidth;
        form.classList.add('is-invalid');
        input.focus();
        return;
      }
      var platform = guessPlatform();
      msg.textContent = '';
      button.classList.add('is-loading');
      button.disabled = true;
      submitWaitlist({
        email: email,
        plataforma: platform,
        novidades: false,
        empresa: form.elements.empresa.value,
      }).then(function (r) {
        button.classList.remove('is-loading');
        button.disabled = false;
        if (r.ok) {
          remember(email, platform);
          inlineDone(wrap, email, false);
        } else {
          msg.textContent = r.error;
        }
      });
    });
  });

  // Janela da lista de espera (aberta pelos botões das lojas e "Baixar o app").
  var dialog = document.createElement('dialog');
  dialog.className = 'waitlist';
  dialog.setAttribute('aria-labelledby', 'lista-titulo');
  dialog.innerHTML =
    '<div class="waitlist-card">' +
    '<button class="waitlist-close" type="button" aria-label="Fechar" data-waitlist-close><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>' +
    '<form class="waitlist-step" data-waitlist-form novalidate>' +
    '<div class="waitlist-icon" aria-hidden="true"><img src="/assets/icone-512.png" alt="" width="512" height="512" />' +
    '<span class="waitlist-badge" data-badge="android"><svg viewBox="0 0 24 24">' +
    '<path fill="#4285F4" d="M3.6 2.2 13.4 12 3.6 21.8c-.4-.3-.6-.8-.6-1.4V3.6c0-.6.2-1.1.6-1.4z" />' +
    '<path fill="#34A853" d="M3.6 2.2c.4-.3 1-.3 1.6 0l11.3 6.4L13.4 12z" />' +
    '<path fill="#EA4335" d="M3.6 21.8 13.4 12l3.1 3.4-11.3 6.4c-.6.3-1.2.3-1.6 0z" />' +
    '<path fill="#FBBC04" d="m16.5 8.6 3.6 2c1.2.7 1.2 2.1 0 2.8l-3.6 2L13.4 12z" /></svg></span>' +
    '<span class="waitlist-badge" data-badge="ios"><svg viewBox="0 0 24 24"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" /></svg></span></div>' +
    '<h2 id="lista-titulo" data-waitlist-title>O Rentable chega no início de 2027</h2>' +
    '<p class="waitlist-lede">Deixe seu e-mail e avisamos assim que o app estiver disponível para baixar. É grátis para 1 imóvel alugado.</p>' +
    '<fieldset class="waitlist-platforms"><legend>Onde você vai usar</legend>' +
    '<label><input type="radio" name="plataforma" value="android" checked /><span>Android</span></label>' +
    '<label><input type="radio" name="plataforma" value="ios" /><span>iPhone</span></label></fieldset>' +
    '<label class="waitlist-field"><span>Seu e-mail</span><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="nome@exemplo.com" required maxlength="254" aria-describedby="lista-erro" /></label>' +
    '<p class="waitlist-error" id="lista-erro" data-waitlist-error aria-live="polite"></p>' +
    '<label class="waitlist-check"><input type="checkbox" name="novidades" /><span>Quero receber também dicas e novidades do Rentable.</span></label>' +
    '<div class="hp" aria-hidden="true"><label>Empresa <input type="text" name="empresa" tabindex="-1" autocomplete="off" /></label></div>' +
    '<button class="btn-bordo waitlist-submit" type="submit" data-waitlist-submit><span>Me avise no lançamento</span><i class="spinner" aria-hidden="true"></i></button>' +
    '<p class="waitlist-legal">Usamos seu e-mail só para avisar do lançamento (e para as novidades, se você marcar). Para sair da lista, escreva para contato@rentable.com.br. Veja a <a href="/privacidade/#lista">Política de privacidade</a>.</p>' +
    '</form>' +
    '<div class="waitlist-step waitlist-done" data-waitlist-done hidden>' +
    '<div class="done-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" /><path d="M19 33l9 9 17-18" /></svg><span class="burst"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></div>' +
    '<h2 tabindex="-1" data-done-title>Pronto, você está na lista!</h2>' +
    '<p data-done-text>Avisamos por e-mail assim que o Rentable chegar às lojas.</p>' +
    '<button class="btn-bordo" type="button" data-waitlist-close>Fechar</button>' +
    '<button class="linklike" type="button" data-waitlist-again>Cadastrar outro e-mail</button>' +
    '</div></div>';
  document.body.appendChild(dialog);

  var form = $('[data-waitlist-form]', dialog);
  var done = $('[data-waitlist-done]', dialog);
  var title = $('[data-waitlist-title]', dialog);
  var errorEl = $('[data-waitlist-error]', dialog);
  var submit = $('[data-waitlist-submit]', dialog);
  var doneTitle = $('[data-done-title]', dialog);
  var doneText = $('[data-done-text]', dialog);
  var emailInput = form.elements.email;
  var field = emailInput.closest('.waitlist-field');
  var lastTrigger = null;

  var setPlatform = function (platform) {
    dialog.setAttribute('data-platform', platform);
    title.textContent = TITLES[platform];
    var radio = form.querySelector('input[name="plataforma"][value="' + platform + '"]');
    if (radio) radio.checked = true;
  };
  var showForm = function () {
    done.hidden = true;
    form.hidden = false;
    errorEl.textContent = '';
    field.classList.remove('is-invalid');
  };
  var showDone = function (email, platform, already) {
    form.hidden = true;
    done.hidden = false;
    doneTitle.textContent = already ? 'Você já está na lista' : 'Pronto, você está na lista!';
    doneText.textContent =
      'Avisamos em ' + email + ' assim que o Rentable chegar ' + WHERE[platform] + '.';
    doneTitle.focus();
  };
  var openWaitlist = function (platform, trigger) {
    lastTrigger = trigger || null;
    if (menuOpen) setMenu(false);
    setPlatform(platform || guessPlatform());
    var s = saved();
    var mine = dialog.getAttribute('data-platform');
    if (s && s.platforms && s.platforms.indexOf(mine) !== -1) {
      showDone(s.email, mine, true);
    } else {
      showForm();
      if (s && s.email && !emailInput.value) emailInput.value = s.email;
    }
    dialog.classList.remove('is-closing');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    root.classList.add('modal-open');
    modalOpen = true;
    if (lenis) lenis.stop();
    if (!form.hidden) {
      setTimeout(function () {
        emailInput.focus();
      }, 60);
    } else {
      doneTitle.focus();
    }
  };
  var closeWaitlist = function () {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    dialog.classList.add('is-closing');
    setTimeout(
      function () {
        dialog.classList.remove('is-closing');
        if (typeof dialog.close === 'function') dialog.close();
        else {
          dialog.removeAttribute('open');
          dialog.dispatchEvent(new Event('close'));
        }
      },
      reduce ? 0 : 280,
    );
  };
  dialog.addEventListener('close', function () {
    root.classList.remove('modal-open');
    modalOpen = false;
    if (lenis) lenis.start();
    if (lastTrigger) lastTrigger.focus();
  });
  dialog.addEventListener('cancel', function (e) {
    e.preventDefault();
    closeWaitlist();
  });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeWaitlist();
  });
  $$('[data-waitlist-close]', dialog).forEach(function (b) {
    b.addEventListener('click', closeWaitlist);
  });
  $('[data-waitlist-again]', dialog).addEventListener('click', function () {
    showForm();
    emailInput.value = '';
    emailInput.focus();
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'plataforma') setPlatform(e.target.value);
  });
  emailInput.addEventListener('input', function () {
    if (errorEl.textContent) {
      errorEl.textContent = '';
      field.classList.remove('is-invalid');
    }
  });
  $$('[data-store]').forEach(function (b) {
    b.addEventListener('click', function () {
      openWaitlist(b.getAttribute('data-store'), b);
    });
  });
  $$('[data-open-waitlist]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      openWaitlist(null, a);
    });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = emailInput.value.trim().toLowerCase();
    var platform = dialog.getAttribute('data-platform');
    if (email.length > 254 || !EMAIL.test(email)) {
      errorEl.textContent = 'Digite um e-mail válido, como nome@exemplo.com.';
      field.classList.remove('is-invalid');
      void field.offsetWidth;
      field.classList.add('is-invalid');
      emailInput.focus();
      return;
    }
    errorEl.textContent = '';
    submit.classList.add('is-loading');
    submit.disabled = true;
    submitWaitlist({
      email: email,
      plataforma: platform,
      novidades: form.elements.novidades.checked,
      empresa: form.elements.empresa.value,
    }).then(function (r) {
      submit.classList.remove('is-loading');
      submit.disabled = false;
      if (r.ok) {
        remember(email, platform);
        showDone(email, platform, false);
      } else {
        errorEl.textContent = r.error;
      }
    });
  });

  // ---------- Fale conosco: formulário que chega pronto para a equipe ----------
  var CONTACT_URL = WAITLIST_URL.replace('/lista-de-espera', '/fale-conosco');
  var CONTACT_ERROR =
    'Não deu para enviar agora. Confira sua internet e tente de novo, ou escreva para contato@rentable.com.br.';
  var contactForm = $('[data-contact-form]');
  if (contactForm) {
    var area = $('[data-form-area]');
    var sent = $('[data-form-done]');
    var sentTitle = $('[data-done-title]', sent);
    var sentText = $('[data-done-text]', sent);
    var formError = $('[data-form-error]', contactForm);
    var sendButton = $('.form-submit', contactForm);
    var counter = $('[data-char-count]', contactForm);
    var fields = contactForm.elements;
    var tried = false;

    var digits = function (v) {
      return v.replace(/\D/g, '');
    };
    var maskPhone = function (v) {
      var d = digits(v).slice(0, 11);
      if (!d) return '';
      if (d.length <= 2) return '(' + d;
      if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
      if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    };
    var CHECKS = {
      nome: function (v) {
        return v.trim().length >= 2 ? '' : 'Digite o seu nome.';
      },
      email: function (v) {
        var e = v.trim().toLowerCase();
        return e.length <= 254 && EMAIL.test(e)
          ? ''
          : 'Digite um e-mail válido, como nome@exemplo.com.';
      },
      telefone: function (v) {
        var n = digits(v).length;
        return !v.trim() || n === 10 || n === 11 ? '' : 'Confira o telefone, com DDD.';
      },
      motivo: function (v) {
        return v ? '' : 'Escolha o motivo do contato.';
      },
      mensagem: function (v) {
        return v.trim().length >= 10 ? '' : 'Conte um pouco mais (pelo menos 10 letras).';
      },
    };
    var setFieldError = function (name, msg) {
      var box = $('[data-field="' + name + '"]', contactForm);
      if (!box) return;
      var input = fields[name];
      var note = $('[data-field-msg]', box);
      note.id = 'erro-' + name;
      box.classList.toggle('is-invalid', !!msg);
      note.textContent = msg || '';
      if (msg) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', note.id);
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    };
    var check = function (name) {
      var msg = CHECKS[name](fields[name].value);
      setFieldError(name, msg);
      return msg;
    };
    var updateCounter = function () {
      var n = fields.mensagem.value.length;
      counter.textContent = n + ' / 2000';
      counter.classList.toggle('is-near', n > 1800);
    };

    fields.telefone.addEventListener('input', function () {
      fields.telefone.value = maskPhone(fields.telefone.value);
    });
    fields.mensagem.addEventListener('input', updateCounter);
    Object.keys(CHECKS).forEach(function (name) {
      var input = fields[name];
      input.addEventListener(name === 'motivo' ? 'change' : 'input', function () {
        formError.textContent = '';
        if (tried || input.getAttribute('aria-invalid')) check(name);
      });
      input.addEventListener('blur', function () {
        if (input.value.trim()) check(name);
      });
    });

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      tried = true;
      formError.textContent = '';
      var firstBad = null;
      Object.keys(CHECKS).forEach(function (name) {
        var box = $('[data-field="' + name + '"]', contactForm);
        box.classList.remove('is-shaking');
        if (!check(name)) return;
        void box.offsetWidth;
        box.classList.add('is-shaking');
        if (!firstBad) firstBad = name;
      });
      if (firstBad) {
        fields[firstBad].focus();
        return;
      }
      var email = fields.email.value.trim().toLowerCase();
      sendButton.classList.add('is-loading');
      sendButton.disabled = true;
      postJson(
        CONTACT_URL,
        {
          nome: fields.nome.value.trim(),
          email: email,
          telefone: fields.telefone.value.trim(),
          motivo: fields.motivo.value,
          mensagem: fields.mensagem.value.trim(),
          empresa: fields.empresa.value,
        },
        CONTACT_ERROR,
      ).then(function (r) {
        sendButton.classList.remove('is-loading');
        sendButton.disabled = false;
        if (r.ok) {
          area.hidden = true;
          sent.hidden = false;
          sentTitle.textContent = 'Mensagem enviada!';
          sentText.textContent =
            'Recebemos sua mensagem e respondemos em ' +
            email +
            '. Confira também a caixa de spam.';
          sentTitle.focus();
          return;
        }
        if (r.field && CHECKS[r.field]) {
          setFieldError(r.field, r.error);
          fields[r.field].focus();
        } else {
          formError.textContent = r.error;
        }
      });
    });
    $('[data-form-again]', sent).addEventListener('click', function () {
      var keep = {
        nome: fields.nome.value,
        email: fields.email.value,
        telefone: fields.telefone.value,
      };
      contactForm.reset();
      fields.nome.value = keep.nome;
      fields.email.value = keep.email;
      fields.telefone.value = keep.telefone;
      tried = false;
      updateCounter();
      sent.hidden = true;
      area.hidden = false;
      fields.motivo.focus();
    });
    updateCounter();
  }
})();
