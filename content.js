let thumbnailObserver;

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "FETCH_CLIPBOARD") {
    try {
      const ytUrl = await navigator.clipboard.readText();
      const videoId = getYouTubeVideoId(ytUrl);
      if (!videoId) {
        alert("Clipboard does not contain a valid YouTube URL.");
        return;
      }

      chrome.runtime.sendMessage({ type: "FETCH_YT_METADATA", videoId }, async (metadata) => {
        if (!metadata) {
          alert("Failed to retrieve YouTube metadata.");
          return;
        }

        window.postMessage({
          type: "YT_METADATA",
          payload: metadata
        }, "*");
      });
    } catch (err) {
      console.error("Error reading clipboard or fetching metadata:", err);
      alert("Something went wrong reading the clipboard or fetching data.");
    }
  }
});

function getYouTubeVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com") && parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1);
    }
  } catch (e) {
    return null;
  }
  return null;
}

function dataUrlToBlob(dataUrl) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function setInputValue(input, value) {
  if (!input || typeof value !== "string") return;

  // Bypass React's per-element value tracker so its onChange handler sees the edit.
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function uploadThumbnail(root, thumbnail) {
  thumbnailObserver?.disconnect();
  if (!thumbnail) return;

  const blob = dataUrlToBlob(thumbnail);
  const file = new File([blob], "thumbnail.webp", { type: blob.type });
  thumbnailObserver = new MutationObserver(tryUpload);

  function tryUpload() {
    if (!root.isConnected) {
      thumbnailObserver.disconnect();
      return;
    }
    const input = root.querySelector('input[type="file"][accept="image/*"]');
    const button = root.querySelector('[data-sentry-component="CIVideoUploadCustomThumbnailButton"] button');
    // Studio cannot accept a custom thumbnail until the video has finished uploading.
    if (!input || !button || button.disabled) return;

    thumbnailObserver.disconnect();
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  thumbnailObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"]
  });
  tryUpload();
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.type !== "YT_METADATA") return;

  const { title, description, keywords, thumbnail } = event.data.payload;
  console.log("YT Title:", title);
  console.log("Description:", description);
  console.log("Keywords:", keywords);
  console.log("Thumbnail:", thumbnail.slice(0, 100) + "...");

  const details = document.querySelector('[data-sentry-component="CIVideoUploadModalStepDetails"]');
  if (!details) {
    alert("Open the Rumble upload details step before pasting YouTube metadata.");
    return;
  }

  setInputValue(details.querySelector('input[placeholder="Title (required)"]'), title);
  setInputValue(details.querySelector('textarea[placeholder="Description (required)"]'), description);
  if (Array.isArray(keywords) && keywords.length) {
    setInputValue(details.querySelector('input[placeholder="Add tags"]'), keywords.join(", ") + ",");
  }

  uploadThumbnail(details.closest('[role="dialog"]'), thumbnail);
});
