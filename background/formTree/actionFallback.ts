
export async function actionFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    return await primary()
  } catch (err) {
    console.warn('Primary action failed, invoking fallback:', err)
    return await fallback()
  }
}

