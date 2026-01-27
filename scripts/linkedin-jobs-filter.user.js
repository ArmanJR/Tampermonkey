// ==UserScript==
// @name         LinkedIn Jobs Filter
// @namespace    http://github.com/armanjr/tampermonkey
// @version      1.0
// @description  Hide viewed, applied, and Easy Apply jobs on LinkedIn Jobs page
// @author       ArmanJR
// @match        https://www.linkedin.com/jobs/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // ============ CONFIGURATION ============
  const CONFIG = {
    hideViewed: true, // Set to true to hide jobs you've viewed
    hideApplied: true, // Set to true to hide jobs you've applied to
    hideEasyApply: true, // Set to true to hide "Easy Apply" jobs
    debugMode: true, // Set to true to see console logs
  };
  // =======================================

  const log = (...args) => {
    if (CONFIG.debugMode) {
      console.log("[LinkedIn Jobs Filter]", ...args);
    }
  };

  const hideJobCard = (element) => {
    // Find the closest job card container
    const jobCard =
      element.closest('[data-view-name="job-card"]') ||
      element.closest("li") ||
      element.closest('[class*="job-card"]');

    if (jobCard && jobCard.style.display !== "none") {
      jobCard.style.display = "none";
      log("Hidden job card");
      return true;
    }
    return false;
  };

  const processJobCards = () => {
    let hiddenCount = 0;

    // Find all job card elements
    const jobCards = document.querySelectorAll('[data-view-name="job-card"]');

    jobCards.forEach((card) => {
      if (card.style.display === "none") return;

      const textContent = card.textContent.toLowerCase();

      // Check for "Viewed" status
      if (CONFIG.hideViewed) {
        // LinkedIn typically shows "Viewed X days ago" or just "Viewed"
        if (textContent.includes("viewed")) {
          card.style.display = "none";
          hiddenCount++;
          log("Hidden viewed job");
          return;
        }
      }

      // Check for "Applied" status
      if (CONFIG.hideApplied) {
        // LinkedIn shows "Applied" for jobs you've applied to
        if (textContent.includes("applied")) {
          card.style.display = "none";
          hiddenCount++;
          log("Hidden applied job");
          return;
        }
      }

      // Check for "Easy Apply" jobs
      if (CONFIG.hideEasyApply) {
        if (textContent.includes("easy apply")) {
          card.style.display = "none";
          hiddenCount++;
          log("Hidden Easy Apply job");
          return;
        }
      }
    });

    // Also search within list items that might contain job cards
    const listItems = document.querySelectorAll("li");
    listItems.forEach((li) => {
      if (li.style.display === "none") return;
      if (li.querySelector('[data-view-name="job-card"]')) return; // Already processed

      const textContent = li.textContent.toLowerCase();

      // Check if this looks like a job listing
      const hasJobLink = li.querySelector('a[href*="/jobs/"]');
      if (!hasJobLink) return;

      if (CONFIG.hideViewed && textContent.includes("viewed")) {
        li.style.display = "none";
        hiddenCount++;
        log("Hidden viewed job (li)");
        return;
      }

      if (CONFIG.hideApplied && textContent.includes("applied")) {
        li.style.display = "none";
        hiddenCount++;
        log("Hidden applied job (li)");
        return;
      }

      if (CONFIG.hideEasyApply && textContent.includes("easy apply")) {
        li.style.display = "none";
        hiddenCount++;
        log("Hidden Easy Apply job (li)");
        return;
      }
    });

    if (hiddenCount > 0) {
      log(`Hidden ${hiddenCount} jobs`);
    }
  };

  // Debounce function to avoid excessive processing
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  const debouncedProcess = debounce(processJobCards, 300);

  // Set up MutationObserver to watch for dynamic content changes
  const setupObserver = () => {
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
          break;
        }
      }

      if (shouldProcess) {
        debouncedProcess();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    log("Observer set up");
  };

  // Initial processing after page load
  const init = () => {
    log("Initializing with config:", CONFIG);

    // Process immediately
    processJobCards();

    // Set up observer for dynamic content
    setupObserver();

    // Also reprocess periodically as a fallback
    setInterval(processJobCards, 2000);
  };

  // Wait for page to be ready
  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }

  // Also handle URL changes (LinkedIn uses client-side navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      log("URL changed, reprocessing...");
      setTimeout(processJobCards, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
})();

