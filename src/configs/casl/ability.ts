import { createMongoAbility } from "@casl/ability";
import type { AppAbility } from "@/lib/types/permissions";

export type { Actions, AppAbility, Subjects } from "@/lib/types/permissions";

export const ability = createMongoAbility<AppAbility>();
