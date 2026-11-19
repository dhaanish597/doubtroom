import "server-only";

import { unstable_cache } from "next/cache";
import { listGroupMemberIds } from "@/lib/nexconn/server";

export const roomMemberIds = unstable_cache(listGroupMemberIds, ["nexconn-group-members"], { revalidate: 45 });
