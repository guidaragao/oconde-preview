/* Motion that is tied to scroll position, not to a trigger.
 *
 * The hero is a scrub: every pixel of scroll moves the film. If the rest of
 * the page only faded in once on entry it would speak a different language.
 * So the reveals below are driven by CSS scroll-driven animations, which are
 * position linked in the same way.
 *
 * This file only does the two things CSS cannot:
 *   1. the counters, which need to produce text
 *   2. a fallback for browsers without animation-timeline (Firefox today)
 */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasScrollTimeline = CSS.supports('animation-timeline: view()');

  // Without native support the elements must simply be visible. The CSS keeps
  // them hidden only inside an @supports block, so there is nothing to undo.
  if (!hasScrollTimeline) document.documentElement.classList.add('no-scroll-timeline');

  /* ---------- counters ---------- */

  var nums = [].slice.call(document.querySelectorAll('[data-conta]'));

  function anima(el) {
    var alvo = parseFloat(el.dataset.conta);
    var sufixo = el.dataset.sufixo || '';
    var dur = 1400;
    var t0 = null;

    function passo(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      // ease out: fast start, long settle. Matches the film's slow drift.
      var e = 1 - Math.pow(1 - p, 3);
      var v = Math.round(alvo * e);
      el.textContent = v.toLocaleString('pt-BR') + sufixo;
      if (p < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  if (nums.length) {
    if (reduced) {
      nums.forEach(function (el) {
        el.textContent = parseFloat(el.dataset.conta).toLocaleString('pt-BR') + (el.dataset.sufixo || '');
      });
    } else {
      nums.forEach(function (el) { el.textContent = '0' + (el.dataset.sufixo || ''); });
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          anima(en.target);
          obs.unobserve(en.target);
        });
      }, { threshold: 0.6 });
      nums.forEach(function (el) { obs.observe(el); });
    }
  }

  /* ---------- fallback reveal ---------- */

  if (hasScrollTimeline || reduced) return;

  var alvos = [].slice.call(document.querySelectorAll('.reveal, .reveal-foto'));
  if (!alvos.length) return;

  var obs2 = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      obs2.unobserve(en.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  alvos.forEach(function (el) { obs2.observe(el); });
}());
