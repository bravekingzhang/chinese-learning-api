const { PrismaClient } = require('@prisma/client');
const { generateOrderNo, createWechatPay } = require('../utils/wechat');
const dayjs = require('dayjs');

const prisma = new PrismaClient();

// Membership type configurations
const MEMBER_TYPES = {
  1: { days: 7, amount: 9.9, name: '7天会员' },
  2: { days: 30, amount: 29.9, name: '30天会员' },
  3: { days: 365, amount: 299, name: '365天会员' }
};

exports.createOrder = async (req, res) => {
  try {
    const { type, memberType } = req.body;
    const userId = req.user.userId;

    // Validate member type
    if (!MEMBER_TYPES[memberType]) {
      return res.status(400).json({
        code: 400,
        message: 'Invalid member type'
      });
    }

    // Generate unique order number
    const orderNo = generateOrderNo();
    const { days, amount } = MEMBER_TYPES[memberType];

    // Create order record
    const order = await prisma.order.create({
      data: {
        userId,
        orderNo,
        amount,
        memberType,
        days,
        type,
        status: 0 // Unpaid
      }
    });

    // Generate WeChat pay parameters
    const payParams = await createWechatPay({
      orderNo,
      amount,
      description: `购买${MEMBER_TYPES[memberType].name}`
    });

    res.json({
      code: 0,
      data: {
        order_no: order.orderNo,
        amount: order.amount,
        member_type: order.memberType,
        days: order.days,
        pay_params: payParams
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to create order'
    });
  }
};

exports.queryOrder = async (req, res) => {
  try {
    const { orderNo } = req.params;
    const userId = req.user.userId;

    const order = await prisma.order.findUnique({
      where: {
        orderNo,
        userId
      }
    });

    if (!order) {
      return res.status(404).json({
        code: 404,
        message: 'Order not found'
      });
    }

    res.json({
      code: 0,
      data: {
        status: order.status,
        member_type: order.memberType,
        expire_time: order.status === 1 ? await getMemberExpireTime(userId) : null
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: 'Failed to query order'
    });
  }
};

exports.handlePayNotify = async (req, res) => {
  try {
    const { orderNo, transactionId } = req.body; // Simplified, actual WeChat pay notification has more fields

    const order = await prisma.order.findUnique({
      where: { orderNo }
    });

    if (!order || order.status !== 0) {
      return res.status(400).json({
        code: 400,
        message: 'Invalid order'
      });
    }

    // Start transaction
    await prisma.$transaction(async (prisma) => {
      // Update order status
      await prisma.order.update({
        where: { orderNo },
        data: {
          status: 1,
          payTime: new Date()
        }
      });

      // Update user membership
      await updateMembership(order.userId, order.memberType, order.days, prisma);
    });

    res.json({
      code: 0,
      message: 'Success'
    });
  } catch (error) {
    console.error('Payment notification error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to process payment notification'
    });
  }
};

exports.exchangeCard = async (req, res) => {
  try {
    const { cardNo } = req.body;
    const userId = req.user.userId;

    // Find and validate card
    const card = await prisma.card.findUnique({
      where: { cardNo }
    });

    if (!card) {
      return res.status(404).json({
        code: 404,
        message: 'Card not found'
      });
    }

    if (card.status !== 0) {
      return res.status(400).json({
        code: 400,
        message: 'Card has been used'
      });
    }

    // Start transaction
    await prisma.$transaction(async (prisma) => {
      // Update card status
      await prisma.card.update({
        where: { cardNo },
        data: {
          status: 1,
          usedUserId: userId,
          usedTime: new Date()
        }
      });

      // Update user membership
      await updateMembership(userId, card.memberType, card.days, prisma);

      // Create order record
      await prisma.order.create({
        data: {
          userId,
          orderNo: generateOrderNo(),
          amount: 0,
          memberType: card.memberType,
          days: card.days,
          type: 2, // Card exchange
          status: 1, // Paid
          payTime: new Date()
        }
      });
    });

    const expireTime = await getMemberExpireTime(userId);

    res.json({
      code: 0,
      data: {
        member_type: card.memberType,
        days: card.days,
        expire_time: expireTime
      }
    });
  } catch (error) {
    console.error('Card exchange error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to exchange card'
    });
  }
};

exports.getCardInfo = async (req, res) => {
  try {
    const { cardNo } = req.params;

    const card = await prisma.card.findUnique({
      where: { cardNo }
    });

    if (!card) {
      return res.status(404).json({
        code: 404,
        message: 'Card not found'
      });
    }

    res.json({
      code: 0,
      data: {
        member_type: card.memberType,
        days: card.days,
        status: card.status
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: 'Failed to get card info'
    });
  }
};

// Helper functions
async function updateMembership(userId, memberType, days, prismaClient) {
  const user = await prismaClient.user.findUnique({
    where: { id: userId }
  });

  const now = new Date();
  const newExpireTime = user.expireTime && user.expireTime > now
    ? dayjs(user.expireTime).add(days, 'day').toDate()
    : dayjs().add(days, 'day').toDate();

  await prismaClient.user.update({
    where: { id: userId },
    data: {
      memberType,
      expireTime: newExpireTime
    }
  });

  await prismaClient.member.create({
    data: {
      userId,
      memberType,
      expireTime: newExpireTime
    }
  });
}

async function getMemberExpireTime(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { expireTime: true }
  });
  return user.expireTime;
} 