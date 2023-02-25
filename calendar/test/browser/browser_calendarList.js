/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

async function calendarListContextMenu(target, menuItem) {
    let contextMenu = document.getElementById("list-calendars-context-menu");
    EventUtils.synthesizeMouseAtCenter(target, { type: "contextmenu" });
    await BrowserTestUtils.waitForEvent(contextMenu, "popupshown");
    if (menuItem) {
        EventUtils.synthesizeMouseAtCenter(document.getElementById(menuItem), {});
        await BrowserTestUtils.waitForEvent(contextMenu, "popuphidden");
    }
}

async function withModalDialog(trigger, callback, whichButton) {
    let callbackPromise = new Promise(resolve => {
        Services.obs.addObserver({
            async observe(win) {
                Services.obs.removeObserver(this, "toplevel-window-ready");

                await BrowserTestUtils.waitForEvent(win, "load");
                await new Promise(res => win.setTimeout(res));

                info(`New window opened: ${win.location.href}`);
                if (callback) {
                    await callback(win);
                }

                let button = win.document.documentElement.getButton(whichButton);
                EventUtils.synthesizeMouseAtCenter(button, {}, win);
                resolve();
            }
        }, "toplevel-window-ready");
    });
    let triggerPromise = trigger();
    return Promise.all([callbackPromise, triggerPromise]);
}

async function withMockPromptService(response, callback) {
    let realPrompt = Services.prompt;
    Services.prompt = {
        QueryInterface: XPCOMUtils.generateQI([Ci.nsIPromptService]),
        confirmEx: (unused1, unused2, text) => {
            info(text);
            return response;
        },
    };
    await callback();
    Services.prompt = realPrompt;
}

