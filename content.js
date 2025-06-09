const DEFAULT_CATEGORY = "Podcasts";

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

function loadImageAsBlob(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // still needed to avoid tainted canvas
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to convert image to blob"));
      }, "image/webp");
    };
    img.onerror = reject;
    img.src = `https://corsproxy.io/?url=${url}`;
  });
}

window.addEventListener("message", async (event) => {
  if (event.source !== window || !event.data || event.data.type !== "YT_METADATA") return;

  const { title, description, thumbnail, category = DEFAULT_CATEGORY } = event.data.payload;
  console.log("YT Title:", title);
  console.log("Description:", description);
  console.log("Thumbnail:", thumbnail);
  console.log("Category:", category);

  // 1. Fill Title
  const titleInput = document.querySelector("input[name='title']");
  if (titleInput) titleInput.value = title;

  // 2. Fill Description
  const descTextarea = document.querySelector("textarea[name='description']");
  if (descTextarea) descTextarea.value = description;

  // 3. Set Category
  const selectOption = document.querySelector(`.select-option[data-label='${category}']`);
  document.getElementById('category_primary').value = selectOption.dataset.value;
  document.querySelector('.select-search-input').value = selectOption.dataset.label;

  // 4. Upload Thumbnail from URL
  const fileInput = document.querySelector("input[type='file'][accept='image/*']");
  if (fileInput) {
    const blob = await loadImageAsBlob(thumbnail);
    const file = new File([blob], "thumbnail.webp", { type: blob.type });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
});
