/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["SearchIntegration"];

#ifdef XP_WIN
Cu.import("resource:///modules/WinSearchIntegration.js");

#else

#ifdef XP_MACOSX
Cu.import("resource:///modules/SpotlightIntegration.js");

#else
// Set SearchIntegration to null, as we don't have it
var SearchIntegration = null;
#endif

#endif
