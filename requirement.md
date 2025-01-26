# 趣味汉字学习小程序产品需求文档（修订版）

## 一、项目概述

### 1.1 项目背景
本项目是一款基于uniapp框架开发的儿童汉字学习小程序，通过游戏化的方式帮助儿童学习和掌握汉字。

### 1.2 项目目标
- 为5-12岁儿童提供有趣的汉字学习平台
- 通过多样化的生成方式和关卡设计提高学习兴趣
- 建立完整的用户成长体系
- 实现商业化运营

### 1.3 技术架构
- 前端框架：uni-app
- UI框架：uView
- 后端服务：Node.js
- 数据库：阿里云RDS
- 存储服务：阿里云OSS
- AI服务：扣子API

## 二、功能模块详细设计

### 2.1 登录模块
#### 2.1.1 功能描述
- 仅支持微信一键登录
- 必须获取用户微信绑定手机号
- 静默获取用户基础信息（头像、昵称等）
- 首次登录时可选填邀请码

#### 2.1.2 登录流程
1. 打开小程序自动获取微信用户信息
2. 检查是否授权手机号
3. 未授权则弹出获取手机号按钮
4. 获取手机号后检查是否首次登录
5. 如果是首次登录，展示邀请码输入框（可跳过）
6. 完成登录流程

### 2.2 题目生成模块
#### 2.2.1 输入方式
1. **手动输入模式**
- 输入框限制6个汉字
- 实时检验输入合法性
- 扣子API并生成题目

2. **单元选择模式**
- 简单数字选择：1-60
- 下拉选择或数字输入框
- 选择后扣子API生成题目

3. **拍照识别模式**
- 调用相机拍照
- 直接上传原图到扣子API
- 扣子API识别结果并生成题目

#### 2.2.2 通用参数设置
- 难度选择：容易/中等/较难
- 语言风格：标准/趣味/文学

#### 2.2.3 生成规则
每次生成四组词语：
7. 第一关：6个二字词
8. 第二关：6个三字词
9. 第三关：6个四字词
10. 第四关：6个六字词

### 2.3 题目展示模块
#### 2.3.1 界面布局
- 单页面展示所有内容
- 四个关卡垂直排列
- 每关显示6个词语
- 底部功能按钮区

#### 2.3.2 功能要求
- 语音播放控制（扣子API生成题目的时候会自动同时生成音频文件）
- 文字显示/隐藏
- 打乱顺序
- 重新生成

### 2.4 历史记录模块
#### 2.4.1 展示内容
- 六个基础字
- 难度等级
- 生成日期
- 复习按钮
- 删除按钮

#### 2.4.2 功能要求
- 列表形式展示
- 点击复习按钮重新进入题目展示页
- 按时间倒序排列
- 支持下拉刷新和上拉加载

### 2.5 个人中心页面
#### 2.5.1 基础信息区
- 头像
- 昵称
- 手机号
- 当前积分
- 会员状态（普通/会员）

#### 2.5.2 会员功能区
- 会员等级说明
  - 体验会员：7天（9.9元）
  - 月度会员：30天（29.9元）
  - 年度会员：365天（299元）
- 开通/续费按钮
- 微信支付接入
- 卡密兑换入口
- 会员权益说明：
  1. 无限次生成题目
  2. 无广告

#### 2.5.3 分享奖励机制
- 用户分享小程序给好友
- 好友首次登录时填写邀请码
- 双方各获得7天会员时长
- 每个用户每月最多获得10次分享奖励

### 2.6 奖励系统
#### 2.6.1 积分机制
1. **积分获取**
- 生成题目：每次生成题目获得10积分
- 每日首次生成额外奖励20积分
- 每日最多可获得100积分

2. **积分消耗**
- 生成奖励图片：消耗50积分/次
- 积分不足时无法生成图片
- 积分仅用于生成图片，不影响其他功能

3. **积分规则**
- 积分永久有效，不会过期
- 积分不可转让
- 用户注销后积分作废

#### 2.6.2 奖励图片
- 消耗50积分生成一张奖励图片
- 历史图片列表展示
- 图片保存分享功能

## 三、数据库设计

