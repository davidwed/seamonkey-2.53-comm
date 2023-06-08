/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = "testTimezones";
var RELATIVE_ROOT = "./shared-modules";
var MODULE_REQUIRES = ["calendar-utils"];

var helpersForController, invokeEventDialog, switchToView, goToDate, setData;
var findEventsInNode, viewForward, viewBack, CANVAS_BOX, TIMEOUT_MODAL_DIALOG;
var plan_for_modal_dialog, wait_for_modal_dialog;

var DATES = [
    [2009, 1, 1], [2009, 4, 2], [2009, 4, 16], [2009, 4, 30],
    [2009, 7, 2], [2009, 10, 15], [2009, 10, 29], [2009, 11, 5]
];

var TIMEZONES = [
    "America/St_Johns", "America/Caracas", "America/Phoenix", "America/Los_Angeles",
    "America/Argentina/Buenos_Aires", "Europe/Paris", "Asia/Kathmandu", "Australia/Adelaide"
];

ChromeUtils.import("resource://gre/modules/Preferences.jsm");

function setupModule(module) {
    controller = mozmill.getMail3PaneController();
    ({
        helpersForController,
        invokeEventDialog,
        switchToView,
        goToDate,
        setData,
        findEventsInNode,
        viewForward,
        viewBack,
        CANVAS_BOX,
        TIMEOUT_MODAL_DIALOG
    } = collector.getModule("calendar-utils"));
    collector.getModule("calendar-utils").setupModule();
    Object.assign(module, helpersForController(controller));

    ({ plan_for_modal_dialog, wait_for_modal_dialog } = collector.getModule("window-helpers"));
}

function testTimezones1_SetGMT() {
    Preferences.set("calendar.timezone.local", "Europe/London");
}

function testTimezones2_CreateEvents() {
    controller.click(eid("calendar-tab-button"));
    switchToView(controller, "day");
    goToDate(controller, 2009, 1, 1);

    // create weekly recurring events in all TIMEZONES
    let times = [[4, 30], [4, 30], [3, 0], [3, 0], [9, 0], [14, 0], [19, 45], [1, 30]];
    let time = new Date();
    for (let i = 0; i < TIMEZONES.length; i++) {
        let eventBox = lookupEventBox("day", CANVAS_BOX, null, 1, i + 8);
        invokeEventDialog(controller, eventBox, (event, iframe) => {
            time.setHours(times[i][0]);
            time.setMinutes(times[i][1]);

            // set timezone
            setTimezone(event, TIMEZONES[i]);

            // set title and repeat
            setData(event, iframe, { title: TIMEZONES[i], repeat: "weekly", starttime: time });

            // save
            let { eid: eventid } = helpersForController(event);
            event.click(eventid("button-saveandclose"));
        });
    }
}

function testTimezones3_checkStJohns() {
    Preferences.set("calendar.timezone.local", "America/St_Johns");
    let times = [
        [[4, 30], [5, 30], [6, 30], [7, 30], [8, 30], [9, 30], [10, 30], [11, 30]],
        [[4, 30], [6, 30], [7, 30], [7, 30], [9, 30], [9, 30], [11, 30], [12, 30]],
        [[4, 30], [6, 30], [7, 30], [7, 30], [9, 30], [9, 30], [11, 30], [13, 30]],
        [[4, 30], [6, 30], [7, 30], [7, 30], [9, 30], [9, 30], [11, 30], [13, 30]],
        [[4, 30], [6, 30], [7, 30], [7, 30], [9, 30], [9, 30], [11, 30], [13, 30]],
        [[4, 30], [6, 30], [7, 30], [7, 30], [9, 30], [9, 30], [11, 30], [12, 30]],
        [[4, 30], [6, 30], [7, 30], [7, 30], [9, 30], [10, 30], [11, 30], [12, 30]],
        [[4, 30], [5, 30], [6, 30], [7, 30], [8, 30], [9, 30], [10, 30], [11, 30]]
    ];
    controller.click(eid("calendar-tab-button"));
    switchToView(controller, "day");
    goToDate(controller, 2009, 1, 1);

    verify(controller, DATES, TIMEZONES, times);
}

