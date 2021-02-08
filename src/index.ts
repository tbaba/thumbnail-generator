import S3 from 'aws-sdk/clients/s3';
import { inspect } from 'util';
import * as sharp from 'sharp';

const s3 = new S3();

interface Result<T> {
  error: Error | null;
  result: T | null;
}

exports.handler = async (event: any) => {
  console.log(`Reading options from event:\n ${inspect(event, { depth: 5 })}`);

  const srcBucket: string = event.Records[0].s3.bucket.name;
  const srcKey: string = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, ' ')
  );
  const destBucket: string = `${srcBucket}-resized`;
  const destKey: string = `resized-${srcKey}`;

  const typeMatch: RegExpMatchArray = srcKey.match(/\.([^.]*)$/);
  if (!typeMatch) {
    console.log('Could not determine the type of image');
    return;
  }

  const imageType: string = typeMatch[1].toLowerCase();
  if (imageType != 'jpg' && imageType != 'png') {
    console.log(`Unsupported image type: ${imageType}`);
    return;
  }

  let originalImage;

  try {
    const params: { Bucket: string; Key: string } = {
      Bucket: srcBucket,
      Key: srcKey,
    };
    originalImage = await s3.getObject(params).promise();
  } catch (error: Error | undefined) {
    console.log(error);
    return;
  }

  const width: number = 200;
  let buffer: Buffer;

  try {
    buffer = await sharp(originalImage.Body).resize(width).toBuffer();
  } catch (error: any) {
    console.log(error);
    return;
  }

  try {
    const destParams: {
      Bucket: string;
      Key: string;
      Body: Buffer;
      ContentType: 'image';
    } = {
      Bucket: destBucket,
      Key: destKey,
      Body: buffer,
      ContentType: 'image',
    };

    await s3.putObject(destParams).promise();
  } catch (error) {
    console.log(error);
    return;
  }

  console.log(
    `Successfully resized ${srcBucket}/${srcKey} and uploaded to ${destBucket}/${destKey}`
  );
};
