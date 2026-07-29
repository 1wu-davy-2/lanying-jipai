import { CrownOutlined, TrophyOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Card, Empty, Segmented, Skeleton, Space, Statistic, Tag, Typography } from "antd";
import { useState } from "react";

import { getModelRanking, type RankingEntry } from "../api/users";

function RankingList({ entries, simulated }: { entries: RankingEntry[]; simulated: boolean }) {
  if (!entries.length) return <Empty description="暂无已认证达人的成交数据" />;
  return <div className="ranking-list">{entries.map((entry) => <article className="ranking-row" key={`${simulated}-${entry.rank}-${entry.nickname}`}>
    <strong className={`ranking-place ranking-place-${entry.rank}`}>{entry.rank <= 3 ? <CrownOutlined /> : entry.rank}</strong>
    <Avatar src={entry.avatar_url}>{entry.nickname.slice(0, 1)}</Avatar>
    <div className="ranking-person"><strong>{entry.nickname}</strong><Space size={6}><Tag color="gold">{entry.level}</Tag>{simulated && <Tag>平台演示</Tag>}</Space></div>
    <div className="ranking-stats"><span>{entry.completed_orders} 单完成</span><b>¥{entry.earnings}</b></div>
  </article>)}</div>;
}

export function TalentRankingPage() {
  const [mode, setMode] = useState("real");
  const { data, isLoading } = useQuery({ queryKey: ["model-ranking"], queryFn: getModelRanking });
  const entries = mode === "real" ? data?.real ?? [] : data?.simulated ?? [];

  return <section className="talent-ranking">
    <div className="page-heading"><div><Typography.Title level={2}>达人排行榜</Typography.Title><Typography.Text type="secondary">真实榜仅统计认证达人已完成订单；演示榜不参与任何权益或等级计算。</Typography.Text></div><TrophyOutlined className="talent-hall-icon" /></div>
    <Card className="content-card ranking-panel">
      <Segmented value={mode} onChange={(value) => setMode(String(value))} options={[{ label: "真实达人成交榜", value: "real" }, { label: "平台演示热榜", value: "simulated" }]} />
      {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : <RankingList entries={entries} simulated={mode === "simulated"} />}
    </Card>
    <div className="ranking-rule-grid">
      <Card size="small"><Statistic title="新星达人" value="1 单" suffix="并行；≤ ¥300/单" /></Card>
      <Card size="small"><Statistic title="稳定达人" value="2 单" suffix="并行；≤ ¥800/单" /></Card>
      <Card size="small"><Statistic title="进阶及以上" value="3-8 单" suffix="并行；最高 ¥8,000/单" /></Card>
    </div>
  </section>;
}
