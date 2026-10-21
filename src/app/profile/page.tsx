// Profile step: pick a sample CV, or upload a synthetic one, then confirm details.
import type { Metadata } from "next";
import { ProfileView } from "@/components/profile-view";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return <ProfileView />;
}
