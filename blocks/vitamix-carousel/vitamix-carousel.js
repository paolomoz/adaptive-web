/**
 * Vitamix Carousel Block
 * Reproduces the Holiday Gift Guide carousel from vitamix.com
 * This block is rendered dynamically by page-renderer.js
 * This file exists for EDS block loading compatibility
 */

/**
 * Decorate the vitamix carousel block
 * The actual rendering is done by renderVitamixCarouselBlock in page-renderer.js
 * @param {Element} block - The block element
 */
export default function decorate(block) {
  block.classList.add('vitamix-carousel');

  // Initialize carousel navigation if not already set up by renderer
  const track = block.querySelector('.vitamix-carousel-track');
  const prevBtn = block.querySelector('.vitamix-carousel-nav--prev');
  const nextBtn = block.querySelector('.vitamix-carousel-nav--next');
  const dots = block.querySelectorAll('.vitamix-carousel-dot');

  if (track && prevBtn && nextBtn) {
    initCarouselNavigation(block, track, prevBtn, nextBtn, dots);
  }
}

/**
 * Initialize carousel navigation controls
 * @param {Element} block - The block element
 * @param {Element} track - The carousel track
 * @param {Element} prevBtn - Previous button
 * @param {Element} nextBtn - Next button
 * @param {NodeList} dots - Pagination dots
 */
function initCarouselNavigation(block, track, prevBtn, nextBtn, dots) {
  const cards = track.querySelectorAll('.vitamix-carousel-card');
  if (cards.length === 0) return;

  let currentIndex = 0;
  const visibleCards = getVisibleCardsCount();
  const maxIndex = Math.max(0, cards.length - visibleCards);

  // Update navigation state
  function updateNavigation() {
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex >= maxIndex;

    // Update dots
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });

    // Calculate translate based on card width + gap
    const card = cards[0];
    const cardWidth = card.offsetWidth;
    const gap = 24; // Match CSS gap
    const translateX = currentIndex * (cardWidth + gap);
    track.style.transform = `translateX(-${translateX}px)`;
  }

  // Get number of visible cards based on viewport
  function getVisibleCardsCount() {
    if (window.innerWidth < 768) return 1;
    if (window.innerWidth < 1024) return 3;
    return 4;
  }

  // Navigation handlers
  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex -= 1;
      updateNavigation();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentIndex < maxIndex) {
      currentIndex += 1;
      updateNavigation();
    }
  });

  // Dot click handlers
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      currentIndex = Math.min(i, maxIndex);
      updateNavigation();
    });
  });

  // Handle resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const newVisibleCards = getVisibleCardsCount();
      const newMaxIndex = Math.max(0, cards.length - newVisibleCards);
      if (currentIndex > newMaxIndex) {
        currentIndex = newMaxIndex;
      }
      updateNavigation();
    }, 100);
  });

  // Initial state
  updateNavigation();
}
