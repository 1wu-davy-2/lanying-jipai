export const SHIPPING_ADDRESS_OPTIONS = [
  { value: "北京市", label: "北京市", children: [{ value: "北京市", label: "北京市", children: [{ value: "朝阳区", label: "朝阳区" }, { value: "海淀区", label: "海淀区" }, { value: "通州区", label: "通州区" }] }] },
  { value: "上海市", label: "上海市", children: [{ value: "上海市", label: "上海市", children: [{ value: "浦东新区", label: "浦东新区" }, { value: "静安区", label: "静安区" }, { value: "闵行区", label: "闵行区" }] }] },
  { value: "广东省", label: "广东省", children: [{ value: "广州市", label: "广州市", children: [{ value: "天河区", label: "天河区" }, { value: "白云区", label: "白云区" }] }, { value: "深圳市", label: "深圳市", children: [{ value: "南山区", label: "南山区" }, { value: "福田区", label: "福田区" }, { value: "宝安区", label: "宝安区" }] }] },
  { value: "浙江省", label: "浙江省", children: [{ value: "杭州市", label: "杭州市", children: [{ value: "西湖区", label: "西湖区" }, { value: "滨江区", label: "滨江区" }] }, { value: "宁波市", label: "宁波市", children: [{ value: "鄞州区", label: "鄞州区" }, { value: "海曙区", label: "海曙区" }] }] },
  { value: "江苏省", label: "江苏省", children: [{ value: "南京市", label: "南京市", children: [{ value: "建邺区", label: "建邺区" }, { value: "雨花台区", label: "雨花台区" }] }, { value: "苏州市", label: "苏州市", children: [{ value: "工业园区", label: "工业园区" }, { value: "姑苏区", label: "姑苏区" }] }] },
  { value: "四川省", label: "四川省", children: [{ value: "成都市", label: "成都市", children: [{ value: "锦江区", label: "锦江区" }, { value: "武侯区", label: "武侯区" }, { value: "高新区", label: "高新区" }] }] },
  { value: "湖北省", label: "湖北省", children: [{ value: "武汉市", label: "武汉市", children: [{ value: "江汉区", label: "江汉区" }, { value: "洪山区", label: "洪山区" }] }] },
  { value: "重庆市", label: "重庆市", children: [{ value: "重庆市", label: "重庆市", children: [{ value: "渝北区", label: "渝北区" }, { value: "江北区", label: "江北区" }] }] },
];

export function addressToPath(value: string | null | undefined): string[] {
  return value ? value.split(" / ") : [];
}

export function addressFromPath(value: string[] | undefined): string {
  return value?.join(" / ") ?? "";
}
