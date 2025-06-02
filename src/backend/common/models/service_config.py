from dataclasses import dataclass
from typing import Type


@dataclass
class ServiceConfig:
    """Configuration for a service"""
    name: str
    service_class: Type

class ServiceBusConfig:
    """Configuration for Service Bus source"""
    max_wait_time: int = 60  # Default max wait time for message processing
    max_message_count: int = 1  # Default max messages to process at once
    retry_delay: int = 5  # Default delay between retries in seconds
    use_lock_renewer: bool = True  # Whether to use lock renewer for long-running operations
    use_delete_receiver: bool = False  # Whether to delete the message after receiving it
    
    @staticmethod
    def for_queue(queue_name: str) -> 'QueueConfig':
        return QueueConfig(queue_name)
    
    @staticmethod
    def for_subscription(topic_name: str, subscription_name: str) -> 'SubscriptionConfig':
        return SubscriptionConfig(topic_name, subscription_name)


class QueueConfig(ServiceBusConfig):
    def __init__(self, queue_name: str):
        self.queue_name = queue_name
    
    def __str__(self):
        return f"Queue: {self.queue_name}"


class SubscriptionConfig(ServiceBusConfig):
    def __init__(self, topic_name: str, subscription_name: str):
        self.topic_name = topic_name
        self.subscription_name = subscription_name
    
    def __str__(self):
        return f"Topic: {self.topic_name}, Subscription: {self.subscription_name}"