const navButtons = Array.from(document.querySelectorAll('.page-nav__item'));
const sections = navButtons
  .map((button) => document.getElementById(button.dataset.scrollTarget || ''))
  .filter(Boolean);
const backToTop = document.querySelector('.back-to-top');

function scrollToSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) return;

  const offset = 96;
  const top = window.scrollY + target.getBoundingClientRect().top - offset;
  window.scrollTo({ top, behavior: 'smooth' });
}

function setActiveButton(sectionId) {
  navButtons.forEach((button) => {
    const isActive = button.dataset.scrollTarget === sectionId;
    button.classList.toggle('is-active', isActive);
  });
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const sectionId = button.dataset.scrollTarget;
    if (sectionId) scrollToSection(sectionId);
  });
});

if (backToTop) {
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

if (sections.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible?.target?.id) {
        setActiveButton(visible.target.id);
      }
    },
    {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0.12, 0.2, 0.4, 0.6],
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function updateBackToTop() {
  if (!backToTop) return;
  backToTop.classList.toggle('is-visible', window.scrollY > 420);
}

window.addEventListener('scroll', updateBackToTop, { passive: true });
updateBackToTop();

const zoomableImages = Array.from(
  document.querySelectorAll('.gioi-thieu-page .media-frame img, .gioi-thieu-page .gallery-grid img')
);

if (zoomableImages.length) {
  const lightbox = document.createElement('div');
  lightbox.className = 'image-lightbox';
  lightbox.setAttribute('aria-hidden', 'true');

  const zoomedImage = document.createElement('img');
  zoomedImage.className = 'image-lightbox__img';
  zoomedImage.alt = '';

  const closeButton = document.createElement('button');
  closeButton.className = 'image-lightbox__close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Dong anh phong to');
  closeButton.textContent = '×';

  lightbox.append(zoomedImage, closeButton);
  document.body.appendChild(lightbox);

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openLightbox(sourceImage) {
    zoomedImage.src = sourceImage.currentSrc || sourceImage.src;
    zoomedImage.alt = sourceImage.alt || 'Anh phong to';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  zoomableImages.forEach((image) => {
    image.classList.add('is-zoomable');
    image.addEventListener('click', () => openLightbox(image));
  });

  closeButton.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox.classList.contains('is-open')) {
      closeLightbox();
    }
  });
}
