/* ==========================================================================
   Cutless Hair Studio, main script
   Memakai plugin bawaan template: jQuery, SlickNav, Slick, WOW, Magnific Popup.
   ========================================================================== */

/* ---- KONFIGURASI ---------------------------------------------------------
   TODO: ganti dengan nomor WhatsApp bisnis (format internasional, tanpa +, 0, spasi, atau strip)
   Contoh: 0812-3456-7890  ->  6281234567890
   -------------------------------------------------------------------------- */
var CUTLESS_WA_NUMBER = '6281234567890';

(function ($) {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 1. Preloader (maks. 1,5 detik) */
  var preloader = document.getElementById('preloader-active');
  var startedAt = Date.now();
  var MIN_SHOW = 700;   // biar animasi logo sempat terlihat
  var MAX_SHOW = 1500;  // batas atas sesuai brief
  var done = false;

  function finishPreloader() {
    if (done) return;
    done = true;
    if (preloader) preloader.classList.add('is-hidden');
    root.classList.add('is-loaded');
  }
  function onLoaded() {
    setTimeout(finishPreloader, Math.max(0, MIN_SHOW - (Date.now() - startedAt)));
  }
  if (document.readyState === 'complete') onLoaded();
  else window.addEventListener('load', onLoaded);
  setTimeout(finishPreloader, MAX_SHOW);

/* 2. WhatsApp links: semua tombol .js-wa dibangun dari satu nomor */
  $('.js-wa').each(function () {
    var msg = this.getAttribute('data-wa') || 'Halo Cutless Hair Studio, saya mau booking haircut untuk [hari/jam].';
    this.href = 'https://wa.me/' + CUTLESS_WA_NUMBER + '?text=' + encodeURIComponent(msg);
  });

/* 3. Sticky header */
  var $header = $('.header-sticky');
  function onScroll() {
    $header.toggleClass('sticky-bar', $(window).scrollTop() > 40);
  }
  $(window).on('scroll', onScroll);
  onScroll();

/* 4. Mobile menu (SlickNav) */
  var $menu = $('ul#navigation');
  if ($menu.length && $.fn.slicknav) {
    $menu.slicknav({
      prependTo: '.mobile_menu',
      label: '',
      duration: 250,
      closedSymbol: '',
      openedSymbol: '',
      beforeOpen: function () { $header.addClass('menu-open'); },
      afterClose: function () { $header.removeClass('menu-open'); }
    });
    $('.slicknav_btn').attr('aria-label', 'Buka menu');
    $('.mobile_menu').on('click', '.slicknav_nav a', function () {
      $menu.slicknav('close');
    });
  }

/* 5. Active menu on scroll */
  if ('IntersectionObserver' in window) {
    var links = {};
    $('#navigation a, .slicknav_nav a').each(function () {
      var id = (this.getAttribute('href') || '').replace('#', '');
      if (id) (links[id] = links[id] || []).push(this.parentNode);
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || !links[e.target.id]) return;
        $('#navigation li, .slicknav_nav li').removeClass('active');
        $(links[e.target.id]).addClass('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  }

/* 6. Testimoni slider (Slick) */
  var $reviews = $('.review-slider');
  if ($reviews.length && $.fn.slick) {
    $reviews.slick({
      dots: true,
      arrows: false,
      infinite: true,
      speed: 500,
      autoplay: !reduceMotion,
      autoplaySpeed: 5000,
      pauseOnHover: true,
      slidesToShow: 3,
      slidesToScroll: 1,
      responsive: [
        { breakpoint: 992, settings: { slidesToShow: 2 } },
        { breakpoint: 768, settings: { slidesToShow: 1, centerMode: true, centerPadding: '28px' } }
      ]
    });
  }

/* 7. Galeri lightbox (Magnific Popup) */
  if ($.fn.magnificPopup) {
    $('.gallery-grid').magnificPopup({
      delegate: 'a.img-pop-up',
      type: 'image',
      gallery: { enabled: true, tCounter: '%curr% / %total%' },
      tClose: 'Tutup (Esc)',
      tLoading: 'Memuat...',
      mainClass: 'mfp-fade'
    });
  }

/* 8. Before / After slider */
  $('.ba').each(function () {
    var ba = this;
    var range = ba.querySelector('.ba-range');
    if (!range) return;
    var update = function () { ba.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', update);
    update();
  });

/* 9. Counter (format angka Indonesia) */
  var counters = document.querySelectorAll('.counter[data-to]');
  function runCounter(el) {
    var to = parseInt(el.getAttribute('data-to'), 10) || 0;
    var dur = 1600, t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased).toLocaleString('id-ID');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCounter(e.target); co.unobserve(e.target); }
      });
    }, { threshold: .6 });
    [].forEach.call(counters, function (c) { co.observe(c); });
  }

/* 10. Cabang (tab otomatis bila lebih dari satu .branch) */
  var $branches = $('.branch');
  var $tabs = $('.branch-tabs');
  if ($branches.length > 1 && $tabs.length) {
    $branches.each(function (i) {
      var $b = $(this);
      var active = $b.hasClass('is-active');
      $('<button type="button" role="tab"></button>')
        .text($b.data('name') || ('Cabang ' + (i + 1)))
        .attr({ 'aria-controls': this.id, 'aria-selected': active ? 'true' : 'false', id: 'tab-' + this.id })
        .appendTo($tabs);
      $b.attr('aria-labelledby', 'tab-' + this.id);
    });
    $tabs.prop('hidden', false).on('click', 'button', function () {
      var target = this.getAttribute('aria-controls');
      $tabs.find('button').attr('aria-selected', 'false');
      this.setAttribute('aria-selected', 'true');
      $branches.removeClass('is-active').filter('#' + target).addClass('is-active');
    });
  }

/* 11. Tandai hari ini di tabel jam buka */
  var today = new Date().getDay();
  $('.hours tr[data-day="' + today + '"]').addClass('is-today');

/* 12. Tahun di footer */
  $('.js-year').text(new Date().getFullYear());

/* 13. Scroll reveal (WOW.js) */
  if (typeof WOW === 'function' && !reduceMotion) {
    new WOW({ offset: 40, mobile: true }).init();
  }

})(jQuery);
