export function observePageVisibility(onHidden: () => void, onVisible: () => void): () => void {
  const handler = () => {
    if (document.hidden) {
      onHidden()
    } else {
      onVisible()
    }
  }

  document.addEventListener("visibilitychange", handler)

  return () => {
    document.removeEventListener("visibilitychange", handler)
  }
}
