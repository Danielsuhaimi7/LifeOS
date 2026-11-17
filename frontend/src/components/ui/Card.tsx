import type { HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLElement> & {
  padding?: "comfortable" | "compact";
};

export function Card({
  padding = "comfortable",
  className = "",
  ...props
}: CardProps) {
  const classes = ["card", "card--" + padding, className].filter(Boolean).join(" ");

  return <section className={classes} {...props} />;
}

