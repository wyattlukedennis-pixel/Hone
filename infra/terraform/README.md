# Hone Terraform (Storage + CDN)

This module provisions baseline media infrastructure for Hone:

- Raw media S3 bucket (private).
- Processed media S3 bucket (private origin).
- CloudFront distribution for processed media delivery.
- Origin Access Control and bucket policy for restricted origin reads.

## Usage

```bash
cd infra/terraform
terraform init
terraform plan \
  -var="project=hone" \
  -var="environment=dev" \
  -var="aws_region=us-east-1"
terraform apply
```

## Outputs

- `raw_bucket_name`
- `processed_bucket_name`
- `cdn_domain_name`

## Notes

- This is an infrastructure baseline for Sprint 1 and may be extended with lifecycle rules, KMS, and logging in later sprints.
