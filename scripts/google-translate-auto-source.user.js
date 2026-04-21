// ==UserScript==
// @name         Google Translate Auto Source Language
// @namespace    http://github.com/armanjr/tampermonkey
// @version      1.2
// @author       ArmanJR
// @description  Auto-switch Google Translate source language between English and Persian based on the script of the typed text, bypassing the transliteration IME. Also tints the page with a soft parchment background.
// @match        https://translate.google.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[GT-AutoSource]';
    const log = (...a) => console.log(LOG, ...a);
    const warn = (...a) => console.warn(LOG, ...a);

    const FONT_STACK = "'Vazirmatn', 'Google Sans', Roboto, system-ui, sans-serif";
    const LARGE_FONT_SIZE = '1.5rem';

    // Dark mode via filter inversion: flips the whole page dark in one shot,
    // then double-inverts media so images/avatars/video look normal again.
    function injectTheme() {
        const fontsLink = document.createElement('link');
        fontsLink.rel = 'stylesheet';
        fontsLink.href = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap';
        (document.head || document.documentElement).appendChild(fontsLink);

        const style = document.createElement('style');
        style.id = 'gt-autosource-theme';
        style.textContent = `
            html {
                filter: invert(1) hue-rotate(180deg) !important;
                background: #111 !important;
            }
            img, video, iframe, svg, canvas, picture,
            [style*="url("], [style*="background-image"] {
                filter: invert(1) hue-rotate(180deg) !important;
            }
            html, body, button, input, textarea, select,
            c-wiz, c-wiz * {
                font-family: ${FONT_STACK} !important;
            }
            /* Preserve Material Icons so ligatures like <i>clear</i> render
               as glyphs instead of the word "clear". */
            i, .material-icons, .material-icons-extended,
            [class*="material-icons"], [class*="material-symbols"],
            [class*="google-symbols"], [class*="google-material"] {
                font-family: 'Google Material Icons', 'Google Symbols',
                    'Material Icons', 'Material Symbols Outlined',
                    'Material Icons Extended' !important;
            }
            textarea[aria-label="Source text"],
            span[lang] {
                font-size: ${LARGE_FONT_SIZE} !important;
                line-height: 1.5 !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
        log('Dark theme + Vazirmatn injected.');
    }
    injectTheme();

    // Persian sits in the Arabic Unicode blocks.
    const PERSIAN_RE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
    const LATIN_RE = /[A-Za-z]/;

    const LANG_NAMES = { en: 'English', fa: 'Persian' };
    const SWITCH_COOLDOWN_MS = 400;
    const FLUSH_TIMEOUT_MS = 1500;

    let switching = false;
    let lastSwitchAt = 0;

    function detectScriptOfText(text) {
        if (PERSIAN_RE.test(text)) return 'fa';
        if (LATIN_RE.test(text)) return 'en';
        return null;
    }

    function detectScriptOfKey(key) {
        if (typeof key !== 'string' || key.length !== 1) return null;
        if (PERSIAN_RE.test(key)) return 'fa';
        if (LATIN_RE.test(key)) return 'en';
        return null;
    }

    function getSourceTextarea() {
        return document.querySelector('textarea[aria-label="Source text"]');
    }

    function getCurrentSourceLang() {
        const textarea = getSourceTextarea();
        if (!textarea) return null;
        const langSpan = textarea.closest('span[lang]');
        return langSpan ? langSpan.getAttribute('lang') : null;
    }

    function getSourceTablist() {
        // Source tablist is the first role=tablist in the document; target is the second.
        return document.querySelector('div[role="tablist"]');
    }

    function findSourceTab(langName) {
        const tablist = getSourceTablist();
        if (!tablist) return null;
        for (const tab of tablist.querySelectorAll('button[role="tab"]')) {
            if (tab.textContent.trim() === langName) return tab;
        }
        return null;
    }

    function clickSourceTab(langCode) {
        const langName = LANG_NAMES[langCode];
        if (!langName) {
            warn('Unsupported language code:', langCode);
            return false;
        }
        const tab = findSourceTab(langName);
        if (!tab) {
            warn(`Source tab for "${langName}" not found in the recent-languages tablist. ` +
                 'It may have been demoted from the recent list.');
            return false;
        }
        log(`Clicking source tab: ${langName} (${langCode}).`);
        tab.click();
        return true;
    }

    function requestSwitch(langCode) {
        const now = Date.now();
        if (switching) {
            log('Switch already in progress; request skipped.');
            return;
        }
        if (getCurrentSourceLang() === langCode) return;
        if (now - lastSwitchAt < SWITCH_COOLDOWN_MS) {
            log('Within cooldown; request skipped.');
            return;
        }
        if (!clickSourceTab(langCode)) return;
        switching = true;
        lastSwitchAt = now;
        setTimeout(() => { switching = false; }, SWITCH_COOLDOWN_MS);
    }

    // Native value setter so React-style controlled components still see updates.
    const textareaValueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
    ).set;

    function appendToTextarea(ta, text) {
        const newValue = (ta.value || '') + text;
        textareaValueSetter.call(ta, newValue);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        try {
            ta.focus();
            ta.setSelectionRange(newValue.length, newValue.length);
        } catch (e) {
            // setSelectionRange can throw if element is detached; harmless.
        }
    }

    // Pending chars waiting for the source language to match before being inserted.
    const pending = [];
    let flushScheduled = false;

    function enqueue(langCode, char) {
        pending.push({ lang: langCode, char, at: Date.now() });
        scheduleFlush();
    }

    function scheduleFlush() {
        if (flushScheduled) return;
        flushScheduled = true;
        const tick = () => {
            if (pending.length === 0) {
                flushScheduled = false;
                return;
            }
            // Drop entries that have been waiting too long (switch never landed).
            while (pending.length && Date.now() - pending[0].at > FLUSH_TIMEOUT_MS) {
                const dropped = pending.shift();
                warn('Dropping buffered char (timeout):', JSON.stringify(dropped.char));
            }
            const ta = getSourceTextarea();
            const current = getCurrentSourceLang();
            if (ta && current && pending[0] && pending[0].lang === current) {
                let chunk = '';
                while (pending.length && pending[0].lang === current) {
                    chunk += pending.shift().char;
                }
                if (chunk) {
                    appendToTextarea(ta, chunk);
                    log('Flushed buffered input:', JSON.stringify(chunk));
                }
            }
            if (pending.length) {
                requestAnimationFrame(tick);
            } else {
                flushScheduled = false;
            }
        };
        requestAnimationFrame(tick);
    }

    // Capture-phase keydown: preempts Google's transliteration IME by dropping
    // the keystroke before it bubbles, then re-inserts it into the textarea
    // after the source language has been switched.
    function handleKeydown(event) {
        const ta = event.target;
        if (!(ta instanceof HTMLTextAreaElement)) return;
        if (ta.getAttribute('aria-label') !== 'Source text') return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.isComposing) return;

        const typed = detectScriptOfKey(event.key);
        if (!typed) return;

        const current = getCurrentSourceLang();
        if (!current || current === typed) return;

        log(`Keydown mismatch: key=${JSON.stringify(event.key)} (${typed}), source=${current}. ` +
            'Preempting IME.');
        event.preventDefault();
        event.stopImmediatePropagation();

        requestSwitch(typed);
        enqueue(typed, event.key);
    }

    // Fallback for non-keydown flows (pasted text, etc.) where the textarea
    // already reflects the mismatched content.
    function handleInput(event) {
        const ta = event.target;
        if (!(ta instanceof HTMLTextAreaElement)) return;
        if (ta.getAttribute('aria-label') !== 'Source text') return;

        const value = ta.value;
        if (!value) return;

        const typed = detectScriptOfText(value);
        if (!typed) return;

        const current = getCurrentSourceLang();
        if (!current || current === typed) return;

        log(`Input mismatch: typed=${typed}, source=${current}. Switching.`);
        requestSwitch(typed);
    }

    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('input', handleInput, true);
    log('Loaded.');
})();
