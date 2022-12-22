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

function computeCenter(box) {
    return {
        x: box.left + box.width / 2,
        y: box.top + box.height / 2
    };
}

function computeDistance(point1, point2) {
    return (point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2;
}

function getDisplay(window) {
    // TOOD: early return if length is 1.
    const windowCenter = computeCenter(window);
    // console.log(displayInfos);
    // console.log('windowCenter', windowCenter);

    // TODO: minimum distance logic might not be the best algorithm.
    let minDistance = Infinity;
    let minDistanceWindow = undefined

    for (const displayInfo of chromeSystemDisplayGetInfoCache) {
        const distance = computeDistance(windowCenter, computeCenter(displayInfo.workArea));
        // console.log('displayCenter', computeCenter(displayInfo.workArea));
        // console.log('distance', distance);
        if (distance < minDistance) {
            minDistance = distance;
            minDistanceWindow = displayInfo;
        }
    }

    return minDistanceWindow;
}

async function place(positionNumber) {
    const focusedWindow = await chrome.windows.getLastFocused();
    const display = getDisplay(focusedWindow);
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
    
    const placingBounds = { 'top': top, 'left': left, 'width': width, 'height': height, state: "normal" };
    console.log(`Placing window ${focusedWindow.id} to ${JSON.stringify(placingBounds)}`);
    chrome.windows.update(focusedWindow.id, placingBounds);
}

// // Used only for initialization
// async function updateAll() {
//     const allWindows = await chrome.windows.getAll();

//     // console.log(displayInfos);
//     // console.log(allWindows);

//     scaledWindowBounds = {};
//     for (const window of allWindows) {
//         addWindow(window);
//     }

//     // TODO: create window to display map or
//     //       create window relative scaled position.
//     // 
// }

// async function repositionWindows() {
//     console.log(`start repositionWindows`);
//     const allWindows = await chrome.windows.getAll();

//     for (const window of allWindows) {
//         const closestDisplay = getDisplay(window);
//         const scaledBound = scaledWindowBounds[window.id];
//         if (!scaledBound) continue;

//         chrome.windows.update(window.id, {
//             left: Math.round(scaledBound.left * closestDisplay.workArea.width),
//             width: Math.round(scaledBound.width * closestDisplay.workArea.width),
//             top: Math.round(scaledBound.top * closestDisplay.workArea.height),
//             height: Math.round(scaledBound.height * closestDisplay.workArea.height),
//             state: "normal"
//         });
//     }
//     console.log(`end repositionWindows`);
// }
////////////////////////////////////////////////////////////////////////////////

async function addAllWindows() {
    console.log("addAllWindows");
    const allWindows = await chrome.windows.getAll();
    chromeSystemDisplayGetInfoCache = await chrome.system.display.getInfo();
    for (const window of allWindows) {
        addWindow(window);
    }
}

function addWindow(window) {
    console.log("addWindow");
    const closestDisplay = getDisplay(window);
    scaledWindowBounds[window.id] = {
        displayChangedVersion: displayChangedVersion,
        left: window.left / closestDisplay.workArea.width,
        width: window.width / closestDisplay.workArea.width,
        top: window.top / closestDisplay.workArea.height,
        height: window.height / closestDisplay.workArea.height,
    };
}

function updateWindow(window) {
    console.log("updateWindow");
    console.log(scaledWindowBounds[window.id]['displayChangedVersion'], displayChangedVersion);
    if (scaledWindowBounds[window.id]['displayChangedVersion'] < displayChangedVersion) {
        return;
    }
    
    addWindow(window);
}

function removeWindow(windowId) {
    delete scaledWindowBounds[windowId];
}

async function repositionWindows() {
    console.log(`start repositionWindows`);

    for (const [windowId, value] of Object.entries(scaledWindowBounds)) {
        const scaledBound = scaledWindowBounds[windowId];
        const window = await chrome.windows.get(parseInt(windowId));
        const closestDisplay = getDisplay(window);
        
        console.log(scaledBound['displayChangedVersion'], displayChangedVersion);
        if (scaledBound['displayChangedVersion'] < displayChangedVersion) {
            chrome.windows.update(window.id, {
                left: Math.round(scaledBound.left * closestDisplay.workArea.width),
                width: Math.round(scaledBound.width * closestDisplay.workArea.width),
                top: Math.round(scaledBound.top * closestDisplay.workArea.height),
                height: Math.round(scaledBound.height * closestDisplay.workArea.height),
                state: "normal"
            });
            addWindow(window);
        }
    }
    console.log(`end repositionWindows`);
}
////////////////////////////////////////////////////////////////////////////////

chrome.commands.onCommand.addListener((command) => {
    console.log('Command received:', command);
    commands.get(command)();
});

chrome.system.display.onDisplayChanged.addListener(
    async () => {
        console.log("onDisplayChanged");
        chromeSystemDisplayGetInfoCache = await chrome.system.display.getInfo();
        displayChangedVersion += 1;
        repositionWindows();
    }
);

chrome.windows.onBoundsChanged.addListener(
    (window) => {
        // TODO: Keeping window aspect ratio logic.
        console.log(`onBoundsChanged ${JSON.stringify(window)}`);
        updateWindow(window);
        // updateAll();
    }
);

chrome.windows.onCreated.addListener(
    (window) => {
        console.log(`onCreated ${JSON.stringify(window)}`);
        addWindow(window);
    }
);

chrome.windows.onRemoved.addListener(
    (windowId) => {
        console.log(`onRemoved ${windowId}`);
        removeWindow(windowId);
    }
);

////////////////////////////////////////////////////////////////////////////////

addAllWindows();
