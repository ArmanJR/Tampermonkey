// ==UserScript==
// @name         Hide Sponsored Amazon Search Results
// @namespace    https://tampermonkey.net/
// @version      1.0.0
// @description  Hide Amazon search results and ad blocks labeled "Sponsored"
// @author       You
// @include      /^https?:\/\/([^\/]+\.)?amazon\.[^\/]+\/.*$/
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const HIDDEN_CLASS = 'tm-amazon-sponsored-hidden';

  const style = document.createElement('style');
  style.textContent = `
    .${HIDDEN_CLASS} {
      display: none !important;
    }
  `;
  document.documentElement.appendChild(style);

  const SPONSORED_TEXT_RE = /^\s*Sponsored\s*$/i;
  const SPONSORED_ARIA_RE = /sponsored/i;

  const CONTAINER_SELECTORS = [
    'div[data-component-type="s-search-result"]',
    'div.s-result-item[data-asin]',
    '[cel_widget_id*="MAIN-SEARCH_RESULTS"]',
    '[cel_widget_id*="search_result_"]',
    '[cel_widget_id*="desktop-top-slot"]',
    '[cel_widget_id*="loom-desktop-top-slot"]',
    '[cel_widget_id*="sb-"]',
    '[id^="CardInstance"]'
  ];

  function isSponsoredMarker(el) {
    if (!(el instanceof Element)) return false;

    const aria = el.getAttribute('aria-label') || '';
    const text = el.textContent || '';

    return SPONSORED_ARIA_RE.test(aria) || SPONSORED_TEXT_RE.test(text);
  }

  function findAdContainer(marker) {
    for (const selector of CONTAINER_SELECTORS) {
      const container = marker.closest(selector);
      if (container) return container;
    }

    // Fallback: walk up a few levels rather than hiding the whole page.
    let node = marker;
    for (let i = 0; i < 8 && node.parentElement; i++) {
      node = node.parentElement;
    }
    return node;
  }

  function hideSponsored(root = document) {
    const possibleMarkers = root.querySelectorAll(`
      [aria-label*="Sponsored" i],
      span,
      a,
      div
    `);

    for (const el of possibleMarkers) {
      if (!isSponsoredMarker(el)) continue;

      const container = findAdContainer(el);
      if (container && container !== document.body && container !== document.documentElement) {
        container.classList.add(HIDDEN_CLASS);
      }
    }
  }

  function debounce(fn, delay = 150) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  const scan = debounce(() => hideSponsored(document), 100);

  hideSponsored(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          hideSponsored(node);
        }
      }
    }

    scan();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
