(() => {
  'use strict';

  const SPECIAL_DATE = '051025';

  const SPOTIFY_URL = 'https://open.spotify.com/track/2xN98jvoGdfBzPS0HDMlXT?si=c57a2409c438401e';

  // All 23 new photos, used as-is (no format conversion).
  // Note: .png files only render natively in Safari/iOS. If you notice
  // broken images in Chrome/Firefox/Android, that's why — swap those
  // filenames for .jpg versions later and nothing else needs to change.
  const NEW_PHOTOS = [
    'IMG_2796.png',
    'IMG_2811.png',
    'IMG_2819.png',
    'IMG_2820.png',
    'IMG_2821.png',
    'IMG_2831.png',
    'IMG_2834.png',
    'IMG_2837.png',
    'IMG_2877.png',
    'IMG_2912.png',
    'IMG_2914.png',
    'IMG_2917.png',
    'IMG_2929.png',
    'IMG_2931.png',
    'IMG_2938.png',
    'IMG_3056.JPG',
    'IMG_3058.JPG',
    'IMG_3059.JPG',
    'IMG_3060.JPG',
    'IMG_3061.JPG',
    'IMG_3065.JPG',
    'IMG_3281.PNG',
    'IMG_3282.PNG'
  ].map((f) => `assets/${f}`);
  // Memories section is 3 static hand-picked photos, unchanged, in the HTML.
  // The full set of 23 is used for the Movie slideshow only.
  const MOVIE_IMAGES = NEW_PHOTOS;

  const MOVIE_SLIDE_MS = 4200;
  const STACK_SIZE = 4;
  const STACK_TRANSITION_MS = 650; // keep in sync with the .movie-stack-card transition duration in styles.css

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
      const previousScene = currentScene;
      currentScene = id;
      if (scrollTop) window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      requestAnimationFrame(() => { transitioning = false; });

      // Start/stop the movie slideshow based on whether its scene is active.
      if (id === 'movie') startMovie();
      if (previousScene === 'movie' && id !== 'movie') pauseMovie(true);
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
  byId('memoryContinue').addEventListener('click', () => showScene('movie'));
  byId('movieContinue').addEventListener('click', () => showScene('song'));
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

  // ---------------------------------------------------------------------
  // MOVIE — photo slideshow that plays itself like a little film
  // ---------------------------------------------------------------------

  const movieFrames = byId('movieFrames');
  const movieCounter = byId('movieCounter');
  const movieProgressFill = byId('movieProgressFill');
  const moviePlayPauseBtn = byId('moviePlayPause');
  const moviePlayIcon = byId('moviePlayIcon');
  const movieAudio = byId('movieAudio');

  function playMovieAudio() {
    if (!movieAudio || reducedMotion) return;
    // play() can reject if the browser blocks autoplay-with-sound; that's
    // fine, the slideshow itself still works without the song.
    movieAudio.play().catch(() => { });
  }

  function stopMovieAudio(reset = false) {
    if (!movieAudio) return;
    movieAudio.pause();
    if (reset) {
      try { movieAudio.currentTime = 0; } catch (_) { /* not loaded yet */ }
    }
  }

  let movieIndex = 0;
  let stackOrder = []; // DOM cards, front-to-back order; stackOrder[0] is the visible front card
  let moviePlaying = !reducedMotion; // start paused if reduced motion is preferred
  let movieRaf = null;
  let movieSlideStart = 0;
  let movieElapsedBeforePause = 0;
  let movieBuilt = false;

  function buildMovieLayers() {
    if (movieBuilt) return;
    movieBuilt = true;

    for (let slot = 0; slot < STACK_SIZE; slot += 1) {
      const card = document.createElement('div');
      const img = document.createElement('img');
      img.decoding = 'async';
      img.src = MOVIE_IMAGES[slot % MOVIE_IMAGES.length];
      if (slot === 0) {
        img.alt = 'A photo from our first year';
      } else {
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
      }
      card.appendChild(img);
      card._img = img;
      movieFrames.appendChild(card);
      stackOrder.push(card);
    }

    applyStackSlots();
    updateMovieCounter();
  }

  function applyStackSlots() {
    stackOrder.forEach((card, slot) => {
      card.className = `movie-stack-card stack-slot-${slot}`;
    });
  }

  function updateMovieCounter() {
    movieCounter.textContent = `${movieIndex + 1} / ${MOVIE_IMAGES.length}`;
  }

  function updateMoviePlayIcon() {
    moviePlayIcon.textContent = moviePlaying ? '❚❚' : '▶';
    moviePlayPauseBtn.setAttribute('aria-label', moviePlaying ? 'Pause slideshow' : 'Play slideshow');
    moviePlayPauseBtn.setAttribute('aria-pressed', moviePlaying ? 'true' : 'false');
  }

  function setMovieProgress(pct) {
    movieProgressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  // Rotates the physical stack by one card. direction 1 = next photo (front
  // card drops to the very back of the deck); direction -1 = previous photo
  // (back card comes forward to the front).
  function rotateStack(direction) {
    const total = MOVIE_IMAGES.length;

    if (direction === 1) {
      const leaving = stackOrder.shift();
      stackOrder.push(leaving);
      movieIndex = (movieIndex + 1) % total;

      // The card that just left the front is now the hidden buffer at the
      // very back — swap its photo only once it's fully faded out, so the
      // photo doesn't visibly pop mid-animation.
      const newSrc = MOVIE_IMAGES[(movieIndex + STACK_SIZE - 1) % total];
      window.setTimeout(() => { leaving._img.src = newSrc; }, STACK_TRANSITION_MS);
    } else {
      const entering = stackOrder.pop();
      stackOrder.unshift(entering);
      movieIndex = (movieIndex - 1 + total) % total;

      // Coming from the invisible back of the deck to the front, so the
      // photo must already be correct before it becomes visible.
      entering._img.src = MOVIE_IMAGES[movieIndex];
    }

    stackOrder.forEach((card, slot) => {
      if (slot === 0) {
        card._img.alt = 'A photo from our first year';
        card._img.removeAttribute('aria-hidden');
      } else {
        card._img.alt = '';
        card._img.setAttribute('aria-hidden', 'true');
      }
    });

    applyStackSlots();
    updateMovieCounter();
  }

  function stepMovie(direction) {
    cancelAnimationFrame(movieRaf);
    rotateStack(direction);
    movieElapsedBeforePause = 0;
    setMovieProgress(0);
    if (moviePlaying) startMovieTick();
  }

  function movieTick(ts) {
    if (!movieSlideStart) movieSlideStart = ts;
    const elapsed = movieElapsedBeforePause + (ts - movieSlideStart);
    const pct = (elapsed / MOVIE_SLIDE_MS) * 100;
    setMovieProgress(pct);

    if (elapsed >= MOVIE_SLIDE_MS) {
      stepMovie(1);
      return;
    }
    movieRaf = requestAnimationFrame(movieTick);
  }

  function startMovieTick() {
    movieSlideStart = 0;
    movieRaf = requestAnimationFrame(movieTick);
  }

  function startMovie() {
    buildMovieLayers();
    if (reducedMotion) {
      // Respect reduced motion: don't auto-play, show a static first
      // frame with full manual control instead. No audio either.
      moviePlaying = false;
      updateMoviePlayIcon();
      setMovieProgress(0);
      stopMovieAudio(true);
      return;
    }
    moviePlaying = true;
    updateMoviePlayIcon();
    movieElapsedBeforePause = 0;
    setMovieProgress(0);
    startMovieTick();
    stopMovieAudio(true); // reset to the start of the song for a fresh visit
    playMovieAudio();
  }

  function pauseMovie(fromSceneChange = false) {
    cancelAnimationFrame(movieRaf);
    if (moviePlaying && movieSlideStart) {
      movieElapsedBeforePause += performance.now() - movieSlideStart;
    }
    movieSlideStart = 0;
    stopMovieAudio(fromSceneChange); // reset the song only when leaving the scene entirely
    if (!fromSceneChange) {
      moviePlaying = false;
      updateMoviePlayIcon();
    }
  }

  function resumeMovie() {
    moviePlaying = true;
    updateMoviePlayIcon();
    startMovieTick();
    playMovieAudio();
  }

  moviePlayPauseBtn.addEventListener('click', () => {
    if (moviePlaying) {
      pauseMovie();
    } else {
      resumeMovie();
    }
  });

  byId('movieNext').addEventListener('click', () => stepMovie(1));
  byId('moviePrev').addEventListener('click', () => stepMovie(-1));
  byId('movieTapNext').addEventListener('click', () => stepMovie(1));
  byId('movieTapPrev').addEventListener('click', () => stepMovie(-1));

  const movieStage = byId('movieStage');
  movieStage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') stepMovie(1);
    if (e.key === 'ArrowLeft') stepMovie(-1);
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      moviePlaying ? pauseMovie() : resumeMovie();
    }
  });

  // Simple swipe support for mobile.
  let movieTouchStartX = null;
  movieStage.addEventListener('touchstart', (e) => {
    movieTouchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  movieStage.addEventListener('touchend', (e) => {
    if (movieTouchStartX === null) return;
    const dx = e.changedTouches[0].clientX - movieTouchStartX;
    movieTouchStartX = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) stepMovie(1);
    else stepMovie(-1);
  }, { passive: true });

  // Pause the slideshow when the tab isn't visible, resume where it left off.
  document.addEventListener('visibilitychange', () => {
    if (currentScene !== 'movie') return;
    if (document.hidden) {
      cancelAnimationFrame(movieRaf);
      if (moviePlaying && movieSlideStart) {
        movieElapsedBeforePause += performance.now() - movieSlideStart;
      }
      movieSlideStart = 0;
      stopMovieAudio(false);
    } else if (moviePlaying) {
      startMovieTick();
      playMovieAudio();
    }
  });
})();