function testTimezones4_checkCaracas() {
    Preferences.set("calendar.timezone.local", "America/Caracas");
    // This is actually incorrect. Venezuela shifted clocks forward 30 minutes
    // in 2016, but our code doesn't handle historical timezones.
    let times = [
        [[4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0]],
        [[3, 0], [5, 0], [6, 0], [6, 0], [8, 0], [8, 0], [10, 0], [11, 0]],
        [[3, 0], [5, 0], [6, 0], [6, 0], [8, 0], [8, 0], [10, 0], [12, 0]],
        [[3, 0], [5, 0], [6, 0], [6, 0], [8, 0], [8, 0], [10, 0], [12, 0]],
        [[3, 0], [5, 0], [6, 0], [6, 0], [8, 0], [8, 0], [10, 0], [12, 0]],
        [[3, 0], [5, 0], [6, 0], [6, 0], [8, 0], [8, 0], [10, 0], [11, 0]],
        [[3, 0], [5, 0], [6, 0], [6, 0], [8, 0], [9, 0], [10, 0], [11, 0]],
        [[4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0]]
    ];
    controller.click(eid("calendar-tab-button"));
    switchToView(controller, "day");
    goToDate(controller, 2009, 1, 1);

    verify(controller, DATES, TIMEZONES, times);
}

