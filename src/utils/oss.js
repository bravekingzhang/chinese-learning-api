const OSS = require('ali-oss');

const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  endpoint: process.env.OSS_ENDPOINT
});

exports.uploadToOSS = async (filename, buffer) => {
  try {
    const result = await client.put(filename, buffer);
    return result.url;
  } catch (error) {
    console.error('Failed to upload to OSS:', error);
    throw new Error('Failed to upload file');
  }
}; 