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

  // Ícones da barra de status: escritos uma vez no celular da abertura, copiados nos outros.
  var statusTemplate = $('.phone-hero .status');
  var icons = statusTemplate && $('.status-icons', statusTemplate);
  $$('.status-icons:empty').forEach(function (el) {
    if (icons) el.innerHTML = icons.innerHTML;
  });
  $$('.phone-inline .phone-screen').forEach(function (screen) {
    if (statusTemplate && !$('.status', screen)) {
      screen.insertBefore(statusTemplate.cloneNode(true), screen.firstChild);
    }
  });

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
  $$('a[href^="#"]').forEach(function (a) {
    if (a.hasAttribute('data-open-waitlist')) return;
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id.length > 1 && document.querySelector(id);
      if (!target || !lenis) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: id === '#topo' || id === '#problema' ? 0 : -72 });
    });
  });

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

  // ---------- Topo: esconde ao descer, progresso e seção atual ----------
  var topbar = $('[data-topbar]');
  var hero = $('.hero');
  var spyLinks = $$('[data-spy]');
  var lastY = window.scrollY;
  var updateTopbar = function (y) {
    var delta = y - lastY;
    lastY = y;
    topbar.classList.toggle('is-scrolled', y > 8);
    if (y < 140 || delta < -2) topbar.classList.remove('is-hidden');
    else if (delta > 2 && !modalOpen) topbar.classList.add('is-hidden');
    var max = root.scrollHeight - window.innerHeight;
    topbar.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : '0');
    if (hero && y < hero.offsetHeight * 0.6) {
      spyLinks.forEach(function (l) {
        l.classList.remove('is-current');
      });
    }
  };
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          spyLinks.forEach(function (l) {
            l.classList.toggle('is-current', l.getAttribute('data-spy') === e.target.id);
          });
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    spyLinks.forEach(function (l) {
      var section = document.getElementById(l.getAttribute('data-spy'));
      if (section) spy.observe(section);
    });
  }

  // ---------- Abertura da página: avisos chegando no celular ----------
  var push = $('[data-push]');
  var pushTitle = $('[data-push-title]');
  var pushBody = $('[data-push-body]');
  var heroVisible = true;
  if ('IntersectionObserver' in window && hero) {
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
    }).observe(hero);
  }
  var notes = [
    ['Pagamento recebido: Barracão', 'Oficina Rocha ME pagou R$ 3.500,00.'],
    ['Reajuste chegando: Apto Centro', 'O aluguel reajusta em 03/12 pelo IGP-M.'],
    ['Aluguel atrasado: Casa Jardim', 'Venceu em 30/10 e está 6 dias em atraso.'],
    ['Lembrete do carnê-leão', 'O IR dos aluguéis de novembro vence em 30/12.'],
  ];
  if (push) {
    if (reduce) {
      push.classList.add('is-shown');
    } else {
      var n = 0;
      setTimeout(function () {
        push.classList.add('is-shown');
      }, introDelay + 1700);
      setInterval(function () {
        if (!heroVisible || document.hidden) return;
        push.classList.remove('is-shown');
        setTimeout(function () {
          n = (n + 1) % notes.length;
          pushTitle.textContent = notes[n][0];
          pushBody.textContent = notes[n][1];
          push.classList.add('is-shown');
        }, 650);
      }, 5200);
    }
  }

  // Valores das etiquetas contam de zero até o número.
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
        introDelay + 1150 + i * 400,
      );
    });
  }

  // ---------- Celular da abertura: acompanha o mouse ----------
  var heroVisual = $('[data-hero-visual]');
  var tiltEl = $('[data-tilt]');
  var pointer = { x: 0, y: 0 };
  var tilt = { x: 0, y: 0 };
  if (hero && finePointer && !reduce) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      pointer.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      pointer.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    });
    hero.addEventListener('pointerleave', function () {
      pointer.x = 0;
      pointer.y = 0;
    });
  }

  // ---------- Problema → solução ----------
  var scene = $('[data-scene]');
  var arena = scene && $('.arena', scene);
  if (scene && !reduce) scene.classList.add('is-live');

  // ---------- Passeio pelo app ----------
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
        var on = f === i && (!first || l === first);
        l.classList.toggle('is-active', on);
        l.classList.toggle('is-before', f < i);
      });
      // Leitura do contrato: primeiro "Lendo o contrato", depois o resultado.
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
  var frame = function () {
    var y = window.scrollY;
    var vh = window.innerHeight;

    // Leituras primeiro.
    var heroH = hero ? hero.offsetHeight : 1;
    var sceneRect = scene ? scene.getBoundingClientRect() : null;
    var storyRect = storyGrid ? storyGrid.getBoundingClientRect() : null;
    var stepRect = current >= 0 && steps[current] ? steps[current].getBoundingClientRect() : null;

    updateTopbar(y);

    // Celular da abertura: mouse e rolagem.
    if (tiltEl) {
      tilt.x = lerp(tilt.x, pointer.x, 0.08);
      tilt.y = lerp(tilt.y, pointer.y, 0.08);
      var t = clamp(y / heroH, 0, 1);
      tiltEl.style.setProperty('--ry', (tilt.x * 8).toFixed(2) + 'deg');
      tiltEl.style.setProperty('--rx', (-tilt.y * 6).toFixed(2) + 'deg');
      tiltEl.style.setProperty('--ty', (t * 70).toFixed(1) + 'px');
      tiltEl.style.setProperty('--rot', (t * -5).toFixed(2) + 'deg');
      heroVisual.style.setProperty('--mx', tilt.x.toFixed(3));
      heroVisual.style.setProperty('--my', tilt.y.toFixed(3));
    }
    var hint = $('[data-scroll-hint]');
    if (hint) hint.classList.toggle('is-gone', y > 60);

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
      var sp = clamp((vh * 0.5 - storyRect.top) / storyRect.height, 0, 1);
      if (railFill) railFill.style.setProperty('--rail', sp.toFixed(4));
      if (stepRect) {
        var local = clamp((vh * 0.5 - stepRect.top) / stepRect.height, 0, 1) - 0.5;
        storyTilt.style.setProperty('--sry', (local * -12).toFixed(2) + 'deg');
        storyTilt.style.setProperty('--srx', (local * 5).toFixed(2) + 'deg');
      }
    }
  };

  if (reduce) {
    var onScroll = function () {
      updateTopbar(window.scrollY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else {
    var loop = function () {
      frame();
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
  $$('.faq details').forEach(function (d) {
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
      var to = opening ? d.offsetHeight : summary.offsetHeight + (d.offsetHeight - d.clientHeight);
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

  // ---------- Botões que puxam o mouse e luz da chamada final ----------
  if (finePointer && !reduce) {
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
    var glow = $('[data-glow]');
    if (glow) {
      glow.addEventListener('pointermove', function (e) {
        var r = glow.getBoundingClientRect();
        glow.style.setProperty('--gx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
        glow.style.setProperty('--gy', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
      });
    }
  }

  // ---------- Lista de espera ----------
  var dialog = $('[data-waitlist]');
  if (!dialog) return;
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
  var TITLES = { android: 'Em breve no Google Play', ios: 'Em breve na App Store' };
  var WHERE = { android: 'ao Google Play', ios: 'à App Store' };
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  // Esc fecha com a animação de saída.
  dialog.addEventListener('cancel', function (e) {
    e.preventDefault();
    closeWaitlist();
  });
  // Tocar fora do cartão fecha.
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

  var invalid = function (message) {
    errorEl.textContent = message;
    field.classList.remove('is-invalid');
    void field.offsetWidth;
    field.classList.add('is-invalid');
    emailInput.focus();
  };
  var fail = function (message) {
    errorEl.textContent =
      message ||
      'Não deu para registrar agora. Confira sua internet e tente de novo, ou escreva para contato@rentable.com.br.';
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = emailInput.value.trim().toLowerCase();
    var platform = dialog.getAttribute('data-platform');
    if (email.length > 254 || !EMAIL.test(email)) {
      invalid('Digite um e-mail válido, como nome@exemplo.com.');
      return;
    }
    errorEl.textContent = '';
    field.classList.remove('is-invalid');
    submit.classList.add('is-loading');
    submit.disabled = true;
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, 12000);
    fetch(WAITLIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        plataforma: platform,
        novidades: form.elements.novidades.checked,
        empresa: form.elements.empresa.value,
      }),
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            return { ok: res.ok, body: body };
          });
      })
      .then(function (r) {
        if (r.ok && r.body && r.body.ok) {
          remember(email, platform);
          showDone(email, platform, false);
        } else {
          fail(r.body && r.body.error);
        }
      })
      .catch(function () {
        fail();
      })
      .then(function () {
        clearTimeout(timer);
        submit.classList.remove('is-loading');
        submit.disabled = false;
      });
  });
})();
