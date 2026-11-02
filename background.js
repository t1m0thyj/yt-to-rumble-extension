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
  const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
  if (!match) throw new Error("ytInitialPlayerResponse not found");
 
  const data = JSON.parse(match[1]);
 
  // 2. Extract metadata
  const { title, shortDescription, keywords = [] } = data.videoDetails || {};
  
  // 3. Fetch thumbnail and convert to data URL
  const thumbnailUrl = `https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`;
  const thumbnailDataUrl = await fetchImageAsDataUrl(thumbnailUrl);

  return { title, description: shortDescription, keywords, thumbnail: thumbnailDataUrl };
}

async function fetchImageAsDataUrl(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to fetch thumbnail:', error);
    return null;
  }
}
