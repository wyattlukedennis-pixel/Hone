output "raw_bucket_name" {
  value = aws_s3_bucket.raw_media.id
}

output "processed_bucket_name" {
  value = aws_s3_bucket.processed_media.id
}

output "cdn_domain_name" {
  value = aws_cloudfront_distribution.media_cdn.domain_name
}
