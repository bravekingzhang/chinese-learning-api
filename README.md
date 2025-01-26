# Chinese Learning API

这是一个中文学习平台的后端 API 服务，提供完整的用户管理、练习题管理、会员系统和微信分享功能。

## 目录

- [Chinese Learning API](#chinese-learning-api)
  - [目录](#目录)
  - [功能特性](#功能特性)
  - [技术栈](#技术栈)
  - [快速开始](#快速开始)
    - [前置要求](#前置要求)
    - [安装步骤](#安装步骤)
  - [项目结构](#项目结构)
  - [API 文档](#api-文档)
    - [用户相关](#用户相关)
    - [练习题相关](#练习题相关)
    - [会员相关](#会员相关)
    - [分享相关](#分享相关)
  - [部署指南](#部署指南)
    - [使用 PM2 部署](#使用-pm2-部署)
    - [使用 Docker 部署](#使用-docker-部署)
  - [开发指南](#开发指南)
    - [代码规范](#代码规范)
    - [测试](#测试)
    - [调试](#调试)
  - [贡献指南](#贡献指南)
  - [许可证](#许可证)

## 功能特性

- 📱 用户系统
  - 微信登录集成
  - JWT 认证
  - 用户信息管理
- 📚 练习题系统
  - 多样化的题目生成
  - 练习记录管理
  - 进度追踪
- 💎 会员系统
  - 会员等级管理
  - 支付集成
  - 权益管理
- 🔗 分享系统
  - 微信分享
  - 邀请奖励
  - 积分系统

## 技术栈

- **运行环境**: Node.js (v14+)
- **Web 框架**: Express.js
- **数据库**: PostgreSQL
- **ORM**: Prisma
- **认证**: JWT
- **存储**: 阿里云 OSS
- **支付**: 微信支付
- **其他**:
  - 微信开放平台 SDK
  - 扣子 AI API

## 快速开始

### 前置要求

- Node.js v14 或更高版本
- PostgreSQL 数据库
- 微信开放平台账号
- 阿里云 OSS 账号
- 扣子 AI API 账号

### 安装步骤

1. 克隆项目
```bash
git clone [项目地址]
cd chinese-learning-api
```

2. 安装依赖
```bash
npm install
```

3. 环境配置
```bash
cp .env.example .env
```
编辑 .env 文件，填写必要的配置信息：
```env
# 数据库配置
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# JWT配置
JWT_SECRET="your-jwt-secret"

# 微信配置
WECHAT_APP_ID="your-app-id"
WECHAT_APP_SECRET="your-app-secret"

# 阿里云OSS配置
OSS_ACCESS_KEY="your-access-key"
OSS_ACCESS_SECRET="your-access-secret"
OSS_BUCKET="your-bucket"
OSS_REGION="oss-cn-hangzhou"

# 扣子API配置
KOUZI_API_KEY="your-api-key"
```

4. 数据库迁移
```bash
npx prisma migrate dev
```

5. 启动服务
```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

## 项目结构

```
src/
├── controllers/     # 控制器层
├── routes/         # 路由定义
├── models/         # 数据模型
├── middlewares/    # 中间件
├── utils/          # 工具函数
├── services/       # 业务逻辑
└── config/         # 配置文件
```

## API 文档

### 用户相关

- POST `/api/user/login` - 用户登录
- GET `/api/user/info` - 获取用户信息
- PUT `/api/user/profile` - 更新用户信息

### 练习题相关

- POST `/api/exercise/generate` - 生成练习题
- GET `/api/exercise/history` - 获取练习历史
- POST `/api/exercise/submit` - 提交练习结果

### 会员相关

- POST `/api/member/subscribe` - 开通会员
- GET `/api/member/status` - 查询会员状态
- POST `/api/member/renew` - 续费会员

### 分享相关

- GET `/api/share/code` - 获取分享码
- POST `/api/share/reward` - 领取分享奖励

## 部署指南

### 使用 PM2 部署

1. 安装 PM2
```bash
npm install -g pm2
```

2. 配置 ecosystem.config.js
```bash
pm2 ecosystem
```

3. 启动服务
```bash
pm2 start ecosystem.config.js
```

### 使用 Docker 部署

1. 构建镜像
```bash
docker build -t chinese-learning-api .
```

2. 运行容器
```bash
docker run -d -p 3000:3000 chinese-learning-api
```

## 开发指南

### 代码规范

项目使用 ESLint 和 Prettier 进行代码规范控制：

```bash
# 运行代码检查
npm run lint

# 自动修复
npm run lint:fix
```

### 测试

```bash
# 运行单元测试
npm run test

# 运行测试覆盖率报告
npm run test:coverage
```

### 调试

```bash
# 使用 debug 模式启动
npm run debug
```

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件
