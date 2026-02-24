const DEFAULT_CATEGORY = "Podcasts";

// Look for video uploader and make it accept .mkv files
window.addEventListener("load", () => {
  const filedataInput = document.getElementById("Filedata");
  if (filedataInput) {
    const currentAccept = filedataInput.getAttribute("accept") || "";
    if (!currentAccept.includes(".mkv")) {
      filedataInput.setAttribute("accept", currentAccept + ",.mkv");
    }
  }
});

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

  // 4. Upload Thumbnail from data URL
  const fileInput = document.querySelector("input[type='file'][accept='image/*']");
  if (fileInput && thumbnail) {
    const blob = dataUrlToBlob(thumbnail);
    const file = new File([blob], "thumbnail.webp", { type: blob.type });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
});
