export interface EventSession {
  id: string;
  label: string;
  starts_at: string;
  ends_at: string;
}

// 開始・終了時刻の確定待ち。未登録の間は受付・本番発行を開始できない。
export const congestionEvent = {
  event_id: "tsukukoma-2026-ennichi",
  sessions: [] as EventSession[],
  poll_seconds: 15,
  publication_ttl_seconds: 60,
  observation_ttl_seconds: 600,
  // HTTP Date has one-second precision.
  clock_tolerance_seconds: 1,
};
