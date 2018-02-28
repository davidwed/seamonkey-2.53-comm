Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var CC = Components.Constructor;

// Ensure the profile directory is set up
do_get_profile();

// Import the required setup scripts.
load("../../../resources/abSetup.js");

// Import the script with basic import functions
load("resources/import_helper.js");

do_register_cleanup(function() {
  load("../../../resources/mailShutdown.js");
});
