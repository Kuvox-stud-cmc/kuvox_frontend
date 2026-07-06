import { useEffect } from "react";

import { useAppDispatch } from "~/store/hooks";
import {
  imageRedoRequested,
  imageUndoRequested,
} from "~/store/slices/image-editor-slice";

export function useImageKeyboardShortcuts() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (!modifier || (key !== "z" && key !== "y")) return;

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        dispatch(imageUndoRequested());
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        dispatch(imageRedoRequested());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);
}
