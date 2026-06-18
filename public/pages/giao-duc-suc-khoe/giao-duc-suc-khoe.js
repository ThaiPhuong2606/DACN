const searchInput = document.querySelector('[data-gdsk-search]');
const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
const cards = Array.from(document.querySelectorAll('.gdsk-card'));
const sections = Array.from(document.querySelectorAll('.gdsk-panel'));

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function applyFilter(filterValue) {
  const query = normalizeText(searchInput?.value || '');
  let visibleCount = 0;

  cards.forEach((card) => {
    const cardText = normalizeText(card.textContent || '');
    const cardCategory = card.getAttribute('data-category') || '';
    const matchesFilter = filterValue === 'all' || cardCategory === filterValue;
    const matchesQuery = !query || cardText.includes(query);
    const shouldShow = matchesFilter && matchesQuery;

    card.classList.toggle('gdsk-hidden', !shouldShow);
    if (shouldShow) visibleCount += 1;
  });

  sections.forEach((section) => {
    const sectionCategory = section.getAttribute('data-category');
    const visibleCards = section.querySelectorAll('.gdsk-card:not(.gdsk-hidden)');
    const shouldShowSection = filterValue === 'all' ? visibleCards.length > 0 : sectionCategory === filterValue && visibleCards.length > 0;
    section.classList.toggle('gdsk-hidden', !shouldShowSection);
  });

  filterButtons.forEach((button) => {
    const isActive = button.getAttribute('data-filter') === filterValue;
    button.classList.toggle('is-active', isActive);
  });

  return visibleCount;
}

function closeOtherDetails(currentCard) {
  cards.forEach((card) => {
    if (card !== currentCard && card.open) {
      card.open = false;
    }
  });
}

cards.forEach((card) => {
  card.addEventListener('toggle', () => {
    if (card.open) closeOtherDetails(card);
  });
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyFilter(button.getAttribute('data-filter') || 'all');
  });
});

searchInput?.addEventListener('input', () => {
  const activeFilter = document.querySelector('[data-filter].is-active')?.getAttribute('data-filter') || 'all';
  applyFilter(activeFilter);
});

applyFilter('all');
