import { redirect } from "react-router";

/** `/settings` lands on the account profile tab. */
export function loader() {
  return redirect("/settings/account");
}