add_task(async () => {
    function checkProperties(index, expected) {
        let calendarList = document.getElementById("calendar-list");
        let item = calendarList.itemChildren[index];
        let colorImage = item.querySelector(".calendar-color");
        for (let [key, expectedValue] of Object.entries(expected)) {
            switch (key) {
                case "id":
                    is(item.getAttribute("calendar-id"), expectedValue);
                    break;
                case "disabled":
                    is(item.querySelector(".calendar-displayed").disabled, expectedValue);
                    is(getComputedStyle(colorImage).filter != "none", expectedValue);
                    break;
                case "displayed":
                    is(item.querySelector(".calendar-displayed").checked, expectedValue);
                    break;
                case "color":
                    is(getComputedStyle(colorImage).backgroundColor, expectedValue);
                    break;
                case "name":
                    is(item.querySelector(".calendar-name").value, expectedValue);
                    break;
            }
        }
    }

    function checkDisplayed(...expected) {
        let calendarList = document.getElementById("calendar-list");
        for (let i = 0; i < calendarList.itemCount; i++) {
            is(calendarList.itemChildren[i].querySelector("checkbox").checked, expected.includes(i));
        }
    }

    let calendarList = document.getElementById("calendar-list");
    let contextMenu = document.getElementById("list-calendars-context-menu");
    let manager = cal.getCalendarManager();
    let composite = cal.view.getCompositeCalendar(window);

    await openCalendarTab();

    // Check the default calendar.
    is(manager.getCalendars({}).length, 1);
    is(calendarList.itemCount, 1);
    checkProperties(0, {
        color: "rgb(168, 194, 225)",
        name: "Home"
    });

    // Test adding calendars.

    // Show the new calendar wizard. Don't use it, just prove the context menu works.
    await withModalDialog(
        () => calendarListContextMenu(calendarList, "list-calendars-context-new"),
        undefined, "cancel");

    // Add some new calendars, check their properties.
    let calendars = [];
    let uri = Services.io.newURI("moz-memory-calendar://");
    for (let i = 1; i <= 3; i++) {
        calendars[i] = manager.createCalendar("memory", uri);
        calendars[i].name = `Mochitest ${i}`;
        manager.registerCalendar(calendars[i]);
    }

    is(manager.getCalendars({}).length, 4);
    is(calendarList.itemCount, 4);

    for (let i = 1; i <= 3; i++) {
        checkProperties(i, {
            id: calendars[i].id,
            displayed: true,
            color: "rgb(168, 194, 225)",
            name: `Mochitest ${i}`
        });
    }

    // Test the context menu.

    await new Promise(resolve => setTimeout(resolve));
    EventUtils.synthesizeMouseAtCenter(calendarList.itemChildren[1], {});
    await new Promise(resolve => setTimeout(resolve));
    await calendarListContextMenu(calendarList.itemChildren[1]);
    await new Promise(resolve => setTimeout(resolve));
    is(document.getElementById("list-calendars-context-togglevisible").label, "Hide Mochitest 1");
    is(document.getElementById("list-calendars-context-showonly").label, "Show Only Mochitest 1");
    contextMenu.hidePopup();

    is(document.activeElement, calendarList);
    is(calendarList.selectedItem, calendarList.itemChildren[1]);

    // Test show/hide.
    // TODO: Check events on calendars are hidden/shown.

    EventUtils.synthesizeMouseAtCenter(calendarList.itemChildren[2].querySelector("checkbox"), {});
    is(document.activeElement, calendarList);
    is(calendarList.selectedItem, calendarList.itemChildren[2]);
    is(composite.getCalendarById(calendars[2].id), null);
    checkDisplayed(0, 1, 3, 4);

    composite.removeCalendar(calendars[1]);
    checkDisplayed(0, 3, 4);

    await calendarListContextMenu(calendarList.itemChildren[3], "list-calendars-context-togglevisible");
    checkDisplayed(0, 4);

    EventUtils.synthesizeMouseAtCenter(calendarList.itemChildren[2].querySelector("checkbox"), {});
    is(composite.getCalendarById(calendars[2].id), calendars[2]);
    is(document.activeElement, calendarList);
    is(calendarList.selectedItem, calendarList.itemChildren[2]);
    checkDisplayed(0, 2, 4);

    composite.addCalendar(calendars[1]);
    checkDisplayed(0, 1, 2, 4);

    await calendarListContextMenu(calendarList.itemChildren[3], "list-calendars-context-togglevisible");
    checkDisplayed(0, 1, 2, 3, 4);

    await calendarListContextMenu(calendarList.itemChildren[1], "list-calendars-context-showonly");
    checkDisplayed(1);

    await calendarListContextMenu(calendarList, "list-calendars-context-showall");
    checkDisplayed(0, 1, 2, 3, 4);

    // Test editing calendars.

    await withModalDialog(() => {
        EventUtils.synthesizeMouseAtCenter(calendarList.itemChildren[1], { clickCount: 2 });
    }, win => {
        let doc = win.document;
        let nameElement = doc.getElementById("calendar-name");
        let colorElement = doc.getElementById("calendar-color");
        is(nameElement.value, "Mochitest 1");
        is(colorElement.value, "#a8c2e1");
        nameElement.value = "A New Calendar!";
        colorElement.value = "#009900";
    }, "accept");

    is(document.activeElement, calendarList);
    is(calendarList.selectedItem, calendarList.itemChildren[1]);
    checkProperties(1, {
        color: "rgb(0, 153, 0)",
        name: "A New Calendar!"
    });

    await withModalDialog(() => {
        return calendarListContextMenu(calendarList.itemChildren[1], "list-calendars-context-edit");
    }, win => {
        let doc = win.document;
        let nameElement = doc.getElementById("calendar-name");
        let colorElement = doc.getElementById("calendar-color");
        is(nameElement.value, "A New Calendar!");
        is(colorElement.value, "#009900");
        nameElement.value = "Mochitest 1";
    }, "accept");

    is(document.activeElement, calendarList);
    is(calendarList.selectedItem, calendarList.itemChildren[1]);
    checkProperties(1, {
        color: "rgb(0, 153, 0)",
        name: "Mochitest 1"
    });

    await withModalDialog(() => {
        return calendarListContextMenu(calendarList.itemChildren[3], "list-calendars-context-edit");
    }, win => {
        let doc = win.document;
        let enabledElement = doc.getElementById("calendar-enabled-checkbox");
        ok(enabledElement.checked);
        enabledElement.checked = false;
    }, "accept");

    is(document.activeElement, calendarList);
    is(calendarList.selectedItem, calendarList.itemChildren[1]);
    checkProperties(1, { disabled: true });

    calendars[1].setProperty("disabled", false);
    checkProperties(1, { disabled: false });

    // Test deleting calendars.

    // Delete a calendar by unregistering it.
    manager.unregisterCalendar(calendars[3]);
    is(manager.getCalendars({}).length, 3);
    is(calendarList.itemCount, 3);

    // Start to remove a calendar. Cancel the prompt.
    await withMockPromptService(1, () => {
        EventUtils.synthesizeKey("VK_DELETE");
    });
    is(manager.getCalendars({}).length, 3);
    is(calendarList.itemCount, 3);

    // Remove a calendar with the keyboard.
    await withMockPromptService(0, () => {
        EventUtils.synthesizeKey("VK_DELETE");
    });
    is(manager.getCalendars({}).length, 2);
    is(calendarList.itemCount, 2);

    // Remove a calendar with the context menu.
    await withMockPromptService(0, async () => {
        EventUtils.synthesizeMouseAtCenter(calendarList.itemChildren[1], {});
        await calendarListContextMenu(calendarList.itemChildren[1], "list-calendars-context-delete");
    });
    is(manager.getCalendars({}).length, 1);
    is(calendarList.itemCount, 1);

    await closeCalendarTab();
});
