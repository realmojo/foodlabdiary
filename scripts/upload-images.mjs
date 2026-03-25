import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import https from "https"

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const BUCKET = "petpawpaw"

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on("data", (c) => chunks.push(c))
      res.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers["content-type"] }))
      res.on("error", reject)
    }).on("error", reject)
  })
}

const images = [
  {
    url: "https://petniverse.co.kr/wp-content/uploads/2025/09/gemini_image_1-18.png",
    key: "posts/2026/03/pet-winter-care-hero.png",
  },
  {
    url: "https://petniverse.co.kr/wp-content/uploads/2025/09/gemini_image_0-18.png",
    key: "posts/2026/03/pet-winter-care-cat.png",
  },
]

for (const img of images) {
  console.log(`Downloading: ${img.url}`)
  const { buffer, contentType } = await fetchBuffer(img.url)
  console.log(`  Size: ${buffer.length} bytes, Type: ${contentType}`)

  console.log(`Uploading to s3://${BUCKET}/${img.key}`)
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: img.key,
      Body: buffer,
      ContentType: contentType || "image/png",
    }),
  )
  console.log(`  Done: https://${BUCKET}.s3.ap-northeast-2.amazonaws.com/${img.key}`)
}

console.log("\nAll images uploaded!")
