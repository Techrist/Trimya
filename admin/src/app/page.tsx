import { redirect } from "next/navigation";

export default function HomePage() {
  // The actual landing depends on auth state, which lives client-side.
  // We bounce to /dashboard; the dashboard layout will redirect to /login
  // if the user is not authenticated.
  redirect("/dashboard");
}
