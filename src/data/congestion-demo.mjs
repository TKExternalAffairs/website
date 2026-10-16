// Example content ONLY. Never included in an ordinary production build.
export function demoContent(now = new Date()) {
  const day = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const rows = [
    [
      "rhythm",
      "音ゲー",
      "リズムにのって、ハイスコアへ。音楽に合わせてタイミングよくボタンを押そう。",
      3,
      5,
      "RHYTHM",
    ],
    [
      "bullet-hell",
      "弾幕ゲーム",
      "迫りくる弾幕をくぐり抜けよう。一瞬の判断と集中力が試されるシューティング。",
      3,
      5,
      "SHOOTING",
    ],
    [
      "racing",
      "レースゲーム",
      "コーナーを攻めて、ゴールを目指せ。自分だけのベストラップに挑戦しよう。",
      4,
      6,
      "RACING",
    ],
    [
      "card-game",
      "カードゲーム",
      "次の一手で、流れが変わる。向かい合って遊ぶ、駆け引きいっぱいのカードゲーム。",
      5,
      10,
      "TABLE GAME",
    ],
    [
      "pinball",
      "ピンボール",
      "ボールの行方に、目が離せない。フリッパーを操って得点を積み重ねよう。",
      2,
      4,
      "ARCADE",
    ],
    [
      "janken",
      "じゃんけんまん",
      "勝負は、じゃんけんぽん！ じゃんけんまんとの真剣勝負を楽しもう。",
      1,
      3,
      "CHALLENGE",
    ],
  ];
  return {
    event_id: "preview-ennichi",
    sessions: [
      {
        id: "demo-day",
        label: "操作体験用セッション",
        starts_at: `${day}T00:00:00+09:00`,
        ends_at: `${day}T23:59:59+09:00`,
      },
    ],
    games: rows.map(([id, name, description, min, max, category]) => ({
      id,
      name,
      description,
      play_minutes_min: min,
      play_minutes_max: max,
      category,
      location: "ピロティ・アトラク部門（例）",
    })),
  };
}
