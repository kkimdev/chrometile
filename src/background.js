try {
    importScripts("./is_chromebook.js");
} catch (e) {
    console.log(e);
}


const WINTYPES = {"windowTypes": Object.values(chrome.windows.WindowType)};

let allDisplays = new Array();
class Display {
    constructor(displayInfo) {
        this.id = displayInfo.id;
        this.area = displayInfo.workArea;
        this.window_ids = new Array();
        this.excluded_window_ids = new Array();
        this._layout = null;
        this._main_wins = null;
        this._split_pct = null;
    }
    init() {
        return new Promise(resolve => {
            getSettings({
                [`layout_${this.id}`]: null,
                [`main_wins_${this.id}`]: 1,
                [`split_pct_${this.id}`]: 0.5
            }).then(settings => {
                console.log("Loaded Settings", settings);
                this._layout = settings[`layout_${this.id}`];
                this._main_wins = settings[`main_wins_${this.id}`];
                this._split_pct = settings[`split_pct_${this.id}`];
            });
        });
    }

    getWindowIds() {
        return new Promise((resolve, reject) => {
            chrome.windows.getAll(WINTYPES, wins => {
                let new_ids = wins.filter(
                    win => win.state == "normal" && !this.excluded_window_ids.includes(win.id)
                ).filter(win => this.isInArea(win)).map(win => win.id);

                this.window_ids = this.window_ids.filter(windowId => new_ids.includes(windowId));
                new_ids.forEach(windowId => {
                    if (!this.window_ids.includes(windowId)) {
                        this.window_ids.push(windowId);
                    }
                });

                resolve(this.window_ids);
            });
        });
    }

    isInArea(win) {
        // Check which display a window is on by each corner in turn
        return (
            ( // top left
                (win.left >= this.area.left && win.left < this.area.left+this.area.width) &&
                (win.top >= this.area.top && win.top < this.area.top+this.area.height)
            ) ||
            ( // top right
                (win.left+win.width >= this.area.left && win.left < this.area.left+this.area.width) &&
                (win.top >= this.area.top && win.top < this.area.top+this.area.height)
            ) ||
            ( // bottom left
                (win.left >= this.area.left && win.left < this.area.left+this.area.width) &&
                (win.top+win.height >= this.area.top && win.top < this.area.top+this.area.height)
            ) ||
            ( // bottom right
                (win.left+win.width >= this.area.left && win.left < this.area.left+this.area.width) &&
                (win.top+win.height >= this.area.top && win.top < this.area.top+this.area.height)
            )
        );
    }

    static findByWinId(windowId, all) {
        return new Promise(resolve => {
            chrome.windows.get(windowId, WINTYPES, win => {
                resolve(all.find(d => d.isInArea(win)));
            });
        });
    }
}

function layoutWindow(display, windowIds, windowId, windowIndex, margin) {
    return new Promise(resolve => {
        // console.log("layoutWindow", display.layout, windowIndex, windowIds.length, display.main_wins, display.area, margin, display.split_pct);
        // chrome.windows.update(windowId, LAYOUTS.get(display.layout)(
        //     windowIndex, windowIds.length, display.main_wins,
        //     display.area, margin, display.split_pct
        // ), win => resolve);
    });
}

function tileDisplayWindows(display, margin) {
    return new Promise(resolve => {
        if (!LAYOUTS.has(display.layout)) display.layout = LAYOUTS.keys().next().value;
        display.getWindowIds().then(windowIds => {
            Promise.all(
                windowIds.map((windowId, windowIndex) => layoutWindow(display, windowIds, windowId, windowIndex, margin))
            );
        }).then(resolve);
    });
}

function tileWindows() {
    return new Promise((resolve, reject) => {
        getSettings({"margin": 2}).then(settings => {
            let margin = parseInt(settings.margin);
            Promise.all(
                 allDisplays.map(display => { tileDisplayWindows(display, margin) })
            ).then(resolve);
        });
    });
}


function debounce(callback, wait, context = this) {
    let timeout = null;
    let callbackArgs = null;

    const later = () => callback.apply(context, callbackArgs);

    return function() {
        callbackArgs = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    }
}


function getSettings(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, resolve);
    });
}

function getDisplays() {
    return new Promise((resolve, reject) => {
        allDisplays = new Array();
        chrome.system.display.getInfo(displayInfo => {
            console.log("Display Info", displayInfo);
            if (displayInfo.length == 0) reject("Zero displays");
            displayInfo.forEach(d => allDisplays.push(new Display(d)));
            Promise.all(allDisplays.map(d => d.init())).then(resolve);
        });
    });
}

function getFocused() {
    return new Promise(resolve => {
        chrome.windows.getLastFocused(WINTYPES, win => {
            Display.findByWinId(win.id, allDisplays).then(disp => {
                resolve({"win": win, "disp": disp})
            });
        });
    });
}

async function place(positionNumber) {
  await getDisplays();
  w = await getFocused();
  console.log(w);

  let left = 0;
  let top = 0;
  let width = w.disp.area.width;
  let height = w.disp.area.height;

  if ([1,4,7,3,6,9].includes(positionNumber)) {
    width = width / 2;
  }
  if ([3,6,9].includes(positionNumber)) {
    left = width;
  }
  if ([7,8,9,1,2,3].includes(positionNumber)) {
    height = height / 2;
  }
  if ([1,2,3].includes(positionNumber)) {
    top = height;
  }
  chrome.windows.update(w.win.id, {'top': top, 'left': left, 'width': width, 'height': height, state: "normal"});
  chrome.windows.update(w.win.id, {'top': top, 'left': left, 'width': width, 'height': height, state: "normal"});
}

// By default we set enabled true only for Chromebooks™, but this
// can be overridden in the settings.tileWindows
isChromebook().then(isCrOs => {
    getSettings({"enabled": isCrOs}).then(settings => {
        if (settings.enabled) {
            getDisplays().then(tileWindows, reason => console.error(reason));

            chrome.commands.onCommand.addListener(function(command) {
                console.log(command);
                const commands = new Map([
                    ["99001-place-1",            () => place(1)                         ],
                    ["99002-place-2",           () => place(2)                         ],
                    ["99003-place-3",         () => place(3)                         ],
                    ["99004-place-4",        () => place(4)                         ],
                    ["99005-place-5",        () => place(5)                         ],
                    ["99006-place-6",        () => place(6)                         ],
                    ["99007-place-7",        () => place(7)                         ],
                    ["99008-place-8",        () => place(8)                         ],
                    ["99009-place-9",        () => place(9)                         ]
                ]);
                if (commands.has(command)) commands.get(command)();
            })
        } else {
            console.warn("Tiling Window Manager for Chrome OS\u2122 is disabled (by default when not on a Chromebook\u2122). Not running.");
        }
    })
})

// Events sent by options page
chrome.runtime.onMessage.addListener(debounce(request => {
    if (request.hasOwnProperty("enabled")) {
        chrome.runtime.reload()
    }
}, 250));
