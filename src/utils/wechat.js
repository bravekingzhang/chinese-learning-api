const axios = require('axios');
const crypto = require('crypto');

exports.getWechatAccessToken = async (code) => {
  const url = 'https://api.weixin.qq.com/sns/oauth2/access_token';
  const params = {
    appid: process.env.WECHAT_APP_ID,
    secret: process.env.WECHAT_APP_SECRET,
    code,
    grant_type: 'authorization_code'
  };

  try {
    const response = await axios.get(url, { params });
    return {
      access_token: response.data.access_token,
      openid: response.data.openid
    };
  } catch (error) {
    console.error('Failed to get WeChat access token:', error);
    throw new Error('Failed to get WeChat access token');
  }
};

exports.getWechatUserInfo = async (accessToken, openid) => {
  const url = 'https://api.weixin.qq.com/sns/userinfo';
  const params = {
    access_token: accessToken,
    openid,
    lang: 'zh_CN'
  };

  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get WeChat user info:', error);
    throw new Error('Failed to get WeChat user info');
  }
};

exports.generateOrderNo = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${timestamp}${random}`;
};

exports.createWechatPay = async ({ orderNo, amount, description }) => {
  try {
    const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');

    const data = {
      appid: process.env.WECHAT_APP_ID,
      mchid: process.env.WECHAT_PAY_MCH_ID,
      description,
      out_trade_no: orderNo,
      notify_url: process.env.WECHAT_PAY_NOTIFY_URL,
      amount: {
        total: Math.round(amount * 100), // Convert to cents
        currency: 'CNY'
      },
      payer: {
        openid: 'OPENID' // Should be replaced with actual user's openid
      }
    };

    // Sign the request
    const message = `${method}\n${url.split('https://')[1]}\n${timestamp}\n${nonceStr}\n${JSON.stringify(data)}\n`;
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(message)
      .sign(process.env.WECHAT_PAY_KEY, 'base64');

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `WECHATPAY2-SHA256-RSA2048 ${signature}`,
      'User-Agent': 'Chinese Learning Mini Program'
    };

    const response = await axios.post(url, data, { headers });

    return {
      timeStamp: timestamp,
      nonceStr,
      package: `prepay_id=${response.data.prepay_id}`,
      signType: 'RSA',
      paySign: signature
    };
  } catch (error) {
    console.error('Failed to create WeChat pay:', error);
    throw new Error('Failed to create payment');
  }
};

exports.verifyPayNotification = (headers, body) => {
  try {
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const serial = headers['wechatpay-serial'];

    const message = `${timestamp}\n${nonce}\n${JSON.stringify(body)}\n`;
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(message);

    return verify.verify(process.env.WECHAT_PAY_CERT_PATH, signature, 'base64');
  } catch (error) {
    console.error('Failed to verify payment notification:', error);
    return false;
  }
};