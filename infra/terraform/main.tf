locals {
  prefix = "${var.project}-${var.environment}"
}

resource "aws_s3_bucket" "raw_media" {
  bucket = "${local.prefix}-raw-media"
}

resource "aws_s3_bucket_public_access_block" "raw_media" {
  bucket = aws_s3_bucket.raw_media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "raw_media" {
  bucket = aws_s3_bucket.raw_media.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket" "processed_media" {
  bucket = "${local.prefix}-processed-media"
}

resource "aws_s3_bucket_public_access_block" "processed_media" {
  bucket = aws_s3_bucket.processed_media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "processed_media" {
  bucket = aws_s3_bucket.processed_media.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_cloudfront_origin_access_control" "processed_media" {
  name                              = "${local.prefix}-processed-media-oac"
  description                       = "OAC for processed media bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "media_cdn" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.prefix} media CDN"

  origin {
    domain_name              = aws_s3_bucket.processed_media.bucket_regional_domain_name
    origin_id                = "processed-media-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.processed_media.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "processed-media-origin"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

data "aws_iam_policy_document" "processed_media_cdn_read" {
  statement {
    sid = "AllowCloudFrontRead"

    actions = ["s3:GetObject"]

    resources = [
      "${aws_s3_bucket.processed_media.arn}/*"
    ]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.media_cdn.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "processed_media" {
  bucket = aws_s3_bucket.processed_media.id
  policy = data.aws_iam_policy_document.processed_media_cdn_read.json
}
