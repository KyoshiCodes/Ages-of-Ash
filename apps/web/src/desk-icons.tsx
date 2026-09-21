/** One icon family: 24px viewBox, 1.75px rounded strokes, never used without a text label. */
export function DeskIcon({
  name,
}: {
  name: "ledger" | "clock" | "crew" | "network" | "ash" | "seal";
}) {
  const paths = {
    ledger: "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 6v6l4 2",
    crew: "M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 21v-5a5 5 0 0 1 10 0v5 M17 4a3 3 0 0 1 0 6 M17 12a4 4 0 0 1 4 4v5",
    network: "M3 3h6v6H3z M15 15h6v6h-6z M6 9v9h9 M9 6h9v9",
    ash: "M12 2 4 19h16L12 2 M12 10l-3 7h6z",
    seal: "M12 3l3 3 4 1v4l2 3-3 3-1 4-5-1-5 1-1-4-3-3 2-3V7l4-1z M8 12l3 3 5-6",
  };
  return (
    <svg
      className="desk-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
