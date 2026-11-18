import { notFound } from "next/navigation";
import DevChat from "./dev-chat";

export default function DevChatPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevChat />;
}
