function goBackOrFallback({ canGoBack, goBack, fallback }) {
  if (canGoBack()) {
    goBack();
    return "history";
  }
  fallback();
  return "fallback";
}

module.exports = { goBackOrFallback };
