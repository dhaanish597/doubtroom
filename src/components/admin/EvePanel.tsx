import "server-only";

import { addDays, eveWindowForExam, istDate } from "@/lib/eves/time";
import { adminSupabase } from "@/lib/supabase/admin";
import { EvePanelForm, type EveCourseOption } from "./EvePanelForm";

/** /admin: create an Exam Eve and run the morning recap on demand. Admin access is checked by the page. */
export async function EvePanel() {
  const { data, error } = await adminSupabase().from("courses").select("code,title,exam_date")
    .order("code").returns<{ code: string; title: string; exam_date: string | null }[]>();
  const courses: EveCourseOption[] = (data ?? []).map((course) => ({
    code: course.code, title: course.title, examDate: course.exam_date,
  }));
  // Default: tonight's Eve, for a paper tomorrow.
  const tonight = eveWindowForExam(addDays(istDate(new Date()), 1));
  return (
    <EvePanelForm courses={courses} loadFailed={Boolean(error)}
      defaultOpensAt={tonight.opensAt.toISOString()} defaultClosesAt={tonight.closesAt.toISOString()} />
  );
}
