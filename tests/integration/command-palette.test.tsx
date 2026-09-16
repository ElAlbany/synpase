import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { createNote } from "@/db/notes";
import { useUIStore } from "@/stores/useUIStore";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/app",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

const openPalette = () => {
  const setOpen = useUIStore.getState().setPaletteOpen;
  React.act(() => setOpen(true));
};

beforeEach(() => {
  pushMock.mockReset();
  React.act(() => useUIStore.getState().setPaletteOpen(false));
});

afterEach(() => {
  React.act(() => useUIStore.getState().setPaletteOpen(false));
});

const seedNotes = async () => {
  const alpha = await createNote({
    title: "Alpha Note",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "alpha stuff inside" }] },
    ],
  });
  const beta = await createNote({
    title: "Beta Note",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "beta things inside" }] },
    ],
  });
  return { alpha, beta };
};

const textContentIs =
  (expected: string) => (_: string, el: Element | null) =>
    el?.textContent === expected;

describe("CommandPalette", () => {
  it("renders nothing while closed and opens via the UI store", async () => {
    render(<CommandPalette />);
    // On first mount the close transition briefly renders the (invisible)
    // dialog; wait for it to settle to a fully closed state.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );

    openPalette();

    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    // Live query has loaded and the static actions are listed.
    expect(await screen.findByText("Go Home")).toBeInTheDocument();
  });

  it("filters notes as you type", async () => {
    await seedNotes();
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    const input = await screen.findByRole("combobox");
    await user.click(input);
    await user.type(input, "alpha");

    expect(
      await screen.findByText(textContentIs("Alpha Note"))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textContentIs("Beta Note"))
    ).not.toBeInTheDocument();
    // Create actions are offered for the typed text.
    expect(screen.getByText('Create note "alpha"')).toBeInTheDocument();
  });

  it("navigates to the active note on Enter", async () => {
    const { alpha } = await seedNotes();
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    const input = await screen.findByRole("combobox");
    await user.click(input);
    await user.type(input, "alpha{Enter}");

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/app/note/${alpha.id}`)
    );
  });

  it('creates a note via the "Create note" action', async () => {
    await seedNotes();
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    const input = await screen.findByRole("combobox");
    await user.click(input);
    // No note fuzzy-matches this, so the first item is the create action.
    await user.type(input, "brand new thing{Enter}");

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    const href = pushMock.mock.calls[0][0] as string;
    expect(href).toMatch(/^\/app\/note\/.+/);
    expect(useUIStore.getState().paletteOpen).toBe(false);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    const input = await screen.findByRole("combobox");
    await user.click(input);
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("moves the active item with arrow keys", async () => {
    await seedNotes();
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    const input = await screen.findByRole("combobox");
    await user.click(input);
    // Empty query: notes group first, then actions.
    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(7); // 2 notes + 5 actions
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}{ArrowDown}");

    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
  });

  it("wraps around from the last item back to the first", async () => {
    await seedNotes();
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    const input = await screen.findByRole("combobox");
    await user.click(input);
    const options = await screen.findAllByRole("option");
    const last = options.length - 1;

    await user.keyboard(`{ArrowUp}`);
    expect(options[last]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });
});
