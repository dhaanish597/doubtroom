export type Room = {
  id: string;
  title: string;
  kind: "subject" | "section" | "demo";
  courseCode: string | null;
  units: string[];
  memberCount: number;
  eve?: { id: string; opensAt: string; closesAt: string };
};
