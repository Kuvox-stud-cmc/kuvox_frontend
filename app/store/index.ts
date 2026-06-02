import { configureStore } from "@reduxjs/toolkit";

import { editorReducer } from "./slices/editor-slice";

/**
 * The Redux store is scoped to the **client-only editor route**. It is created
 * per mount (see `app/routes/editor/editor.tsx`) so there is no SSR store to
 * serialize/hydrate — the rest of the app stays server-rendered without Redux.
 */
export function makeStore() {
  return configureStore({
    reducer: {
      editor: editorReducer,
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
