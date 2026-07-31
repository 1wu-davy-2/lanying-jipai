import { Form, InputNumber, Select, Switch } from "antd";

export function OrderFulfillmentFormItems() {
  return <>
    <Form.Item name="product_source" label="商品来源" rules={[{ required: true, message: "请选择商品来源" }]}>
      <Select options={[
        { value: "merchant_ship", label: "商家寄样" },
        { value: "talent_purchase", label: "达人自行购买（每单补贴至少 ¥12）" },
        { value: "talent_owned", label: "达人已有同款（需商家审核实拍图）" },
      ]} />
    </Form.Item>
    <Form.Item noStyle shouldUpdate={(previous, current) => previous.product_source !== current.product_source}>
      {({ getFieldValue }) => {
        const productSource = getFieldValue("product_source") ?? "merchant_ship";
        if (productSource === "talent_purchase") {
          return <Form.Item name="product_subsidy_amount" label="商品补贴" extra="商品由达人自行购买，验收通过后与佣金一并结算。" rules={[{ required: true, message: "请输入商品补贴" }]}>
            <InputNumber min={12} precision={2} className="field-full" prefix="¥" />
          </Form.Item>;
        }
        if (productSource === "talent_owned") {
          return <Form.Item extra="达人申请时必须上传同款实拍图，商家审核通过后才可开始拍摄。"><span>已有同款商品无需寄样，拍摄后归达人自留。</span></Form.Item>;
        }
        return <Form.Item name="return_required" label="拍摄后需要返货" valuePropName="checked" extra="关闭后商品拍完归达人自留，无需填写返件物流。"><Switch /></Form.Item>;
      }}
    </Form.Item>
  </>;
}
