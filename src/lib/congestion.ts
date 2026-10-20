export const MAX_STATUS_AGE_MS = 15 * 60 * 1000;
export const statusLabels = {
  unknown: "未配信",
  open: "空いています",
  busy: "やや混雑",
  crowded: "混雑しています",
  paused: "受付停止",
  closed: "終了",
} as const;
export type CongestionStatus = keyof typeof statusLabels;
export interface StatusView {
  status: CongestionStatus;
  label: string;
  updatedAt: string | null;
  waitMinutes: number | null;
  reason: "current" | "unpublished" | "stale" | "unavailable";
}
const unknown = (
  reason: StatusView["reason"],
  updatedAt: string | null = null,
): StatusView => ({
  status: "unknown",
  label:
    reason === "stale"
      ? "情報未更新"
      : reason === "unavailable"
        ? "情報を取得できません"
        : "未配信",
  updatedAt,
  waitMinutes: null,
  reason,
});
export function getStatusView(
  payload: unknown,
  id: string,
  now = Date.now(),
): StatusView {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("version" in payload) ||
    payload.version !== 1 ||
    !("venues" in payload) ||
    !payload.venues ||
    typeof payload.venues !== "object"
  )
    return unknown("unavailable");
  const record = Object.prototype.hasOwnProperty.call(payload.venues, id)
    ? (payload.venues as Record<string, unknown>)[id]
    : null;
  if (
    !record ||
    typeof record !== "object" ||
    !("status" in record) ||
    typeof record.status !== "string" ||
    !Object.prototype.hasOwnProperty.call(statusLabels, record.status)
  )
    return unknown("unavailable");
  if (record.status === "unknown") return unknown("unpublished");
  if (!("updatedAt" in record) || typeof record.updatedAt !== "string")
    return unknown("unavailable");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      record.updatedAt,
    )
  )
    return unknown("unavailable");
  const timestamp = Date.parse(record.updatedAt);
  if (!Number.isFinite(timestamp) || timestamp > now + 120000)
    return unknown("unavailable");
  if (now - timestamp >= MAX_STATUS_AGE_MS)
    return unknown("stale", record.updatedAt);
  const wait = "waitMinutes" in record ? record.waitMinutes : null;
  return {
    status: record.status as CongestionStatus,
    label: statusLabels[record.status as CongestionStatus],
    updatedAt: record.updatedAt,
    waitMinutes:
      ["open", "busy", "crowded"].includes(record.status) &&
      typeof wait === "number" &&
      Number.isInteger(wait) &&
      wait >= 0 &&
      wait <= 600
        ? wait
        : null,
    reason: "current",
  };
}