function testTimezones5_checkPhoenix() {
    Preferences.set("calendar.timezone.local", "America/Phoenix");
    let times = [
        [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [5, 0], [7, 0], [8, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [5, 0], [7, 0], [9, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [5, 0], [7, 0], [9, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [5, 0], [7, 0], [9, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [5, 0], [7, 0], [8, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [6, 0], [7, 0], [8, 0]],
        [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]]
    ];
    controller.click(eid("calendar-tab-button"));
    switchToView(controller, "day");
    goToDate(controller, 2009, 1, 1);

    verify(controller, DATES, TIMEZONES, times);
}

function testTimezones6_checkLosAngeles() {
    Preferences.set("calendar.timezone.local", "America/Los_Angeles");
    let times = [
        [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [5, 0], [7, 0], [8, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [5, 0], [7, 0], [9, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [5, 0], [7, 0], [9, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [5, 0], [7, 0], [9, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [5, 0], [7, 0], [8, 0]],
        [[0, 0], [2, 0], [3, 0], [3, 0], [5, 0], [6, 0], [7, 0], [8, 0]],
        [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]]
    ];
    controller.click(eid("calendar-tab-button"));
    switchToView(controller, "day");
    goToDate(controller, 2009, 1, 1);

    verify(controller, DATES, TIMEZONES, times);
}

function testTimezones7_checkBuenosAires() {
    Preferences.set("calendar.timezone.local", "America/Argentina/Buenos_Aires");
    let times = [
        [[5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0]],
        [[4, 0], [6, 0], [7, 0], [7, 0], [9, 0], [9, 0], [11, 0], [12, 0]],
        [[4, 0], [6, 0], [7, 0], [7, 0], [9, 0], [9, 0], [11, 0], [13, 0]],
        [[4, 0], [6, 0], [7, 0], [7, 0], [9, 0], [9, 0], [11, 0], [13, 0]],
        [[4, 0], [6, 0], [7, 0], [7, 0], [9, 0], [9, 0], [11, 0], [13, 0]],
        [[4, 0], [6, 0], [7, 0], [7, 0], [9, 0], [9, 0], [11, 0], [12, 0]],
        [[4, 0], [6, 0], [7, 0], [7, 0], [9, 0], [10, 0], [11, 0], [12, 0]],
        [[5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0]]
    ];
    controller.click(eid("calendar-tab-button"));
    switchToView(controller, "day");
    goToDate(controller, 2009, 1, 1);

    verify(controller, DATES, TIMEZONES, times);
}

function testTimezones8_checkParis() {
    Preferences.set("calendar.timezone.local", "Europe/Paris");
    let times = [
        [[9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0], [16, 0]],
        [[9, 0], [11, 0], [12, 0], [12, 0], [14, 0], [14, 0], [16, 0], [17, 0]],
        [[9, 0], [11, 0], [12, 0], [12, 0], [14, 0], [14, 0], [16, 0], [18, 0]],
        [[9, 0], [11, 0], [12, 0], [12, 0], [14, 0], [14, 0], [16, 0], [18, 0]],
        [[9, 0], [11, 0], [12, 0], [12, 0], [14, 0], [14, 0], [16, 0], [18, 0]],
        [[9, 0], [11, 0], [12, 0], [12, 0], [14, 0], [14, 0], [16, 0], [17, 0]],
        [[8, 0], [10, 0], [11, 0], [11, 0], [13, 0], [14, 0], [15, 0], [16, 0]],
        [[9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0], [16, 0]]
    ];
    controller.click(eid("calendar-tab-button"));
    switchToView(controller, "day");
    goToDate(controller, 2009, 1, 1);

    verify(controller, DATES, TIMEZONES, times);
}

function testTimezones9_checkKathmandu() {
    Preferences.set("calendar.timezone.local", "Asia/Kathmandu");
    let times = [
        [[13, 45], [14, 45], [15, 45], [16, 45], [17, 45], [18, 45], [19, 45], [20, 45]],
        [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [17, 45], [19, 45], [20, 45]],
        [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [17, 45], [19, 45], [21, 45]],
        [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [17, 45], [19, 45], [21, 45]],
        [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [17, 45], [19, 45], [21, 45]],
        [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [17, 45], [19, 45], [20, 45]],
        [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [18, 45], [19, 45], [20, 45]],
        [[13, 45], [14, 45], [15, 45], [16, 45], [17, 45], [18, 45], [19, 45], [20, 45]]
    ];
    controller.click(eid("calendar-tab-button"));
    switchToView(controller, "day");
    goToDate(controller, 2009, 1, 1);

    verify(controller, DATES, TIMEZONES, times);
}

function testTimezones10_checkAdelaide() {
    Preferences.set("calendar.timezone.local", "Australia/Adelaide");
    let times = [
        [[18, 30], [19, 30], [20, 30], [21, 30], [22, 30], [23, 30], [0, 30, +1], [1, 30, +1]],
        [[17, 30], [19, 30], [20, 30], [20, 30], [22, 30], [22, 30], [0, 30, +1], [1, 30, +1]],
        [[16, 30], [18, 30], [19, 30], [19, 30], [21, 30], [21, 30], [23, 30], [1, 30, +1]],
        [[16, 30], [18, 30], [19, 30], [19, 30], [21, 30], [21, 30], [23, 30], [1, 30, +1]],
        [[16, 30], [18, 30], [19, 30], [19, 30], [21, 30], [21, 30], [23, 30], [1, 30, +1]],
        [[17, 30], [19, 30], [20, 30], [20, 30], [22, 30], [22, 30], [0, 30, +1], [1, 30, +1]],
        [[17, 30], [19, 30], [20, 30], [20, 30], [22, 30], [23, 30], [0, 30, +1], [1, 30, +1]],
        [[18, 30], [19, 30], [20, 30], [21, 30], [22, 30], [23, 30], [0, 30, +1], [1, 30, +1]]
    ];
    controller.click(eid("calendar-tab-button"));
    switchToView(controller, "day");
    goToDate(controller, 2009, 1, 1);

    verify(controller, DATES, TIMEZONES, times);
}

function teardownTest(module) {
}

function setTimezone(event, timezone) {
    let { eid: eventid } = helpersForController(event);

    if (eventid("timezone-starttime").getNode().collapsed) {
        let menuitem = eventid("options-timezones-menuitem");
        event.click(menuitem);
    }

    plan_for_modal_dialog("Calendar:EventDialog:Timezone", eventCallback.bind(null, timezone));
    event.waitForElement(eventid("timezone-starttime"));
    event.click(eventid("timezone-starttime"));
    event.click(eventid("timezone-starttime"));
    event.waitForElement(eventid("timezone-custom-menuitem"));
    event.click(eventid("timezone-custom-menuitem"));
    wait_for_modal_dialog("Calendar:EventDialog:Timezone", TIMEOUT_MODAL_DIALOG);
}

function eventCallback(zone, tzcontroller) {
    let { lookup: tzlookup, xpath: tzpath } = helpersForController(tzcontroller);

    let item = tzpath(`
        /*[name()='dialog']/*[name()='menulist'][1]/*[name()='menupopup'][1]/
        *[@value='${zone}']
    `);
    tzcontroller.waitForElement(item);
    tzcontroller.click(item);
    tzcontroller.click(tzlookup(`
        /id("calendar-event-dialog-timezone")/anon({"anonid":"buttons"})/
        {"dlgtype":"accept"}
    `));
}

function verify(controller, dates, timezones, times) {
    function* datetimes() {
        for (let idx = 0; idx < dates.length; idx++) {
            yield [dates[idx][0], dates[idx][1], dates[idx][2], times[idx]];
        }
    }

    let { lookup } = helpersForController(controller);

    let dayView = `
        /id("messengerWindow")/id("tabmail-container")/id("tabmail")/
        id("tabpanelcontainer")/id("calendarTabPanel")/id("calendarContent")/
        id("calendarDisplayDeck")/id("calendar-view-box")/id("view-deck")/
        id("day-view")
    `;
    let dayStack = `
        ${dayView}/anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/
        anon({"anonid":"daybox"})/[0]/anon({"anonid":"boxstack"})/
        anon({"anonid":"topbox"})/{"flex":"1"}
    `;
    let timeLine = `
        ${dayView}/anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/
        anon({"anonid":"timebar"})/anon({"anonid":"topbox"})
    `;
    let allowedDifference = 3;

    /* Event box' time can't be deduced from it's position in                    ----------------
       xul element tree because for each event a box is laid over whole day and  |___spacer_____|
       a spacer is added to push the event to it's correct location.             |__event_box___|
       But timeline can be used to retrieve the position of a particular hour    |day continues |
       on screen and it can be compared against the position of the event.       ----------------
    */

    for (let [selectedYear, selectedMonth, selectedDay, selectedTime] of datetimes()) {
        goToDate(controller, selectedYear, selectedMonth, selectedDay);

        // find event with timezone tz
        for (let tzIdx = 0; tzIdx < timezones.length; tzIdx++) {
            let [correctHour, minutes, day] = selectedTime[tzIdx];

            let timeNode = lookup(`${timeLine}/[${correctHour}]`).getNode();
            let timeY = timeNode.boxObject.y + timeNode.boxObject.height * (minutes / 60);

            let eventNodes = [];

            // following day
            if (day == 1) {
                viewForward(controller, 1);
            } else if (day == -1) {
                viewBack(controller, 1);
            }

            let stackNode = lookup(dayStack);
            controller.waitForElement(stackNode);
            stackNode = stackNode.getNode();

            findEventsInNode(stackNode, eventNodes);
            eventNodes = eventNodes.filter(node => node.mOccurrence.title == timezones[tzIdx])
                                   .map(node => node.boxObject.y);

            dump(`Looking for ${timezones[tzIdx]} at ${timeY}: found `);
            dump(eventNodes.join(", ") + "\n");

            if (day != undefined && day == 1) {
                viewBack(controller, 1);
            }

            if (day != undefined && day == -1) {
                viewForward(controller, 1);
            }

            controller.assertJS(() => eventNodes.some(node => Math.abs(timeY - node) < allowedDifference));
        }
    }
}
