/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["calendar-utils"];

ChromeUtils.import("resource://calendar/modules/calUtils.jsm");

var helpersForController, invokeEventDialog, createCalendar, deleteCalendars;
var switchToView, goToDate, viewForward, handleOccurrencePrompt;
var CALENDARNAME, EVENT_BOX, CANVAS_BOX;

var modalDialog = require("../shared-modules/modal-dialog");
var utils = require("../shared-modules/utils");

var ENDDATE = new Date(2009, 0, 26); // last Monday in month
var HOUR = 8;
var EVENTPATH = `/{"tooltip":"itemTooltip","calendar":"${CALENDARNAME.toLowerCase()}"}`;

function setupModule(module) {
    controller = mozmill.getMail3PaneController();
    ({
        helpersForController,
        invokeEventDialog,
        createCalendar,
        deleteCalendars,
        switchToView,
        goToDate,
        viewForward,
        handleOccurrencePrompt,
        CALENDARNAME,
        EVENT_BOX,
        CANVAS_BOX
    } = collector.getModule("calendar-utils"));
    collector.getModule("calendar-utils").setupModule();
    Object.assign(module, helpersForController(controller));

    createCalendar(controller, CALENDARNAME);
}

function testWeeklyUntilRecurrence() {
    controller.click(eid("calendar-tab-button"));
    switchToView(controller, "day");
    goToDate(controller, 2009, 1, 5); // Monday

    // rotate view
    controller.mainMenu.click("#ltnViewRotated");
    controller.waitFor(() => eid("day-view").getNode().orient == "horizontal");

    // create weekly recurring event
    let eventBox = lookupEventBox(controller, "day", CANVAS_BOX, null, 1, HOUR);
    invokeEventDialog(controller, eventBox, (event, iframe) => {
        let { eid: eventid } = helpersForController(event);

        let dialog = new modalDialog.modalDialog(event.window);
        dialog.start(setRecurrence);
        event.waitForElement(eventid("item-repeat"));
        event.select(eventid("item-repeat"), null, null, "custom");

        event.click(eventid("button-saveandclose"));
    });

    let box = getEventBoxPath(controller, "day", EVENT_BOX, null, 1, HOUR) + EVENTPATH;

    // check day view
    for (let week = 0; week < 3; week++) {
        // Monday
        controller.assertNode(lookup(box));
        viewForward(controller, 2);

        // Wednesday
        controller.assertNode(lookup(box));
        viewForward(controller, 2);

        // Friday
        controller.assertNode(lookup(box));
        viewForward(controller, 3);
    }

    // Monday, last occurrence
    controller.assertNode(lookup(box));
    viewForward(controller, 2);

    // Wednesday
    controller.assertNodeNotExist(lookup(box));
    viewForward(controller, 2);

    // check week view
    switchToView(controller, "week");
    goToDate(controller, 2009, 1, 5);
    for (let week = 0; week < 3; week++) {
        // Monday
        controller.assertNode(
            lookupEventBox(controller, "week", EVENT_BOX, null, 2, HOUR, EVENTPATH)
        );

        controller.assertNode(
            lookupEventBox(controller, "week", EVENT_BOX, null, 4, HOUR, EVENTPATH)
        );

        // Friday
        controller.assertNode(
            lookupEventBox(controller, "week", EVENT_BOX, null, 6, HOUR, EVENTPATH)
        );

        viewForward(controller, 1);
    }

    // Monday, last occurrence
    controller.assertNode(
        lookupEventBox(controller, "week", EVENT_BOX, null, 2, HOUR, EVENTPATH)
    );

    // Wednesday
    controller.assertNodeNotExist(
        lookupEventBox(controller, "week", EVENT_BOX, null, 4, HOUR, EVENTPATH)
    );

    // check multiweek view
    switchToView(controller, "multiweek");
    goToDate(controller, 2009, 1, 5);
    checkMultiWeekView("multiweek");

    // check month view
    switchToView(controller, "month");
    goToDate(controller, 2009, 1, 5);
    checkMultiWeekView("month");

    // delete event
    box = getEventBoxPath(controller, "month", EVENT_BOX, 2, 2, null) + EVENTPATH;
    controller.click(lookup(box));
    handleOccurrencePrompt(controller, eid("month-view"), "delete", true, false);
    controller.waitForElementNotPresent(lookup(box));

    // reset view
    switchToView(controller, "day");
    controller.mainMenu.click("#ltnViewRotated");
    controller.waitFor(() => eid("day-view").getNode().orient == "vertical");
}

