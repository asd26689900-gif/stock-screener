import { fmtTw } from "@/lib/format";

export default function UpdateStamp({
  job,
  times,
  label = "更新",
}: {
  job: string;
  times: Record<string, string>;
  label?: string;
}) {
  const t = times[job];
  return (
    <span className={`stamp ${t ? "ok" : "stale"}`} title={t ? fmtTw(t) : "尚無成功記錄"}>
      {label} {t ? fmtTw(t) : "待更新"}
    </span>
  );
}
