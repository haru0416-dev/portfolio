const filters = {
  blog: { prefix: 'tag', results: 'blog-results', item: 'post', values: 'tags', label: '記事' },
  works: { prefix: 'stack', results: 'work-results', item: 'work', values: 'stack', label: '作品' },
} as const;

interface MountedFilter {
  finish(): void;
  dispose(): void;
}

function mountFilter(kind: keyof typeof filters): MountedFilter | undefined {
  const { prefix, results: resultsId, item, values, label } = filters[kind];
  const box = document.getElementById(`${prefix}-filter`);
  const results = document.getElementById(resultsId);
  const status = document.getElementById(`${prefix}-status`);
  const empty = document.getElementById(`${prefix}-empty`);
  if (!box || !results || !status || !empty) return;

  const buttonSelector = `button[data-${prefix}]`;
  const buttons = [...box.querySelectorAll<HTMLButtonElement>(buttonSelector)].map((element) => ({
    element,
    value: element.dataset[prefix] ?? '',
  }));
  const allButton = buttons.find(({ value }) => value === '')?.element;
  const reset = document.getElementById(`${prefix}-reset`);
  const itemSelector = `[data-${item}]`;
  const items = [...results.querySelectorAll<HTMLElement>(itemSelector)].map((element) => ({
    element,
    values: JSON.parse(element.dataset[values] ?? '[]') as string[],
  }));
  const groups = [...results.querySelectorAll<HTMLElement>('section[data-year]')].map((element) => ({
    element,
    items: [...element.querySelectorAll<HTMLElement>(itemSelector)],
  }));
  const named = [...results.querySelectorAll<HTMLElement>(kind === 'blog'
    ? `${itemSelector}, ${itemSelector} [data-astro-transition-scope]`
    : itemSelector)].map((element, index) => ({
      element,
      name: element.matches(itemSelector) ? `filter-${item}-${index}` : undefined,
      originalClass: element.style.getPropertyValue('view-transition-class'),
      classPriority: element.style.getPropertyPriority('view-transition-class'),
      originalName: element.style.getPropertyValue('view-transition-name'),
      namePriority: element.style.getPropertyPriority('view-transition-name'),
    }));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canTransition = typeof document.startViewTransition === 'function'
    && CSS.supports('selector(:active-view-transition-type(filter))');
  const listeners = new AbortController();
  let selected = '';
  let generation = 0;
  let transition: ViewTransition | undefined;

  const restoreNames = () => {
    named.forEach(({ element, name, originalClass, classPriority, originalName, namePriority }) => {
      element.style.setProperty('view-transition-class', originalClass, classPriority);
      if (name) element.style.setProperty('view-transition-name', originalName, namePriority);
    });
  };
  const cancelTransition = () => {
    // A → B → A でも、最初の A の遅延更新を再び有効にしない。
    generation++;
    if (!transition) return;
    transition.skipTransition();
    transition = undefined;
    restoreNames();
  };
  const apply = () => {
    buttons.forEach(({ element, value }) => element.setAttribute('aria-pressed', String(value === selected)));
    let count = 0;
    items.forEach(({ element, values }) => {
      element.hidden = selected !== '' && !values.includes(selected);
      if (!element.hidden) count++;
    });
    groups.forEach(({ element, items }) => {
      element.hidden = !items.some((item) => !item.hidden);
    });
    empty.hidden = count > 0;
    status.textContent = `${selected ? `#${selected} · ` : ''}${count} 件の${label}`;
  };
  const select = (value: string, animate: boolean) => {
    if (value === selected) return;
    cancelTransition();
    selected = value;
    if (!animate || reducedMotion.matches || !canTransition) {
      apply();
      return;
    }

    const current = generation;
    named.forEach(({ element, name }) => {
      element.style.setProperty('view-transition-class', 'item');
      if (name) element.style.setProperty('view-transition-name', name);
    });
    transition = document.startViewTransition({
      update: () => { if (current === generation) apply(); },
      types: ['filter'],
    });
    const finish = () => {
      if (current !== generation) return;
      transition = undefined;
      restoreNames();
    };
    // skipTransition は ready を reject するが、update は実行される。
    void transition.ready.catch(() => {});
    void transition.finished.then(finish, finish);
  };

  box.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>(buttonSelector);
    if (!button || !box.contains(button)) return;
    select(button.dataset[prefix] ?? '', event.detail > 0);
  }, { signal: listeners.signal });
  reset?.addEventListener('click', (event) => {
    // リセットで隠れるボタンから、残る「すべて」へフォーカスを戻す。
    allButton?.focus({ preventScroll: true });
    select('', event.detail > 0);
  }, { signal: listeners.signal });

  return {
    finish() {
      if (!transition) return;
      cancelTransition();
      apply();
    },
    dispose() {
      cancelTransition();
      listeners.abort();
    },
  };
}

let filter: MountedFilter | undefined;
// Astro が遷移元を撮影する前に、絞り込み用の名前を戻す。
document.addEventListener('astro:before-preparation', () => filter?.finish());
document.addEventListener('astro:before-swap', () => {
  filter?.dispose();
  filter = undefined;
});
document.addEventListener('astro:page-load', () => {
  filter?.dispose();
  filter = mountFilter(document.getElementById('blog-results') ? 'blog' : 'works');
});

export {};
