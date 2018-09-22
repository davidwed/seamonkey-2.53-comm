/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://calendar/modules/calUtils.jsm");

/**
 * ICS Import and Export Plugin
 */

// Shared functions
function getIcsFileTypes(aCount) {
    aCount.value = 1;
    return [{
        QueryInterface: XPCOMUtils.generateQI([Ci.calIFileType]),
        defaultExtension: "ics",
        extensionFilter: "*.ics",
        description: cal.l10n.getCalString("filterIcs", ["*.ics"])
    }];
}

// Importer
function calIcsImporter() {
    this.wrappedJSObject = this;
}

var calIcsImporterClassID = Components.ID("{1e3e33dc-445a-49de-b2b6-15b2a050bb9d}");
var calIcsImporterInterfaces = [Ci.calIImporter];
calIcsImporter.prototype = {
    classID: calIcsImporterClassID,
    QueryInterface: XPCOMUtils.generateQI(calIcsImporterInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calIcsImporterClassID,
        contractID: "@mozilla.org/calendar/import;1?type=ics",
        classDescription: "Calendar ICS Importer",
        interfaces: calIcsImporterInterfaces
    }),

    getFileTypes: getIcsFileTypes,

    importFromStream: function(aStream, aCount) {
        let parser = Cc["@mozilla.org/calendar/ics-parser;1"]
                       .createInstance(Ci.calIIcsParser);
        parser.parseFromStream(aStream, null);
        return parser.getItems(aCount);
    }
};

// Exporter
function calIcsExporter() {
    this.wrappedJSObject = this;
}

var calIcsExporterClassID = Components.ID("{a6a524ce-adff-4a0f-bb7d-d1aaad4adc60}");
var calIcsExporterInterfaces = [Ci.calIExporter];
calIcsExporter.prototype = {
    classID: calIcsExporterClassID,
    QueryInterface: XPCOMUtils.generateQI(calIcsExporterInterfaces),

    classInfo: XPCOMUtils.generateCI({
        classID: calIcsExporterClassID,
        contractID: "@mozilla.org/calendar/export;1?type=ics",
        classDescription: "Calendar ICS Exporter",
        interfaces: calIcsExporterInterfaces
    }),

    getFileTypes: getIcsFileTypes,

    exportToStream: function(aStream, aCount, aItems) {
        let serializer = Cc["@mozilla.org/calendar/ics-serializer;1"]
                           .createInstance(Ci.calIIcsSerializer);
        serializer.addItems(aItems, aItems.length);
        serializer.serializeToStream(aStream);
    }
};
