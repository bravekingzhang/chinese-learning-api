const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

// Mock external services
jest.mock('../../src/utils/kouzi', () => ({
  generateExercise: jest.fn(),
  generateAudio: jest.fn()
}));
jest.mock('../../src/utils/oss', () => ({
  uploadToOSS: jest.fn()
}));

const { generateExercise, generateAudio } = require('../../src/utils/kouzi');
const { uploadToOSS } = require('../../src/utils/oss');

const prisma = new PrismaClient();

describe('Exercise API', () => {
  let testUser;
  let token;

  beforeEach(() => {
    // Mock external service responses
    generateExercise.mockResolvedValue({
      level_1: ['天地', '人和'],
      level_2: ['天地人', '和为贵'],
      level_3: ['天地人和', '为贵自在'],
      level_4: ['天地人和为贵', '自在逍遥游']
    });

    generateAudio.mockResolvedValue(Buffer.from('fake audio data'));
    uploadToOSS.mockResolvedValue('http://test.com/audio.mp3');
  });

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        openId: 'test_openid_exercise',
        phone: '13800138002',
        nickname: 'Test Exercise User',
        avatar: 'http://test.com/avatar.jpg',
        memberType: 1,
        expireTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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

  describe('POST /api/exercise/generate', () => {
    afterEach(async () => {
      // Cleanup exercise records
      await prisma.exerciseRecord.deleteMany({
        where: { userId: testUser.id }
      });
      await prisma.pointsRecord.deleteMany({
        where: { userId: testUser.id }
      });
    });

    it('should generate exercise successfully with manual input', async () => {
      const response = await request(app)
        .post('/api/exercise/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 1,
          chars: '天地人和为贵',
          difficulty: 1,
          style: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.content).toBeTruthy();
      expect(response.body.data.audio_url_1).toBeTruthy();
    });

    it('should enforce daily points limit', async () => {
      // Create points records reaching daily limit
      await prisma.pointsRecord.createMany({
        data: Array(10).fill({
          userId: testUser.id,
          points: 10,
          type: 1,
          remark: '生成题目'
        })
      });

      const response = await request(app)
        .post('/api/exercise/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 1,
          chars: '天地人和为贵'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('Daily points limit reached');
    });
  });

  describe('POST /api/exercise/shuffle', () => {
    let testExercise;

    beforeEach(async () => {
      // Create test exercise
      testExercise = await prisma.exerciseRecord.create({
        data: {
          userId: testUser.id,
          baseChars: '天地人和为贵',
          difficulty: 1,
          content: JSON.stringify({
            level_1: ['天地', '人和'],
            level_2: ['天地人', '和为贵'],
            level_3: ['天地人和', '为贵自在'],
            level_4: ['天地人和为贵', '自在逍遥游']
          }),
          audioUrl1: 'http://test.com/audio1.mp3',
          audioUrl2: 'http://test.com/audio2.mp3',
          audioUrl3: 'http://test.com/audio3.mp3',
          audioUrl4: 'http://test.com/audio4.mp3'
        }
      });
    });

    afterEach(async () => {
      // Cleanup exercise records
      await prisma.exerciseRecord.deleteMany({
        where: { userId: testUser.id }
      });
    });

    it('should shuffle exercise content successfully', async () => {
      const response = await request(app)
        .post('/api/exercise/shuffle')
        .set('Authorization', `Bearer ${token}`)
        .send({
          exerciseId: testExercise.id
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.content).toBeTruthy();
      expect(response.body.data.audio_url_1).toBeTruthy();
    });

    it('should return 404 for non-existent exercise', async () => {
      const response = await request(app)
        .post('/api/exercise/shuffle')
        .set('Authorization', `Bearer ${token}`)
        .send({
          exerciseId: 'non-existent-id'
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe(404);
    });
  });

  describe('GET /api/exercise/history', () => {
    beforeEach(async () => {
      // Create test exercise records
      await prisma.exerciseRecord.createMany({
        data: Array(3).fill({
          userId: testUser.id,
          baseChars: '天地人和为贵',
          difficulty: 1,
          content: JSON.stringify({
            level_1: ['天地', '人和'],
            level_2: ['天地人', '和为贵'],
            level_3: ['天地人和', '为贵自在'],
            level_4: ['天地人和为贵', '自在逍遥游']
          })
        })
      });
    });

    afterEach(async () => {
      // Cleanup exercise records
      await prisma.exerciseRecord.deleteMany({
        where: { userId: testUser.id }
      });
    });

    it('should return paginated exercise history', async () => {
      const response = await request(app)
        .get('/api/exercise/history')
        .query({ page: 1, size: 10 })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.list).toHaveLength(3);
    });
  });

  describe('DELETE /api/exercise/history/:id', () => {
    let testExercise;

    beforeEach(async () => {
      // Create test exercise
      testExercise = await prisma.exerciseRecord.create({
        data: {
          userId: testUser.id,
          baseChars: '天地人和为贵',
          difficulty: 1,
          content: JSON.stringify({
            level_1: ['天地', '人和'],
            level_2: ['天地人', '和为贵'],
            level_3: ['天地人和', '为贵自在'],
            level_4: ['天地人和为贵', '自在逍遥游']
          })
        }
      });
    });

    it('should delete exercise record successfully', async () => {
      const response = await request(app)
        .delete(`/api/exercise/history/${testExercise.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);

      // Verify deletion
      const deleted = await prisma.exerciseRecord.findUnique({
        where: { id: testExercise.id }
      });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent exercise', async () => {
      const response = await request(app)
        .delete('/api/exercise/history/non-existent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe(404);
    });
  });
}); 