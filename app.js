(() => {
  'use strict';

  const SPECIAL_DATE = '051025';

  const SPOTIFY_URL = 'https://open.spotify.com/track/2xN98jvoGdfBzPS0HDMlXT?si=c57a2409c438401e';

  const scenes = [...document.querySelectorAll('.scene')];
  const byId = (id) => document.getElementById(id);
  let currentScene = 'intro';
  let pin = '';
  let transitioning = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const spotifyLink = byId('spotifyLink');

  function showScene(id, { scrollTop = true } = {}) {
    if (transitioning || id === currentScene) return;
    const from = byId(currentScene);
    const to = byId(id);
    if (!to) return;

    transitioning = true;
    from?.classList.add('scene-leaving');
    const delay = reducedMotion ? 0 : 420;

    window.setTimeout(() => {
      scenes.forEach((scene) => {
        scene.classList.remove('scene-active', 'scene-leaving');
        scene.setAttribute('aria-hidden', 'true');
      });
      to.classList.add('scene-active');
      to.removeAttribute('aria-hidden');
      currentScene = id;
      if (scrollTop) window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      requestAnimationFrame(() => { transitioning = false; });
    }, delay);
  }

  scenes.forEach((scene) => {
    if (!scene.classList.contains('scene-active')) scene.setAttribute('aria-hidden', 'true');
  });

  spotifyLink.href = SPOTIFY_URL;

  byId('beginBtn').addEventListener('click', () => {
    showScene('date-lock');
  });

  const keypad = byId('keypad');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'blank', '0', 'back'];
  keys.forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = value === 'blank' ? 'key key-blank' : 'key';
    button.textContent = value === 'back' ? '⌫' : value === 'blank' ? '' : value;
    if (value !== 'blank') button.setAttribute('aria-label', value === 'back' ? 'Delete digit' : `Digit ${value}`);
    button.addEventListener('click', () => handleKey(value));
    keypad.appendChild(button);
  });

  function renderPin() {
    [...document.querySelectorAll('.pin-heart')].forEach((heart, i) => heart.classList.toggle('filled', i < pin.length));
  }

  function handleKey(value) {
    if (value === 'blank') return;
    if (value === 'back') {
      pin = pin.slice(0, -1);
      renderPin();
      return;
    }
    if (pin.length >= SPECIAL_DATE.length) return;
    pin += value;
    renderPin();

    if (pin.length === SPECIAL_DATE.length) {
      if (pin === SPECIAL_DATE) {
        byId('dateError').style.opacity = '0';
        window.setTimeout(() => showScene('letter'), 260);
      } else {
        const card = byId('date-lock').querySelector('.paper-card');
        byId('dateError').style.opacity = '1';
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        window.setTimeout(() => {
          pin = '';
          renderPin();
        }, 480);
      }
    }
  }

  byId('letterContinue').addEventListener('click', () => showScene('memories'));
  byId('memoryContinue').addEventListener('click', () => showScene('song'));
  byId('songContinue').addEventListener('click', () => showScene('finale'));
  byId('restartBtn').addEventListener('click', () => {
    pin = '';
    renderPin();
    showScene('intro');
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .18 });
  document.querySelectorAll('.observe-reveal').forEach((el) => revealObserver.observe(el));
})();
