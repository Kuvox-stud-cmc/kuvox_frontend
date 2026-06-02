import { useDispatch, useSelector } from "react-redux";

import type { AppDispatch, RootState } from "./index";

/** Typed `useDispatch` — use throughout the editor instead of plain `useDispatch`. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/** Typed `useSelector` — use throughout the editor instead of plain `useSelector`. */
export const useAppSelector = useSelector.withTypes<RootState>();
