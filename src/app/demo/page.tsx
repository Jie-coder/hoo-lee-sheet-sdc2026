// /demo is the historical sample entry point; the profile step (sample pick or
// upload) now lives at /profile, so send visitors straight there.
import { redirect } from "next/navigation";

export default function DemoPage() {
  redirect("/profile");
}
