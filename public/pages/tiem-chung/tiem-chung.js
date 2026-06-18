const searchInput = document.getElementById('tc-search-input');
const clearSearchButton = document.getElementById('tc-clear-search');
const filterChips = Array.from(document.querySelectorAll('.tc-chip'));
const vaccineCards = Array.from(document.querySelectorAll('.tc-vaccine'));
const faqItems = Array.from(document.querySelectorAll('.tc-faq-item'));
const emptyState = document.getElementById('tc-empty-state');
const scrollButtons = Array.from(document.querySelectorAll('[data-scroll-target]'));

let activeFilter = 'all';

function normalizeText(text) {
  return (text || '').toLowerCase().trim();
}

function matchByFilter(card, filter) {
  if (filter === 'all') return true;
  return card.dataset.age === filter;
}

function matchByKeyword(element, keyword) {
  if (!keyword) return true;
  const source = normalizeText(`${element.textContent} ${element.dataset.keywords || ''}`);
  return source.includes(keyword);
}

function updateEmptyState() {
  if (!emptyState) return;
  const hasVisibleCards = vaccineCards.some((card) => !card.classList.contains('is-hidden'));
  emptyState.hidden = hasVisibleCards;
}

function filterContent() {
  const keyword = normalizeText(searchInput?.value);

  vaccineCards.forEach((card) => {
    const visible = matchByFilter(card, activeFilter) && matchByKeyword(card, keyword);
    card.classList.toggle('is-hidden', !visible);
  });

  faqItems.forEach((item) => {
    const visible = matchByKeyword(item, keyword);
    item.classList.toggle('is-hidden', !visible);
  });

  updateEmptyState();
}

filterChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    activeFilter = chip.dataset.filter || 'all';

    filterChips.forEach((button) => {
      const isActive = button === chip;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });

    filterContent();
  });
});

if (searchInput) {
  searchInput.addEventListener('input', filterContent);
}

if (clearSearchButton) {
  clearSearchButton.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    activeFilter = 'all';
    filterChips.forEach((button) => {
      const isAll = button.dataset.filter === 'all';
      button.classList.toggle('is-active', isAll);
      button.setAttribute('aria-selected', String(isAll));
    });
    filterContent();
    searchInput?.focus();
  });
}

scrollButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.scrollTarget;
    if (!targetId) return;

    const target = document.getElementById(targetId);
    if (!target) return;

    const y = window.scrollY + target.getBoundingClientRect().top - 88;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
});

Array.from(document.querySelectorAll('.tc-faq-toggle')).forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const container = toggle.closest('.tc-faq-item');
    const content = container?.querySelector('.tc-faq-content');
    if (!container || !content) return;

    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isExpanded));
    toggle.querySelector('span').textContent = isExpanded ? '+' : '−';
    content.hidden = isExpanded;
  });
});

const statCounters = Array.from(document.querySelectorAll('[data-counter]'));

function runCounters() {
  statCounters.forEach((counterElement) => {
    const target = Number(counterElement.dataset.counter || 0);
    if (!target || Number.isNaN(target)) return;

    let current = 0;
    const duration = 900;
    const start = performance.now();

    function update(now) {
      const progress = Math.min((now - start) / duration, 1);
      current = Math.floor(progress * target);
      counterElement.textContent = current.toLocaleString('vi-VN');
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  });
}

const revealItems = Array.from(document.querySelectorAll('.tc-panel, .tc-vaccine'));
if (revealItems.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.14,
      rootMargin: '0px 0px -6% 0px',
    }
  );

  revealItems.forEach((item) => {
    item.classList.add('tc-reveal');
    observer.observe(item);
  });
}

if (statCounters.length) {
  const statObserver = new IntersectionObserver(
    (entries) => {
      const firstVisible = entries.some((entry) => entry.isIntersecting);
      if (!firstVisible) return;
      runCounters();
      statObserver.disconnect();
    },
    { threshold: 0.25 }
  );

  statObserver.observe(statCounters[0]);
}

filterContent();
