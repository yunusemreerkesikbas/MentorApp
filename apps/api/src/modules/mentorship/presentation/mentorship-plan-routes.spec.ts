import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { UserRole } from "@mentor/types";
import { ROLES_KEY } from "../../../common/auth/roles.decorator";
import { PlanEventController } from "../../coaching/presentation/plan-event.controller";
import { MentorshipCoachController } from "./mentorship-coach.controller";

function routeMetadata(
  controller: object,
  methodName: string,
): { path: string | undefined; method: RequestMethod | undefined } {
  const handler = (controller as Record<string, unknown>)[methodName];
  if (typeof handler !== "function") return { path: undefined, method: undefined };
  return {
    path: Reflect.getMetadata(PATH_METADATA, handler),
    method: Reflect.getMetadata(METHOD_METADATA, handler),
  };
}

describe("coach plan route authorization boundary", () => {
  it("makes W2 plan event mutations unreachable while retaining participant reads", () => {
    const prototype = PlanEventController.prototype;
    expect(routeMetadata(prototype, "createEvent")).toEqual({
      path: undefined,
      method: undefined,
    });
    expect(routeMetadata(prototype, "updateEvent")).toEqual({
      path: undefined,
      method: undefined,
    });
    expect(routeMetadata(prototype, "cancelEvent")).toEqual({
      path: undefined,
      method: undefined,
    });
    expect(routeMetadata(prototype, "listItems")).toEqual({
      path: "plan-items",
      method: RequestMethod.GET,
    });
  });

  it("places every new mutation behind the COACH mentorship controller", () => {
    expect(Reflect.getMetadata(ROLES_KEY, MentorshipCoachController)).toEqual([
      UserRole.COACH,
    ]);
    const prototype = MentorshipCoachController.prototype;
    expect(routeMetadata(prototype, "listPlan")).toEqual({
      path: "plan",
      method: RequestMethod.GET,
    });
    expect(routeMetadata(prototype, "assignBatch")).toEqual({
      path: "assignments",
      method: RequestMethod.POST,
    });
    expect(routeMetadata(prototype, "updateAssignment")).toEqual({
      path: "students/:studentId/assignments/:assignmentId",
      method: RequestMethod.PATCH,
    });
    expect(routeMetadata(prototype, "removeAssignment")).toEqual({
      path: "students/:studentId/assignments/:assignmentId",
      method: RequestMethod.DELETE,
    });
    expect(routeMetadata(prototype, "updateAssignmentGroup")).toEqual({
      path: "assignment-groups/:assignmentGroupId",
      method: RequestMethod.PATCH,
    });
    expect(routeMetadata(prototype, "removeAssignmentGroup")).toEqual({
      path: "assignment-groups/:assignmentGroupId",
      method: RequestMethod.DELETE,
    });
    expect(routeMetadata(prototype, "createPlanEvent")).toEqual({
      path: "events",
      method: RequestMethod.POST,
    });
    expect(routeMetadata(prototype, "updatePlanEvent")).toEqual({
      path: "events/:eventId",
      method: RequestMethod.PATCH,
    });
    expect(routeMetadata(prototype, "cancelPlanEvent")).toEqual({
      path: "events/:eventId/cancel",
      method: RequestMethod.POST,
    });
  });
});
