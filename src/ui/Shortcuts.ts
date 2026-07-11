// Shortcuts — keyboard control for the whole demo, so it can be driven hands-on
// during a presentation. Each key simply clicks the relevant existing control,
// which keeps the on-screen UI perfectly in sync.

export class Shortcuts {
  constructor() {
    window.addEventListener("keydown", (e) => this.handle(e));
  }

  private click(sel: string): void {
    (document.querySelector(sel) as HTMLElement | null)?.click();
  }

  private handle(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    // Scenario 1..9
    if (e.code.startsWith("Digit")) {
      const i = parseInt(e.code.slice(5), 10) - 1;
      const btns = document.querySelectorAll<HTMLElement>(".scn");
      if (btns[i]) {
        btns[i].click();
        return;
      }
    }

    const map: Record<string, string> = {
      Space: "#c-pause",
      KeyR: "#c-reset",
      KeyC: "#nn-classical",
      KeyN: "#nn-ai",
      KeyV: "#nn-evo",
      KeyT: "#nn-train",
      KeyE: "#nn-evolve",
      KeyB: "#sc-bench",
    };
    if (map[e.code]) {
      e.preventDefault();
      this.click(map[e.code]);
    }
  }
}
