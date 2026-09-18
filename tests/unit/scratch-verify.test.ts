import { describe, expect, it } from "vitest";
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";

describe("scratch", () => {
  it("inspect link mark attrs", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const editor = BlockNoteEditor.create({
      initialContent: [{ type: "paragraph", content: "hi" }] as PartialBlock[],
    });
    editor.mount(el as HTMLElement);
    editor.createLink("synapse:Official%20API", "official");
    const view = editor.prosemirrorView!;
    view.state.doc.descendants((node: any) => {
      if (node.marks?.length) {
        for (const m of node.marks) console.log("MARK:", m.type.name, JSON.stringify(m.attrs));
      }
    });
    const linkMark = view.state.schema.marks["link"];
    console.log("SPEC ATTRS:", JSON.stringify(linkMark.spec.attrs));
    console.log("SPEC PARSE HTML:", JSON.stringify(linkMark.spec.parseHTML));
    console.log("SPEC RENDER:", linkMark.spec.renderHTML?.toString());
    editor._tiptapEditor?.destroy?.();
    el.remove();
  });
});
