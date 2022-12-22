// TODO: console.debug is not working for some reason so using console.log for now.

let displayChangedVersion = 0;
let scaledWindowBounds = {}
let chromeSystemDisplayGetInfoCache = undefined;

const commands = new Map([
    ["99001-place-1", () => place(1)],
    ["99002-place-2", () => place(2)],
    ["99003-place-3", () => place(3)],
    ["99004-place-4", () => place(4)],
    ["99005-place-5", () => place(5)],
    ["99006-place-6", () => place(6)],
    ["99007-place-7", () => place(7)],
    ["99008-place-8", () => place(8)],
    ["99009-place-9", () => place(9)]
]);

function logger(...msgs) {
    // console.log(Error().stack);
    console.log('\t'.repeat(Error().stack.split('\n').length - 2), ...msgs);
}

function computeCenter(box) {
    return {
        x: box.left + box.width / 2,
        y: box.top + box.height / 2
    };
}

function computeDistance(point1, point2) {
    return (point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2;
}

function getClosestDisplay(window) {
    if (chromeSystemDisplayGetInfoCache.length === 1)
        return chromeSystemDisplayGetInfoCache[0];

    const windowCenter = computeCenter(window);
    // logger(displayInfos);
    // logger('windowCenter', windowCenter);

    // TODO: minimum distance logic might not be the best algorithm.
    let minDistance = Infinity;
    let minDistanceWindow = undefined

    for (const displayInfo of chromeSystemDisplayGetInfoCache) {
        const distance = computeDistance(windowCenter, computeCenter(displayInfo.workArea));
        // logger('displayCenter', computeCenter(displayInfo.workArea));
        // logger('distance', distance);
        if (distance < minDistance) {
            minDistance = distance;
            minDistanceWindow = displayInfo;
        }
    }

    return minDistanceWindow;
}

async function place(positionNumber) {
    const focusedWindow = await chrome.windows.getLastFocused();
    const display = getClosestDisplay(focusedWindow);
    const displayWorkArea = display.workArea;

    let left = displayWorkArea.left;
    let top = displayWorkArea.top;
    let width = displayWorkArea.width;
    let height = displayWorkArea.height;

    if ([3, 6, 9].includes(positionNumber))
        left += displayWorkArea.width / 2;
    if ([1, 2, 3].includes(positionNumber))
        top += displayWorkArea.height / 2;
    if ([1, 4, 7, 3, 6, 9].includes(positionNumber))
        width = displayWorkArea.width / 2;
    if ([7, 8, 9, 1, 2, 3].includes(positionNumber))
        height = displayWorkArea.height / 2;

    const placingBounds = {
        'top': Math.round(top),
        'left': Math.round(left),
        'width': Math.round(width),
        'height': Math.round(height),
        state: "normal"
    };
    logger("Placing window", focusedWindow, "to", placingBounds);
    chrome.windows.update(focusedWindow.id, placingBounds);
}

async function addAllWindows() {
    logger("addAllWindows");
    const allWindows = await chrome.windows.getAll();
    chromeSystemDisplayGetInfoCache = await chrome.system.display.getInfo();
    for (const window of allWindows) {
        addWindow(window);
    }
}

function addWindow(window) {
    const closestDisplay = getClosestDisplay(window);
    const newScaledWindowBound = {
        displayChangedVersion: displayChangedVersion,
        left: window.left / closestDisplay.workArea.width,
        width: window.width / closestDisplay.workArea.width,
        top: window.top / closestDisplay.workArea.height,
        height: window.height / closestDisplay.workArea.height,
    };

    logger("addWindow", window, "from", scaledWindowBounds[window.id], "to", newScaledWindowBound);
    scaledWindowBounds[window.id] = newScaledWindowBound;
}

function updateWindow(window) {
    logger("updateWindow", window);
    if (scaledWindowBounds[window.id]['displayChangedVersion'] < displayChangedVersion) {
        logger("updateWindow ignored because displayChangedVersion is lower", scaledWindowBounds[window.id]['displayChangedVersion'], "<", displayChangedVersion);
        return;
    }

    addWindow(window);
}

function removeWindow(windowId) {
    delete scaledWindowBounds[windowId];
}

async function repositionWindows(version) {
    logger("repositionWindows start, version:", version);
    chromeSystemDisplayGetInfoCache = await chrome.system.display.getInfo();

    for (const [windowId, value] of Object.entries(scaledWindowBounds)) {
        const scaledBound = scaledWindowBounds[windowId];
        const window = await chrome.windows.get(parseInt(windowId));
        const closestDisplay = getClosestDisplay(window);

        if (version < displayChangedVersion)
            break;

        console.assert(scaledBound['displayChangedVersion'] < displayChangedVersion)

        const newBound = {
            left: Math.round(scaledBound.left * closestDisplay.workArea.width),
            width: Math.round(scaledBound.width * closestDisplay.workArea.width),
            top: Math.round(scaledBound.top * closestDisplay.workArea.height),
            height: Math.round(scaledBound.height * closestDisplay.workArea.height),
            state: "normal"
        };

        logger("repositionWindows update window:", window, "from", scaledBound, "to", newBound);
        chrome.windows.update(window.id, newBound);
        addWindow(window);
    }
    logger("repositionWindows end, version:", version);
}

function addListeners() {
    chrome.commands.onCommand.addListener((command) => {
        logger('Command received:', command);
        commands.get(command)();
    });

    chrome.system.display.onDisplayChanged.addListener(
        () => {
            logger("chrome.system.display.onDisplayChanged");
            displayChangedVersion += 1;
            repositionWindows(displayChangedVersion);
        }
    );

    chrome.windows.onBoundsChanged.addListener(
        (window) => {
            logger("chrome.windows.onBoundsChanged", window);
            updateWindow(window);
        }
    );

    chrome.windows.onCreated.addListener(
        (window) => {
            logger("chrome.windows.onCreated", window);
            addWindow(window);
        }
    );

    chrome.windows.onRemoved.addListener(
        (windowId) => {
            logger("chrome.windows.onRemoved", windowId);
            removeWindow(windowId);
        }
    );
}

addListeners();
// TODO: Need to ensure `addAllWindows()` is finished before listener handling.
//       Though it will be the case 99.99% times in practice already.
addAllWindows();
