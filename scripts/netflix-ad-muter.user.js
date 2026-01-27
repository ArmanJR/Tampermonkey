// ==UserScript==
// @name         Netflix Ad Muter
// @namespace    http://github.com/armanjr/tampermonkey
// @version      1.0
// @author       ArmanJR 
// @description  Auto-mute Netflix ads and restore volume when content resumes
// @match        https://www.netflix.com/watch/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let savedVolume = 1;
    let isMutedByScript = false;

    function getVideo() {
        return document.querySelector('video');
    }

    function isAdPlaying() {
        return document.querySelector('[data-uia="ads-info-text"]') !== null;
    }

    function muteForAd() {
        const video = getVideo();
        if (!video) return;

        if (!isMutedByScript && !video.muted) {
            savedVolume = video.volume;
            video.muted = true;
            isMutedByScript = true;
            console.log('[Netflix Ad Muter] Ad detected - muted');
        }
    }

    function restoreVolume() {
        const video = getVideo();
        if (!video) return;

        if (isMutedByScript) {
            video.muted = false;
            video.volume = savedVolume;
            isMutedByScript = false;
            console.log('[Netflix Ad Muter] Ad ended - volume restored');
        }
    }

    function checkAdState() {
        if (isAdPlaying()) {
            muteForAd();
        } else {
            restoreVolume();
        }
    }

    // Initial check
    checkAdState();

    // Observe DOM changes for ad indicator
    const observer = new MutationObserver(checkAdState);
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
