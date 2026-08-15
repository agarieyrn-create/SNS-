export function createXShareUrl(content: string) {
  return `https://x.com/intent/post?text=${encodeURIComponent(content)}`;
}

export async function copyDraftToClipboard(content: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("クリップボードへコピーできませんでした。もう一度お試しください。");
}