### 3.1 用户表(user)
CREATE TABLE user (
    id VARCHAR(32) PRIMARY KEY,
    open_id VARCHAR(32) NOT NULL COMMENT '微信openid',
    phone VARCHAR(11) NOT NULL COMMENT '手机号',
    nickname VARCHAR(50) COMMENT '用户昵称',
    avatar VARCHAR(255) COMMENT '头像URL',
    points INT DEFAULT 0 COMMENT '当前积分',
    member_type INT DEFAULT 0 COMMENT '会员类型 0:普通用户 1:7天会员 2:30天会员 3:365天会员',
    expire_time TIMESTAMP NULL COMMENT '会员到期时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_open_id (open_id),
    INDEX idx_phone (phone),
    INDEX idx_expire_time (expire_time)
);

### 3.2 题目记录表(exercise_record)
CREATE TABLE exercise_record (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    base_chars VARCHAR(12) NOT NULL COMMENT '基础汉字',
    difficulty INT NOT NULL COMMENT '难度等级',
    content JSON COMMENT '题目内容',
    audio_url_1 VARCHAR(255) COMMENT '第一关音频URL',
    audio_url_2 VARCHAR(255) COMMENT '第二关音频URL',
    audio_url_3 VARCHAR(255) COMMENT '第三关音频URL',
    audio_url_4 VARCHAR(255) COMMENT '第四关音频URL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

### 3.3 图片记录表(image_record)
CREATE TABLE image_record (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    points_cost INT NOT NULL COMMENT '消耗积分',
    image_url VARCHAR(255) NOT NULL COMMENT '图片URL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_user_id (user_id)
);

### 3.4 积分记录表(points_record)
CREATE TABLE points_record (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    points INT NOT NULL COMMENT '积分变动数量',
    type INT NOT NULL COMMENT '1:生成题目获得 2:生成图片消耗 3:分享奖励',
    remark VARCHAR(255) COMMENT '备注说明',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

### 3.5 会员表(member)
CREATE TABLE member (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    member_type INT NOT NULL COMMENT '1:7天会员 2:30天会员 3:365天会员',
    expire_time TIMESTAMP NOT NULL COMMENT '会员到期时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_user_id (user_id),
    INDEX idx_expire_time (expire_time)
);

### 3.6 订单表(orders)
CREATE TABLE orders (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    order_no VARCHAR(32) NOT NULL COMMENT '订单编号',
    amount DECIMAL(10,2) NOT NULL COMMENT '支付金额',
    member_type INT NOT NULL COMMENT '1:7天会员 2:30天会员 3:365天会员',
    days INT NOT NULL COMMENT '会员天数',
    type INT NOT NULL COMMENT '1:会员购买 2:卡密兑换',
    status INT NOT NULL DEFAULT 0 COMMENT '0:未支付 1:已支付 2:已取消',
    pay_time TIMESTAMP COMMENT '支付时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_user_id (user_id),
    INDEX idx_order_no (order_no),
    INDEX idx_created_at (created_at)
);

### 3.7 卡密表(card)
CREATE TABLE card (
    id VARCHAR(32) PRIMARY KEY,
    card_no VARCHAR(32) NOT NULL COMMENT '卡密编号',
    member_type INT NOT NULL COMMENT '1:7天会员 2:30天会员 3:365天会员',
    days INT NOT NULL COMMENT '会员天数',
    status INT NOT NULL DEFAULT 0 COMMENT '0:未使用 1:已使用',
    used_user_id VARCHAR(32) COMMENT '使用用户ID',
    used_time TIMESTAMP COMMENT '使用时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_card_no (card_no),
    INDEX idx_status (status)
);

### 3.8 分享记录表(share_record)
CREATE TABLE share_record (
    id VARCHAR(32) PRIMARY KEY,
    sharer_id VARCHAR(32) NOT NULL COMMENT '分享人ID',
    invitee_id VARCHAR(32) NOT NULL COMMENT '被邀请人ID',
    reward_days INT NOT NULL DEFAULT 7 COMMENT '奖励天数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_sharer_id (sharer_id),
    INDEX idx_created_at (created_at),
    INDEX idx_sharer_created (sharer_id, created_at) COMMENT '用于统计分享次数'
);

## 四、接口设计

### 4.1 登录接口
POST /api/user/login
Request: {
    code: "xxx",           // 微信登录code
    phone: "13800138000",  // 手机号
    invite_code: "ABC123"  // 可选，首次登录时的邀请码
}
Response: {
    code: 0,
    data: {
        token: "xxx",
        is_new_user: false,
        user_info: {
            nickname: "xxx",
            avatar: "xxx",
            points: 0,
            is_member: false
        }
    }
}

### 4.2 题目生成/重新生成接口
POST /api/exercise/generate
Request:
{
    type: 1,  // 1:手动输入 2:单元选择 3:图片识别
    chars: "天地人和为贵",  // type=1时必填
    unit_id: "xxx",  // type=2时必填
    image_url: "xxx",  // type=3时必填
    difficulty: 1,
    style: 1
}

Response:
{
    code: 0,
    data: {
        id: "xxx",  // 题目记录ID，用于打乱顺序等后续操作
        content: {
            base_chars: [],
            level_1: [],
            level_2: [],
            level_3: [],
            level_4: []
        },
        audio_url_1: "xxx",
        audio_url_2: "xxx",
        audio_url_3: "xxx",
        audio_url_4: "xxx"
    }
}

### 4.3 打乱顺序接口
POST /api/exercise/shuffle
Request:
{
    exercise_id: "xxx"  // 来自题目生成接口返回的id
}

Response:
{
    code: 0,
    data: {
        content: {
            base_chars: [],
            level_1: [],
            level_2: [],
            level_3: [],
            level_4: []
        },
        audio_url_1: "xxx",
        audio_url_2: "xxx",
        audio_url_3: "xxx",
        audio_url_4: "xxx"
    }
}

### 4.4 会员相关接口
// 创建订单
POST /api/order/create
Request:
{
    type: 1,  // 1:会员购买 2:卡密兑换
    member_type: 1, // 1:7天会员 2:30天会员 3:365天会员
    card_no: "xxx"  // type=2时必填
}
Response:
{
    code: 0,
    data: {
        order_no: "xxx",
        amount: 29.9,  // 支付金额
        member_type: 1,
        days: 30,
        pay_params: {} // 微信支付参数
    }
}

// 订单查询
GET /api/order/query
Request:
{
    order_no: "xxx"
}
Response:
{
    code: 0,
    data: {
        status: 1,
        member_type: 2,  // 1:7天会员 2:30天会员 3:365天会员
        expire_time: "2024-12-31 23:59:59"
    }
}

// 卡密兑换
POST /api/card/exchange
Request:
{
    card_no: "xxx"
}
Response:
{
    code: 0,
    data: {
        member_type: 2,  // 1:7天会员 2:30天会员 3:365天会员
        days: 30,
        expire_time: "2024-12-31 23:59:59"
    }
}

### 4.5 分享相关接口
// 生成邀请码
GET /api/share/code
Response:
{
    code: 0,
    data: {
        invite_code: "ABC123" // 用户唯一的邀请码
    }
}

// 使用邀请码
POST /api/share/invite
Request:
{
    invite_code: "ABC123"
}
Response:
{
    code: 0,
    data: {
        reward_days: 7,
        expire_time: "2024-12-31 23:59:59"
    }
}

// 获取分享统计
GET /api/share/stats
Response:
{
    code: 0,
    data: {
        total_invites: 8,        // 总邀请人数
        month_invites: 3,        // 本月邀请人数
        total_reward_days: 56,   // 总获得奖励天数
        month_remain_times: 7    // 本月剩余可获得奖励次数
    }
}

### 4.6 积分相关接口
// 获取积分明细
GET /api/points/records
Request:
{
    page: 1,
    size: 20
}
Response:
{
    code: 0,
    data: {
        total: 100,
        list: [{
            id: "xxx",
            points: 10,
            type: 1,  // 1:生成题目获得 2:生成图片消耗 3:分享奖励
            created_at: "2024-03-20 12:00:00"
        }]
    }
}

// 获取今日积分统计
GET /api/points/today
Response:
{
    code: 0,
    data: {
        today_points: 30,    // 今日已获得积分
        remain_points: 70    // 今日还可获得积分
    }
}