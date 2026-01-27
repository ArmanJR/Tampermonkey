// ==UserScript==
// @name         Twitter font
// @namespace    http://github.com/armanjr/tampermonkey
// @version      0.1
// @description  Change twitter web font
// @author       ArmanJR
// @match        https://x.com/*
// @exclude      https://x.com/messages/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=twitter.com
// @grant        GM.addStyle
// ==/UserScript==

(function() {
    'use strict';
    GM.addStyle(".r-poiln3{font-family:Vazirmatn!important;font-weight:normal!important;}");
})();
