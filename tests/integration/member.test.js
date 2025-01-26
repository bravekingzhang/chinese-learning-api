const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { createWechatPay, verifyPayNotification } = require('../../src/utils/wechat');

const prisma = new PrismaClient();

// Mock WeChat pay
jest.mock('../../src/utils/wechat', () => ({
  ...jest.requireActual('../../src/utils/wechat'),
  createWechatPay: jest.fn(),
  verifyPayNotification: jest.fn()
}));

describe('Member API', () => {
  let testUser;
  let token;
  let testOrder;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        openId: 'test_openid_member',
        phone: '13800138003',
        nickname: 'Test Member User',
        avatar: 'http://test.com/avatar.jpg'
      }
    });

    // Generate test token
    token = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Mock WeChat pay response
    createWechatPay.mockResolvedValue({
      timeStamp: '1234567890',
      nonceStr: 'test_nonce',
      package: 'prepay_id=test_prepay_id',
      signType: 'RSA',
      paySign: 'test_sign'
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    await prisma.$disconnect();
  });

  describe('POST /api/member/order/create', () => {
    afterEach(async () => {
      // Cleanup orders
      await prisma.order.deleteMany({
        where: { userId: testUser.id }
      });
    });

    it('should create order successfully', async () => {
      const response = await request(app)
        .post('/api/member/order/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 1,
          memberType: 2 // 30-day membership
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.amount).toBe(29.9);
      expect(response.body.data.days).toBe(30);
      expect(response.body.data.pay_params).toBeTruthy();
    });

    it('should reject invalid member type', async () => {
      const response = await request(app)
        .post('/api/member/order/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 1,
          memberType: 99
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
    });
  });

  describe('POST /api/member/order/notify', () => {
    beforeEach(async () => {
      // Create test order
      testOrder = await prisma.order.create({
        data: {
          userId: testUser.id,
          orderNo: 'TEST_ORDER_001',
          amount: 29.9,
          memberType: 2,
          days: 30,
          type: 1,
          status: 0
        }
      });

      // Mock signature verification
      verifyPayNotification.mockReturnValue(true);
    });

    afterEach(async () => {
      // Cleanup orders and membership records
      await prisma.order.deleteMany({
        where: { userId: testUser.id }
      });
      await prisma.member.deleteMany({
        where: { userId: testUser.id }
      });
    });

    it('should process payment notification successfully', async () => {
      const response = await request(app)
        .post('/api/member/order/notify')
        .set('Wechatpay-Signature', 'mock_signature')
        .set('Wechatpay-Timestamp', '1234567890')
        .set('Wechatpay-Nonce', 'mock_nonce')
        .set('Wechatpay-Serial', 'mock_serial')
        .send({
          resource: {
            ciphertext: 'mock_ciphertext',
            associated_data: 'mock_associated_data',
            nonce: 'mock_resource_nonce'
          },
          summary: 'Notification test',
          event_type: 'TRANSACTION.SUCCESS',
          resource_type: 'encrypt-resource',
          create_time: new Date().toISOString(),
          id: 'mock_notification_id',
          out_trade_no: testOrder.orderNo,
          transaction_id: 'mock_transaction_id'
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);

      // Verify order status updated
      const updatedOrder = await prisma.order.findUnique({
        where: { orderNo: testOrder.orderNo }
      });
      expect(updatedOrder.status).toBe(1);
      expect(updatedOrder.payTime).toBeTruthy();

      // Verify membership created
      const membership = await prisma.member.findFirst({
        where: { userId: testUser.id }
      });
      expect(membership).toBeTruthy();
      expect(membership.memberType).toBe(testOrder.memberType);
    });

    it('should reject duplicate payment notification', async () => {
      // First update order status to paid
      await prisma.order.update({
        where: { orderNo: testOrder.orderNo },
        data: { status: 1, payTime: new Date() }
      });

      const response = await request(app)
        .post('/api/member/order/notify')
        .set('Wechatpay-Signature', 'mock_signature')
        .set('Wechatpay-Timestamp', '1234567890')
        .set('Wechatpay-Nonce', 'mock_nonce')
        .set('Wechatpay-Serial', 'mock_serial')
        .send({
          resource: {
            ciphertext: 'mock_ciphertext',
            associated_data: 'mock_associated_data',
            nonce: 'mock_resource_nonce'
          },
          summary: 'Notification test',
          event_type: 'TRANSACTION.SUCCESS',
          resource_type: 'encrypt-resource',
          create_time: new Date().toISOString(),
          id: 'mock_notification_id',
          out_trade_no: testOrder.orderNo,
          transaction_id: 'mock_transaction_id'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
    });

    it('should reject invalid order number', async () => {
      const response = await request(app)
        .post('/api/member/order/notify')
        .set('Wechatpay-Signature', 'mock_signature')
        .set('Wechatpay-Timestamp', '1234567890')
        .set('Wechatpay-Nonce', 'mock_nonce')
        .set('Wechatpay-Serial', 'mock_serial')
        .send({
          resource: {
            ciphertext: 'mock_ciphertext',
            associated_data: 'mock_associated_data',
            nonce: 'mock_resource_nonce'
          },
          summary: 'Notification test',
          event_type: 'TRANSACTION.SUCCESS',
          resource_type: 'encrypt-resource',
          create_time: new Date().toISOString(),
          id: 'mock_notification_id',
          out_trade_no: 'INVALID_ORDER_NO',
          transaction_id: 'mock_transaction_id'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
    });

    it('should reject invalid signature', async () => {
      // Mock signature verification to fail
      verifyPayNotification.mockReturnValue(false);

      const response = await request(app)
        .post('/api/member/order/notify')
        .set('Wechatpay-Signature', 'invalid_signature')
        .set('Wechatpay-Timestamp', '1234567890')
        .set('Wechatpay-Nonce', 'mock_nonce')
        .set('Wechatpay-Serial', 'mock_serial')
        .send({
          resource: {
            ciphertext: 'mock_ciphertext',
            associated_data: 'mock_associated_data',
            nonce: 'mock_resource_nonce'
          },
          summary: 'Notification test',
          event_type: 'TRANSACTION.SUCCESS',
          resource_type: 'encrypt-resource',
          create_time: new Date().toISOString(),
          id: 'mock_notification_id',
          out_trade_no: testOrder.orderNo,
          transaction_id: 'mock_transaction_id'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
    });
  });

  describe('GET /api/member/order/query/:orderNo', () => {
    let testOrder;

    beforeEach(async () => {
      // Create test order
      testOrder = await prisma.order.create({
        data: {
          userId: testUser.id,
          orderNo: 'TEST_ORDER_001',
          amount: 29.9,
          memberType: 2,
          days: 30,
          type: 1,
          status: 0
        }
      });
    });

    afterEach(async () => {
      // Cleanup orders
      await prisma.order.deleteMany({
        where: { userId: testUser.id }
      });
    });

    it('should query order successfully', async () => {
      const response = await request(app)
        .get(`/api/member/order/query/${testOrder.orderNo}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.status).toBe(0);
      expect(response.body.data.member_type).toBe(2);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/api/member/order/query/NON_EXISTENT')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe(404);
    });
  });

  describe('POST /api/member/card/exchange', () => {
    let testCard;

    beforeEach(async () => {
      // Create test card
      testCard = await prisma.card.create({
        data: {
          cardNo: 'TEST_CARD_001',
          memberType: 1,
          days: 7,
          status: 0
        }
      });
    });

    afterEach(async () => {
      // Cleanup cards and orders
      await prisma.card.deleteMany({
        where: { cardNo: testCard.cardNo }
      });
      await prisma.order.deleteMany({
        where: { userId: testUser.id }
      });
    });

    it('should exchange card successfully', async () => {
      const response = await request(app)
        .post('/api/member/card/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cardNo: testCard.cardNo
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.member_type).toBe(1);
      expect(response.body.data.days).toBe(7);

      // Verify card status
      const updatedCard = await prisma.card.findUnique({
        where: { cardNo: testCard.cardNo }
      });
      expect(updatedCard.status).toBe(1);
      expect(updatedCard.usedUserId).toBe(testUser.id);
    });

    it('should reject used card', async () => {
      // Mark card as used
      await prisma.card.update({
        where: { cardNo: testCard.cardNo },
        data: {
          status: 1,
          usedUserId: 'other_user',
          usedTime: new Date()
        }
      });

      const response = await request(app)
        .post('/api/member/card/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cardNo: testCard.cardNo
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(400);
    });
  });

  describe('GET /api/member/card/info/:cardNo', () => {
    let testCard;

    beforeEach(async () => {
      // Create test card
      testCard = await prisma.card.create({
        data: {
          cardNo: 'TEST_CARD_002',
          memberType: 1,
          days: 7,
          status: 0
        }
      });
    });

    afterEach(async () => {
      // Cleanup cards
      await prisma.card.deleteMany({
        where: { cardNo: testCard.cardNo }
      });
    });

    it('should get card info successfully', async () => {
      const response = await request(app)
        .get(`/api/member/card/info/${testCard.cardNo}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.member_type).toBe(1);
      expect(response.body.data.days).toBe(7);
      expect(response.body.data.status).toBe(0);
    });

    it('should return 404 for non-existent card', async () => {
      const response = await request(app)
        .get('/api/member/card/info/NON_EXISTENT')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe(404);
    });
  });
});