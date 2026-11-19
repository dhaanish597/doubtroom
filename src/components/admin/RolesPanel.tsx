import "server-only";

import { Suspense } from "react";
import { UserCog } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { adminSupabase } from "@/lib/supabase/admin";
import { AdminSection } from "./AdminSection";
import { RoleForm, type CourseOption } from "./RoleForm";

async function CourseLoader() {
  const { data, error } = await adminSupabase().from("courses").select("code,title,dept,year").order("dept").order("year").order("code");
  if (error) {
    return <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">Couldn’t load the course catalog. Refresh the page to try again.</p>;
  }
  return <RoleForm courses={data as CourseOption[]} />;
}

export function RolesPanel() {
  return (
    <AdminSection id="admin-roles" title="Roles"
      description="Make someone a class rep or a mentor. Mentors join the rooms for the courses you pick. Admins come from ADMIN_EMAILS only."
      action={<UserCog aria-hidden="true" className="size-5 text-primary" />}>
      <Suspense fallback={<Skeleton aria-busy="true" className="h-24 rounded-xl" />}>
        <CourseLoader />
      </Suspense>
    </AdminSection>
  );
}
