// Backward-compatible loader for older pages that still include chat-ai.js.
// The maintained assistant implementation lives in chat.js and uses /api/assistant.
(() => {
  if (window.ChatAssistant) return;

  const alreadyLoading = [...document.scripts].some((script) => {
    const src = script.getAttribute("src") || "";
    return src === "chat.js" || src.endsWith("/chat.js");
  });

  if (alreadyLoading) return;

  const script = document.createElement("script");
  script.src = "chat.js";
  script.async = false;
  script.onload = () => {
    if (document.readyState !== "loading") {
      window.ChatAssistant?.init?.();
    }
  };
  document.head.appendChild(script);
})();
