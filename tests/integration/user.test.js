const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { getWechatAccessToken, getWechatUserInfo } = require('../../src/utils/wechat');

const prisma = new PrismaClient();

// Mock WeChat API calls
jest.mock('../../src/utils/wechat');

describe('User API', () => {
  let testUser;
  let token;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        openId: 'test_openid',
        phone: '13800138000',
        nickname: 'Test User',
        avatar: 'http://test.com/avatar.jpg'
      }
    });

    // Generate test token
    token = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    await prisma.$disconnect();
  });

  describe('POST /api/user/login', () => {
    beforeEach(() => {
      // Mock WeChat API responses
      getWechatAccessToken.mockResolvedValue({
        access_token: 'mock_token',
        openid: 'test_openid'
      });
      getWechatUserInfo.mockResolvedValue({
        nickname: 'Test User',
        headimgurl: 'http://test.com/avatar.jpg'
      });
    });

    it('should login existing user successfully', async () => {
      const response = await request(app)
        .post('/api/user/login')
        .send({
          code: 'test_code',
          phone: '13800138000'
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.token).toBeTruthy();
      expect(response.body.data.is_new_user).toBe(false);
    });

    it('should create new user when logging in for the first time', async () => {
      const newPhone = '13800138001';

      const response = await request(app)
        .post('/api/user/login')
        .send({
          code: 'test_code',
          phone: newPhone
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.token).toBeTruthy();
      expect(response.body.data.is_new_user).toBe(true);

      // Cleanup new user
      await prisma.user.deleteMany({
        where: { phone: newPhone }
      });
    });
  });

  describe('GET /api/user/info', () => {
    it('should return user info for authenticated user', async () => {
      const response = await request(app)
        .get('/api/user/info')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.nickname).toBe(testUser.nickname);
      expect(response.body.data.phone).toBe(testUser.phone);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/user/info');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/user/points/today', () => {
    beforeEach(async () => {
      // Create some test points records
      await prisma.pointsRecord.create({
        data: {
          userId: testUser.id,
          points: 10,
          type: 1
        }
      });
    });

    afterEach(async () => {
      // Cleanup points records
      await prisma.pointsRecord.deleteMany({
        where: { userId: testUser.id }
      });
    });

    it('should return today points summary', async () => {
      const response = await request(app)
        .get('/api/user/points/today')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.today_points).toBe(10);
      expect(response.body.data.remain_points).toBe(90);
    });
  });

  describe('GET /api/user/points/records', () => {
    beforeEach(async () => {
      // Create test points records
      await prisma.pointsRecord.createMany({
        data: [
          { userId: testUser.id, points: 10, type: 1 },
          { userId: testUser.id, points: -50, type: 2 }
        ]
      });
    });

    afterEach(async () => {
      // Cleanup points records
      await prisma.pointsRecord.deleteMany({
        where: { userId: testUser.id }
      });
    });

    it('should return paginated points records', async () => {
      const response = await request(app)
        .get('/api/user/points/records')
        .query({ page: 1, size: 10 })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.list).toHaveLength(2);
    });
  });
});