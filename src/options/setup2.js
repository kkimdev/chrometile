document.getElementById("configure").addEventListener("click", () => chrome.tabs.create({
    url: "chrome://extensions/configureCommands"
}));
