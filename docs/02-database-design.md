# 数据库设计（MariaDB 11.4.12）

约定：
- 所有表使用 `InnoDB` 引擎，字符集 `utf8mb4`，排序规则 `utf8mb4_unicode_ci`。
- 主键统一用 `BIGINT UNSIGNED AUTO_INCREMENT`。
- 所有表都有 `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`、`updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`。
- 金额字段统一用 `DECIMAL(10,2)`，禁止用 float/double。
- 涉及资金和订单状态的表不做物理删除，用 `deleted_at`（软删）或状态字段代替。

## 1. 用户与角色

### 1.1 `users` 账号表（三种角色共用一张表，用 `role` 区分）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| phone | VARCHAR(20) UNIQUE | 登录用手机号 |
| password_hash | VARCHAR(255) | bcrypt 哈希 |
| role | ENUM('merchant','model','admin') | 角色 |
| nickname | VARCHAR(50) | 昵称/展示名 |
| avatar_url | VARCHAR(255) NULL | 头像 |
| status | ENUM('active','disabled') DEFAULT 'active' | 账号状态，管理员可封禁 |
| real_name | VARCHAR(50) NULL | 实名（达人/商家认证后填） |
| id_card_no | VARCHAR(30) NULL | 身份证号（达人实名，敏感字段，见安全备注） |
| alipay_account | VARCHAR(100) NULL | 支付宝账号（达人提现用） |
| alipay_real_name | VARCHAR(50) NULL | 支付宝实名（校验用，防止转错账） |
| verify_status | ENUM('unverified','pending','verified','rejected') DEFAULT 'unverified' | 实名认证状态 |
| created_at / updated_at | DATETIME | |

> 安全备注：`id_card_no` 属于敏感个人信息，落库前用应用层 AES 对称加密后存储（密钥放环境变量/密钥管理服务，不进代码库），日志和接口返回中做掩码处理（如 `110***********1234`）。这一点在 `05-deployment.md` 安全章节重复强调。

### 1.2 `merchant_profiles` 商家资料表（1:1 于 users，role=merchant）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| user_id | BIGINT UNSIGNED UNIQUE FK→users.id | |
| shop_name | VARCHAR(100) | 店铺名 |
| shop_platform | VARCHAR(50) NULL | 所在电商平台（淘宝/抖店等，选填） |
| contact_phone | VARCHAR(20) | 联系电话 |
| default_ship_address | VARCHAR(255) | 默认寄件地址（发样品用） |

### 1.3 `model_profiles` 达人资料表（1:1 于 users，role=model）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| user_id | BIGINT UNSIGNED UNIQUE FK→users.id | |
| height_cm | SMALLINT NULL | 身高（模特用） |
| weight_kg | SMALLINT NULL | 体重 |
| shoe_size | VARCHAR(10) NULL | 鞋码 |
| skill_tags | VARCHAR(255) NULL | 技能标签，逗号分隔或 JSON（"模特,摄影,美甲"） |
| receive_address | VARCHAR(255) | 收货地址（收样品用） |
| portfolio_urls | TEXT NULL | 作品集链接，JSON 数组字符串 |

## 2. 订单相关

### 2.1 `orders` 寄拍订单表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| order_no | VARCHAR(32) UNIQUE | 业务订单号，如 `JP20260728000001` |
| merchant_id | BIGINT UNSIGNED FK→users.id | 发单商家 |
| model_id | BIGINT UNSIGNED NULL FK→users.id | 抢单达人，抢单前为 NULL |
| title | VARCHAR(100) | 订单标题（如"夏季连衣裙寄拍"） |
| description | TEXT | 拍摄要求详细描述 |
| sample_images | TEXT | 样品图片，JSON 数组字符串 |
| commission_amount | DECIMAL(10,2) | 佣金金额 |
| deposit_amount | DECIMAL(10,2) DEFAULT 0 | 样品押金（可选，MVP 先留字段不强制启用） |
| shoot_requirements | TEXT NULL | 拍摄张数/风格/交付格式等要求 |
| status | ENUM(...) | 见 01-business-flow.md 状态机，9 个枚举值 |
| ship_to_model_tracking_no | VARCHAR(50) NULL | 商家寄出快递单号 |
| ship_to_model_company | VARCHAR(50) NULL | 快递公司 |
| return_tracking_no | VARCHAR(50) NULL | 达人寄回快递单号 |
| return_company | VARCHAR(50) NULL | 寄回快递公司 |
| submitted_media | TEXT NULL | 达人上传的素材文件列表，JSON 数组字符串 |
| reject_reason | TEXT NULL | 商家验收不通过原因 |
| claimed_at / shipped_at / in_progress_at / returned_at / completed_at / cancelled_at | DATETIME NULL | 各状态到达时间，便于统计和超时判断 |
| created_at / updated_at | DATETIME | |

