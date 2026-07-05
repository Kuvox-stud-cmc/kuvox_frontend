import { IS_PRODUCTION } from "./config";

export function actionErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (IS_PRODUCTION) {
    return fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
