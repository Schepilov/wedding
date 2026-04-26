// Хаптик — инициализируем сразу, до DOMContentLoaded
window._haptics = null;
(async () => {
  try {
    const { WebHaptics } = await import('./assets/js/web-haptics.js');
    window._haptics = new WebHaptics();
  } catch (e) { /* устройство не поддерживает */ }
})();

document.addEventListener('DOMContentLoaded', () => {

  // Сброс скролла в ноль при каждом открытии
  function resetToTop() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  resetToTop();
  window.addEventListener('beforeunload', resetToTop);
  window.addEventListener('pagehide', resetToTop);

  // Блокировка скролла до нажатия на заставку
  const audio  = document.getElementById('bg-music');
  const gate   = document.getElementById('musicGate');
  const loader = document.getElementById('loader');
  const loaderFill    = document.getElementById('loaderFill');
  const loaderPercent = document.getElementById('loaderPercent');
  const loaderText    = document.getElementById('loaderText');
  let wasPlayingBeforeHidden = false;

  function lockScroll() {
    resetToTop();
    document.documentElement.classList.add('is-locked');
    document.body.classList.add('is-locked');
    document.body.style.top = '0px';
  }

  function unlockScroll() {
    document.documentElement.classList.remove('is-locked');
    document.body.classList.remove('is-locked');
    document.body.style.top = '';
    window.scrollTo(0, 0);
  }

  lockScroll();

  requestAnimationFrame(() => {
    document.documentElement.classList.remove('is-preloading');
  });

  // Экран загрузки
  const LOADER_MIN_MS = 700;
  const loaderStart = Date.now();
  let progress = 0;
  let targetProgress = 0;
  let loaderDone = false;

  // Счётчик точек: . → .. → ... → . → ...
  const dotFrames = ['.', '..', '...'];
  let dotIdx = 0;
  setInterval(() => {
    dotIdx = (dotIdx + 1) % dotFrames.length;
    if (!loaderDone) loaderText.textContent = 'Загрузка' + dotFrames[dotIdx];
  }, 500);

  // rAF — плавное движение прогресс-бара
  function animateLoader() {
    progress += (targetProgress - progress) * 0.08;
    if (targetProgress >= 100 && Math.abs(progress - 100) < 0.5) progress = 100;

    const pct = Math.round(progress);
    loaderFill.style.height = progress + '%';
    loaderPercent.textContent = pct + '%';

    // Текст процентов меняет цвет, когда заливка доходит до ~55%
    loaderPercent.classList.toggle('is-light', progress >= 55);

    if (progress < 100) {
      requestAnimationFrame(animateLoader);
    } else {
      // Заливка 100% — ждём минимальное время и показываем заставку
      const elapsed = Date.now() - loaderStart;
      const wait = Math.max(0, LOADER_MIN_MS - elapsed);
      setTimeout(showGate, wait);
    }
  }
  requestAnimationFrame(animateLoader);

  // Отслеживаем загрузку изображений
    const images = Array.from(document.images).filter(img => img.loading !== 'lazy');

  const imagesReadyPromise = new Promise(resolve => {
    if (images.length === 0) {
      targetProgress = 90;
      resolve();
      return;
    }

    let loaded = 0;

    function onImageLoad() {
      loaded++;
      targetProgress = Math.round((loaded / images.length) * 90);

      if (loaded >= images.length) {
        resolve();
      }
    }

    images.forEach(img => {
      if (img.complete) {
        onImageLoad();
      } else {
        img.addEventListener('load', onImageLoad, { once: true });
        img.addEventListener('error', onImageLoad, { once: true });
      }
    });
  });

  const inviteReadyPromise =
    window.__inviteReadyPromise instanceof Promise
      ? window.__inviteReadyPromise
      : Promise.resolve();

  Promise.all([imagesReadyPromise, inviteReadyPromise]).then(() => {
    targetProgress = 100;
  });

  function showGate() {
    loaderDone = true;
    audio.load();
    loader.classList.add('is-hidden');
    gate.classList.add('is-visible');
    setTimeout(() => loader.remove(), 600);
  }

  // Клик по заставке — открываем приглашение
  gate.addEventListener('click', async () => {
    window._haptics?.trigger('success');
    try { await audio.play(); } catch (e) { /* автовоспроизведение может быть заблокировано */ }
    unlockScroll();
    document.body.classList.add('is-open');
    gate.classList.remove('is-visible');
    gate.classList.add('is-hidden');
    setTimeout(() => gate.remove(), 600);
  });

  // Пауза музыки при скрытии вкладки
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      wasPlayingBeforeHidden = !audio.paused;
      if (wasPlayingBeforeHidden) audio.pause();
    } else if (wasPlayingBeforeHidden) {
      audio.play().catch(() => {});
    }
  });

  // Карусель образов дресс-кода
  document.querySelectorAll('.carousel').forEach(carousel => {
    const slides  = Array.from(carousel.querySelectorAll('.carousel__slide'));
    const counter = carousel.querySelector('.carousel__counter');
    const photos  = carousel.querySelector('.carousel__photos');
    const total   = slides.length;
    let current    = 0;
    let touchStartX = 0;

    function goTo(index) {
      slides[current].classList.remove('is-active');
      current = (index + total) % total;
      slides[current].classList.add('is-active');
      if (counter) counter.textContent = `${current + 1} / ${total}`;
    }

    carousel.querySelector('.carousel__btn--prev')?.addEventListener('click', () => {
      window._haptics?.trigger([20]);
      goTo(current - 1);
    });
    carousel.querySelector('.carousel__btn--next')?.addEventListener('click', () => {
      window._haptics?.trigger([20]);
      goTo(current + 1);
    });

    if (photos) {
      photos.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });

      photos.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 40) {
          window._haptics?.trigger([20]);
          goTo(current + (dx < 0 ? 1 : -1));
        }
      }, { passive: true });
    }
  });

  // Reveal-анимации при скролле
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal, .reveal-text').forEach(el => observer.observe(el));


});