function setRecurrence(recurrence) {
    let { lookup: reclookup, eid: recid } = helpersForController(recurrence);

    // weekly
    recurrence.waitForElement(recid("period-list"));
    recurrence.select(recid("period-list"), null, null, "1");
    recurrence.sleep(sleep);

    let mon = utils.getProperty("chrome://calendar/locale/dateFormat.properties", "day.2.Mmm");
    let wed = utils.getProperty("chrome://calendar/locale/dateFormat.properties", "day.4.Mmm");
    let fri = utils.getProperty("chrome://calendar/locale/dateFormat.properties", "day.6.Mmm");

    let days = `
        /id("calendar-event-dialog-recurrence")/id("recurrence-pattern-groupbox")/
        id("recurrence-pattern-grid")/id("recurrence-pattern-rows")/
        id("recurrence-pattern-period-row")/id("period-deck")/
        id("period-deck-weekly-box")/[1]/id("daypicker-weekday")/
        anon({"anonid":"mainbox"})
    `;

    // starting from Monday so it should be checked
    recurrence.assertChecked(reclookup(`${days}/{"label":"${mon}"}`));

    // check Wednesday and Friday too
    recurrence.click(reclookup(`${days}/{"label":"${wed}"}`));
    recurrence.click(reclookup(`${days}/{"label":"${fri}"}`));

    // set until date
    recurrence.click(recid("recurrence-range-until"));
    let input = `
        /id("calendar-event-dialog-recurrence")/id("recurrence-range-groupbox")/[1]/
        id("recurrence-duration")/id("recurrence-range-until-box")/
        id("repeat-until-date")/anon({"class":"datepicker-box-class"})/
        {"class":"datepicker-text-class"}/
        anon({"class":"menulist-editable-box textbox-input-box"})/
        anon({"anonid":"input"})
    `;

    // delete previous date
    recurrence.keypress(reclookup(input), "a", { ctrlKey: true });
    recurrence.keypress(reclookup(input), "VK_DELETE", {});

    let dateFormatter = cal.getDateFormatter();

    let endDateString = dateFormatter.formatDateShort(cal.dtz.jsDateToDateTime(ENDDATE, cal.dtz.floating));

    recurrence.type(reclookup(input), endDateString);

    // close dialog
    recurrence.click(reclookup(`
        /id("calendar-event-dialog-recurrence")/anon({"anonid":"buttons"})/
        {"dlgtype":"accept"}
    `));
}

function checkMultiWeekView(view) {
    let startWeek = 1;

    // in month view event starts from 2nd row
    if (view == "month") {
        startWeek++;
    }

    for (let week = startWeek; week < startWeek + 3; week++) {
        // Monday
        controller.assertNode(
            lookupEventBox(controller, view, EVENT_BOX, week, 2, null, EVENTPATH)
        );

        // Wednesday
        controller.assertNode(
            lookupEventBox(controller, view, EVENT_BOX, week, 4, null, EVENTPATH)
        );

        // Friday
        controller.assertNode(
            lookupEventBox(controller, view, EVENT_BOX, week, 6, null, EVENTPATH)
        );
    }

    // Monday, last occurrence
    controller.assertNode(
        lookupEventBox(controller, view, EVENT_BOX, startWeek + 3, 2, null, EVENTPATH)
    );

    // Wednesday
    controller.assertNodeNotExist(
        lookupEventBox(controller, view, EVENT_BOX, startWeek + 3, 4, null, EVENTPATH)
    );
}

function teardownTest(module) {
    deleteCalendars(controller, CALENDARNAME);
}
