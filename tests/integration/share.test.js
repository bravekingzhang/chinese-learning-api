const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const app = require('../../src/app');

const prisma = new PrismaClient();

describe('Share API', () => {
  let testUser;
  let testSharer;
  let token;
  let sharerToken;

  beforeAll(async () => {
    // Create test users
    testUser = await prisma.user.create({
      data: {
        openId: 'test_openid_share_user',
        phone: '13800138004',
        nickname: 'Test Share User',
        avatar: 'http://test.com/avatar.jpg'
      }
    });

    testSharer = await prisma.user.create({
      data: {
        openId: 'test_openid_sharer',
        phone: '13800138005',
        nickname: 'Test Sharer',
        avatar: 'http://test.com/avatar2.jpg'
      }
    });

    // Generate test tokens
    token = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    sharerToken = jwt.sign(
      { userId: testSharer.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testUser.id, testSharer.id]
        }
      }
    });
    await prisma.$disconnect();
  });

  describe('GET /api/share/code', () => {
    it('should return user ID as invite code', async () => {
      const response = await request(app)
        .get('/api/share/code')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.invite_code).toBe(testUser.id);
    });
  });

  describe('POST /api/share/invite', () => {
    afterEach(async () => {
      // Cleanup share records and member records
      await prisma.shareRecord.deleteMany({
        where: {
          OR: [
            { sharerId: testSharer.id },
            { inviteeId: testUser.id }
          ]
        }
      });
      await prisma.member.deleteMany({
        where: {
          userId: {
            in: [testUser.id, testSharer.id]
          }
        }
      });
    });

    it('should process invite code successfully', async () => {
      const response = await request(app)
        .post('/api/share/invite')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inviteCode: testSharer.id
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.reward_days).toBe(7);
      expect(response.body.data.expire_time).toBeTruthy();

      // Verify share record
      const shareRecord = await prisma.shareRecord.findFirst({
        where: {
          sharerId: testSharer.id,
          inviteeId: testUser.id
        }
      });
      expect(shareRecord).toBeTruthy();
      expect(shareRecord.rewardDays).toBe(7);
    });

    it('should prevent using invite code more than once', async () => {
      // First use
      await request(app)
        .post('/api/share/invite')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inviteCode: testSharer.id
        });

      // Second use
      const response = await request(app)
        .post('/api/share/invite')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inviteCode: testSharer.id
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('You have already used an invite code');
    });

    it('should enforce monthly reward limit', async () => {
      // Create 10 share records for the sharer
      await prisma.shareRecord.createMany({
        data: Array(10).fill(null).map((_, i) => ({
          sharerId: testSharer.id,
          inviteeId: `dummy_user_${i}`,
          rewardDays: 7,
          createdAt: new Date()
        }))
      });

      const response = await request(app)
        .post('/api/share/invite')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inviteCode: testSharer.id
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('Sharer has reached monthly reward limit');
    });
  });

  describe('GET /api/share/stats', () => {
    beforeEach(async () => {
      // Create some share records
      await prisma.shareRecord.createMany({
        data: [
          {
            sharerId: testSharer.id,
            inviteeId: 'dummy_user_1',
            rewardDays: 7,
            createdAt: dayjs().subtract(1, 'month').toDate()
          },
          {
            sharerId: testSharer.id,
            inviteeId: 'dummy_user_2',
            rewardDays: 7,
            createdAt: new Date()
          }
        ]
      });
    });

    afterEach(async () => {
      // Cleanup share records
      await prisma.shareRecord.deleteMany({
        where: { sharerId: testSharer.id }
      });
    });

    it('should return share statistics', async () => {
      const response = await request(app)
        .get('/api/share/stats')
        .set('Authorization', `Bearer ${sharerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.total_invites).toBe(2);
      expect(response.body.data.month_invites).toBe(1);
      expect(response.body.data.total_reward_days).toBe(14);
      expect(response.body.data.month_remain_times).toBe(9);
    });
  });
}); 