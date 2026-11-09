type NumberBallProps = {
  number: number;
  area?: "area1" | "area2";
  isHit?: boolean;
  size?: "sm" | "md" | "lg";
};

export function NumberBall({
  number,
  area = "area1",
  isHit = false,
  size = "md",
}: NumberBallProps) {
  const formatted = String(number).padStart(2, "0");
  const hitClass = isHit ? "hit" : "";
  const areaClass = area === "area2" ? "area2" : "area1";
  const sizeClass = size !== "md" ? size : "";

  return (
    <span
      className={`number-ball ${areaClass} ${hitClass} ${sizeClass}`.trim()}
      aria-label={`${area === "area1" ? "第一區" : "第二區"}號碼 ${formatted}${isHit ? " (命中)" : ""}`}
    >
      {formatted}
    </span>
  );
}
