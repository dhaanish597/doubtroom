import type { ImpactDay } from "@/lib/impact/aggregate";
import { weekdayLabel } from "./format";

const WIDTH = 320;
const HEIGHT = 168;
const TOP = 18;
const BOTTOM = 24;
const BAR = 11;
const GAP = 2;
const SERIES = [
  { key: "doubts", label: "Doubts", color: "#3B2FC9" },
  { key: "aiAnswers", label: "AI answers", color: "#F5A524" },
] as const;

/** Grouped bars for the last seven days, with a table for screen readers. */
export function DailyChart({ days }: { days: ImpactDay[] }) {
  const max = Math.max(1, ...days.flatMap((day) => SERIES.map(({ key }) => day[key])));
  const slot = WIDTH / days.length;
  const plot = HEIGHT - TOP - BOTTOM;

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Last 7 days</span>
        <span className="flex gap-4 text-xs text-muted-foreground">
          {SERIES.map(({ key, label, color }) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />{label}
            </span>
          ))}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" aria-hidden="true">
        <line x1="0" x2={WIDTH} y1={HEIGHT - BOTTOM} y2={HEIGHT - BOTTOM} stroke="#e9e7f4" />
        {days.map((day, index) => {
          const center = slot * index + slot / 2;
          return (
            <g key={day.date}>
              {SERIES.map(({ key, color }, seriesIndex) => {
                const value = day[key];
                const height = value ? Math.max(2, (value / max) * plot) : 0;
                const x = center - BAR - GAP / 2 + seriesIndex * (BAR + GAP);
                return (
                  <g key={key}>
                    <rect x={x} y={HEIGHT - BOTTOM - height} width={BAR} height={height} rx="3" fill={color} />
                    {value > 0 && <text x={x + BAR / 2} y={HEIGHT - BOTTOM - height - 4} textAnchor="middle" fontSize="9" fill="#5b5870">{value}</text>}
                  </g>
                );
              })}
              <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="#6b6880">{weekdayLabel(day.date)}</text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Doubts and AI answers per day, India Standard Time</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">Doubts</th><th scope="col">AI answers</th><th scope="col">Verified</th></tr></thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}><th scope="row">{day.date}</th><td>{day.doubts}</td><td>{day.aiAnswers}</td><td>{day.verified}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
