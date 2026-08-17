/* Scroll scrub engine
 *
 * The trick: the video never plays. Scrolling writes directly onto
 * video.currentTime, so the scrollbar becomes the timeline. Scroll down and
 * the clip runs forward, scroll up and it runs backward. The eye reads it as
 * a camera moving through space. It is a flat video.
 *
 * Reusable: nothing here knows anything about this particular clip or copy.
 * Swap the file in video/ and the beats in index.html and it still works.
 *
 * Two details that separate a smooth scrub from a stuttering one:
 *
 *  1. One seek at a time. Writing currentTime on every animation frame lets
 *     each write cancel the seek still in flight, so the decoder thrashes and
 *     the picture can freeze outright. We wait for 'seeked' before asking for
 *     the next frame, with a watchdog in case the event never arrives.
 *  2. The clip must be encoded all keyframe. See prepare-video.sh.
 */
(function () {
  'use strict';

  var EASE = 0.14;        // how lazily the target chases the scroll (0..1)
  var EPS = 1 / 240;      // ignore corrections smaller than a quarter frame
  var SEEK_TIMEOUT = 260; // ms before we assume a seek was dropped

  var stage = document.querySelector('[data-scrub-stage]');
  var video = document.querySelector('[data-scrub-video]');
  var rail = document.querySelector('[data-scrub-rail]');
  var beats = [].slice.call(document.querySelectorAll('[data-beat-start]'));

  if (!stage || !video) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var duration = 0;
  var target = 0;
  var current = 0;
  var progress = 0;
  var started = false;
  var pending = false;
  var pendingAt = 0;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /* How far we are through the tall stage, 0 at the top, 1 when its bottom
   * edge reaches the bottom of the viewport. */
  function readProgress() {
    var travel = stage.offsetHeight - window.innerHeight;
    if (travel <= 0) return 0;
    return clamp(-stage.getBoundingClientRect().top / travel, 0, 1);
  }

  function paintBeats(p) {
    for (var i = 0; i < beats.length; i++) {
      var el = beats[i];
      var start = parseFloat(el.dataset.beatStart);
      var end = parseFloat(el.dataset.beatEnd);
      el.classList.toggle('is-live', p >= start && p <= end);
    }
    if (rail) rail.style.transform = 'scaleX(' + p + ')';
  }

  function onScroll() {
    progress = readProgress();
    if (duration > 0) target = progress * duration;
    paintBeats(progress);
  }

  video.addEventListener('seeked', function () {
    pending = false;
  });

  function frame() {
    /* Wrapped because a single uncaught throw in here would silently end the
     * animation loop and freeze the picture while the rest of the page kept
     * responding. That failure is invisible and miserable to chase. */
    try {
      current += (target - current) * EASE;
      if (Math.abs(target - current) < EPS) current = target;

      if (pending && performance.now() - pendingAt > SEEK_TIMEOUT) pending = false;

      if (!pending && duration > 0 && video.readyState >= 1 &&
          Math.abs(video.currentTime - current) > EPS) {
        pending = true;
        pendingAt = performance.now();
        video.currentTime = current;
      }
    } catch (err) {
      window.__scrubError = String(err);
    }
    requestAnimationFrame(frame);
  }

  function start() {
    if (started) return;
    if (!isFinite(video.duration) || video.duration <= 0) return;

    started = true;
    duration = video.duration;
    document.body.classList.add('is-ready');
    onScroll();
    current = target;
    requestAnimationFrame(frame);
  }

  /* Static fallback. Reduced motion means no scroll hijack and no scrub:
   * the stage collapses to one screen, the poster shows, all copy is readable. */
  function fallback() {
    document.body.classList.add('is-static', 'is-ready');
    for (var i = 0; i < beats.length; i++) beats[i].classList.add('is-live');
  }

  /* Readable from the console, so "is it actually scrubbing" is one line
   * instead of a guess. */
  window.__scrub = function () {
    return {
      started: started, duration: duration, progress: +progress.toFixed(3),
      target: +target.toFixed(3), current: +current.toFixed(3),
      videoTime: +video.currentTime.toFixed(3), pending: pending,
      error: window.__scrubError || null
    };
  };

  if (reduced) {
    fallback();
    return;
  }

  video.addEventListener('error', function () {
    document.body.classList.add('has-no-video');
    fallback();
  });

  /* durationchange is the reliable signal. loadedmetadata can land before the
   * duration is known, and then start() would latch a zero and never scrub. */
  video.addEventListener('loadedmetadata', start);
  video.addEventListener('durationchange', start);
  video.addEventListener('canplay', start);
  start();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* iOS will not decode a frame until the element has been touched by a play
   * call. One silent play/pause on first interaction unlocks seeking. */
  var unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    var kick = video.play();
    if (kick && kick.then) kick.then(function () { video.pause(); }, function () {});
    else video.pause();
  }
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('click', unlock, { once: true });
})();