索引：`idx_status`、`idx_merchant_id`、`idx_model_id`、`idx_order_no`。

### 2.2 `order_messages` 订单留言板

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| order_id | BIGINT UNSIGNED FK→orders.id | |
| sender_id | BIGINT UNSIGNED FK→users.id | |
| content | TEXT | 留言内容 |
| created_at | DATETIME | |

### 2.3 `order_logs` 订单状态变更日志（审计用，不可删）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| order_id | BIGINT UNSIGNED FK→orders.id | |
| operator_id | BIGINT UNSIGNED FK→users.id | 谁操作的 |
| from_status | VARCHAR(30) NULL | |
| to_status | VARCHAR(30) | |
| remark | VARCHAR(255) NULL | |
| created_at | DATETIME | |

## 3. 资金相关

### 3.1 `wallets` 达人钱包表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| user_id | BIGINT UNSIGNED UNIQUE FK→users.id | 每个达人一条 |
| available_balance | DECIMAL(10,2) DEFAULT 0 | 可提现余额 |
| frozen_balance | DECIMAL(10,2) DEFAULT 0 | 提现审核中冻结金额 |
| updated_at | DATETIME | |

### 3.2 `wallet_transactions` 余额流水表（只增不改不删）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| user_id | BIGINT UNSIGNED FK→users.id | |
| type | ENUM('order_settlement','withdrawal_freeze','withdrawal_complete','withdrawal_reject_refund') | 流水类型 |
| amount | DECIMAL(10,2) | 正数入账，负数出账 |
| balance_after | DECIMAL(10,2) | 变动后余额，便于核对 |
| order_id | BIGINT UNSIGNED NULL FK→orders.id | 关联订单（结算类） |
| withdrawal_id | BIGINT UNSIGNED NULL FK→withdrawals.id | 关联提现单（提现类） |
| remark | VARCHAR(255) NULL | |
| created_at | DATETIME | |

### 3.3 `withdrawals` 提现申请表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| withdrawal_no | VARCHAR(32) UNIQUE | 提现单号 |
| user_id | BIGINT UNSIGNED FK→users.id | 申请人（达人） |
| amount | DECIMAL(10,2) | 申请金额 |
| alipay_account | VARCHAR(100) | 申请时的支付宝账号（快照，防止用户后续改账号导致对不上） |
| alipay_real_name | VARCHAR(50) | |
| status | ENUM('pending','approved','rejected','completed') DEFAULT 'pending' | |
| reviewer_id | BIGINT UNSIGNED NULL FK→users.id | 审核/登记的管理员 |
| reject_reason | VARCHAR(255) NULL | |
| transfer_no | VARCHAR(100) NULL | 交易员登记的支付宝转账流水号 |
| transferred_at | DATETIME NULL | 登记转账完成的时间 |
| created_at / updated_at | DATETIME | |

### 3.4 `platform_configs` 平台配置表（KV，避免改配置要改代码）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| config_key | VARCHAR(50) UNIQUE | 如 `withdrawal_min_amount` |
| config_value | VARCHAR(255) | |
| description | VARCHAR(255) NULL | |

## 4. ER 关系概览

```
users(1) ──1:1── merchant_profiles
users(1) ──1:1── model_profiles
users(1) ──1:1── wallets(达人)
users(商家,1) ──1:N── orders ──N:1── users(达人)
orders(1) ──1:N── order_messages
orders(1) ──1:N── order_logs
orders(1) ──1:N── wallet_transactions
users(达人,1) ──1:N── withdrawals ──1:N── wallet_transactions
```

## 5. 建表 SQL

放在 `backend/migrations`（Alembic 自动生成），MVP 阶段直接用 SQLAlchemy models 定义后跑 `alembic revision --autogenerate` 生成，不手写 SQL 文件维护两份真相源。

## 6. 本模块执行清单

- [ ] 在 `backend/app/models/` 下按上述表结构定义 SQLAlchemy ORM 模型
- [ ] 配置 Alembic，生成初始迁移脚本
- [ ] 编写 `id_card_no` 字段的应用层加解密工具函数（AES-256-GCM，密钥来自环境变量）
- [ ] 编写种子数据脚本（至少 1 个管理员账号、若干测试商家/达人账号）供开发和演示使用
