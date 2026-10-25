# Changelog

## 0.1.0

- InferOwl node: candidate (create, get, search, update), job (create, get, search), application (move to stage), call (log outcome).
- InferOwl Trigger: every InferOwl webhook event, subscribed and removed through the InferOwl API, verifying `X-InferOwl-Signature` over `${timestamp}.${rawBody}` and rejecting deliveries whose `X-InferOwl-Timestamp` is missing, altered or more than 5 minutes old (replay protection).
