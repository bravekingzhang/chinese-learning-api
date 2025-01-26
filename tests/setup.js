const path = require('path');
const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../.env.test') });

// Mock OSS client
jest.mock('../src/utils/oss', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://test-bucket.oss-cn-hangzhou.aliyuncs.com/test.jpg'),
  getSignedUrl: jest.fn().mockResolvedValue('https://test-bucket.oss-cn-hangzhou.aliyuncs.com/test.jpg?signature'),
  deleteFile: jest.fn().mockResolvedValue(true)
})); 