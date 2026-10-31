import { describe, expect, it, vi } from "vitest";
import { MistakeNotebookController } from "./mistake-notebook.controller";
import { NotebooksController } from "./notebooks.controller";
import { CoachingController } from "./coaching.controller";
const user={id:"55555555-5555-4555-8555-555555555555",sessionId:"14141414-1414-4414-8414-141414141414",roles:["STUDENT"],orgId:null};
const actor={userId:user.id,sessionId:user.sessionId};
describe("authenticated media projection", () => {
  it.each(["listDue","listEntries","createEntry","getEntry","updateEntry","reviewEntry","linkThread","getPage","putPage"] as const)("passes the exact actor from notebook %s",method => {
    const calls={listDue:vi.fn(),listEntries:vi.fn(),createEntry:vi.fn(),getEntry:vi.fn(),updateEntry:vi.fn(),reviewEntry:vi.fn(),linkCommunityThread:vi.fn(),getPage:vi.fn(),putPage:vi.fn()};
    const controller=new MistakeNotebookController(calls as never);
    switch(method) {
      case "listDue":controller.listDue(user);break;
      case "listEntries":controller.listEntries(user,{} as never);break;
      case "createEntry":controller.createEntry(user,{} as never);break;
      case "getEntry":controller.getEntry(user,"entry");break;
      case "updateEntry":controller.updateEntry(user,"entry",{} as never);break;
      case "reviewEntry":controller.reviewEntry(user,"entry",{solved:true} as never);break;
      case "linkThread":controller.linkThread(user,"entry",{threadId:"thread"});break;
      case "getPage":controller.getPage(user,1);break;
      case "putPage":controller.putPage(user,1,{doc:{}} as never);break;
    }
    const call=Object.values(calls).find(fn=>fn.mock.calls.length)!.mock.calls[0]; expect(call?.at(-1)).toEqual(actor);
  });
  it("passes the actor to named notebook pages and vision reads/saves",() => {
    const pages={getNotebookPage:vi.fn(),putNotebookPage:vi.fn()}; const books=new NotebooksController(pages as never);
    books.getPage(user,"book",1); books.putPage(user,"book",1,{doc:{}} as never);
    expect(pages.getNotebookPage.mock.calls[0]?.at(-1)).toEqual(actor); expect(pages.putNotebookPage.mock.calls[0]?.at(-1)).toEqual(actor);
    const vision={getMine:vi.fn(),upsert:vi.fn(),putBoard:vi.fn()};
    const controller=new CoachingController({} as never,{} as never,{} as never,{} as never,vision as never,{} as never,{} as never,{} as never,{} as never);
    controller.getVision(user); controller.upsertVision(user,{} as never); controller.putVisionBoard(user,{board:{}} as never);
    for(const fn of Object.values(vision)) expect(fn.mock.calls[0]?.at(-1)).toEqual(actor);
  });
});
