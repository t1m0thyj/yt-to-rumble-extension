chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ytToRumble",
    title: "Paste YT metadata from clipboard",
    contexts: ["page"],
    documentUrlPatterns: ["*://*.rumble.com/*"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ytToRumble") {
    chrome.tabs.sendMessage(tab.id, { type: "FETCH_CLIPBOARD" });
  }
});

// Handle metadata request from content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "FETCH_YT_METADATA") {
    (async () => {
      const { videoId } = msg;
      const metadata = await fetchYouTubeMetadata(videoId);
      sendResponse(metadata);
    })();
  }
  return true; // keeps the message channel open for async
});

async function fetchYouTubeMetadata(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  const text = await res.text();

  // 1. Extract ytInitialPlayerResponse JSON
  const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});var\s/);
  if (!match) throw new Error("ytInitialPlayerResponse not found");
 
  const data = JSON.parse(match[1]);
 
  // 2. Extract metadata
  const { title, shortDescription } = data.videoDetails || {};
  const thumbnail = `https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`;

  return { title, description: shortDescription, thumbnail };
}
