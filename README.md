# serverless

### Description

The repository contains the code for a serverless cloud function **(Function as a Service, or FaaS)**. This function utilizes an event-driven architecture and is activated by **Google Cloud Pub/Sub** through a push mechanism. When triggered, it orchestrates the sending of a verification link via email to the user, which includes an expiration time for added security. This setup ensures efficient, scalable handling of user verification processes without the need for dedicated server infrastructure.
