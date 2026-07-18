// Far-left icon rail (design system navigation/NavRail): brand mark on top,
// then one monochrome glyph per top-level surface.
import { useSettings } from "@/stores/settings";

function RailButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-[34px] w-[34px] items-center justify-center rounded-lg border text-[17px] ${
        active
          ? "border-line bg-raised text-accent-strong"
          : "border-transparent text-ink-3 hover:bg-hover hover:text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

export function NavRail({
  view,
  onMail,
  onCalendar,
}: {
  view: "mail" | "calendar";
  onMail: () => void;
  onCalendar: () => void;
}) {
  const theme = useSettings((s) => s.settings.theme);
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-line bg-base py-3">
      {/* The rocket-snail mark — ink flips with the theme (navy on light,
          near-white on dark); the cyan shell + gold flame are brand constants. */}
      <img
        src={theme === "light" ? "/snail-mail-icon.svg" : "/snail-mail-icon-on-dark.svg"}
        alt="Snail Mail"
        className="mb-2 h-8 w-8"
        draggable={false}
      />
      <RailButton label="Mail" active={view === "mail"} onClick={onMail}>
        ✉
      </RailButton>
      <RailButton
        label="Calendar"
        active={view === "calendar"}
        onClick={onCalendar}
      >
        ▦
      </RailButton>
    </nav>
  );
}
