// TODO: console.debug is not working for some reason so using console.log for now.

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

async function getDisplay(window) {
    const displayInfos = await chrome.system.display.getInfo();
    const windowCenter = computeCenter(window);
    // console.log(displayInfos);
    // console.log('windowCenter', windowCenter);

    // TODO: minimum distance logic might not be the best algorithm.
    let minDistance = Infinity;
    let minDistanceWindow = undefined

    for (const displayInfo of displayInfos) {
        const distance = computeDistance(windowCenter, computeCenter(displayInfo.bounds));
        // console.log('displayCenter', computeCenter(displayInfo.bounds));
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
    const display = await getDisplay(focusedWindow);

    let left = display.bounds.left;
    let top = display.bounds.top;
    let width = display.bounds.width;
    let height = display.bounds.height;

    if ([3, 6, 9].includes(positionNumber))
        left += display.bounds.width / 2;
    if ([1, 2, 3].includes(positionNumber))
        top += display.bounds.height / 2;
    if ([1, 4, 7, 3, 6, 9].includes(positionNumber))
        width = display.bounds.width / 2;
    if ([7, 8, 9, 1, 2, 3].includes(positionNumber))
        height = display.bounds.height / 2;
    
    const placingBounds = { 'top': top, 'left': left, 'width': width, 'height': height, state: "normal" };
    console.log(`Placing window ${focusedWindow.id} to ${JSON.stringify(placingBounds)}`);
    chrome.windows.update(focusedWindow.id, placingBounds);
}

chrome.commands.onCommand.addListener((command) => {
    console.log('Command received:', command);
    commands.get(command)();
});

chrome.system.display.onDisplayChanged.addListener(
    () => {
        // TODO: Keeping window aspect ratio logic.
        console.log("onDisplayChanged");
    }
);

chrome.windows.onBoundsChanged.addListener(
    (window) => {
        // TODO: Keeping window aspect ratio logic.
        console.log(`onBoundsChanged ${JSON.stringify(window)}`);
    }
);

chrome.windows.onCreated.addListener(
    (window) => {
        // TODO: Keeping window aspect ratio logic.
        console.log(`onCreated ${JSON.stringify(window)}`);
    }
);

chrome.windows.onRemoved.addListener(
    (windowId) => {
        // TODO: Keeping window aspect ratio logic.
        console.log(`onRemoved ${windowId}`);
    }
);
