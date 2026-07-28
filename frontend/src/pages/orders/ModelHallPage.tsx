import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Col, Modal, Row, Typography, message } from "antd";

import { claimOrder, getOrderHall } from "../../api/orders";

export function ModelHallPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["order-hall"], queryFn: getOrderHall, refetchInterval: 15_000 });
  const claim = async (id: number) => {
    try { await claimOrder(id); await queryClient.invalidateQueries({ queryKey: ["order-hall"] }); message.success("抢单成功"); }
    catch (error) { message.error(error instanceof Error ? error.message : "该订单已被抢走"); await queryClient.invalidateQueries({ queryKey: ["order-hall"] }); }
  };
  const confirmClaim = (id: number) => Modal.confirm({ title: "确认抢单", content: "抢单成功后需要按订单要求完成拍摄与回寄。", okText: "确认抢单", cancelText: "取消", onOk: () => claim(id) });
  return <div><div className="page-heading"><Typography.Title level={2}>抢单大厅</Typography.Title></div><Row gutter={[16, 16]}>{!isLoading && (data?.items ?? []).map((order) => <Col xs={24} md={12} xl={8} key={order.id}><Card className="order-card" title={order.title} extra={<strong>¥{order.commission_amount}</strong>}><p>{order.description}</p><Button type="primary" block onClick={() => confirmClaim(order.id)}>抢单</Button></Card></Col>)}</Row></div>;
}
