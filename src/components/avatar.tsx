import { avatarBackground, initialsOf } from "@/lib/avatar";

/*
 * Sizes are in rem so the "large text" toggle scales avatars along with
 * everything else. Values come from the design handoff.
 */
const SIZES = {
  sm: "size-9.5 text-sm", // 38px — headers
  md: "size-10.5 text-md", // 42px — member lists
  lg: "size-15 text-[1.25rem]", // 60px — PIN screen
} as const;

type AvatarProps = {
  name: string;
  colorIndex: number;
  size?: keyof typeof SIZES;
};

/**
 * A member's face: initials on a coloured disc.
 *
 * Decorative — the member's name is always written next to it, so the disc is
 * hidden from screen readers rather than read out twice.
 */
export function Avatar({ name, colorIndex, size = "md" }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`text-ink flex shrink-0 items-center justify-center rounded-full font-semibold ${avatarBackground(colorIndex)} ${SIZES[size]}`}
    >
      {initialsOf(name)}
    </span>
  );
}
