/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "foodlabdiary.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "foodlabdiary.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "foodlabdiary.s3.ap-northeast-2.amazonaws.com",
      },
    ],
  },
}

export default nextConfig
