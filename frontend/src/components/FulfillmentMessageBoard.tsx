import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Empty, Input, List, Space, Typography } from "antd";

import { getFulfillmentMessages, postFulfillmentMessage } from "../api/orders";
import { useAuthStore } from "../stores/authStore";

interface FulfillmentMessageBoardProps {
  fulfillmentId: number;
  title?: string;
}

export function FulfillmentMessageBoard({ fulfillmentId, title = "履约留言" }: FulfillmentMessageBoardProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.session?.user.id);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["fulfillment-messages", fulfillmentId],
    queryFn: () => getFulfillmentMessages(fulfillmentId),
    refetchInterval: 10_000,
  });

  const send = async () => {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await postFulfillmentMessage(fulfillmentId, text);
      setContent("");
      await queryClient.invalidateQueries({ queryKey: ["fulfillment-messages", fulfillmentId] });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "留言发送失败");
    } finally {
      setSending(false);
    }
  };

  return <Card size="small" title={title} className="fulfillment-message-board">
    <List
      loading={isLoading}
      dataSource={data?.items ?? []}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无履约留言" /> }}
      renderItem={(item) => <List.Item>
        <List.Item.Meta
          title={item.sender_id === currentUserId ? "我" : `履约参与人 #${item.sender_id}`}
          description={item.created_at ? new Date(item.created_at).toLocaleString() : ""}
        />
        <Typography.Paragraph className="fulfillment-message-content">{item.content}</Typography.Paragraph>
      </List.Item>}
    />
    <Space.Compact className="message-composer">
      <Input
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onPressEnter={send}
        placeholder="输入履约留言"
        maxLength={5000}
        showCount
        disabled={sending}
      />
      <Button type="primary" loading={sending} disabled={!content.trim()} onClick={send}>发送</Button>
    </Space.Compact>
  </Card>;
}
